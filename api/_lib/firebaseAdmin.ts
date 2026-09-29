import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuthInstance: Auth | null = null;

export function getFirebaseAdmin(): { db: Firestore; auth: Auth } {
  if (adminDb && adminAuthInstance) {
    return { db: adminDb, auth: adminAuthInstance };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const databaseId = process.env.FIRESTORE_DATABASE_ID;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('CONFIG_ERROR: Firebase Admin credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not configured.');
  }

  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (getApps().length === 0) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  } else {
    adminApp = getApps()[0];
  }

  adminDb = databaseId ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);
  adminDb.settings({ ignoreUndefinedProperties: true });
  adminAuthInstance = getAuth(adminApp);

  return { db: adminDb, auth: adminAuthInstance };
}
