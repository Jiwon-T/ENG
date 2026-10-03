import type { Firestore } from 'firebase-admin/firestore';
import { readStudentMapping } from './studentIdentity.js';
import { loadAcademicData } from './academic.js';
import { studentLessonDTO, parentLessonDTO, reportScheduleDTO } from './reportAudienceDTO.js';
import type { StoredLessonReport, StoredStudentSchedule } from './reportSchemas.js';
export function reviewSubjects(actor: {
    admin: boolean;
    scopes: {
        studentKey: string;
        subject: string;
    }[];
}, studentKey: string) {
    if (actor.admin)
        return null;
    const allowed = new Set(actor.scopes.filter(s => s.studentKey === studentKey).map(s => s.subject));
    if (!allowed.size)
        throw new Error('FORBIDDEN');
    return allowed;
}
export async function loadTeacherReportReview(db: Firestore, actor: any, studentKey: string, audience: 'parent' | 'student', deps = { readStudentMapping, loadAcademicData }) {
    const allowed = reviewSubjects(actor, studentKey);
    const mapping = await deps.readStudentMapping(db, studentKey);
    if (!mapping?.internalStudentId)
        return { reports: [], schedules: [], academic: { records: [], subjects: [], academyScores: [] }, studentLinked: false, parentUrl: null, linked: false };
    const internalStudentId = mapping.internalStudentId;
    const [lessons, schedules, academic, completion, slugs] = await Promise.all([
        db.collection('lessonReports').where('internalStudentId', '==', internalStudentId).get(),
        db.collection('studentSchedules').where('internalStudentId', '==', internalStudentId).get(),
        deps.loadAcademicData(db, internalStudentId),
        mapping.firebaseUid ? db.collection('users').doc(mapping.firebaseUid).collection('assignmentCompletions').get() : Promise.resolve(null),
        // One equality query uses Firestore's automatic index. Filtering active
        // aliases here avoids requiring a separately deployed composite index.
        actor.admin ? db.collection('reportSlugs').where('internalStudentId', '==', internalStudentId).get() : Promise.resolve(null),
    ]);
    const visible = (r: {
        subject?: string;
    }) => !allowed || allowed.has(r.subject || '영어');
    const completionHashes = new Map<string, string>((completion?.docs || []).map(d => [d.id, d.data().contentHash]));
    const raw = lessons.docs.map(d => d.data() as StoredLessonReport).filter(visible).sort((a, b) => Date.parse(b.lessonDateStart) - Date.parse(a.lessonDateStart));
    const activeSlug = slugs?.docs.find(d => d.data().active === true)?.data().reportSlug;
    const parentUrl = actor.admin && activeSlug ? `/${encodeURIComponent(activeSlug)}` : null;
    return { linked: true, studentLinked: Boolean(mapping.firebaseUid), parentUrl,
        reports: raw.map(r => audience === 'parent' ? parentLessonDTO(r) : studentLessonDTO(r, completionHashes)),
        schedules: schedules.docs.map(d => d.data() as StoredStudentSchedule).filter(visible).map(reportScheduleDTO),
        academic: { records: academic.records.filter(visible), subjects: academic.subjects.filter(visible), academyScores: academic.academyScores.filter(visible) },
    };
}
