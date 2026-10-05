import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.js';
import { writeTeacherNotionRecord, notionPropertiesMatch } from '../api/_lib/teacherNotionWrite.js';
import { assertDraftEditable, publishDecision } from '../api/_lib/teacherWorkspacePolicy.js';
import { canRetryPublication } from '../src/lib/teacherPublicationRecovery.js';
const id = '11111111-1111-4111-8111-111111111111', pageId = '22222222-2222-4222-8222-222222222222', database = '33333333-3333-4333-8333-333333333333', stamp = '2026-10-05T01:00:00.000Z';
const props = { '앱 기록 ID': { rich_text: [{ text: { content: id } }] }, '내용': { rich_text: [{ text: { content: '첫 내용' } }] }, '대상 학생': { relation: [{ id }] } };
function fixture() {
    const f = registrationFirestore(), record: any = { revision: 1, stage: 'draft' };
    f.rows.set('teacherSchedules/' + id, record);
    let page: any = null, mode = '', duplicates = false;
    const calls: any[] = [];
    const notion = async (path: string, method = 'GET', body?: any) => { calls.push({ path, method, body }); if (path.endsWith('/query'))
        return { results: page ? (duplicates ? [page, page] : [page]) : [], has_more: false }; if (method === 'POST' && path === 'pages' || method === 'PATCH') {
        if (mode === 'no-commit') {
            mode = '';
            throw Error('TIMEOUT');
        }
        if (mode === 'definite') {
            mode = '';
            throw Error('NOTION_400');
        }
        page = { id: pageId, parent: { database_id: database }, last_edited_time: stamp, properties: structuredClone(body.properties) };
        if (mode === 'commit-timeout') {
            mode = '';
            throw Error('TIMEOUT');
        }
        return structuredClone(page);
    } if (path === `pages/${pageId}`)
        return structuredClone(page); throw Error('UNEXPECTED_CALL'); };
    const save = (v = props, r = record) => writeTeacherNotionRecord(f.db, 'teacherSchedules', id, r, database, v, notion);
    return { ...f, record, notion, calls, save, getPage: () => page, seed: (p: any) => { page = p; }, fail: (v: string) => { mode = v; }, duplicate: () => { duplicates = true; } };
}
test('new record creation verifies source and durably records identity once', async () => { const f = fixture(); await f.save(); await f.save(); assert.equal(f.calls.filter(c => c.path === 'pages').length, 1); assert.equal(f.rows.get('teacherSchedules/' + id).notionPageId, pageId); assert.equal(f.rows.get('teacherSchedules/' + id).notionWrite.done, true); });
test('lost creation response recovers from marker without a second create', async () => { const f = fixture(); f.fail('commit-timeout'); await assert.rejects(f.save(), /TIMEOUT/); assert.equal(f.rows.get('teacherSchedules/' + id).notionWrite.attempted, true); await f.save(); assert.equal(f.calls.filter(c => c.path === 'pages').length, 1); });
test('unconfirmed creation is locked, while a definitive rejection is retryable', async () => { const f = fixture(); f.fail('no-commit'); await assert.rejects(f.save(), /TIMEOUT/); await assert.rejects(f.save(), /NOTION_WRITE_RESULT_UNCERTAIN/); assert.throws(() => assertDraftEditable(f.rows.get('teacherSchedules/' + id), 1, { studentKey: id, subject: '영어' }), /NOTION_WRITE_PENDING/); const g = fixture(); g.fail('definite'); await assert.rejects(g.save(), /NOTION_400/); await g.save(); assert.equal(g.calls.filter(c => c.path === 'pages').length, 2); });
test('same revision cannot change its persisted intent, and foreign or duplicate pages cannot be claimed', async () => { const f = fixture(); f.fail('no-commit'); await assert.rejects(f.save(), /TIMEOUT/); await assert.rejects(f.save({ ...props, '내용': { rich_text: [] } }), /NOTION_WRITE_REQUEST_CONFLICT/); const g = fixture(); g.seed({ id: pageId, parent: { database_id: database }, properties: props, last_edited_time: stamp }); g.duplicate(); await assert.rejects(g.save(), /DUPLICATE_NOTION_RECORD/); const h = fixture(); h.seed({ id: pageId, parent: { database_id: id }, properties: props, last_edited_time: stamp }); await assert.rejects(h.save(), /NOTION_SOURCE_MISMATCH/); });
test('lost update response verifies current values without repeating PATCH', async () => { const f = fixture(); f.record.notionPageId = pageId; f.record.notionEditedAt = stamp; f.rows.set('teacherSchedules/' + id, f.record); f.seed({ id: pageId, parent: { database_id: database }, last_edited_time: stamp, properties: { ...props, '내용': { rich_text: [] } } }); f.fail('commit-timeout'); await assert.rejects(f.save(), /TIMEOUT/); await f.save(); assert.equal(f.calls.filter(c => c.method === 'PATCH').length, 1); });
test('stale edits and existing mismatched markers never get overwritten', async () => { const f = fixture(); f.record.notionPageId = pageId; f.record.notionEditedAt = stamp; f.rows.set('teacherSchedules/' + id, f.record); f.seed({ id: pageId, parent: { database_id: database }, last_edited_time: '2026-10-05T02:00:00.000Z', properties: { ...props, '내용': { rich_text: [] } } }); await assert.rejects(f.save(), /NOTION_EDIT_CONFLICT/); const g = fixture(); g.seed({ id: pageId, parent: { database_id: database }, last_edited_time: stamp, properties: { ...props, '내용': { rich_text: [] } } }); await assert.rejects(g.save(), /NOTION_EDIT_CONFLICT/); assert.equal(f.calls.some(c => c.method === 'PATCH'), false); });
test('property reconciliation accepts equivalent timezone instants and order-independent relations but rejects truncation', () => { const page = { properties: { '대상 학생': { relation: [{ id }] }, '날짜': { date: { start: '2026-10-05T14:00:00+09:00' } } } }; assert.equal(notionPropertiesMatch(page, { '대상 학생': props['대상 학생'], '날짜': { date: { start: '2026-10-05T05:00:00Z' } } }), true); page.properties['대상 학생'] = { ...page.properties['대상 학생'], has_more: true } as any; assert.equal(notionPropertiesMatch(page, { '대상 학생': props['대상 학생'] }), false); });
test('crashed publications recover after lease expiry and client uses the same policy', () => { const now = Date.now(), r = { stage: 'notion_saved', revision: 1, publishStartedAt: now - 180001, notionWrite: { leaseUntil: 0, done: true } }; assert.equal(publishDecision(r), 'publish'); assert.equal(canRetryPublication(r, now), true); assert.throws(() => publishDecision({ ...r, publishStartedAt: now }), /PUBLISH_IN_PROGRESS/); assert.equal(canRetryPublication({ ...r, publishStartedAt: now }, now), false); assert.equal(canRetryPublication({ ...r, stage: 'published' }, now), false); });
test('completed remote intent preserves unrelated edits but blocks changes to saved target values', async () => { const f = fixture(); await f.save(); f.getPage().properties['수동 메모'] = { rich_text: [{ text: { content: '보존' } }] }; await f.save(); assert.equal(f.getPage().properties['수동 메모'].rich_text[0].text.content, '보존'); f.getPage().properties['내용'] = { rich_text: [] }; await assert.rejects(f.save(), /NOTION_EDIT_CONFLICT/); assert.equal(f.calls.filter(c => c.path === 'pages').length, 1); });
