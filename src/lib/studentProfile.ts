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
}
