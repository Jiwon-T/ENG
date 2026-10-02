import type { IncomingMessage, ServerResponse } from 'http';
import { sendJson } from '../http.js';
import { getVerifiedParentSession } from '../session.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { loadParentReportPage } from '../parentReportPage.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const startedAt = performance.now();
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    // 기존 쿠키 대신 현재 페이지의 PIN 인증 토큰만 허용합니다.
    const header = req.headers['x-parent-session'];
    const sessionToken = typeof header === 'string' ? header : '';

    if (!sessionToken) {
      return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED', message: '보호자 인증이 필요합니다.' });
    }

    // getVerifiedParentSession에서 active==true 및 authVersion 일치까지 함께 검증
    const session = await getVerifiedParentSession(sessionToken);
    if (!session) {
      return sendJson(res, 401, {
        ok: false,
        error: 'SESSION_EXPIRED',
        message: '세션이 만료되었거나 비활성화되었습니다. 다시 인증해 주세요.',
      });
    }

    // 접속한 reportSlug와 세션이 결속되어 있는지 검증
    const url = new URL(req.url || '', 'http://localhost');
    const requestedSlug = url.searchParams.get('reportSlug');
    if (requestedSlug && session.reportSlug !== requestedSlug) {
      return sendJson(res, 403, { ok: false, error: 'SESSION_MISMATCH', message: '다른 학생의 주소에는 접근할 수 없습니다.' });
    }

    const sessionVerifiedAt = performance.now();
    const { db } = getFirebaseAdmin();
    const page = await loadParentReportPage(db, session.internalStudentId, url.searchParams.get('cursor'));

    res.setHeader('Server-Timing', `session;dur=${(sessionVerifiedAt - startedAt).toFixed(1)}, reports;dur=${(performance.now() - sessionVerifiedAt).toFixed(1)}`);
    return sendJson(res, 200, {
      ok: true,
      student: {
        // 내부 studentKey 및 Notion Page ID를 절대 노출하지 않고 학부모 표시명만 전달
        studentDisplayName: session.studentDisplayName,
      },
      ...page,
    });
  } catch (err: any) {
    if (err.message === 'INVALID_REPORT_CURSOR') return sendJson(res, 400, { ok: false, error: 'INVALID_REPORT_CURSOR' });
    console.error('PARENT_REPORT_QUERY_FAILED', { code: err.code === 9 ? 'FIRESTORE_INDEX_REQUIRED' : 'QUERY_FAILED' });
    return sendJson(res, 500, { ok: false, error: err.code === 9 ? 'FIRESTORE_INDEX_REQUIRED' : 'SERVER_ERROR', message: '수업 일지를 불러오지 못했습니다. 다시 시도해 주세요.' });
  }
}
