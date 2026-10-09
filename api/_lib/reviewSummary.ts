// Summaries for the paged lesson review and grade lists. They work on rows the handlers already hold in memory, so they add no reads.
export type LessonStatus = 'done' | 'saved' | 'failed' | 'processing';
export const LESSON_STATUSES: readonly LessonStatus[] = ['done', 'saved', 'failed', 'processing'];
export function lessonStatus(stage?: string): LessonStatus {
    return stage === 'published' || stage === 'report_published_notion_pending' ? 'done' : stage === 'draft' ? 'saved' : stage === 'failed' ? 'failed' : 'processing';
}
export function lessonStatusCounts(rows: { stage?: string }[]) {
    const counts: Record<LessonStatus | 'all', number> = { all: rows.length, done: 0, saved: 0, failed: 0, processing: 0 };
    for (const row of rows) counts[lessonStatus(row.stage)]++;
    return counts;
}
export const validLessonStatus = (value: string | null): LessonStatus | '' => LESSON_STATUSES.includes(value as LessonStatus) ? value as LessonStatus : '';

const percent = (d: any) => d?.submissionStatus === '제출 완료' && Number.isFinite(d.score) && Number.isFinite(d.maxScore) && d.maxScore > 0 ? d.score / d.maxScore * 100 : null;
/** Average is on a 100-point scale so different full marks can be combined. */
export function academicStats(rows: { stage?: string; data: any }[]) {
    const scores = rows.map(r => percent(r.data)).filter((v): v is number => v !== null);
    return {
        count: rows.length,
        average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null,
        submitted: rows.filter(r => r.data?.submissionStatus === '제출 완료').length,
        missing: rows.filter(r => r.data?.submissionStatus === '미제출').length,
        pending: rows.filter(r => r.stage !== 'published').length,
    };
}
/** The student's latest earlier scored exam of the same subject and kind, for the trend shown on each card. */
export function withPreviousScores<T extends { id: string; data: any }>(page: T[], all: { id: string; data: any }[]) {
    return page.map(row => {
        const d = row.data;
        let previous: any = null;
        for (const other of all) {
            const o = other.data;
            if (other.id === row.id || o.studentKey !== d.studentKey || o.subject !== d.subject || o.examType !== d.examType || !(o.examDate < d.examDate) || percent(o) === null) continue;
            if (!previous || o.examDate > previous.examDate) previous = o;
        }
        return previous ? { ...row, previous: { score: previous.score, maxScore: previous.maxScore, title: previous.title, examDate: previous.examDate } } : row;
    });
}
