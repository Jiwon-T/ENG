import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import {createHash} from 'node:crypto';

type AdminConnection={db:Firestore;auth:Auth};
const registryKey=Symbol.for('jiwont.firebaseAdmin.connections.v1');
const host=globalThis as typeof globalThis&{[registryKey]?:Map<string,AdminConnection>};
// Separate server bundles can evaluate this module more than once in one process.
const connections=host[registryKey]??(host[registryKey]=new Map<string,AdminConnection>());

export function getFirebaseAdmin(): { db: Firestore; auth: Auth } {
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

  const identity=createHash('sha256').update(JSON.stringify([projectId,clientEmail,privateKey])).digest('hex');
  const connectionKey=JSON.stringify([identity,databaseId]);
  const existing=connections.get(connectionKey);if(existing)return existing;
  const appName='jiwont-admin-'+identity;
  const adminApp=getApps().find(app=>app.name===appName)||initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    },appName);

  // 반드시 지정된 databaseId를 명시하여 초기화 (default DB fallback 전면 차단)
  const adminAuthInstance = getAuth(adminApp);
  const adminDb = getFirestore(adminApp, databaseId);
  adminDb.settings({ ignoreUndefinedProperties: true });
  const connection={db:adminDb,auth:adminAuthInstance};connections.set(connectionKey,connection);
  return connection;
}
