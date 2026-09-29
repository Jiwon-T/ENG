import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initializeApp as initAdminApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import type {
  StoredLessonReport,
  StudentLessonReportDTO,
  ParentLessonReportDTO,
  MagicLinkRecord,
  ParentSessionRecord
} from '../types/lessonReport.js';

// Load config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let config: any = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

const PROJECT_ID = config.projectId || process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0399631857';
const DATABASE_ID = config.firestoreDatabaseId || 'ai-studio-fa3e8961-76b4-4df9-8815-8e963dcfb5f4';

// ----------------------------------------------------
// 1. Firebase Admin Init (Application Default Credential)
// ----------------------------------------------------
let adminDb: any = null;
let adminAuth: any = null;

try {
  let app;
  if (getApps().length === 0) {
    app = initAdminApp({
      projectId: PROJECT_ID,
      credential: applicationDefault(),
    });
  } else {
    app = getApps()[0];
  }
  adminDb = getAdminFirestore(app, DATABASE_ID);
  adminAuth = getAdminAuth(app);
} catch (e: any) {
  console.error('Firebase Admin SDK ADC initialization failed:', e.message);
}

function getDatabase(): any {
  if (!adminDb) {
    throw new Error('FIRESTORE_ADMIN_NOT_INITIALIZED: Firebase Admin SDK is not initialized.');
  }
  return adminDb;
}

// ----------------------------------------------------
// 2. Cryptography Utilities
// ----------------------------------------------------

/**
 * SHA-256 Hash
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * HMAC-SHA256 for Phone Last 4 digits (전수조사 방어)
 * PHONE_PIN_PEPPER 환경변수가 없으면 즉시 에러 발생
 */
export function hashPin(last4Digits: string): string {
  const pepper = process.env.PHONE_PIN_PEPPER;
  if (!pepper) {
    throw new Error('PHONE_PIN_PEPPER_MISSING: Environment variable PHONE_PIN_PEPPER must be configured.');
  }
  return crypto.createHmac('sha256', pepper).update(last4Digits.trim()).digest('hex');
}

/**
 * Generate Secure CSPRNG Token
 */
export function generateSecureToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// ----------------------------------------------------
// 3. Data Access Layer (Strict Firestore Direct Only - No Memory Fallback)
// ----------------------------------------------------

/**
 * Upsert Lesson Report to Firestore
 * Firestore 쓰기 실패 시 에러를 던져 호출자(Make/서버)가 명확히 실패를 인지하게 함
 */
export async function upsertLessonReport(report: StoredLessonReport): Promise<{ ok: boolean; isNew: boolean }> {
  const db = getDatabase();
  const docRef = db.collection('lessonReports').doc(report.notionPageId);
  const prev = await docRef.get();
  await docRef.set(report, { merge: true });
  return { ok: true, isNew: !prev.exists };
}

export async function getLessonReport(notionPageId: string): Promise<StoredLessonReport | null> {
  const db = getDatabase();
  const snap = await db.collection('lessonReports').doc(notionPageId).get();
  if (snap.exists) return snap.data() as StoredLessonReport;
  return null;
}

export async function getReportsForStudent(studentId: string): Promise<StoredLessonReport[]> {
  const db = getDatabase();
  const snap = await db.collection('lessonReports').where('studentId', '==', studentId).get();
  const list: StoredLessonReport[] = [];
  snap.forEach((d: any) => list.push(d.data() as StoredLessonReport));
  return list.sort((a, b) => new Date(b.lessonDateStart).getTime() - new Date(a.lessonDateStart).getTime());
}

/**
 * 대상 학생 매핑 조회
 * 우선 테스트 학생('테스트 (복제고1)')에 대한 고정 식별자를 지원하고,
 * 그 외에는 users 컬렉션에서 notionStudentKey를 조회
 */
export async function findStudentByNotionKey(studentKey: string): Promise<{ studentId: string; displayName: string; parentPhone: string; studentPhone: string } | null> {
  if (studentKey === '테스트 (복제고1)') {
    return {
      studentId: 'test-student-bokje-uid',
      displayName: '테스트 학생 (복제고1)',
      parentPhone: '010-9862-4601',
      studentPhone: '010-9862-4601',
    };
  }

  const db = getDatabase();
  const snap = await db.collection('users').where('notionStudentKey', '==', studentKey).limit(1).get();
  if (!snap.empty) {
    const d = snap.docs[0].data();
    return {
      studentId: snap.docs[0].id,
      displayName: d.name || d.alias || studentKey,
      parentPhone: d.parentPhone || '',
      studentPhone: d.phone || '',
    };
  }

  return null;
}

/**
 * 매직 링크 레코드 저장/조회/수정
 */
export async function saveMagicLinkRecord(record: MagicLinkRecord): Promise<void> {
  const db = getDatabase();
  await db.collection('magicLinkTokens').doc(record.tokenHash).set(record);
}

export async function getMagicLinkRecord(tokenHash: string): Promise<MagicLinkRecord | null> {
  const db = getDatabase();
  const snap = await db.collection('magicLinkTokens').doc(tokenHash).get();
  if (snap.exists) return snap.data() as MagicLinkRecord;
  return null;
}

export async function updateMagicLinkRecord(tokenHash: string, updates: Partial<MagicLinkRecord>): Promise<void> {
  const db = getDatabase();
  await db.collection('magicLinkTokens').doc(tokenHash).update(updates);
}

/**
 * 학부모 세션 저장/조회
 */
export async function saveParentSession(session: ParentSessionRecord): Promise<void> {
  const db = getDatabase();
  await db.collection('parentSessions').doc(session.sessionHash).set(session);
}

export async function getParentSession(sessionHash: string): Promise<ParentSessionRecord | null> {
  const db = getDatabase();
  const snap = await db.collection('parentSessions').doc(sessionHash).get();
  if (snap.exists) {
    const data = snap.data() as ParentSessionRecord;
    if (new Date(data.expiresAt) > new Date()) return data;
  }
  return null;
}

/**
 * DTO Converters
 */
export function toStudentDTO(report: StoredLessonReport): StudentLessonReportDTO {
  const publicReportId = 'rep_' + crypto.createHash('md5').update(report.notionPageId).digest('hex').slice(0, 12);
  return {
    reportId: publicReportId,
    lessonDate: report.lessonDateStart,
    category: report.category,
    vocabularyScore: report.vocabularyScore,
    schoolExamScore: report.schoolExamScore,
  };
}

export function toParentDTO(report: StoredLessonReport): ParentLessonReportDTO {
  const publicReportId = 'prep_' + crypto.createHash('md5').update(report.notionPageId).digest('hex').slice(0, 12);
  return {
    reportId: publicReportId,
    lessonDateStart: report.lessonDateStart,
    lessonDateEnd: report.lessonDateEnd,
    lessonTime: report.lessonTime,
    selfStudyTime: report.selfStudyTime,
    category: report.category,
    attendance: report.attendance,
    attitude: report.attitude,
    homework: report.homework,
    test: report.test,
    vocabularyScore: report.vocabularyScore,
    schoolExamScore: report.schoolExamScore,
    feedback: report.feedback,
  };
}
