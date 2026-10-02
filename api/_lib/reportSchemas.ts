import { z } from 'zod';

export const RESERVED_SLUGS = new Set([
  // 시스템 및 공통 예약어
  'api',
  'admin',
  'teacher',
  'student',
  'parent',
  'report',
  'reports',
  'login',
  'logout',
  'signup',
  'register',
  'home',
  'profile',
  'settings',
  'archive',
  'analyzer',
  'generator',
  'library',
  'auth',
  'callback',
  'assets',
  'static',
  'favicon',
  'robots',
  'sitemap',
  'manifest',
  'health',
  // App.tsx 라우트 / 뷰 키워드
  'vocab',
  'grammar',
  'exam',
  'tutor',
  'teacher-room',
  'pet',
  // public 정적 파일명
  'sw',
  'icon',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase().trim());
}

export const NotionReportWebhookSchema = z.object({
  schemaVersion: z.number().optional().default(1),
  notionPageId: z.string().min(1, 'notionPageId is required'),
  notionStudentPageId: z.string().min(1, 'notionStudentPageId is required'),
  studentKey: z.string().optional(),
  lessonDateStart: z.string().min(1, 'lessonDateStart is required'),
  lessonDateEnd: z.string().nullable().optional(),
  lessonTime: z.string().optional().default(''),
  selfStudyTime: z.string().optional().default(''),
  subject: z.string().optional().default('영어'),
  category: z.enum(['수업', '테스트']).catch('수업'),
  attendance: z.string().optional().default(''),
  attitude: z.string().optional().default(''),
  homework: z.string().optional().default(''),
  test: z.string().optional().default(''),
  vocabularyScore: z.number().nullable().optional().default(null),
  schoolExamScore: z.number().nullable().optional().default(null),
  feedback: z.string().optional().default(''),
  sourceUpdatedAt: z.string().optional(),
});

export type NotionReportWebhookPayload = z.infer<typeof NotionReportWebhookSchema>;

export const CreateReportSlugSchema = z.object({
  reportSlug: z.string()
    .min(3, '3자 이상이어야 합니다.')
    .max(30, '30자 이하여야 합니다.')
    .regex(/^[a-z0-9]{3,30}$/, '영문 소문자와 숫자만 사용할 수 있습니다. (공백/특수문자 불가)')
    .refine((slug) => !isReservedSlug(slug), {
      message: '시스템 예약어로 지정된 단어는 리포트 주소로 사용할 수 없습니다.',
    }),
  studentKey: z.string().min(1, '학생 식별자가 필요합니다.'),
});

export const PatchReportSlugSchema = z.object({
  reportSlug: z.string().regex(/^[a-z0-9]{3,30}$/, '유효한 슬러그 형식이 아닙니다.'),
  active: z.boolean().optional(),
  newReportSlug: z.string()
    .min(3, '3자 이상이어야 합니다.')
    .max(30, '30자 이하여야 합니다.')
    .regex(/^[a-z0-9]{3,30}$/, '영문 소문자와 숫자만 사용할 수 있습니다.')
    .refine((slug) => !isReservedSlug(slug), {
      message: '시스템 예약어로 지정된 단어는 리포트 주소로 사용할 수 없습니다.',
    })
    .optional(),
});

export const DeleteReportSlugSchema = z.object({
  reportSlug: z.string().regex(/^[a-z0-9]{3,30}$/, '유효한 슬러그 형식이 아닙니다.'),
});

export const VerifyPinSchema = z.object({
  reportSlug: z.string().regex(/^[a-z0-9]{3,30}$/, '유효하지 않은 리포트 주소 형식입니다.'),
  pin: z.string().regex(/^\d{4}$/, '보호자 전화번호 뒤 4자리를 정확히 입력해 주세요.'),
});

/**
 * 관리자 전용 학생 계정 연결/해제 스키마
 */
export const LinkStudentAccountSchema = z.object({
  firebaseUid: z.string().min(1, 'firebaseUid is required'),
  studentKey: z.string().min(1, 'studentKey is required'),
});

export const UnlinkStudentAccountSchema = z.object({
  firebaseUid: z.string().min(1, 'firebaseUid is required'),
});

/**
 * Make 및 수업일지 저장 모델:
 * internalStudentId: SHA-256(Notion 학생 페이지 ID)
 */
