import {addCalendarDays,koreanDay,mondayOfWeek} from '../../src/lib/teacherWeekCalendar.js';
export interface ScheduleRange {from:string;to:string;}
function day(value:string){const date=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error('INVALID_INPUT');return value;}
export function scheduleRange(values:{day?:string|null;from?:string|null;to?:string|null}={}):ScheduleRange {
 if(values.day)return {from:day(values.day),to:day(values.day)};
 const from=day(values.from||mondayOfWeek(koreanDay())),to=day(values.to||addCalendarDays(from,6));
 if(to<from||(Date.parse(to)-Date.parse(from))/86400000>366)throw new Error('INVALID_INPUT');
 return {from,to};
}
export function inScheduleRange(date:string,range:ScheduleRange){return date>=range.from&&date<=range.to;}
// Date prefix bounds include both offset-form and UTC-form stored timestamps.
// An exact Korea-date check follows the query to remove the extra boundary day.
export async function readReflectedRange(db:any,actor:any,mappings:Map<string,any>,range:ScheduleRange) {
 const ids=[...new Set([...mappings].filter(([key])=>actor.admin||actor.scopes.some((s:any)=>s.studentKey===key)).map(([,m])=>m.internalStudentId))];
 if(!ids.length)return [];
 let docs:any[];
 try{const results=await Promise.all(Array.from({length:Math.ceil(ids.length/30)},(_,i)=>db.collection('studentSchedules')
 .where('internalStudentId','in',ids.slice(i*30,i*30+30)).where('startAt','>=',addCalendarDays(range.from,-1)).where('startAt','<',addCalendarDays(range.to,2)).get()));docs=results.flatMap(r=>r.docs);}
 catch(error:any){if(!/index/i.test(error.message||''))throw error;docs=(await db.collection('studentSchedules').where('startAt','>=',addCalendarDays(range.from,-1)).where('startAt','<',addCalendarDays(range.to,2)).get()).docs;}
 const allowed=new Set(ids);
 return docs.filter(d=>allowed.has(d.data().internalStudentId)&&Number.isFinite(Date.parse(d.data().startAt))&&inScheduleRange(koreanDay(d.data().startAt),range));
}
export async function readManagedScheduleRange(db:any,actor:any,range:ScheduleRange) {
 let query=db.collection('teacherSchedules');
 if(!actor.admin)query=query.where(actor.principal?'academyId':'ownerUid','==',actor.principal?actor.academyId:actor.uid);
 try{return await query.where('data.date','>=',range.from).where('data.date','<=',range.to).get();}
 catch(error:any){if(!/index/i.test(error.message||''))throw error;const result=await db.collection('teacherSchedules').where('data.date','>=',range.from).where('data.date','<=',range.to).get();return {docs:result.docs.filter((d:any)=>actor.admin||(actor.principal?d.data().academyId===actor.academyId:d.data().ownerUid===actor.uid))};}
}
