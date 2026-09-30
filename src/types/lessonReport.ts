import { z } from 'zod';

/**
 * Make에서 POST /api/webhooks/notion-report로 전달하는 원본 페이로드 스키마
 */
export const NotionReportWebhookSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  notionPageId: z.string().min(1, 'notionPageId is required'),
  studentKey: z.string().min(1, 'studentKey is required'),
  lessonDateStart: z.string().min(1, 'lessonDateStart is required'), // ISO 8601
  lessonDateEnd: z.string().nullable().optional(),
  lessonTime: z.string().nullable().optional(),
  selfStudyTime: z.string().nullable().optional(),
  category: z.enum(['수업', '테스트']).default('수업'),
  attendance: z.string().nullable().optional(),
  attitude: z.string().nullable().optional(),
  homework: z.string().nullable().optional(),
  test: z.string().nullable().optional(),
  vocabularyScore: z.number().nullable().optional(),
  schoolExamScore: z.number().nullable().optional(),
  feedback: z.string().default(''),
  updatedAt: z.string().optional(),
});

export type NotionReportWebhookPayload = z.infer<typeof NotionReportWebhookSchema>;

/**
 * Firestore lessonReports 컬렉션에 저장되는 전체 원본 데이터 모델
 */
export interface StoredLessonReport {
  schemaVersion: number;
  notionPageId: string;
  studentKey: string;
  studentId: string; // 앱 내부 uid
  lessonDateStart: string;
  lessonDateEnd: string | null;
  lessonTime: string;
  selfStudyTime: string;
  category: '수업' | '테스트';
  attendance: string;
  attitude: string;
  homework: string;
  test: string;
  vocabularyScore: number | null;
  schoolExamScore: number | null;
  feedback: string;
  sourceUpdatedAt: string;
  serverReceivedAt: string;
  serverUpdatedAt: string;
}

/**
 * 학생용 제한 응답 모델 (StudentLessonReportDTO)
 * - 학생 공개 필드: reportId, lessonDate, category, attendance, homework, vocabularyScore, schoolExamScore, assignmentContent
 * - 비공개 필드 (원천 배제): attitude, test, feedback, selfStudyTime, notionPageId, internalStudentId, studentKey
 */
export interface StudentLessonReportDTO {
  reportId: string; // 사이트 내부용 안전한 해시 ID
  lessonDate: string;
  category: '수업' | '테스트';
  attendance: string;
  homework: string;
  vocabularyScore: number | null;
  schoolExamScore: number | null;
  assignmentContent: string | null;
}

/**
 * 학부모용 전체 공개 응답 모델 (ParentLessonReportDTO)
 */
export interface ParentLessonReportDTO {
  reportId: string;
  lessonDateStart: string;
  lessonDateEnd: string | null;
  lessonTime: string;
  selfStudyTime: string;
  category: '수업' | '테스트';
  attendance: string;
  attitude: string;
  homework: string;
  test: string;
  vocabularyScore: number | null;
  schoolExamScore: number | null;
  feedback: string;
}

/**
 * 학생 및 학부모 화면 조회용 안전한 일정 DTO
 */
export interface StudentScheduleDTO {
  scheduleId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  scheduleType: string;
  status: '예정' | '완료' | '취소';
  notice: string | null;
}

/**
 * 학부모 매직 링크 토큰 정보 모델
 */
export interface MagicLinkRecord {
  tokenHash: string; // SHA-256(token)
  studentId: string;
  studentKey: string;
  studentDisplayName: string;
  parentPhonePinHash: string; // HMAC-SHA256(last4Digits, PHONE_PIN_PEPPER)
  studentPhonePinHash?: string;
  active: boolean;
  createdAt: string;
  expiresAt: string | null;
  revokedAt?: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
}

/**
 * 학부모 세션 모델
 */
export interface ParentSessionRecord {
  sessionHash: string;
  studentId: string;
  studentKey: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}
