import test from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from 'firebase-admin/firestore';
import { migrateStudentMapping, readStudentMapping, resolveStudentPageId } from '../api/_lib/studentIdentity.ts';
import { normalizeNotionPageId } from '../api/_lib/notionPageId.ts';
import { hashStudentKey } from '../api/_lib/security.ts';

const pageId = '3e90d0f1-c79a-8105-94c4-ff6f31f73223';
const dbId = 'e2b0d0f1-c79a-8262-a208-8116c9201cfc';
const legacyKey = '이름 (학교고1)';

// Transaction mock stages writes and commits only after successful validation.
function fakeDb(initial: Record<string, any>) {
  const records = new Map(Object.entries(structuredClone(initial)));
  const snapshot = (path: string) => ({ id: path.split('/').at(-1), ref: { path }, exists: records.has(path), data: () => records.get(path) });
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ path: `${name}/${id}`, id, get: async () => snapshot(`${name}/${id}`) }),
      where: (field: string, operator: string, values: string[]) => ({ name, field, operator, values }),
    }),
    runTransaction: async (callback: any) => {
      const writes: Array<[string, any]> = [];
      let writing = false;
      const result = await callback({
        get: async (ref: any) => {
          assert.equal(writing, false, 'all transaction reads must precede writes');
          if (ref.path) return snapshot(ref.path);
          return { docs: [...records].filter(([path, data]) => path.startsWith(`${ref.name}/`) && (ref.operator === 'in' ? ref.values.includes(data[ref.field]) : data[ref.field] === ref.values)).map(([path]) => snapshot(path)) };
        },
        set: (ref: any, data: any) => { writing = true; writes.push([ref.path, data]); },
        update: (ref: any, data: any) => { writing = true; writes.push([ref.path, data]); },
      });
      for (const [path, data] of writes) records.set(path, { ...records.get(path), ...data });
      return result;
    },
  } as unknown as Firestore;
  return { db, records };
}

function oldMapping(overrides = {}) {
  return { notionStudentPageId: pageId, studentKey: legacyKey, internalStudentId: 'existing-stable-id',
    studentDisplayName: legacyKey, firebaseUid: 'verified-account', linkedAt: 'original-link-date', createdAt: 'original-date', ...overrides };
}

test('migration preserves existing reports, parent URLs, completion ownership and explicit account link across renaming', async () => {
  const oldPath = `notionStudentMappings/${hashStudentKey(legacyKey)}`;
  const { db, records } = fakeDb({
    [oldPath]: oldMapping(),
    'users/verified-account': { notionStudentKey: legacyKey, role: 'student' },
    'reportSlugs/test': { internalStudentId: 'existing-stable-id', studentKey: legacyKey, active: true },
    'lessonReports/old-report': { internalStudentId: 'existing-stable-id' },
    'studentSchedules/old-schedule': { internalStudentId: 'existing-stable-id' },
  });
  const mapping = await migrateStudentMapping(db, pageId.replace(/-/g, '').toUpperCase(), '새 이름 (새학교고2)');
  assert.equal(mapping.internalStudentId, 'existing-stable-id');
  assert.equal(mapping.studentKey, pageId);
  assert.equal(mapping.linkedAt, 'original-link-date');
  assert.equal(records.get('users/verified-account').notionStudentKey, pageId);
  assert.equal(records.get('reportSlugs/test').active, true);
  assert.equal(records.get('reportSlugs/test').studentKey, pageId);
  assert.equal(records.get('lessonReports/old-report').internalStudentId, mapping.internalStudentId);
  assert.equal(records.get('studentSchedules/old-schedule').internalStudentId, mapping.internalStudentId);
  assert.equal(await resolveStudentPageId(db, legacyKey), pageId);
  assert.equal((await readStudentMapping(db, legacyKey))?.studentDisplayName, '새 이름 (새학교고2)');
});

test('legacy aliases cannot restore an explicitly unlinked Firebase account', async () => {
  const canonicalPath = `notionStudentMappings/${hashStudentKey(pageId)}`;
  const { db, records } = fakeDb({
    [`notionStudentMappings/${hashStudentKey(legacyKey)}`]: oldMapping(),
    [canonicalPath]: oldMapping({ studentKey: pageId, firebaseUid: null }),
    'users/verified-account': { notionStudentKey: null },
  });
  const mapping = await migrateStudentMapping(db, pageId, '이름 변경');
  assert.equal(mapping.firebaseUid, null);
  assert.equal((await readStudentMapping(db, legacyKey))?.firebaseUid, null);
  assert.equal(records.get('users/verified-account').notionStudentKey, null);
});

test('different page IDs remain different students even with identical display names', async () => {
  const { db } = fakeDb({});
  const first = await migrateStudentMapping(db, pageId, '동명이인');
  const second = await migrateStudentMapping(db, '3e90d0f1-c79a-8105-94c4-ff6f31f73224', '동명이인');
  assert.notEqual(first.studentKey, second.studentKey);
  assert.notEqual(first.internalStudentId, second.internalStudentId);
});

test('conflicting pre-migration account owners fail atomically instead of merging students', async () => {
  const { db, records } = fakeDb({
    [`notionStudentMappings/${hashStudentKey(legacyKey)}`]: oldMapping(),
    'notionStudentMappings/another-alias': oldMapping({ firebaseUid: 'another-account' }),
  });
  const before = JSON.stringify([...records]);
  await assert.rejects(migrateStudentMapping(db, pageId, '학생'), /STUDENT_MAPPING_CONFLICT/);
  assert.equal(JSON.stringify([...records]), before);
});

test('unknown name keys are never searched in Notion or bound automatically', async () => {
  const { db } = fakeDb({});
  await assert.rejects(resolveStudentPageId(db, '동명이인'), /STUDENT_NOT_FOUND/);
  assert.equal(await readStudentMapping(db, '동명이인'), null);
  assert.equal(normalizeNotionPageId(pageId.toUpperCase()), pageId);
});


