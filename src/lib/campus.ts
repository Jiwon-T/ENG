// Campus helpers for the lists (오늘 수업, 학생 관리). A subject is taken at one campus; a class meets at one campus.
import type {TodayLesson} from './teacherTodayLessons';

const subjectsOf=(students:readonly any[]|undefined,key:string)=>(students||[]).find(s=>s?.studentKey===key)?.subjects||[];
/** The campus of one student in one subject (수강 관리 / 원서). */
export function studentSubjectCampus(students:readonly any[]|undefined,key:string,subject:string):string|null{
 return subjectsOf(students,key).find((s:any)=>s.subject===subject)?.campus||null;
}
/** Where one student's lesson happens: the class's campus for a regular lesson, else that student's subject campus. */
export function lessonCampus(event:TodayLesson,key:string,students:readonly any[]|undefined):string|null{
 return event.campus||studentSubjectCampus(students,key,event.subject);
}
/** "용죽" when every subject is at one campus, else "수학 용죽 · 영어 이충"; '' when unknown. */
export function studentCampusLabel(student:any):string{
 const rows=(student?.subjects||[]).filter((s:any)=>s.campus&&s.status!=='중단');
 const campuses=[...new Set(rows.map((s:any)=>s.campus))];
 return campuses.length===1?String(campuses[0]):rows.map((s:any)=>`${s.subject} ${s.campus}`).join(' · ');
}
export const studentCampuses=(student:any):string[]=>[...new Set<string>((student?.subjects||[]).filter((s:any)=>s.campus&&s.status!=='중단').map((s:any)=>s.campus))];
/** Counts per campus, in 용죽 · 이충 · 고덕 order; chips are shown only when two or more campuses appear. */
export function campusCounts(campuses:readonly (string|null)[]){
 const order=['용죽','이충','고덕'],counts=new Map<string,number>();
 for(const c of campuses)if(c)counts.set(c,(counts.get(c)||0)+1);
 const rank=(c:string)=>{const i=order.indexOf(c);return i<0?order.length:i;};
 return [...counts.entries()].sort((a,b)=>rank(a[0])-rank(b[0]));
}
/** The last chip chosen on this device (only the campus name is kept; nothing about students). */
export function rememberedCampus(scope:string):string{try{return localStorage.getItem('campusFilter:'+scope)||'';}catch{return '';}}
export function rememberCampus(scope:string,campus:string){try{if(campus)localStorage.setItem('campusFilter:'+scope,campus);else localStorage.removeItem('campusFilter:'+scope);}catch{/* storage unavailable: just not remembered */}}
