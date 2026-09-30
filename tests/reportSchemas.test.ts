import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RESERVED_SLUGS,
  isReservedSlug,
  CreateReportSlugSchema,
  PatchReportSlugSchema,
  DeleteReportSlugSchema,
  VerifyPinSchema,
  NotionReportWebhookSchema,
} from '../api/_lib/reportSchemas.ts';

describe('Report Schemas Validation Tests', () => {
  it('should identify all 33 reserved slugs', () => {
    assert.ok(isReservedSlug('api'));
    assert.ok(isReservedSlug('admin'));
    assert.ok(isReservedSlug('teacher'));
    assert.ok(isReservedSlug('student'));
    assert.ok(isReservedSlug('parent'));
    assert.ok(isReservedSlug('report'));
    assert.ok(isReservedSlug('reports'));
    assert.ok(isReservedSlug('login'));
    assert.ok(isReservedSlug('logout'));
    assert.ok(isReservedSlug('vocab'));
    assert.ok(isReservedSlug('teacher-room'));
    assert.ok(isReservedSlug('pet'));
    assert.ok(isReservedSlug('sw'));
    assert.ok(isReservedSlug('icon'));
    assert.equal(isReservedSlug('bokjego1test'), false);
    assert.equal(isReservedSlug('student99'), false);
  });

  it('CreateReportSlugSchema rejects reserved slugs strictly', () => {
    const invalid = CreateReportSlugSchema.safeParse({
      reportSlug: 'admin',
      studentKey: '학생1',
    });
    assert.equal(invalid.success, false);

    const valid = CreateReportSlugSchema.safeParse({
      reportSlug: 'bokjego1test',
      studentKey: '학생1',
    });
    assert.equal(valid.success, true);
  });

  it('CreateReportSlugSchema rejects invalid regex (spaces, uppercase, symbols)', () => {
    assert.equal(CreateReportSlugSchema.safeParse({ reportSlug: 'BokjeGo1', studentKey: '학생' }).success, false);
    assert.equal(CreateReportSlugSchema.safeParse({ reportSlug: 'bokje go', studentKey: '학생' }).success, false);
    assert.equal(CreateReportSlugSchema.safeParse({ reportSlug: 'ab', studentKey: '학생' }).success, false);
    assert.equal(CreateReportSlugSchema.safeParse({ reportSlug: 'a'.repeat(31), studentKey: '학생' }).success, false);
  });

  it('PatchReportSlugSchema requires newReportSlug when updating slug', () => {
    const valid = PatchReportSlugSchema.safeParse({
      reportSlug: 'bokjego1test',
      newReportSlug: 'bokjego1new',
    });
    assert.equal(valid.success, true);

    const reservedNew = PatchReportSlugSchema.safeParse({
      reportSlug: 'bokjego1test',
      newReportSlug: 'settings',
    });
    assert.equal(reservedNew.success, false);
  });

  it('VerifyPinSchema enforces exact 4 digits', () => {
    assert.ok(VerifyPinSchema.safeParse({ reportSlug: 'bokjego1test', pin: '1234' }).success);
    assert.equal(VerifyPinSchema.safeParse({ reportSlug: 'bokjego1test', pin: '123' }).success, false);
    assert.equal(VerifyPinSchema.safeParse({ reportSlug: 'bokjego1test', pin: '12345' }).success, false);
    assert.equal(VerifyPinSchema.safeParse({ reportSlug: 'bokjego1test', pin: 'abcd' }).success, false);
  });

  it('NotionReportWebhookSchema handles null scores and optional sourceUpdatedAt', () => {
    const parsed = NotionReportWebhookSchema.parse({
      notionPageId: 'page_123',
      notionStudentPageId: 'student_page_123',
      studentKey: '홍길동',
      lessonDateStart: '2026-09-28',
      category: '수업',
      sourceUpdatedAt: '2026-09-28T10:00:00.000Z',
    });
    assert.equal(parsed.vocabularyScore, null);
    assert.equal(parsed.schoolExamScore, null);
    assert.equal(parsed.sourceUpdatedAt, '2026-09-28T10:00:00.000Z');
  });
});
