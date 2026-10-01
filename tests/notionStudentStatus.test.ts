import test from 'node:test';
import assert from 'node:assert/strict';
import { listNotionStudents } from '../api/_lib/notion.ts';

test('reads actual 등록상태 for every page using page IDs as admin-only keys without exposing contacts', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.NOTION_INTEGRATION_TOKEN;
  const originalDb = process.env.NOTION_STUDENT_DATABASE_ID;
  process.env.NOTION_INTEGRATION_TOKEN = 'test-token';
  process.env.NOTION_STUDENT_DATABASE_ID = 'test-db';
  const statuses = ['등록', '중단', '대기', ''];
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options?.body as string);
    assert.equal(body.start_cursor, calls === 0 ? undefined : 'next-page');
    const start = calls++ * 2;
    return new Response(JSON.stringify({
      results: statuses.slice(start, start + 2).map((status, index) => ({
        id: `3e90d0f1-c79a-8105-94c4-ff6f31f7322${start + index}`,
        properties: {
          '이름 및 일지': { title: [{ plain_text: `학생${start + index}` }] },
          '등록상태': { status: status ? { name: status } : null },
        },
      })),
      has_more: calls === 1,
      next_cursor: calls === 1 ? 'next-page' : null,
    }));
  };
  try {
    const students = await listNotionStudents();
    assert.deepEqual(students.map(s => s.enrollmentStatus), statuses);
    assert.equal(students.filter(s => s.enrollmentStatus === '등록').length, 1);
    assert.equal(students.filter(s => s.enrollmentStatus !== '등록').length, 3);
    assert.equal(new Set(students.map(student => student.studentKey)).size, 4);
    assert.equal(students.some(student => '보호자연락처' in student), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.NOTION_INTEGRATION_TOKEN;
    else process.env.NOTION_INTEGRATION_TOKEN = originalToken;
    if (originalDb === undefined) delete process.env.NOTION_STUDENT_DATABASE_ID;
    else process.env.NOTION_STUDENT_DATABASE_ID = originalDb;
  }
});
