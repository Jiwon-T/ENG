import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { templateFirestore } from './helpers/templateFirestore.js';
import { TEMPLATE_DATABASE, TEMPLATE_SOURCE, TEMPLATE_STATE, TEMPLATE_JOBS, templateKey, importTemplateStep, reconcileTemplateStep, saveTemplate, processTemplateJob, dryRunTemplates, retryTemplate, templateReadsFromApp, storedMessageTemplates, templateManagementList } from '../api/_lib/messageTemplateStore.js';
import { templateAppActive, templateCutoverStatus, activateTemplateApp, deactivateTemplateApp } from '../api/_lib/messageTemplateAuthority.js';
import { templateAction } from '../api/_lib/messageTemplateActions.js';
import { runAutomaticImport } from '../src/lib/automaticImportRunner.js';

const admin = { uid: 'admin', admin: true, academyId: 'main' };
const tid = (i: number) => `11111111-1111-4111-8111-${String(i).padStart(12, '0')}`;
function fixture(count = 2) {
    const f = templateFirestore(), remote = new Map<string, any>(); let calls = 0;
    for (let i = 1; i <= count; i++) remote.set(tid(i), { id: tid(i), parent: { database_id: TEMPLATE_DATABASE }, last_edited_time: '2026-10-07T00:00:00Z', properties: { '유형': { title: [{ plain_text: '안내 ' + i }] }, '내용(문자본문)': { rich_text: [{ plain_text: '본문 ' + i }] }, '대상': { type: 'select', select: { name: '보호자' } } } });
    const notion: any = async (path: string, method = 'GET', body: any = {}) => {
        calls++;
        if (path.endsWith('/query')) { const since = Date.parse(body.filter?.last_edited_time?.on_or_after || '1970-01-01'); const pages = [...remote.values()].filter(p => Date.parse(p.last_edited_time) >= since); return { results: structuredClone(pages), has_more: false, next_cursor: null }; }
        const p = remote.get(path.slice(6)); if (!p) throw Error('NOTION_404');
        if (method === 'PATCH') { Object.assign(p.properties, body.properties); p.last_edited_time = new Date().toISOString(); }
        return structuredClone(p);
    };
    // Same sequence the screen's one button runs: import (incl. catch-up) then full source check.
    const prepare = async () => { for (let i = 0; i < 10; i++) if (!(await importTemplateStep(f.db, admin, notion)).continue) break; for (let i = 0; i < 10; i++) if (!(await reconcileTemplateStep(f.db, admin, notion)).continue) break; };
    return { ...f, notion, prepare, remote, get calls() { return calls; } };
}
const row = (f: any, i: number) => f.rows.get('messageTemplateSources/' + templateKey(tid(i)));

test('the switch needs a fresh full import and source check; status reads only Firestore', async () => {
    const f = fixture(); delete process.env.MESSAGE_TEMPLATE_READ_MODE;
    await assert.rejects(activateTemplateApp(f.db, admin, { confirmed: true }), /TEMPLATE_STORE_NOT_READY/);
    await f.prepare(); const before = f.calls;
    const status = await templateCutoverStatus(f.db, admin);
    assert.equal(f.calls, before); assert.equal(status.ready, true); assert.equal(status.active, false);
    const state = f.rows.get(TEMPLATE_STATE + '/' + TEMPLATE_SOURCE); state.lastReconcileAt = Date.now() - 16 * 60000;
    await assert.rejects(activateTemplateApp(f.db, admin, { confirmed: true }), /TEMPLATE_FINAL_CHECK_REQUIRED/);
    state.lastReconcileAt = Date.now();
    row(f, 1).status = 'conflict';
    await assert.rejects(activateTemplateApp(f.db, admin, { confirmed: true }), /TEMPLATE_CONFLICTS_REMAIN/);
    row(f, 1).status = 'synced'; row(f, 2).sourceWarning = 'NOTION_403';
    await assert.rejects(activateTemplateApp(f.db, admin, { confirmed: true }), /TEMPLATE_SOURCE_UNKNOWN/);
    row(f, 2).sourceWarning = null;
    await assert.rejects(activateTemplateApp(f.db, { ...admin, admin: false }, { confirmed: true }), /FORBIDDEN/);
    await assert.rejects(activateTemplateApp(f.db, admin, {}), /INVALID_INPUT/);
    assert.equal((await activateTemplateApp(f.db, admin, { confirmed: true })).active, true);
    assert.equal(await templateAppActive(f.db), true); assert.equal(await templateReadsFromApp(f.db), true);
});

