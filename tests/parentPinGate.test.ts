import test from 'node:test';
import assert from 'node:assert/strict';
import lessonReports from '../api/_lib/parent/lesson-reports.ts';
import schedules from '../api/_lib/parent/schedules.ts';

for (const [name, handler] of [['reports', lessonReports], ['schedules', schedules]] as const) {
  for (const headers of [{}, { cookie: 'parent_session=previous-valid-session' }, { 'x-parent-session': ['a', 'b'] }]) {
    test(`${name} refuses access without a page PIN token: ${JSON.stringify(headers)}`, async () => {
      let body = '';
      const res = {
        statusCode: 0,
        setHeader() {},
        end(value: string) { body = value; },
      };
      await handler({ method: 'GET', url: '/api/parent/' + name + '?reportSlug=test', headers } as any, res as any);
      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(body).error, 'AUTH_REQUIRED');
      assert.equal(JSON.parse(body).reports, undefined);
      assert.equal(JSON.parse(body).schedules, undefined);
    });
  }
}
