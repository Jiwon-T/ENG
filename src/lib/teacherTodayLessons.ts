export interface TodayLesson {
 id:string; title:string; kind:string; subject:string; date:string;
 start:string; end:string; students:string[];
}
export function todayLessons(data:any,date:string,schedules:any[]=[],reflected:any[]=[]):TodayLesson[] {
 const permitted=(key:string,subject:string)=>data.admin||(data.teachingScopes||data.scopes||[]).some((s:any)=>s.studentKey===key&&s.subject===subject);
 const visible=(students:string[],subject:string)=>[...new Set(students||[])].filter(key=>permitted(key,subject));
 const weekday=new Date(`${date}T00:00:00Z`).getUTCDay();
 const regular=(data.classes||[]).filter((c:any)=>c.status!=='중단'&&(data.admin||c.ownerUid===data.uid||(c.assignedUids||[]).includes(data.uid))).flatMap((c:any)=>(c.slots||[]).filter((s:any)=>s.status!=='중단'&&s.weekday===weekday).map((s:any,i:number)=>({id:`regular:${c.id}:${s.id||i}`,title:c.name,kind:'정규',subject:c.subject,date,start:s.start,end:s.end,students:visible(c.students,c.subject)})));
 const sources=new Set(schedules.map(r=>(r.notionPageId||r.id||'').replace(/-/g,'')));
 const events=schedules.filter(r=>!r.archived&&!r.deleteRequested&&r.data?.date===date&&r.data.status==='예정').map(r=>({id:`schedule:${r.id}`,title:r.data.title||'예정 수업',kind:r.data.kind||'일정',subject:r.data.subject,date,start:r.data.start,end:r.data.end,students:visible(r.data.students,r.data.subject)}));
 const copies=reflected.filter(r=>r.date===date&&r.status==='예정'&&!sources.has((r.notionPageId||'').replace(/-/g,''))).map(r=>({id:`reflected:${r.id}`,title:r.title||'예정 수업',kind:r.kind||'일정',subject:r.subject,date,start:r.start,end:r.end,students:visible(r.students,r.subject)}));
 return [...regular,...events,...copies].filter(r=>r.students.length&&r.start&&r.end).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
export const previousLessonFields=['round','selfStudyRound','content','assignment','examScope'] as const;
export function applyPreviousLesson<T extends Record<string,any>>(current:T,seed:T,previous:any,touched:Iterable<string>=[]):T {
 if(current.studentKey!==seed.studentKey||current.subject!==seed.subject||current.date!==seed.date)return current;
 const edited=new Set(touched);const next:any={...current};
 for(const field of previousLessonFields){
  if(Array.isArray(previous.sessionRecords)&&(field==='round'||field==='selfStudyRound'))continue;
  if(edited.has(field))continue;
  if(field==='round'&&current.classSession==='없음'||field==='selfStudyRound'&&current.selfStudy==='없음')continue;
  if(Object.is(current[field],seed[field]))next[field]=previous[field]??(field==='content'||field==='assignment'||field==='examScope'?'':null);
 }
 // Show the carried study round; retain this session's dates, times and evaluations.
 if(!Array.isArray(previous.sessionRecords)&&previous.selfStudyRound!==null&&previous.selfStudyRound!==undefined&&!edited.has('selfStudy')&&current.selfStudy===seed.selfStudy&&current.selfStudy==='미확인')next.selfStudy='있음';
 return next;
}
export function previousLessonValues(previous:any) {
 return {round:previous.round??null,selfStudyRound:previous.selfStudyRound??null,content:previous.content||'',assignment:previous.assignment||'',examScope:previous.examScope||''};
}
export function latestPreviousLesson(records:any[],studentKey:string,subject:string,date?:string) {
 return records.filter(r=>!r.archived&&!r.deleteRequested&&r.data?.studentKey===studentKey&&r.data.subject===subject&&(!date||r.data.date<=date))
 .sort((a,b)=>(b.data.date||'').localeCompare(a.data.date||'')||(b.updatedAt||0)-(a.updatedAt||0))[0]?.data;
}
