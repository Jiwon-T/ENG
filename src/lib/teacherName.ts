/** One of several co-teachers dropped, nobody new: shown as "~~A~~ + B" (the others simply stay). */
export const isCoTeacherDrop=(r:{toUids:string[];afterUids?:string[]|null})=>!r.toUids.length&&Boolean(r.afterUids?.length);
/** The "to" side of a 담당 변경 record: newly added teachers; the co-teachers who stay; 담당 없음 only when nobody is
 *  left; 추가 담당 없음 for a record saved before the full list was kept. */
export function transferTarget(r:{toUids:string[];afterUids?:string[]|null},who:(uids:string[])=>string){
 return r.toUids.length?who(r.toUids):r.afterUids?.length?who(r.afterUids):r.afterUids?'담당 없음':'추가 담당 없음';
}
/** A teacher's label without a leading subject word or initials: "영어 이지원T" / "국영 박민지T" → the name. */
export const shortTeacherName=(label:string)=>label.replace(/^\s*(영어|수학|국어|과학|한국사|[국영수과한]{1,5})\s+/,'').trim()||label;
/** Subject initials in 국·영·수·과·한 order: ['영어','국어'] → "국영". */
export function subjectInitials(subjects:readonly string[]){
 const order:[string,string][]=[['국어','국'],['영어','영'],['수학','수'],['과학','과'],['한국사','한']];
 return order.filter(([s])=>subjects.includes(s)).map(([,i])=>i).join('');
}
/** Default label for a teacher added without an app account: "국영 박민지T". */
export function offlineTeacherLabel(name:string,subjects:readonly string[]){
 const base=name.trim().replace(/\s*(T|선생님|쌤)$/,'');const initials=subjectInitials(subjects);
 return `${initials?initials+' ':''}${base}T`;
}
