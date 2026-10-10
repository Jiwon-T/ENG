import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,KeyRound,X} from 'lucide-react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
const LENGTH=8;
const clean=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,LENGTH);
/** 학원 연결: a student types the 8-character code from the academy (opened from the home button, never forced). */
export default function LinkCodeDialog({onClose,onLinked}:{onClose:()=>void;onLinked:(studentKey:string)=>void}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState<{name:string;key:string}|null>(null),[focused,setFocused]=useState(true);
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{input.current?.focus();const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose();};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc);},[busy,onClose]);
 const submit=async()=>{if(busy||code.length<LENGTH)return;setBusy(true);setMessage('');
  try{const r=await teacherAuthenticatedRequest<any>(auth,'/api/student/link-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
   if(!r.ok||!r.data?.ok){setMessage(r.data?.message||'연결하지 못했습니다. 코드를 다시 확인해 주세요.');return;}
   setDone({name:r.data.studentDisplayName||'학생',key:r.data.studentKey});
  }finally{setBusy(false);}};
 const finish=()=>{if(done)onLinked(done.key);onClose();};
 return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="학원 연결하기" onClick={e=>{if(e.target===e.currentTarget&&!busy)done?finish():onClose();}}>
  <div className="relative w-full max-w-sm rounded-[2rem] bg-white p-7 text-center shadow-2xl">
   <button type="button" aria-label="닫기" onClick={done?finish:onClose} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X size={18}/></button>
   {done?<>
    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-500"><CheckCircle2 size={34} aria-hidden="true"/></div>
    <h2 className="text-xl font-black text-slate-900">연결됐어요!</h2>
    <p className="mt-2 text-sm text-slate-500"><strong className="text-slate-700">{done.name}</strong> 학생으로 연결되었어요.<br/>이제 과제·일정·수업 리포트를 볼 수 있어요.</p>
    <button type="button" onClick={finish} className="mt-6 w-full rounded-2xl bg-pastel-pink-500 py-3 text-sm font-bold text-white shadow-sm">시작하기</button>
   </>:<>
    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-pastel-pink-100 to-violet-100 text-pastel-pink-600"><KeyRound size={30} aria-hidden="true"/></div>
    <h2 className="text-xl font-black text-slate-900">학원 연결하기</h2>
    <p className="mt-2 text-sm text-slate-500">학원에서 받은 8자리 코드를 입력하면<br/>과제·일정·수업 리포트가 열려요.</p>
    <form className="mt-6" onSubmit={e=>{e.preventDefault();void submit();}}>
     {/* One real input (typing, paste, mobile keyboards) drawn as 8 boxes. */}
     <label className="relative mx-auto block w-fit cursor-text" onClick={()=>input.current?.focus()}>
      <span className="sr-only">연결 코드</span>
      <input ref={input} value={code} onChange={e=>{setCode(clean(e.target.value));setMessage('');}} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} inputMode="text" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={12} aria-describedby="link-code-help" className="absolute inset-0 h-full w-full cursor-text opacity-0"/>
      <span className="flex items-center gap-1.5" aria-hidden="true">{Array.from({length:LENGTH},(_,i)=><span key={i} className="contents">
       {i===4&&<span className="mx-0.5 h-0.5 w-3 rounded bg-slate-300"/>}
       <span className={'grid h-12 w-9 place-items-center rounded-xl border-2 text-lg font-black tracking-normal transition-colors '+(code[i]?'border-pastel-pink-300 bg-pastel-pink-50 text-slate-800':focused&&i===code.length?'border-pastel-pink-400 bg-white':'border-slate-200 bg-slate-50 text-slate-300')}>{code[i]||''}</span>
      </span>)}</span>
     </label>
     <p id="link-code-help" className="mt-3 text-xs text-slate-400">예: AB3D-7KQX · 붙여넣기도 돼요</p>
     {message&&<p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{message}</p>}
     <button type="submit" disabled={busy||code.length<LENGTH} className="mt-5 w-full rounded-2xl bg-pastel-pink-500 py-3 text-sm font-bold text-white shadow-sm transition-opacity disabled:opacity-40">{busy?'확인 중…':'연결하기'}</button>
    </form>
    <p className="mt-4 text-[11px] leading-relaxed text-slate-400">코드가 없다면 학원에 요청해 주세요.<br/>선생님은 입력하지 않아도 돼요. 관리자에게 선생님 권한을 요청해 주세요.</p>
   </>}
  </div>
 </div>;
}
