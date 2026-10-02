export interface AcademicRecord {
  recordId: string; title: string; subject: string; examType: string; examDate: string | null;
  score: number | null; maxScore: number | null; percentile: number | null; grade: string; submissionStatus: string;
}
export interface SubjectEnrollment { subject: string; status: string; startAt: string | null; endAt: string | null; }
export interface AcademyScore { recordId: string; subject: string; examDate: string; vocabularyScore: number | null; schoolExamScore: number | null; }
export interface AcademicData { records: AcademicRecord[]; subjects: SubjectEnrollment[]; academyScores: AcademyScore[]; }
