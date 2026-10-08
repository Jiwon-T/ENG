export function syncStatusMap(status?:string){
 if(status==='app_saved')return {kind:'editing' as const,text:'앱 저장 완료',quiet:false};
 if(status==='published'||status==='synced')return {kind:'done' as const,text:'Notion 반영 완료',quiet:true};
 if(status==='failed')return {kind:'failed' as const,text:'반영 실패',quiet:false};
 if(!status)return null;
 return {kind:status==='new'?'editing' as const:'saved' as const,text:({new:'작성 중',draft:'초안',pending:'반영 대기',syncing:'반영 중',publishing:'반영 중',processing:'반영 중',notion_saved:'Notion 저장됨',report_published_notion_pending:'Notion 반영 대기',reflection_pending:'연동 대기'} as Record<string,string>)[status]||status,quiet:false};
}
export function scheduleStatusMap(status?:string){return status?{text:status,icon:status==='취소'?'cancel':status==='완료'?'done':status==='변경'?'changed':'planned',tone:status==='취소'?'danger':'neutral',strike:status==='취소'}:null;}
export function classStatusMap(status?:string){return !status||status==='진행 중'?null:{text:status,icon:status==='중단'?'paused':'waiting',tone:'neutral'};}
