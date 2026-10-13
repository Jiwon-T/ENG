// "Open a lesson by itself" happens at most once per teacher and day in this browser session, and never after
// the teacher has picked a lesson or pressed + 새 일지 that day. Kept outside the components so leaving the
// 일지 tab (which unmounts the list) does not reset it; a page reload starts fresh.
const done=new Set<string>();
const key=(uid:string,date:string)=>`${uid}:${date}`;
export const autoOpenDone=(uid:string,date:string)=>done.has(key(uid,date));
export const markAutoOpenDone=(uid:string,date:string)=>{done.add(key(uid,date));};
