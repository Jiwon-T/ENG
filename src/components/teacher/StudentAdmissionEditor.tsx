import {useEffect,useRef,useState} from 'react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
import {emptyAdmission,type AdmissionInput} from '../../lib/studentAdmission';
import WorkspaceDialog from './WorkspaceDialog';
import StudentAdmissionFields from './StudentAdmissionFields';
import EnrollmentDates from './EnrollmentDates';
import OptionalMark from './OptionalMark';

type Value={admission:AdmissionInput;guardianName:string;guardianSalutation:string};
const failure=(r:any)=>r.data?.error==='NOTION_EDIT_CONFLICT'?'다른 곳에서 학생 정보가 바뀌었습니다. 최신 내용을 불러왔으니 다시 확인해 주세요.':`${r.data?.message||r.userMessage||'저장하지 못했습니다.'}${r.data?.diagnosticId?` (오류 ID: ${r.data.diagnosticId})`:''}`;

/** 입학·상담 정보 (admin/principal): the answers given at registration, viewable and editable afterwards. */
export default function StudentAdmissionEditor({studentKey,onClose}:{studentKey:string;onClose:()=>void}){
 const [value,setValue]=useState<Value|null>(null),[editedAt,setEditedAt]=useState(''),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);
 const operation=useRef<string|null>(null),version=useRef(0);
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
   if(!r.ok||!r.data?.ok){setMessage(failure(r));if(r.data?.error==='NOTION_EDIT_CONFLICT'){const record=await load();if(current!==version.current)return;setValue({...record.data,admission:{...emptyAdmission(),...record.data.admission}});setEditedAt(record.editedAt);setDirty(false);operation.current=null;}return;}
   setEditedAt(r.data.editedAt);setDirty(false);operation.current=null;setMessage('입학·상담 정보를 저장했습니다.');
  }catch(e){if(current===version.current)setMessage(e instanceof Error?e.message:'저장 결과를 확인하지 못했습니다. 다시 저장하면 같은 요청으로 확인합니다.');}
  finally{if(current===version.current)setBusy(false);}
 }
 function close(){if(dirty&&!window.confirm('저장하지 않은 입학·상담 정보 변경을 닫을까요?'))return;onClose();}
 return <WorkspaceDialog open title="입학·상담 정보" onClose={close}>
  <div className="admission-application adm-edit">
   <EnrollmentDates studentKey={studentKey}/>
   {loading&&<p role="status" className="text-sm">입학·상담 정보를 불러오는 중…</p>}
   {value&&<fieldset disabled={busy} className="adm-edit-form">
    <section className="admission-section"><h3>보호자</h3><div className="adm-grid">
     <label>보호자 이름<OptionalMark/><input maxLength={80} value={value.guardianName} onChange={e=>change({...value,guardianName:e.target.value})}/></label>
     <label>보호자 호칭<OptionalMark/><input maxLength={80} placeholder="예: 어머님" value={value.guardianSalutation} onChange={e=>change({...value,guardianSalutation:e.target.value})}/></label>
    </div></section>
    <section className="admission-section"><h3>입학 정보</h3><div className="adm-grid"><StudentAdmissionFields section="basic" value={value.admission} onChange={admission=>change({...value,admission})}/></div></section>
    <StudentAdmissionFields section="learning" value={value.admission} onChange={admission=>change({...value,admission})}/>
    <StudentAdmissionFields section="consent" value={value.admission} onChange={admission=>change({...value,admission})}/>
   </fieldset>}
   {message&&<p role="status" className={message.endsWith('저장했습니다.')?'text-sm text-emerald-700':'text-sm text-rose-600'}>{message}</p>}
   {value&&<div className="adm-foot"><button type="button" className="primary-button" disabled={busy||!dirty} onClick={()=>void save()}>{busy?'저장 중…':'입학·상담 정보 저장'}</button>{dirty&&<span className="text-xs text-slate-500">저장하지 않은 변경이 있어요</span>}</div>}
  </div>
 </WorkspaceDialog>;
}
