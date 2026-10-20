export type SessionKind='lesson'|'study';
/** Returns integer tenths. Integer quotient rounding is half up. */
export function sessionIncrement(kind:SessionKind,minutes:number):number|null {
 if(!Number.isSafeInteger(minutes)||minutes<=0)return null;
 const divisor=kind==='lesson'?80:60;
 return Math.floor((minutes*20+divisor)/(divisor*2));
}
export function sessionMinutes(start:string,end:string):number|null {
 const valid=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s||'');
 if(!valid(start)||!valid(end))return null;
 const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const difference=minutes(end)-minutes(start);return difference>0?difference:null;
}
/** Extra 자습 pieces (자습을 나눠 할 때): the first piece stays in selfStudyStart/End, the others here. */
export type StudyPiece={start:string;end:string};
export const studyPieces=(d:any):StudyPiece[]=>[{start:d?.selfStudyStart||'',end:d?.selfStudyEnd||''},...(Array.isArray(d?.selfStudyMore)?d.selfStudyMore:[])];
/** All 자습 pieces together (30 + 30 minutes count like one 60-minute 자습); null while any piece is incomplete. */
export function studyMinutes(d:any):number|null{
 let total=0;for(const p of studyPieces(d)){const m=sessionMinutes(p.start,p.end);if(m===null)return null;total+=m;}return total;
}
/** "16:00–16:30, 18:20–18:50": every 자습 piece, for reviews, messages and the spreadsheet. */
export const studyTimeText=(d:any,dash='–')=>studyPieces(d).map(p=>`${p.start||'미입력'}${dash}${p.end||'미입력'}`).join(', ');
/** The end of the last 자습 piece. */
export const studyLastEnd=(d:any)=>{const pieces=studyPieces(d);return pieces[pieces.length-1].end;};
export const kindMinutes=(kind:SessionKind,d:any)=>kind==='lesson'?sessionMinutes(d?.start,d?.end):studyMinutes(d);
export function numberTenths(value:number):number|null {
 if(!Number.isFinite(value)||value<0)return null;
 const [whole,fraction='']=String(value).split('.');
 if(!/^\d+$/.test(whole)||!/^\d*$/.test(fraction))return null;
 const result=Number(whole)*10+Number(fraction[0]||0)+(Number(fraction[1]||0)>=5?1:0);
 return Number.isSafeInteger(result)?result:null;
}
export function formatSessionNumber(value:number):string {const tenths=numberTenths(value);return tenths===null?'':tenths%10===0?String(tenths/10):`${Math.floor(tenths/10)}.${tenths%10}`;}
/** Only counter metadata is added to the existing response; no other history content. */
export function sessionRecordSummaries(records:readonly any[]):any[] {
 const keys=['studentKey','subject','date','classSession','start','end','round','attendance','selfStudy','selfStudyStart','selfStudyEnd','selfStudyMore','selfStudyRound'];
 return records.map(r=>({id:r.id,stage:r.stage,archived:r.archived,deleteRequested:r.deleteRequested,updatedAt:r.updatedAt,data:Object.fromEntries(keys.map(key=>[key,(r.data??r)[key]]))}));
}
const absent=(d:any)=>d.attendance==='결석'||d.attendance==='보강 결석';
export function sessionHasIncrement(d:any,kind:SessionKind):boolean {
 const enabled=kind==='lesson'?d.classSession==='있음':d.selfStudy==='있음';
 const minutes=kindMinutes(kind,d);
 return enabled&&!absent(d)&&minutes!==null&&(sessionIncrement(kind,minutes)||0)>0;
}
/** The record the next counter builds on: the latest earlier attended record with a counter. An absent record
 *  (결석·보강 결석, normally +0) counts too when the teacher raised its counter by hand, but only within one lesson's
 *  worth above the counter before it (e.g. 2 -> 3 for an 80-minute lesson); any other number on an absent record
 *  (a typo or an old imported value) is ignored, as before. With sameMonth the walk restarts at 0 each month. */
