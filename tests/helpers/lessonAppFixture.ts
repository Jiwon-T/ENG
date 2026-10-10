import { templateFirestore } from './templateFirestore.js';
import { hashStudentKey } from '../../api/_lib/security.js';

/*
 * App-only lesson state as it stood after the Notion migration: lessonSourceRecords rows (the old
 * lessons, read through appLessonSource), the active lessonAppAuthority switch and its verification record.
 * Seeded directly; the migration that once produced them no longer exists.
 */
export const STUDENT = '11111111-1111-4111-8111-111111111111', SOURCE_DB = 'ab289f5b-1cf5-4160-809e-10d268c9c385';
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const admin = { uid: 'admin', admin: true, principal: false, academyId: 'main', scopes: [] };
const RUN = 'run-1', HASH = 'verified';

/** One migrated lesson, shaped like the rows lessonSourceRecords holds. */
export function sourceRecord(n: number, o: any = {}) {
    const date = (o.date || '2026-09-01T14:00:00+09:00').slice(0, 10), [start, end] = (o.time || '14:00 ~ 15:20').split(' ~ ');
    const content = o.content ?? `수업 내용 ${n}`;
    return { sourceKey: 'source-' + n, sourceId: id(n), sourceDatabaseId: SOURCE_DB, academyId: 'main', ownerUid: o.ownerUid || 'teacher', assignedUids: o.assignedUids || [o.ownerUid || 'teacher'],
        studentKey: STUDENT, internalStudentId: 'internal', subject: '영어',
        data: { studentKey: STUDENT, subject: '영어', date, classSession: '있음', start, end, round: o.round ?? n, selfStudy: '없음', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null,
            attendance: '출석', attitude: '미확인', homework: '미확인', test: '미확인', content, assignment: '복습', note: '', nextPlan: '', examScope: '', attendanceNote: '', specialNote: '',
            correct: null, total: null, examCorrect: null, examTotal: null },
        stage: 'published', appRecordId: null, linkedDraftId: null, publicReportId: id(n), notionEditedAt: o.edited || `2026-09-0${(n % 9) + 1}T00:00:00.000Z`,
        sourceVersion: 'v' + n, removed: false, importRunId: RUN, importedAt: 1, updatedAt: 1 };
}
export const report = (n: number, o: any = {}) => ({ internalStudentId: 'internal', notionPageId: id(n), lessonDateStart: '2026-09-01T14:00:00+09:00', subject: '영어', attendance: '출석', feedback: `수업 내용 ${n}\n\n과제: 복습`, reportIdentity: 'public-' + n, ...o });

/** A Firestore double with the academy, the teacher, one student and the given migrated lessons, lesson app switched on. */
export function fixture(records: any[]) {
    process.env.ADMIN_UID = 'admin';
    const f = templateFirestore();
    f.rows.set('teacherWorkspaceAccess/teacher', { academyId: 'main', scopes: [] });
    f.rows.set('academyStudentMemberships/' + STUDENT, { academyId: 'main', internalStudentId: 'internal' });
    f.rows.set('notionStudentMappings/' + hashStudentKey(STUDENT), { studentKey: STUDENT, internalStudentId: 'internal' });
    f.rows.set('academyCoreAuthority/main', { active: true });
    for (const r of records) f.rows.set('lessonSourceRecords/' + r.sourceId, r);
    f.rows.set('lessonVerificationRuns/' + RUN, { verified: true, academyId: 'main', hash: HASH });
    f.rows.set('lessonAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: RUN, verificationHash: HASH });
    return f;
}
/** Switch the lesson app off again (app data untouched), as an admin once could. */
export const switchOff = (f: any) => f.rows.set('lessonAppAuthority/main', { ...f.rows.get('lessonAppAuthority/main'), active: false });
