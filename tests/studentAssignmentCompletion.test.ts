import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/student/assignment-completion.ts';
test('student assignment completion requires authentication before accessing reports or writing completion state', async () => {
  let body = '';
  const res = { statusCode: 0, setHeader() {}, end(value: string) { body = value; } };
  await handler({ method: 'PATCH', headers: {}, body: { reportId: 'someone-elses-report' } } as any, res as any);
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(body).error, 'UNAUTHORIZED');
});
