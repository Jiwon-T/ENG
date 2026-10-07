/** Display-only labels; publication stages and stored values are unchanged. */
export const stageLabel: Record<string,string> = {
 report_published_notion_pending:'리포트 반영 완료 · 노션 대기', reflection_pending:'노션 저장 완료 · 연동 대기',
 new:'작성 중', draft:'저장됨', publishing:'반영 준비 중', notion_saved:'Notion 저장됨',
 processing:'반영 중', published:'반영 완료', failed:'반영 실패',
};
export function lessonRecordStatus(record?:{stage?:string;error?:string},pending=false,dirty=false){
 if(pending)return {text:'저장·반영 처리 중',tone:'yellow'};
 if(record?.error||record?.stage==='failed')return {text:stageLabel.failed,tone:'red'};
 if(dirty)return {text:'수정됨',tone:'grey'};
 const stage=record?.stage||'new';
 return {text:stageLabel[stage]||stage,tone:stage==='published'?'green':stage==='draft'?'pink':['publishing','processing','notion_saved','report_published_notion_pending','reflection_pending'].includes(stage)?'yellow':'grey'};
}
