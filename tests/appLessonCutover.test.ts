import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { handleWorkspace } from '../api/teacher/workspace.js';
import { startLessonMigration } from '../api/_lib/lessonMigration.js';
import { activateLessonApp, deactivateLessonApp } from '../api/_lib/lessonAuthority.js';
import { teacherReadCache } from '../api/_lib/teacherReadCache.js';
import { STUDENT, id, admin, page, fixture, drain, report } from './helpers/lessonMigrationFixture.js';

const scope = [{ studentKey: STUDENT, subject: '영어' }];
const lesson = { studentKey: STUDENT, subject: '영어', date: '2026-10-09', start: '14:00', end: '15:20', classSession: '있음', round: 7, selfStudy: '없음', attendance: '출석', attitude: '상', homework: '상', test: '상', content: '앱에서 고친 수업', assignment: '복습', note: '', nextPlan: '', correct: 9, total: 10 };

async function appMode() {
    const pages = [page(1, { round: 5, date: '2026-09-01T14:00:00+09:00' }), page(2, { round: 6, date: '2026-09-08T14:00:00+09:00' })];
    const f = fixture(pages);
    f.rows.set('lessonReports/' + id(1), report(1)); f.rows.set('lessonReports/' + id(2), report(2, { lessonDateStart: '2026-09-08T14:00:00+09:00' }));
    f.rows.set('academyCoreAuthority/main', { active: true });
    f.rows.get('teacherWorkspaceAccess/teacher').scopes = scope;
    f.rows.set('users/teacher', { role: 'teacher', name: '박선생님' });
    await startLessonMigration(f.db, admin, { confirmed: true, mode: 'full' }); await drain(f);
    await activateLessonApp(f.db, admin, { confirmed: true });
    teacherReadCache.clear();
    const teacher = { uid: 'teacher', academyId: 'main', admin: false, principal: false, scopes: scope, teachingScopes: scope, db: f.db };
    const call = async (actor: any, method: string, input: any) => {
        let body: any; const res: any = { statusCode: 200, setHeader: () => {}, end: (v: string) => body = JSON.parse(v) };
        await handleWorkspace((method === 'GET' ? { method, url: '/api/teacher/workspace?' + new URLSearchParams(input), headers: {} } : { method, body: input, headers: {} }) as any, res, async () => actor);
        return { status: res.statusCode, ...body };
    };
    return { ...f, teacher, call, adminActor: { ...admin, db: f.db } };
}
/** Any Notion request during app-only lesson work is a failure. */
async function withoutNotion(fn: () => Promise<void>) {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = (async () => { calls++; throw Error('NOTION_CALLED'); }) as any;
    try { await fn(); } finally { globalThis.fetch = original; }
    assert.equal(calls, 0, 'Notion was called');
}

test('lists and previous-lesson/round numbers come from migrated rows with the same visibility, without Notion', async () => {
    const f = await appMode();
    await withoutNotion(async () => {
        const list = await f.call(f.teacher, 'GET', { action: 'academy-lessons' });
        assert.equal(list.ok, true); assert.deepEqual(list.records.map((r: any) => r.id).sort(), [id(1), id(2)]);
        assert.equal(list.records[0].source, 'notion'); assert.equal(list.records[0].ownerUid, 'teacher');
        const outsider = await f.call({ ...f.teacher, uid: 'other', scopes: [], teachingScopes: [] }, 'GET', { action: 'academy-lessons' });
        assert.equal(outsider.records.length, 0);
        const previous = await f.call(f.teacher, 'POST', { action: 'previous-lesson', studentKey: STUDENT, subject: '영어', date: '2026-09-05' });
        assert.equal(previous.ok, true); assert.equal(previous.data.round, 5); assert.equal(previous.data.sessionRecords.length, 2);
        const latest = await f.call(f.teacher, 'POST', { action: 'previous-lesson', studentKey: STUDENT, subject: '영어', date: '2026-10-09' });
        assert.equal(latest.data.round, 6);
    });
});

test('editing a migrated lesson keeps its ID, public report ID and reportIdentity; draft stays private until publish', async () => {
    const f = await appMode();
    await withoutNotion(async () => {
        const imported = await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' });
        assert.equal(imported.record.id, id(1)); assert.equal(imported.record.appProjectionId, id(1)); assert.equal(imported.record.revision, 1);
        const again = await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' });
        assert.equal(again.record.revision, 1, 'second import reuses the same app lesson');
        const before = structuredClone(f.rows.get('lessonReports/' + id(1)));
        const saved = await f.call(f.teacher, 'POST', { action: 'save-draft', id: id(1), revision: 1, data: lesson });
        assert.equal(saved.ok, true); assert.equal(saved.record.revision, 2); assert.equal(saved.record.sourceMode, 'firestore');
        assert.deepEqual(f.rows.get('lessonReports/' + id(1)), before);
        const reports = [...f.rows.keys()].filter(k => k.startsWith('lessonReports/')).length;
        const published = await f.call(f.teacher, 'POST', { action: 'publish', id: id(1) });
        assert.equal(published.stage, 'published');
        const pub = f.rows.get('lessonReports/' + id(1));
        assert.equal(pub.reportIdentity, 'public-1'); assert.equal(pub.teacherDraftId, id(1)); assert.equal(pub.internalStudentId, 'internal'); assert.match(pub.feedback, /앱에서 고친 수업/);
        assert.equal([...f.rows.keys()].filter(k => k.startsWith('lessonReports/')).length, reports);
        const replay = await f.call(f.teacher, 'POST', { action: 'publish', id: id(1) });
        assert.equal(replay.stage, 'published');
        await assert.equal((await f.call(f.teacher, 'POST', { action: 'save-draft', id: id(1), revision: 1, data: lesson })).error, 'DRAFT_CONFLICT');
    });
});

