import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherAuthenticatedRequest, isReportReviewResponse, reportReviewError } from '../src/lib/teacherAuthenticatedRequest.ts';
import { compactLessonInput } from '../src/lib/lessonInput.ts';

test('review waits for auth restoration, renews a token once and preserves the POST body', async () => {
  const previous = globalThis.fetch;
  const events: string[] = [], requests: RequestInit[] = [];
  const auth: any = { currentUser: null, authStateReady: async () => {
    events.push('ready');
    auth.currentUser = { getIdToken: async (refresh: boolean) => { events.push(refresh ? 'renew' : 'token'); return refresh ? 'fresh' : 'expired'; } };
  } };
  globalThis.fetch = async (_url, init) => {
    requests.push(init!);
    const denied = requests.length === 1;
    return new Response(JSON.stringify(denied ? { ok: false, error: 'UNAUTHORIZED' } : { ok: true }), { status: denied ? 401 : 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const body = JSON.stringify({ action: 'report-review', audience: 'student', studentKey: 'student' });
    const result = await teacherAuthenticatedRequest(auth, '/api/teacher/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(result.ok, true);
    assert.deepEqual(events, ['ready', 'token', 'renew']);
    assert.equal(requests[1].body, body);
    assert.equal(new Headers(requests[1].headers).get('Authorization'), 'Bearer fresh');
  } finally { globalThis.fetch = previous; }
});

test('signed-out or revoked users do not trigger repeated authentication attempts', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ ok: false, error: 'SESSION_REVOKED' }), { status: 401, headers: { 'content-type': 'application/json' } }); };
  try {
    await assert.rejects(teacherAuthenticatedRequest({ authStateReady: async () => {}, currentUser: null }, '/api/teacher/workspace'), /로그인/);
    assert.equal(calls, 0);
    await teacherAuthenticatedRequest({ authStateReady: async () => {}, currentUser: { getIdToken: async () => 'token' } }, '/api/teacher/workspace');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = previous; }
});

test('a bootstrap or incomplete response cannot be rendered as a learning report', () => {
  assert.equal(isReportReviewResponse({ ok: true, students: [] }), false);
  assert.equal(isReportReviewResponse({ ok: true, reports: [], schedules: [], academic: { records: [], subjects: [], academyScores: [] } }), true);
  assert.match(reportReviewError({ status: 403, error: 'FORBIDDEN', userMessage: '', data: {} }), /담당 학생/);
});

test('compacting internal notes preserves public feedback and the original next plan', () => {
  const old = { specialNote: '원장 확인', attendanceNote: '10분 지각', note: '학부모 피드백', nextPlan: '문법 복습' };
  const next = compactLessonInput(old);
  assert.equal(next.specialNote, '원장 확인\n\n지각·결석: 10분 지각');
  assert.equal(next.attendanceNote, '');
  assert.equal(next.note, old.note);
  assert.equal(next.nextPlan, old.nextPlan);
  assert.deepEqual(compactLessonInput(next), next);
});
