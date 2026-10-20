// 수업 보상: the linked student's lessons as the rewards read them (id, day, 출석, 숙제·시험·태도 grades), shared by the pet
// screen (taken when the app opens) and 반영 (settled in the publish transaction, so no app is needed).
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { PET_REWARD_WINDOW_DAYS, PET_TEST_REWARD } from '../../src/lib/petCatalog.js';
import { homeworkGrades, seoulDay } from './pet.js';
import { lessonReportId } from './reportAudienceDTO.js';
import type { StoredLessonReport } from './reportSchemas.js';
import { readStudentMapping } from './studentIdentity.js';

/** The linked student's lessons for 공부 보상: id, date, attendance, and whether the student checked the assignment done. */
export async function studyReports(db: any, uid: string, preloadedUser?: any, override?: { report: any; deleted: boolean } | null) {
  const user = preloadedUser ?? (await db.collection('users').doc(uid).get()).data();
  if (!user?.notionStudentKey) return [];
  const mapping = await readStudentMapping(db, user.notionStudentKey);
  if (!mapping?.firebaseUid || mapping.firebaseUid !== uid || !mapping.internalStudentId) return [];
  return lessonRows(db, mapping.internalStudentId, uid, override);
}
/** One student's lessons by the student record — linked or not (`uid` null: no app account, so a 시험 left on 자동 is paper). */
export async function lessonRows(db: any, internalStudentId: string, uid: string | null, override?: { report: any; deleted: boolean } | null) {
  // 숙제 points come from the teacher's 숙제 평가 in the next lesson, not from the student's own 완료 check.
  const reports = await db.collection('lessonReports').where('internalStudentId', '==', internalStudentId).get();
  // 반영 in progress: the 일지 as it is being published (or gone, when deleted) instead of the copy still stored
  let stored = reports.docs.map((d: any) => d.data() as StoredLessonReport).filter((r: StoredLessonReport) => r.reportIdentity || r.notionPageId);
  if (override?.report && (override.report.reportIdentity || override.report.notionPageId)) {
    const id = lessonReportId(override.report);
    stored = [...stored.filter((r: StoredLessonReport) => lessonReportId(r) !== id), ...(override.deleted ? [] : [override.report])];
  }
  const rows = stored.map((r: StoredLessonReport) => ({
    id: lessonReportId(r), date: r.lessonDateStart, subject: r.subject || '영어', attendance: r.attendance || '', homework: r.homework || '', hasAssignment: Boolean(r.derivedAssignment?.trim()),
    test: r.test || '', testPaper: typeof r.testPaper === 'boolean' ? r.testPaper : null, attitude: r.attitude || '',
  }));
  const grades = homeworkGrades(rows);
  // 테스트 평가 left on 자동: paper unless the student took an app 단어 테스트 that day (read once, only when needed; a
  // failed read counts every such test as an app test, the smaller reward)
  const appDays = uid && rows.some(r => r.testPaper === null && PET_TEST_REWARD.paper[r.test]) ? await appTestDays(db, uid) : null;
  return rows.map(r => ({id: r.id, date: r.date, attendance: r.attendance, homework: r.homework, homeworkGrade: grades.get(r.id)?.grade, gradedAt: grades.get(r.id)?.gradedAt,
    test: r.test, testPaper: r.testPaper ?? (uid ? isPaperDay(appDays, String(r.date).slice(0, 10)) : true), attitude: r.attitude}));
}
/** 자동: paper only when the day was read in full and had no app 단어 테스트 (a day not read = app, the smaller reward). */
export const isPaperDay = (seen: {days: Set<string>; from: string} | null, day: string) => Boolean(seen && day >= seen.from && !seen.days.has(day));
/** Korea-time days of the student's app 단어 테스트 (studySessions type 'test') in the reward window, and from which day
 *  the read is complete (when the newest MAX sessions do not reach back to the window start, older days are not known). */
async function appTestDays(db: any, uid: string): Promise<{days: Set<string>; from: string} | null> {
  const from = Date.now() - (PET_REWARD_WINDOW_DAYS + 2) * 86_400_000;
  try {
    const MAX = 500, snap = await db.collection('studySessions').where('uid', '==', uid).where('createdAt', '>=', Timestamp.fromMillis(from)).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(MAX).get();
    const at = (v: any) => typeof v?.toMillis === 'function' ? v.toMillis() : Date.parse(String(v));
    const mine = snap.docs.map((d: any) => d.data()).filter((x: any) => x.uid === uid);
    // cut at MAX: the oldest day read may be partial, so only the days after it are complete
    const complete = snap.docs.length < MAX ? seoulDay(from) : seoulDay(at(mine[mine.length - 1]?.createdAt) + 86_400_000);
    return {days: new Set(mine.filter((x: any) => x.type === 'test').map((x: any) => seoulDay(at(x.createdAt)))), from: complete};
  } catch { console.warn('PET_APP_TEST_DAYS_FAILED'); return null; }
}
