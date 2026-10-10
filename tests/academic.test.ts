import test from 'node:test';
import assert from 'node:assert/strict';
import { academicDTO } from '../api/_lib/academic.ts';
import { academicStudentId } from '../api/_lib/academicAuth.ts';
import { chartValue, scoreRows, inScorePeriod } from '../src/lib/academicChart.ts';
const studentId = '11111111-1111-4111-8111-111111111111';
const pageId = '22222222-2222-4222-8222-222222222222';
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

 test('historical academic records stay visible under both exam-type names', () => {
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

