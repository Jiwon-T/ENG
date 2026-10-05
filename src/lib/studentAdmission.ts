export const admissionSubjects=['국어','영어','수학','과학'] as const;
export interface AdmissionInput {
 birthDate:string;address:string;referral:string;
 previousPeriod:string;previousAcademy:string;previousBooks:string;previousContent:string;
 levels:{subject:typeof admissionSubjects[number];schoolScore:number|null;schoolGrade:string;mockScore:number|null;mockGrade:string;diagnostic:string}[];
 goal:string;availableDays:string[];availableTimes:string;notes:string;
 consent:'미확인'|'동의'|'미동의';consentDate:string;signerName:string;signedPaper:boolean;
}
export function emptyAdmission():AdmissionInput{return {birthDate:'',address:'',referral:'',previousPeriod:'',previousAcademy:'',previousBooks:'',previousContent:'',levels:admissionSubjects.map(subject=>({subject,schoolScore:null,schoolGrade:'',mockScore:null,mockGrade:'',diagnostic:''})),goal:'',availableDays:[],availableTimes:'',notes:'',consent:'미확인',consentDate:'',signerName:'',signedPaper:false};}
