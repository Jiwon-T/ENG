import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.js';
import { readStudentEnrollment, saveStudentEnrollment, discardStudentEnrollment, enrollmentEditSchema } from '../api/_lib/teacherStudentEnrollment.js';
import { REGISTRATION_STUDENT_DATABASE as S, REGISTRATION_ENROLLMENT_DATABASE as E } from '../api/_lib/teacherStudentRegistrationNotion.js';
import { REGISTRATION_CLASS_DATABASE as C, REGISTRATION_TEACHER_DATABASE as T } from '../api/_lib/teacherRegistrationAssignments.js';
import { hashStudentKey } from '../api/_lib/security.js';
import { registrationSubjects } from '../src/lib/studentRegistration.js';
import { syncAcademicPage } from '../api/_lib/academic.js';
const key = '11111111-1111-4111-8111-111111111111', eid = '22222222-2222-4222-8222-222222222222', op = '33333333-3333-4333-8333-333333333333';
const t1 = '44444444-4444-4444-8444-444444444444', t2 = '55555555-5555-4555-8555-555555555555', c1 = '66666666-6666-4666-8666-666666666666', c2 = '77777777-7777-4777-8777-777777777777', cm = '88888888-8888-4888-8888-888888888888';
const actor = { uid: 'principal', admin: false, principal: true, academyId: 'main' }, stamp = '2026-10-05T01:00:00.000Z';
const rich = (s: string) => ({ rich_text: [{ text: { content: s } }] }), rel = (ids: string[]) => ({ relation: ids.map(id => ({ id })) });
function fixture() {
    process.env.NOTION_STUDENT_DATABASE_ID = S;
    const f = registrationFirestore();
    f.rows.set('academyStudentMemberships/' + key, { academyId: 'main', disabled: false });
    f.rows.set('notionStudentMappings/' + hashStudentKey(key), { studentKey: key, notionStudentPageId: key, internalStudentId: 'stable', firebaseUid: 'existing-user', studentDisplayName: '학생' });
    f.rows.set('reportSlugs/existing', { internalStudentId: 'stable', active: true, authVersion: 4, parentPhonePinHash: 'unchanged' });
    f.rows.set('teacherWorkspaceAccess/new-teacher', { academyId: 'main', notionTeacherPageId: t2 });
    f.rows.set('users/new-teacher', { role: 'teacher' });
    const page = (id: string, database: string, properties: any) => ({ id, parent: { database_id: database }, last_edited_time: stamp, properties });
    const student = page(key, S, { '학생': { title: [{ text: { content: '학생' } }] }, '소속반': rel([c1, cm]), '등록상태': { status: { name: '등록' } }, '강의명': { multi_select: [{ name: '영어' }, { name: '수학' }] }, '수강시작일': { date: { start: '2026-01-01' } }, '보호자연락처': { phone_number: '01000000000' } });
    const p: any = { '수강 내역': { title: [{ text: { content: '기존 수강' } }] }, '학생': rel([key]), '앱 등록 ID': rich('original') };
    for (const s of registrationSubjects) {
        p[s] = { status: s === '영어' || s === '수학' ? { name: '등록' } : null };
        p[s + ' 시작일'] = { date: s === '영어' || s === '수학' ? { start: '2026-01-01' } : null };
        p[s + ' 중단일'] = { date: null };
        p[s + ' 담당'] = rel(s === '영어' ? [t1, t2] : s === '수학' ? [t1] : []);
    }
    const enrollment = page(eid, E, p);
    const cp = (id: string, subject: string) => page(id, C, { '수업명': { title: [{ text: { content: id } }] }, '과목': { select: { name: subject } }, '학원': rich('main'), '상태': { status: { name: '진행 중' } }, '담당 선생님': rel([t1, t2]), '대상 학생': rel([key, '99999999-9999-4999-8999-999999999999']) });
    const tp = (id: string) => page(id, T, { '선생님': { title: [{ text: { content: '선생님' } }] }, '상태': { select: { name: '재직' } }, '담당 과목': { multi_select: [{ name: '영어' }] } });
    const pages: any = { [key]: student, [eid]: enrollment, [c1]: cp(c1, '영어'), [c2]: cp(c2, '영어'), [cm]: cp(cm, '수학'), [t1]: tp(t1), [t2]: tp(t2) };
    const ss: any = { properties: { '소속반': { id: 'forward', type: 'relation', relation: { database_id: C, type: 'dual_property', dual_property: { synced_property_id: 'reverse' } } }, '등록상태': { type: 'status' }, '강의명': { type: 'multi_select' }, '수강시작일': { type: 'date' } } };
    const es: any = { properties: {} };
    for (const s of registrationSubjects) {
        for (const [k, type] of [[s, 'status'], [s + ' 시작일', 'date'], [s + ' 중단일', 'date'], [s + ' 담당', 'relation']])
            es.properties[k] = { type, ...(type === 'relation' ? { relation: { database_id: T } } : {}) };
    }
    const cs = { properties: { '대상 학생': { id: 'reverse', type: 'relation', relation: { database_id: S, type: 'dual_property', dual_property: { synced_property_id: 'forward' } } } } };
    const calls: any[] = [];
    let failure = '', count = 0, duplicates = false, syncFails = false;
    const notion = async (path: string, method = 'GET', body?: any) => {
        calls.push({ path, method, body });
        if (path === `databases/${E}/query`)
            return { results: duplicates ? [enrollment, enrollment] : [enrollment], has_more: false };
        if (path === `databases/${S}`)
            return ss;
        if (path === `databases/${E}`)
            return es;
        if (path === `databases/${C}`)
            return cs;
        const page = pages[path.replace('pages/', '')];
        if (!page)
            throw Error('UNEXPECTED_CALL');
        if (method === 'PATCH') {
            const mode = failure;
            if (mode === 'student-400' && page.id === key) {
                failure = '';
                throw Error('NOTION_400');
            }
            if (mode === 'no-commit') {
                failure = '';
                throw Error('TIMEOUT');
            }
            Object.assign(page.properties, structuredClone(body.properties));
            page.last_edited_time = `2026-10-05T02:00:${String(++count).padStart(2, '0')}.000Z`;
            if (mode === 'commit-timeout') {
                failure = '';
                throw Error('TIMEOUT');
            }
        }
        return structuredClone(page);
    };
    const sync: any = async (...args: any[]) => { if (syncFails) {
        syncFails = false;
        throw Error('FIRESTORE_UNAVAILABLE');
    } return syncAcademicPage(args[0], args[1], args[2], args[3]); };
    const input = () => ({ subject: '영어' as const, status: '등록' as const, startDate: '2026-01-06', endDate: null, addTeacherUid: null, removeTeacherIds: [], classIds: [c2] });
    const request = (data: any = input()) => ({ operationId: op, studentEditedAt: stamp, enrollmentEditedAt: stamp, data });
    const save = (data: any = input()) => saveStudentEnrollment(f.db, actor, key, request(data), notion, sync);
    return { ...f, student, enrollment, pages, ss, es, cs, notion, calls, input, request, save, patches: () => calls.filter(c => c.method === 'PATCH'), fail: (v: string) => { failure = v; }, duplicate: () => { duplicates = true; }, syncFail: () => { syncFails = true; } };
}
test('enrollment read exposes per subject shared teachers and class selections', async () => { const f = fixture(), r = await readStudentEnrollment(f.db, actor, key, f.notion); assert.equal(r.enrollmentId, eid); assert.equal(r.subjects[0].teachers.length, 2); assert.deepEqual(r.subjects[0].classes.map(c => c.id), [c1]); assert.equal(r.pending, null); });
test('one subject update preserves shared teachers, other subjects, report identity and shared class rosters', async () => { const f = fixture(), roster = structuredClone(f.pages[c2].properties['대상 학생']); await f.save(); assert.deepEqual(f.enrollment.properties['영어 담당'], rel([t1, t2])); assert.equal(f.enrollment.properties['수학 시작일'].date.start, '2026-01-01'); assert.deepEqual(f.student.properties['소속반'], rel([cm, c2])); assert.deepEqual(f.pages[c2].properties['대상 학생'], roster); assert.equal(f.enrollment.properties['앱 등록 ID'].rich_text[0].text.content, 'original'); assert.equal(f.rows.get('reportSlugs/existing').authVersion, 4); assert.equal(f.rows.get('notionStudentMappings/' + hashStudentKey(key)).firebaseUid, 'existing-user'); assert.ok(f.rows.get('studentEnrollments/' + eid)); assert.equal(f.patches().length, 2); await f.save(); assert.equal(f.patches().length, 2); });
test('explicit teacher removal and addition preserves unselected co-teachers and deduplicates IDs', async () => { const f = fixture(); await f.save({ ...f.input(), removeTeacherIds: [t1], addTeacherUid: 'new-teacher' }); assert.deepEqual(f.enrollment.properties['영어 담당'], rel([t2])); });
test('stopping one subject removes only its classes and keeps the remaining subject active', async () => { const f = fixture(); await f.save({ ...f.input(), status: '중단', endDate: '2026-10-05', classIds: [] }); assert.deepEqual(f.student.properties['소속반'], rel([cm])); assert.equal(f.student.properties['등록상태'].status.name, '등록'); assert.deepEqual(f.student.properties['강의명'].multi_select, [{ name: '수학' }]); assert.equal(f.enrollment.properties['영어 중단일'].date.start, '2026-10-05'); });
test('committed response loss recovers without replaying the enrollment patch', async () => { const f = fixture(); f.fail('commit-timeout'); await assert.rejects(f.save(), /TIMEOUT/); const r = await readStudentEnrollment(f.db, actor, key, f.notion); assert.equal(r.pending?.status, 'uncertain'); assert.equal(r.pending?.canDiscard, false); await f.save(); assert.equal(f.patches().length, 2); assert.equal((await readStudentEnrollment(f.db, actor, key, f.notion)).pending, null); });
test('partial student rejection retries only the student stage', async () => { const f = fixture(); f.fail('student-400'); await assert.rejects(f.save(), /NOTION_400/); assert.equal((await readStudentEnrollment(f.db, actor, key, f.notion)).pending?.canDiscard, false); await f.save(); assert.equal(f.patches().filter(c => c.path === `pages/${eid}`).length, 1); assert.equal(f.patches().filter(c => c.path === `pages/${key}`).length, 2); });
test('app reflection failure recovers from current Notion values without remote patches', async () => { const f = fixture(); f.syncFail(); await assert.rejects(f.save(), /FIRESTORE_UNAVAILABLE/); await f.save(); assert.equal(f.patches().length, 2); });
test('unknown commit cannot be overwritten, cancelled or retried blindly', async () => { const f = fixture(); f.fail('no-commit'); await assert.rejects(f.save(), /TIMEOUT/); await assert.rejects(f.save(), /STUDENT_ENROLLMENT_RESULT_UNCERTAIN/); await assert.rejects(discardStudentEnrollment(f.db, actor, key, op), /STUDENT_ENROLLMENT_IN_PROGRESS/); await assert.rejects(f.save({ ...f.input(), startDate: '2026-01-07' }), /STUDENT_ENROLLMENT_REQUEST_CONFLICT/); assert.equal(f.patches().length, 1); });
test('duplicate source, foreign membership and ordinary teacher are rejected before patches', async () => { const f = fixture(); f.duplicate(); await assert.rejects(f.save(), /NOTION_DUPLICATE_ENROLLMENT/); assert.equal(f.patches().length, 0); const g = fixture(); g.rows.set('academyStudentMemberships/' + key, { academyId: 'other' }); await assert.rejects(g.save(), /FORBIDDEN/); await assert.rejects(readStudentEnrollment(g.db, { ...actor, principal: false }, key, g.notion), /FORBIDDEN/); });
test('stale source revisions and truncated relation lists fail safely', async () => { const f = fixture(); f.student.last_edited_time = '2026-10-05T02:00:00.000Z'; await assert.rejects(f.save(), /NOTION_EDIT_CONFLICT/); const g = fixture(); g.student.properties['소속반'].has_more = true; await assert.rejects(g.save(), /NOTION_REGISTRATION_SCHEMA_REQUIRED/); assert.equal(g.patches().length, 0); });
test('non-reciprocal class schemas, wrong subject classes and foreign teacher selections cannot mutate rosters', async () => { const f = fixture(); f.ss.properties['소속반'].relation.type = 'single_property'; await assert.rejects(f.save(), /NOTION_REGISTRATION_SCHEMA_REQUIRED/); const g = fixture(); await assert.rejects(g.save({ ...g.input(), classIds: [cm] }), /NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/); await assert.rejects(g.save({ ...g.input(), addTeacherUid: 'foreign-user' }), /NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/); await assert.rejects(g.save({ ...g.input(), removeTeacherIds: [key] }), /INVALID_INPUT/); assert.equal(g.patches().length, 0); });
test('date, state and duplicate validation rejects invalid enrollment input', () => { const f = fixture(); for (const patch of [{ startDate: '2026-02-30' }, { status: '중단' }, { status: '대기', endDate: '2026-10-05' }, { status: '중단', endDate: '2025-01-01', classIds: [] }, { classIds: [c2, c2] }])
    assert.equal(enrollmentEditSchema.safeParse({ ...f.input(), ...patch }).success, false); });
