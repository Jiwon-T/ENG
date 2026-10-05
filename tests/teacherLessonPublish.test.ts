import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.js';
import { publishTeacherDraft } from '../api/_lib/teacherNotionPublish.js';
import { DEFAULT_SOURCE } from '../api/_lib/teacherNotionWorkspace.js';
const id = '11111111-1111-4111-8111-111111111111', pageId = '22222222-2222-4222-8222-222222222222', student = '33333333-3333-4333-8333-333333333333', teacher = '44444444-4444-4444-8444-444444444444', studentDB = '55555555-5555-4555-8555-555555555555';
test('lesson publish supports configured math directly and reconciles lost creation without Make', async () => {
    const original = global.fetch, token = process.env.NOTION_INTEGRATION_TOKEN, oldDB = process.env.NOTION_STUDENT_DATABASE_ID;
    process.env.NOTION_INTEGRATION_TOKEN = 'test-notion-token';
    process.env.NOTION_STUDENT_DATABASE_ID = studentDB;
    const f = registrationFirestore(), record: any = { ownerUid: 'teacher', academyId: 'main', revision: 1, data: { studentKey: student, subject: '수학', date: '2026-10-05', classSession: '있음', start: '14:00', end: '15:00', round: 1, selfStudy: '없음', attendance: '출석', attitude: '상', homework: '상', test: '없는 날', correct: null, total: null, examCorrect: null, examTotal: null, content: '함수', assignment: '교재 10쪽', specialNote: '질문 적극적', note: '', nextPlan: '' } };
    f.rows.set('teacherLessonDrafts/' + id, record);
    f.rows.set('teacherWorkspaceAccess/teacher', { academyId: 'main', notionTeacherPageId: teacher, notionSources: [{ ...DEFAULT_SOURCE, subject: '수학' }] });
    const fields = ['앱 기록 ID', '과목', '구분', '출결', '수업', '학생', '수업 날짜', '수업 내용', '출석', '태도', '숙제', '테스트', '회차', '자습', '자습시간', '자습 회차', '앱 출결 메모', '특이사항', '범주', '전송 완료', '단어 테스트', '내신 대비 점수', '단어', '틀린 단어', '문항 수', '오답 수'];
    const schema: any = { properties: Object.fromEntries(fields.map(k => [k, k === '특이사항' ? { type: 'rich_text' } : {}])) };
    let page: any = null, attempts = 0, lost = true;
    global.fetch = async (url, init) => {
        const path = String(url).replace('https://api.notion.com/v1/', ''), method = init?.method || 'GET';
        assert.ok(String(url).startsWith('https://api.notion.com/v1/'));
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        if (path === `databases/${DEFAULT_SOURCE.lessonDatabaseId}`)
            return new Response(JSON.stringify(schema));
        if (path === `pages/${student}`)
            return new Response(JSON.stringify({ id: student, parent: { database_id: studentDB }, properties: { '학생': { type: 'title', title: [{ plain_text: '학생' }] } } }));
        if (path.endsWith('/query'))
            return new Response(JSON.stringify({ results: page ? [page] : [], has_more: false }));
        if (path === 'pages') {
            attempts++;
            page = { id: pageId, parent: { database_id: DEFAULT_SOURCE.lessonDatabaseId }, properties: body.properties, last_edited_time: '2026-10-05T01:00:00.000Z' };
            if (lost) {
                lost = false;
                throw Error('TIMEOUT');
            }
            return new Response(JSON.stringify(page));
        }
        if (path === `pages/${pageId}`)
            return new Response(JSON.stringify(page));
        throw Error('UNEXPECTED_CALL ' + path);
    };
    try {
        await assert.rejects(publishTeacherDraft(f.db as any, id, record), /TIMEOUT/);
        assert.equal(await publishTeacherDraft(f.db as any, id, record), pageId);
        assert.equal(attempts, 1);
        assert.equal(page.properties['과목'].select.name, '수학');
        assert.equal(page.properties['특이사항'].rich_text[0].text.content, '질문 적극적');
        assert.ok(page.properties['수업 내용'].rich_text[0].text.content.includes('함수'));
        assert.equal(f.rows.get('teacherLessonDrafts/' + id).notionWrite.done, true);
    }
    finally {
        global.fetch = original;
        if (token === undefined)
            delete process.env.NOTION_INTEGRATION_TOKEN;
        else
            process.env.NOTION_INTEGRATION_TOKEN = token;
        if (oldDB === undefined)
            delete process.env.NOTION_STUDENT_DATABASE_ID;
        else
            process.env.NOTION_STUDENT_DATABASE_ID = oldDB;
    }
});
