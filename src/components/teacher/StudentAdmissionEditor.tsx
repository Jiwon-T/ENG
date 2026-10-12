import {useEffect,useRef,useState} from 'react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
import {emptyAdmission,type AdmissionInput} from '../../lib/studentAdmission';
import WorkspaceDialog from './WorkspaceDialog';
import StudentAdmissionFields from './StudentAdmissionFields';
import EnrollmentDates from './EnrollmentDates';
import OptionalMark from './OptionalMark';

type Value={admission:AdmissionInput;guardianName:string;guardianSalutation:string};
const failure=(r:any)=>r.data?.error==='NOTION_EDIT_CONFLICT'?'다른 곳에서 먼저 저장했어요. 입력하신 내용은 그대로 두었어요.':`${r.data?.message||r.userMessage||'저장하지 못했습니다.'}${r.data?.diagnosticId?` (오류 ID: ${r.data.diagnosticId})`:''}`;

/** 입학·상담 정보 (admin/principal): the answers given at registration, viewable and editable afterwards.
 *  보호자 이름·호칭 are not asked at counselling, so they have no field; their stored values are sent back unchanged. */
export default function StudentAdmissionEditor({studentKey,onClose}:{studentKey:string;onClose:()=>void}){
 const [value,setValue]=useState<Value|null>(null),[editedAt,setEditedAt]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);
 const operation=useRef<string|null>(null),version=useRef(0);
 // A save refused because someone saved first: the typed values stay; the latest saved version waits until a choice is made.
 const [conflict,setConflict]=useState<{data:Value;editedAt:string}|null>(null);
 async function load(){const r=await teacherAuthenticatedRequest<any>(auth,'/api/teacher/workspace?'+new URLSearchParams({action:'student-admission',studentKey}));
  if(!r.ok||!r.data?.ok||!r.data.record)throw Error(failure(r));return r.data.record;}
 useEffect(()=>{const current=++version.current;setLoading(true);
  load().then(record=>{if(current!==version.current)return;setValue({...record.data,admission:{...emptyAdmission(),...record.data.admission}});setEditedAt(record.editedAt);})
   .catch(e=>{if(current===version.current)setMessage(e.message);}).finally(()=>{if(current===version.current)setLoading(false);});
  return()=>{version.current++;};},[studentKey]);
 const change=(next:Value)=>{setValue(next);setDirty(true);operation.current=null;setMessage('');};
 async function save(){
  if(!value||busy)return;const current=version.current;setBusy(true);setMessage('');
  // The same operation id is reused when a save is retried without further edits (the server answers it once).
  operation.current=operation.current||crypto.randomUUID();
  try{const r=await teacherAuthenticatedRequest<any>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-student-admission',studentKey,operationId:operation.current,expectedEditedAt:editedAt,data:value})});
   if(current!==version.current)return;
   if(!r.ok||!r.data?.ok){setMessage(failure(r));if(r.data?.error==='NOTION_EDIT_CONFLICT'){const record=await load();if(current!==version.current)return;setConflict({data:{...record.data,admission:{...emptyAdmission(),...record.data.admission}},editedAt:record.editedAt});operation.current=null;}return;}
   setEditedAt(r.data.editedAt);setDirty(false);setConflict(null);operation.current=null;setMessage('입학·상담 정보를 저장했습니다.');
  }catch(e){if(current===version.current)setMessage(e instanceof Error?e.message:'저장 결과를 확인하지 못했습니다. 다시 저장하면 같은 요청으로 확인합니다.');}
  finally{if(current===version.current)setBusy(false);}
 }
 function close(){if(dirty&&!window.confirm('저장하지 않은 입학·상담 정보 변경을 닫을까요?'))return;onClose();}
 return <WorkspaceDialog open title="입학·상담 정보" onClose={close}>
  <div className="admission-application adm-edit">
   <EnrollmentDates studentKey={studentKey}/>
   {loading&&<p role="status" className="text-sm">입학·상담 정보를 불러오는 중…</p>}
   {conflict&&<div className="adm-conflict" role="alert"><p><b>다른 곳에서 먼저 저장했어요.</b> 입력하신 내용은 그대로 두었어요. 어떻게 할까요?</p>
    <div><button type="button" className="small-button" disabled={busy} onClick={()=>{setValue(conflict.data);setEditedAt(conflict.editedAt);setConflict(null);setDirty(false);setMessage('최신 내용을 불러왔어요.');}}>최신 내용 불러오기 (내 입력 버림)</button>
    <button type="button" className="primary-button" disabled={busy} onClick={()=>{if(!window.confirm('다른 곳에서 저장한 내용 위에 지금 입력한 내용을 저장할까요? 다른 사람이 바꾼 칸도 지금 화면의 값으로 바뀝니다.'))return;setEditedAt(conflict.editedAt);setConflict(null);setDirty(true);setMessage('최신 버전 위에 저장할 준비가 됐어요. 저장 버튼을 눌러 주세요.');}}>내 입력으로 저장</button></div></div>}
   {value&&<fieldset disabled={busy} className="adm-edit-form">
    <section className="admission-section"><h3>입학 정보</h3><div className="adm-grid"><StudentAdmissionFields section="basic" value={value.admission} onChange={admission=>change({...value,admission})}/></div></section>
    <StudentAdmissionFields section="learning" value={value.admission} onChange={admission=>change({...value,admission})}/>
    <StudentAdmissionFields section="consent" value={value.admission} onChange={admission=>change({...value,admission})}/>
   </fieldset>}
   {message&&<p role="status" className={message.endsWith('저장했습니다.')?'text-sm text-emerald-700':'text-sm text-rose-600'}>{message}</p>}
   {value&&<div className="adm-foot"><button type="button" className="primary-button" disabled={busy||!dirty||Boolean(conflict)} onClick={()=>void save()}>{busy?'저장 중…':'입학·상담 정보 저장'}</button>{dirty&&<span className="text-xs text-slate-500">저장하지 않은 변경이 있어요</span>}</div>}
  </div>
 </WorkspaceDialog>;
}
