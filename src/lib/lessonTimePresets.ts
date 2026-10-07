import {todayLessons} from './teacherTodayLessons';
export const lessonDurationMinutes=[60,80,90,120] as const;
export function timeAfterMinutes(start:string,minutes:number){
 if(!/^\d{2}:\d{2}$/.test(start))return null;
 const [hour,minute]=start.split(':').map(Number);
 if(hour>23||minute>59||minutes<0||!Number.isInteger(minutes))return null;
 const total=hour*60+minute+minutes;if(total>=1440)return null;
 return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}
export function regularLessonTime(data:any,studentKey:string,subject:string,date:string,today:string){
 if(!data||date!==today)return undefined;
 return todayLessons(data,date).find(event=>event.kind==='정규'&&event.subject===subject&&event.students.includes(studentKey));
}
