import type {TodayLesson} from './teacherTodayLessons';
export type TodayLessonState='미작성'|'저장됨'|'반영 완료';
const timestamp=(value:any)=>typeof value==='number'?value:typeof value?.toMillis==='function'?value.toMillis():typeof value==='string'?Date.parse(value)||0:0;
/** The time a lesson record is anchored on: its class start, or its self-study start on a no-class (테스트·자습) day. */
export const lessonStartOf=(d:any)=>d?.classSession==='없음'?d?.selfStudyStart||'':d?.start||'';
const sameDay=(record:any,event:TodayLesson,studentKey:string)=>!record.archived&&!record.deleteRequested&&record.stage!=='new'&&record.data?.studentKey===studentKey&&record.data.date===event.date&&record.data.subject===event.subject;
const newest=(list:any[])=>list.sort((a,b)=>timestamp(b.updatedAt)-timestamp(a.updatedAt))[0];
const minutes=(t:string)=>/^\d{2}:\d{2}$/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
/** The saved lesson for this student in this event. Same start time first. With the day's events, a lesson whose
 *  time was changed just for today (no event of that student+subject starts then) still belongs to the event it
 *  came from: such lessons go to that student's events of the day that have no exact match, nearest start first,
 *  one lesson per event. Never fetch: the supplied records are only those already available in memory. */
export function todayLessonRecord(event:TodayLesson,studentKey:string,records:readonly any[],events?:readonly TodayLesson[]):any{
 const exact=newest(records.filter(r=>sameDay(r,event,studentKey)&&lessonStartOf(r.data)===event.start));
 if(exact||!events)return exact;
 const siblings=events.filter(e=>e.date===event.date&&e.subject===event.subject&&e.students.includes(studentKey));
 const starts=new Set(siblings.map(e=>e.start));
 const moved=records.filter(r=>sameDay(r,event,studentKey)&&!starts.has(lessonStartOf(r.data)));
 if(!moved.length)return undefined;
 const open=siblings.filter(e=>!records.some(r=>sameDay(r,e,studentKey)&&lessonStartOf(r.data)===e.start));
 // Newest copy per lesson id, then nearest-start pairing between moved lessons and events without a lesson.
 const byId=new Map<any,any>();for(const r of moved){const k=r.id??r;const kept=byId.get(k);if(!kept||timestamp(r.updatedAt)>timestamp(kept.updatedAt))byId.set(k,r);}
 // By id too: the caller may pass a copy of the event (e.g. with hidden students removed).
 const pairs=[...byId.values()].flatMap(r=>open.map(e=>({r,e,d:Math.abs(minutes(lessonStartOf(r.data))-minutes(e.start))||0}))).sort((a,b)=>a.d-b.d);
 const usedR=new Set<any>(),usedE=new Set<TodayLesson>();
 for(const p of pairs){if(usedR.has(p.r)||usedE.has(p.e))continue;usedR.add(p.r);usedE.add(p.e);if(p.e===event||(p.e.id&&p.e.id===event.id))return p.r;}
 return undefined;
}
export function todayLessonState(event:TodayLesson,studentKey:string,records:readonly any[],events?:readonly TodayLesson[]):TodayLessonState{
 const record=todayLessonRecord(event,studentKey,records,events);
 return !record?'미작성':record.stage==='published'?'반영 완료':'저장됨';
}
const revisionOf=(r:any)=>typeof r?.revision==='number'&&Number.isFinite(r.revision)?r.revision:-1;
/** True when `a` is a newer copy of the same lesson than `b`: higher revision, then later updatedAt. */
function newer(a:any,b:any){const ra=revisionOf(a),rb=revisionOf(b);if(ra!==rb)return ra>rb;return timestamp(a?.updatedAt)>timestamp(b?.updatedAt);}
/** The day's own lessons from the server (all of them, not only the first saved-lesson page) merged by id with the
 *  copies already in memory, keeping the newer copy (revision, then updatedAt). A lesson just saved, published or
 *  deleted here carries the revision the server returned, so it is never older than the day read; on a tie the
 *  memory copy (this device's latest action) is kept. A newer save, publish or delete from another device wins. */
