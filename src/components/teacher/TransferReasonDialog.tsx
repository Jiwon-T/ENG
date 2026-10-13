import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {UserCog} from 'lucide-react';
import {teacherTransferReasons,type TeacherTransferReason} from '../../lib/studentEnrollment';

type Answer={reason:TeacherTransferReason;note:string};

function ReasonView({title,details,onDone}:{title:string;details:string[];onDone:(answer:Answer|null)=>void}){
 const ref=useRef<HTMLDialogElement>(null),[reason,setReason]=useState<TeacherTransferReason|null>(null),[note,setNote]=useState('');
 useEffect(()=>{const d=ref.current;if(d&&!d.open){try{d.showModal();}catch{d.setAttribute('open','');}}},[]);
 return <dialog ref={ref} className="confirm-modal" aria-labelledby="transfer-reason-title" onCancel={e=>{e.preventDefault();onDone(null);}} onClick={e=>{if(e.target===ref.current)onDone(null);}}>
  <div className="confirm-modal-body">
   <span className="confirm-modal-icon" aria-hidden="true"><UserCog size={20}/></span>
   <h2 id="transfer-reason-title">{title}</h2>
   {details.length?<ul>{details.map((d,i)=><li key={i}>{d}</li>)}</ul>:null}
   <div className="confirm-modal-reasons" role="group" aria-label="담당에서 빼는 이유">{teacherTransferReasons.map(r=><button key={r} type="button" aria-pressed={reason===r} onClick={()=>setReason(r)}>{r}</button>)}</div>
   {reason==='기타'&&<input className="confirm-modal-note" aria-label="기타 사유 메모 (선택)" placeholder="메모 (선택)" maxLength={200} value={note} onChange={e=>setNote(e.target.value)}/>}
   <p className="confirm-modal-hint">원장·관리자만 볼 수 있어요.</p>
  </div>
  <div className="confirm-modal-actions"><button type="button" className="confirm-modal-cancel" onClick={()=>onDone(null)}>취소</button><button type="button" className="confirm-modal-ok" disabled={!reason} onClick={()=>reason&&onDone({reason,note:reason==='기타'?note.trim():''})}>저장</button></div>
 </dialog>;
}

/** 담당 변경 from the teacher dialog: one reason for every student taken off in this save. Resolves null on 취소. */
export function askTransferReason(title:string,details:string[]):Promise<Answer|null>{
 if(typeof document==='undefined')return Promise.resolve(null);
 return new Promise(resolve=>{
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  const done=(value:Answer|null)=>{root.unmount();host.remove();resolve(value);};
  root.render(<ReasonView title={title} details={details} onDone={done}/>);
 });
}
