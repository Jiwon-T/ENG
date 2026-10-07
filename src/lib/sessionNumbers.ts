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
 const keys=['studentKey','subject','date','classSession','start','end','round','attendance','selfStudy','selfStudyStart','selfStudyEnd','selfStudyRound'];
 return records.map(r=>({id:r.id,stage:r.stage,archived:r.archived,deleteRequested:r.deleteRequested,updatedAt:r.updatedAt,data:Object.fromEntries(keys.map(key=>[key,(r.data??r)[key]]))}));
}
const absent=(d:any)=>d.attendance==='결석'||d.attendance==='보강 결석';
export function sessionHasIncrement(d:any,kind:SessionKind):boolean {
 const enabled=kind==='lesson'?d.classSession==='있음':d.selfStudy==='있음';
 const minutes=sessionMinutes(kind==='lesson'?d.start:d.selfStudyStart,kind==='lesson'?d.end:d.selfStudyEnd);
 return enabled&&!absent(d)&&minutes!==null&&(sessionIncrement(kind,minutes)||0)>0;
}
function latestSessionRecord(records:readonly any[],input:any,kind:SessionKind,sameMonth:boolean):any {
 return records.filter(r=>!r.archived&&!r.deleteRequested&&r.stage!=='new').map(r=>({... (r.data??r),_updatedAt:r.updatedAt??r._updatedAt??0,_id:r.id??r._id??''}))
 .filter(d=>d.studentKey===input.studentKey&&d.subject===input.subject&&(d.date<input.date||d.date===input.date&&(kind==='lesson'?d.start:d.selfStudyStart)<(kind==='lesson'?input.start:input.selfStudyStart))&&(!sameMonth||d.date.slice(0,7)===input.date.slice(0,7))&&sessionHasIncrement(d,kind)&&numberTenths(kind==='lesson'?d.round:d.selfStudyRound)!==null)
 .sort((a,b)=>b.date.localeCompare(a.date)||(kind==='lesson'?b.start:b.selfStudyStart).localeCompare(kind==='lesson'?a.start:a.selfStudyStart)||Number(b._updatedAt)-Number(a._updatedAt)||String(b._id).localeCompare(String(a._id)))[0];
}
/** Monthly counters only accumulate within the same year and month. */
export function sessionBase(records:readonly any[],input:any,kind:SessionKind):any {
 return latestSessionRecord(records,input,kind,true);
}
export function nextSessionNumbers(records:readonly any[],input:any):{lesson:number|null;study:number|null} {
 const next=(kind:SessionKind)=>{if((kind==='lesson'?input.classSession:input.selfStudy)!=='있음')return null;
  const minutes=sessionMinutes(kind==='lesson'?input.start:input.selfStudyStart,kind==='lesson'?input.end:input.selfStudyEnd);if(minutes===null)return null;
  const base=sessionBase(records,input,kind);if(!base&&!latestSessionRecord(records,input,kind,false))return null;
  const tenths=(base?numberTenths(kind==='lesson'?base.round:base.selfStudyRound)!:0)+(absent(input)?0:sessionIncrement(kind,minutes)!);return tenths/10;
 };return {lesson:next('lesson'),study:next('study')};
}
export function autoSessionNumbers<T extends Record<string,any>>(data:T,records:readonly any[],touched:Iterable<string>=[],saved=false):{data:T;hints:Record<string,string>} {
 if(saved)return {data,hints:{}};
 const edited=new Set(touched),result=nextSessionNumbers(records,data),next:any={...data},hints:Record<string,string>={};
 for(const [kind,key] of [['lesson','round'],['study','selfStudyRound']] as const){
  if(edited.has(key))continue;
  if(result[kind]!==null){next[key]=result[kind];const base=sessionBase(records,data,kind);const minutes=sessionMinutes(kind==='lesson'?data.start:data.selfStudyStart,kind==='lesson'?data.end:data.selfStudyEnd)!;
   const increment=formatSessionNumber(absent(data)?0:sessionIncrement(kind,minutes)!/10);
   hints[key]=base?`자동 입력 · 직전 ${formatSessionNumber(kind==='lesson'?base.round:base.selfStudyRound)}회차(${base.date.slice(5).replace('-','/')}) +${increment}`:`자동 입력 · ${data.date.slice(0,7)} 월별 시작 0 +${increment}`;
  }else next[key]=null;
 }return {data:next,hints};
}

/** Recalculate after relevant edits from the saved counter, never on opening. */
export function editedSessionNumbers<T extends Record<string,any>>(data:T,baseline:any,touched:Iterable<string>=[]):T {
 if(!baseline)return data;
 const edited=new Set(touched),next:any={...data};
 for(const [kind,key,fields] of [['lesson','round',['start','end','classSession','attendance','date']],['study','selfStudyRound',['selfStudyStart','selfStudyEnd','selfStudy','attendance','date']]] as const){
  if(edited.has(key)||!fields.some(field=>!Object.is(data[field],baseline[field])))continue;
  const minutes=sessionMinutes(kind==='lesson'?data.start:data.selfStudyStart,kind==='lesson'?data.end:data.selfStudyEnd);
  const oldMinutes=sessionMinutes(kind==='lesson'?baseline.start:baseline.selfStudyStart,kind==='lesson'?baseline.end:baseline.selfStudyEnd);
  const old=numberTenths(baseline[key]);
  if(minutes===null||oldMinutes===null||old===null||(kind==='lesson'?data.classSession:data.selfStudy)!=='있음')continue;
  const base=data.date.slice(0,7)!==baseline.date.slice(0,7)?0:old-(sessionHasIncrement(baseline,kind)?sessionIncrement(kind,oldMinutes)!:0);
  if(base<0)continue;
  next[key]=(base+(absent(data)?0:sessionIncrement(kind,minutes)!))/10;
 }
 return next;
}
