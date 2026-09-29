import type { IncomingMessage } from 'http';
import { getFirebaseAdmin } from './firebaseAdmin.js';

export interface VerifiedAdminUser {
  uid: string;
  email?: string;
}

export async function verifyAdminAuth(req: IncomingMessage): Promise<VerifiedAdminUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }

  const token = authHeader.split('Bearer ')[1].trim();
  const { auth } = getFirebaseAdmin();

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch (e: any) {
    throw new Error('INVALID_TOKEN');
  }

  const adminUid = process.env.ADMIN_UID;
  if (!adminUid) {
    throw new Error('CONFIG_ERROR: ADMIN_UID is not set in server environment.');
  }

  if (decoded.uid !== adminUid) {
    throw new Error('FORBIDDEN');
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}
