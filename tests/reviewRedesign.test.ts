import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonStatus, lessonStatusCounts, validLessonStatus, academicStats, withPreviousScores } from '../api/_lib/reviewSummary.js';
import { suggestedExamTitle, withSuggestedTitle, schoolTagOf, schoolTagFrom } from '../src/lib/academicExamPeriod.js';
import { readStudentSchool } from '../api/_lib/studentSchool.js';
import { directoryRowKey } from '../api/_lib/academyDirectorySource.js';
import { templateFirestore } from './helpers/templateFirestore.js';

test('lesson review status counts follow the badges and reject unknown filters', () => {
    assert.equal(lessonStatus('published'), 'done'); assert.equal(lessonStatus('report_published_notion_pending'), 'done');
    assert.equal(lessonStatus('draft'), 'saved'); assert.equal(lessonStatus('failed'), 'failed'); assert.equal(lessonStatus('processing'), 'processing');
    assert.deepEqual(lessonStatusCounts([{ stage: 'published' }, { stage: 'draft' }, { stage: 'draft' }, { stage: 'failed' }, { stage: 'x' }]), { all: 5, done: 1, saved: 2, failed: 1, processing: 1 });
    assert.equal(validLessonStatus('saved'), 'saved'); assert.equal(validLessonStatus('anything'), ''); assert.equal(validLessonStatus(null), '');
});

const row = (id: string, data: any, stage = 'published') => ({ id, stage, data: { studentKey: 's', subject: '영어', examType: '학교 내신', submissionStatus: '제출 완료', maxScore: 100, ...data } });
test('grade stats average on a 100-point scale and count missing and unreflected rows', () => {
    const stats = academicStats([row('a', { score: 80 }), row('b', { score: 45, maxScore: 50 }, 'draft'), row('c', { score: null, submissionStatus: '미제출' }), row('d', { score: null, submissionStatus: '제출 대상 아님' })]);
    assert.deepEqual(stats, { count: 4, average: 85, submitted: 2, missing: 1, pending: 1 });
    assert.equal(academicStats([]).average, null);
});

test('trend uses the latest earlier scored exam of the same student, subject and kind only', () => {
    const all = [
        row('now', { examDate: '2026-10-14', score: 88, title: '세교중2-2중간' }),
        row('prev', { examDate: '2026-07-01', score: 82, title: '세교중2-1기말' }),
        row('older', { examDate: '2026-04-28', score: 70, title: '세교중2-1중간' }),
        row('missing', { examDate: '2026-09-01', score: null, submissionStatus: '미제출' }),
        row('math', { examDate: '2026-09-02', score: 10, subject: '수학' }),
        row('mock', { examDate: '2026-09-03', score: 20, examType: '학력평가' }),
        row('other', { examDate: '2026-09-04', score: 30, studentKey: 't' }),
    ];
    const [now, older] = withPreviousScores([all[0], all[2]], all) as any[];
    assert.deepEqual(now.previous, { score: 82, maxScore: 100, title: '세교중2-1기말', examDate: '2026-07-01' });
    assert.equal(older.previous, undefined);
});

test('exam title follows the academy habit with a school tag and keeps a typed title', () => {
    const base = { examType: '학교 내신', examDetail: '2학기 중간고사', examYear: 2026, title: '' };
    assert.equal(suggestedExamTitle(base, '세교중2'), '세교중2-2중간');
    assert.equal(suggestedExamTitle({ ...base, examDetail: '1학기 기말고사' }, '세교중2'), '세교중2-1기말');
    assert.equal(suggestedExamTitle(base), '2026 2학기 중간고사');
    assert.equal(suggestedExamTitle({ examType: '학력평가', examDetail: '6월', examYear: 2026 }, '세교중2'), '2026 6월 학력평가');
    assert.equal(suggestedExamTitle({ ...base, examDetail: '' }, '세교중2'), '');
    const auto = withSuggestedTitle(base, { ...base, examDetail: '2학기 기말고사' }, '세교중2');
    assert.equal(auto.title, '세교중2-2기말');
    assert.equal(withSuggestedTitle(auto, auto, '세교중2', '세교고1').title, '세교고1-2기말');
    const typed = { ...auto, title: '세교중 특별 시험' };
    assert.equal(withSuggestedTitle(typed, { ...typed, examDetail: '1학기 중간고사' }, '세교중2').title, '세교중 특별 시험');
    assert.equal(schoolTagOf('세교중2-2중간'), '세교중2'); assert.equal(schoolTagOf('2026 1학기 중간고사'), '');
});

