import { withNotionUsageRoute, recordMakeWebhook } from '../_lib/notionUsage.js';
import { LESSON_DATABASE, backfillAcademyPage } from '../_lib/academyBackfill.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { verifyAdminAuth } from '../_lib/auth.js';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';
import { GRADE_DATABASE, ENROLLMENT_DATABASE, notionRequest, syncAcademicPage } from '../_lib/academic.js';
export default function handler(req: IncomingMessage, res: ServerResponse) { return withNotionUsageRoute('import-academic', () => routeHandler(req, res)); }
async function routeHandler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  try { await verifyAdminAuth(req); } catch (error: any) { return sendJson(res, error.message === 'FORBIDDEN' ? 403 : 401, { ok: false, error: 'UNAUTHORIZED' }); }
  try {
    const body = await parseJsonBody(req);
    const kind = ['enrollments', 'academy'].includes(body.kind) ? body.kind : 'grades';
    const database = kind === 'academy' ? LESSON_DATABASE : kind === 'grades' ? GRADE_DATABASE : ENROLLMENT_DATABASE;
    if (body.cursor !== undefined && (typeof body.cursor !== 'string' || body.cursor.length > 200)) return sendJson(res, 400, { ok: false, error: 'INVALID_CURSOR' });
    const page = await notionRequest(`databases/${database}/query`, { page_size: 3, ...(kind === 'academy' ? { filter: { property: '전송 완료', select: { equals: '완료' } } } : {}), ...(body.cursor ? { start_cursor: body.cursor } : {}) });
    let imported = 0;
    const errors: { pageId: string; error: string }[] = [];
    for (const source of page.results || []) {
      try { if (kind === 'academy') { if (await backfillAcademyPage(getFirebaseAdmin().db, source)) imported++; } else { await syncAcademicPage(getFirebaseAdmin().db, source); imported++; } }
      catch (error: any) { errors.push({ pageId: source.id, error: /EXACTLY_ONE|INVALID_|SOURCE_NOT_ALLOWED/.test(error.message) ? error.message : 'IMPORT_FAILED' }); }
    }
    return sendJson(res, 200, { ok: true, kind, imported, errors, nextCursor: page.has_more ? page.next_cursor : null });
  } catch { return sendJson(res, 500, { ok: false, error: 'ACADEMIC_IMPORT_FAILED' }); }
}
