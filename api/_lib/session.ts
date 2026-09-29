import { getFirebaseAdmin } from './firebaseAdmin.ts';
import { hashToken, generateSecureToken } from './security.ts';

export interface ParentSessionData {
  sessionHash: string;
  reportSlug: string;
  studentId: string;
  studentKey: string;
  createdAt: string;
  expiresAt: string;
}

export async function createParentSession(params: {
  reportSlug: string;
  studentId: string;
  studentKey: string;
}): Promise<{ rawSessionToken: string; expiresAt: string }> {
  const { db } = getFirebaseAdmin();
  const rawSessionToken = generateSecureToken(32);
  const sessionHash = hashToken(rawSessionToken);

  // 24시간 세션
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const sessionData: ParentSessionData = {
    sessionHash,
    reportSlug: params.reportSlug,
    studentId: params.studentId,
    studentKey: params.studentKey,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  await db.collection('parentSessions').doc(sessionHash).set(sessionData);

  return { rawSessionToken, expiresAt };
}

export async function getVerifiedParentSession(rawSessionToken: string): Promise<ParentSessionData | null> {
  if (!rawSessionToken) return null;

  const { db } = getFirebaseAdmin();
  const sessionHash = hashToken(rawSessionToken);

  const doc = await db.collection('parentSessions').doc(sessionHash).get();
  if (!doc.exists) return null;

  const session = doc.data() as ParentSessionData;
  if (new Date(session.expiresAt) < new Date()) {
    return null;
  }

  return session;
}
