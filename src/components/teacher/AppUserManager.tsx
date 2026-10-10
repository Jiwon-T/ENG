import {useState} from 'react';
import {Search,UserMinus,UserPlus,Users} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
/** Admin: app accounts. Everyone signs up as a student; teacher access is given here, then students are assigned in 선생님 관리. */
export default function AppUserManager({busy,request,act,refresh}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;refresh:()=>Promise<any>}){
 const [list,setList]=useState<any[]|null>(null),[query,setQuery]=useState(''),[group,setGroup]=useState<'all'|'teacher'|'student'>('all'),[notice,setNotice]=useState('');
 const load=async()=>{const r=await request('read:app-users');setList(r.users||[]);};
 const isTeacher=(u:any)=>u.role==='teacher'||u.role==='principal';
 const shown=(list||[]).filter(u=>(group==='all'||group==='teacher'&&isTeacher(u)||group==='student'&&!isTeacher(u))&&(matchesKoreanSearch(u.name||'',query)||u.email.toLowerCase().includes(query.toLowerCase())));
 const change=(u:any,role:'teacher'|'student')=>{const msg=role==='teacher'?`${u.name||u.email} 계정에 선생님 권한을 줄까요? 이후 선생님 관리에서 담당 학생을 지정할 수 있습니다.`:`${u.name||u.email} 계정을 학생 계정으로 되돌릴까요? 선생님방 연결이 해제되며, 담당 기록은 보관됩니다.`;if(!window.confirm(msg))return;
  void act(async()=>{await request('set-user-role',{uid:u.uid,role});await load();await refresh();setNotice(role==='teacher'?`${u.name||u.email} 님에게 선생님 권한을 줬습니다. 선생님 관리에서 담당 학생을 지정해 주세요.`:`${u.name||u.email} 님을 학생 계정으로 되돌렸습니다.`);});};
 const [renaming,setRenaming]=useState<{uid:string;value:string}|null>(null);
 // App name: the person's own choice; the admin only corrects it.
 const rename=(u:any)=>{const name=renaming?.value.trim()||'';if(!name)return;
  void act(async()=>{const r=await request('set-user-name',{uid:u.uid,name});setRenaming(null);await load();setNotice(r.unchanged?'이름이 그대로입니다.':`앱 이름을 ‘${name}’(으)로 바꿨습니다.`);});};
 const [removed,setRemoved]=useState<any[]|null>(null);
 const loadRemoved=async()=>{const r=await request('read:removed-users');setRemoved(r.removed||[]);};
 const remove=(u:any)=>{if(!window.confirm(`${u.name||u.email} 계정을 탈퇴시킬까요?\n\n앱에 저장된 이 계정의 정보가 지워지고, 이 계정으로는 더 이상 로그인할 수 없습니다. 실수였다면 아래 ‘탈퇴한 계정’에서 로그인을 다시 허용할 수 있습니다.`))return;
  void act(async()=>{const r=await request('remove-app-user',{uid:u.uid,blockSignIn:true});await load();if(removed)await loadRemoved();setNotice(r.signInBlocked?`${u.name||u.email} 계정을 탈퇴시키고 로그인을 막았습니다.`:`${u.name||u.email} 계정을 탈퇴시켰지만 로그인 차단은 하지 못했습니다. ‘탈퇴한 계정’에서 다시 막아 주세요.`);});};
 const signIn=(r:any,block:boolean)=>{if(!window.confirm(block?`${r.name||r.email} 계정의 로그인을 막을까요?`:`${r.name||r.email} 계정의 로그인을 다시 허용할까요? 다시 로그인하면 새 학생 계정으로 시작합니다.`))return;
  void act(async()=>{await request('removed-user-signin',{id:r.id,block});await loadRemoved();setNotice(block?'로그인을 막았습니다.':'로그인을 다시 허용했습니다.');});};
 return <section className="panel rv">
  <div className="rv-head"><h2>앱 사용자{list&&<small>{list.length}명</small>}</h2>{!list&&<button type="button" className="small-button" disabled={busy} onClick={()=>act(load)}><Users size={16} aria-hidden="true"/>사용자 목록 열기</button>}</div>
  <p className="gs-note">앱 가입은 모두 학생으로 시작합니다. 선생님에게는 여기서 선생님 권한을 준 뒤, 선생님 관리에서 담당 학생을 지정하세요.</p>
  {list&&<>
   <div className="rv-filters"><label className="student-master-search"><Search size={16} aria-hidden="true"/><input aria-label="사용자 검색" placeholder="이름·초성·이메일 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="rv-seg" role="group" aria-label="사용자 구분">{([['all','전체',list.length],['teacher','선생님',list.filter(isTeacher).length],['student','학생',list.filter(u=>!isTeacher(u)).length]] as const).map(([k,l,n])=><button key={k} type="button" aria-pressed={group===k} onClick={()=>setGroup(k)}>{l} {n}</button>)}</div></div>
   <div className="gs-rows">{shown.slice(0,200).map(u=><div key={u.uid} className="gs-row app-user-row">
    {renaming?.uid===u.uid?<form className="gs-row-who app-user-rename" onSubmit={e=>{e.preventDefault();rename(u);}}><input aria-label={`${u.name||u.email} 앱 이름`} value={renaming.value} maxLength={100} autoFocus onChange={e=>setRenaming({uid:u.uid,value:e.target.value})}/><button type="submit" className="small-button" disabled={busy||!renaming.value.trim()}>저장</button><button type="button" className="gs-quiet" onClick={()=>setRenaming(null)}>취소</button></form>
     :<span className="gs-row-who"><strong>{u.name||'이름 없음'}<button type="button" className="gs-quiet app-user-rename-open" disabled={busy} onClick={()=>setRenaming({uid:u.uid,value:u.name||''})}>이름 바꾸기</button></strong><span className="rv-sub">{u.email}</span></span>}
    <span>{u.isAdmin?<StatusBadge kind="done" text="관리자"/>:isTeacher(u)?<StatusBadge kind={u.workspace&&!u.workspace.disabled?'done':'saved'} text={u.role==='principal'?'원장 선생님':u.workspace&&!u.workspace.disabled?'선생님':'선생님 · 연결 해제'}/>:<StatusBadge kind="unwritten" text={u.linkedStudent?'학생 · 연결됨':'학생'}/>}</span>
    {u.isAdmin?<span/>:isTeacher(u)?<button type="button" className="gs-quiet" disabled={busy} onClick={()=>change(u,'student')}>학생으로 되돌리기</button>
     :<span className="app-user-actions"><button type="button" className="small-button" disabled={busy||u.linkedStudent} title={u.linkedStudent?'학생과 연결된 계정입니다. 선생님은 별도 계정으로 가입해 주세요.':undefined} onClick={()=>change(u,'teacher')}><UserPlus size={14} aria-hidden="true"/>선생님 권한 주기</button><button type="button" className="gs-quiet app-user-remove" disabled={busy||u.linkedStudent} title={u.linkedStudent?'등록된 학생과 연결된 계정입니다. 학생 관리에서 연결을 먼저 해제해 주세요.':'이 계정을 탈퇴시킵니다'} onClick={()=>remove(u)}><UserMinus size={14} aria-hidden="true"/>탈퇴</button></span>}
   </div>)}</div>
   {shown.length>200&&<p className="gs-note">검색으로 범위를 좁혀 주세요. 처음 200명만 보입니다.</p>}
   {!shown.length&&<p className="rv-empty">조건에 맞는 사용자가 없습니다.</p>}
  </>}
  {list&&<details className="app-user-removed" onToggle={e=>{if((e.target as HTMLDetailsElement).open&&!removed)void act(loadRemoved);}}><summary>탈퇴한 계정{removed&&` ${removed.length}명`}</summary>
   {removed&&(removed.length?<div className="gs-rows">{removed.map(r=><div key={r.id} className="gs-row app-user-row"><span className="gs-row-who"><strong>{r.name||'이름 없음'}</strong><span className="rv-sub">{r.email} · {new Date(r.at).toLocaleDateString('ko-KR')} 탈퇴</span></span>
    <span>{r.signInBlocked?<StatusBadge kind="failed" text="로그인 막힘"/>:<StatusBadge kind="saved" text="로그인 가능"/>}</span>
    <button type="button" className="gs-quiet" disabled={busy} onClick={()=>signIn(r,!r.signInBlocked)}>{r.signInBlocked?'로그인 다시 허용':'로그인 막기'}</button></div>)}</div>:<p className="rv-empty">탈퇴한 계정이 없습니다.</p>)}</details>}
  {notice&&<p role="status" className="gs-note">{notice}</p>}
 </section>;
}