test('newer enrollment edits during a partial failure cannot be overwritten by a stale student summary', async () => { const f = fixture(); f.fail('student-400'); await assert.rejects(f.save(), /NOTION_400/); f.enrollment.properties['수학'].status.name = '중단'; f.enrollment.last_edited_time = '2026-10-05T03:00:00.000Z'; await assert.rejects(f.save(), /NOTION_EDIT_CONFLICT/); assert.equal(f.patches().length, 2); assert.equal(f.student.properties['강의명'].multi_select.length, 2); });
test('teacher retirement and class interruption after a partial failure block new relation patches', async () => { const f = fixture(); f.fail('student-400'); await assert.rejects(f.save({ ...f.input(), addTeacherUid: 'new-teacher' }), /NOTION_400/); f.pages[t2].properties['상태'].select.name = '휴직'; await assert.rejects(f.save({ ...f.input(), addTeacherUid: 'new-teacher' }), /NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/); const g = fixture(); g.fail('student-400'); await assert.rejects(g.save(), /NOTION_400/); g.pages[c2].properties['상태'].status.name = '중단'; await assert.rejects(g.save(), /NOTION_REGISTRATION_ASSIGNMENT_REQUIRED/); });
test('existing teacher access follows changed Notion assignments without retaining stale scopes', async () => {
    const f = fixture(), original = globalThis.fetch;
    process.env.NOTION_INTEGRATION_TOKEN = 'test-token';
    const { notionTeachingScopes } = await import('../api/_lib/teacherNotionWorkspace.js');
    globalThis.fetch = async (url: any) => { const path = String(url).replace('https://api.notion.com/v1/', ''); if (path === `pages/${t1}`)
        return new Response(JSON.stringify(f.pages[t1]), { status: 200 }); if (path === `databases/${E}/query`)
        return new Response(JSON.stringify({ results: [f.enrollment], has_more: false }), { status: 200 }); throw Error('UNEXPECTED_PERMISSION_CALL'); };
    try {
        const profile = { notionTeacherPageId: t1, academyId: 'main', scopes: [{ studentKey: key, subject: '영어' }] };
        const before = await notionTeachingScopes(f.db, profile);
        assert.ok(before.some(s => s.subject === '영어'));
        await f.save({ ...f.input(), removeTeacherIds: [t1] });
        const after = await notionTeachingScopes(f.db, profile);
        assert.equal(after.some(s => s.subject === '영어'), false);
        assert.ok(after.some(s => s.subject === '수학'));
    }
    finally {
        globalThis.fetch = original;
    }
});
test('workspace enrollment actions reject forged fields and ordinary teachers before contacting Notion', async () => {
    const f = fixture(), original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error('NO_REMOTE_EXPECTED'); };
    const { handleWorkspace } = await import('../api/teacher/workspace.js');
    async function call(method: string, values: any, who: any = actor) { let body: any; const res: any = { setHeader: () => { }, end: (v: string) => { body = JSON.parse(v); } }; const req: any = method === 'POST' ? { method, body: values } : { method, url: '/api/teacher/workspace?' + new URLSearchParams(values) }; await handleWorkspace(req, res, async () => ({ ...who, db: f.db, scopes: [], teachingScopes: [] }) as any); return { status: res.statusCode, body }; }
    try {
        assert.equal((await call('GET', { action: 'student-enrollment', studentKey: key }, { ...actor, principal: false })).status, 403);
        assert.equal((await call('POST', { action: 'save-student-enrollment', studentKey: key, ...f.request() }, { ...actor, principal: false })).status, 403);
        assert.equal((await call('POST', { action: 'save-student-enrollment', studentKey: key, ...f.request(), academyId: 'foreign' })).status, 400);
        assert.equal((await call('POST', { action: 'discard-student-enrollment', studentKey: key, operationId: 'invalid' })).status, 400);
        assert.equal(calls, 0);
    }
    finally {
        globalThis.fetch = original;
    }
});