function latestSessionRecord(records:readonly any[],input:any,kind:SessionKind,sameMonth:boolean):any {
 const startOf=(d:any)=>(kind==='lesson'?d.start:d.selfStudyStart)||'',roundOf=(d:any)=>numberTenths(kind==='lesson'?d.round:d.selfStudyRound);
 const earlier=records.filter(r=>!r.archived&&!r.deleteRequested&&r.stage!=='new').map(r=>({... (r.data??r),_updatedAt:r.updatedAt??r._updatedAt??0,_id:r.id??r._id??''}))
 .filter(d=>d.studentKey===input.studentKey&&d.subject===input.subject&&(d.date<input.date||d.date===input.date&&startOf(d)<startOf(input))&&(!sameMonth||d.date.slice(0,7)===input.date.slice(0,7))&&roundOf(d)!==null)
 .sort((a,b)=>a.date.localeCompare(b.date)||startOf(a).localeCompare(startOf(b))||Number(a._updatedAt)-Number(b._updatedAt)||String(a._id).localeCompare(String(b._id)));
 let base:any,month='';
 for(const d of earlier){
  if(sameMonth&&d.date.slice(0,7)!==month){month=d.date.slice(0,7);base=undefined;}
  if(sessionHasIncrement(d,kind)){base=d;continue;}
  const enabled=(kind==='lesson'?d.classSession:d.selfStudy)==='있음',minutes=kindMinutes(kind,d);
  if(!absent(d)||!enabled||minutes===null)continue;
  const before=base?roundOf(base)!:0,raised=roundOf(d)!;
  if(raised>before&&raised<=before+(sessionIncrement(kind,minutes)||0))base=d;
 }
 return base;
}
/** Monthly counters only accumulate within the same year and month. */
export function sessionBase(records:readonly any[],input:any,kind:SessionKind):any {
 return latestSessionRecord(records,input,kind,true);
}
export function nextSessionNumbers(records:readonly any[],input:any):{lesson:number|null;study:number|null} {
 const next=(kind:SessionKind)=>{if((kind==='lesson'?input.classSession:input.selfStudy)!=='있음')return null;
  const minutes=kindMinutes(kind,input);if(minutes===null)return null;
  // No earlier counted lesson of this student·subject at all (history not loaded, or a brand-new student): left empty.
  // A first 자습 after earlier lessons with only a 수업 회차 starts at 0, like a new month.
  const base=sessionBase(records,input,kind);if(!base&&!latestSessionRecord(records,input,'lesson',false)&&!latestSessionRecord(records,input,'study',false))return null;
  const tenths=(base?numberTenths(kind==='lesson'?base.round:base.selfStudyRound)!:0)+(absent(input)?0:sessionIncrement(kind,minutes)!);return tenths/10;
 };return {lesson:next('lesson'),study:next('study')};
}
export function autoSessionNumbers<T extends Record<string,any>>(data:T,records:readonly any[],touched:Iterable<string>=[],saved=false):{data:T;hints:Record<string,string>} {
 if(saved)return {data,hints:{}};
 const edited=new Set(touched),result=nextSessionNumbers(records,data),next:any={...data},hints:Record<string,string>={};
 for(const [kind,key] of [['lesson','round'],['study','selfStudyRound']] as const){
  if(edited.has(key))continue;
  if(result[kind]!==null){next[key]=result[kind];const base=sessionBase(records,data,kind);const minutes=kindMinutes(kind,data)!;
   const increment=formatSessionNumber(absent(data)?0:sessionIncrement(kind,minutes)!/10);
   hints[key]=base?`자동 입력 · 직전 ${formatSessionNumber(kind==='lesson'?base.round:base.selfStudyRound)}회차(${base.date.slice(5).replace('-','/')}) +${increment}`:`자동 입력 · ${data.date.slice(0,7)} 월별 시작 0 +${increment}`;
  }else{next[key]=null;
   // On but without times yet: still show the previous round so the teacher knows where it continues from.
   const enabled=kind==='lesson'?data.classSession==='있음':data.selfStudy==='있음',base=enabled&&kindMinutes(kind,data)===null?sessionBase(records,data,kind):undefined;
   if(base)hints[key]=`자동 입력 대기 · 직전 ${formatSessionNumber(kind==='lesson'?base.round:base.selfStudyRound)}회차(${base.date.slice(5).replace('-','/')}) · 시간 입력 필요`;
  }
 }return {data:next,hints};
}

