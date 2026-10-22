import {MAX_EXTRA_TESTS,lessonFeedbackText,percentage as sharedPercentage} from '../../src/lib/lessonReportText.js';
import { z } from 'zod';
export const subjects = ['영어', '수학', '국어', '과학', '한국사'] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** 자습 pieces in time order: the earliest stays in selfStudyStart/End (what the day lists and reports start from), the
 *  others follow in selfStudyMore; blank extra rows are dropped. Left as typed while any time is missing or invalid. */
function orderedStudyPieces(d: {selfStudyStart: string; selfStudyEnd: string; selfStudyMore: {start: string; end: string}[]}) {
    const more = d.selfStudyMore.filter(p => p.start || p.end), pieces = [{start: d.selfStudyStart, end: d.selfStudyEnd}, ...more];
    if (!more.length || pieces.some(p => !TIME.test(p.start) || !TIME.test(p.end))) return {selfStudyMore: more};
    const [first, ...rest] = [...pieces].sort((a, b) => a.start.localeCompare(b.start));
    return {selfStudyStart: first.start, selfStudyEnd: first.end, selfStudyMore: rest};
}
const extraTestSchema = z.object({
    name: z.string().trim().max(30).default(''),
    correct: z.number().nonnegative().nullable().default(null), total: z.number().positive().nullable().default(null),
    wrong: z.number().nonnegative().nullable().optional(), scorePercent: z.boolean().default(false),
    // this test on paper (true) or in the app (false); null: 자동
    paper: z.boolean().nullable().default(null),
}).strict();
type ExtraTestInput = z.infer<typeof extraTestSchema>;
const emptyTest = (t: {correct?: number | null; total?: number | null; wrong?: number | null}) => t.correct == null && t.total == null && t.wrong == null;
/** The other tests of the day: blank ones dropped, 오답 수 counted the same way as the first test. When the first test is
 *  empty and another has a score, that one becomes the first (what reports, charts and averages read). */
