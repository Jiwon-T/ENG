export function scheduleArchivePatch(record:any,revision:number|undefined,now:number) {
 if(record.archived)return null;
 if(record.deleteRequested){if(revision!==record.revision)throw new Error('DRAFT_CONFLICT');if(record.stage==='publishing' && now-(record.publishStartedAt || now)<180000)throw new Error('PUBLISH_IN_PROGRESS');return {stage:'publishing',publishStartedAt:now};}
 if(record.notionWrite && (!record.notionWrite.done || record.lastSubmittedRevision!==record.revision))throw new Error('NOTION_WRITE_PENDING');
 if(['publishing','processing','notion_saved'].includes(record.stage))throw new Error('PUBLISH_IN_PROGRESS');
 if(revision!==record.revision)throw new Error('DRAFT_CONFLICT');
 return record.notionPageId ? {data:{...record.data,status:'취소'},revision:record.revision+1,stage:'publishing',deleteRequested:true,publishStartedAt:now} : {archived:true,updatedAt:now};
}
