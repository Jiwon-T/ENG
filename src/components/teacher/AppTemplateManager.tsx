import {Fragment,useRef,useState} from 'react';
import {MessageSquareText} from 'lucide-react';
import {MessageTemplateEditor} from './MessageTemplateManager';
/** App-only text templates: pick one, edit, save. No Notion sync controls (templates live only in the app now). */
export default function AppTemplateManager({busy,request,act}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>}){
 const [list,setList]=useState<any[]|null>(null),[selected,setSelected]=useState<any>(null),[dirty,setDirty]=useState(false),[notice,setNotice]=useState('');
 const operation=useRef<{fingerprint:string;id:string}|null>(null);
 const command=(data:any)=>{const fingerprint=JSON.stringify(data);if(operation.current?.fingerprint!==fingerprint)operation.current={fingerprint,id:crypto.randomUUID()};return operation.current.id;};
 async function load(){const all:any[]=[];let cursor:string|undefined;for(let i=0;i<20;i++){const r=await request('template-list',cursor?{cursor}:{});all.push(...(r.records||[]));cursor=r.cursor||undefined;if(!cursor)break;}setList(all.filter(t=>!t.archived));}
 function choose(t:any){if(dirty&&!window.confirm('저장하지 않은 편집을 닫을까요?'))return;setSelected(t);setDirty(false);setNotice('');}
 return <section className="panel rv">
  <div className="rv-head"><h2>문자 템플릿{list&&<small>{list.length}개</small>}</h2>{!list&&<button type="button" className="small-button" disabled={busy} onClick={()=>act(load)}><MessageSquareText size={16} aria-hidden="true"/>템플릿 열기</button>}</div>
  <p className="gs-note">학부모 문자에 쓰는 템플릿을 고칩니다. 실제 문자는 보내지 않습니다.</p>
  {list&&<div className="gs-chips" role="group" aria-label="템플릿">{list.map(t=><button key={t.id} type="button" className="rv-chip" aria-pressed={selected?.id===t.id} onClick={()=>choose(t)}>{t.title||'제목 없음'}</button>)}{!list.length&&<p className="rv-empty">저장된 템플릿이 없습니다.</p>}</div>}
  {selected&&<Fragment key={selected.id+':'+selected.revision}><MessageTemplateEditor record={selected} busy={busy} appOnly onDirty={setDirty}
   onSave={data=>void act(async()=>{const input={id:selected.id,revision:selected.revision,data};const r=await request('template-save',{...input,operationId:command(input)});setSelected(r.record);setList(old=>(old||[]).map(t=>t.id===r.record.id?r.record:t));setDirty(false);setNotice('저장했습니다.');})}
   onRetry={()=>{}} onResolve={()=>{}}/></Fragment>}
  {notice&&<p role="status" className="gs-note">{notice}</p>}
 </section>;
}
