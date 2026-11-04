import type { IncomingMessage, ServerResponse } from 'http';
import { verifyFirebaseSession } from '../firebaseSession.js';
import { parseJsonBody, sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { setOwnAppName, setOwnAppIcon } from '../appUsers.js';
// POST /api/student/app-profile {name} or {icon}: 이름 설정하기 / 앱 이름 바꾸기, or 아이콘 선택, for the signed-in account.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  let uid: string;
  try { const { auth } = getFirebaseAdmin(); uid = (await verifyFirebaseSession(auth, header.slice(7).trim())).uid; }
  catch { return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: '로그인이 끝났어요. 다시 로그인해 주세요.' }); }
  try {
    const { db } = getFirebaseAdmin();
    const body: any = await parseJsonBody(req);
    return sendJson(res, 200, { ok: true, ...await (body && typeof body === 'object' && 'icon' in body ? setOwnAppIcon(db, uid, body) : setOwnAppName(db, uid, body)) });
  } catch (e: any) {
    if (e?.name === 'ZodError') return sendJson(res, 400, { ok: false, error: 'BAD_REQUEST', message: '이름은 1~100자로 입력해 주세요. 아이콘은 목록에서 골라 주세요.' });
    if (e?.message === 'USER_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'USER_NOT_FOUND', message: '계정 정보를 찾지 못했어요. 다시 로그인해 주세요.' });
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', message: '저장하지 못했어요. 잠시 후 다시 해 주세요.' });
  }
}
