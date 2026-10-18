// The parent report's "수업 내용 및 피드백" text, shared by the server (directLessonReport) and the teacher's preview so the
// two can never differ. Server-imported: keep relative imports with .js.
export const lessonFeedbackText = (d: {content?: string; note?: string; assignment?: string}) => [d.content, d.note, d.assignment ? `과제: ${d.assignment}` : ''].filter(Boolean).join('\n\n');
export const parentFeedbackText = (d: {content?: string; note?: string; assignment?: string; attendanceNote?: string; specialNote?: string}) =>
  [lessonFeedbackText(d), d.attendanceNote ? `출결 메모: ${d.attendanceNote}` : '', d.specialNote ? `특이 사항: ${d.specialNote}` : ''].filter(Boolean).join('\n\n');
export function percentage(correct: number | null | undefined, total: number | null | undefined) { return correct == null || total == null || total <= 0 ? null : Math.round(correct / total * 10000) / 100; }
/** The 일지's general 테스트 점수 can be any test: its name (단어, 모의고사 …) when the teacher gave one, else just 테스트. */
export const TEST_NAME_OPTIONS = ['단어', '모의고사', '단원평가'] as const;
export const testLabel = (name?: string | null) => name?.trim() || '테스트';
export const testScoreTitle = (name?: string | null) => name?.trim() ? `테스트 점수 · ${name.trim()}` : '테스트 점수';
