import { hashPin } from './security.js';

export interface NotionStudentLookupResult {
  notionStudentPageId: string;
  studentKey: string;
  studentDisplayName: string;
  parentPhonePinHash: string;
}

export interface NotionStudentListItem {
  studentKey: string;
  studentDisplayName: string;
  hasGuardianContact: boolean;
  enrollmentStatus: string;
}

function getStudentKeyAndName(page: any): Omit<NotionStudentListItem, 'hasGuardianContact' | 'enrollmentStatus'> {
  const props = page.properties || {};
  const studentKey =
    props['원본 구분명']?.rich_text?.[0]?.plain_text ||
    props['이름 및 일지']?.title?.[0]?.plain_text ||
    '';
  const studentDisplayName =
    props['학생 호칭']?.rich_text?.[0]?.plain_text ||
    studentKey;

  return { studentKey, studentDisplayName };
}

export async function listNotionStudents(): Promise<NotionStudentListItem[]> {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  const dbId = process.env.NOTION_STUDENT_DATABASE_ID;
  if (!token || !dbId) {
    throw new Error('CONFIG_ERROR: Required Notion configuration is missing.');
  }

  const students: NotionStudentListItem[] = [];
  let cursor: string | undefined;

  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!res.ok) throw new Error(`NOTION_QUERY_FAILED: ${res.status}`);

    const data = await res.json();
    for (const page of data.results || []) {
      const { studentKey, studentDisplayName } = getStudentKeyAndName(page);
      if (!studentKey) continue;
      const digitsOnly = String(page.properties?.['보호자연락처']?.phone_number || '').replace(/\D/g, '');
      students.push({
        studentKey,
        studentDisplayName,
        hasGuardianContact: digitsOnly.length >= 9,
        enrollmentStatus: page.properties?.['등록상태']?.status?.name || '',
      });
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return students.sort((a, b) => a.studentKey.localeCompare(b.studentKey, 'ko'));
}

function parseStudentPage(page: any, fallbackStudentKey: string): NotionStudentLookupResult {
  const props = page.properties || {};
  const rawParentPhone = props['보호자연락처']?.phone_number || '';
  const digitsOnly = rawParentPhone.replace(/\D/g, '');

  if (!digitsOnly || digitsOnly.length < 9) {
    throw new Error('GUARDIAN_CONTACT_MISSING_OR_INVALID');
  }

  const studentKey =
    props['원본 구분명']?.rich_text?.[0]?.plain_text ||
    props['이름 및 일지']?.title?.[0]?.plain_text ||
    fallbackStudentKey;
  const studentDisplayName =
    props['학생 호칭']?.rich_text?.[0]?.plain_text ||
    studentKey;

  return {
    notionStudentPageId: page.id,
    studentKey,
    studentDisplayName,
    parentPhonePinHash: hashPin(digitsOnly.slice(-4)),
  };
}

export async function lookupStudentByPageId(
  notionStudentPageId: string,
  fallbackStudentKey = ''
): Promise<NotionStudentLookupResult> {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  if (!token) {
    throw new Error('CONFIG_ERROR: NOTION_INTEGRATION_TOKEN is missing.');
  }

  const normalizedPageId = notionStudentPageId.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(normalizedPageId)) {
    throw new Error('INVALID_NOTION_STUDENT_PAGE_ID');
  }

  const res = await fetch(`https://api.notion.com/v1/pages/${normalizedPageId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (!res.ok) {
    throw new Error(`NOTION_STUDENT_PAGE_LOOKUP_FAILED: ${res.status}`);
  }
  return parseStudentPage(await res.json(), fallbackStudentKey);
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

  return parseStudentPage(results[0], studentKey);
}
