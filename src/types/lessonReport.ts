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
  /** The 테스트 점수's name from the 일지 (단어, 모의고사 …); empty: just 테스트. */
  testName?: string;
  /** The other tests of that day (벼락치기 85 …), after the first one above. */
  extraScores?: { name: string; score: number }[];
  schoolExamScore: number | null;
  /** The other 내신 대비 tests of that day, after the first one above. */
  examExtraScores?: number[];
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
  /** The 테스트 점수's name from the 일지 (단어, 모의고사 …); empty: just 테스트. */
  testName?: string;
  schoolExamScore: number | null;
  assignmentContent: string | null;
  assignmentCompleted?: boolean;
  /** 선생님이 확인한 과제: the 숙제 평가 the next graded lesson of the subject gave it (null: passed without one), and that day */
  assignmentGrade?: { grade: string | null; date: string; /** written again in a later 일지: listed there, not here */ carried?: true } | null;
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
  /** The 테스트 점수's name from the 일지 (단어, 모의고사 …); empty: just 테스트. */
  testName?: string;
  /** The other tests of that day (벼락치기 85 …), after the first one above. */
  extraScores?: { name: string; score: number }[];
  schoolExamScore: number | null;
  /** The other 내신 대비 tests of that day, after the first one above. */
  examExtraScores?: number[];
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
