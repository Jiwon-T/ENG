import {useMemo,useRef,useState,type ReactNode} from 'react';
import {Calculator,Gauge,History,MessageSquareText,UserCog,Users,Wallet,type LucideIcon} from 'lucide-react';
import TeacherManager from './TeacherManager';
import TuitionCalculator from './TuitionCalculator';
import TeacherPayroll from './TeacherPayroll';
import AdminHistoryPanel from './AdminHistoryPanel';
import AppUserManager from './AppUserManager';
import AppTemplateManager from './AppTemplateManager';
import SpeedCheckPanel from './SpeedCheckPanel';
import {createUnsavedGuard} from '../../lib/unsavedGuard';
import {askDiscard} from './ConfirmDialog';

type Props={data:any;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;busy:boolean;refresh:()=>Promise<any>};
type Section={id:string;label:string;hint:string;icon:LucideIcon;alert?:boolean;adminOnly?:boolean};
const STORE='workspace.adminSection',UNSAVED='저장하지 않은 변경이 있습니다. 버리고 다른 메뉴로 이동할까요?';
const remembered=()=>{try{return localStorage.getItem(STORE)||'';}catch{return '';}};
const remember=(id:string)=>{try{localStorage.setItem(STORE,id);}catch{/* private mode: keep the default next time */}};

/** 관리자 설정 (admin and principal): one menu, one open tool. Choosing a menu shows that tool already loaded;
 *  tools with edits ask before the menu switches away. The last menu is remembered on this device. */
export default function AdminDashboard({data,request,act,busy,refresh}:Props){
 const main=data.academyId==='main';
 const summary=useMemo(()=>{
  const staff:any[]=data.staff||[],access:any[]=data.access||[],students:any[]=data.students||[];
  const teachers=staff.map(s=>{const p=access.find(a=>a.uid===s.uid);return {disabled:Boolean(p?.disabled),scopes:(p?.scopes||[]) as any[]};});
  const active=teachers.filter(t=>!t.disabled),assigned=new Set(active.flatMap(t=>t.scopes.map(s=>s.studentKey)));
  return {active:active.length,unsetTeachers:active.filter(t=>!t.scopes.length).length,unassignedStudents:students.filter(s=>!assigned.has(s.studentKey)).length};
 },[data.staff,data.access,data.students]);
 const sections:Section[]=[
  {id:'teachers',label:'선생님',icon:Users,hint:`재직 ${summary.active}명${summary.unsetTeachers?` · 담당 미설정 ${summary.unsetTeachers}`:''}`,alert:summary.unsetTeachers>0||summary.unassignedStudents>0},
  ...(main?[
   {id:'tuition',label:'수강료 계산',icon:Calculator,hint:'이번 달 학생별 수강료'},
   {id:'payroll',label:'선생님 정산',icon:Wallet,hint:'이번 달 정산·비율'},
   {id:'users',label:'앱 사용자',icon:UserCog,hint:'선생님 권한·이름·탈퇴',adminOnly:true},
   {id:'templates',label:'문자 템플릿',icon:MessageSquareText,hint:'보호자 문자 문구',adminOnly:true},
   {id:'history',label:'관리 기록',icon:History,hint:'누가 언제 무엇을 바꿨는지'},
  ]:[]),
  {id:'check',label:'점검',icon:Gauge,hint:'요청 속도 확인'},
 ].filter((s:Section)=>!s.adminOnly||data.admin);
 const [active,setActive]=useState(()=>{const id=remembered();return sections.some(s=>s.id===id)?id:'teachers';});
 const current=sections.find(s=>s.id===active)||sections[0];
 const guardRef=useRef<ReturnType<typeof createUnsavedGuard>|null>(null);
 if(!guardRef.current)guardRef.current=createUnsavedGuard(message=>askDiscard(message,{discardText:'버리고 이동'}),UNSAVED);
 const guard=guardRef.current;
 const markDirty=(dirty:boolean)=>guard.mark(dirty);
 function choose(id:string){if(id===current.id)return;guard.proceed(()=>{setActive(id);remember(id);});}
 const tool:Record<string,ReactNode>={
  teachers:<TeacherManager data={data} request={request} act={act} busy={busy} refresh={refresh}/>,
  tuition:<TuitionCalculator busy={busy} request={request} act={act} autoLoad onDirty={markDirty}/>,
  payroll:<TeacherPayroll busy={busy} request={request} act={act} autoLoad onDirty={markDirty}/>,
  users:<AppUserManager busy={busy} request={request} act={act} refresh={refresh} autoLoad/>,
  templates:<AppTemplateManager busy={busy} request={request} act={act} autoLoad onDirty={markDirty}/>,
  history:<AdminHistoryPanel busy={busy} request={request} act={act} autoLoad/>,
  check:<section className="panel rv"><SpeedCheckPanel/></section>,
 };
 return <div className="admin-dash">
  <nav className="admin-dash-nav" aria-label="관리자 설정 메뉴">
   <p className="admin-dash-title">관리자 설정</p>
   <ul>{sections.map(s=>{const Icon=s.icon,on=s.id===current.id;return <li key={s.id}>
    <button type="button" className={'admin-dash-item'+(on?' is-active':'')} aria-current={on?'page':undefined} disabled={busy&&!on} onClick={()=>choose(s.id)}>
     <span className="admin-dash-icon" aria-hidden="true"><Icon size={18}/></span>
     <span className="admin-dash-text"><strong>{s.label}{s.alert&&<i className="admin-dash-dot" aria-label="확인 필요"/>}</strong><small>{s.hint}</small></span>
    </button></li>;})}</ul>
  </nav>
  <div className="admin-dash-body" key={current.id}>{tool[current.id]}</div>
 </div>;
}
