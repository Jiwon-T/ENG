/** Existing stored strings, in their original order. */
export const attendanceOptions = ['미확인','출석','결석','지각','보강 출석','보강 결석','보강 지각'] as const;
export const attitudeOptions = ['미확인','미참여','하','중하','중','중상','상','최상'] as const;
export const evaluationOptions = ['없는 날','미확인','미제출','최하','하','중하','중','중상','상','최상'] as const;
export const lessonOptionGroups = [
 {key:'attendance',label:'출결',options:attendanceOptions},
 {key:'attitude',label:'태도',options:attitudeOptions},
 {key:'homework',label:'숙제',options:evaluationOptions,splitAt:3},
 {key:'test',label:'테스트',options:evaluationOptions,splitAt:3},
] as const;
export function lessonOptionTone(value:string){
 if(value.includes('출석')||value==='상'||value==='최상')return 'green';
 if(value.includes('결석')||value==='최하'||value==='하')return 'red';
 if(value.includes('지각'))return 'yellow';
 return 'neutral';
}
