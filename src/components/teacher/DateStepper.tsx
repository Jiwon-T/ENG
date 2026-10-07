import {useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {addCalendarDays,koreanDay} from '../../lib/teacherWeekCalendar';
export function shortLessonDate(date:string){return `${date.slice(5).replace('-','/')}(${['일','월','화','수','목','금','토'][new Date(`${date}T00:00:00Z`).getUTCDay()]})`;}
export default function DateStepper({date,onDate,disabled=false}:{date:string;onDate:(date:string)=>void;disabled?:boolean}){
 const [calendar,setCalendar]=useState(false);
 return <div className="lesson-date-stepper"><button type="button" aria-label="이전 날짜" disabled={disabled} onClick={()=>onDate(addCalendarDays(date,-1))}><ChevronLeft size={16}/></button><button type="button" className="lesson-date-current" aria-expanded={calendar} aria-label={`수업 목록 날짜 ${date}`} disabled={disabled} onClick={()=>setCalendar(value=>!value)}>{shortLessonDate(date)}</button><button type="button" aria-label="다음 날짜" disabled={disabled} onClick={()=>onDate(addCalendarDays(date,1))}><ChevronRight size={16}/></button><button type="button" className="small-button" disabled={disabled} onClick={()=>onDate(koreanDay())}>오늘</button><div hidden={!calendar} className="lesson-date-calendar"><label>수업 목록 날짜<input type="date" aria-label="수업 목록 날짜" disabled={disabled} value={date} onChange={event=>{if(event.target.value){onDate(event.target.value);setCalendar(false);}}}/></label></div></div>;
}
