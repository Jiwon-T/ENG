import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPin,
  timingSafeCompare,
  hashToken,
  generateSecureToken,
  generateInternalStudentId,
  hashStudentKey,
  getSecretOrThrow,
} from '../api/_lib/security.ts';

describe('Security Utility and Cryptographic Functions', () => {
  it('hashPin generates consistent HMAC-SHA256 hex with PHONE_PIN_PEPPER using random virtual PIN', () => {
    process.env.PHONE_PIN_PEPPER = 'test_pepper_key_minimum_32_characters_long_12345';
    // 개인정보와 무관한 가상 PIN (1111, 2222)
    const virtualPinA = '1111';
    const virtualPinB = '2222';
    const hashA1 = hashPin(virtualPinA);
    const hashA2 = hashPin(virtualPinA);
    const hashB = hashPin(virtualPinB);

    assert.equal(hashA1, hashA2);
    assert.notEqual(hashA1, hashB);
    assert.equal(hashA1.length, 64);
  });

  it('hashPin throws CONFIG_ERROR when PHONE_PIN_PEPPER is missing or shorter than 32 chars', () => {
    delete process.env.PHONE_PIN_PEPPER;
    assert.throws(() => hashPin('1111'), /CONFIG_ERROR/);

    process.env.PHONE_PIN_PEPPER = 'short_key';
    assert.throws(() => hashPin('1111'), /CONFIG_ERROR/);
  });

  it('hashToken generates HMAC-SHA256 using PARENT_SESSION_SECRET', () => {
    process.env.PARENT_SESSION_SECRET = 'test_session_secret_minimum_32_characters_long_abcdef';
    const raw = generateSecureToken(32);
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });

  it('hashToken throws CONFIG_ERROR when PARENT_SESSION_SECRET is missing or shorter than 32 chars (no weak fallback)', () => {
    delete process.env.PARENT_SESSION_SECRET;
    assert.throws(() => hashToken('sample_token'), /CONFIG_ERROR/);

    process.env.PARENT_SESSION_SECRET = 'too_short';
    assert.throws(() => hashToken('sample_token'), /CONFIG_ERROR/);
  });

  it('timingSafeCompare compares string safely without leaking length timing', () => {
    const a = 'abcdef0123456789abcdef0123456789';
    const b = 'abcdef0123456789abcdef0123456789';
    const c = 'abcdef0123456789abcdef0123456780';

    assert.equal(timingSafeCompare(a, b), true);
    assert.equal(timingSafeCompare(a, c), false);
    assert.equal(timingSafeCompare(a, 'short'), false);
  });

  it('generateInternalStudentId generates stable SHA-256 internal ID from Notion Page ID', () => {
    const notionPageId = '123e4567-e89b-12d3-a456-426614174000';
    const internalId1 = generateInternalStudentId(notionPageId);
    const internalId2 = generateInternalStudentId(notionPageId);

    assert.equal(internalId1, internalId2);
    assert.equal(internalId1.length, 64);
    assert.notEqual(internalId1, notionPageId);
  });

  it('hashStudentKey generates stable hash for server-only mapping', () => {
    const key = '학생1 (가상고1)';
    const hash1 = hashStudentKey(key);
    const hash2 = hashStudentKey(key);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
  });
});
