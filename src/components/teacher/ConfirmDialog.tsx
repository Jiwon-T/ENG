import {useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Send,FilePen,Trash2,AlertTriangle,Link2,Unlink,CheckCircle2,UserCog,RotateCcw} from 'lucide-react';

const ICONS={send:Send,edit:FilePen,trash:Trash2,alert:AlertTriangle,link:Link2,unlink:Unlink,check:CheckCircle2,user:UserCog,restore:RotateCcw};
/** `tone:'danger'`: red confirm button, and 취소 is focused so Enter never deletes by accident. */
type Options={title:string;message?:string;details?:string[];confirmText?:string;cancelText?:string;altText?:string;icon?:keyof typeof ICONS;tone?:'danger'|'leave'};
type Choice='ok'|'alt'|'cancel';

function ConfirmView({options,onDone}:{options:Options;onDone:(choice:Choice)=>void}){
 const ref=useRef<HTMLDialogElement>(null),ok=useRef<HTMLButtonElement>(null),cancel=useRef<HTMLButtonElement>(null),danger=options.tone==='danger',leave=options.tone==='leave';
 const Icon=ICONS[options.icon||(danger?'alert':leave?'edit':'check')];
 useEffect(()=>{const d=ref.current;if(d&&!d.open){try{d.showModal();}catch{d.setAttribute('open','');}}(danger||leave?cancel:ok).current?.focus();},[]);
 return <dialog ref={ref} className={`confirm-modal${danger?' is-danger':''}${leave?' is-leave':''}`} aria-labelledby="confirm-modal-title" onCancel={e=>{e.preventDefault();onDone('cancel');}} onClick={e=>{if(e.target===ref.current)onDone('cancel');}}>
  <div className="confirm-modal-body">
   <span className="confirm-modal-icon" aria-hidden="true"><Icon size={20}/></span>
   <h2 id="confirm-modal-title">{options.title}</h2>
   {options.message&&<p>{options.message}</p>}
   {options.details?.length?<ul>{options.details.map((d,i)=><li key={i}>{d}</li>)}</ul>:null}
  </div>
  <div className={`confirm-modal-actions${options.altText?' has-alt':''}`}><button type="button" ref={cancel} className="confirm-modal-cancel" onClick={()=>onDone('cancel')}>{options.cancelText||'취소'}</button>{options.altText&&<button type="button" className="confirm-modal-cancel confirm-modal-alt" onClick={()=>onDone('alt')}>{options.altText}</button>}<button type="button" ref={ok} className="confirm-modal-ok" onClick={()=>onDone('ok')}>{options.confirmText||'확인'}</button></div>
 </dialog>;
}

/** A centered confirmation in the app's style, in place of the browser's confirm(). Resolves true on 확인, false on
 *  취소, Esc or a click outside. */
export function askConfirm(options:Options):Promise<boolean>{
 return ask(options).then(choice=>choice==='ok');
}
/** Unsaved input: 계속 작성 (focused, resolves false) or the discard button (default 버리고 닫기, resolves true). */
export function askDiscard(title:string,options:{message?:string;discardText?:string}={}):Promise<boolean>{
 return ask({title,message:options.message,confirmText:options.discardText||'버리고 닫기',cancelText:'계속 작성',tone:'leave'}).then(choice=>choice==='ok');
}
/** Three choices: 확인 ('ok'), the extra `altText` button ('alt'), or 취소/Esc/outside ('cancel'). */
export function ask(options:Options):Promise<Choice>{
 if(typeof document==='undefined')return Promise.resolve('cancel');
 return new Promise(resolve=>{
  const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
  const done=(value:Choice)=>{root.unmount();host.remove();resolve(value);};
  root.render(<ConfirmView options={options} onDone={done}/>);
 });
}
