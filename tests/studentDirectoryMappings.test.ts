import test from 'node:test';
import assert from 'node:assert/strict';
import { readStudentDirectoryMappings } from '../api/_lib/studentDirectoryMappings.js';
import { hashStudentKey } from '../api/_lib/security.js';
const key = '3e90d0f1-c79a-8105-94c4-ff6f31f73223';
function fake(records: { id: string; record: any }[]) {
  let reads = 0;
  return { db: { collection: () => ({ get: async () => { reads++; return { docs: records.map(entry => ({ id: entry.id, data: () => entry.record })) }; } }), runTransaction: () => { throw new Error('Directory must not transact'); } } as any, reads: () => reads };
}
test('directory reads legacy mappings without writing or changing identity', async () => {
  const stored = { notionStudentPageId: key.replaceAll('-', ''), internalStudentId: 'existing-id', firebaseUid: 'existing-uid' };
  const source = fake([{ id: 'legacy-index', record: stored }]);
  const result = await readStudentDirectoryMappings(source.db);
  assert.equal(result.get(key), stored);
  assert.equal(source.reads(), 1);
});
test('canonical explicit unlink overrides stale legacy owner', async () => {
  const canonical = { notionStudentPageId: key, internalStudentId: 'existing-id', firebaseUid: null };
  const source = fake([{ id: 'legacy', record: { ...canonical, firebaseUid: 'stale' } }, { id: hashStudentKey(key), record: canonical }]);
  assert.equal((await readStudentDirectoryMappings(source.db)).get(key)?.firebaseUid, null);
});
test('conflicting legacy owners are not arbitrarily connected', async () => {
  const source = fake(['a', 'b'].map(uid => ({ id: uid, record: { notionStudentPageId: key, internalStudentId: 'same', firebaseUid: uid } })));
  await assert.rejects(readStudentDirectoryMappings(source.db), /STUDENT_MAPPING_CONFLICT/);
});
test('empty directory does not create placeholder mappings', async () => {
  assert.equal((await readStudentDirectoryMappings(fake([]).db)).size, 0);
});
