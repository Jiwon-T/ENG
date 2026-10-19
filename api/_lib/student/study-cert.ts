import type { IncomingMessage, ServerResponse } from 'http';
import { verifyFirebaseSession } from '../firebaseSession.js';
import { parseJsonBody, sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { myStudyCerts, requestStudyCert } from '../studyCerts.js';
// /api/student/study-cert — GET ?kind=&ref= (my requests), POST {kind, ref, photo?} (ask the teacher to check it).
export const CERT_MESSAGES: Record<string, [number, string]> = {
  INVALID_INPUT: [400, '요청을 다시 확인해 주세요.'],
  CERT_NOT_LINKED: [403, '학원에 연결해야 선생님께 인증을 요청할 수 있어요.'],
  CERT_NOT_FOUND: [404, '인증할 학습지를 찾지 못했어요.'],
  CERT_PENDING: [409, '이미 선생님 확인을 기다리고 있어요.'],
  CERT_DONE: [409, '이미 인증을 받았어요.'],
  CERT_ONE_A_DAY: [409, '회독 인증은 하루에 한 번이에요. 내일 다시 요청해 주세요.'],
  CERT_TOO_MANY: [429, '확인을 기다리는 요청이 많아요. 선생님 확인 뒤에 다시 요청해 주세요.'],
  CERT_PHOTO_BAD: [400, '사진을 올리지 못했어요. 다른 사진으로 해 주세요.'],
  CERT_DECIDED: [409, '이미 확인한 요청이에요.'],
  CERT_DAILY_LIMIT: [429, `이 학생은 오늘 인증 포인트를 다 받았어요. 내일 다시 확인해 주세요.`],
  FORBIDDEN: [403, '권한이 없어요.'],
};
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  let uid: string;
  try { const { auth } = getFirebaseAdmin(); uid = (await verifyFirebaseSession(auth, header.slice(7).trim())).uid; }
  catch { return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' }); }
  try {
    const { db } = getFirebaseAdmin();
    if (req.method === 'GET') {
      const q = new URL(req.url || '', 'http://localhost').searchParams;
      return sendJson(res, 200, { ok: true, ...await myStudyCerts(db, uid, { kind: q.get('kind'), ref: q.get('ref') }) });
    }
    return sendJson(res, 200, { ok: true, ...await requestStudyCert(db, uid, await parseJsonBody(req)) });
  } catch (e: any) {
    const known = CERT_MESSAGES[e?.message];
    if (known) return sendJson(res, known[0], { ok: false, error: e.message, message: known[1] });
    if (e?.message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { ok: false, error: 'CERT_PHOTO_BAD', message: CERT_MESSAGES.CERT_PHOTO_BAD[1] });
    console.warn('STUDY_CERT_FAILED'); // never the request
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR', message: '요청하지 못했어요. 잠시 후 다시 해 주세요.' });
  }
}
