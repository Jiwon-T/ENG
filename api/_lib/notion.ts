import { hashPin } from './security.js';
import { normalizeNotionPageId } from './notionPageId.js';

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

function studentTitle(props: any): string {
  const title = props['학생'] || props['학생 이름'] || props['이름 및 일지']
    || Object.values(props).find((property: any) => property.type === 'title');
  return (title?.title || []).map((part: any) => part.plain_text ?? part.text?.content ?? '').join('');
}

function getStudentKeyAndName(page: any): Omit<NotionStudentListItem, 'hasGuardianContact' | 'enrollmentStatus'> {
  const props = page.properties || {};
  const studentKey = normalizeNotionPageId(page.id);
  const studentDisplayName = studentTitle(props) || '학생';

  return { studentKey, studentDisplayName };
}

export async function listNotionStudents(): Promise<NotionStudentListItem[]> {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  const dbId = process.env.NOTION_STUDENT_DATABASE_ID;
  if (!token || !dbId) {
    throw new Error('CONFIG_ERROR: NOTION_INTEGRATION_TOKEN and NOTION_STUDENT_DATABASE_ID are required.');
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

  return students.sort((a, b) => a.studentDisplayName.localeCompare(b.studentDisplayName, 'ko'));
}

function parseStudentPage(page: any, requireGuardianContact: boolean): NotionStudentLookupResult {
  const props = page.properties || {};
  const rawParentPhone = props['보호자연락처']?.phone_number || '';
  const digitsOnly = rawParentPhone.replace(/\D/g, '');

  if (requireGuardianContact && (!digitsOnly || digitsOnly.length < 9)) {
    throw new Error('GUARDIAN_CONTACT_MISSING_OR_INVALID');
  }

  const studentKey = normalizeNotionPageId(page.id);
  const studentDisplayName = studentTitle(props) || '학생';

  return {
    notionStudentPageId: studentKey,
    studentKey,
    studentDisplayName,
    parentPhonePinHash: digitsOnly.length >= 9 ? hashPin(digitsOnly.slice(-4)) : '',
  };
}

export async function lookupStudentByPageId(
  notionStudentPageId: string,
  _legacyKey = '',
  requireGuardianContact = true
): Promise<NotionStudentLookupResult> {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  if (!token) {
    throw new Error('CONFIG_ERROR: NOTION_INTEGRATION_TOKEN is missing.');
  }

  const normalizedPageId = normalizeNotionPageId(notionStudentPageId);

  const res = await fetch(`https://api.notion.com/v1/pages/${normalizedPageId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (!res.ok) {
    throw new Error(`NOTION_STUDENT_PAGE_LOOKUP_FAILED: ${res.status}`);
  }
  const page = await res.json();
  const dbId = process.env.NOTION_STUDENT_DATABASE_ID;
  if (!dbId) throw new Error('CONFIG_ERROR: NOTION_STUDENT_DATABASE_ID is missing.');
  if (page.archived || page.in_trash || !page.parent?.database_id
    || normalizeNotionPageId(page.parent.database_id) !== normalizeNotionPageId(dbId)
    || normalizeNotionPageId(page.id) !== normalizedPageId) {
    throw new Error('STUDENT_NOT_FOUND');
  }
  return parseStudentPage(page, requireGuardianContact);
}

export async function lookupStudentAndGuardianContact(studentPageId: string): Promise<NotionStudentLookupResult> {
  if (!process.env.NOTION_INTEGRATION_TOKEN || !process.env.NOTION_STUDENT_DATABASE_ID) {
    throw new Error('CONFIG_ERROR: NOTION_INTEGRATION_TOKEN and NOTION_STUDENT_DATABASE_ID are required.');
  }
  return lookupStudentByPageId(studentPageId);
}
