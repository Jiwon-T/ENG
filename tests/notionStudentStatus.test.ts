import test from 'node:test';
import assert from 'node:assert/strict';
import { listNotionStudents } from '../api/_lib/notion.ts';

test('reads actual 등록상태 for every page without exposing contacts or Notion IDs', async () => {
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
        id: 'internal-notion-id',
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
    assert.equal(JSON.stringify(students).includes('internal-notion-id'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.NOTION_INTEGRATION_TOKEN;
    else process.env.NOTION_INTEGRATION_TOKEN = originalToken;
    if (originalDb === undefined) delete process.env.NOTION_STUDENT_DATABASE_ID;
    else process.env.NOTION_STUDENT_DATABASE_ID = originalDb;
  }
});
