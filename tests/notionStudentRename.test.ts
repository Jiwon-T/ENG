import test from 'node:test';
import assert from 'node:assert/strict';
import { listNotionStudents, lookupStudentAndGuardianContact } from '../api/_lib/notion.ts';

test('old and renamed title properties return the full student name instead of the nickname', async () => {
  const originalFetch = globalThis.fetch;
  const previous = { ...process.env };
  process.env.NOTION_INTEGRATION_TOKEN = 'test-token';
  process.env.NOTION_STUDENT_DATABASE_ID = 'e2b0d0f1-c79a-8262-a208-8116c9201cfc';
  process.env.PHONE_PIN_PEPPER = 'test-pepper-longer-than-thirty-two-characters';
  try {
    for (const name of ['이름 및 일지', '학생 이름', '학생']) {
      globalThis.fetch = async (_url, options) => {
        const page = { id: '3e90d0f1-c79a-8105-94c4-ff6f31f73223', parent: { database_id: process.env.NOTION_STUDENT_DATABASE_ID }, properties: {
          [name]: { type: 'title', title: [{ plain_text: '학생 ' }, { plain_text: '(학교고1)' }] },
          '학생 호칭': { rich_text: [{ plain_text: '별명' }] },
          '원본 구분명': { rich_text: [{ plain_text: '기존 연결키' }] },
          '보호자연락처': { phone_number: Array(11).fill('0').join('') },
        } };
        return new Response(JSON.stringify(options?.method === 'POST' ? { results: [page], has_more: false } : page));
      };
      const list = await listNotionStudents();
      assert.equal(list[0].studentDisplayName, '학생 (학교고1)');
      assert.equal(list[0].studentKey, '3e90d0f1-c79a-8105-94c4-ff6f31f73223');
      const lookup = await lookupStudentAndGuardianContact('3E90D0F1C79A810594C4FF6F31F73223');
      assert.equal(lookup.studentDisplayName, '학생 (학교고1)');
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ['NOTION_INTEGRATION_TOKEN', 'NOTION_STUDENT_DATABASE_ID', 'PHONE_PIN_PEPPER']) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
