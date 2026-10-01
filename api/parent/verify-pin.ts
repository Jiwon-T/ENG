import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson, setCookie } from '../_lib/http.js';
import { VerifyPinSchema, type StoredReportSlug } from '../_lib/reportSchemas.js';
import { hashPin, timingSafeCompare } from '../_lib/security.js';
import { lookupStudentIdentity } from '../_lib/studentIdentity.js';
import { createParentSession } from '../_lib/session.js';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    }

    const rawBody = await parseJsonBody(req);
    const parsed = VerifyPinSchema.safeParse(rawBody);

    if (!parsed.success) {
      return sendJson(res, 400, {
        ok: false,
        error: 'INVALID_INPUT',
        details: parsed.error.issues.map(i => i.message),
      });
    }

    const { reportSlug, pin } = parsed.data;
    const { db } = getFirebaseAdmin();
    const docRef = db.collection('reportSlugs').doc(reportSlug);

    let verifyOutcome: {
      status: 'success' | 'incorrect' | 'locked' | 'inactive' | 'not_found';
      remainingAttempts?: number;
      studentDisplayName?: string;
      studentKey?: string;
      internalStudentId?: string;
      authVersion?: number;
    };

    // Firestore Transaction으로 동시성 및 잠금 상태 원자적 보호
    verifyOutcome = await db.runTransaction(async (t) => {
      const snap = await t.get(docRef);
      if (!snap.exists) {
        return { status: 'not_found' };
      }

      const record = snap.data() as StoredReportSlug;
      if (!record.active) {
        return { status: 'inactive' };
      }

      // 15분 잠금 확인
      if (record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
        return { status: 'locked' };
      }

      const inputPinHash = hashPin(pin);
      const isMatch = timingSafeCompare(inputPinHash, record.parentPhonePinHash);

      if (!isMatch) {
        const failedAttempts = (record.failedAttempts || 0) + 1;
        const updates: any = { failedAttempts };
        if (failedAttempts >= 5) {
          updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        t.update(docRef, updates);
        return {
          status: 'incorrect',
          remainingAttempts: Math.max(0, 5 - failedAttempts),
        };
      }

      // 성공 시 실패 카운트 리셋
      t.update(docRef, { failedAttempts: 0, lockedUntil: null });
      return {
        status: 'success',
        studentKey: record.studentKey,
        studentDisplayName: record.studentDisplayName || record.studentKey,
        internalStudentId: record.internalStudentId,
        authVersion: record.authVersion || 1,
      };
    });

    if (verifyOutcome.status === 'not_found' || verifyOutcome.status === 'inactive') {
      return sendJson(res, 404, { ok: false, error: 'INVALID_OR_INACTIVE_REPORT' });
    }

    if (verifyOutcome.status === 'locked') {
      return sendJson(res, 429, {
        ok: false,
        error: 'TEMPORARILY_LOCKED',
        message: '보안을 위해 15분간 조회가 잠금되었습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    if (verifyOutcome.status === 'incorrect') {
      return sendJson(res, 401, {
        ok: false,
        error: 'INCORRECT_PIN',
        remainingAttempts: verifyOutcome.remainingAttempts,
        message: '보호자 전화번호 뒷자리가 일치하지 않습니다.',
      });
    }

    // 이미 발급한 링크도 현재 Notion 제목을 사용합니다.
    const currentStudent = await lookupStudentIdentity(db, verifyOutcome.studentKey!);
    verifyOutcome.studentDisplayName = currentStudent.studentDisplayName;

    // 성공 시 authVersion과 internalStudentId를 포함하여 페이지 전용 세션 생성
    const { rawSessionToken } = await createParentSession({
      reportSlug,
      internalStudentId: verifyOutcome.internalStudentId!,
      studentDisplayName: verifyOutcome.studentDisplayName!,
      authVersion: verifyOutcome.authVersion || 1,
    });

    setCookie(res, 'parent_session', '', {
      maxAgeSeconds: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    });

    // 내부 studentKey는 절대 노출하지 않고 학부모 화면 표시용 studentDisplayName만 전달
    return sendJson(res, 200, {
      ok: true,
      sessionToken: rawSessionToken,
      reportSlug,
      studentDisplayName: verifyOutcome.studentDisplayName,
    });
  } catch (err: any) {
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}
