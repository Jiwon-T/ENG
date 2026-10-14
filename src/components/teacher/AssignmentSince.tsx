import {useState} from 'react';
import {CalendarDays} from 'lucide-react';
/** "2026-05-11" → "2026.5.11" */
export const sinceText=(day:string)=>{const [y,m,d]=day.split('-');return `${y}.${Number(m)}.${Number(d)}`;};
/** 담당 시작일 chip: "영어 담당 2026.5.11부터". When editable (the teacher themselves, the principal, the admin) it opens a
 *  small date box. */
export default function AssignmentSince({label,since,canEdit,busy=false,onSave}:{label?:string;since:string|null;canEdit:boolean;busy?:boolean;onSave:(since:string)=>Promise<void>|void}){
 const [draft,setDraft]=useState(since||'');
 if(!since&&!canEdit)return null;
 const text=<>{label&&<b>{label}</b>}담당 {since?`${sinceText(since)}부터`:'시작일 없음'}</>;
 if(!canEdit)return <span className="asn-since"><CalendarDays size={12} aria-hidden="true"/>{text}</span>;
 return <details className="asn-edit" onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open)setDraft(since||'');}}>
  <summary className="asn-since" title="담당 시작일 고치기"><CalendarDays size={12} aria-hidden="true"/>{text}</summary>
  <div className="asn-pop"><label>담당 시작일<input type="date" value={draft} onChange={e=>setDraft(e.target.value)}/></label>
   <button type="button" className="small-button" disabled={busy||!draft||draft===since} onClick={async e=>{const box=e.currentTarget.closest('details');await onSave(draft);box?.removeAttribute('open');}}>저장</button></div>
 </details>;
}
