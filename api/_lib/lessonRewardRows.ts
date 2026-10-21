// 수업 보상: the linked student's lessons as the rewards read them (id, day, 출석, 숙제·시험·태도 grades), shared by the pet
// screen (taken when the app opens) and 반영 (settled in the publish transaction, so no app is needed).
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { PET_REWARD_WINDOW_DAYS, PET_TEST_DAY, PET_TEST_REWARD } from '../../src/lib/petCatalog.js';
import { LESSON_BACKPAY_FROM, homeworkGrades, seoulDay } from './pet.js';
import { lessonReportId } from './reportAudienceDTO.js';
import type { StoredLessonReport } from './reportSchemas.js';
import { expectedTestDays } from './testDays.js';
import { readStudentMapping } from './studentIdentity.js';

/** The linked student's lessons for 공부 보상: id, date, attendance, and whether the student checked the assignment done. */
export async function studyReports(db: any, uid: string, preloadedUser?: any, override?: { report: any; deleted: boolean } | null) {
  const user = preloadedUser ?? (await db.collection('users').doc(uid).get()).data();
  if (!user?.notionStudentKey) return [];
  const mapping = await readStudentMapping(db, user.notionStudentKey);
  if (!mapping?.firebaseUid || mapping.firebaseUid !== uid || !mapping.internalStudentId) return [];
  return lessonRows(db, mapping.internalStudentId, uid, override, user.notionStudentKey);
}
/** 계산 전용 수업 기록 (lessons kept outside the app's 일지, e.g. the 9/1–9/19 Notion lessons): read with the student's
 *  lessons for the rewards (출석 → 지난 수업 보상, 개근) only — never shown in a report. {internalStudentId, date (the
 *  lesson's start, ISO), lessonTime, attendance, source}. */
export const LESSON_BACKFILL = 'lessonBackfill';
/** One student's lessons by the student record — linked or not (`uid` null: no app account, so a 시험 left on 자동 is paper).
 *  `studentKey`: to find the student's 누적 테스트 날 in the timetable (one row a test day is marked `testDay`; a test day
 *  with no 일지 before today gets a 결석 row, read for the rewards only). */
