/** Shared ordering for authoritative/fast reads, pagination and Excel export. A lesson with no 수업 시간 (자습만 한 날,
 *  or the time left blank) goes by its earliest 자습 시간 among the others; neither written: last. */
const clockMinutes=(time:unknown)=>{const match=/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(time||''));return match?Number(match[1])*60+Number(match[2]):Infinity;};
export function lessonStartMinutes(record:any) {
 const d=record.data||{},lesson=d.classSession!=='없음'?clockMinutes(d.start):Infinity;
 if(lesson!==Infinity||d.selfStudy==='없음')return lesson;
 return Math.min(clockMinutes(d.selfStudyStart),...(Array.isArray(d.selfStudyMore)?d.selfStudyMore:[]).map((p:any)=>clockMinutes(p?.start)));
}
export function compareLessonReview(a:any,b:any) {
 return String(b.data?.date||'').localeCompare(String(a.data?.date||'')) ||
  (lessonStartMinutes(a)===lessonStartMinutes(b)?0:lessonStartMinutes(a)-lessonStartMinutes(b)) ||
  String(a.id).localeCompare(String(b.id));
}
export function validLessonDay(day:string) {
 return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
}
