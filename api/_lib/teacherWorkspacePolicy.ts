import { z } from 'zod';
export const subjects = ['영어', '수학', '국어', '과학', '한국사'] as const;
export const lessonDraftSchema = z.object({
    studentKey: z.string().uuid(), subject: z.enum(subjects), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/),
    attendance: z.enum(['미확인', '출석', '결석', '지각', '보강 출석', '보강 결석', '보강 지각']),
    attitude: z.enum(['미확인', '미참여', '하', '중하', '중', '중상', '상', '최상']),
    homework: z.enum(['미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']),
    test: z.enum(['미확인', '미제출', '최하', '하', '중하', '중', '중상', '상', '최상']),
    content: z.string().max(15000), assignment: z.string().max(5000), note: z.string().max(5000), nextPlan: z.string().max(5000),
    correct: z.number().int().nonnegative().nullable(), total: z.number().int().positive().nullable(),
    round: z.number().int().positive().nullable(),
}).superRefine((d, ctx) => {
    if (d.end <= d.start)
        ctx.addIssue({ code: 'custom', message: '종료 시간은 시작 시간 뒤여야 합니다.' });
    if ((d.correct === null) !== (d.total === null) || (d.correct !== null && d.correct > d.total!))
        ctx.addIssue({ code: 'custom', message: '정답 수와 만점을 확인해 주세요.' });
    const date = new Date(`${d.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== d.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.end))
        ctx.addIssue({ code: 'custom', message: '날짜와 시간을 확인해 주세요.' });
});
export function canAccessOwned(actor: {
    uid: string;
    admin: boolean;
}, ownerUid: string) { return actor.admin || actor.uid === ownerUid; }
export function canTeach(actor: {
    admin: boolean;
    scopes: {
        studentKey: string;
        subject: string;
    }[];
}, studentKey: string, subject: string) { return actor.admin || actor.scopes.some(s => s.studentKey === studentKey && s.subject === subject); }
export function percentage(correct: number | null, total: number | null) { return correct === null || total === null || total <= 0 ? null : Math.round(correct / total * 10000) / 100; }
export function lessonFeedback(d: z.infer<typeof lessonDraftSchema>) { return [d.content, d.note, d.assignment ? `과제: ${d.assignment}` : ''].filter(Boolean).join('\n\n'); }
export function continuation(previous: any) { return { content: previous.content || '', assignment: previous.assignment || '', note: '', nextPlan: previous.nextPlan || '', attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', correct: null, total: null, round: null }; }
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
    if (['publishing', 'processing', 'notion_saved'].includes(old.stage))
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
    place: z.enum(['학원', '온라인', '기타']), note: z.string().max(5000),
}).superRefine((value, ctx) => {
    const date = new Date(`${value.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.date || value.end <= value.start)
        ctx.addIssue({ code: 'custom', message: '날짜와 시작·종료 시간을 확인해 주세요.' });
});
