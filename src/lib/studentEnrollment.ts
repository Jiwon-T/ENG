import type { RegistrationSubject } from './studentRegistration';
export interface EnrollmentInput {
    subject: RegistrationSubject;
    status: '등록' | '대기' | '중단';
    startDate: string;
    endDate: string | null;
    addTeacherUid: string | null;
    removeTeacherIds: string[];
    classIds: string[];
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
        teachers: {
            id: string;
            name: string;
        }[];
        classes: {
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
