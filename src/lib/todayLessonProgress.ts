import type {TodayLesson} from './teacherTodayLessons';
export type TodayLessonState='미작성'|'저장됨'|'반영 완료';
const timestamp=(value:any)=>typeof value==='number'?value:typeof value?.toMillis==='function'?value.toMillis():typeof value==='string'?Date.parse(value)||0:0;
/** Never fetch: the supplied records are only those already available in memory. */
export function todayLessonState(event:TodayLesson,studentKey:string,records:readonly any[]):TodayLessonState{
 const matches=records.filter(record=>!record.archived&&!record.deleteRequested&&record.stage!=='new'&&record.data?.studentKey===studentKey&&record.data.date===event.date&&record.data.subject===event.subject&&record.data.start===event.start);
 const record=matches.sort((a,b)=>timestamp(b.updatedAt)-timestamp(a.updatedAt))[0];
 return !record?'미작성':record.stage==='published'?'반영 완료':'저장됨';
}
export function todayLessonProgress(events:readonly TodayLesson[],records:readonly any[]){
 const states=events.flatMap(event=>event.students.map(key=>todayLessonState(event,key,records)));
 return {total:states.length,published:states.filter(state=>state==='반영 완료').length,saved:states.filter(state=>state==='저장됨').length,empty:states.filter(state=>state==='미작성').length};
}
export const todayStateTone=(state:TodayLessonState)=>state==='반영 완료'?'green':state==='저장됨'?'pink':'grey';
