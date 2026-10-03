export const newGridLesson = (studentKey: string, subject: string, date: string, start: string, end: string) => ({ studentKey, subject, date, start, end, attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', content: '', assignment: '', note: '', nextPlan: '', correct: null as number | null, total: null as number | null, examCorrect: null as number | null, examTotal: null as number | null, round: null as number | null, classSession: '있음', selfStudy: '미확인', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null as number | null, attendanceNote: '', specialNote: '' });
export function applyCommonLesson<T extends ReturnType<typeof newGridLesson>>(lesson: T, common: {
    content: string;
    assignment: string;
    nextPlan?: string;
    specialNote?: string;
}) { return { ...lesson, ...common }; }
export function gridScore(correct: number | null, total: number | null) { return correct === null || total === null || total <= 0 || correct < 0 || correct > total ? null : Math.round(correct / total * 10000) / 100; }
export function gridCanPublish(row: {
    revision?: number;
    stage?: string;
    data: any;
    savedData?: any;
}) { return Boolean(row.revision) && !['published', 'publishing', 'processing', 'notion_saved'].includes(row.stage || '') && JSON.stringify(row.data) === JSON.stringify(row.savedData); }
export function isCurrentStudent(student: {
    subjects?: {
        status: string;
    }[];
    enrollmentStatus?: string;
}) { return student.subjects?.length ? student.subjects.some(s => s.status === '등록') : student.enrollmentStatus === '등록'; }
export async function processLessonRows<R extends {
    id: string;
    revision?: number;
    stage: string;
    data: any;
    savedData?: any;
}>(rows: R[], mode: 'save' | 'publish', request: (action: string, body: any) => Promise<any>, update: (id: string, patch: any) => void) {
    let succeeded = 0, failed = 0;
    for (const row of rows) {
        try {
            if (mode === 'save') {
                await request('save-draft', { id: row.id, revision: row.revision, data: row.data });
                update(row.id, { revision: (row.revision || 0) + 1, stage: 'draft', savedData: structuredClone(row.data), error: undefined });
            }
            else {
                if (!gridCanPublish(row))
                    throw new Error('수정한 내용을 먼저 저장해 주세요.');
                const result = await request('publish', { id: row.id });
                update(row.id, { stage: result.stage || 'processing', error: undefined });
            }
            succeeded++;
        }
        catch (error) {
            failed++;
            update(row.id, { error: error instanceof Error ? error.message : '처리 실패' });
        }
    }
    return { succeeded, failed };
}
