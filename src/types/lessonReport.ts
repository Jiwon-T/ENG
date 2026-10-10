import { z } from 'zod';

/**
 * (예전) Make가 보내던 일지 페이로드 모양 — 웹훅은 제거됨, 저장된 옛 기록을 읽을 때의 형태 참고용
 */
export const NotionReportWebhookSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  notionPageId: z.string().min(1, 'notionPageId is required'),
  notionStudentPageId: z.string().min(1, 'notionStudentPageId is required'),
  studentKey: z.string().min(1, 'studentKey is required'),
  lessonDateStart: z.string().min(1, 'lessonDateStart is required'), // ISO 8601
  lessonDateEnd: z.string().nullable().optional(),
  lessonTime: z.string().nullable().optional(),
  selfStudyTime: z.string().nullable().optional(),
  subject: z.string().optional().default('영어'),
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
  subject?: string;
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
  subject?: string;
  reportId: string; // 사이트 내부용 안전한 해시 ID
  lessonDate: string;
  category: '수업' | '테스트';
  attendance: string;
  homework: string;
  vocabularyScore: number | null;
  schoolExamScore: number | null;
  assignmentContent: string | null;
  assignmentCompleted?: boolean;
}

/**
 * 학부모용 전체 공개 응답 모델 (ParentLessonReportDTO)
 */
export interface ParentLessonReportDTO {
  subject?: string;
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
  subject?: string;
  scheduleId: string;
  title: string;
  startAt: string;
  endAt: string | null;
  scheduleType: string;
  status: '예정' | '완료' | '취소';
  notice: string | null;
  completedAt?: string | null;
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
