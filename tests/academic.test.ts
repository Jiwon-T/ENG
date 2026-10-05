import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAcademicPage, academicDTO, syncAcademicPage, GRADE_DATABASE, ENROLLMENT_DATABASE } from '../api/_lib/academic.ts';
import { academicStudentId } from '../api/_lib/academicAuth.ts';
import webhook from '../api/webhooks/notion-academic.ts';
import { chartValue, scoreRows, inScorePeriod } from '../src/lib/academicChart.ts';
const studentId = '11111111-1111-4111-8111-111111111111';
const pageId = '22222222-2222-4222-8222-222222222222';
function page(overrides = {}) { return { id: pageId, parent: { database_id: GRADE_DATABASE }, last_edited_time: '2026-10-02T00:00:00Z', properties: {
  학생: { relation: [{ id: studentId }] }, 과목: { select: { name: '영어' } }, '시험 종류': { select: { name: '학교 내신' } },
  시험명: { title: [{ plain_text: '중간' }] }, 원점수: { number: 0 }, 만점: { number: 100 }, 백분위: { type: 'formula', formula: { number: 0 } },
  시험일: { date: { start: '2026-04-23' } }, '제출 기한': { date: { start: '2026-05-12' } }, '제출 상태': { select: { name: '제출 완료' } },
}, ...overrides }; }
test('school scores preserve actual zero, exam date and missing date; ignore formula percentile', () => {
  const data = parseAcademicPage(page()).data as any;
  assert.equal(data.score, 0); assert.equal(data.examDate, '2026-04-23'); assert.equal(data.percentile, null);
  const missing = page(); delete missing.properties.시험일;
  assert.equal((parseAcademicPage(missing).data as any).examDate, null);
});
test('reject unrelated source, multiple students and scores beyond maximum', () => {
  assert.throws(() => parseAcademicPage(page({ parent: { database_id: studentId } })), /SOURCE_NOT_ALLOWED/);
  const multiple = page(); multiple.properties.학생.relation.push({ id: pageId });
  assert.throws(() => parseAcademicPage(multiple), /EXACTLY_ONE_STUDENT/);
  const bad = page(); bad.properties.원점수.number = 101;
  assert.throws(() => parseAcademicPage(bad), /INVALID_SCORE/);
});
test('student DTO excludes source IDs, deadlines and internal metadata', () => {
  const r = parseAcademicPage(page()).data;
  const dto = academicDTO(pageId, { ...r, internalStudentId: 'secret', feedback: 'private' });
  const json = JSON.stringify(dto);
  for (const secret of ['internalStudentId', 'feedback', 'deadline', pageId, studentId]) assert.ok(!json.includes(secret));
});
test('enrollment retains stopped English and current math in same source row', () => {
  const r = parseAcademicPage(page({ parent: { database_id: ENROLLMENT_DATABASE }, properties: {
    학생: { relation: [{ id: studentId }] }, 영어: { status: { name: '중단' } }, 수학: { status: { name: '등록' } },
  } }));
  assert.deepEqual((r.data as any).subjects.map(s => [s.subject, s.status]), [['영어', '중단'], ['수학', '등록']]);
});
test('upsert replaces same source, handles reassignment and prevents stale overwrites', async () => {
  const saved = new Map<string, any>();
  const fake: any = { collection: (name: string) => ({ doc: (id: string) => ({ key: `${name}/${id}` }) }),
    runTransaction: async (fn: any) => fn({ get: async (ref: any) => ({ exists: saved.has(ref.key), data: () => saved.get(ref.key) }), set: (ref: any, data: any) => saved.set(ref.key, data), update: (ref: any, data: any) => saved.set(ref.key, { ...saved.get(ref.key), ...data }) }) };
  let student = 'internal-A';
  const lookup: any = async () => ({ notionStudentPageId: studentId, studentDisplayName: '학생' });
  const map: any = async () => ({ internalStudentId: student });
  await syncAcademicPage(fake, page(), lookup, map); student = 'internal-B';
  const updated = page({ last_edited_time: '2026-10-02T01:00:00Z' }); updated.properties.원점수.number = 75;
  await syncAcademicPage(fake, updated, lookup, map);
  assert.equal(saved.size, 1); assert.equal([...saved.values()][0].score, 75); assert.equal([...saved.values()][0].internalStudentId, 'internal-B');
  const result = await syncAcademicPage(fake, page(), lookup, map); assert.equal(result.applied, false); assert.equal([...saved.values()][0].score, 75);
  await syncAcademicPage(fake, page({ archived: true, last_edited_time: '2026-10-02T02:00:00Z' }), lookup, map);
  assert.equal([...saved.values()][0].removed, true);
});
test('chart separates missing, unsubmitted and real zero, keeps academy rows apart', () => {
  const data: any = { subjects: [], records: [academicDTO(pageId, parseAcademicPage(page()).data)], academyScores: [{ recordId: 'a', subject: '영어', examDate: '2026-09-27', vocabularyScore: 0, schoolExamScore: null }] };
  const rows = scoreRows(data, '학교 내신'); assert.equal(chartValue(rows[0], 'score'), 0);
  assert.equal(chartValue({ ...rows[0], status: '미제출' }, 'score'), null);
  assert.equal(chartValue({ ...rows[0], date: null }, 'score'), null);
  assert.equal(scoreRows(data, '학원 단어')[0].score, 0); assert.equal(scoreRows(data, '학원 내신 대비').length, 0);
});
test('parent auth rejects another slug and missing session', async () => {
  const deps: any = { getVerifiedParentSession: async () => ({ reportSlug: 'alice', internalStudentId: 'A' }) };
  await assert.rejects(() => academicStudentId({ url: '/?reportSlug=bob', headers: { 'x-parent-session': 'token' } } as any, 'parent', deps), /FORBIDDEN/);
  await assert.rejects(() => academicStudentId({ headers: {} } as any, 'parent', deps), /UNAUTHORIZED/);
  assert.equal(await academicStudentId({ url: '/?reportSlug=alice', headers: { 'x-parent-session': 'token' } } as any, 'parent', deps), 'A');
});
test('student auth requires verified account ownership; cannot claim a mapping', async () => {
  const fakeDb = { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ notionStudentKey: 'key' }) }) }) }) };
  const deps: any = {
    getFirebaseAdmin: () => ({ auth: { verifyIdToken: async () => ({ uid: 'user-A' }) }, db: fakeDb }),
    readStudentMapping: async () => ({ firebaseUid: 'user-B', internalStudentId: 'B' }),
  };
  await assert.rejects(() => academicStudentId({ headers: { authorization: 'Bearer token' } } as any, 'student', deps), /FORBIDDEN/);
  deps.readStudentMapping = async () => ({ firebaseUid: 'user-A', internalStudentId: 'A' });
  assert.equal(await academicStudentId({ headers: { authorization: 'Bearer token' } } as any, 'student', deps), 'A');
});
test('academic webhook refuses unauthenticated calls and invalid page IDs before any writes', async () => {
  process.env.MAKE_NOTION_WEBHOOK_SECRET = 'x'.repeat(32);
  const res = () => ({ statusCode: 0, setHeader() {}, end(body: string) { this.body = JSON.parse(body); }, body: null as any });
  let output = res(); await webhook({ method: 'POST', headers: {}, body: { pageId } } as any, output as any); assert.equal(output.statusCode, 401);
  output = res(); await webhook({ method: 'POST', headers: { 'x-webhook-secret': 'x'.repeat(32) }, body: { pageId: '../other' } } as any, output as any); assert.equal(output.statusCode, 400);
});

