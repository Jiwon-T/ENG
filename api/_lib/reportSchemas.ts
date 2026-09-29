import { z } from 'zod';

export const NotionReportWebhookSchema = z.object({
  schemaVersion: z.number().optional().default(1),
  notionPageId: z.string().min(1, 'notionPageId is required'),
  studentKey: z.string().min(1, 'studentKey is required'),
  lessonDateStart: z.string().min(1, 'lessonDateStart is required'),
  lessonDateEnd: z.string().nullable().optional(),
  lessonTime: z.string().optional().default(''),
  selfStudyTime: z.string().optional().default(''),
  category: z.enum(['수업', '테스트']).catch('수업'),
  attendance: z.string().optional().default(''),
  attitude: z.string().optional().default(''),
  homework: z.string().optional().default(''),
  test: z.string().optional().default(''),
  vocabularyScore: z.number().nullable().optional().default(null),
  schoolExamScore: z.number().nullable().optional().default(null),
  feedback: z.string().optional().default(''),
});

export type NotionReportWebhookPayload = z.infer<typeof NotionReportWebhookSchema>;

export const CreateReportSlugSchema = z.object({
  reportSlug: z.string()
    .min(3, '3자 이상이어야 합니다.')
    .max(30, '30자 이하여야 합니다.')
    .regex(/^[a-z0-9]{3,30}$/, '영문 소문자와 숫자만 사용할 수 있습니다. (공백/특수문자 불가)'),
  studentKey: z.string().min(1, '학생 식별자가 필요합니다.'),
});

export const VerifyPinSchema = z.object({
  reportSlug: z.string().regex(/^[a-z0-9]{3,30}$/, '유효하지 않은 리포트 주소 형식입니다.'),
  pin: z.string().regex(/^\d{4}$/, '보호자 전화번호 뒤 4자리를 정확히 입력해 주세요.'),
});

export interface StoredLessonReport {
  notionPageId: string;
  studentKey: string;
  studentId: string;
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

export interface StoredReportSlug {
  reportSlug: string;
  studentKey: string;
  studentId: string;
  parentPhonePinHash: string;
  active: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

export interface StudentLessonReportDTO {
  reportId: string;
  lessonDate: string;
  category: '수업' | '테스트';
  vocabularyScore: number | null;
  schoolExamScore: number | null;
}

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