/** Recalculate after relevant edits from the saved counter, never on opening. */
export function editedSessionNumbers<T extends Record<string,any>>(data:T,baseline:any,touched:Iterable<string>=[],records:readonly any[]=[]):T {
 if(!baseline)return data;
 const edited=new Set(touched),next:any={...data};
 for(const [kind,key,fields] of [['lesson','round',['start','end','classSession','attendance','date']],['study','selfStudyRound',['selfStudyStart','selfStudyEnd','selfStudy','attendance','date']]] as const){
  if(edited.has(key)||!fields.some(field=>!Object.is(data[field],baseline[field])))continue;
  const minutes=kindMinutes(kind,data);
  const oldMinutes=kindMinutes(kind,baseline);
  const old=numberTenths(baseline[key]);
  const enabled=(kind==='lesson'?data.classSession:data.selfStudy)==='있음';
  // Newly turned on (no counter or no times before): count from the earlier lessons, as for a new lesson.
  if(enabled&&minutes!==null&&(old===null||oldMinutes===null)){const fresh=nextSessionNumbers(records,data)[kind];if(fresh!==null)next[key]=fresh;continue;}
  if(minutes===null||oldMinutes===null||old===null||!enabled)continue;
  const base=data.date.slice(0,7)!==baseline.date.slice(0,7)?0:old-(sessionHasIncrement(baseline,kind)?sessionIncrement(kind,oldMinutes)!:0);
  if(base<0)continue;
  next[key]=(base+(absent(data)?0:sessionIncrement(kind,minutes)!))/10;
 }
 return next;
}
/** Short form of a round hint for the narrow 회차 field: "직전 6.7 +1" (or "월 첫 수업 +0.9" / "월 첫 자습 +1" by `title`); the full text stays as its tooltip. */
export function shortRoundHint(hint:string,title:'수업'|'자습'='수업'){
 const prev=hint.match(/^자동 입력 · 직전 ([\d.]+)회차\([^)]*\) \+([\d.]+)$/);if(prev)return `직전 ${prev[1]} +${prev[2]}`;
 const first=hint.match(/^자동 입력 · \d{4}-\d{2} 월별 시작 0 \+([\d.]+)$/);if(first)return `월 첫 ${title} +${first[1]}`;
 const waiting=hint.match(/^자동 입력 대기 · 직전 ([\d.]+)회차\([^)]*\) · 시간 입력 필요$/);if(waiting)return `직전 ${waiting[1]} · 시간 입력`;
 return hint;
}
/** 자습 switched to 있음 with no times yet: start at the end of the lesson and last 60 minutes (the academy's usual
 *  자습), so the round can be counted at once; the teacher can still change both times. */
export function withStudyDefaults<T extends Record<string,any>>(next:T,key:string):T{
 if(key!=='selfStudy'||next.selfStudy!=='있음'||next.selfStudyStart||next.selfStudyEnd)return next;
 const end=next.classSession==='있음'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(next.end||'')?next.end:'';if(!end)return next;
 const total=Math.min(Number(end.slice(0,2))*60+Number(end.slice(3))+60,23*60+59),hh=String(Math.floor(total/60)).padStart(2,'0'),mm=String(total%60).padStart(2,'0');
 return {...next,selfStudyStart:end,selfStudyEnd:`${hh}:${mm}`};
}
/** Earlier lessons fetched for one student·subject·date belong to the open lesson only while it still has that
 *  student, subject and date (the teacher may change the date while the request is running). */
export function sameLessonTarget(lesson:any,target:{studentKey?:string;subject?:string;date?:string}):boolean{
 return Boolean(lesson&&target.studentKey&&lesson.studentKey===target.studentKey&&lesson.subject===target.subject&&lesson.date===target.date);
}
