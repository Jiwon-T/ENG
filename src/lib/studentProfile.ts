export interface StudentProfileInput {
    displayName:string;
    school:string;
    grade:string;
    studentPhone:string;
    guardianPhone:string;
    guardianName:string;
    studentSalutation:string;
    tuition:number|null;
    paymentDeadline:string;
    /** 학원 등록일: the first day at the academy (YYYY-MM-DD, '' when unknown). */
    academyStartDate:string;
}
export interface StudentProfilePending {
    operationId:string;
    expectedEditedAt:string;
    data:StudentProfileInput;
    status:'syncing'|'failed'|'uncertain';
    canDiscard:boolean;
}
export interface StudentProfileRecord {
    studentKey:string;
    data:StudentProfileInput;
    editedAt:string;
    pending:StudentProfilePending|null;
    /** The earliest 과목 시작일, offered to fill an empty 학원 등록일. */
    firstSubjectStart?:string|null;
}
