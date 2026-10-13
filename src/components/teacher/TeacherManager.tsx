import {Fragment,useEffect,useMemo,useState} from 'react';
import {Search,UserCog,Users,AlertCircle} from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
import StatusBadge from './StatusBadge';
import {studentSearchResults} from '../../lib/koreanSearch';
import {askConfirm,askDiscard} from './ConfirmDialog';
import {useLeaveProtection} from '../../lib/leaveProtection';
import {askTransferReason} from './TransferReasonDialog';
import {isCoTeacherDrop,offlineTeacherLabel,shortTeacherName,transferTarget} from '../../lib/teacherName';
import OfflineTeacherForm from './OfflineTeacherForm';
const SUBJECTS=['영어','수학','국어','과학','한국사'];
const STUDENTS_PER_PAGE=10;
type Scope={studentKey:string;subject:string};
type Transfer={id:string;studentKey:string;subject:string;fromUids:string[];toUids:string[];afterUids?:string[]|null;reason:string;note:string;at:number};
const seoulDay=(at:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(at));
const sameKey=(a:string,b:string)=>a.replace(/-/g,'').toLowerCase()===b.replace(/-/g,'').toLowerCase();
const COMPLAINT='학생·학부모 요청';
/** App-only teacher management: who teaches which student and subject, role, and access. */
export default function TeacherManager({data,request,act,busy,refresh}:{data:any;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;busy:boolean;refresh:()=>Promise<any>}){
 const [editing,setEditing]=useState<any>(null),[showUnassigned,setShowUnassigned]=useState(false),[notice,setNotice]=useState(''),[adding,setAdding]=useState(false);
 // 담당 변경 기록 (principal/admin only, like this whole screen): counts on the cards, the list inside a teacher's dialog.
 // null while loading or after a failed read (shown as such, never as 0); [] means there really are none.
 const [transfers,setTransfers]=useState<Transfer[]|null>(null),[transferState,setTransferState]=useState<'loading'|'ready'|'failed'>('loading');
 const loadTransfers=()=>{setTransferState('loading');return request('read:teacher-transfers').then(r=>{setTransfers(r.transfers||[]);setTransferState('ready');},()=>{setTransfers(null);setTransferState('failed');});};
 useEffect(()=>{void loadTransfers();},[]);
 const thisMonth=seoulDay(Date.now()).slice(0,7),monthTransfers=(transfers||[]).filter(r=>seoulDay(r.at).slice(0,7)===thisMonth);
 const students:any[]=data.students||[],staff:any[]=data.staff||[],access:any[]=data.access||[];
 const nameOf=(key:string)=>students.find(s=>s.studentKey===key||sameKey(String(s.studentKey||''),key))?.studentDisplayName||'학생';
 const profileOf=(uid:string)=>access.find(a=>a.uid===uid)||null;
 const teachers=staff.map(s=>{const p=profileOf(s.uid);return {...s,profile:p,label:p?.workspaceLabel||s.name,scopes:(p?.scopes||[]) as Scope[],disabled:Boolean(p?.disabled),role:p?.workspaceRole||'teacher'};});
 const assigned=new Set(teachers.filter(t=>!t.disabled).flatMap(t=>t.scopes.map(s=>s.studentKey)));
 const unassigned=students.filter(s=>!assigned.has(s.studentKey));
 return <section className="panel rv">
  <div className="rv-head"><h2>선생님 관리<small>{teachers.length}명</small></h2>{(data.admin||data.principal)&&<button type="button" className="small-button" disabled={busy} onClick={()=>setAdding(true)}>+ 선생님 추가</button>}</div>
  {adding&&<OfflineTeacherForm busy={busy} onClose={()=>setAdding(false)} onSubmit={value=>act(async()=>{const r=await request('create-offline-teacher',value);setAdding(false);await refresh();setNotice(`${r.label} 선생님을 추가했어요. 카드를 눌러 담당 학생을 정해 주세요.`);})}/>}
  <p className="gs-note">선생님을 누르면 담당 학생·과목, 직책, 연결 여부를 바로 바꿀 수 있습니다. 새 선생님은 ‘앱 사용자’ 메뉴에서 선생님 권한을 먼저 주세요.</p>
  <div className={`rv-stats${transfers?' has-five':''}`}>
   <div className="rv-stat"><b>{teachers.filter(t=>!t.disabled).length}</b><span>재직 중인 선생님</span></div>
   <div className="rv-stat"><b>{teachers.filter(t=>!t.disabled&&!t.scopes.length).length}</b><span>담당 미설정</span></div>
   <div className="rv-stat"><b>{assigned.size}</b><span>담당이 있는 학생</span></div>
   <button type="button" className="rv-stat warn" aria-pressed={showUnassigned} onClick={()=>setShowUnassigned(v=>!v)}><b>{unassigned.length}</b><span>담당 선생님 없는 학생</span></button>
   {transfers&&<div className="rv-stat"><b>{monthTransfers.length}</b><span>이번 달 담당 변경</span></div>}
  </div>
  {transferState==='failed'&&<p className="gs-note tt-failed" role="status">담당 변경 기록을 불러오지 못했어요. <button type="button" className="gs-link" onClick={()=>void loadTransfers()}>다시 시도</button></p>}
  {showUnassigned&&<div className="rv-muted">{unassigned.length?<>담당 선생님이 없는 학생: {unassigned.map(s=>s.studentDisplayName).join(', ')}</>:'모든 학생에게 담당 선생님이 있습니다.'}</div>}
  <div className="rv-cards">{teachers.map(t=>{const bySubject=SUBJECTS.map(subject=>[subject,t.scopes.filter(s=>s.subject===subject).length] as const).filter(([,n])=>n>0);const names=[...new Set(t.scopes.map(s=>s.studentKey))];
   return <button key={t.uid} type="button" className="rv-card" disabled={busy} onClick={()=>{setNotice('');setEditing(t);}} aria-label={`${t.label} 선생님 관리`}>
    <span className="rv-card-top"><strong className="rv-who">{t.label}</strong><span className="rv-grade">{t.role==='principal'?'원장':'선생님'}</span></span>
    <span className="rv-sub">{bySubject.length?bySubject.map(([s,n])=>`${s} ${n}명`).join(' · '):'담당 학생 없음'}</span>
    {names.length>0&&<span className="rv-sub" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{names.slice(0,6).map(nameOf).join(', ')}{names.length>6?` 외 ${names.length-6}명`:''}</span>}
    {t.profile?.offline&&<span className="rv-sub">{(t.profile.subjects||[]).join('·')}{t.profile.phone?` · ${t.profile.phone}`:''}</span>}
    <StatusBadge kind={t.disabled?'failed':t.profile?.offline?'unlinked':t.scopes.length?'done':'unwritten'} text={t.disabled?'연결 해제됨':t.profile?.offline?'앱 미연결':t.scopes.length?'재직 중':'담당 미설정'}/>
    {transfers&&(()=>{const got=monthTransfers.filter(r=>r.toUids.includes(t.uid)).length,gave=monthTransfers.filter(r=>r.fromUids.includes(t.uid)),asked=gave.filter(r=>r.reason===COMPLAINT).length;return <span className="tt-moves">{got||gave.length?<>{got>0&&<span className="tt-move">이번 달 받음 {got}</span>}{gave.length>0&&<span className="tt-move">넘김 {gave.length}</span>}{asked>0&&<span className="tt-move is-asked">요청 {asked}</span>}</>:<span className="tt-move">이번 달 변경 없음</span>}</span>;})()}
   </button>;})}</div>
  {notice&&<p role="status" className="gs-note">{notice}</p>}
  {editing&&<Fragment key={editing.uid}><TeacherEditor teacher={editing} data={data} busy={busy} transfers={transfers} transferState={transferState} onRetryTransfers={()=>void loadTransfers()} teacherName={uid=>teachers.find(x=>x.uid===uid)?.label||'선생님'} studentName={nameOf} onClose={()=>setEditing(null)}
   onSave={async value=>act(async()=>{await request('grant',value);setEditing(null);await refresh();setNotice(`${value.workspaceLabel||editing.name} 선생님의 담당을 저장했습니다.`);})}
   onLink={async account=>{if(!await askConfirm({title:'이 계정과 연결할까요?',message:'담당 학생, 수강 관리 담당, 정산 비율·조정, 담당 변경 기록이 이 계정으로 옮겨지고 이름은 지금 이름 그대로 보여요. 연결하면 앱에서 직접 일지를 써요. 되돌릴 수 없어요.',details:[`${editing.label} → ${account.name} 계정`],confirmText:'연결하기',icon:'link'}))return;await act(async()=>{await request('link-offline-teacher',{offlineUid:editing.uid,uid:account.uid});setEditing(null);await refresh();void loadTransfers();setNotice(`${editing.label} 선생님을 ${account.name} 계정과 연결했어요.`);});}}
   onAccess={async disabled=>act(async()=>{await request('teacher-access',{uid:editing.uid,disabled});setEditing(null);await refresh();setNotice(`${editing.label} 선생님을 ${disabled?'연결 해제':'다시 연결'}했습니다.`);})}/></Fragment>}
 </section>;
}
function TeacherEditor({teacher,data,busy,transfers,transferState,onRetryTransfers,teacherName,studentName,onClose,onSave,onAccess,onLink}:{teacher:any;data:any;busy:boolean;transfers:Transfer[]|null;transferState:'loading'|'ready'|'failed';onRetryTransfers:()=>void;teacherName:(uid:string)=>string;studentName:(key:string)=>string;onClose:()=>void;onSave:(v:any)=>Promise<void>;onAccess:(disabled:boolean)=>Promise<void>;onLink:(account:{uid:string;name:string})=>Promise<void>}){
 const students:any[]=data.students||[];
 const [label,setLabel]=useState(teacher.profile?.workspaceLabel||''),[role,setRole]=useState(teacher.role),[scopes,setScopes]=useState<Scope[]>(teacher.scopes);
 // Added without an app account: 연락처 (required), 메모, 담당 과목 are edited here; the label follows the subjects unless it was changed by hand.
 const offline=Boolean(teacher.profile?.offline);
 const [phone,setPhone]=useState(teacher.profile?.phone||''),[memo,setMemo]=useState(teacher.profile?.memo||''),[teaches,setTeaches]=useState<string[]>(teacher.profile?.subjects||[]);
 const changeTeaches=(next:string[])=>{const base=shortTeacherName(label);if(label===offlineTeacherLabel(base,teaches))setLabel(offlineTeacherLabel(base,next));setTeaches(next);};
 // An account's 명부 줄 made by the app (at 선생님 권한, or on the first save here for older accounts): 담당 과목 is chosen here.
 const appRow=!offline&&Boolean(teacher.profile)&&(Boolean(teacher.profile?.appTeacherRow)||!teacher.profile?.notionTeacherPageId)&&!(data.admin&&teacher.uid===data.uid);
 const subjectsChanged=appRow&&JSON.stringify([...teaches].sort())!==JSON.stringify([...(teacher.profile?.subjects||[])].sort());
 const offlineChanged=offline&&(phone!==(teacher.profile?.phone||'')||memo!==(teacher.profile?.memo||'')||JSON.stringify([...teaches].sort())!==JSON.stringify([...(teacher.profile?.subjects||[])].sort()));
 // 앱 계정 연결: accounts with 선생님 권한 that are not linked to a teacher record yet (their own 담당 is merged).
 const linkable=offline&&(data.admin||data.principal)?((data.access||[]) as any[]).filter(a=>!a.offline&&!a.disabled&&(!a.notionTeacherPageId||a.appTeacherRow&&!a.linkedOfflineUid)&&a.academyId==='main'&&a.uid!==data.uid).map(a=>({uid:a.uid as string,name:String(a.workspaceLabel||(data.staff||[]).find((s:any)=>s.uid===a.uid)?.name||'선생님'),students:new Set((a.scopes||[]).map((s:Scope)=>s.studentKey)).size})):null;
 const [linkTo,setLinkTo]=useState('');
 const offlineProblem=offline&&(!/^0\d{8,10}$/.test(phone.replace(/[\s()-]/g,''))?'연락처를 확인해 주세요.':!teaches.length?'담당 과목을 하나 이상 골라 주세요.':'');
 const [subject,setSubject]=useState(()=>SUBJECTS.find(s=>teacher.scopes.some((x:Scope)=>x.subject===s))||'영어'),[query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'mine'|'none'>('all');
 // Other teachers on this subject, by student: shown by name without the subject word ("영어 이지원T" → "이지원T").
 const othersBy=useMemo(()=>{const map=new Map<string,string[]>();for(const a of (data.access||[]) as any[]){if(a.uid===teacher.uid||a.disabled)continue;const name=shortTeacherName(a.workspaceLabel||(data.staff||[]).find((s:any)=>s.uid===a.uid)?.name||'선생님');for(const s of (a.scopes||[]) as Scope[])if(s.subject===subject)map.set(s.studentKey,[...(map.get(s.studentKey)||[]),name]);}return map;},[data.access,data.staff,teacher.uid,subject]);
 const others=useMemo(()=>new Set(othersBy.keys()),[othersBy]);
 const has=(key:string,sub=subject)=>scopes.some(s=>s.studentKey===key&&s.subject===sub);
 const toggle=(key:string,on:boolean)=>setScopes(old=>on?(old.some(s=>s.studentKey===key&&s.subject===subject)?old:[...old,{studentKey:key,subject}]):old.filter(s=>!(s.studentKey===key&&s.subject===subject)));
 const shown=studentSearchResults(students,query).filter((s:any)=>filter==='all'||filter==='mine'&&has(s.studentKey)||filter==='none'&&!has(s.studentKey)&&!others.has(s.studentKey));
 // 10 students per page; a new search, view or subject starts again from page 1.
 const [page,setPage]=useState(1),[movePage,setMovePage]=useState(1);useEffect(()=>setPage(1),[query,filter,subject]);
 const pages=Math.max(1,Math.ceil(shown.length/STUDENTS_PER_PAGE)),current=Math.min(page,pages),pageRows=shown.slice((current-1)*STUDENTS_PER_PAGE,current*STUDENTS_PER_PAGE);
 const changed=JSON.stringify([...scopes].sort((a,b)=>(a.studentKey+a.subject).localeCompare(b.studentKey+b.subject)))!==JSON.stringify([...teacher.scopes].sort((a:Scope,b:Scope)=>(a.studentKey+a.subject).localeCompare(b.studentKey+b.subject)))||label!==(teacher.profile?.workspaceLabel||'')||role!==teacher.role||offlineChanged||subjectsChanged;
 useLeaveProtection(changed);
 const canAccess=data.admin&&teacher.profile&&teacher.uid!==data.uid;
 // Students this teacher stops teaching (subject not 중단) → one reason for all, recorded for the principal and admin.
 const statusOf=(key:string,sub:string)=>(students.find((st:any)=>st.studentKey===key)?.subjects||[]).find((x:any)=>x.subject===sub)?.status;
 const save=async()=>{const dropped=(teacher.scopes as Scope[]).filter(s=>!scopes.some(x=>x.studentKey===s.studentKey&&x.subject===s.subject)&&statusOf(s.studentKey,s.subject)!=='중단');
  let reason:{reason:string;note:string}|null=null;
  if(dropped.length){reason=await askTransferReason(`${teacher.label} 선생님 담당에서 빼는 이유`,[...dropped.slice(0,5).map(s=>`${students.find((st:any)=>st.studentKey===s.studentKey)?.studentDisplayName||'학생'} · ${s.subject}`),...(dropped.length>5?[`외 ${dropped.length-5}명`]:[])]);if(!reason)return;}
  await onSave({uid:teacher.uid,scopes,notionTeacherPageId:teacher.profile?.notionTeacherPageId||null,workspaceLabel:label.trim(),workspaceRole:role,academyId:data.academyId||'main',assignmentRevision:teacher.profile?.assignmentRevision||0,academyStudents:[...new Set(scopes.map(s=>s.studentKey))],...(reason?{transferReason:reason.reason,transferNote:reason.note}:{}),...(offline?{offlinePhone:phone,offlineMemo:memo.trim(),offlineSubjects:teaches}:{}),...(appRow?{teacherSubjects:teaches}:{})});};
 return <WorkspaceDialog open title={`${teacher.label} 선생님`} onClose={async()=>{if(busy)return;if(changed&&!await askDiscard('저장하지 않은 변경을 닫을까요?'))return;onClose();}}><section className="gs">
  {teacher.disabled&&<p className="rv-missing"><AlertCircle size={16} aria-hidden="true"/>선생님방 연결이 해제된 선생님입니다. 담당은 보관되어 있으며 다시 연결하면 그대로 돌아옵니다.</p>}
  <section className="gs-sec"><h3><span className="gs-num">1</span>기본 정보</h3>
   <label><span className="gs-lbl">화면에 보일 이름 <span className="gs-opt">(비우면 계정 이름 “{teacher.name}”)</span></span><input value={label} maxLength={100} disabled={busy} onChange={e=>setLabel(e.target.value)} placeholder={teacher.name}/></label>
   {offline?<>
    <div><span className="gs-lbl">담당 과목</span><div className="otf-subjects" role="group" aria-label="담당 과목">{['국어','영어','수학','과학','한국사'].map(s=>{const on=teaches.includes(s);return <button key={s} type="button" aria-pressed={on} disabled={busy} onClick={()=>changeTeaches(on?teaches.filter(x=>x!==s):[...teaches,s])}>{s}</button>;})}</div></div>
    <label><span className="gs-lbl">연락처</span><input type="tel" value={phone} maxLength={30} disabled={busy} onChange={e=>setPhone(e.target.value)}/></label>
    <label><span className="gs-lbl">메모 <span className="gs-opt">(선택)</span></span><input value={memo} maxLength={200} disabled={busy} onChange={e=>setMemo(e.target.value)}/></label>
    <p className="gs-note">앱에 가입하지 않은 선생님이에요. 일지는 앱 밖에서 쓰고, 정산은 수강료 계산의 수업 횟수로 계산돼요.</p>
    {offlineProblem&&<p role="alert" className="otf-error">{offlineProblem}</p>}
    {linkable&&<div className="otl"><span className="gs-lbl">앱 계정 연결</span>
     {linkable.length?<div className="otl-row"><select aria-label="연결할 계정" value={linkTo} disabled={busy||changed} onChange={e=>setLinkTo(e.target.value)}><option value="">계정 선택</option>{linkable.map(a=><option key={a.uid} value={a.uid}>{a.name}{a.students?` · 담당 ${a.students}명`:''}</option>)}</select><button type="button" className="small-button" disabled={busy||changed||!linkTo} onClick={()=>{const a=linkable.find(x=>x.uid===linkTo);if(a)void onLink(a);}}>연결</button></div>
     :<p className="gs-note">연결할 계정이 없어요. 선생님이 가입한 뒤 관리자가 ‘선생님 권한’을 주면 여기서 고를 수 있어요.</p>}
     {linkable.length>0&&<p className="gs-note">{changed?'바꾼 내용을 먼저 저장해 주세요.':'선생님 권한을 받았고 아직 연결되지 않은 계정만 보여요.'}</p>}</div>}
   </>:<>
   <div className="gs-seg" role="group" aria-label="직책">{([['teacher','선생님'],['principal','원장 선생님']] as const).map(([k,l])=><button key={k} type="button" aria-pressed={role===k} disabled={busy||!data.admin} onClick={()=>setRole(k)}>{l}</button>)}</div>
   {!data.admin&&<p className="gs-note">직책은 관리자만 바꿀 수 있습니다.</p>}
   {appRow&&<div><span className="gs-lbl">담당 과목</span><div className="otf-subjects" role="group" aria-label="담당 과목">{['국어','영어','수학','과학','한국사'].map(s=>{const on=teaches.includes(s);return <button key={s} type="button" aria-pressed={on} disabled={busy} onClick={()=>setTeaches(on?teaches.filter(x=>x!==s):[...teaches,s])}>{s}</button>;})}</div>{!teaches.length&&<p className="gs-note">담당 과목을 골라야 수강 관리·원서에서 이 선생님을 고를 수 있어요.</p>}</div>}</>}
  </section>
  <section className="gs-sec"><h3><span className="gs-num">2</span>담당 학생</h3>
   <div className="gs-chips" role="group" aria-label="과목">{SUBJECTS.map(s=>{const n=scopes.filter(x=>x.subject===s).length;return <button key={s} type="button" className="rv-chip" aria-pressed={subject===s} onClick={()=>setSubject(s)}>{s}{n?` ${n}`:''}</button>;})}</div>
   <div className="gs-add"><label className="rv-search" style={{display:'flex',alignItems:'center',gap:6,border:'1px solid #e2e8f0',borderRadius:12,padding:'0 12px',minHeight:44}}><Search size={16} aria-hidden="true" color="#94a3b8"/><input aria-label="학생 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="학생 이름·초성 검색" style={{border:0,margin:0,minHeight:'auto',padding:0,boxShadow:'none',flex:1}}/></label>
    <div className="rv-seg" role="group" aria-label="보기">{([['all','전체'],['mine','담당 중'],['none','미배정']] as const).map(([k,l])=><button key={k} type="button" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l}</button>)}</div></div>
   <div className="gs-chips"><button type="button" className="gs-link" disabled={busy||!shown.length} onClick={()=>setScopes(old=>[...old,...shown.filter((s:any)=>!has(s.studentKey)).map((s:any)=>({studentKey:s.studentKey,subject}))])}><Users size={14} aria-hidden="true"/>조건에 맞는 {shown.length}명 모두 {subject} 담당</button><button type="button" className="gs-link" disabled={busy||!shown.some((s:any)=>has(s.studentKey))} onClick={()=>{const keys=new Set(shown.map((s:any)=>s.studentKey));setScopes(old=>old.filter(s=>!(s.subject===subject&&keys.has(s.studentKey))));}}>조건에 맞는 학생 담당 해제</button></div>
   <div className="gs-rows is-two">{pageRows.map((s:any)=>{const on=has(s.studentKey),otherSubjects=SUBJECTS.filter(x=>x!==subject&&has(s.studentKey,x));return <label key={s.studentKey} className="gs-row" style={{gridTemplateColumns:'auto minmax(0,1fr) auto',cursor:'pointer',...(on?{borderColor:'var(--workspace-brand-dot)',background:'var(--workspace-brand-bg)'}:{})}}>
    <input type="checkbox" checked={on} disabled={busy} onChange={e=>toggle(s.studentKey,e.target.checked)} aria-label={`${s.studentDisplayName} ${subject} 담당`} style={{width:20,height:20,minHeight:'auto',margin:0}}/>
    <span className="gs-row-who"><strong>{s.studentDisplayName}</strong>{otherSubjects.map(x=><span key={x} className="rv-pill">{x}</span>)}</span>
    <span className="rv-sub" title={othersBy.has(s.studentKey)?`${subject} 담당: ${othersBy.get(s.studentKey)!.join(', ')}`:undefined}>{othersBy.get(s.studentKey)?.join(', ')||''}</span></label>;})}
    {!shown.length&&<p className="rv-empty">조건에 맞는 학생이 없습니다.</p>}</div>
   {pages>1&&<div className="review-pagination"><button type="button" disabled={current===1} onClick={()=>setPage(current-1)}>이전</button><span>{current} / {pages}</span><button type="button" disabled={current===pages} onClick={()=>setPage(current+1)}>다음</button></div>}
   <p className="gs-note">{SUBJECTS.map(s=>[s,scopes.filter(x=>x.subject===s).length] as const).filter(([,n])=>n).map(([s,n])=>`${s} ${n}명`).join(' · ')||'담당 학생이 없습니다.'}</p>
  </section>
  {transferState==='failed'&&<section className="gs-sec"><h3>담당 변경 기록</h3><p className="gs-note tt-failed" role="status">담당 변경 기록을 불러오지 못했어요. <button type="button" className="gs-link" onClick={onRetryTransfers}>다시 시도</button></p></section>}
  {transfers&&(()=>{const mine=transfers.filter(r=>r.fromUids.includes(teacher.uid)||r.toUids.includes(teacher.uid));const who=(uids:string[])=>uids.length?uids.map(teacherName).join(', '):'담당 없음';const movePages=Math.max(1,Math.ceil(mine.length/STUDENTS_PER_PAGE)),moveCurrent=Math.min(movePage,movePages);return <section className="gs-sec"><h3>담당 변경 기록{mine.length>0&&<small className="gs-opt"> {mine.length}건</small>}</h3>{mine.length?<ul className="tt-list">{mine.slice((moveCurrent-1)*STUDENTS_PER_PAGE,moveCurrent*STUDENTS_PER_PAGE).map(r=><li key={r.id}><span className="tt-day">{seoulDay(r.at).slice(5).replace('-','/')}</span><span className="tt-what">{studentName(r.studentKey)} · {r.subject} · {isCoTeacherDrop(r)?<><s className="tt-dropped">{who(r.fromUids)}</s> + {who(r.afterUids!)}</>:<>{who(r.fromUids)} → {transferTarget(r,who)}</>}</span><span className={`tt-why${r.reason===COMPLAINT?' is-asked':''}`}>{r.reason}{r.note?` · ${r.note}`:''}</span></li>)}</ul>:<p className="gs-note">아직 담당 변경 기록이 없습니다.</p>}{movePages>1&&<div className="review-pagination"><button type="button" disabled={moveCurrent===1} onClick={()=>setMovePage(moveCurrent-1)}>이전</button><span>{moveCurrent} / {movePages}</span><button type="button" disabled={moveCurrent===movePages} onClick={()=>setMovePage(moveCurrent+1)}>다음</button></div>}</section>;})()}
  <div className="gs-foot">{canAccess&&<button type="button" className="gs-quiet" disabled={busy} onClick={async()=>{if(await askConfirm(teacher.disabled?{title:'이 선생님을 다시 연결할까요?',message:'보관된 담당이 그대로 돌아옵니다.',confirmText:'다시 연결',icon:'link'}:{title:'이 선생님의 선생님방 연결을 해제할까요?',message:'담당과 작성한 자료는 보관됩니다.',confirmText:'연결 해제',tone:'danger',icon:'unlink'}))void onAccess(!teacher.disabled);}}><UserCog size={14} aria-hidden="true"/> {teacher.disabled?'다시 연결':'연결 해제'}</button>}<span className="gs-grow"/><button type="button" className="small-button" disabled={busy} onClick={onClose}>닫기</button><button type="button" className="primary-button" disabled={busy||!changed||teacher.disabled||Boolean(offlineProblem)} onClick={()=>void save()}>저장</button></div>
 </section></WorkspaceDialog>;
}
