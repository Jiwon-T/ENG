import type { IncomingMessage, ServerResponse } from 'http';
import { verifyFirebaseSession } from '../firebaseSession.js';
import { parseJsonBody, sendJson } from '../http.js';
import { getFirebaseAdmin } from '../firebaseAdmin.js';
import { studyDoneAlert } from '../studyAlerts.js';
// POST /api/student/study-done {id, device}: one study finished (its studySessions record) → 학생 학습 알림 to the teachers.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' }); }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' });
  let uid: string;
  try { const { auth } = getFirebaseAdmin(); uid = (await verifyFirebaseSession(auth, header.slice(7).trim())).uid; }
  catch { return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED' }); }
  try {
    const { db } = getFirebaseAdmin();
    return sendJson(res, 200, { ok: true, ...await studyDoneAlert(db, uid, await parseJsonBody(req)) });
  } catch (e: any) {
    if (e?.name === 'ZodError') return sendJson(res, 400, { ok: false, error: 'BAD_REQUEST' });
    console.warn('STUDY_DONE_ALERT_FAILED');
    return sendJson(res, 200, { ok: true, sent: 0 });
  }
}
