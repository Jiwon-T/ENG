import { withNotionUsageRoute, recordMakeWebhook } from '../_lib/notionUsage.js';
import {storeWebhookLessonReport} from '../_lib/lessonWebhookProjection.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import {
  NotionReportWebhookSchema,
} from '../_lib/reportSchemas.js';
import { lookupStudentByPageId } from '../_lib/notion.js';
import {coreActive,coreStudentIdentity} from '../_lib/academyCore.js';
import { getSecretOrThrow } from '../_lib/security.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { migrateStudentMapping } from '../_lib/studentIdentity.js';

export default function handler(req: IncomingMessage, res: ServerResponse) { return withNotionUsageRoute('webhook:lesson', () => routeHandler(req, res)); }
async function routeHandler(req: IncomingMessage, res: ServerResponse) {
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

    // The student's relation page ID is the only identity; legacy display keys are ignored.
    let notionLookup;
    try {
      notionLookup = await coreActive(db,{academyId:'main'})?await coreStudentIdentity(db,data.notionStudentPageId,false):await lookupStudentByPageId(data.notionStudentPageId, '', false);
    } catch {
      return sendJson(res, 422, { ok: false, error: 'STUDENT_NOT_FOUND_IN_NOTION' });
    }
    const mapping = await migrateStudentMapping(db, notionLookup.notionStudentPageId, notionLookup.studentDisplayName);
    const result=await storeWebhookLessonReport(db,data,mapping);
    recordMakeWebhook('lesson', result.applied ? 'applied' : (result.reason || 'skipped'));
    return sendJson(res,200,{ok:true,notionPageId:data.notionPageId,...result});
  } catch (err: any) {
    recordMakeWebhook('lesson', 'error');
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}

export function decodeMakeBase64Payload(payload: Record<string, unknown>): Record<string, unknown> {
  const stringFields = [
    'notionPageId', 'notionStudentPageId', 'studentKey', 'lessonDateStart',
    'lessonDateEnd', 'lessonTime', 'selfStudyTime', 'category', 'attendance',
    'subject', 'attitude', 'homework', 'test', 'feedback', 'sourceUpdatedAt',
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
