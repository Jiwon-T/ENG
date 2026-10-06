import { z } from 'zod';
export const subjects = ['영어', '수학', '국어', '과학', '한국사'] as const;
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
    round: z.number().nonnegative().nullable(),
    selfStudy: z.enum(['미확인', '없음', '있음']).default('미확인'),
    selfStudyStart: z.string().default(''), selfStudyEnd: z.string().default(''),
    selfStudyRound: z.number().nonnegative().nullable().default(null),
    attendanceNote: z.string().max(5000).default(''), specialNote: z.string().max(5000).default(''), examScope:z.string().max(5000).default(''),
}).transform(d=>({...d,correct:d.wrong!=null&&d.total!=null?d.total-d.wrong:d.correct,examCorrect:d.examWrong!=null&&d.examTotal!=null?d.examTotal-d.examWrong:d.examCorrect})).superRefine((d, ctx) => {
    if (d.classSession === '있음' && d.end <= d.start)
        ctx.addIssue({ code: 'custom', message: '종료 시간은 시작 시간 뒤여야 합니다.' });
    if(d.wrong!=null&&d.total==null||d.examWrong!=null&&d.examTotal==null)ctx.addIssue({code:'custom',message:'오답 수와 문항 수를 함께 입력해 주세요.'});
    if(d.wrong!=null&&d.total!=null&&d.wrong>d.total||d.examWrong!=null&&d.examTotal!=null&&d.examWrong>d.examTotal)ctx.addIssue({code:'custom',message:'오답 수는 문항 수를 넘을 수 없습니다.'});
    if ((d.correct === null) !== (d.total === null) || (d.correct !== null && d.correct > d.total!))
        ctx.addIssue({ code: 'custom', message: '오답 수와 문항 수를 확인해 주세요.' });
    if ((d.examCorrect === null) !== (d.examTotal === null) || (d.examCorrect !== null && d.examCorrect > d.examTotal!))
        ctx.addIssue({ code: 'custom', message: '내신 대비 테스트의 오답 수와 문항 수를 확인해 주세요.' });
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
export function percentage(correct: number | null, total: number | null) { return correct === null || total === null || total <= 0 ? null : Math.round(correct / total * 10000) / 100; }
export function lessonFeedback(d: z.infer<typeof lessonDraftSchema>) { return [d.content, d.note, d.assignment ? `과제: ${d.assignment}` : ''].filter(Boolean).join('\n\n'); }
export function continuation(previous: any) { return { examScope:previous.examScope||'', content: previous.content || '', assignment: previous.assignment || '', note: '', nextPlan: previous.nextPlan || '', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', correct: null, total: null, wrong:null,examWrong:null,examCorrect: null, examTotal: null, round: null, selfStudy: '미확인', selfStudyRound: null, selfStudyStart: '', selfStudyEnd: '', attendanceNote: '', specialNote: '' }; }
export const timetableSlotSchema = z.object({
    weekday: z.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).refine(slot => slot.end > slot.start, { message: '종료 시간은 시작 시간 뒤여야 합니다.' });
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
export function publishDecision(old: any) {
    if (old.stage === 'published' && old.lastSubmittedRevision === old.revision)
        return 'already-published';
    if (['publishing', 'processing', 'notion_saved'].includes(old.stage) && !(old.publishStartedAt && Date.now()-old.publishStartedAt>180000 && (old.notionWrite?.leaseUntil || 0)<=Date.now()))
        throw new Error('PUBLISH_IN_PROGRESS');
    return 'publish';
}
export const teacherScheduleSchema = z.object({
    title: z.string().trim().min(1).max(200), subject: z.enum(subjects),
    students: z.array(z.string().uuid()).min(1).max(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    kind: z.enum(['정규 수업', '보강', '휴강', '시험', '기타']),
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
    if (d.selfStudy === '없음' && (d.selfStudyRound !== null && d.selfStudyRound !== 0 || d.selfStudyStart || d.selfStudyEnd)) throw new Error('SELF_STUDY_REQUIRED');
    if (d.selfStudy === '있음' && (d.selfStudyRound === null || d.selfStudyRound <= 0 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.selfStudyStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.selfStudyEnd) || d.selfStudyEnd <= d.selfStudyStart)) throw new Error('SELF_STUDY_REQUIRED');
    return d.classSession === '없음' ? { ...d, start: '', end: '', round: null } : d;
}
