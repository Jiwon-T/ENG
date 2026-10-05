/** Shared ordering for authoritative/fast reads, pagination and Excel export. */
export function lessonStartMinutes(record:any) {
 const d=record.data||{};
 const match=d.classSession!=='없음'&&/^([01]?\d|2[0-3]):([0-5]\d)$/.exec(d.start||'');
 return match?Number(match[1])*60+Number(match[2]):Infinity;
}
export function compareLessonReview(a:any,b:any) {
 return String(b.data?.date||'').localeCompare(String(a.data?.date||'')) ||
  (lessonStartMinutes(a)===lessonStartMinutes(b)?0:lessonStartMinutes(a)-lessonStartMinutes(b)) ||
  String(a.id).localeCompare(String(b.id));
}
export function validLessonDay(day:string) {
 return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
}
