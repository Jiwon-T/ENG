import {normalizeNotionPageId as uuid} from './notionPageId.js';
/** Merge app rows with source rows (the old Notion list, now app sources such as managed classes):
 *  keeps local identity, pending local edits and app-only rows. Moved unchanged from teacherNotionWorkspace. */
export function mergeNotionRows(local:any[],remote:any[]){
 local=local.map(r=>r.notionSyncStage==='syncing'&&Date.now()-(r.notionSyncStartedAt||0)>=900000?{...r,notionSyncStage:'failed',notionSyncError:'반영 처리가 중단되었습니다. 다시 반영해 주세요.'}:r);
 const normalize=(id:any)=>{try{return uuid(id);}catch{return '';}};
 const markers=new Map<string,number>();for(const r of remote)if(normalize(r.appRecordId))markers.set(normalize(r.appRecordId),(markers.get(normalize(r.appRecordId))||0)+1);
 const used=new Set<any>(),result:any[]=[];
 for(const source of remote){
  const page=normalize(source.notionPageId);
  const cached=local.find(r=>page&&normalize(r.notionPageId)===page)||local.find(r=>!r.notionPageId&&markers.get(normalize(source.appRecordId))===1&&normalize(r.id)===normalize(source.appRecordId)&&r.ownerUid===source.ownerUid&&r.academyId===source.academyId&&r.data&&source.data&&normalize(r.data.studentKey)===normalize(source.data.studentKey)&&r.data.subject===source.data.subject);
  if(cached)used.add(cached);if(cached?.archived)continue;
  const pending=['pending','failed','syncing'].includes(cached?.notionSyncStage)||(cached?.data&&['draft','failed','publishing','processing','notion_saved','report_published_notion_pending','reflection_pending'].includes(cached.stage)&&cached.revision>0)||Boolean(cached?.notionWrite&&cached?.stage==='published');
  // An app-owned row (taken over, published or restored in the app) keeps its own values; the migrated copy is only the link.
  const appOwned=cached?.sourceMode==='firestore';
  result.push(pending||appOwned?{...cached,notionPageId:source.notionPageId,appRecordId:source.appRecordId}:cached?{...cached,...source,id:cached.id,revision:cached.revision,ownerUid:cached.ownerUid,academyId:cached.academyId,notionSyncStage:'synced'}:source);
 }
 for(const r of local)if(!used.has(r)&&!r.archived&&(r.sourceMode==='firestore'||!r.notionPageId||['failed','pending','syncing'].includes(r.notionSyncStage)||r.data&&r.revision>0))result.push(r);
 return result;
}