export async function lessonRows(db: any, internalStudentId: string, uid: string | null, override?: { report: any; deleted: boolean } | null, studentKey?: string) {
  // 숙제 points come from the teacher's 숙제 평가 in the next lesson, not from the student's own 완료 check.
  const [reports, backfill] = await Promise.all([db.collection('lessonReports').where('internalStudentId', '==', internalStudentId).get(), db.collection(LESSON_BACKFILL).where('internalStudentId', '==', internalStudentId).get()]);
  // 반영 in progress: the 일지 as it is being published (or gone, when deleted) instead of the copy still stored
  let stored = reports.docs.map((d: any) => d.data() as StoredLessonReport).filter((r: StoredLessonReport) => r.reportIdentity || r.notionPageId);
  if (override?.report && (override.report.reportIdentity || override.report.notionPageId)) {
    const id = lessonReportId(override.report);
    stored = [...stored.filter((r: StoredLessonReport) => lessonReportId(r) !== id), ...(override.deleted ? [] : [override.report])];
  }
  const rows = stored.map((r: StoredLessonReport) => ({
    id: lessonReportId(r), date: r.lessonDateStart, subject: r.subject || '영어', attendance: r.attendance || '', homework: r.homework || '', hasAssignment: Boolean(r.derivedAssignment?.trim()),
    test: r.test || '', testPaper: typeof r.testPaper === 'boolean' ? r.testPaper : null, attitude: r.attitude || '',
    session: Boolean(String((r as any).lessonTime || '').trim()), studied: /\d/.test(String((r as any).selfStudyTime || '')),
  }));
  // 계산 전용: 출결, and a 태도 only where the 수업 내용 praised it (자습 counts then, as for any day with 태도 상)
  for (const d of backfill.docs) { const b = d.data(); rows.push({id: d.id, date: b.date, subject: b.subject || '영어', attendance: b.attendance || '', homework: '', hasAssignment: false, test: '', testPaper: true, attitude: b.attitude || '', session: Boolean(String(b.lessonTime || '').trim()), studied: Boolean(b.studied)}); }
  const grades = homeworkGrades(rows);
  // 누적 테스트 날: from the student's first lesson (or PET_TEST_DAY.from) to yesterday — today's may not be written yet
  const first = rows.map(r => String(r.date || '').slice(0, 10)).filter(Boolean).sort()[0], yesterday = seoulDay(Date.now() - 86_400_000), today = seoulDay(Date.now());
  const testFrom = first && first > PET_TEST_DAY.from ? first : PET_TEST_DAY.from;
  const tests = studentKey && first && testFrom <= today ? await expectedTestDays(db, studentKey, testFrom, today) : new Set<string>(), testRow = new Map<string, string>();
  for (const day of tests) {
    const that = rows.filter(r => String(r.date || '').slice(0, 10) === day);
    const pick = that.find(r => /출석|지각/.test(r.attendance) && !/결석/.test(r.attendance)) || that[0];
    if (pick) testRow.set(pick.id, day);
    else if (day <= yesterday) rows.push({id: `testday-${day}`, date: day, subject: '영어', attendance: '결석', homework: '', hasAssignment: false, test: '', testPaper: true, attitude: '', session: false, studied: false});
  }
  for (const r of rows) if (r.id.startsWith('testday-')) testRow.set(r.id, r.date);
  // 테스트 평가 left on 자동: paper unless the student took an app 단어 테스트 that day (read once, only when needed; a
  // failed read counts every such test as an app test, the smaller reward)
  const appDays = uid && rows.some(r => r.testPaper === null && PET_TEST_REWARD.paper[r.test]) ? await appTestDays(db, uid) : null;
  return rows.map(r => ({id: r.id, date: r.date, attendance: r.attendance, homework: r.homework, homeworkGrade: grades.get(r.id)?.grade, gradedAt: grades.get(r.id)?.gradedAt, gradedBy: grades.get(r.id)?.by,
    test: r.test, testPaper: r.testPaper ?? (uid ? isPaperDay(appDays, String(r.date).slice(0, 10)) : true), attitude: r.attitude, subject: r.subject, session: r.session, studied: r.studied, ...(testRow.has(r.id) ? {testDay: true} : {})}));
}
/** 자동: paper only when the day was read in full and had no app 단어 테스트 (a day not read = app, the smaller reward). */
export const isPaperDay = (seen: {days: Set<string>; from: string} | null, day: string) => Boolean(seen && day >= seen.from && !seen.days.has(day));
/** Korea-time days of the student's app 단어 테스트 (studySessions type 'test') in the reward window, and from which day
 *  the read is complete (when the newest MAX sessions do not reach back to the window start, older days are not known). */
async function appTestDays(db: any, uid: string): Promise<{days: Set<string>; from: string} | null> {
  // from the first day lessons are paid from (놓친 수업 보상), so an older 자동 test is not taken for an app one as the window
  // moves on (the 장학 쿠폰 보완 counts every lesson again each time)
  const from = Math.min(Date.now() - (PET_REWARD_WINDOW_DAYS + 2) * 86_400_000, Date.parse(`${LESSON_BACKPAY_FROM}T00:00:00+09:00`));
  try {
    const MAX = 2000, snap = await db.collection('studySessions').where('uid', '==', uid).where('createdAt', '>=', Timestamp.fromMillis(from)).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(MAX).get();
    const at = (v: any) => typeof v?.toMillis === 'function' ? v.toMillis() : Date.parse(String(v));
    const mine = snap.docs.map((d: any) => d.data()).filter((x: any) => x.uid === uid);
    // cut at MAX: the oldest day read may be partial, so only the days after it are complete
    const complete = snap.docs.length < MAX ? seoulDay(from) : seoulDay(at(mine[mine.length - 1]?.createdAt) + 86_400_000);
    return {days: new Set(mine.filter((x: any) => x.type === 'test').map((x: any) => seoulDay(at(x.createdAt)))), from: complete};
  } catch { console.warn('PET_APP_TEST_DAYS_FAILED'); return null; }
}
