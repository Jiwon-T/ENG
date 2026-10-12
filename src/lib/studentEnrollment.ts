import type { RegistrationSubject } from './studentRegistration';
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
        teachers: {
            id: string;
            name: string;
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
