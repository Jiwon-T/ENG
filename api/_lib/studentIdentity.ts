import type { Firestore } from 'firebase-admin/firestore';
import type { StoredNotionStudentMapping } from './reportSchemas.js';
import { generateInternalStudentId, hashStudentKey } from './security.js';
import { normalizeNotionPageId, isNotionPageId } from './notionPageId.js';
import { lookupStudentByPageId } from './notion.js';
import {coreActive,coreStudentIdentity} from './academyCore.js';

/** Read-only bridge for previously linked accounts. Never claims an account. */
export async function readStudentMapping(db: Firestore, key: string): Promise<StoredNotionStudentMapping | null> {
  const storedKey = isNotionPageId(key) ? normalizeNotionPageId(key) : key;
  let old = await db.collection('notionStudentMappings').doc(hashStudentKey(storedKey)).get();
  if (!old.exists && storedKey !== key) old = await db.collection('notionStudentMappings').doc(hashStudentKey(key)).get();
  if (!old.exists) return null;
  const mapping = old.data() as StoredNotionStudentMapping;
  const canonicalKey = normalizeNotionPageId(mapping.notionStudentPageId);
  if (storedKey === canonicalKey) return mapping;
  const canonical = await db.collection('notionStudentMappings').doc(hashStudentKey(canonicalKey)).get();
  return canonical.exists ? canonical.data() as StoredNotionStudentMapping : mapping;
}

/** Legacy keys are resolved only through saved server mappings, never by a student name. */
export async function resolveStudentPageId(db: Firestore, key: string): Promise<string> {
  if (isNotionPageId(key)) return normalizeNotionPageId(key);
  const mapping = await readStudentMapping(db, key);
  if (!mapping) throw new Error('STUDENT_NOT_FOUND');
  return normalizeNotionPageId(mapping.notionStudentPageId);
}

export async function lookupStudentIdentity(db: Firestore, key: string, requireGuardianContact = true) {
  if(await coreActive(db,{academyId:'main'}))return coreStudentIdentity(db,await resolveStudentPageId(db,key),requireGuardianContact);
  return lookupStudentByPageId(await resolveStudentPageId(db, key), '', requireGuardianContact);
}

/**
 * Move only the index, retaining the existing internalStudentId, links and ownership.
 * Old index documents remain as read aliases for rollout; no reports are rewritten.
 * Called only by admin endpoints or the authenticated Make webhook.
 */
export async function migrateStudentMapping(db: Firestore, pageId: string, displayName: string): Promise<StoredNotionStudentMapping> {
  const studentKey = normalizeNotionPageId(pageId);
  const collection = db.collection('notionStudentMappings');
  const canonicalRef = collection.doc(hashStudentKey(studentKey));
  const legacyQuery = collection.where('notionStudentPageId', 'in', [studentKey, studentKey.replace(/-/g, '')]);
  return db.runTransaction(async t => {
    const canonical = await t.get(canonicalRef);
    const legacy = await t.get(legacyQuery);
    const documents = legacy.docs.filter(doc => doc.id !== canonicalRef.id);
    const records = [ ...(canonical.exists ? [canonical.data() as StoredNotionStudentMapping] : []),
      ...documents.map(doc => doc.data() as StoredNotionStudentMapping) ];
    for (const record of records) {
      if (normalizeNotionPageId(record.notionStudentPageId) !== studentKey) throw new Error('STUDENT_ID_MISMATCH');
    }
    const internalIds = new Set(records.map(record => record.internalStudentId));
    // Once migrated, canonical ownership is authoritative. Legacy aliases may be stale
    // after an explicit unlink and must never restore the former owner.
    const ownerRecords = canonical.exists ? [canonical.data() as StoredNotionStudentMapping] : records;
    const owners = new Set(ownerRecords.map(record => record.firebaseUid).filter(Boolean));
    if (internalIds.size > 1 || owners.size > 1) throw new Error('STUDENT_MAPPING_CONFLICT');
    const firebaseUid = [...owners][0] || null;
    const userRef = firebaseUid ? db.collection('users').doc(firebaseUid) : null;
    const user = userRef ? await t.get(userRef) : null;
    const now = new Date().toISOString();
    const existing = canonical.exists ? canonical.data() as StoredNotionStudentMapping
      : records.find(record => record.firebaseUid) || records[0];
    const internalStudentId = existing?.internalStudentId || generateInternalStudentId(studentKey);
    const slugDocuments = await t.get(db.collection('reportSlugs').where('internalStudentId', '==', internalStudentId));
    const reportMappingRef = db.collection('studentReportMappings').doc(internalStudentId);
    const reportMapping = await t.get(reportMappingRef);
    const mapping: StoredNotionStudentMapping = {
      ...existing,
      studentKey,
      notionStudentPageId: studentKey,
      studentDisplayName: displayName,
      internalStudentId,
      firebaseUid,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    t.set(canonicalRef, mapping, { merge: true });
    // Keep the URL, PIN, lock counters and authVersion unchanged.
    for (const slug of slugDocuments.docs) {
      t.update(slug.ref, { studentKey, studentDisplayName: displayName, updatedAt: now });
    }
    if (reportMapping.exists) t.update(reportMappingRef, { studentKey, updatedAt: now });
    // Preserve only a previously verified two-way link, never infer one from a name.
    const currentKey = user?.data()?.notionStudentKey;
    if (user?.exists && currentKey && (currentKey === studentKey || documents.some(doc => doc.id === hashStudentKey(currentKey)))) {
      t.update(userRef!, { notionStudentKey: studentKey, updatedAt: now });
    }
    return mapping;
  });
}