export function todayRecords(server:readonly any[]|undefined,memory:readonly any[]){
 const byId=new Map<string,any>();
 for(const r of memory)if(r?.id){const kept=byId.get(r.id);if(!kept||!newer(kept,r))byId.set(r.id,r);}
 for(const r of server||[])if(r?.id){const kept=byId.get(r.id);if(!kept||newer(r,kept))byId.set(r.id,r);}
 return [...byId.values()];
}
/** 일정 외 일지: the day's saved lessons that no event of the day takes (written for a lesson that was not on the
 *  schedule), the newest copy of each, by start time. `matchEvents`: the whole day's events, before anything was hidden
 *  (a hidden lesson's record stays with its event). */
export function offScheduleLessons(records:readonly any[],matchEvents:readonly TodayLesson[],date:string){
 const byId=new Map<string,any>();
 for(const r of records)if(r?.id&&!r.archived&&!r.deleteRequested&&r.stage!=='new'&&r.data?.date===date&&r.data.studentKey){const kept=byId.get(r.id);if(!kept||newer(r,kept))byId.set(r.id,r);}
 const taken=new Set<string>();
 for(const e of matchEvents)for(const key of e.students){const r=todayLessonRecord(e,key,records,matchEvents);if(r?.id)taken.add(r.id);}
 return [...byId.values()].filter(r=>!taken.has(r.id)).sort((a,b)=>lessonStartOf(a.data).localeCompare(lessonStartOf(b.data)));
}
/** `matchEvents`: the whole day's events before anything was hidden, so hiding a lesson or a student never moves
 *  its saved lesson onto another event; defaults to `events`. */
export function todayLessonProgress(events:readonly TodayLesson[],records:readonly any[],matchEvents:readonly TodayLesson[]=events){
 const states=events.flatMap(event=>event.students.map(key=>todayLessonState(event,key,records,matchEvents)));
 return {total:states.length,published:states.filter(state=>state==='반영 완료').length,saved:states.filter(state=>state==='저장됨').length,empty:states.filter(state=>state==='미작성').length};
}
export const todayStateTone=(state:TodayLessonState)=>state==='반영 완료'?'green':state==='저장됨'?'pink':'grey';
export function todayProgressRatios(progress:{total:number;published:number;saved:number;empty:number}){
 const part=(count:number)=>progress.total?count/progress.total*100:0;
 return {done:part(progress.published),saved:part(progress.saved),unwritten:part(progress.empty)};
}
export function nextUnwrittenLesson(events:readonly TodayLesson[],records:readonly any[],selection?:{studentKey?:string;subject?:string;date?:string;start?:string;classSession?:string;selfStudyStart?:string},matchEvents:readonly TodayLesson[]=events){
 const ordered=[...events].sort((a,b)=>a.start.localeCompare(b.start)).flatMap(event=>event.students.map(key=>({event,key})));
 // The selected lesson may carry a time changed just for today: it is the event its saved lesson is matched to.
 const current=ordered.findIndex(({event,key})=>selection?.date===event.date&&selection.subject===event.subject&&(!selection.studentKey||selection.studentKey===key)&&(lessonStartOf(selection)===event.start||lessonStartOf(todayLessonRecord(event,key,records,matchEvents)?.data)===lessonStartOf(selection)));
 // Search after the selected lesson, then wrap once; never select the same lesson.
 const candidates=current<0?ordered:[...ordered.slice(current+1),...ordered.slice(0,current)];
 return candidates.find(({event,key})=>todayLessonState(event,key,records,matchEvents)==='미작성');
}
/** The lesson the editor opens by itself on the day's list: the latest one already 반영 완료 (easy to correct),
 *  otherwise the first lesson of the day. */
export function autoOpenLesson(events:readonly TodayLesson[],records:readonly any[],matchEvents:readonly TodayLesson[]=events){
 const rows=[...events].sort((a,b)=>a.start.localeCompare(b.start)).flatMap(event=>event.students.map(key=>({event,key})));
 const published=rows.filter(({event,key})=>todayLessonState(event,key,records,matchEvents)==='반영 완료');
 return published.length?published[published.length-1]:rows[0];
}