test('two app lessons for one student on one day stay separate; deletion removes only the chosen report and keeps history', async () => {
    const f = await appMode();
    await withoutNotion(async () => {
        const a = await f.call(f.teacher, 'POST', { action: 'save-draft', data: lesson });
        const b = await f.call(f.teacher, 'POST', { action: 'save-draft', data: { ...lesson, start: '17:00', end: '18:20', round: 8 } });
        await f.call(f.teacher, 'POST', { action: 'publish', id: a.id }); await f.call(f.teacher, 'POST', { action: 'publish', id: b.id });
        assert.ok(f.rows.has('lessonReports/app-' + a.id)); assert.ok(f.rows.has('lessonReports/app-' + b.id));
        await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(2), kind: 'lesson' });
        const removed = await f.call(f.teacher, 'POST', { action: 'archive-lesson', id: id(2), revision: 1 });
        assert.equal(removed.archived, true);
        assert.equal(f.rows.has('lessonReports/' + id(2)), false); assert.ok(f.rows.has('lessonReports/' + id(1)));
        assert.ok(f.rows.has('lessonReports/app-' + a.id)); assert.ok(f.rows.has('lessonReports/app-' + b.id));
        const history = [...f.rows.entries()].find(([k]) => k.startsWith('lessonAppHistory/' + id(2)) && k.endsWith(':archive'))![1];
        assert.equal(history.before.reportIdentity, 'public-2'); assert.equal(f.rows.get('teacherLessonDrafts/' + id(2)).archived, true);
        assert.ok(f.rows.has('lessonSourceRecords/' + id(2)), 'migrated source row is kept');
        teacherReadCache.clear();
        const list = await f.call(f.teacher, 'GET', { action: 'academy-lessons' });
        assert.equal(list.records.some((r: any) => r.id === id(2)), false);
        assert.equal(list.records.filter((r: any) => r.data.date === '2026-10-09').length, 2);
    });
});

test('other teachers cannot take over a lesson; Notion conflict tools are closed in app mode', async () => {
    const f = await appMode();
    const other = { ...f.teacher, uid: 'other' };
    f.rows.set('teacherWorkspaceAccess/other', { academyId: 'main', scopes: scope });
    await withoutNotion(async () => {
        assert.equal((await f.call(other, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' })).status, 403);
        await f.call(f.teacher, 'POST', { action: 'import-source-record', id: id(1), kind: 'lesson' });
        assert.equal((await f.call(other, 'POST', { action: 'save-draft', id: id(1), revision: 1, data: lesson })).status, 403);
        assert.equal((await f.call(other, 'POST', { action: 'publish', id: id(1) })).status, 403);
        assert.equal((await f.call(other, 'POST', { action: 'archive-lesson', id: id(1), revision: 1 })).status, 403);
        assert.equal((await f.call(f.teacher, 'POST', { action: 'resolve-lesson-conflict', id: id(1) })).error, 'LESSON_APP_ACTIVE');
        assert.equal((await f.call(f.teacher, 'GET', { action: 'lesson-conflict', id: id(1) })).error, 'LESSON_APP_ACTIVE');
    });
});

test('an old unconfirmed Notion creation is settled by evidence before app saving; without evidence it stays blocked', async () => {
    const f = await appMode(), settled = randomUUID(), unknown = randomUUID();
    const stuck = (rid: string) => f.rows.set('teacherLessonDrafts/' + rid, { ownerUid: 'teacher', academyId: 'main', revision: 1, stage: 'failed', notionWrite: { attempted: true, done: false, revision: 1 }, data: lesson });
    stuck(settled); stuck(unknown);
    f.rows.set('lessonWriteEvidence/' + settled, { draftId: settled, revision: 1, result: 'no-source-page' });
    await withoutNotion(async () => {
        const ok = await f.call(f.teacher, 'POST', { action: 'save-draft', id: settled, revision: 1, data: lesson });
        assert.equal(ok.ok, true); assert.equal(f.rows.get('teacherLessonDrafts/' + settled).notionWrite, null);
        assert.ok([...f.rows.keys()].some(k => k === 'lessonAppHistory/' + settled + ':1:settle'));
        assert.equal((await f.call(f.teacher, 'POST', { action: 'save-draft', id: unknown, revision: 1, data: lesson })).error, 'NOTION_WRITE_RESULT_UNCERTAIN');
    });
});

test('switching back off returns lessons to the previous path without touching app data', async () => {
    const f = await appMode();
    await withoutNotion(async () => { await f.call(f.teacher, 'POST', { action: 'save-draft', data: lesson }); });
    const drafts = JSON.stringify([...f.rows].filter(([k]) => k.startsWith('teacherLessonDrafts/')));
    await deactivateLessonApp(f.db, admin, { confirmed: true });
    assert.equal(JSON.stringify([...f.rows].filter(([k]) => k.startsWith('teacherLessonDrafts/'))), drafts);
    const legacy = await f.call(f.teacher, 'POST', { action: 'save-draft', data: lesson });
    assert.equal(legacy.ok, true); assert.equal(legacy.record.sourceMode, undefined);
});
