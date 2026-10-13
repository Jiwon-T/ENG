/** Display-only labels; publication stages and stored values are unchanged. */
export const stageLabel: Record<string,string> = {
 report_published_notion_pending:'리포트 반영 완료', reflection_pending:'저장 완료 · 반영 대기',
 new:'작성 중', draft:'저장됨', publishing:'반영 준비 중', notion_saved:'저장됨',
 processing:'반영 중', published:'반영 완료', failed:'반영 실패',
};
export function lessonRecordStatus(record?:{stage?:string;error?:string},pending=false,dirty=false){
 if(pending)return {text:'저장·반영 처리 중',tone:'yellow'};
 if(record?.error||record?.stage==='failed')return {text:stageLabel.failed,tone:'red'};
 if(dirty)return {text:'수정됨',tone:'grey'};
 const stage=record?.stage||'new';
 return {text:stageLabel[stage]||stage,tone:stage==='published'?'green':stage==='draft'?'pink':['publishing','processing','notion_saved','report_published_notion_pending','reflection_pending'].includes(stage)?'yellow':'grey'};
}

const PENDING_STAGES=['publishing','processing','notion_saved','report_published_notion_pending','reflection_pending'];
const timestampOf=(value:any)=>typeof value==='number'?value:typeof value?.toMillis==='function'?value.toMillis():typeof value==='string'?Date.parse(value)||0:typeof value?.seconds==='number'?value.seconds*1000:0;
/** "방금 저장됨", "N분 전 저장됨", "N시간 전 저장됨", then the date; plain "저장됨" without a time. */
export function savedAgo(at:number,now:number){
 if(!at)return '저장됨';
 const minutes=Math.floor(Math.max(0,now-at)/60000);
 if(minutes<1)return '방금 저장됨';
 if(minutes<60)return `${minutes}분 전 저장됨`;
 if(minutes<24*60)return `${Math.floor(minutes/60)}시간 전 저장됨`;
 const d=new Date(at);return `${d.getMonth()+1}/${d.getDate()} 저장됨`;
}
export type LessonSaveKind='busy'|'failed'|'unsaved'|'published'|'pending'|'saved';
/** The single editor's save state shown next to its title. `dirty`: input changed since it was opened or saved.
 *  `savedAt`: when this device last saved it (more exact than the record's updatedAt). Null for an untouched new lesson. */
export function lessonSaveState({record,dirty,busy,savedAt,now}:{record?:any;dirty:boolean;busy:boolean;savedAt?:number;now:number}):{kind:LessonSaveKind;text:string}|null{
 if(busy)return {kind:'busy',text:'저장·반영 중'};
 if(record?.error||record?.stage==='failed')return {kind:'failed',text:stageLabel.failed};
 if(dirty)return {kind:'unsaved',text:'저장 안 됨'};
 const stage=record?.stage;
 if(!record||!stage||stage==='new')return null;
 if(stage==='published')return {kind:'published',text:stageLabel.published};
 if(PENDING_STAGES.includes(stage)&&stage!=='notion_saved')return {kind:'pending',text:stageLabel[stage]||stage};
 return {kind:'saved',text:savedAgo(savedAt||timestampOf(record.updatedAt),now)};
}
