import type { StoredNotionStudentMapping } from './reportSchemas.js';
import { lookupStudentIdentity, migrateStudentMapping } from './studentIdentity.js';
import { hashStudentKey } from './security.js';
import { normalizeNotionPageId } from './notionPageId.js';
/**
 * Link one student app account to one registered student — the same steps the admin endpoint
 * (/api/teacher/student-link POST) has always run, moved here so a student link code uses them unchanged.
 * Throws USER_NOT_FOUND, INVALID_ROLE, STUDENT_NOT_FOUND, MULTIPLE_STUDENTS_MATCHED,
 * NOTION_STUDENT_ALREADY_LINKED_TO_ANOTHER_ACCOUNT.
 */
export async function linkStudentAccount(db: any, input: { firebaseUid: string; studentKey: string; linkedByUid: string }) {
    const { firebaseUid, linkedByUid } = input;
    // 1) The account must exist and be a student.
    const userRef = db.collection('users').doc(firebaseUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error('USER_NOT_FOUND');
    if (userSnap.data()?.role !== 'student') throw new Error('INVALID_ROLE');
    // 2) Exactly one registered student.
    const notionLookup = await lookupStudentIdentity(db, input.studentKey, false);
    const existingIdentity = await migrateStudentMapping(db, notionLookup.notionStudentPageId, notionLookup.studentDisplayName);
    const studentKey = existingIdentity.studentKey;
    const internalStudentId = existingIdentity.internalStudentId;
    const mappingRef = db.collection('notionStudentMappings').doc(hashStudentKey(studentKey));
    const now = new Date().toISOString();
    // 3) Conflict checks and both documents updated in one transaction.
    await db.runTransaction(async (t: any) => {
        const mappingSnap = await t.get(mappingRef);
        const currentUserSnap = await t.get(userRef);
        if (!currentUserSnap.exists) throw new Error('USER_NOT_FOUND');
        // This account was linked to another student before: release that link.
        const currentData = currentUserSnap.data();
        if (currentData?.notionStudentKey && currentData.notionStudentKey !== studentKey) {
            let prevMappingRef = db.collection('notionStudentMappings').doc(hashStudentKey(currentData.notionStudentKey));
            let prevMappingSnap = await t.get(prevMappingRef);
            if (prevMappingSnap.exists && prevMappingSnap.data()?.notionStudentPageId) {
                const canonicalRef = db.collection('notionStudentMappings').doc(hashStudentKey(normalizeNotionPageId(prevMappingSnap.data()!.notionStudentPageId)));
                const canonicalSnap = await t.get(canonicalRef);
                if (canonicalSnap.exists) { prevMappingRef = canonicalRef; prevMappingSnap = canonicalSnap; }
            }
            if (prevMappingSnap.exists && prevMappingSnap.data()?.firebaseUid === firebaseUid) t.update(prevMappingRef, { firebaseUid: null, updatedAt: now });
        }
        if (mappingSnap.exists) {
            const mappingData = mappingSnap.data() as StoredNotionStudentMapping;
            // The student is already linked to a different account.
            if (mappingData.firebaseUid && mappingData.firebaseUid !== firebaseUid) throw new Error('NOTION_STUDENT_ALREADY_LINKED_TO_ANOTHER_ACCOUNT');
            t.update(mappingRef, { firebaseUid, linkedByAdminUid: linkedByUid, linkedAt: now, updatedAt: now });
        } else {
            const newMapping: StoredNotionStudentMapping = { internalStudentId, studentKey, studentDisplayName: notionLookup.studentDisplayName, notionStudentPageId: notionLookup.notionStudentPageId, firebaseUid, linkedByAdminUid: linkedByUid, linkedAt: now, createdAt: now, updatedAt: now };
            t.set(mappingRef, newMapping);
        }
        t.update(userRef, { notionStudentKey: studentKey, updatedAt: now });
    });
    return { firebaseUid, studentKey, studentDisplayName: notionLookup.studentDisplayName, linkedAt: now };
}