import { academyPayload, missingScorePatch, LESSON_DATABASE } from '../api/_lib/academyBackfill.ts';
test('academy reconciliation preserves zero and only fills missing score fields', () => {
  assert.deepEqual(missingScorePatch({ vocabularyScore: null, schoolExamScore: 75 }, { vocabularyScore: 0, schoolExamScore: 90 }), { vocabularyScore: 0 });
  assert.deepEqual(missingScorePatch({ vocabularyScore: 0 }, { vocabularyScore: 80, schoolExamScore: null }), {});
});
test('academy backfill accepts sent rows only; extracts scores without replaying Make/SMS', () => {
  const source: any = page({ parent: { database_id: LESSON_DATABASE } });
  source.properties['전송 완료'] = { select: { name: '완료' } };
  source.properties['수업 날짜'] = { date: { start: '2026-09-27' } };
  source.properties['단어 테스트'] = { type: 'formula', formula: { number: 0 } };
  const payload = academyPayload(source)!;
  assert.equal(payload.vocabularyScore, 0); assert.equal(payload.schoolExamScore, null);
  source.properties['전송 완료'].select.name = '미완'; assert.equal(academyPayload(source), null);
});
import { loadAcademicData } from '../api/_lib/academic.ts';
test('previous ZIP data remains visible and same-source legacy scores are deduplicated', async () => {
  const snapshot = (data: any[]) => ({ docs: data.map(r => ({ id: r.id, data: () => r })) });
  const records: any = {
    academicRecords: snapshot([{ id: pageId, internalStudentId: 'A', score: 80, subject: '영어', examType: '학교 내신', examDate: '2026-04-23', submissionStatus: '제출 완료' }]),
    examResults: snapshot([{ id: pageId, sourceId: pageId, score: 70, kind: '학교 내신', subject: '영어', status: '제출 완료' }, { id: studentId, sourceId: studentId, score: 65, kind: '학교 내신', subject: '영어', status: '제출 완료' }]),
    studentEnrollments: snapshot([]), lessonReports: snapshot([]),
  };
  const db: any = { collection: (name: string) => { const q = { where: () => q, select: () => q, get: async () => records[name], doc: () => ({ get: async () => ({ exists: true, data: () => ({ subjects: { 영어: { status: '중단', startDate: null, endDate: null } } }) }) }) }; return q; } };
  const data = await loadAcademicData(db, 'A');
  assert.equal(data.records.length, 2); assert.ok(data.records.some(r => r.score === 80)); assert.ok(!data.records.some(r => r.score === 70));
  assert.equal(data.subjects[0].status, '중단');
});
test('source reassignment archives previous-ZIP copy in same transaction', async () => {
  const docs = new Map<string, any>([[`examResults/${pageId}`, { sourceUpdatedAt: '2026-10-01T00:00:00Z', internalStudentId: 'old-student' }]]);
  const db: any = { collection: (name: string) => ({ doc: (id: string) => ({ key: `${name}/${id}` }) }), runTransaction: async (fn: any) => fn({
    get: async (r: any) => ({ exists: docs.has(r.key), data: () => docs.get(r.key) }),
    set: (r: any, d: any) => docs.set(r.key, d), update: (r: any, d: any) => docs.set(r.key, { ...docs.get(r.key), ...d }),
  }) };
  await syncAcademicPage(db, page(), async () => ({ notionStudentPageId: studentId, studentDisplayName: '학생' }) as any, async () => ({ internalStudentId: 'new-student' }) as any);
  assert.equal(docs.get(`examResults/${pageId}`).archived, true);
  assert.equal(docs.get(`academicRecords/${pageId}`).internalStudentId, 'new-student');
});

 test('academic assessment accepts both Notion names and keeps historical records visible', () => {
  for (const name of ['모의고사', '학력평가']) {
    const source = page();
    source.properties['시험 종류'] = { select: { name } };
    assert.equal(parseAcademicPage(source).data.examType, '모의고사');
  }
  const data: any = { records: [
    { recordId: 'old', examType: '모의고사' },
    { recordId: 'new', examType: '학력평가' },
    { recordId: 'school', examType: '학교 내신' },
  ], academyScores: [] };
  assert.deepEqual(scoreRows(data, '모의고사').map(r => r.id), ['old', 'new']);
 });

test('score period uses Korean calendar dates, clamps month ends and retains undated rows in all', () => {
  const now = new Date('2026-10-31T15:30:00Z'); // November 1 in Korea
  assert.equal(inScorePeriod('2026-08-01', '3', now), true);
  assert.equal(inScorePeriod('2026-07-31', '3', now), false);
  assert.equal(inScorePeriod('2026-11-02', '3', now), false);
  assert.equal(inScorePeriod(null, 'all', now), true);
  assert.equal(inScorePeriod(null, '6', now), false);
  assert.equal(inScorePeriod('2026-02-28', '3', new Date('2026-05-31T00:00:00Z')), true);
});

test('detail type survives the Notion projection and public DTO',()=>{
 const source=page();(source.properties as any)['세부 종류']={select:{name:'1학기 중간고사'}};
 const value=parseAcademicPage(source).data as any;const dto=academicDTO(pageId,value);
 assert.equal(value.examDetail,'1학기 중간고사');assert.equal(dto.examDetail,value.examDetail);assert.equal(dto.semester,1);assert.equal(dto.examPeriod,'중간고사');
});
