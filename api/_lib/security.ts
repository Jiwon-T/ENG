import crypto from 'crypto';

export function getSecretOrThrow(envName: string, minLength = 32): string {
  const value = process.env[envName];
  if (!value || typeof value !== 'string' || value.trim().length < minLength) {
    throw new Error(
      `CONFIG_ERROR: Required secret environment variable ${envName} is missing or shorter than ${minLength} characters.`
    );
  }
  return value.trim();
}

export function hashToken(token: string): string {
  const secret = getSecretOrThrow('PARENT_SESSION_SECRET', 32);
  return crypto.createHmac('sha256', secret).update(token.trim()).digest('hex');
}

export function hashPin(last4Digits: string): string {
  const pepper = getSecretOrThrow('PHONE_PIN_PEPPER', 32);
  return crypto.createHmac('sha256', pepper).update(last4Digits.trim()).digest('hex');
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Notion 학생 페이지 ID로부터 안정적인 16진수 SHA-256 내부 학생 식별자 생성
 * 클라이언트에 Notion 페이지 ID 원본을 노출하지 않습니다.
 */
export function generateInternalStudentId(notionStudentPageId: string): string {
  if (!notionStudentPageId || typeof notionStudentPageId !== 'string') {
    throw new Error('INVALID_NOTION_PAGE_ID');
  }
  return crypto.createHash('sha256').update(notionStudentPageId.trim().toLowerCase()).digest('hex');
}

/**
 * studentKey 정규화 해시값 (서버 전용 매핑 키)
 */
export function hashStudentKey(studentKey: string): string {
  if (!studentKey || typeof studentKey !== 'string') {
    throw new Error('INVALID_STUDENT_KEY');
  }
  return crypto.createHash('sha256').update(studentKey.trim()).digest('hex');
}