export interface StoredLessonReport {
  subject?: string;
  notionPageId: string;
  studentKey: string;
  internalStudentId: string;
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
  derivedAssignment?: string | null;
  sourceUpdatedAt: string;
  serverReceivedAt: string;
  serverUpdatedAt: string;
}

/**
 * Notion 학생 매핑 모델 (서버 전용: notionStudentMappings/{studentKeyHash})
 */
export interface StoredNotionStudentMapping {
  internalStudentId: string;
  studentKey: string;
  studentDisplayName: string;
  notionStudentPageId: string;
  firebaseUid: string | null;
  linkedByAdminUid?: string;
  linkedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 고정 주소 모델:
 * studentDisplayName: 학부모 화면 표시용
 * studentKey: 서버 내부 매핑용
 */
export interface StoredReportSlug {
  reportSlug: string;
  studentKey: string;
  studentDisplayName: string;
  internalStudentId: string;
  parentPhonePinHash: string;
  active: boolean;
  authVersion: number;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
}

/**
 * 학생별 활성 슬러그 관리 모델 (studentReportMappings/{internalStudentId})
 */
export interface StudentReportMapping {
  internalStudentId: string;
  studentKey: string;
  activeReportSlug: string | null;
  updatedAt: string;
}

/**
 * 학생 로그인 시 반환하는 오프라인 수업 제한 DTO (StudentLessonReportDTO)
 * - 학생 공개 필드: reportId, lessonDate, category, attendance, homework, vocabularyScore, schoolExamScore, assignmentContent
 * - 비공개 필드 (원천 배제): attitude, test, feedback, selfStudyTime, notionPageId, internalStudentId, studentKey
 */
export interface StudentLessonReportDTO {
  subject?: string;
  reportId: string;
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
 * 학부모 리포트 DTO (내부 notionPageId 대신 해시 ID 반환, 전체 feedback 유지)
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
 * ----------------------------------------------------
 * Notion 일정 동기화 및 일정 DTO 스키마
 * ----------------------------------------------------
 */

export const NotionScheduleWebhookSchema = z.object({
  schemaVersion: z.number().optional().default(1),
  notionScheduleId: z.string().min(1, 'notionScheduleId is required'),
  // Legacy display keys exist only for mixed-version rollout; IDs always take precedence.
  studentKeys: z.array(z.string().min(1, 'studentKey cannot be empty')).optional(),
  notionStudentPageIds: z.array(z.string().regex(/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i)).optional(),
  title: z.string().min(1, 'title is required'),
  startAt: z.string().min(1, 'startAt is required'),
  endAt: z.string().nullable().optional(),
  subject: z.string().optional().default('영어'),
  scheduleType: z.string().optional().default('정규 수업'),
  status: z.enum(['예정', '완료', '취소']).catch('예정'),
  notice: z.string().nullable().optional(),
  sourceUpdatedAt: z.string().optional(),
}).refine(data => data.notionStudentPageIds !== undefined || (data.studentKeys?.length || 0) > 0, { message: 'Student page IDs are required.' });

export type NotionScheduleWebhookPayload = z.infer<typeof NotionScheduleWebhookSchema>;

/**
 * Firestore studentSchedules 컬렉션 저장 모델
 * 문서 ID: hash(notionScheduleId + ':' + internalStudentId)
 */
export interface StoredStudentSchedule {
  subject?: string;
  scheduleDocId: string;
  notionScheduleId: string;
  internalStudentId: string;
  studentKey: string;
  title: string;
  startAt: string;
  endAt: string | null;
  scheduleType: string;
  status: '예정' | '완료' | '취소';
  notice: string | null;
  sourceUpdatedAt: string;
  serverReceivedAt: string;
  serverUpdatedAt: string;
  completedAt?: string | null;
}

/**
 * 학생 및 학부모 화면 조회용 안전한 일정 DTO
 * 내부 식별자(notionScheduleId, internalStudentId, studentKey) 원천 배제
 */
export interface StudentScheduleDTO {
  subject?: string;
  scheduleId: string; // scheduleDocId
  title: string;
  startAt: string;
  endAt: string | null;
  scheduleType: string;
  status: '예정' | '완료' | '취소';
  notice: string | null;
  completedAt?: string | null;
}
