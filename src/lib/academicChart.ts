import type { AcademicData } from '../types/academic';
export const SCORE_VIEWS = ['학원 단어', '학원 내신 대비', '학교 내신', '모의고사'] as const;
export type ScoreView = typeof SCORE_VIEWS[number];
export function scoreRows(data: AcademicData, view: ScoreView) {
  if (view === '학교 내신' || view === '모의고사') return data.records.filter(r => (r.examType === '학력평가' ? '모의고사' : r.examType) === view).map(r => ({
    id: r.recordId, subject: r.subject, title: r.title, date: r.examDate, score: r.score,
    maxScore: r.maxScore, percentile: r.percentile, grade: r.grade, status: r.submissionStatus,
  }));
  return data.academyScores.map(r => ({ id: r.recordId, subject: r.subject, title: view, date: r.examDate,
    score: view === '학원 단어' ? r.vocabularyScore : r.schoolExamScore,
    maxScore: null, percentile: null, grade: '', status: '' })).filter(r => r.score !== null);
}
export function chartValue(row: ReturnType<typeof scoreRows>[number], metric: 'score' | 'percentile') {
  if (!row.date || !Number.isFinite(Date.parse(row.date)) || row.status === '미제출' || row.status === '제출 대상 아님') return null;
  const value = metric === 'percentile' ? row.percentile : row.score;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
