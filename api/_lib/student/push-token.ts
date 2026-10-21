import type { IncomingMessage, ServerResponse } from 'http';
import { verifyFirebaseSession } from '../firebaseSession.js';
import { parseJsonBody, sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { savePushToken } from '../pushTokens.js';
// POST /api/student/push-token {token, on}: this device's 과제·보강 알림 on (token saved) or off (token removed).
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  let uid: string;
  try { const { auth } = getFirebaseAdmin(); uid = (await verifyFirebaseSession(auth, header.slice(7).trim())).uid; }
  catch { return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' }); }
  try {
    const { db } = getFirebaseAdmin();
    return sendJson(res, 200, { ok: true, ...await savePushToken(db, uid, await parseJsonBody(req)) });
  } catch (e: any) {
    if (e?.name === 'ZodError') return sendJson(res, 400, { ok: false, error: 'BAD_REQUEST', message: '알림 설정을 저장하지 못했어요.' });
    if (e?.message === 'USER_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'USER_NOT_FOUND', message: '계정 정보를 찾지 못했어요. 다시 로그인해 주세요.' });
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', message: '알림 설정을 저장하지 못했어요. 잠시 후 다시 해 주세요.' });
  }
}