function orderedTests(d: {correct?: number | null; total?: number | null; wrong?: number | null; extraTests: ExtraTestInput[]}) {
    const tests = d.extraTests.map(t => ({...t, correct: t.wrong != null && t.total != null ? t.total - t.wrong : t.correct, scorePercent: t.scorePercent && t.total === 100})).filter(t => !emptyTest(t));
    if (!emptyTest(d) || !tests.length) return {extraTests: tests};
    const [first, ...rest] = tests;
    return {correct: first.correct, total: first.total, wrong: first.wrong ?? null, scorePercent: first.scorePercent, testName: first.name, extraTests: rest};
}
export const lessonDraftSchema = z.object({
    studentKey: z.string().uuid(), subject: z.enum(subjects), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    classSession: z.enum(['있음', '없음']).default('있음'),
    start: z.string(), end: z.string(),
    attendance: z.enum(['미확인', '출석', '결석', '지각', '보강 출석', '보강 결석', '보강 지각']),
    attitude: z.enum(['미확인', '미참여', '하', '중하', '중', '중상', '상', '최상']),
    homework: z.enum(['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']),
    test: z.enum(['없는 날', '미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']),
    content: z.string().max(15000), assignment: z.string().max(5000), note: z.string().max(5000), nextPlan: z.string().max(5000),
    correct: z.number().nonnegative().nullable(), total: z.number().positive().nullable(),
    examCorrect: z.number().nonnegative().nullable().default(null), examTotal: z.number().positive().nullable().default(null),
    wrong:z.number().nonnegative().nullable().optional(), examWrong:z.number().nonnegative().nullable().optional(),
    // The score was typed as a percentage (kept as correct out of 100): no real 문항·오답 count to show.
    scorePercent:z.boolean().default(false), examScorePercent:z.boolean().default(false),
    // The 테스트 점수's name (단어, 모의고사, 단원평가 or typed); empty: shown as just 테스트.
    testName:z.string().trim().max(30).default(''),
    // More tests the same day (단어 + 벼락치기 …), after the first one above.
    extraTests:z.array(extraTestSchema).max(MAX_EXTRA_TESTS).default([]),
    // The 테스트 was on paper (true) or in the app (false); null: 자동 (no app 단어 테스트 that day = paper), for its points.
    testPaper:z.boolean().nullable().default(null),
    round: z.number().nonnegative().nullable(),
    selfStudy: z.enum(['미확인', '없음', '있음']).default('없음'),
    selfStudyStart: z.string().default(''), selfStudyEnd: z.string().default(''),
    // 자습을 나눠 할 때: the pieces after the first (up to 3 pieces in all).
    selfStudyMore: z.array(z.object({ start: z.string().max(5), end: z.string().max(5) }).strict()).max(2).default([]),
    selfStudyRound: z.number().nonnegative().nullable().default(null),
    attendanceNote: z.string().max(5000).default(''), specialNote: z.string().max(5000).default(''), examScope:z.string().max(5000).default(''), teacherNote:z.string().max(5000).default(''),
}).transform(d=>({...d,...orderedStudyPieces(d),selfStudy:d.selfStudy==='미확인'&&!d.selfStudyStart&&!d.selfStudyEnd&&!d.selfStudyRound&&!d.selfStudyMore.length?'없음':d.selfStudy,correct:d.wrong!=null&&d.total!=null?d.total-d.wrong:d.correct,examCorrect:d.examWrong!=null&&d.examTotal!=null?d.examTotal-d.examWrong:d.examCorrect,scorePercent:d.scorePercent&&d.total===100,examScorePercent:d.examScorePercent&&d.examTotal===100,...orderedTests(d)})).superRefine((d, ctx) => {
    if (d.classSession === '있음' && d.end <= d.start)
        ctx.addIssue({ code: 'custom', message: '종료 시간은 시작 시간 뒤여야 합니다.' });
    if(d.wrong!=null&&d.total==null||d.examWrong!=null&&d.examTotal==null)ctx.addIssue({code:'custom',message:'오답 수와 문항 수를 함께 입력해 주세요.'});
    if(d.wrong!=null&&d.total!=null&&d.wrong>d.total||d.examWrong!=null&&d.examTotal!=null&&d.examWrong>d.examTotal)ctx.addIssue({code:'custom',message:'오답 수는 문항 수를 넘을 수 없습니다.'});
    if ((d.correct === null) !== (d.total === null) || (d.correct !== null && d.correct > d.total!))
        ctx.addIssue({ code: 'custom', message: '오답 수와 문항 수를 확인해 주세요.' });
    if ((d.examCorrect === null) !== (d.examTotal === null) || (d.examCorrect !== null && d.examCorrect > d.examTotal!))
        ctx.addIssue({ code: 'custom', message: '내신 대비 테스트의 오답 수와 문항 수를 확인해 주세요.' });
    if (d.extraTests.some(t => (t.correct === null) !== (t.total === null) || t.wrong != null && (t.total == null || t.wrong > t.total) || t.correct !== null && t.correct > t.total!))
        ctx.addIssue({ code: 'custom', message: '추가한 테스트의 오답 수와 문항 수를 확인해 주세요.' });
    const date = new Date(`${d.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== d.date || (d.classSession === '있음' && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end))))
        ctx.addIssue({ code: 'custom', message: '날짜와 시간을 확인해 주세요.' });
});
export function canAccessOwned(actor: {
    uid: string;
    admin: boolean;
    academyId?:string|null;
}, ownerUid: string,academyId?:string) { return actor.admin || actor.uid === ownerUid&&(!academyId||academyId===actor.academyId); }
export function canTeach(actor: {
    admin: boolean;
    principal?: boolean; teachingScopes?: {studentKey:string;subject:string}[];
    scopes: {
        studentKey: string;
        subject: string;
    }[];
}, studentKey: string, subject: string) { return actor.admin || (actor.principal ? actor.teachingScopes || [] : actor.scopes).some(s => s.studentKey === studentKey && s.subject === subject); }
export function percentage(correct: number | null, total: number | null) { return sharedPercentage(correct, total); }
export function lessonFeedback(d: z.infer<typeof lessonDraftSchema>) { return lessonFeedbackText(d); }
export function continuation(previous: any) { return { examScope:previous.examScope||'', content: previous.content || '', assignment: previous.assignment || '', note: '', nextPlan: previous.nextPlan || '', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', correct: null, total: null, wrong:null,extraTests:[],testPaper:null,examWrong:null,examCorrect: null, examTotal: null, round: null, selfStudy: '없음', selfStudyRound: null, selfStudyStart: '', selfStudyEnd: '', attendanceNote: '', specialNote: '' }; }
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
/** Self-study block attached to a regular lesson (same weekday). No students = everyone in the slot. */
export const studyBlockSchema = z.object({
    start: clock, end: clock,
    students: z.array(z.string().uuid()).max(100).optional(),
}).refine(block => block.end > block.start, { message: '자습 종료 시간은 시작 시간 뒤여야 합니다.' });
/** One line of a class's regular timetable.
 *  kind: 'lesson' (정규 수업, default) or 'test' (3차시: no lesson, 자습·테스트 only).
 *  students: who this line is for (omitted = the whole class). study: self-study blocks for a lesson line. */
export const timetableSlotSchema = z.object({
    weekday: z.number().int().min(0).max(6),
    start: clock, end: clock,
    kind: z.enum(['lesson', 'test']).optional(),
    students: z.array(z.string().uuid()).max(100).optional(),
    study: z.array(studyBlockSchema).max(12).optional(),
}).refine(slot => slot.end > slot.start, { message: '종료 시간은 시작 시간 뒤여야 합니다.' });
/** Keep only students who are in the class, drop empty lists, and keep study blocks on lesson lines only. */
export function normalizeSlotTargets<T extends { kind?: string; students?: string[]; study?: { students?: string[] }[] }>(slot: T, classStudents: string[]): T {
    const inClass = (keys?: string[]) => { const list = [...new Set((keys || []).filter(key => classStudents.includes(key)))]; return list.length ? list : undefined; };
    const next: any = { ...slot, kind: slot.kind === 'test' ? 'test' : 'lesson' };
    const students = inClass(slot.students); if (students) next.students = students; else delete next.students;
    const pool = students || classStudents;
    if (next.kind === 'test' || !slot.study?.length) delete next.study;
    else next.study = slot.study.map(block => { const keys = (block.students || []).filter(key => pool.includes(key)); const out: any = { ...block }; if (keys.length && keys.length < pool.length) out.students = [...new Set(keys)]; else delete out.students; return out; });
    return next;
}
export function assertDraftEditable(old: any, revision: unknown, value: {
    studentKey: string;
    subject: string;
}) {
    if (!old)
        return;
    if(old.stage==='report_published_notion_pending' || old.notionWrite && (!old.notionWrite.done || old.lastSubmittedRevision!==old.revision))throw new Error('NOTION_WRITE_PENDING');
    if (['processing', 'publishing', 'notion_saved'].includes(old.stage))
        throw new Error('PUBLISH_IN_PROGRESS');
    if (revision !== old.revision)
        throw new Error('DRAFT_CONFLICT');
    if (old.notionPageId && (old.data.studentKey !== value.studentKey || old.data.subject !== value.subject))
        throw new Error('SOURCE_IDENTITY_LOCKED');
}
export const teacherScheduleSchema = z.object({
    title: z.string().trim().min(1).max(200), subject: z.enum(subjects),
    // none: a schedule for no registered student yet (a 신입생 상담); nothing goes to any student's schedule
    students: z.array(z.string().uuid()).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    // '시험' was renamed '테스트'; older records still saying '시험' are accepted and saved as '테스트'.
    kind: z.preprocess(value => value === '시험' ? '테스트' : value, z.enum(['정규 수업', '보강', '휴강', '테스트', '자습', '상담', '기타'])),
    status: z.enum(['예정', '변경', '완료', '취소']),
    place: z.string().max(100), note: z.string().max(5000),
}).superRefine((value, ctx) => {
    const date = new Date(`${value.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.date || value.end <= value.start)
        ctx.addIssue({ code: 'custom', message: '날짜와 시작·종료 시간을 확인해 주세요.' });
});

export function assertLessonComplete(input: unknown) {
    const d = lessonDraftSchema.parse(input);
    if (!d.content.trim()) throw new Error('LESSON_CONTENT_REQUIRED');
    const absent = ['결석', '보강 결석'].includes(d.attendance);
    if (d.classSession === '있음' && (d.attendance === '미확인' || d.round === null || (!absent && d.round <= 0))) throw new Error('LESSON_ROUNDS_REQUIRED');
    if (d.classSession === '없음' && d.selfStudy !== '있음') throw new Error('LESSON_OR_STUDY_REQUIRED');
    if (d.selfStudy === '미확인') throw new Error('SELF_STUDY_REQUIRED');
    if (d.selfStudy === '없음' && (d.selfStudyRound !== null && d.selfStudyRound !== 0 || d.selfStudyStart || d.selfStudyEnd || d.selfStudyMore.length)) throw new Error('SELF_STUDY_REQUIRED');
    // Every 자습 piece needs both times, in order, without overlapping the one before.
    if (d.selfStudy === '있음' && d.selfStudyMore.some((p, i) => !TIME.test(p.start) || !TIME.test(p.end) || p.end <= p.start || p.start < (i ? d.selfStudyMore[i - 1].end : d.selfStudyEnd))) throw new Error('SELF_STUDY_REQUIRED');
    // 결석: the 자습 round may stay 0 like the lesson round (a 3차시 테스트 day, 자습 only, absent before any 자습 counted)
    if (d.selfStudy === '있음' && (d.selfStudyRound === null || (!absent && d.selfStudyRound <= 0) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.selfStudyStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.selfStudyEnd) || d.selfStudyEnd <= d.selfStudyStart)) throw new Error('SELF_STUDY_REQUIRED');
    return d.classSession === '없음' ? { ...d, start: '', end: '', round: null } : d;
}
