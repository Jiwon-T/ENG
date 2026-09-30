import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import {
  NotionReportWebhookSchema,
  type StoredLessonReport,
  type StoredNotionStudentMapping,
} from '../_lib/reportSchemas.js';
import { lookupStudentByPageId } from '../_lib/notion.js';
import { generateInternalStudentId, hashStudentKey, getSecretOrThrow } from '../_lib/security.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { extractAssignmentFromFeedback } from '../_lib/assignmentExtractor.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    // 최소 32자 시크릿 검증
    let expectedSecret: string;
    try {
      expectedSecret = getSecretOrThrow('MAKE_NOTION_WEBHOOK_SECRET', 32);
    } catch {
      return sendJson(res, 500, { ok: false, error: 'SERVER_CONFIG_ERROR' });
    }

    const providedSecret = req.headers['x-webhook-secret'];
    if (!providedSecret || providedSecret !== expectedSecret) {
      return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED_WEBHOOK' });
    }

    const receivedBody = await parseJsonBody(req) as Record<string, unknown>;
    // Make의 JSON 문자열 본문에서 줄바꿈·따옴표가 포함된 피드백도 깨지지 않도록
    // 문자열 필드는 base64로 받을 수 있다. 기존 평문 페이로드도 계속 지원한다.
    const rawBody = receivedBody?.payloadEncoding === 'base64'
      ? decodeMakeBase64Payload(receivedBody)
      : receivedBody;
    const parsed = NotionReportWebhookSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendJson(res, 400, {
        ok: false,
        error: 'INVALID_PAYLOAD',
        details: parsed.error.issues.map(i => i.message),
      });
    }

    const data = parsed.data;
    const { db } = getFirebaseAdmin();

    const studentKeyHash = hashStudentKey(data.studentKey);
    const notionMappingDocRef = db.collection('notionStudentMappings').doc(studentKeyHash);
    const mappingSnap = await notionMappingDocRef.get();

    let internalStudentId: string;

    if (mappingSnap.exists) {
      const mapping = mappingSnap.data() as StoredNotionStudentMapping;
      const expectedInternalStudentId = generateInternalStudentId(data.notionStudentPageId);
      if (mapping.internalStudentId !== expectedInternalStudentId) {
        return sendJson(res, 409, {
          ok: false,
          error: 'STUDENT_ID_MISMATCH',
          message: '학생 ID 관계와 기존 학생 매핑이 일치하지 않습니다.',
        });
      }
      internalStudentId = mapping.internalStudentId;
    } else {
      // 이름 검색 대신 원본 일지의 `학생 ID` 관계가 가리키는 학생 페이지를 직접 검증한다.
      let notionLookup;
      try {
        notionLookup = await lookupStudentByPageId(data.notionStudentPageId, data.studentKey);
      } catch (notionErr: any) {
        return sendJson(res, 422, {
          ok: false,
          error: 'STUDENT_NOT_FOUND_IN_NOTION',
          message: 'Notion [DB_학생 관리]에서 학생 정보를 찾을 수 없습니다.',
        });
      }

      internalStudentId = generateInternalStudentId(data.notionStudentPageId);
      const now = new Date().toISOString();

      // 신규 Notion 매핑 생성 시 firebaseUid는 항상 null (관리자 명시적 연결 전 자동 지정 금지)
      const newMapping: StoredNotionStudentMapping = {
        internalStudentId,
        studentKey: data.studentKey,
        studentDisplayName: notionLookup.studentDisplayName,
        notionStudentPageId: notionLookup.notionStudentPageId,
        firebaseUid: null,
        createdAt: now,
        updatedAt: now,
      };
      await notionMappingDocRef.set(newMapping);
    }

    const now = new Date().toISOString();
    const docRef = db.collection('lessonReports').doc(data.notionPageId);
    const prevSnap = await docRef.get();

    const sourceUpdatedAt = data.sourceUpdatedAt || now;

    // lessonReports 저장 시 Firebase UID가 아닌 internalStudentId를 학생 식별자로 저장
    const storedReport: StoredLessonReport = {
      notionPageId: data.notionPageId,
      studentKey: data.studentKey,
      internalStudentId,
      lessonDateStart: data.lessonDateStart,
      lessonDateEnd: data.lessonDateEnd || null,
      lessonTime: data.lessonTime || '',
      selfStudyTime: data.selfStudyTime || '',
      category: data.category,
      attendance: data.attendance || '',
      attitude: data.attitude || '',
      homework: data.homework || '',
      test: data.test || '',
      vocabularyScore: data.vocabularyScore ?? null,
      schoolExamScore: data.schoolExamScore ?? null,
      feedback: data.feedback || '',
      derivedAssignment: extractAssignmentFromFeedback(data.feedback),
      sourceUpdatedAt,
      serverReceivedAt: prevSnap.exists ? (prevSnap.data() as StoredLessonReport).serverReceivedAt : now,
      serverUpdatedAt: now,
    };

    await docRef.set(storedReport, { merge: true });

    return sendJson(res, 200, {
      ok: true,
      notionPageId: data.notionPageId,
      isNew: !prevSnap.exists,
    });
  } catch (err: any) {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}

export function decodeMakeBase64Payload(payload: Record<string, unknown>): Record<string, unknown> {
  const stringFields = [
    'notionPageId', 'notionStudentPageId', 'studentKey', 'lessonDateStart',
    'lessonDateEnd', 'lessonTime', 'selfStudyTime', 'category', 'attendance',
    'attitude', 'homework', 'test', 'feedback', 'sourceUpdatedAt',
  ];
  const decoded: Record<string, unknown> = { schemaVersion: Number(payload.schemaVersion || 1) };

  for (const field of stringFields) {
    const value = payload[field];
    if (typeof value !== 'string' || value === '') {
      decoded[field] = field === 'lessonDateEnd' ? null : '';
      continue;
    }
    decoded[field] = Buffer.from(value, 'base64').toString('utf8');
  }

  for (const field of ['vocabularyScore', 'schoolExamScore']) {
    const value = payload[field];
    decoded[field] = value === '' || value === null || value === undefined
      ? null
      : Number(value);
  }
  return decoded;
}
