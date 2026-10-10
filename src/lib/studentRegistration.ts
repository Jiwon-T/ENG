import {emptyAdmission,type AdmissionInput} from './studentAdmission.js';
// Shared types only: browser code must never import the server module or node:crypto.
export const registrationSubjects = ['영어', '수학', '국어', '과학', '한국사'] as const;
// Highest grade first: most students are high-school.
export const registrationGrades = ['고3', '고2', '고1', '중3', '중2', '중1', '초6', '초5', '초4', '초3', '초2', '초1'] as const;
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
        tuition?: number | null;
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
    pending:'등록 대기', syncing:'등록 중', synced:'등록 완료', failed:'등록 실패', uncertain:'등록 결과 확인 필요',
};

export interface RegistrationOptions {
    teachers: {uid:string;name:string;subjects:RegistrationSubject[]}[];
    classes: {id:string;name:string;subject:RegistrationSubject;teacherUids:string[]}[];
}


/** Student 수강료 (8회 기준): the per-subject prices added up, or the single legacy value. */
export function registrationTuitionTotal(value: { tuition: number | null; enrollments: { tuition?: number | null }[] }) {
    const parts = value.enrollments.map(e => e.tuition).filter((n): n is number => typeof n === 'number');
    return parts.length ? parts.reduce((a, b) => a + b, 0) : value.tuition;
}
