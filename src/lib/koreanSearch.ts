const initials = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
export const normalizeSearch=(value:string)=>value.normalize('NFKC').replace(/\s+/gu,'').toLowerCase();
export function koreanInitials(value:string){
 return [...value].map(char=>{const code=char.charCodeAt(0)-0xac00;return code>=0&&code<11172?initials[Math.floor(code/588)]:char;}).join('');
}
export function matchesKoreanSearch(name:string,query:string){
 const term=normalizeSearch(query),normalized=normalizeSearch(name);
 return !term||normalized.includes(term)||normalizeSearch(koreanInitials(name)).includes(term);
}
/** This function only filters/reorders the already authorized input list. */
export function studentSearchResults<T extends {studentKey:string;studentDisplayName:string}>(students:readonly T[],query:string,todayKeys:readonly string[]=[]){
 const current=new Set(todayKeys),matched=students.filter(student=>matchesKoreanSearch(student.studentDisplayName,query));
 return [...matched.filter(student=>current.has(student.studentKey)),...matched.filter(student=>!current.has(student.studentKey))];
}
