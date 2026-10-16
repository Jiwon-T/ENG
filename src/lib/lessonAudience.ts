// Who sees each lesson-journal field once it is 반영: 모두 = the student's report too (everything a student sees, the parent
// sees as well), 학부모 = the parent's report and texts only, 선생님만 = stays in the academy. Keep in step with
// directLessonReport (api/_lib/teacherDirectReport.ts) and reportAudienceDTO.
export type LessonAudience = 'all' | 'parent' | 'teacher';
export const LESSON_AUDIENCE = {
  time: 'parent', round: 'teacher', content: 'parent', specialNote: 'parent', assignment: 'all',
  attendance: 'all', homework: 'all', attitude: 'parent', test: 'parent', scores: 'all', examScope: 'teacher', teacherNote: 'teacher',
} as const satisfies Record<string, LessonAudience>;
export const AUDIENCE_LABEL: Record<LessonAudience, string> = { all: '모두', parent: '학부모', teacher: '선생님만' };
export const AUDIENCE_HINT: Record<LessonAudience, string> = { all: '학생·학부모 리포트에 보여요', parent: '학부모 리포트와 문자에만 보여요', teacher: '학원 안에서만 봐요' };
