export function upsertWorkspaceRecord(rows:any[],record:any){
 const existing=rows.find(r=>r.id===record.id);
 if(existing&&((existing.revision||0)>(record.revision||0)||(existing.revision||0)===(record.revision||0)&&(existing.updatedAt||0)>(record.updatedAt||0)))return rows;
 return [record,...rows.filter(r=>r.id!==record.id&&(!record.notionPageId||r.notionPageId!==record.notionPageId))];
}
export function removeGridSelection<T extends {id:string;pending?:boolean}>(rows:T[],id:string,index:number){
 if(rows.find(row=>row.id===id)?.pending)return {rows,index,removed:false};
 const activeId=rows[index]?.id,next=rows.filter(row=>row.id!==id),retained=next.findIndex(row=>row.id===activeId);
 return {rows:next,index:retained>=0?retained:Math.min(index,Math.max(0,next.length-1)),removed:next.length!==rows.length};
}
