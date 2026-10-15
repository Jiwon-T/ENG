import {todayLessons} from './teacherTodayLessons';
export const lessonDurationMinutes=[60,80,90,120] as const;
export function timeAfterMinutes(start:string,minutes:number){
 if(!/^\d{2}:\d{2}$/.test(start))return null;
 const [hour,minute]=start.split(':').map(Number);
 if(hour>23||minute>59||minutes<0||!Number.isInteger(minutes))return null;
 const total=hour*60+minute+minutes;if(total>=1440)return null;
 return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
/** The time `minutes` before `end` (null before midnight). */
export function timeBeforeMinutes(end:string,minutes:number){
 if(!/^\d{2}:\d{2}$/.test(end))return null;
 const [hour,minute]=end.split(':').map(Number);
 if(hour>23||minute>59||minutes<0||!Number.isInteger(minutes))return null;
 const total=hour*60+minute-minutes;if(total<0)return null;
 return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
/** 자습 1시간 right before or right after the lesson: only when both lesson times are valid and in order (null otherwise,
 *  or across midnight). */
export function studyAroundLesson(lesson:{start?:string;end?:string},when:'before'|'after'){
 if(!timeAfterMinutes(lesson.start||'',0)||!timeAfterMinutes(lesson.end||'',0)||(lesson.end||'')<=(lesson.start||''))return null;
 const start=when==='before'?timeBeforeMinutes(lesson.start||'',60):lesson.end||'',end=when==='before'?lesson.start||'':timeAfterMinutes(lesson.end||'',60);
 return start&&end&&/^\d{2}:\d{2}$/.test(start)&&/^\d{2}:\d{2}$/.test(end)?{start,end}:null;
}
/** 자습 placed '수업 전': it ends exactly when the lesson starts (then the minute chips count back from the lesson start). */
export function isBeforeLesson(lesson:{start?:string;end?:string}|undefined,start:string,end:string){
 return Boolean(lesson&&studyAroundLesson(lesson,'before')&&end===lesson.start&&start&&start<end);
}
/** 자습 placed '수업 후': it starts when the lesson ends and is a complete span (an end time after the start). */
export function isAfterLesson(lesson:{start?:string;end?:string}|undefined,start:string,end:string){
 return Boolean(lesson&&studyAroundLesson(lesson,'after')&&start===lesson.end&&timeAfterMinutes(end,0)&&start<end);
}
/** A minute chip: before the lesson → (lesson start − minutes, lesson start); otherwise → (start, start + minutes). */
export function chipTimes(minutes:number,start:string,end:string,lesson?:{start?:string;end?:string}){
 if(isBeforeLesson(lesson,start,end)){const from=timeBeforeMinutes(lesson!.start!,minutes);return from?{start:from,end:lesson!.start!}:null;}
 const to=timeAfterMinutes(start,minutes);return to?{start,end:to}:null;
}
export function regularLessonTime(data:any,studentKey:string,subject:string,date:string,today:string){
 if(!data||date!==today)return undefined;
 return todayLessons(data,date).find(event=>event.kind==='정규'&&event.subject===subject&&event.students.includes(studentKey));
}
