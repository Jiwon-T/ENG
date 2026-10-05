export function wrongAnswers(value:any,correct:string,total:string,wrong:string):number|null {
 return value[wrong]??(value[correct]!=null&&value[total]!=null?value[total]-value[correct]:null);
}
export function testInputPatch(value:any,correct:string,total:string,wrong:string,key:string,number:number|null) {
 const mistakes=key===wrong?number:wrongAnswers(value,correct,total,wrong);
 const count=key===total?number:value[total]??null;
 return {[wrong]:mistakes,[total]:count,[correct]:mistakes==null||count==null?null:count-mistakes};
}
