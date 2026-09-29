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

  // 4개 필수 환경변수 중 하나라도 없으면 즉시 실패 (기본 DB fallback 금지)
  if (!projectId || !clientEmail || !privateKey || !databaseId) {
    throw new Error(
      'CONFIG_ERROR: Required Firebase Admin configuration is incomplete. All four environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIRESTORE_DATABASE_ID) must be set.'
    );
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

  // 반드시 지정된 databaseId를 명시하여 초기화 (default DB fallback 전면 차단)
  adminDb = getFirestore(adminApp, databaseId);
  adminDb.settings({ ignoreUndefinedProperties: true });
  adminAuthInstance = getAuth(adminApp);

  return { db: adminDb, auth: adminAuthInstance };
}
