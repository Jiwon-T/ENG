import type { IncomingMessage } from 'http';
import { getFirebaseAdmin } from './firebaseAdmin.js';
import { readStudentMapping } from './studentIdentity.js';
import { getVerifiedParentSession } from './session.js';
export async function academicStudentId(req: IncomingMessage, audience: 'parent' | 'student', deps = { getFirebaseAdmin, readStudentMapping, getVerifiedParentSession }) {
  if (audience === 'parent') {
    const token = req.headers['x-parent-session'];
    const session = typeof token === 'string' ? await deps.getVerifiedParentSession(token) : null;
    if (!session) throw new Error('UNAUTHORIZED');
    const slug = new URL(req.url || '', 'http://localhost').searchParams.get('reportSlug');
    if (slug && session.reportSlug !== slug) throw new Error('FORBIDDEN');
    return session.internalStudentId;
  }
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');
  const { auth, db } = deps.getFirebaseAdmin();
  let uid: string;
  try { uid = (await auth.verifyIdToken(header.slice(7).trim())).uid; } catch { throw new Error('UNAUTHORIZED'); }
  const user = await db.collection('users').doc(uid).get();
  const key = user.data()?.notionStudentKey;
  const mapping = key ? await deps.readStudentMapping(db, key) : null;
  if (!mapping?.internalStudentId || mapping.firebaseUid !== uid) throw new Error('FORBIDDEN');
  return mapping.internalStudentId;
}
