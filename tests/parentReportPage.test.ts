import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeReportCursor, decodeReportCursor, loadParentReportPage } from '../api/_lib/parentReportPage.js';

test('pagination cursor is opaque, student-bound and tamper resistant', () => {
  process.env.PARENT_SESSION_SECRET = 'test-session-secret-at-least-thirty-two-characters';
  const token = encodeReportCursor('student-a', '2026-10-01T05:00:00Z', 'private-notion-id');
  assert.ok(!Buffer.from(token, 'base64url').toString().includes('private-notion-id'));
  assert.deepEqual(decodeReportCursor(token, 'student-a'), { date: '2026-10-01T05:00:00Z', id: 'private-notion-id' });
  assert.throws(() => decodeReportCursor(token, 'student-b'), /INVALID_REPORT_CURSOR/);
  assert.throws(() => decodeReportCursor('broken', 'student-a'), /INVALID_REPORT_CURSOR/);
});
test('page uses bounded queries and same-date document tie breaker, returning only safe DTOs', async () => {
  process.env.PARENT_SESSION_SECRET = 'test-session-secret-at-least-thirty-two-characters';
  let limit = 0;
  let start: unknown[] = [];
  const docs = Array.from({ length: 11 }, (_, i) => ({ id: `private-${i}`, data: () => ({ notionPageId: `private-${i}`, lessonDateStart: '2026-10-01T05:00:00Z', internalStudentId: 'student-a' }) }));
  const query: any = { where(field: string, op: string, value: string) { assert.equal(value, 'student-a'); return this; }, orderBy() { return this; }, startAfter(...values: unknown[]) { start = values; return this; }, limit(value: number) { limit = value; return this; }, async get() { return { docs }; } };
  const db: any = { collection() { return query; } };
  const page = await loadParentReportPage(db, 'student-a');
  assert.equal(limit, 11);
  assert.equal(page.reports.length, 10);
  assert.ok(page.nextCursor);
  assert.ok(!JSON.stringify(page).includes('private-'));
  await loadParentReportPage(db, 'student-a', page.nextCursor);
  assert.deepEqual(start, ['2026-10-01T05:00:00Z', 'private-9']);
  docs.splice(2);
  assert.equal((await loadParentReportPage(db, 'student-a')).nextCursor, null);
});
