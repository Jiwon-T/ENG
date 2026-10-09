import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/_lib/student/assignment-completion.ts';
test('student assignment completion requires authentication before accessing reports or writing completion state', async () => {
  let body = '';
  const res = { statusCode: 0, setHeader() {}, end(value: string) { body = value; } };
  await handler({ method: 'PATCH', headers: {}, body: { reportId: 'someone-elses-report' } } as any, res as any);
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(body).error, 'UNAUTHORIZED');
});
import crypto from 'node:crypto';
import { findAssignmentTarget } from '../api/_lib/student/assignment-completion.ts';
import { studentLessonDTO } from '../api/_lib/reportAudienceDTO.ts';
test('completion resolves the same reportId the student screen received, including app-native and direct reports', () => {
  const base = { internalStudentId: 'i', studentKey: 's', lessonDateStart: '2026-10-09T14:00:00+09:00', category: '수업', derivedAssignment: '복습' } as any;
  const notionOnly = { ...base, notionPageId: '00000000-0000-4000-8000-000000000001' };
  const appNative = { ...base, notionPageId: null, reportIdentity: '11111111-1111-4111-8111-111111111111' };
  const direct = { ...base, notionPageId: '00000000-0000-4000-8000-000000000002', reportIdentity: '22222222-2222-4222-8222-222222222222' };
  const reports = [notionOnly, appNative, direct];
  for (const report of reports) assert.equal(findAssignmentTarget(reports, studentLessonDTO(report, new Map()).reportId), report);
  // Completions saved before this change (Notion reports without reportIdentity) keep their IDs.
  assert.equal(studentLessonDTO(notionOnly, new Map()).reportId, crypto.createHash('sha256').update(notionOnly.notionPageId).digest('hex').slice(0, 16));
  assert.equal(findAssignmentTarget(reports, 'ffffffffffffffff'), undefined);
  assert.equal(findAssignmentTarget([{ ...base, notionPageId: null }], crypto.createHash('sha256').update('').digest('hex').slice(0, 16)), undefined);
});
