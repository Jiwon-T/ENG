import type {TodayLesson} from './teacherTodayLessons';
export type TodayLessonState='미작성'|'저장됨'|'반영 완료';
const timestamp=(value:any)=>typeof value==='number'?value:typeof value?.toMillis==='function'?value.toMillis():typeof value==='string'?Date.parse(value)||0:0;
/** The time a lesson record is anchored on: its class start, or its self-study start on a no-class (테스트·자습) day. */
export const lessonStartOf=(d:any)=>d?.classSession==='없음'?d?.selfStudyStart||'':d?.start||'';
/** Never fetch: the supplied records are only those already available in memory. */
export function todayLessonState(event:TodayLesson,studentKey:string,records:readonly any[]):TodayLessonState{
 const matches=records.filter(record=>!record.archived&&!record.deleteRequested&&record.stage!=='new'&&record.data?.studentKey===studentKey&&record.data.date===event.date&&record.data.subject===event.subject&&lessonStartOf(record.data)===event.start);
 const record=matches.sort((a,b)=>timestamp(b.updatedAt)-timestamp(a.updatedAt))[0];
 return !record?'미작성':record.stage==='published'?'반영 완료':'저장됨';
}
export function todayLessonProgress(events:readonly TodayLesson[],records:readonly any[]){
 const states=events.flatMap(event=>event.students.map(key=>todayLessonState(event,key,records)));
 return {total:states.length,published:states.filter(state=>state==='반영 완료').length,saved:states.filter(state=>state==='저장됨').length,empty:states.filter(state=>state==='미작성').length};
}
export const todayStateTone=(state:TodayLessonState)=>state==='반영 완료'?'green':state==='저장됨'?'pink':'grey';
export function todayProgressRatios(progress:{total:number;published:number;saved:number;empty:number}){
 const part=(count:number)=>progress.total?count/progress.total*100:0;
 return {done:part(progress.published),saved:part(progress.saved),unwritten:part(progress.empty)};
}
export function nextUnwrittenLesson(events:readonly TodayLesson[],records:readonly any[],selection?:{studentKey?:string;subject?:string;date?:string;start?:string;classSession?:string;selfStudyStart?:string}){
 const ordered=[...events].sort((a,b)=>a.start.localeCompare(b.start)).flatMap(event=>event.students.map(key=>({event,key})));
 const current=ordered.findIndex(({event,key})=>selection?.date===event.date&&selection.subject===event.subject&&lessonStartOf(selection)===event.start&&(!selection.studentKey||selection.studentKey===key));
 // Search after the selected lesson, then wrap once; never select the same lesson.
 const candidates=current<0?ordered:[...ordered.slice(current+1),...ordered.slice(0,current)];
 return candidates.find(({event,key})=>todayLessonState(event,key,records)==='미작성');
}
