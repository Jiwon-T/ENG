import {useState} from 'react';
import {Copy,Globe} from 'lucide-react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
const SITE='https://jiwont.kr';
const failures:Record<string,string>={
 SLUG_ALREADY_IN_USE:'이미 다른 학생이 쓰는 주소입니다. 다른 주소를 입력해 주세요.',
 RESERVED_SLUG:'앱에서 쓰는 주소라 사용할 수 없습니다. 다른 주소를 입력해 주세요.',
 VALIDATION_ERROR:'영문 소문자와 숫자로 3~30자를 입력해 주세요.',
 GUARDIAN_CONTACT_MISSING:'보호자 연락처가 없어 주소를 만들 수 없습니다. 먼저 ‘정보 수정’에서 보호자 연락처를 입력해 주세요.',
 STUDENT_NOT_FOUND_IN_NOTION:'학생 정보를 찾지 못했습니다. 학생 목록을 새로고침해 주세요.',
 MULTIPLE_STUDENTS_MATCHED:'같은 학생으로 보이는 기록이 둘 이상입니다. 관리자에게 확인해 주세요.',
 FORBIDDEN_ADMIN_ONLY:'관리자만 학부모 주소를 만들거나 바꿀 수 있습니다.',
 SLUG_NOT_FOUND:'기존 주소를 찾지 못했습니다. 새로고침해 주세요.',
};
const failureText=(r:any)=>failures[r.data?.error]||String(r.data?.message||r.userMessage||'처리하지 못했습니다.').replace(/Notion\s*(\[[^\]]*\])?\s*/g,'');
/** Admin: the parent report's fixed address (jiwont.kr/주소) for this student, using /api/teacher/report-slug unchanged.
 *  Parents open it and confirm with the last 4 digits of the guardian phone. */
export default function ParentLinkControl({studentKey,studentName}:{studentKey:string;studentName:string}){
 const [open,setOpen]=useState(false),[current,setCurrent]=useState<string|null|undefined>(undefined),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[copied,setCopied]=useState(false);
 const call=(method:string,body?:any)=>teacherAuthenticatedRequest<any>(auth,method==='GET'?'/api/teacher/report-slug?'+new URLSearchParams({studentKey}):'/api/teacher/report-slug',method==='GET'?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const load=async()=>{setMessage('');const r=await call('GET');if(!r.ok||!r.data?.ok){setMessage(failureText(r));setCurrent(null);return;}setCurrent(r.data.reportSlug||null);};
 const toggle=()=>{const next=!open;setOpen(next);setInput('');setMessage('');if(next&&current===undefined)void load();};
 const clean=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,30);
 const save=async()=>{const slug=clean(input);if(slug.length<3){setMessage(failures.VALIDATION_ERROR);return;}
  if(current&&!window.confirm(`주소를 ${SITE}/${slug} 로 바꿀까요? 예전 주소(${SITE}/${current})는 더 이상 열리지 않고, 학부모님은 새 주소에서 다시 인증해야 합니다.`))return;
  setBusy(true);setMessage('');
  try{const r=current?await call('PATCH',{reportSlug:current,newReportSlug:slug}):await call('POST',{studentKey,reportSlug:slug});
   if(!r.ok||!r.data?.ok){setMessage(failureText(r));return;}
   setCurrent(slug);setInput('');setMessage(current?'주소를 바꿨습니다.':'학부모 주소를 만들었습니다.');
  }finally{setBusy(false);}};
 const url=current?`${SITE}/${current}`:'';
 return <div className="sal">
  <button type="button" className={'sal-toggle'+(current?' is-linked':'')} aria-expanded={open} onClick={toggle}><Globe size={14} aria-hidden="true"/>학부모 주소</button>
  {open&&<div className="sal-pop" role="dialog" aria-label="학부모 리포트 주소">
   <p className="sal-title">{studentName} 학부모 리포트 주소</p>
   {current===undefined?<p className="gs-note">불러오는 중…</p>:current?<>
    <p className="plc-url">{url}</p>
    <div className="gs-foot"><button type="button" className="small-button" onClick={()=>{void navigator.clipboard?.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>window.prompt('복사해 주세요.',url));}}><Copy size={14} aria-hidden="true"/>{copied?'복사됨':'주소 복사'}</button><a className="small-button" href={url} target="_blank" rel="noopener noreferrer">열어 보기 ↗</a></div>
    <p className="gs-note">학부모님은 이 주소에서 보호자 번호 뒤 4자리로 확인합니다.</p>
    <label className="plc-label">주소 바꾸기</label>
   </>:<p className="gs-note">아직 주소가 없습니다. 영문 소문자·숫자로 주소를 정해 주세요. 예: {SITE}/minsu24</p>}
   {current!==undefined&&<form className="plc-form" onSubmit={e=>{e.preventDefault();void save();}}><span className="plc-prefix">jiwont.kr/</span><input aria-label="학부모 주소" value={input} onChange={e=>setInput(clean(e.target.value))} placeholder={current||'minsu24'} autoComplete="off" spellCheck={false}/><button type="submit" className="primary-button" disabled={busy||clean(input).length<3}>{current?'바꾸기':'만들기'}</button></form>}
   {message&&<p role="status" className="sal-msg">{message}</p>}
  </div>}
 </div>;
}