test('school tag comes from student management school and grade', () => {
    assert.equal(schoolTagFrom('세교중학교', '중2'), '세교중2');
    assert.equal(schoolTagFrom('세교고등학교', '고1'), '세교고1');
    assert.equal(schoolTagFrom('세교초등학교', '초6'), '세교초6');
    assert.equal(schoolTagFrom('세교중', '중3'), '세교중3');
    assert.equal(schoolTagFrom('', '중2'), '');
});

const S = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
test('student school read returns only school and grade, and only for assigned students', async () => {
    const f = templateFirestore();
    f.rows.set('academyCoreAuthority/main', { active: true });
    f.rows.set('academyDirectorySources/' + directoryRowKey('students', S), { kind: 'students', academyId: 'main', fields: { properties: { 학생: { title: [{ plain_text: '학생' }] }, 학교: { rich_text: [{ plain_text: '세교중학교' }] }, 학년: { select: { name: '중2' } }, 보호자연락처: { phone_number: '01012345678' } } } });
    const teacher = { uid: 't', academyId: 'main', admin: false, principal: false, scopes: [{ studentKey: S, subject: '영어' }], teachingScopes: [] };
    let notionCalls = 0; const notion = (async () => { notionCalls++; return {}; }) as any;
    assert.deepEqual(await readStudentSchool(f.db, teacher, S, notion), { school: '세교중학교', grade: '중2' });
    await assert.rejects(readStudentSchool(f.db, teacher, OTHER, notion), /FORBIDDEN/);
    await assert.rejects(readStudentSchool(f.db, teacher, 'not-a-uuid', notion));
    // After the student switch a missing directory row never falls back to Notion.
    assert.deepEqual(await readStudentSchool(f.db, { ...teacher, admin: true }, OTHER, notion), { school: '', grade: '' });
    assert.equal(notionCalls, 0);
});

