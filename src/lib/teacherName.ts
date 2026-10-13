/** A teacher's label without a leading subject word: "영어 이지원T" → "이지원T". */
/** One of several co-teachers dropped, nobody new: shown as "~~A~~ + B" (the others simply stay). */
export const isCoTeacherDrop=(r:{toUids:string[];afterUids?:string[]|null})=>!r.toUids.length&&Boolean(r.afterUids?.length);
/** The "to" side of a 담당 변경 record: newly added teachers; the co-teachers who stay; 담당 없음 only when nobody is
 *  left; 추가 담당 없음 for a record saved before the full list was kept. */
export function transferTarget(r:{toUids:string[];afterUids?:string[]|null},who:(uids:string[])=>string){
 return r.toUids.length?who(r.toUids):r.afterUids?.length?who(r.afterUids):r.afterUids?'담당 없음':'추가 담당 없음';
}
export const shortTeacherName=(label:string)=>label.replace(/^\s*(영어|수학|국어|과학|한국사)\s+/,'').trim()||label;
