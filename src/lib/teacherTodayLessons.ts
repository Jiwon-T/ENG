export interface TodayLesson {
 id:string; title:string; kind:string; subject:string; date:string;
 start:string; end:string; students:string[];
 /** lesson: a class (정규·보강…); test: 3차시 테스트 (no class, 자습·테스트 only); study: 자습 only. */
 session?:'lesson'|'test'|'study';
 /** Self-study registered on the timetable for this lesson, per student. */
 study?:Record<string,{start:string;end:string}>;
}
// '시험' was renamed '테스트'.
export const scheduleKindLabel=(kind:string)=>kind==='시험'?'테스트':kind;
const sessionOfKind=(kind:string)=>kind==='자습'?'study':kind==='테스트'||kind==='시험'?'test':'lesson';
/** Which students a timetable line is for (a line may name only some of the class). */
export function slotStudents(c:any,slot:any):string[]{const all=c.students||[];return slot?.students?.length?slot.students.filter((key:string)=>all.includes(key)):all;}
/** Self-study per student for a lesson line: the first block that names the student, or a block for everyone. */
export function slotStudy(c:any,slot:any):Record<string,{start:string;end:string}>{
 const out:Record<string,{start:string;end:string}>={};if(slot?.kind==='test')return out;
 for(const block of slot?.study||[])for(const key of block.students?.length?block.students:slotStudents(c,slot))if(!out[key])out[key]={start:block.start,end:block.end};
 return out;
}
/** Lesson-form fields to pre-fill when a today item is opened for one student. */
export function sessionSeed(event:Pick<TodayLesson,'start'|'end'|'session'|'study'>,studentKey:string){
 if(event.session==='test'||event.session==='study')return {start:'',end:'',round:null,classSession:'없음',selfStudy:'있음',selfStudyStart:event.start,selfStudyEnd:event.end};
 const study=event.study?.[studentKey];
 return study?{classSession:'있음',selfStudy:'있음',selfStudyStart:study.start,selfStudyEnd:study.end}:{};
}
export function todayLessons(data:any,date:string,schedules:any[]=[],reflected:any[]=[]):TodayLesson[] {
 const permitted=(key:string,subject:string)=>data.admin||(data.teachingScopes||data.scopes||[]).some((s:any)=>s.studentKey===key&&s.subject===subject);
 const visible=(students:string[],subject:string)=>[...new Set(students||[])].filter(key=>permitted(key,subject));
 const weekday=new Date(`${date}T00:00:00Z`).getUTCDay();
 const regular=(data.classes||[]).filter((c:any)=>c.status!=='중단'&&(data.admin||c.ownerUid===data.uid||(c.assignedUids||[]).includes(data.uid))).flatMap((c:any)=>(c.slots||[]).filter((s:any)=>s.status!=='중단'&&s.weekday===weekday).map((s:any,i:number)=>{const test=s.kind==='test';return {id:`regular:${c.id}:${s.id||i}`,title:c.name,kind:test?'테스트':'정규',subject:c.subject,date,start:s.start,end:s.end,students:visible(slotStudents(c,s),c.subject),session:test?'test':'lesson',...(test?{}:{study:slotStudy(c,s)})} as TodayLesson;}));
 const sources=new Set(schedules.map(r=>(r.notionPageId||r.id||'').replace(/-/g,'')));
 const events=schedules.filter(r=>!r.archived&&!r.deleteRequested&&r.data?.date===date&&['예정','변경','완료'].includes(r.data.status)).map(r=>({id:`schedule:${r.id}`,title:r.data.title||'예정 수업',kind:scheduleKindLabel(r.data.kind||'일정'),session:sessionOfKind(r.data.kind||''),subject:r.data.subject,date,start:r.data.start,end:r.data.end,students:visible(r.data.students,r.data.subject)} as TodayLesson));
 const copies=reflected.filter(r=>r.date===date&&['예정','변경','완료'].includes(r.status)&&!sources.has((r.notionPageId||r.appScheduleId||'').replace(/-/g,''))).map(r=>({id:`reflected:${r.id}`,title:r.title||'예정 수업',kind:scheduleKindLabel(r.kind||'일정'),session:sessionOfKind(r.kind||''),subject:r.subject,date,start:r.start,end:r.end,students:visible(r.students,r.subject)} as TodayLesson));
 return [...regular,...events,...copies].filter(r=>r.students.length&&r.start&&r.end).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
export const previousLessonAssessmentFields=['attendance','attitude','homework','test','correct','total','wrong','examCorrect','examTotal','examWrong'] as const;
export const previousLessonFields=['round','selfStudyRound','content','assignment','examScope',...previousLessonAssessmentFields] as const;
export function applyPreviousLesson<T extends Record<string,any>>(current:T,seed:T,previous:any,touched:Iterable<string>=[]):T {
 if(current.studentKey!==seed.studentKey||current.subject!==seed.subject||current.date!==seed.date)return current;
 const edited=new Set(touched);const next:any={...current};
 for(const field of previousLessonFields){
  if(Array.isArray(previous.sessionRecords)&&(field==='round'||field==='selfStudyRound'))continue;
  if(edited.has(field))continue;
  if(previousLessonAssessmentFields.includes(field as any)&&previous[field]===undefined)continue;
  const scoreGroup=['correct','total','wrong'].includes(field)?['correct','total','wrong']:['examCorrect','examTotal','examWrong'].includes(field)?['examCorrect','examTotal','examWrong']:[];
  if(scoreGroup.some(key=>edited.has(key)||!Object.is(current[key],seed[key])))continue;
  if(field==='round'&&current.classSession==='없음'||field==='selfStudyRound'&&current.selfStudy==='없음')continue;
  if(Object.is(current[field],seed[field]))next[field]=previous[field]??(field==='content'||field==='assignment'||field==='examScope'?'':null);
 }
 // Retain this session's dates and times; never overwrite manually edited fields.
 if(!Array.isArray(previous.sessionRecords)&&previous.selfStudyRound!==null&&previous.selfStudyRound!==undefined&&!edited.has('selfStudy')&&current.selfStudy===seed.selfStudy&&current.selfStudy==='미확인')next.selfStudy='있음';
 return next;
}
export function previousLessonValues(previous:any) {
 const assessment:Partial<Record<(typeof previousLessonAssessmentFields)[number],any>>=Object.fromEntries(previousLessonAssessmentFields.filter(key=>previous[key]!==undefined).map(key=>[key,previous[key]]));
 return {round:previous.round??null,selfStudyRound:previous.selfStudyRound??null,content:previous.content||'',assignment:previous.assignment||'',examScope:previous.examScope||'',...assessment};
}
export function latestPreviousLesson(records:any[],studentKey:string,subject:string,date?:string) {
 return records.filter(r=>!r.archived&&!r.deleteRequested&&r.data?.studentKey===studentKey&&r.data.subject===subject&&(!date||r.data.date<=date))
 .sort((a,b)=>(b.data.date||'').localeCompare(a.data.date||'')||(b.updatedAt||0)-(a.updatedAt||0))[0]?.data;
}
