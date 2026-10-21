import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadStudentResource, studentReportCache} from '../src/lib/studentReportCache';

const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});

test('학습 리포트: an account not linked to a student gets empty lists (marked), not "불러오지 못했습니다"; a real failure still fails', async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = reply(403, {ok: false, error: 'STUDENT_REPORT_NOT_LINKED', message: '아직 수업 리포트가 계정과 연결되지 않았습니다.', reports: []}) as any;
    const r: any = await loadStudentResource('u1', 'lesson-reports', async () => 't');
    assert.deepEqual([r.reports, r.unlinked], [[], true]);
    const s: any = await loadStudentResource('u1', 'schedules', async () => 't');
    assert.deepEqual([s.schedules, s.unlinked], [[], true]);
    studentReportCache.invalidate('u2');
    globalThis.fetch = reply(500, {ok: false, error: 'SERVER_ERROR'}) as any;
    await assert.rejects(() => loadStudentResource('u2', 'lesson-reports', async () => 't'), /불러오지 못했습니다/);
  } finally { globalThis.fetch = saved; studentReportCache.invalidate(); }
  const src = readFileSync(new URL('../src/components/student/LearningReport.tsx', import.meta.url), 'utf8');
  assert.match(src, /\{unlinked && <p role="status"[^>]*>아직 계정이 학생 기록과 연결되지 않았어요\./);
});