import { handleWorkspace } from '../api/teacher/workspace.js';
import { teacherReadCache } from '../api/_lib/teacherReadCache.js';
async function get(db: any, actor: any, input: any) {
    let body: any; const res: any = { statusCode: 200, setHeader() {}, end(v: string) { body = JSON.parse(v); } };
    await handleWorkspace({ method: 'GET', url: '/api/teacher/workspace?' + new URLSearchParams(input), headers: {} } as any, res, async () => ({ ...actor, db }));
    return { status: res.statusCode, ...body };
}
test('review and grade lists return counts for every row while a status filter narrows only the page', async () => {
    const f = templateFirestore();
    f.rows.set('academyCoreAuthority/main', { active: true }); f.rows.set('academyClassAuthority/main', { active: true });
    f.rows.set('lessonAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'l', verificationHash: 'h' }); f.rows.set('lessonVerificationRuns/l', { verified: true, academyId: 'main', hash: 'h' });
    f.rows.set('academicAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'g', verificationHash: 'h' }); f.rows.set('academicVerificationRuns/g', { verified: true, hash: 'h' });
    f.rows.set('teacherWorkspaceAccess/t', { academyId: 'main', scopes: [{ studentKey: S, subject: '영어' }] });
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    for (const [id, stage] of [['l1', 'published'], ['l2', 'draft'], ['l3', 'draft'], ['l4', 'failed']]) f.rows.set('teacherLessonDrafts/' + id, { ownerUid: 't', academyId: 'main', stage, revision: 1, data: { date: day, studentKey: S, subject: '영어' } });
    const g = (id: string, data: any, stage = 'published') => f.rows.set('teacherAcademicDrafts/' + id, { ownerUid: 't', academyId: 'main', stage, revision: 1, data: { studentKey: S, subject: '영어', examType: '학교 내신', title: id, maxScore: 100, submissionStatus: '제출 완료', grade: '', note: '', deadline: null, examYear: 2026, examDetail: '', ...data } });
    g('세교중2-1기말', { examDate: '2026-07-01', score: 80 }); g('세교중2-2중간', { examDate: '2026-10-14', score: 90 }, 'draft'); g('세교중2-2기말', { examDate: '2026-12-10', score: null, submissionStatus: '미제출' });
    const teacher = { uid: 't', academyId: 'main', admin: false, principal: false, coreMode: true, scopes: [{ studentKey: S, subject: '영어' }], teachingScopes: [{ studentKey: S, subject: '영어' }] };
    teacherReadCache.clear();
    const all = await get(f.db, teacher, { action: 'academy-lessons', page: '1', period: '7' });
    assert.equal(all.status, 200, all.error); assert.deepEqual(all.statusCounts, { all: 4, done: 1, saved: 2, failed: 1, processing: 0 }); assert.equal(all.total, 4);
    const saved = await get(f.db, teacher, { action: 'academy-lessons', page: '1', period: '7', status: 'saved' });
    assert.equal(saved.total, 2); assert.equal(saved.statusCounts.all, 4);
    const grades = await get(f.db, teacher, { action: 'academic-records', page: '1', kind: '학교 내신' });
    assert.equal(grades.status, 200, grades.error); assert.deepEqual(grades.stats, { count: 3, average: 85, submitted: 2, missing: 1, pending: 1 });
    assert.equal(grades.records.find((r: any) => r.id === '세교중2-2중간').previous.score, 80);
    const missing = await get(f.db, teacher, { action: 'academic-records', page: '1', kind: '학교 내신', submission: '미제출' });
    assert.deepEqual(missing.records.map((r: any) => r.id), ['세교중2-2기말']); assert.equal(missing.stats.count, 3);
});

test('lesson review: teachers see only their own lessons; admins see everyone', async () => {
    const f = templateFirestore();
    f.rows.set('academyCoreAuthority/main', { active: true }); f.rows.set('academyClassAuthority/main', { active: true });
    f.rows.set('lessonAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'l', verificationHash: 'h' }); f.rows.set('lessonVerificationRuns/l', { verified: true, academyId: 'main', hash: 'h' });
    f.rows.set('teacherWorkspaceAccess/t', { academyId: 'main', scopes: [{ studentKey: S, subject: '영어' }] });
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    f.rows.set('teacherLessonDrafts/mine', { ownerUid: 't', academyId: 'main', stage: 'draft', revision: 1, data: { date: day, studentKey: S, subject: '영어' } });
    f.rows.set('teacherLessonDrafts/theirs', { ownerUid: 'other', academyId: 'main', stage: 'published', revision: 1, assignedUids: ['t'], data: { date: day, studentKey: S, subject: '영어' } });
    const teacher = { uid: 't', academyId: 'main', admin: false, principal: false, coreMode: true, scopes: [{ studentKey: S, subject: '영어' }], teachingScopes: [{ studentKey: S, subject: '영어' }] };
    teacherReadCache.clear();
    const mine = await get(f.db, teacher, { action: 'academy-lessons', page: '1', period: '7' });
    assert.equal(mine.status, 200, mine.error); assert.deepEqual(mine.records.map((r: any) => r.id), ['mine']);
    teacherReadCache.clear();
    const all = await get(f.db, { uid: 'admin', academyId: 'main', admin: true, principal: false, coreMode: true, scopes: [], teachingScopes: [] }, { action: 'academy-lessons', page: '1', period: '7' });
    assert.equal(all.total, 2);
});
