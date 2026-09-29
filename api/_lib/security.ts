import crypto from 'crypto';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function hashPin(last4Digits: string): string {
  const pepper = process.env.PHONE_PIN_PEPPER;
  if (!pepper) {
    throw new Error('CONFIG_ERROR: PHONE_PIN_PEPPER is missing.');
  }
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
