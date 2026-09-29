import { hashPin } from './security.ts';

export interface NotionStudentLookupResult {
  studentKey: string;
  studentDisplayName: string;
  parentPhonePinHash: string;
}

export async function lookupStudentAndGuardianContact(studentKey: string): Promise<NotionStudentLookupResult> {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  const dbId = process.env.NOTION_STUDENT_DATABASE_ID || 'e2b0d0f1-c79a-8262-a208-8116c9201cfc';

  if (!token) {
    throw new Error('CONFIG_ERROR: NOTION_INTEGRATION_TOKEN is not configured.');
  }

  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: {
        or: [
          { property: '원본 구분명', rich_text: { equals: studentKey } },
          { property: '이름 및 일지', title: { equals: studentKey } },
        ],
      },
      page_size: 10,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`NOTION_QUERY_FAILED: ${res.status}`);
  }

  const data = await res.json();
  const results = data.results || [];

  if (results.length === 0) {
    throw new Error('STUDENT_NOT_FOUND');
  }

  if (results.length > 1) {
    throw new Error('MULTIPLE_STUDENTS_MATCHED');
  }

  const page = results[0];
  const props = page.properties;

  const rawParentPhone = props['보호자연락처']?.phone_number || '';
  const digitsOnly = rawParentPhone.replace(/\D/g, '');

  if (!digitsOnly || digitsOnly.length < 9) {
    throw new Error('GUARDIAN_CONTACT_MISSING_OR_INVALID');
  }

  const last4 = digitsOnly.slice(-4);
  const parentPhonePinHash = hashPin(last4);

  const studentDisplayName =
    props['학생 호칭']?.rich_text?.[0]?.plain_text ||
    props['원본 구분명']?.rich_text?.[0]?.plain_text ||
    studentKey;

  return {
    studentKey,
    studentDisplayName,
    parentPhonePinHash,
  };
}
