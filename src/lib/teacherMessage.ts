import {studyLastEnd} from './sessionNumbers';
export function messageVariables(profile:any,lesson:any={}) {
 const score=(a:any,b:any)=>typeof a==='number'&&typeof b==='number'&&b>0?Math.round(a/b*100):undefined;
 return {'학생':profile.displayName,'학생 호칭':profile.studentSalutation||profile.displayName,'학생호칭':profile.studentSalutation||profile.displayName,'보호자이름':profile.guardianName,'학교':profile.school,'학년':profile.grade,'수강료':profile.tuition==null?undefined:profile.tuition.toLocaleString('ko-KR'),'납부기한':profile.paymentDeadline,'출결':lesson.attendance,'태도':lesson.attitude,'숙제':lesson.homework,'테스트':lesson.test,'단어':score(lesson.correct,lesson.total),'단어테스트 점수':score(lesson.correct,lesson.total),'테스트 점수':score(lesson.correct,lesson.total),'내신 대비 점수':score(lesson.examCorrect,lesson.examTotal),'내용 및 피드백':[lesson.content,lesson.note].filter(Boolean).join('\n'),'피드백':lesson.note,'틀린단어':lesson.wrong??(lesson.total!=null&&lesson.correct!=null?lesson.total-lesson.correct:undefined),'문항':lesson.examScorePercent?undefined:lesson.examTotal,'오답':lesson.examScorePercent?undefined:lesson.examWrong??(lesson.examTotal!=null&&lesson.examCorrect!=null?lesson.examTotal-lesson.examCorrect:undefined),'수업일':lesson.date,'과목':lesson.subject,'수업 시작':lesson.start,'수업 종료':lesson.end,'자습 시작':lesson.selfStudyStart,'자습 종료':studyLastEnd(lesson)} as Record<string,unknown>;
}
/** Lesson-result variables that are often blank. A line using one of them is left out when that lesson has no value,
 *  so one template works whether a lesson has a 테스트 score, a 내신 대비 score, both or neither. */
export const optionalLineVariables=['테스트','테스트 점수','내신 대비 점수','단어','단어테스트 점수','틀린단어','문항','오답','숙제','태도','피드백','자습 시작','자습 종료'];
const blank=(key:string,value:unknown)=>value===undefined||value===null||value===''||optionalLineVariables.includes(key)&&(value==='미확인'||value==='없는 날');
export function renderTeacherMessage(template:string,variables:Record<string,unknown>) {
 const missing:string[]=[],dropped:string[]=[];
 const text=template.replace(/<br\s*\/?\s*>/gi,'\n').replace(/\\([{}])/g,'$1');
 const lines=text.split('\n').filter(line=>{
  const empty=[...line.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(m=>m[1]).filter(key=>optionalLineVariables.includes(key)&&blank(key,variables[key]));
  if(empty.length)dropped.push(...empty);return !empty.length;
 });
 const body=lines.join('\n').replace(/\n{3,}/g,'\n\n').replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(_,key:string)=>{
 const value=variables[key];if(blank(key,value)){missing.push(key);return `{{${key}}}`;}return String(value);
 });return {body,missing:[...new Set(missing)],dropped:[...new Set(dropped)]};
}
export function unresolvedMessage(body:string){return /\{\{|\}\}|\\[{}]/.test(body);}

export type MessagePart={text:string;kind:'plain'|'filled'|'missing';key?:string};
const token=/\{\{\s*([^{}]+?)\s*\}\}/g;
/** Parts for any body (also after edits): only the still-empty {{변수}} are marked. */
export function missingParts(body:string):MessagePart[]{
 const parts:MessagePart[]=[];let last=0;
 for(const m of body.matchAll(token)){if(m.index!>last)parts.push({text:body.slice(last,m.index),kind:'plain'});parts.push({text:m[0],kind:'missing',key:m[1]});last=m.index!+m[0].length;}
 if(last<body.length)parts.push({text:body.slice(last),kind:'plain'});return parts;
}
/** The same result as renderTeacherMessage, split into parts so the preview can colour the values that came from the
 *  student or lesson ('filled') and the ones still empty ('missing'). Joining the parts gives the same body. */
export function renderTeacherMessageParts(template:string,variables:Record<string,unknown>):MessagePart[]{
 const {body}=renderTeacherMessage(template,variables);
 // Same template with every non-blank value swapped for a marker: the same lines drop and the same {{변수}} stay.
 const marked=renderTeacherMessage(template,new Proxy(variables,{get:(target,key)=>{const k=String(key),v=(target as any)[k];return blank(k,v)?v:`\u0000${k}\u0000`;}})).body;
 const parts:MessagePart[]=[];
 for(const piece of marked.split(/(\u0000[^\u0000]*\u0000)/)){
  if(!piece)continue;const marker=piece.match(/^\u0000([^\u0000]*)\u0000$/);
  if(marker)parts.push({text:String(variables[marker[1]]),kind:'filled',key:marker[1]});else parts.push(...missingParts(piece));
 }
 return parts.map(p=>p.text).join('')===body?parts:missingParts(body);
}
export function missingKeys(body:string){return [...new Set([...body.matchAll(token)].map(m=>m[1]))];}
/** Put a value into every {{key}} of the body. */
export function fillMessageVariable(body:string,key:string,value:string){return body.replace(token,(whole,name:string)=>name===key?value:whole);}
/** Korean SMS length: 2 bytes per non-ASCII letter; up to 90 bytes is 단문 (SMS), longer is 장문 (LMS, up to 2000 bytes). */
export function messageSize(body:string){
 const bytes=[...body.replace(/\r\n/g,'\n')].reduce((n,c)=>n+(c.charCodeAt(0)<128?1:2),0);
 return {bytes,kind:bytes<=90?'SMS' as const:'LMS' as const,limit:bytes<=90?90:2000,over:bytes>2000};
}
