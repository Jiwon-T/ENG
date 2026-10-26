import {Fragment,useEffect,useState} from 'react';
import {ArrowRightLeft,BookOpen,ChevronDown,ChevronUp,Info,Link2,MoreHorizontal,School,Search,ShieldCheck,User,UserMinus,UserPlus,Users} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
import {askConfirm} from './ConfirmDialog';
import AccountMovePanel from './AccountMovePanel';
import AppUserStudyPanel from './AppUserStudyPanel';
/** One chip per account: the same shape for every kind, only the colour and icon differ. */
function userKind(u:any){
 if(u.isAdmin)return {text:'관리자',tone:'admin',Icon:ShieldCheck};
 if(u.role==='teacher'||u.role==='principal'){const on=u.workspace&&!u.workspace.disabled;return {text:u.role==='principal'?'원장 선생님':on?'선생님':'선생님 · 연결 해제',tone:on||u.role==='principal'?'teacher':'off',Icon:School};}
 return u.linkedStudent?{text:'학생 · 연결됨',tone:'linked',Icon:Link2}:{text:'학생',tone:'student',Icon:User};
}
/** Admin: app accounts. Everyone signs up as a student; teacher access is given here, then students are assigned in 선생님 관리. */
export default function AppUserManager({busy,request,act,refresh,autoLoad=false,onOpenStudents}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;refresh:()=>Promise<any>;autoLoad?:boolean;onOpenStudents?:()=>void}){
 // 학습 기록: the open panel of a student account not linked to a student yet (one at a time)
 const [studyUid,setStudyUid]=useState('');
 const [list,setList]=useState<any[]|null>(null),[query,setQuery]=useState(''),[group,setGroup]=useState<'all'|'teacher'|'student'>('all'),[notice,setNotice]=useState('');
 const load=async()=>{const r=await request('read:app-users');setList(r.users||[]);};
 // 연결 제안: accounts whose name matches one student without an account or one 앱 미연결 선생님 (hints only: a failed read hides the box).
 const [hints,setHints]=useState<{suggestions:any[];unclear:any[]}|null>(null);
 const loadHints=async()=>{try{setHints(await request('read:link-suggestions'));}catch{setHints(null);}};
 useEffect(()=>{if(autoLoad){void act(load);void loadHints();}},[]);
 const accept=async(s:any)=>{const student=s.kind==='student';
  if(!await askConfirm({title:student?`${s.accountName} 계정을 학생 ${s.targetName}과 연결할까요?`:`${s.accountName} 계정을 ${s.targetName} 선생님과 연결할까요?`,message:(student?'학생이 앱에서 자기 리포트와 과제를 볼 수 있게 돼요.':`${s.needsRole?'선생님 권한을 주고, ':''}담당 학생·정산·담당 변경 기록이 이 계정으로 옮겨져요. 되돌릴 수 없어요.`)+(s.sameName?'':'\n이름만 같아요. 같은 사람인지 꼭 확인해 주세요.'),details:[s.email,s.detail].filter(Boolean),confirmText:!student&&s.needsRole?'권한 주고 연결':'연결하기',icon:'link'}))return;
  void act(async()=>{await request('accept-link-suggestion',{kind:s.kind,uid:s.uid,targetId:s.targetId});await Promise.all([load(),loadHints()]);await refresh();setNotice(`${s.accountName} 계정을 ${student?'학생 ':''}${s.targetName}${student?'':' 선생님'}과 연결했어요.`);});};
 const dismiss=(s:any)=>void act(async()=>{await request('dismiss-link-suggestion',{kind:s.kind,uid:s.uid,targetId:s.targetId});await loadHints();});
 const isTeacher=(u:any)=>u.role==='teacher'||u.role==='principal';
 const shown=(list||[]).filter(u=>(group==='all'||group==='teacher'&&isTeacher(u)||group==='student'&&!isTeacher(u))&&(matchesKoreanSearch(u.name||'',query)||u.email.toLowerCase().includes(query.toLowerCase())));
 const change=async(u:any,role:'teacher'|'student')=>{const who=u.name||u.email;if(!await askConfirm(role==='teacher'?{title:`${who} 계정에 선생님 권한을 줄까요?`,message:'이후 선생님 관리에서 담당 학생을 지정할 수 있습니다.',confirmText:'권한 주기',icon:'user'}:{title:`${who} 계정을 학생 계정으로 되돌릴까요?`,message:'선생님방 연결이 해제되며, 담당 기록은 보관됩니다.',confirmText:'되돌리기',tone:'danger',icon:'user'}))return;
  void act(async()=>{await request('set-user-role',{uid:u.uid,role});await load();await refresh();setNotice(role==='teacher'?`${u.name||u.email} 님에게 선생님 권한을 줬습니다. 선생님 관리에서 담당 학생을 지정해 주세요.`:`${u.name||u.email} 님을 학생 계정으로 되돌렸습니다.`);});};
 const [renaming,setRenaming]=useState<{uid:string;value:string}|null>(null);
 // App name: the person's own choice; the admin only corrects it.
 const rename=(u:any)=>{const name=renaming?.value.trim()||'';if(!name)return;
  void act(async()=>{const r=await request('set-user-name',{uid:u.uid,name});setRenaming(null);await load();setNotice(r.unchanged?'이름이 그대로입니다.':`앱 이름을 ‘${name}’(으)로 바꿨습니다.`);});};
 const [removed,setRemoved]=useState<any[]|null>(null);
 // 계정 옮기기 (a pop-up): 새 계정으로 — a linked student's old account; 기존 계정으로 — an account not linked yet, into the student's linked one
 const [moving,setMoving]=useState<any|null>(null);
 const loadRemoved=async()=>{const r=await request('read:removed-users');setRemoved(r.removed||[]);};
 const remove=async(u:any)=>{if(!await askConfirm({title:`${u.name||u.email} 계정을 탈퇴시킬까요?`,message:`앱에 저장된 이 계정의 정보가 지워집니다. 같은 계정으로 다시 로그인하면 새 학생 계정으로 시작합니다.${u.linkedStudent?'\n학생과 연결된 계정이라 연결도 함께 해제됩니다. 학생 기록·리포트·학부모 주소는 그대로 남습니다.':''}\n다시 가입하지 못하게 하려면 아래 ‘탈퇴한 계정’에서 로그인을 막을 수 있습니다.`,confirmText:'탈퇴시키기',tone:'danger',icon:'trash'}))return;
  void act(async()=>{await request('remove-app-user',{uid:u.uid,blockSignIn:false});await load();if(removed)await loadRemoved();setNotice(`${u.name||u.email} 계정을 탈퇴시켰습니다. 다시 로그인하면 새 학생 계정으로 시작합니다.`);});};
 const signIn=async(r:any,block:boolean)=>{if(!await askConfirm(block?{title:`${r.name||r.email} 계정의 로그인을 막을까요?`,confirmText:'로그인 막기',tone:'danger',icon:'alert'}:{title:`${r.name||r.email} 계정의 로그인을 다시 허용할까요?`,message:'다시 로그인하면 새 학생 계정으로 시작합니다.',confirmText:'다시 허용',icon:'check'}))return;
  void act(async()=>{await request('removed-user-signin',{id:r.id,block});await loadRemoved();setNotice(block?'로그인을 막았습니다.':'로그인을 다시 허용했습니다.');});};
 return <section className="panel rv">
  <div className="rv-head"><h2>앱 사용자{list&&<small>{list.length}명</small>}</h2>{!list&&<button type="button" className="small-button" disabled={busy} onClick={()=>act(load)}><Users size={16} aria-hidden="true"/>사용자 목록 열기</button>}</div>
  {hints&&(hints.suggestions.length>0||hints.unclear.length>0)&&<div className="lsg" role="region" aria-label="연결 제안"><p className="lsg-title"><Link2 size={14} aria-hidden="true"/>연결 제안 {hints.suggestions.length+hints.unclear.filter(u=>u.choices?.length).length}</p>
   {hints.suggestions.map(s=><div key={s.kind+s.uid+s.targetId} className="lsg-row"><span className={'lsg-kind is-'+s.kind}>{s.kind==='student'?'학생':'선생님'}</span><span className="lsg-who"><b>{s.accountName}</b> <small>{s.email}</small> → {s.kind==='student'?'학생 ':''}<b>{s.targetName}</b>{s.detail&&<small> · {s.detail}</small>}{!s.sameName&&<em className="lsg-partial">이름만 같아요</em>}</span><button type="button" className="small-button" disabled={busy} onClick={()=>void accept(s)}>{s.kind==='teacher'&&s.needsRole?'권한 주고 연결':'연결'}</button><button type="button" className="gs-quiet" disabled={busy} onClick={()=>dismiss(s)}>아니요</button></div>)}
   {hints.unclear.map(u=>u.choices?.length?<div key={'c'+u.kind+u.uid} className="lsg-pick"><p className="lsg-pick-head"><span className={'lsg-kind is-'+u.kind}>{u.kind==='student'?'학생':'선생님'}</span><b>{u.accountName}</b> <small>{u.email}{u.joined?` · ${u.joined.slice(5).replace('-','/')} 가입`:''}</small> → 누구와 연결할까요?</p>
    {u.choices.map((c:any)=><div key={c.targetId} className="lsg-row lsg-choice"><span className="lsg-who"><b>{c.targetName}</b>{c.detail&&<small> · {c.detail}</small>}{(c.registered||c.subjects)&&<span className="lsg-dates">{c.registered&&`학원 등록 ${c.registered.replaceAll('-','.')}`}{c.registered&&c.subjects?' · ':''}{c.subjects}</span>}</span>{!c.sameName&&<em className="lsg-partial">이름만 같아요</em>}{c.justBefore&&<em className="lsg-near">가입 직전 등록</em>}<button type="button" className="small-button" disabled={busy} onClick={()=>void accept({kind:u.kind,uid:u.uid,accountName:u.accountName,email:u.email,targetId:c.targetId,targetName:c.targetName,detail:c.detail,sameName:c.sameName===true,needsRole:u.needsRole})}>{u.kind==='teacher'&&u.needsRole?'권한 주고 연결':'연결'}</button></div>)}
    <p className="lsg-pick-foot">{u.kind==='student'?'헷갈리면 학생 관리에서 연결 코드를 주는 게 가장 확실해요.':'헷갈리면 선생님 관리에서 직접 연결해 주세요.'}<button type="button" className="gs-quiet" disabled={busy} onClick={()=>void act(async()=>{for(const c of u.choices)await request('dismiss-link-suggestion',{kind:u.kind,uid:u.uid,targetId:c.targetId});await loadHints();})}>아니요</button></p></div>
    :<p key={'u'+u.kind+u.uid} className="lsg-unclear"><Info size={13} aria-hidden="true"/><span><b>{u.accountName}</b> 계정: 같은 {u.kind==='student'?'학생':'선생님'}과 이름이 같은 계정이 여럿이라 {u.kind==='student'?'학생 관리':'선생님 관리'}에서 직접 연결해 주세요.</span></p>)}
  </div>}
  <p className="gs-note">앱 가입은 모두 학생으로 시작합니다. 선생님에게는 여기서 선생님 권한을 준 뒤, 선생님 관리에서 담당 학생을 지정하세요.</p>
  {list&&<>
   <div className="rv-filters"><label className="student-master-search"><Search size={16} aria-hidden="true"/><input aria-label="사용자 검색" placeholder="이름·초성·이메일 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="rv-seg" role="group" aria-label="사용자 구분">{([['all','전체',list.length],['teacher','선생님',list.filter(isTeacher).length],['student','학생',list.filter(u=>!isTeacher(u)).length]] as const).map(([k,l,n])=><button key={k} type="button" aria-pressed={group===k} onClick={()=>setGroup(k)}>{l} {n}</button>)}</div></div>
   {moving&&<AccountMovePanel key={moving.uid+(moving.moveMode||'')} from={moving} mode={moving.moveMode||'new'} users={list} busy={busy} request={request} act={act} onClose={()=>setMoving(null)} onMoved={async message=>{setMoving(null);await load();await refresh();setNotice(message);}}/>}
   <div className="gs-rows">{shown.slice(0,200).map(u=>{const k=userKind(u),who=u.name||u.email;const unlinked=!u.isAdmin&&!isTeacher(u)&&!u.linkedStudent;return <Fragment key={u.uid}><div className="gs-row app-user-row">
    {renaming?.uid===u.uid?<form className="gs-row-who app-user-rename" onSubmit={e=>{e.preventDefault();rename(u);}}><input aria-label={`${who} 앱 이름`} value={renaming.value} maxLength={100} autoFocus onChange={e=>setRenaming({uid:u.uid,value:e.target.value})}/><button type="submit" className="small-button" disabled={busy||!renaming.value.trim()}>저장</button><button type="button" className="gs-quiet" onClick={()=>setRenaming(null)}>취소</button></form>
     :<span className="gs-row-who"><strong>{u.name||'이름 없음'}</strong><span className="rv-sub">{u.email}{u.joinedAt&&` · ${new Date(u.joinedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric'})} 가입`}</span>{unlinked&&<button type="button" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-[#8b2f40]" aria-expanded={studyUid===u.uid} onClick={()=>setStudyUid(studyUid===u.uid?'':u.uid)}><BookOpen size={13} aria-hidden="true"/>학습 기록{studyUid===u.uid?<ChevronUp size={13} aria-hidden="true"/>:<ChevronDown size={13} aria-hidden="true"/>}</button>}</span>}
    <span className={'aur-chip is-'+k.tone}><k.Icon size={13} aria-hidden="true"/>{k.text}</span>
    <span className="aur-main">{u.isAdmin||u.linkedStudent?null:isTeacher(u)?<button type="button" className="aur-button" disabled={busy} onClick={()=>change(u,'student')}>학생으로 되돌리기</button>:<button type="button" className="aur-button" disabled={busy} onClick={()=>change(u,'teacher')}><UserPlus size={14} aria-hidden="true"/>선생님 권한 주기</button>}</span>
    <details className="aur-more"><summary aria-label={`${who} 더 보기`} title="더 보기"><MoreHorizontal size={16} aria-hidden="true"/></summary><div className="aur-menu" onClick={e=>{if((e.target as HTMLElement).closest('button'))e.currentTarget.closest('details')?.removeAttribute('open');}}>
     <button type="button" disabled={busy} onClick={()=>setRenaming({uid:u.uid,value:u.name||''})}>이름 바꾸기</button>
     {u.linkedStudent&&!u.isAdmin&&<button type="button" disabled={busy} title="로그인이 안 돼서 새로 가입한 학생: 이 계정의 앱 기록을 새 계정으로 옮겨요" onClick={()=>setMoving(u)}><ArrowRightLeft size={14} aria-hidden="true"/>새 계정으로 옮기기</button>}
     {unlinked&&<button type="button" disabled={busy} title="학원과 연결하기 전에 따로 가입해 공부한 계정: 앱 기록을 학원과 연결된 계정으로 합쳐요" onClick={()=>setMoving({...u,moveMode:'existing'})}><ArrowRightLeft size={14} aria-hidden="true"/>기존 계정으로 옮기기</button>}
     {!u.isAdmin&&!isTeacher(u)&&<button type="button" className="is-danger" disabled={busy} title={u.linkedStudent?'졸업·퇴원한 학생의 계정을 탈퇴시킵니다. 학생 기록과 리포트는 남습니다.':'이 계정을 탈퇴시킵니다'} onClick={()=>remove(u)}><UserMinus size={14} aria-hidden="true"/>탈퇴</button>}
     {u.linkedStudent&&<p>학생과 연결된 계정이라 선생님 권한을 줄 수 없어요. 선생님은 따로 가입해 주세요.</p>}
     {isTeacher(u)&&!u.isAdmin&&<p>탈퇴하려면 먼저 학생으로 되돌려 주세요.</p>}
    </div></details>
   </div>{unlinked&&studyUid===u.uid&&<AppUserStudyPanel uid={u.uid} name={who} request={request} onOpenStudents={onOpenStudents}/>}</Fragment>;})}</div>
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
