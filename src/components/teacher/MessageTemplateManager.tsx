import {useState} from 'react';
import AutoTextarea from './AutoTextarea';
type Template={id:string;title:string;body:string;target:string;archived:boolean;revision:number;status:string;error:string|null};
/** Edit one app text template (app-only: saved and final on save). */
export function MessageTemplateEditor({record,busy,onSave,onDirty}:{record:Template;busy:boolean;onSave:(data:{title:string;body:string})=>void;onDirty?:(dirty:boolean)=>void}){
 const [title,setTitle]=useState(record.title),[body,setBody]=useState(record.body);
 const locked=busy||record.archived;
 return <div className="message-template-editor">
  <label>템플릿 이름<input value={title} maxLength={300} disabled={locked} onChange={e=>{setTitle(e.target.value);onDirty?.(e.target.value!==record.title||body!==record.body);}}/></label>
  <p className="text-xs">대상: {record.target||'지정 없음'}{record.archived?' · 보관됨':''}</p>
  <label>문자 템플릿 본문<AutoTextarea value={body} maxLength={10000} maxRows={10} disabled={locked} onChange={e=>{setBody(e.target.value);onDirty?.(e.target.value!==record.body||title!==record.title);}}/></label>
  {record.error&&<p role="status" className="text-xs">{record.error}</p>}
  <div className="message-template-toolbar"><button type="button" className="primary-button" disabled={locked||!title.trim()||title.trim()===record.title&&body===record.body} onClick={()=>onSave({title,body})}>저장</button></div>
  <p className="text-xs">템플릿만 수정합니다. 실제 문자는 발송하지 않습니다.</p>
 </div>;
}
