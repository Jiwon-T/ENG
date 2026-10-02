import test from 'node:test';
import assert from 'node:assert/strict';
import { apiEndpoint } from '../api/_lib/apiEndpoint.ts';
import parent from '../api/parent.ts';
import student from '../api/student.ts';

test('original paths and Vercel rewrites resolve the same endpoint', () => {
  assert.equal(apiEndpoint('/api/parent/academic?reportSlug=example', 'parent'), 'academic');
  assert.equal(apiEndpoint('/api/parent?__endpoint=academic&reportSlug=example', 'parent'), 'academic');
  assert.equal(apiEndpoint('/api/student/assignment-completion?__endpoint=academic', 'student'), 'assignment-completion');
  assert.equal(apiEndpoint('/api/teacher/academic', 'student'), '');
});
test('routers retain authentication gates and reject unknown endpoints', async () => {
  for (const [handler, audience] of [[parent, 'parent'], [student, 'student']] as const) {
    for (const [endpoint, status] of [['academic', 401], ['unknown', 404], ['toString', 404]] as const) {
      let actual = 0;
      const res = { setHeader() {}, end() {}, get statusCode() { return actual; }, set statusCode(value) { actual = value; } };
      await handler({ method: 'GET', url: `/api/${audience}?__endpoint=${endpoint}`, headers: {} } as any, res as any);
      assert.equal(actual, status);
    }
  }
});
