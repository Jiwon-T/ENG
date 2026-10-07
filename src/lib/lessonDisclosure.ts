export const scoreFields=['correct','total','wrong','examCorrect','examTotal','examWrong'] as const;
export function hasFieldValue(value:any):boolean{return value!==null&&value!==undefined&&value!=='';}
export function scoreDisclosure(value:any,error=false):boolean{return error||scoreFields.some(key=>hasFieldValue(value[key]));}
export function studyDisclosure(value:any,error=false):boolean{return error||value.selfStudy==='있음'||['selfStudyStart','selfStudyEnd','selfStudyRound'].some(key=>hasFieldValue(value[key]));}
/** Presentation only: successful notices are not field-validation errors. */
export function fieldDisclosureError(message:unknown,kind:'study'|'scores'):boolean {
 return typeof message==='string'&&(kind==='study'?/자습|SELF_STUDY/.test(message):/오답|문항|정답|점수|테스트|examWrong|examTotal|examCorrect/.test(message));
}
