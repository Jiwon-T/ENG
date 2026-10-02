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

export type ScorePeriod = 'all' | '3' | '6';
export function inScorePeriod(date: string | null, period: ScorePeriod, now = new Date()) {
  if (period === 'all') return true;
  if (!date || !Number.isFinite(Date.parse(date))) return false;
  const today = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [year, month, day] = today.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 - Number(period), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  const start = target.toISOString().slice(0, 10);
  const recordDate = date.slice(0, 10);
  return recordDate >= start && recordDate <= today;
}