test('activation settles edits still waiting for Notion; afterwards saves are final and no Notion call happens', async () => {
    const f = fixture(); delete process.env.MESSAGE_TEMPLATE_READ_MODE; await f.prepare();
    const waiting = await saveTemplate(f.db, admin, { id: tid(1), revision: row(f, 1).revision, operationId: randomUUID(), data: { title: '대기 중 수정', body: '본문' } });
    assert.equal(waiting.status, 'pending'); const jobId = row(f, 1).pendingJobId;
    const result = await activateTemplateApp(f.db, admin, { confirmed: true });
    assert.equal(result.convertedWaiting, 1); assert.equal(row(f, 1).status, 'app'); assert.equal(row(f, 1).data.title, '대기 중 수정');
    assert.equal(f.rows.get(TEMPLATE_JOBS + '/' + jobId).status, 'not-needed');
    const calls = f.calls, op = randomUUID(), input = { id: tid(2), revision: row(f, 2).revision, operationId: op, data: { title: '앱 전용 수정', body: '새 본문' } };
    const saved = await saveTemplate(f.db, admin, input);
    assert.equal(saved.status, 'app'); assert.equal(row(f, 2).pendingJobId, null);
    assert.equal((await saveTemplate(f.db, admin, input)).revision, saved.revision, 'same operation retry adds nothing');
    assert.equal(await processTemplateJob(f.db, jobId, f.notion), 'skipped');
    for (const run of [() => importTemplateStep(f.db, admin, f.notion), () => reconcileTemplateStep(f.db, admin, f.notion), () => dryRunTemplates(f.db, admin, undefined, f.notion), () => retryTemplate(f.db, admin, tid(2))])
        await assert.rejects(run(), /TEMPLATE_APP_ACTIVE/);
    assert.equal(f.calls, calls, 'no Notion call after the switch');
    assert.deepEqual((await storedMessageTemplates(f.db, admin)).map((t: any) => t.title).sort(), ['대기 중 수정', '앱 전용 수정']);
    const list = await templateManagementList(f.db, admin); assert.equal(list.appOnly, true); assert.equal(list.readMode, 'firestore');
    assert.equal(f.remote.get(tid(2)).properties['유형'].title[0].plain_text, '안내 2', 'Notion original untouched');
});

test('a hand-made switch is ignored; deactivation keeps app values and editing still works', async () => {
    const f = fixture(1); delete process.env.MESSAGE_TEMPLATE_READ_MODE;
    f.rows.set('messageTemplateAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'forged', verificationHash: 'x' });
    assert.equal(await templateAppActive(f.db), false);
    f.rows.delete('messageTemplateAuthority/main');
    await f.prepare(); await activateTemplateApp(f.db, admin, { confirmed: true });
    await saveTemplate(f.db, admin, { id: tid(1), revision: row(f, 1).revision, operationId: randomUUID(), data: { title: '앱 값', body: '앱 본문' } });
    await deactivateTemplateApp(f.db, admin, { confirmed: true });
    assert.equal(await templateAppActive(f.db), false); assert.equal(row(f, 1).data.title, '앱 값');
    const next = await saveTemplate(f.db, admin, { id: tid(1), revision: row(f, 1).revision, operationId: randomUUID(), data: { title: '다시 Notion 모드', body: '앱 본문' } });
    assert.equal(next.status, 'pending', 'previous mode queues a Notion copy again');
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('messageTemplateAuthorityHistory/')).length, 2);
});

test('the screen button flow: automatic import + check, then cutover through the template action route', async () => {
    const f = fixture(); delete process.env.MESSAGE_TEMPLATE_READ_MODE;
    const request = async (action: string, body: any = {}) => templateAction(f.db, admin, { action, ...body });
    // Route the runner's steps to this fixture's Notion double.
    const steps = async (action: string, body: any = {}) => action === 'template-import-step' ? importTemplateStep(f.db, admin, f.notion) : action === 'template-reconcile-step' ? reconcileTemplateStep(f.db, admin, f.notion) : request(action, body);
    await runAutomaticImport('templates', steps, () => false, () => {});
    assert.equal((await request('template-cutover', { confirmed: true })).active, true);
    assert.equal((await request('template-cutover-status')).active, true);
    assert.equal((await request('template-cutover-deactivate', { confirmed: true })).active, false);
});
