import {useState} from 'react';
import {Link2,Search,Unlink} from 'lucide-react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
const failures:Record<string,string>={
 STUDENT_ALREADY_LINKED:'이 학생은 이미 다른 앱 계정과 연결되어 있습니다. 먼저 그 연결을 해제해 주세요.',
 INVALID_ROLE:'학생 계정만 연결할 수 있습니다. 선생님 계정은 연결할 수 없습니다.',
 USER_NOT_FOUND:'앱 계정을 찾지 못했습니다. 목록을 새로고침해 주세요.',
 STUDENT_NOT_FOUND_IN_NOTION:'학생 정보를 찾지 못했습니다. 학생 목록을 새로고침해 주세요.',
 MULTIPLE_STUDENTS_MATCHED:'같은 학생으로 보이는 기록이 둘 이상입니다. 관리자에게 확인해 주세요.',
 FORBIDDEN_ADMIN_ONLY:'관리자만 앱 계정을 연결할 수 있습니다.',
};
const failureText=(r:any)=>failures[r.data?.error]||r.data?.message?.replace(/Notion\s*/g,'')||r.userMessage||'연결 결과를 확인하지 못했습니다.';
/** Admin: link this registered student to the app account they signed up with (uses /api/teacher/student-link unchanged). */
export default function StudentAccountLink({studentKey,studentName,linkedUid,onChanged}:{studentKey:string;studentName:string;linkedUid:string|null;onChanged:()=>Promise<void>|void}){
 const [open,setOpen]=useState(false),[users,setUsers]=useState<any[]|null>(null),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const baseName=studentName.replace(/\s*\(.*\)\s*$/,'').trim();
 async function load(){setMessage('');const r=await teacherAuthenticatedRequest<any>(auth,'/api/teacher/workspace?'+new URLSearchParams({action:'app-users'}));if(!r.ok||!r.data?.ok){setMessage('앱 사용자 목록을 불러오지 못했습니다.');return;}setUsers(r.data.users||[]);}
 function toggle(){const next=!open;setOpen(next);setQuery('');if(next&&!users)void load();}
 async function send(method:'POST'|'DELETE',body:any,done:string){
  setBusy(true);setMessage('');
  try{const r=await teacherAuthenticatedRequest<any>(auth,'/api/teacher/student-link',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!r.ok||!r.data?.ok){setMessage(failureText(r));return;}
   setUsers(null);setOpen(false);await onChanged();setMessage(done);
  }finally{setBusy(false);}
 }
 const linked=linkedUid?users?.find(u=>u.uid===linkedUid):null;
 // Students who are not linked yet; names that match this student come first.
 const candidates=(users||[]).filter(u=>u.role==='student'&&!u.isAdmin&&!u.linkedStudent&&(matchesKoreanSearch(u.name||'',query)||(u.email||'').toLowerCase().includes(query.toLowerCase())))
  .sort((a,b)=>Number((b.name||'').includes(baseName))-Number((a.name||'').includes(baseName))||(a.name||'').localeCompare(b.name||'','ko'));
 return <div className="sal">
  <button type="button" className={'sal-toggle'+(linkedUid?' is-linked':'')} aria-expanded={open} onClick={toggle}>{linkedUid?<><Link2 size={14} aria-hidden="true"/>앱 계정 연결됨</>:<><Link2 size={14} aria-hidden="true"/>앱 계정 연결하기</>}</button>
  {open&&<div className="sal-pop" role="dialog" aria-label="앱 계정 연결">
   {linkedUid?<>
    <p className="sal-title">연결된 앱 계정</p>
    {!users?<p className="gs-note">불러오는 중…</p>:<p className="sal-current"><strong>{linked?.name||'이름 없음'}</strong><span>{linked?.email||linkedUid}</span></p>}
    <p className="gs-note">연결을 해제하면 학생 앱에서 리포트·과제가 보이지 않습니다. 수업 기록은 그대로 남습니다.</p>
    <div className="gs-foot"><span className="gs-grow"/><button type="button" className="small-button" onClick={()=>setOpen(false)}>닫기</button><button type="button" className="gs-quiet sal-danger" disabled={busy} onClick={()=>{if(window.confirm(`${studentName} 학생과 앱 계정의 연결을 해제할까요?`))void send('DELETE',{firebaseUid:linkedUid},'앱 계정 연결을 해제했습니다.');}}><Unlink size={14} aria-hidden="true"/>연결 해제</button></div>
   </>:<>
    <p className="sal-title">{studentName} 학생이 가입한 앱 계정을 고르세요</p>
    <label className="student-master-search"><Search size={16} aria-hidden="true"/><input aria-label="앱 계정 검색" placeholder="이름·초성·이메일 검색" value={query} onChange={e=>setQuery(e.target.value)} autoFocus/></label>
    {!users?<p className="gs-note">앱 사용자 목록을 불러오는 중…</p>:<ul className="sal-list">{candidates.slice(0,30).map(u=><li key={u.uid}><span><strong>{u.name||'이름 없음'}</strong><small>{u.email}</small></span>
     <button type="button" className="small-button" disabled={busy} onClick={()=>{if(window.confirm(`${u.name||u.email} 계정을 ${studentName} 학생과 연결할까요?`))void send('POST',{firebaseUid:u.uid,studentKey},`${u.name||'앱 계정'} 계정을 연결했습니다.`);}}>연결</button></li>)}
     {!candidates.length&&<li className="gs-note">연결할 수 있는 학생 계정이 없습니다. 학생이 먼저 앱에 가입해야 합니다.</li>}</ul>}
   </>}
  </div>}
  {message&&<p role="status" className="sal-msg">{message}</p>}
 </div>;
}
