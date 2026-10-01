import type { Firestore } from 'firebase-admin/firestore';
import type { StoredNotionStudentMapping } from './reportSchemas.js';
import { isNotionPageId, normalizeNotionPageId } from './notionPageId.js';
import { hashStudentKey } from './security.js';

/** Admin directory reads existing mappings once; it never creates or migrates accounts. */
export async function readStudentDirectoryMappings(db: Firestore) {
  const snapshot = await db.collection('notionStudentMappings').get();
  const groups = new Map<string, { id: string; record: StoredNotionStudentMapping }[]>();
  for (const doc of snapshot.docs) {
    const record = doc.data() as StoredNotionStudentMapping;
    if (!isNotionPageId(record.notionStudentPageId)) continue;
    const key = normalizeNotionPageId(record.notionStudentPageId);
    groups.set(key, [...(groups.get(key) || []), { id: doc.id, record }]);
  }
  const mappings = new Map<string, StoredNotionStudentMapping>();
  for (const [key, entries] of groups) {
    const canonical = entries.find(entry => entry.id === hashStudentKey(key));
    // Explicit canonical unlink takes precedence over stale legacy owners.
    if (canonical) { mappings.set(key, canonical.record); continue; }
    const ids = new Set(entries.map(entry => entry.record.internalStudentId));
    const owners = new Set(entries.map(entry => entry.record.firebaseUid).filter(Boolean));
    if (ids.size > 1 || owners.size > 1) throw new Error('STUDENT_MAPPING_CONFLICT');
    mappings.set(key, (entries.find(entry => entry.record.firebaseUid) || entries[0]).record);
  }
  return mappings;
}
