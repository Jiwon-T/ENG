import type { IncomingMessage, ServerResponse } from 'http';
import { timingSafeEqual } from 'node:crypto';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { getSecretOrThrow } from '../_lib/security.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { isNotionPageId, normalizeNotionPageId } from '../_lib/notionPageId.js';
import { notionRequest, syncAcademicPage } from '../_lib/academic.js';
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  try {
    const expected = Buffer.from(getSecretOrThrow('MAKE_NOTION_WEBHOOK_SECRET', 32));
    const provided = Buffer.from(typeof req.headers['x-webhook-secret'] === 'string' ? req.headers['x-webhook-secret'] : '');
    if (provided.length !== expected.length || !timingSafeEqual(expected, provided)) return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED_WEBHOOK' });
    const body = await parseJsonBody(req);
    if (!isNotionPageId(body.pageId)) return sendJson(res, 400, { ok: false, error: 'INVALID_PAGE_ID' });
    const page = await notionRequest(`pages/${normalizeNotionPageId(body.pageId)}`);
    const result = await syncAcademicPage(getFirebaseAdmin().db, page);
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error: any) {
    const invalid = /SOURCE_NOT_ALLOWED|EXACTLY_ONE_STUDENT|INVALID_EXAM|INVALID_SCORE|INVALID_PERCENTILE|INVALID_SOURCE|DUPLICATE_ENROLLMENT/.test(error.message);
    return sendJson(res, invalid ? 422 : 500, { ok: false, error: invalid ? error.message : 'ACADEMIC_SYNC_FAILED' });
  }
}
