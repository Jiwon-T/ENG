import {emptyAdmission,type AdmissionInput} from './studentAdmission.js';
// Shared types only: browser code must never import the server module or node:crypto.
export const registrationSubjects = ['영어', '수학', '국어', '과학', '한국사'] as const;
export const registrationGrades = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'] as const;
export type RegistrationSubject = typeof registrationSubjects[number];
export interface RegistrationInput {
    purpose?: 'new' | 'additional';
    intakeStage?: 'consultation' | 'new';
    existingStudentKey?: string | null;
    admission?:AdmissionInput;
    name: string;
    school: string;
    grade: string;
    studentPhone: string;
    guardianPhone: string;
    guardianName: string;
    studentSalutation: string;
    guardianSalutation: string;
    tuition: number | null;
    paymentDeadline: string;
    enrollments: {
        subject: RegistrationSubject;
        status: '등록' | '대기' | '중단';
        startDate: string;
        endDate: string | null;
        teacherUid?: string | null;
        classIds?: string[];
    }[];
}
export type RegistrationSyncStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'uncertain';
export interface RegistrationSummary {
    sourceMode?:'notion'|'firestore';
    purpose?: 'new' | 'additional';
    intakeStage?: 'consultation' | 'new';
    existingStudentKey?: string | null;
    studentKey?: string | null;
    id: string;
    title: string;
    revision: number;
    syncStatus: RegistrationSyncStatus;
    updatedAt: number;
    canEdit?: boolean;
    studentSaved?: boolean;
    enrollmentSaved?: boolean;
    enrollments: Pick<RegistrationInput['enrollments'][number], 'subject' | 'status' | 'startDate'>[];
}
export interface RegistrationRecord extends RegistrationSummary {
    requestId: string;
    data: RegistrationInput;
}
export function emptyRegistration(): RegistrationInput {
    const today = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul'}).format(new Date());
    return {purpose:'new',intakeStage:'new',existingStudentKey:null,admission:emptyAdmission(),name:'', school:'', grade:'', studentPhone:'', guardianPhone:'', guardianName:'', studentSalutation:'', guardianSalutation:'', tuition:null, paymentDeadline:'', enrollments:[{subject:'영어', status:'등록', startDate:today, endDate:null}]};
}
export const registrationStatusLabels: Record<RegistrationSyncStatus, string> = {
    pending:'노션 반영 대기', syncing:'노션 반영 중', synced:'노션 반영 완료', failed:'노션 반영 실패', uncertain:'노션 결과 확인 필요',
};

export interface RegistrationOptions {
    teachers: {uid:string;name:string;subjects:RegistrationSubject[]}[];
    classes: {id:string;name:string;subject:RegistrationSubject;teacherUids:string[]}[];
}

