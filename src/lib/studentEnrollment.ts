import type { RegistrationCampus, RegistrationSubject } from './studentRegistration';
/** Why an existing teacher is taken off a subject (담당 변경). Seen only by the principal and admin. */
export const teacherTransferReasons = ['이사·캠퍼스 이동', '시간 변경', '학생·학부모 요청', '학원 사정', '기타'] as const;
export type TeacherTransferReason = typeof teacherTransferReasons[number];
export interface EnrollmentInput {
    subject: RegistrationSubject;
    status: '등록' | '대기' | '중단';
    startDate: string;
    endDate: string | null;
    addTeacherUid: string | null;
    removeTeacherIds: string[];
    classIds: string[];
    /** 중단 예약: planned stop date while still 등록 (a reminder; the stop is confirmed by hand). */
    plannedEndDate?: string | null;
    /** Required when an existing teacher is removed and the subject is not stopped; the note only with 기타 (optional). */
    transferReason?: TeacherTransferReason | null;
    transferNote?: string;
    /** This subject's campus; left out = keep the stored one, null = none. */
    campus?: RegistrationCampus | null;
}
export interface EnrollmentRecord {
    studentKey: string;
    enrollmentId: string;
    studentEditedAt: string;
    enrollmentEditedAt: string;
    subjects: {
        subject: RegistrationSubject;
        status: string;
        startDate: string | null;
        endDate: string | null;
        plannedEndDate?: string | null;
        campus?: string | null;
        /** 수강 이력 (등록 · 중단 · 재시작 · 담당 변경), oldest first. */
        history?: { date: string; kind: string; text: string }[];
        teachers: {
            id: string;
            name: string;
            /** The teacher's account (null for an old row without one) and their 담당 시작일. */
            uid?: string | null;
            since?: string | null;
        }[];
        classes: {
            withdrawalReview?: boolean;
            id: string;
            name: string;
        }[];
    }[];
    pending: null | {
        operationId: string;
        studentEditedAt: string;
        enrollmentEditedAt: string;
        data: EnrollmentInput;
        status: string;
        canDiscard: boolean;
    };
}
