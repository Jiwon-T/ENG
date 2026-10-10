import {useState} from 'react';
import {KeyRound} from 'lucide-react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
/** Home card for a student account not yet linked to the academy. Optional: teachers just skip it. */
export default function LinkCodeCard({onLinked}:{onLinked:(studentKey:string)=>void}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState('');
 const submit=async()=>{if(busy)return;setBusy(true);setMessage('');
  try{const r=await teacherAuthenticatedRequest<any>(auth,'/api/student/link-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});
   if(!r.ok||!r.data?.ok){setMessage(r.data?.message||'연결하지 못했습니다. 코드를 다시 확인해 주세요.');return;}
   setDone(`${r.data.studentDisplayName||'학생'} 학생으로 연결되었습니다. 이제 과제와 리포트를 볼 수 있어요.`);onLinked(r.data.studentKey);
  }finally{setBusy(false);}};
 if(done)return <section className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{done}</section>;
 return <section aria-label="학원 연결 코드" className="mb-4 rounded-2xl border border-pastel-pink-100 bg-white p-4">
  <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800"><KeyRound size={16} aria-hidden="true" className="text-pastel-pink-500"/>학원에서 받은 연결 코드가 있나요?</h2>
  <p className="mt-1 text-xs text-slate-500">학생은 코드를 입력하면 과제·일정·수업 리포트를 볼 수 있어요. 선생님은 입력하지 않아도 되며, 관리자에게 선생님 권한을 요청해 주세요.</p>
  <form className="mt-3 flex gap-2" onSubmit={e=>{e.preventDefault();void submit();}}>
   <input aria-label="연결 코드" value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,12))} placeholder="예: AB3D-7KQX" autoComplete="off" autoCapitalize="characters" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm tracking-widest"/>
   <button type="submit" disabled={busy||code.replace(/[^A-Za-z0-9]/g,'').length<8} className="rounded-xl bg-pastel-pink-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{busy?'확인 중…':'연결'}</button>
  </form>
  {message&&<p role="alert" className="mt-2 text-xs text-rose-600">{message}</p>}
 </section>;
}
