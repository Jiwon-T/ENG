export const schoolExamDetails=['1학기 중간고사','1학기 기말고사','2학기 중간고사','2학기 기말고사'] as const;
export const assessmentDetails=['3월','6월','9월'] as const;
export function detailMetadata(detail:string){
 const match=detail.match(/^([12])학기 (중간고사|기말고사)$/);
 return match?{semester:Number(match[1]),examPeriod:match[2]}:{semester:null,examPeriod:null};
}
export function examDetail(value:any){
 if(value.examDetail)return value.examDetail;
 return value.examType==='학교 내신'&&[1,2].includes(value.semester)&&value.examPeriod?`${value.semester}학기 ${value.examPeriod}`:'';
}
export function examPeriod(value:any) {
 const title=String(value.title||'');
 const detail=detailMetadata(value.examDetail||'');
 const semester=detail.semester??value.semester??Number(title.match(/([12])\s*학기/)?.[1]||title.match(/-([12])\s*(?:중간|기말)/)?.[1]||0);
 const period=detail.examPeriod||value.examPeriod||(title.includes('중간')?'중간고사':title.includes('기말')?'기말고사':'');
 const year=value.examYear||Number(String(value.examDate||'').slice(0,4));
 return value.examType==='학교 내신'&&year&&[1,2].includes(semester)&&period?{year,semester,period,key:`${year}-${semester}-${period}`,label:`${String(year).slice(-2)}년도 ${semester}학기 ${period}`}:null;
}

export function examLabel(value:any){
 const period=examPeriod(value);if(period)return period.label;
 const detail=examDetail(value),year=value.examYear||Number(String(value.examDate||'').slice(0,4));
 return detail?`${year?`${String(year).slice(-2)}년도 `:''}${detail}${value.examType==='학력평가'?' 학력평가':''}`:value.examType;
}
/** Title from the chips. With a school tag it follows the academy's habit ("세교중2" + 2학기 중간고사 → "세교중2-2중간");
 * otherwise "2026 1학기 중간고사" / "2026 6월 학력평가". Empty when unclassified. */
export function suggestedExamTitle(value:any,schoolTag=''){
 const detail=value.examDetail||'';if(!detail)return '';
 const meta=detailMetadata(detail),tag=schoolTag.trim();
 if(value.examType==='학교 내신'&&tag&&meta.semester)return `${tag}-${meta.semester}${String(meta.examPeriod).slice(0,2)}`;
 const year=value.examYear?`${value.examYear} `:'';
 return value.examType==='학력평가'?`${year}${detail} 학력평가`:`${year}${detail}`;
}
/** Keeps the title following the chips until the teacher types their own. */
export function withSuggestedTitle(old:any,next:any,oldTag='',nextTag=oldTag){
 return !old.title||old.title===suggestedExamTitle(old,oldTag)?{...next,title:suggestedExamTitle(next,nextTag)}:next;
}
/** School tag from a title written in that habit ("세교중2-2중간" → "세교중2"). */
export function schoolTagOf(title:string){return String(title||'').match(/^(.+?)-[12]\s*(?:중간|기말)/)?.[1]?.trim()||'';}
/** Tag from student management: "세교중학교" + "중2" → "세교중2". */
export function schoolTagFrom(school:string,grade:string){
 const name=String(school||'').trim().replace(/\s+/g,'').replace(/초등학교$/,'초').replace(/중학교$/,'중').replace(/고등학교$/,'고').replace(/학교$/,'');
 const year=String(grade||'').match(/\d/)?.[0]||'';
 return name?name+year:'';
}
