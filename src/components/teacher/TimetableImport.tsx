import {useMemo,useState} from 'react';
import {FileSpreadsheet} from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';
import CampusToggle from './CampusToggle';
import {planImport,type NewClassFields,type SheetCells} from '../../lib/timetableImport';
import {sheetClock} from '../../lib/timetableSheet';

const DAY_NAMES=['일','월','화','수','목','금','토'],SUBJECTS=['영어','수학','국어','과학','한국사'];
const STATUS={same:['그대로','tt-pill-same'],changed:['바뀜','tt-pill-change'],new:['새 반','tt-pill-new']} as const;
const range=(start:string,end:string)=>`${sheetClock(start)}~${sheetClock(end)}`;

/**
 * 엑셀 가져오기 › 미리보기: what the sheet would change in my classes, in one screen. Names the app can't place are asked
 * first (a student, or 빼고 저장); a new class gets its name, campus and subject here. A class of mine the sheet has no
 * line for: 중단 is suggested (ticked) when all its students moved to other classes, else it stays unless ticked.
 * Nothing is saved until 저장.
 * A name not in the app at all: 원장님·관리자 get '새 학생 등록' (상담·신입생 등록 with the name filled in; import again after),
 * other teachers a note to ask the 원장님.
 */
export default function TimetableImport({fileName,cells,data,request,onSaved,onRegister,onClose}:{fileName:string;cells:SheetCells[];data:any;request:(action:string,body?:any)=>Promise<any>;onSaved:()=>Promise<void>|void;onRegister?:(name:string)=>void;onClose:()=>void}){
 // Names to confirm, from a first read; each starts as 빼고 저장 until a student is picked.
 const asks=useMemo(()=>planImport(cells,data).unknown,[cells,data]);
 const [choices,setChoices]=useState<Record<string,string>>(()=>Object.fromEntries(asks.map(a=>[a.raw,''])));
 const [fields,setFields]=useState<Record<string,NewClassFields>>({});
 const setField=(key:string,change:NewClassFields)=>setFields(f=>({...f,[key]:{...f[key],...change}}));
 // 중단: ticked from the start for a class whose students all moved
 const [stops,setStops]=useState<Record<string,boolean>>(()=>Object.fromEntries(planImport(cells,data).others.map(o=>[o.classId,o.reason==='moved'])));
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const plan=useMemo(()=>planImport(cells,data,choices,{},fields),[cells,data,choices,fields]);
 const label=(key:string)=>(data.students||[]).find((s:any)=>s.studentKey===key)?.studentDisplayName||'학생';
 const short=(key:string)=>label(key).replace(/\s*\(.*\)\s*$/,'');
 const toSave=plan.classes.filter(c=>c.data),toStop=plan.others.filter(o=>stops[o.classId]);
 const count=(status:string)=>plan.classes.filter(c=>c.status===status).length;
 const save=async()=>{
  if(busy||!toSave.length&&!toStop.length)return;setBusy(true);setMessage('');
  let saved=0;const failed:string[]=[];
  // the new and changed classes first, then the 중단 (so a failed save never leaves students without a class)
  for(const c of [...toSave,...toStop]){try{await request('save-class',{...(c.classId?{id:c.classId}:{}),revision:c.revision,notionEditedAt:c.notionEditedAt,data:c.data});saved++;}catch(e:any){failed.push(`${c.name}: ${e?.message||'저장하지 못했어요'}`);}}
  await onSaved();setBusy(false);
  if(!failed.length){onClose();return;}
  setMessage(`${saved}개 반은 저장했어요. 저장하지 못한 반: ${failed.join(' · ')}`);
 };
 return <WorkspaceDialog open title="시간표 엑셀 가져오기" onClose={onClose}>
  <div className="tt-import">
   <div className="tt-import-head"><FileSpreadsheet size={20} aria-hidden="true"/><div><b>{fileName}</b><p>수업 {plan.counts.lessons}줄 · 자습 {plan.counts.study}명 · 테스트 {plan.counts.tests}줄을 읽었어요{plan.skipped?` · 이름 없는 수업 ${plan.skipped}줄은 건너뛰어요`:''}</p></div>
    <span className="tt-import-pills">{count('same')>0&&<span className="tt-pill tt-pill-same">그대로 {count('same')}</span>}{count('changed')>0&&<span className="tt-pill tt-pill-change">바뀜 {count('changed')}</span>}{count('new')>0&&<span className="tt-pill tt-pill-new">새 반 {count('new')}</span>}{toStop.length>0&&<span className="tt-pill tt-pill-stop">중단 {toStop.length}</span>}{asks.length>0&&<span className="tt-pill tt-pill-ask">확인 {asks.length}</span>}</span></div>
   {asks.length>0&&<div className="tt-import-asks"><p>앱에서 찾지 못한 이름이에요. 같은 학생을 고르거나 빼고 저장해요.</p>
    {asks.map(a=><label key={a.raw}><b>{a.raw}</b><select value={choices[a.raw]??''} onChange={e=>setChoices(c=>({...c,[a.raw]:e.target.value}))}><option value="">빼고 저장</option>{(a.options.length?a.options:(data.students||[]).map((s:any)=>s.studentKey)).map((key:string)=><option key={key} value={key}>{label(key)}</option>)}</select>{!a.options.some(key=>short(key)===a.raw)&&(onRegister?<button type="button" className="small-button" onClick={()=>onRegister(a.raw)}>새 학생 등록</button>:<small>없는 학생이면 원장님께 등록을 요청해 주세요</small>)}</label>)}
    {onRegister&&asks.some(a=>!a.options.some(key=>short(key)===a.raw))&&<small className="tt-import-asks-note">새 학생을 등록한 뒤 다시 가져오면 맞춰져요.</small>}</div>}
   <div className="tt-import-list">{plan.classes.map((c,i)=><div key={c.classId||`new:${i}`} className="tt-import-class">
    <div className="tt-import-class-head"><span className={`tt-pill ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>
     {c.status==='new'&&c.key?<><input aria-label="새 반 이름" maxLength={200} value={fields[c.key]?.name??c.name} onChange={e=>setField(c.key!,{name:e.target.value})}/>
      <CampusToggle value={c.data.campus} onChange={campus=>setField(c.key!,{campus})}/>
      <select aria-label="과목" value={c.data.subject} onChange={e=>setField(c.key!,{subject:e.target.value})}>{SUBJECTS.map(s=><option key={s}>{s}</option>)}</select></>:<b>{c.name}</b>}
     {c.status==='changed'&&<span className="tt-import-changes">{c.changes.join(' · ')}</span>}</div>
    {c.lines.map((l,k)=><div key={k} className="tt-import-line"><span className="tt-import-day">{DAY_NAMES[l.weekday]}</span><div>
     <span><b>{range(l.start,l.end)}</b>{l.grade?` (${l.grade})`:''} · {l.names.map(n=>n.key?short(n.key):null).filter(Boolean).join(', ')||'학생 없음'}</span>
     {(l.study.length>0||l.tests.length>0)&&<small>{[...l.study.map(b=>`자습 ${range(b.start,b.end)} ${b.names.map(short).join(', ')}`),...l.tests.map(t=>`테스트(${DAY_NAMES[t.weekday]}) ${range(t.start,t.end)} ${t.names.map(short).join(', ')}`)].join(' · ')}</small>}
    </div></div>)}
   </div>)}
   {plan.others.map(o=><div key={o.classId} className={`tt-import-class${o.reason==='moved'?' tt-import-moved':''}`}>
    <div className="tt-import-class-head"><span className={`tt-pill ${o.reason==='moved'?'tt-pill-stop':'tt-pill-same'}`}>{o.reason==='moved'?'중단 제안':'시트에 없음'}</span><b>{o.name}</b>
     <span className="tt-import-changes">{[o.students.map(short).join(', '),...o.slots].filter(Boolean).join(' · ')}</span></div>
    {o.reason==='moved'&&<p className="tt-import-moved-note">학생 {o.students.length}명이 모두 다른 반으로 옮겨요: {o.movedTo.join(' · ')}</p>}
    <label className="tt-import-stop"><input type="checkbox" checked={!!stops[o.classId]} onChange={e=>setStops(s=>({...s,[o.classId]:e.target.checked}))}/>이 반 중단하기 <small>{o.reason==='moved'?'(일지·성적은 그대로)':'(안 고르면 그대로 둬요)'}</small></label>
   </div>)}
   {!plan.classes.length&&<p className="tt-import-empty">반으로 만들 수업을 찾지 못했어요. 학생 이름이 있는 수업 칸이 있는지 확인해 주세요.</p>}</div>
   {message&&<p className="tt-import-error" role="alert">{message}</p>}
   <div className="tt-import-foot"><span>내 반만 바뀌어요 · 저장 전까지 아무것도 바뀌지 않아요 · 중단은 고른 반만</span><button type="button" className="small-button" disabled={busy} onClick={onClose}>취소</button><button type="button" className="primary-button" disabled={busy||!toSave.length&&!toStop.length} onClick={()=>void save()}>{busy?'저장 중…':toSave.length||toStop.length?[toSave.length?`${toSave.length}개 반 저장`:'',toStop.length?`${toStop.length}개 반 중단`:''].filter(Boolean).join(' · '):'바뀐 반 없음'}</button></div>
  </div>
 </WorkspaceDialog>;
}
