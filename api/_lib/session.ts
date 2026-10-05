import { getFirebaseAdmin } from './firebaseAdmin.js';
import { hashToken, generateSecureToken } from './security.js';
import type { StoredReportSlug } from './reportSchemas.js';

export interface ParentSessionData {
  sessionHash: string;
  authenticationMode?: 'page-pin-v1';
  reportSlug: string;
  internalStudentId: string;
  studentDisplayName: string;
  authVersion: number;
  createdAt: string;
  expiresAt: string;
}

export async function createParentSession(params: {
  reportSlug: string;
  internalStudentId: string;
  studentDisplayName: string;
  authVersion: number;
}): Promise<{ rawSessionToken: string; expiresAt: string }> {
  const { db } = getFirebaseAdmin();
  const rawSessionToken = generateSecureToken(32);
  const sessionHash = hashToken(rawSessionToken);

  // 페이지 메모리에서만 사용되는 30분 PIN 인증 세션
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const sessionData: ParentSessionData = {
    sessionHash,
    authenticationMode: 'page-pin-v1',
    reportSlug: params.reportSlug,
    internalStudentId: params.internalStudentId,
    studentDisplayName: params.studentDisplayName,
    authVersion: params.authVersion,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  await db.collection('parentSessions').doc(sessionHash).set(sessionData);

  return { rawSessionToken, expiresAt };
}

/**
 * 학부모 세션 유효성 종합 검증:
 * 1. 세션 만료 시간 검증
 * 2. 현재 reportSlugs/{slug} 문서 재조회
 * 3. active == true 검증 (비활성화 즉시 차단)
 * 4. internalStudentId 일치 검증
 * 5. authVersion 일치 검증 (PIN/링크 갱신 시 기존 세션 즉시 무효화)
 */
export async function getVerifiedParentSession(rawSessionToken: string, adminProvider = getFirebaseAdmin): Promise<ParentSessionData | null> {
  if (!rawSessionToken) return null;

  const { db } = adminProvider();
  const sessionHash = hashToken(rawSessionToken);

  const doc = await db.collection('parentSessions').doc(sessionHash).get();
  if (!doc.exists) return null;

  const session = doc.data() as ParentSessionData;
  const expiresAt = Date.parse(session.expiresAt);
  if (session.authenticationMode !== 'page-pin-v1' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  // 연결된 reportSlug 문서의 최신 상태 검증
  const slugDoc = await db.collection('reportSlugs').doc(session.reportSlug).get();
  if (!slugDoc.exists) return null;

  const slugData = slugDoc.data() as StoredReportSlug;
  if (!slugData.active) {
    return null;
  }

  if (slugData.internalStudentId !== session.internalStudentId) {
    return null;
  }

  // authVersion 검증 (불일치 시 즉시 무효화)
  if (slugData.authVersion !== session.authVersion) {
    return null;
  }

  return session;
}
