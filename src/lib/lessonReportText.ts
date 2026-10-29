// The parent report's "수업 내용 및 피드백" text, shared by the server (directLessonReport) and the teacher's preview so the
// two can never differ. Server-imported: keep relative imports with .js.
export const lessonFeedbackText = (d: {content?: string; note?: string; assignment?: string}) => [d.content, d.note, d.assignment ? `과제: ${d.assignment}` : ''].filter(Boolean).join('\n\n');
export const parentFeedbackText = (d: {content?: string; note?: string; assignment?: string; attendanceNote?: string; specialNote?: string}) =>
  [lessonFeedbackText(d), d.attendanceNote ? `출결 메모: ${d.attendanceNote}` : '', d.specialNote ? `특이 사항: ${d.specialNote}` : ''].filter(Boolean).join('\n\n');
export function percentage(correct: number | null | undefined, total: number | null | undefined) { return correct == null || total == null || total <= 0 ? null : Math.round(correct / total * 10000) / 100; }
/** The 일지's general 테스트 점수 can be any test: its name (단어, 모의고사 …) when the teacher gave one, else just 테스트. */
export const TEST_NAME_OPTIONS = ['단어', '문법', '모의고사', '단원평가'] as const;
/** More tests on the same day (단어 + 벼락치기 …): up to 3 after the first one, which stays in correct/total/testName. */
export const MAX_EXTRA_TESTS = 3;
export interface ExtraTest { name: string; correct: number | null; total: number | null; wrong?: number | null; scorePercent?: boolean; /** 종이 (true) · 앱 (false) · 자동 (null) */ paper?: boolean | null }
/** The lesson's 테스트 for the 테스트 평가 points: paper when any test was on paper (an app test alongside pays its own
 *  단어 테스트 points), app when only app was chosen, null (자동) when none was chosen. */
export const lessonTestPaper = (d: { testPaper?: boolean | null; extraTests?: { paper?: boolean | null }[] }) => {
  const marks = [d.testPaper ?? null, ...(d.extraTests || []).map(t => t.paper ?? null)];
  return marks.includes(true) ? true : marks.includes(false) ? false : null;
};
/** An extra test as the report shows it: its name and 점수 out of 100. */
export interface ExtraScore { name: string; score: number }
export const extraScoresText = (list?: ExtraScore[] | null) => (list || []).map(t => `${testLabel(t.name)} ${t.score}점`).join(' · ');
/** 내신 대비 점수's other tests: ② 90점 · ③ 78점 */
export const examExtraScoresText = (list?: number[] | null) => (list || []).map((n, i) => `${'②③④⑤'[i] || ''} ${n}점`).join(' · ');
/** 수업 or 테스트: a record with no 수업 time, only 자습 (3차시 누적 테스트 등), is a 테스트 — also for reports published before
 *  the category was set that way. */
export const reportCategory = (r: { category?: string | null; lessonTime?: string | null; selfStudyTime?: string | null }) =>
  r.category === '테스트' || (!String(r.lessonTime || '').trim() && String(r.selfStudyTime || '').trim()) ? '테스트' : '수업';
export const testLabel = (name?: string | null) => name?.trim() || '테스트';
export const testScoreTitle = (name?: string | null) => name?.trim() ? `테스트 점수 · ${name.trim()}` : '테스트 점수';
