import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson, setCookie } from '../_lib/http.ts';
import { VerifyPinSchema, type StoredReportSlug } from '../_lib/reportSchemas.ts';
import { hashPin, timingSafeCompare } from '../_lib/security.ts';
import { createParentSession } from '../_lib/session.ts';
import { getFirebaseAdmin } from '../_lib/firebaseAdmin.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  try {
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
    const snap = await docRef.get();

    // 존재하지 않거나 비활성화된 경우 정보 노출 최소화
    if (!snap.exists) {
      return sendJson(res, 404, { ok: false, error: 'INVALID_OR_INACTIVE_REPORT' });
    }

    const record = snap.data() as StoredReportSlug;
    if (!record.active) {
      return sendJson(res, 403, { ok: false, error: 'REPORT_DEACTIVATED' });
    }

    // 5회 잠금 시간 확인
    if (record.lockedUntil && new Date(record.lockedUntil) > new Date()) {
      return sendJson(res, 429, {
        ok: false,
        error: 'TEMPORARILY_LOCKED',
        message: '보안을 위해 15분간 조회가 잠금되었습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    // PIN HMAC 비교 (Timing-safe comparison)
    const inputPinHash = hashPin(pin);
    const isMatch = timingSafeCompare(inputPinHash, record.parentPhonePinHash);

    if (!isMatch) {
      const failedAttempts = (record.failedAttempts || 0) + 1;
      const updates: any = { failedAttempts };

      if (failedAttempts >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }

      await docRef.update(updates);

      return sendJson(res, 401, {
        ok: false,
        error: 'INCORRECT_PIN',
        remainingAttempts: Math.max(0, 5 - failedAttempts),
        message: '보호자 전화번호 뒷자리가 일치하지 않습니다.',
      });
    }

    // 인증 성공 시 실패 카운트 리셋
    await docRef.update({ failedAttempts: 0, lockedUntil: null });

    // 암호학적 난수 세션 생성 (해시는 Firestore에 저장)
    const { rawSessionToken } = await createParentSession({
      reportSlug: record.reportSlug,
      studentId: record.studentId,
      studentKey: record.studentKey,
    });

    // 브라우저에 안전한 HttpOnly/Secure 쿠키 전송
    setCookie(res, 'parent_session', rawSessionToken, {
      maxAgeSeconds: 86400,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
    });

    return sendJson(res, 200, {
      ok: true,
      reportSlug,
      studentDisplayName: record.studentKey,
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      ok: false,
      error: 'SERVER_ERROR',
      message: err.message?.startsWith('CONFIG_ERROR') ? err.message : 'Internal Server Error',
    });
  }
}
