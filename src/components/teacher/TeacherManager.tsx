import {Fragment,useMemo,useState} from 'react';
import {Search,UserCog,Users,AlertCircle} from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
import StatusBadge from './StatusBadge';
import {studentSearchResults} from '../../lib/koreanSearch';
const SUBJECTS=['영어','수학','국어','과학','한국사'];
type Scope={studentKey:string;subject:string};
/** App-only teacher management: who teaches which student and subject, role, and access. */
export default function TeacherManager({data,request,act,busy,refresh}:{data:any;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;busy:boolean;refresh:()=>Promise<any>}){
 const [editing,setEditing]=useState<any>(null),[showUnassigned,setShowUnassigned]=useState(false),[notice,setNotice]=useState('');
 const students:any[]=data.students||[],staff:any[]=data.staff||[],access:any[]=data.access||[];
 const nameOf=(key:string)=>students.find(s=>s.studentKey===key)?.studentDisplayName||'학생';
 const profileOf=(uid:string)=>access.find(a=>a.uid===uid)||null;
 const teachers=staff.map(s=>{const p=profileOf(s.uid);return {...s,profile:p,label:p?.workspaceLabel||s.name,scopes:(p?.scopes||[]) as Scope[],disabled:Boolean(p?.disabled),role:p?.workspaceRole||'teacher'};});
 const assigned=new Set(teachers.filter(t=>!t.disabled).flatMap(t=>t.scopes.map(s=>s.studentKey)));
 const unassigned=students.filter(s=>!assigned.has(s.studentKey));
 return <section className="panel rv">
  <div className="rv-head"><h2>선생님 관리<small>{teachers.length}명</small></h2></div>
  <p className="gs-note">선생님을 누르면 담당 학생·과목, 직책, 사용 여부를 바로 바꿀 수 있습니다. 저장하면 앱에만 저장됩니다.</p>
  <div className="rv-stats">
   <div className="rv-stat"><b>{teachers.filter(t=>!t.disabled).length}</b><span>사용 중인 선생님</span></div>
   <div className="rv-stat"><b>{teachers.filter(t=>!t.disabled&&!t.scopes.length).length}</b><span>담당 미설정</span></div>
   <div className="rv-stat"><b>{assigned.size}</b><span>담당이 있는 학생</span></div>
   <button type="button" className="rv-stat warn" aria-pressed={showUnassigned} onClick={()=>setShowUnassigned(v=>!v)}><b>{unassigned.length}</b><span>담당 선생님 없는 학생</span></button>
  </div>
  {showUnassigned&&<div className="rv-muted">{unassigned.length?<>담당 선생님이 없는 학생: {unassigned.map(s=>s.studentDisplayName).join(', ')}</>:'모든 학생에게 담당 선생님이 있습니다.'}</div>}
  <div className="rv-cards">{teachers.map(t=>{const bySubject=SUBJECTS.map(subject=>[subject,t.scopes.filter(s=>s.subject===subject).length] as const).filter(([,n])=>n>0);const names=[...new Set(t.scopes.map(s=>s.studentKey))];
   return <button key={t.uid} type="button" className="rv-card" disabled={busy} onClick={()=>{setNotice('');setEditing(t);}} aria-label={`${t.label} 선생님 관리`}>
    <span className="rv-card-top"><strong className="rv-who">{t.label}</strong><span className="rv-grade">{t.role==='principal'?'원장':'선생님'}</span></span>
    <span className="rv-sub">{bySubject.length?bySubject.map(([s,n])=>`${s} ${n}명`).join(' · '):'담당 학생 없음'}</span>
    {names.length>0&&<span className="rv-sub" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{names.slice(0,6).map(nameOf).join(', ')}{names.length>6?` 외 ${names.length-6}명`:''}</span>}
    <StatusBadge kind={t.disabled?'failed':t.scopes.length?'done':'unwritten'} text={t.disabled?'사용 중지':t.scopes.length?'사용 중':'담당 미설정'}/>
   </button>;})}</div>
  {notice&&<p role="status" className="gs-note">{notice}</p>}
  {editing&&<Fragment key={editing.uid}><TeacherEditor teacher={editing} data={data} busy={busy} onClose={()=>setEditing(null)}
   onSave={async value=>act(async()=>{await request('grant',value);setEditing(null);await refresh();setNotice(`${value.workspaceLabel||editing.name} 선생님의 담당을 저장했습니다.`);})}
   onAccess={async disabled=>act(async()=>{await request('teacher-access',{uid:editing.uid,disabled});setEditing(null);await refresh();setNotice(`${editing.label} 선생님을 ${disabled?'사용 중지':'다시 사용'}로 바꿨습니다.`);})}/></Fragment>}
 </section>;
}
function TeacherEditor({teacher,data,busy,onClose,onSave,onAccess}:{teacher:any;data:any;busy:boolean;onClose:()=>void;onSave:(v:any)=>Promise<void>;onAccess:(disabled:boolean)=>Promise<void>}){
 const students:any[]=data.students||[];
 const [label,setLabel]=useState(teacher.profile?.workspaceLabel||''),[role,setRole]=useState(teacher.role),[scopes,setScopes]=useState<Scope[]>(teacher.scopes);
 const [subject,setSubject]=useState(()=>SUBJECTS.find(s=>teacher.scopes.some((x:Scope)=>x.subject===s))||'영어'),[query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'mine'|'none'>('all');
 const others=useMemo(()=>new Set((data.access||[]).filter((a:any)=>a.uid!==teacher.uid&&!a.disabled).flatMap((a:any)=>(a.scopes||[]).filter((s:Scope)=>s.subject===subject).map((s:Scope)=>s.studentKey))),[data.access,teacher.uid,subject]);
 const has=(key:string,sub=subject)=>scopes.some(s=>s.studentKey===key&&s.subject===sub);
 const toggle=(key:string,on:boolean)=>setScopes(old=>on?(old.some(s=>s.studentKey===key&&s.subject===subject)?old:[...old,{studentKey:key,subject}]):old.filter(s=>!(s.studentKey===key&&s.subject===subject)));
 const shown=studentSearchResults(students,query).filter((s:any)=>filter==='all'||filter==='mine'&&has(s.studentKey)||filter==='none'&&!has(s.studentKey)&&!others.has(s.studentKey));
 const changed=JSON.stringify([...scopes].sort((a,b)=>(a.studentKey+a.subject).localeCompare(b.studentKey+b.subject)))!==JSON.stringify([...teacher.scopes].sort((a:Scope,b:Scope)=>(a.studentKey+a.subject).localeCompare(b.studentKey+b.subject)))||label!==(teacher.profile?.workspaceLabel||'')||role!==teacher.role;
 const canAccess=data.admin&&teacher.profile&&teacher.uid!==data.uid;
 const save=()=>onSave({uid:teacher.uid,scopes,notionTeacherPageId:teacher.profile?.notionTeacherPageId||null,workspaceLabel:label.trim(),workspaceRole:role,academyId:data.academyId||'main',assignmentRevision:teacher.profile?.assignmentRevision||0,academyStudents:[...new Set(scopes.map(s=>s.studentKey))]});
 return <WorkspaceDialog open title={`${teacher.label} 선생님`} onClose={()=>{if(busy)return;if(changed&&!window.confirm('저장하지 않은 변경을 닫을까요?'))return;onClose();}}><section className="gs">
  {teacher.disabled&&<p className="rv-missing"><AlertCircle size={16} aria-hidden="true"/>사용 중지된 선생님입니다. 담당은 보관되어 있으며 다시 사용하면 그대로 돌아옵니다.</p>}
  <section className="gs-sec"><h3><span className="gs-num">1</span>기본 정보</h3>
   <label><span className="gs-lbl">화면에 보일 이름 <span className="gs-opt">(비우면 계정 이름 “{teacher.name}”)</span></span><input value={label} maxLength={100} disabled={busy} onChange={e=>setLabel(e.target.value)} placeholder={teacher.name}/></label>
   <div className="gs-seg" role="group" aria-label="직책">{([['teacher','선생님'],['principal','원장 선생님']] as const).map(([k,l])=><button key={k} type="button" aria-pressed={role===k} disabled={busy||!data.admin} onClick={()=>setRole(k)}>{l}</button>)}</div>
   {!data.admin&&<p className="gs-note">직책은 관리자만 바꿀 수 있습니다.</p>}
  </section>
  <section className="gs-sec"><h3><span className="gs-num">2</span>담당 학생</h3>
   <div className="gs-chips" role="group" aria-label="과목">{SUBJECTS.map(s=>{const n=scopes.filter(x=>x.subject===s).length;return <button key={s} type="button" className="rv-chip" aria-pressed={subject===s} onClick={()=>setSubject(s)}>{s}{n?` ${n}`:''}</button>;})}</div>
   <div className="gs-add"><label className="rv-search" style={{display:'flex',alignItems:'center',gap:6,border:'1px solid #e2e8f0',borderRadius:12,padding:'0 12px',minHeight:44}}><Search size={16} aria-hidden="true" color="#94a3b8"/><input aria-label="학생 검색" value={query} onChange={e=>setQuery(e.target.value)} placeholder="학생 이름·초성 검색" style={{border:0,margin:0,minHeight:'auto',padding:0,boxShadow:'none',flex:1}}/></label>
    <div className="rv-seg" role="group" aria-label="보기">{([['all','전체'],['mine','담당 중'],['none','미배정']] as const).map(([k,l])=><button key={k} type="button" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l}</button>)}</div></div>
   <div className="gs-chips"><button type="button" className="gs-link" disabled={busy||!shown.length} onClick={()=>setScopes(old=>[...old,...shown.filter((s:any)=>!has(s.studentKey)).map((s:any)=>({studentKey:s.studentKey,subject}))])}><Users size={14} aria-hidden="true"/>보이는 학생 모두 {subject} 담당</button><button type="button" className="gs-link" disabled={busy||!shown.some((s:any)=>has(s.studentKey))} onClick={()=>{const keys=new Set(shown.map((s:any)=>s.studentKey));setScopes(old=>old.filter(s=>!(s.subject===subject&&keys.has(s.studentKey))));}}>보이는 학생 담당 해제</button></div>
   <div className="gs-rows" style={{maxHeight:'min(46vh,420px)',overflow:'auto'}}>{shown.map((s:any)=>{const on=has(s.studentKey),otherSubjects=SUBJECTS.filter(x=>x!==subject&&has(s.studentKey,x));return <label key={s.studentKey} className="gs-row" style={{gridTemplateColumns:'auto minmax(0,1fr) auto',cursor:'pointer',...(on?{borderColor:'var(--workspace-brand-dot)',background:'var(--workspace-brand-bg)'}:{})}}>
    <input type="checkbox" checked={on} disabled={busy} onChange={e=>toggle(s.studentKey,e.target.checked)} aria-label={`${s.studentDisplayName} ${subject} 담당`} style={{width:20,height:20,minHeight:'auto',margin:0}}/>
    <span className="gs-row-who"><strong>{s.studentDisplayName}</strong>{otherSubjects.map(x=><span key={x} className="rv-pill">{x}</span>)}</span>
    <span className="rv-sub">{others.has(s.studentKey)?'다른 선생님도 담당':''}</span></label>;})}
    {!shown.length&&<p className="rv-empty">조건에 맞는 학생이 없습니다.</p>}</div>
   <p className="gs-note">{SUBJECTS.map(s=>[s,scopes.filter(x=>x.subject===s).length] as const).filter(([,n])=>n).map(([s,n])=>`${s} ${n}명`).join(' · ')||'담당 학생이 없습니다.'}</p>
  </section>
  <div className="gs-foot">{canAccess&&<button type="button" className="gs-quiet" disabled={busy} onClick={()=>{if(window.confirm(teacher.disabled?'이 선생님을 다시 사용하게 할까요? 보관된 담당이 그대로 돌아옵니다.':'이 선생님의 선생님방 사용을 중지할까요? 담당과 작성한 자료는 보관됩니다.'))void onAccess(!teacher.disabled);}}><UserCog size={14} aria-hidden="true"/> {teacher.disabled?'다시 사용':'사용 중지'}</button>}<span className="gs-grow"/><button type="button" className="small-button" disabled={busy} onClick={onClose}>닫기</button><button type="button" className="primary-button" disabled={busy||!changed||teacher.disabled} onClick={()=>void save()}>저장</button></div>
 </section></WorkspaceDialog>;
}
