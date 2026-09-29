import { hashPin } from './security.js';

export interface NotionStudentLookupResult {
  notionStudentPageId: string;
  studentKey: string;
  studentDisplayName: string;
  parentPhonePinHash: string;
}

export async function lookupStudentAndGuardianContact(studentKey: string): Promise<NotionStudentLookupResult> {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  const dbId = process.env.NOTION_STUDENT_DATABASE_ID;

  // 두 환경변수 중 하나라도 없으면 즉시 설정 오류 (하드코딩 fallback 전면 금지)
  if (!token || !dbId) {
    throw new Error(
      'CONFIG_ERROR: Required Notion configuration is missing. Both NOTION_INTEGRATION_TOKEN and NOTION_STUDENT_DATABASE_ID must be set.'
    );
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

  // 학생 호칭 우선, 없으면 원본 구분명, fallback studentKey
  const studentDisplayName =
    props['학생 호칭']?.rich_text?.[0]?.plain_text ||
    props['원본 구분명']?.rich_text?.[0]?.plain_text ||
    studentKey;

  return {
    notionStudentPageId: page.id,
    studentKey,
    studentDisplayName,
    parentPhonePinHash,
  };
}
