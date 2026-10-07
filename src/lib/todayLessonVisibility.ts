// Session-only, shared by single and group views. No browser storage/student details.
const excluded=new Map<string,Set<string>>();
const listeners=new Set<()=>void>();
export const subscribeTodayVisibility=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
export function todayVisibilityKey(uid:string,date:string){return `${uid}:${date}`;}
export function hiddenTodayLessons(uid:string,date:string):ReadonlySet<string>{return excluded.get(todayVisibilityKey(uid,date))||empty;}
const empty=new Set<string>();
export function hideTodayLesson(uid:string,date:string,id:string){const key=todayVisibilityKey(uid,date);excluded.set(key,new Set([...hiddenTodayLessons(uid,date),id]));listeners.forEach(fn=>fn());}
export function restoreTodayLessons(uid:string,date:string){excluded.delete(todayVisibilityKey(uid,date));listeners.forEach(fn=>fn());}

export function setTodayVisibility(uid:string,date:string,ids:string[]){excluded.set(todayVisibilityKey(uid,date),new Set(ids));listeners.forEach(fn=>fn());}
