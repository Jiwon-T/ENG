export const admissionSubjects=['국어','영어','수학','과학'] as const;
export interface AdmissionInput {
 birthDate:string;address:string;referral:string;
 previousPeriod:string;previousAcademy:string;previousBooks:string;previousContent:string;
 /** 점수: free text (several 학기 at once, e.g. '1-1 92 / 1-2 88'); '' = not written */
 levels:{subject:typeof admissionSubjects[number];schoolScore:string;schoolGrade:string;mockScore:string;mockGrade:string;diagnostic:string}[];
 goal:string;availableDays:string[];availableTimes:string;notes:string;
 consent:'미확인'|'동의'|'미동의';consentDate:string;signerName:string;signedPaper:boolean;
}
export function emptyAdmission():AdmissionInput{return {birthDate:'',address:'',referral:'',previousPeriod:'',previousAcademy:'',previousBooks:'',previousContent:'',levels:admissionSubjects.map(subject=>({subject,schoolScore:'',schoolGrade:'',mockScore:'',mockGrade:'',diagnostic:''})),goal:'',availableDays:[],availableTimes:'',notes:'',consent:'미확인',consentDate:'',signerName:'',signedPaper:false};}
