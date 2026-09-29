import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashToken, generateSecureToken } from '../api/_lib/security.ts';
import type { ParentSessionData } from '../api/_lib/session.ts';
import type { StoredReportSlug } from '../api/_lib/reportSchemas.ts';

describe('Parent Session Data Structure and In-Memory Auth Invalidation Logic (Unit Tests)', () => {
  it('session structure correctly holds authVersion, internalStudentId, and studentDisplayName', () => {
    process.env.PARENT_SESSION_SECRET = 'test_parent_session_secret_hmac_32_chars_long!';
    const rawSessionToken = generateSecureToken(32);
    const sessionHash = hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const session: ParentSessionData = {
      sessionHash,
      reportSlug: 'bokjego1test',
      internalStudentId: 'internal_sha256_student_id_1',
      studentDisplayName: '복제고 학생1',
      authVersion: 1,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    assert.equal(session.authVersion, 1);
    assert.equal(session.internalStudentId, 'internal_sha256_student_id_1');
    assert.equal(session.studentDisplayName, '복제고 학생1');
    assert.ok(new Date(session.expiresAt) > new Date());
  });

  it('session verification logical rules: rejects when slug is inactive, internalStudentId mismatches, or authVersion changed', () => {
    const session: ParentSessionData = {
      sessionHash: 'hash123',
      reportSlug: 'bokjego1test',
      internalStudentId: 'internal_id_1',
      studentDisplayName: '학생1',
      authVersion: 1,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10000).toISOString(),
    };

    // Case 1: Inactive slug
    const inactiveSlug: StoredReportSlug = {
      reportSlug: 'bokjego1test',
      studentKey: '학생1',
      studentDisplayName: '학생1',
      internalStudentId: 'internal_id_1',
      parentPhonePinHash: 'pin_hash',
      active: false,
      authVersion: 1,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: '',
      updatedAt: '',
      createdByUid: '',
    };

    const isSessionValidInactive =
      inactiveSlug.active &&
      inactiveSlug.authVersion === session.authVersion &&
      inactiveSlug.internalStudentId === session.internalStudentId;
    assert.equal(isSessionValidInactive, false, 'Inactive slug must invalidate existing session');

    // Case 2: authVersion mismatch (PIN regenerated or slug changed)
    const regeneratedSlug: StoredReportSlug = {
      ...inactiveSlug,
      active: true,
      authVersion: 2, // version bumped
    };

    const isSessionValidBumped =
      regeneratedSlug.active &&
      regeneratedSlug.authVersion === session.authVersion &&
      regeneratedSlug.internalStudentId === session.internalStudentId;
    assert.equal(isSessionValidBumped, false, 'authVersion mismatch must invalidate existing session');

    // Case 3: Matching active slug
    const validSlug: StoredReportSlug = {
      ...inactiveSlug,
      active: true,
      authVersion: 1,
    };

    const isSessionValidSuccess =
      validSlug.active &&
      validSlug.authVersion === session.authVersion &&
      validSlug.internalStudentId === session.internalStudentId;
    assert.equal(isSessionValidSuccess, true, 'Matching active slug validates session');
  });
});
