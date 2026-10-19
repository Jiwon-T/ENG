import {useMemo,useState} from 'react';
import {FileSpreadsheet} from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
import {planImport,type SheetCells} from '../../lib/timetableImport';
import {sheetClock} from '../../lib/timetableSheet';

const DAY_NAMES=['일','월','화','수','목','금','토'];
const STATUS={same:['그대로','tt-pill-same'],changed:['바뀜','tt-pill-change'],new:['새 반','tt-pill-new']} as const;
const range=(start:string,end:string)=>`${sheetClock(start)}~${sheetClock(end)}`;

/**
 * 엑셀 가져오기 › 미리보기: what the sheet would change in my classes, in one screen. Names the app can't place are asked
 * first (a student, or 빼고 저장); new classes can be renamed. Nothing is saved until 저장; classes not on the sheet stay.
 * A name not in the app at all: 원장님·관리자 get '새 학생 등록' (상담·신입생 등록 with the name filled in; import again after),
 * other teachers a note to ask the 원장님.
 */
export default function TimetableImport({fileName,cells,data,request,onSaved,onRegister,onClose}:{fileName:string;cells:SheetCells[];data:any;request:(action:string,body?:any)=>Promise<any>;onSaved:()=>Promise<void>|void;onRegister?:(name:string)=>void;onClose:()=>void}){
 // Names to confirm, from a first read; each starts as 빼고 저장 until a student is picked.
 const asks=useMemo(()=>planImport(cells,data).unknown,[cells,data]);
 const [choices,setChoices]=useState<Record<string,string>>(()=>Object.fromEntries(asks.map(a=>[a.raw,''])));
 const [names,setNames]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const plan=useMemo(()=>planImport(cells,data,choices,names),[cells,data,choices,names]);
 const label=(key:string)=>(data.students||[]).find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생';
 const short=(key:string)=>label(key).replace(/\s*\(.*\)\s*$/,'');
 const toSave=plan.classes.filter(c=>c.data);
 const count=(status:string)=>plan.classes.filter(c=>c.status===status).length;
 const save=async()=>{
  if(busy||!toSave.length)return;setBusy(true);setMessage('');
  let saved=0;const failed:string[]=[];
  for(const c of toSave){try{await request('save-class',{...(c.classId?{id:c.classId}:{}),revision:c.revision,notionEditedAt:c.notionEditedAt,data:c.data});saved++;}catch(e:any){failed.push(`${c.name}: ${e?.message||'저장하지 못했어요'}`);}}
  await onSaved();setBusy(false);
  if(!failed.length){onClose();return;}
  setMessage(`${saved}개 반은 저장했어요. 저장하지 못한 반: ${failed.join(' · ')}`);
 };
 return <WorkspaceDialog open title="시간표 엑셀 가져오기" onClose={onClose}>
  <div className="tt-import">
   <div className="tt-import-head"><FileSpreadsheet size={20} aria-hidden="true"/><div><b>{fileName}</b><p>수업 {plan.counts.lessons}줄 · 자습 {plan.counts.study}명 · 테스트 {plan.counts.tests}줄을 읽었어요{plan.skipped?` · 이름 없는 수업 ${plan.skipped}줄은 건너뛰어요`:''}</p></div>
    <span className="tt-import-pills">{count('same')>0&&<span className="tt-pill tt-pill-same">그대로 {count('same')}</span>}{count('changed')>0&&<span className="tt-pill tt-pill-change">바뀜 {count('changed')}</span>}{count('new')>0&&<span className="tt-pill tt-pill-new">새 반 {count('new')}</span>}{asks.length>0&&<span className="tt-pill tt-pill-ask">확인 {asks.length}</span>}</span></div>
   {asks.length>0&&<div className="tt-import-asks"><p>앱에서 찾지 못한 이름이에요. 같은 학생을 고르거나 빼고 저장해요.</p>
    {asks.map(a=><label key={a.raw}><b>{a.raw}</b><select value={choices[a.raw]??''} onChange={e=>setChoices(c=>({...c,[a.raw]:e.target.value}))}><option value="">빼고 저장</option>{(a.options.length?a.options:(data.students||[]).map((s:any)=>s.studentKey)).map((key:string)=><option key={key} value={key}>{label(key)}</option>)}</select>{!a.options.some(key=>short(key)===a.raw)&&(onRegister?<button type="button" className="small-button" onClick={()=>onRegister(a.raw)}>새 학생 등록</button>:<small>없는 학생이면 원장님께 등록을 요청해 주세요</small>)}</label>)}
    {onRegister&&asks.some(a=>!a.options.some(key=>short(key)===a.raw))&&<small className="tt-import-asks-note">새 학생을 등록한 뒤 다시 가져오면 맞춰져요.</small>}</div>}
   <div className="tt-import-list">{plan.classes.map((c,i)=><div key={c.classId||`new:${i}`} className="tt-import-class">
    <div className="tt-import-class-head"><span className={`tt-pill ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>
     {c.status==='new'?<input aria-label="새 반 이름" maxLength={200} value={names[`new:${i}`]??c.name} onChange={e=>setNames(n=>({...n,[`new:${i}`]:e.target.value}))}/>:<b>{c.name}</b>}
     {c.status==='changed'&&<span className="tt-import-changes">{c.changes.join(' · ')}</span>}</div>
    {c.lines.map((l,k)=><div key={k} className="tt-import-line"><span className="tt-import-day">{DAY_NAMES[l.weekday]}</span><div>
     <span><b>{range(l.start,l.end)}</b>{l.grade?` (${l.grade})`:''} · {l.names.map(n=>n.key?short(n.key):null).filter(Boolean).join(', ')||'학생 없음'}</span>
     {(l.study.length>0||l.tests.length>0)&&<small>{[...l.study.map(b=>`자습 ${range(b.start,b.end)} ${b.names.map(short).join(', ')}`),...l.tests.map(t=>`테스트(${DAY_NAMES[t.weekday]}) ${range(t.start,t.end)} ${t.names.map(short).join(', ')}`)].join(' · ')}</small>}
    </div></div>)}
   </div>)}{!plan.classes.length&&<p className="tt-import-empty">반으로 만들 수업을 찾지 못했어요. 학생 이름이 있는 수업 칸이 있는지 확인해 주세요.</p>}</div>
   {message&&<p className="tt-import-error" role="alert">{message}</p>}
   <div className="tt-import-foot"><span>내 반만 바뀌어요 · 저장 전까지 아무것도 바뀌지 않아요 · 빠진 반은 그대로 둬요</span><button type="button" className="small-button" disabled={busy} onClick={onClose}>취소</button><button type="button" className="primary-button" disabled={busy||!toSave.length} onClick={()=>void save()}>{busy?'저장 중…':toSave.length?`${toSave.length}개 반 저장`:'바뀐 반 없음'}</button></div>
  </div>
 </WorkspaceDialog>;
}
