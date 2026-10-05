export interface ExamPeriod {
  id: string; createdBy: string; school: string; grade: string; year: number;
  semester: string; exam: string; start: string; end: string;
  status: '준비 중' | '공개 중' | '종료'; keepPublished: boolean; wordbookIds: string[];
}
export function koreanToday(now = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function isPastExam(p: ExamPeriod, today = koreanToday()) { return p.status === '종료' || Boolean(p.end && p.end < today); }
export function examVisible(p: ExamPeriod, today = koreanToday()) { return p.status !== '준비 중' && (!isPastExam(p,today) || p.keepPublished); }
export function periodLabel(p: ExamPeriod) { return `${p.year}년 ${p.semester} ${p.exam}`; }
export function validateExam(p: ExamPeriod) {
  if (!p.school.trim() || !p.grade.trim()) return '학교와 학년을 입력해 주세요.';
  if (!Number.isInteger(p.year) || p.year < 2000 || p.year > 2200) return '연도를 확인해 주세요.';
  const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if (!valid(p.start) || !valid(p.end) || p.start > p.end) return '시작일과 종료일을 확인해 주세요.';
  return '';
}
