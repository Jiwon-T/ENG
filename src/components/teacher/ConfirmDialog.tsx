import {useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Send} from 'lucide-react';

type Options={title:string;message?:string;details?:string[];confirmText?:string;cancelText?:string};

function ConfirmView({options,onDone}:{options:Options;onDone:(ok:boolean)=>void}){
 const ref=useRef<HTMLDialogElement>(null),ok=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const d=ref.current;if(d&&!d.open){try{d.showModal();}catch{d.setAttribute('open','');}}ok.current?.focus();},[]);
 return <dialog ref={ref} className="confirm-modal" aria-labelledby="confirm-modal-title" onCancel={e=>{e.preventDefault();onDone(false);}} onClick={e=>{if(e.target===ref.current)onDone(false);}}>
  <div className="confirm-modal-body">
   <span className="confirm-modal-icon" aria-hidden="true"><Send size={20}/></span>
   <h2 id="confirm-modal-title">{options.title}</h2>
   {options.message&&<p>{options.message}</p>}
   {options.details?.length?<ul>{options.details.map((d,i)=><li key={i}>{d}</li>)}</ul>:null}
  </div>
  <div className="confirm-modal-actions"><button type="button" className="confirm-modal-cancel" onClick={()=>onDone(false)}>{options.cancelText||'취소'}</button><button type="button" ref={ok} className="confirm-modal-ok" onClick={()=>onDone(true)}>{options.confirmText||'확인'}</button></div>
 </dialog>;
}

/** A centered confirmation in the app's style, in place of the browser's confirm(). Resolves true on 확인, false on
 *  취소, Esc or a click outside. */
export function askConfirm(options:Options):Promise<boolean>{
 if(typeof document==='undefined')return Promise.resolve(false);
 return new Promise(resolve=>{
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  const done=(value:boolean)=>{root.unmount();host.remove();resolve(value);};
  root.render(<ConfirmView options={options} onDone={done}/>);
 });
}
