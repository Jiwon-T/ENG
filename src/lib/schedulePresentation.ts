import {matchesKoreanSearch} from './koreanSearch';
export interface WeekColumn {id:string;label:string;date?:string;events:any[]}
export function initialWeekSelection(days:readonly WeekColumn[],today:string,mode:'dated'|'regular') {return days.find(day=>mode==='dated'?day.date===today:day.id===String(new Date(`${today}T00:00:00Z`).getUTCDay()))?.id||days[0]?.id||'';}
export function adjacentWeekDay(days:readonly WeekColumn[],current:string,key:string){const i=Math.max(0,days.findIndex(day=>day.id===current));return key==='Home'?days[0]?.id:key==='End'?days.at(-1)?.id:key==='ArrowRight'?days[(i+1)%days.length]?.id:key==='ArrowLeft'?days[(i+days.length-1)%days.length]?.id:undefined;}
export function filterScheduleClasses(classes:readonly any[],students:readonly any[],query:string,status:string){return classes.filter(c=>(!status||c.status===status)&&(!query.trim()||matchesKoreanSearch(c.name,query)||(c.students||[]).some((key:string)=>matchesKoreanSearch(students.find(s=>s.studentKey===key)?.studentDisplayName||'',query))));}
export function studentSummary(names:readonly string[]){return names.length>1?`${names[0]} 외 ${names.length-1}명`:names[0]||'학생 없음';}
