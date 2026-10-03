export function scheduleArchivePatch(record:any,revision:number|undefined,now:number) {
 if(record.archived)return null;
 if(['publishing','processing','notion_saved'].includes(record.stage))throw new Error('PUBLISH_IN_PROGRESS');
 if(revision!==record.revision)throw new Error('DRAFT_CONFLICT');
 return record.notionPageId ? {data:{...record.data,status:'취소'},revision:record.revision+1,stage:'publishing',deleteRequested:true,publishStartedAt:now} : {archived:true,updatedAt:now};
}
