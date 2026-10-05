import { createHash } from 'node:crypto';
import type { NotionStudentListItem } from './notion.js';
import { teacherReadKey } from './teacherReadCache.js';

// Display metadata only. Never used to grant access; no phone/PIN data.
function snapshotRef(db:any, actor:any) {
    const key=teacherReadKey(actor,'student-directory:'+process.env.NOTION_STUDENT_DATABASE_ID);
    return db.collection('teacherStudentSnapshots').doc(createHash('sha256').update(key).digest('hex'));
}
export async function readTeacherStudentSnapshot(db:any, actor:any):Promise<NotionStudentListItem[]|null> {
    try {
        const saved=(await snapshotRef(db,actor).get()).data();
        if(!Array.isArray(saved?.students)||!Number.isFinite(saved.updatedAt)||Date.now()-saved.updatedAt>300_000)return null;
        return saved.students.filter((s:any)=>actor.admin||actor.scopes.some((scope:any)=>scope.studentKey===s.studentKey));
    } catch { return null; }
}
export async function saveTeacherStudentSnapshot(db:any, actor:any, students:NotionStudentListItem[]) {
    const visible=students.filter(s=>actor.admin||actor.scopes.some((scope:any)=>scope.studentKey===s.studentKey));
    try {
        await snapshotRef(db,actor).set({updatedAt:Date.now(),students:visible.map(s=>({
            studentKey:s.studentKey,studentDisplayName:s.studentDisplayName,
            hasGuardianContact:s.hasGuardianContact,enrollmentStatus:s.enrollmentStatus,
        }))});
    } catch { console.warn('Teacher display snapshot could not be saved'); }
}
