const book=(b:any)=>[b.id,b.linkedPlanId||null,b.title,b.status,b.progress||null];
const slot=(s:any)=>[s.id,s.weekday,s.start,s.end,s.kind||'lesson',s.students||null,s.study||null];
const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
export function classStatusOnlyChange(old:any,next:any) {
 if(!old?.notionPageId||old.archived||old.deleteRequested||old.notionSyncStage&&old.notionSyncStage!=='synced')return false;
 if(old.name!==next.name||old.subject!==next.subject||!same([...(old.students||[])].sort(),[...(next.students||[])].sort()))return false;
 if(!same((old.slots||[]).map(slot),(next.slots||[]).map(slot))||!same((old.books||[]).map(book),(next.books||[]).map(book)))return false;
 return (old.status||'진행 중')!==(next.status||'진행 중')||(next.slots||[]).some((s:any,i:number)=>(s.status||next.status||'진행 중')!==(old.slots[i].status||old.status||'진행 중'));
}
export function changedStatusSlots(old:any,next:any){return (next.slots||[]).filter((s:any,i:number)=>(next.status==='중단'?'중단':s.status||'진행 중')!==(old?.slots?.[i]?.status||old?.status||'진행 중')).map((s:any)=>s.id);}
