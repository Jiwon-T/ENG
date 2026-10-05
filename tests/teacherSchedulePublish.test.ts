import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.js';
import { publishTeacherSchedule } from '../api/_lib/teacherNotionPublish.js';
import { hashStudentKey } from '../api/_lib/security.js';
import { generateScheduleDocId } from '../api/_lib/scheduleProjection.js';
const id = '11111111-1111-4111-8111-111111111111', pageId = '22222222-2222-4222-8222-222222222222', one = '33333333-3333-4333-8333-333333333333', two = '44444444-4444-4444-8444-444444444444', teacher = '55555555-5555-4555-8555-555555555555', database = '3430f1a4-9dde-4b4c-a5cf-0d11b913b38c';
function fixture() {
    const f = registrationFirestore(), record: any = { ownerUid: 't', academyId: 'main', revision: 1, stage: 'publishing', data: { title: '보강', subject: '영어', students: [one, two], date: '2026-10-08', start: '14:50', end: '16:10', kind: '기타', status: '예정', place: '학원', note: '준비물' } };
    f.rows.set('teacherSchedules/' + id, record);
    f.rows.set('teacherWorkspaceAccess/t', { notionTeacherPageId: teacher });
    for (const [key, internal] of [[one, 'one'], [two, 'two']]) {
        f.rows.set('notionStudentMappings/' + hashStudentKey(key), { notionStudentPageId: key, studentKey: key, internalStudentId: internal });
        f.rows.set('academyStudentMemberships/' + key, { academyId: 'main', disabled: false });
    }
    let page: any = null, mode = '', count = 0;
    const calls: any[] = [];
    const schema = { properties: Object.fromEntries(['앱 기록 ID', '일정명', '과목', '대상 학생', '담당 선생님', '날짜 및 시간', '일정 종류', '일정 상태', '장소', '안내 내용', '요일', '반영 상태'].map(k => [k, {}])) };
    const fetcher = async (url: any, init?: any) => {
        const path = String(url).replace('https://api.notion.com/v1/', '');
        assert.ok(String(url).startsWith('https://api.notion.com/v1/'), 'Never invoke Make URLs');
        const method = init?.method || 'GET', body = init?.body ? JSON.parse(init.body) : null;
        calls.push({ path, method, body });
        if (path === `databases/${database}`)
            return new Response(JSON.stringify(schema));
        if (path.endsWith('/query'))
            return new Response(JSON.stringify({ results: page ? [page] : [], has_more: false }));
        if (path === 'pages' && method === 'POST') {
            page = { id: pageId, parent: { database_id: database }, last_edited_time: '2026-10-05T01:00:00.000Z', properties: body.properties };
            if (mode === 'lost') {
                mode = '';
                throw Error('TIMEOUT');
            }
            return new Response(JSON.stringify(page));
        }
        if (path === `pages/${pageId}`) {
            if (method === 'PATCH') {
                Object.assign(page.properties, body.properties);
                page.last_edited_time = `2026-10-05T02:00:${String(++count).padStart(2, '0')}.000Z`;
            }
            if (method === 'GET' && mode === 'projection-failure' && f.rows.get('teacherSchedules/' + id).notionWrite?.done) {
                mode = '';
                f.failNextCommit();
            }
            return new Response(JSON.stringify(page));
        }
        throw Error('UNEXPECTED_CALL');
    };
    return { ...f, record, calls, fetcher, fail: (s: string) => { mode = s; }, at: (internal: string) => f.rows.get('studentSchedules/' + generateScheduleDocId(pageId, internal)) };
}
async function withFixture(run: (f: ReturnType<typeof fixture>) => Promise<void>) { const original = global.fetch, token = process.env.NOTION_INTEGRATION_TOKEN; process.env.NOTION_INTEGRATION_TOKEN = 'test-notion-token'; const f = fixture(); global.fetch = f.fetcher; try {
    await run(f);
}
finally {
    global.fetch = original;
    if (token === undefined)
        delete process.env.NOTION_INTEGRATION_TOKEN;
    else
        process.env.NOTION_INTEGRATION_TOKEN = token;
} }
test('full schedule publish works without Make formula and supports recipient removal and deletion', async () => withFixture(async (f) => {
    await publishTeacherSchedule(f.db as any, id, f.record);
    assert.equal(f.at('one').status, '예정');
    assert.equal(f.at('two').scheduleType, '기타');
    assert.equal(f.rows.get('teacherSchedules/' + id).stage, 'published');
    const next = { ...f.rows.get('teacherSchedules/' + id), revision: 2, data: { ...f.record.data, students: [one] } };
    f.rows.set('teacherSchedules/' + id, next);
    await publishTeacherSchedule(f.db as any, id, next);
    assert.equal(f.at('one').status, '예정');
    assert.equal(f.at('two').status, '취소');
    const deleted = { ...f.rows.get('teacherSchedules/' + id), revision: 3, deleteRequested: true, data: { ...next.data, status: '취소' } };
    f.rows.set('teacherSchedules/' + id, deleted);
    await publishTeacherSchedule(f.db as any, id, deleted);
    assert.equal(f.at('one').status, '취소');
    assert.equal(f.rows.get('teacherSchedules/' + id).archived, true);
    assert.equal(f.calls.filter(c => c.path === 'pages').length, 1);
}));
test('full schedule retry after lost creation response never creates a duplicate source', async () => withFixture(async (f) => { f.fail('lost'); await assert.rejects(publishTeacherSchedule(f.db as any, id, f.record), /TIMEOUT/); await publishTeacherSchedule(f.db as any, id, f.record); assert.equal(f.calls.filter(c => c.path === 'pages').length, 1); assert.equal(f.at('two').status, '예정'); }));
test('full schedule projection failure preserves source for retry and keeps every student unchanged', async () => withFixture(async (f) => { f.fail('projection-failure'); await assert.rejects(publishTeacherSchedule(f.db as any, id, f.record), /FIRESTORE_UNAVAILABLE/); assert.equal(f.at('one'), undefined); assert.equal(f.at('two'), undefined); await publishTeacherSchedule(f.db as any, id, f.record); assert.equal(f.calls.filter(c => c.path === 'pages').length, 1); assert.equal(f.at('one').status, '예정'); assert.equal(f.rows.get('teacherSchedules/' + id).stage, 'published'); }));
