import {useState} from 'react';
import {CalendarX2} from 'lucide-react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
import {plannedStops} from '../../lib/studentOverview';
import {askConfirm} from './ConfirmDialog';

const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
const failure=(r:any)=>`${r.data?.message||r.userMessage||'처리하지 못했습니다. 수강·담당·반 관리에서 확인해 주세요.'}${r.data?.diagnosticId?` (오류 ID: ${r.data.diagnosticId})`:''}`;

/** 중단 예약 reminders (admin/principal): once the planned date comes, ask whether to stop the subject. 예 stops it on
 *  the planned date with the same rules as a manual stop; 아니오 removes the reservation. Nothing stops by itself. */
export default function StopReminders({students,today,onChanged}:{students:any[];today:string;onChanged:()=>Promise<void>|void}){
 const {due,upcoming}=plannedStops(students,today);
 const [busy,setBusy]=useState(''),[message,setMessage]=useState('');
 async function resolve(item:{studentKey:string;name:string;subject:string;plannedEndDate:string},stop:boolean){
  const id=item.studentKey+':'+item.subject;if(busy)return;setBusy(id);setMessage('');
  try{
   const read=await teacherAuthenticatedRequest<any>(auth,'/api/teacher/workspace?'+new URLSearchParams({action:'student-enrollment',studentKey:item.studentKey}));
   if(!read.ok||!read.data?.ok)throw Error(failure(read));
   const record=read.data.record,row=record.subjects.find((s:any)=>s.subject===item.subject);
   if(!row||row.status!=='등록'||row.plannedEndDate!==item.plannedEndDate){setMessage('그 사이 수강 정보가 바뀌었어요. 목록을 새로 불러왔어요.');await onChanged();return;}
   const sole=(row.classes||[]).filter((c:any)=>c.withdrawalReview).map((c:any)=>c.name);
   const question=stop?`${item.name} 학생의 ${item.subject} 수강을 ${md(item.plannedEndDate)}부로 중단할까요?${sole.length?`\n\n${sole.join(', ')}의 유일한 학생입니다. 반은 진행 중으로 남고, 필요하면 반 관리에서 상태를 바꿔 주세요.`:''}`:`${item.name} 학생의 ${item.subject} 중단 예약을 지우고 계속 다니는 것으로 둘까요?`;
   if(!await askConfirm(stop?{title:'수강을 중단할까요?',message:question,confirmText:'중단',tone:'danger',icon:'alert'}:{title:'계속 다니는 것으로 둘까요?',message:question,confirmText:'계속 다님',icon:'check'}))return;
   const data={subject:item.subject,status:stop?'중단':'등록',startDate:row.startDate,endDate:stop?item.plannedEndDate:null,addTeacherUid:null,removeTeacherIds:[],classIds:(row.classes||[]).map((c:any)=>c.id),plannedEndDate:null};
   const saved=await teacherAuthenticatedRequest<any>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-student-enrollment',studentKey:item.studentKey,operationId:crypto.randomUUID(),studentEditedAt:record.studentEditedAt,enrollmentEditedAt:record.enrollmentEditedAt,data})});
   if(!saved.ok||!saved.data?.ok)throw Error(failure(saved));
   setMessage(stop?`${item.name} 학생의 ${item.subject} 수강을 중단했어요.`:`${item.name} 학생의 ${item.subject} 중단 예약을 지웠어요.`);await onChanged();
  }catch(e){setMessage(e instanceof Error?e.message:'처리하지 못했습니다.');}
  finally{setBusy('');}
 }
 if(!due.length&&!upcoming.length&&!message)return null;
 return <section className="stop-reminders" aria-label="중단 예약">
  {due.length>0&&<div className="stop-due"><h3><CalendarX2 size={16} aria-hidden="true"/>중단 예정일이 된 학생 <b>{due.length}</b></h3>
   <ul>{due.map(item=>{const id=item.studentKey+':'+item.subject;return <li key={id}><span className="stop-who"><strong>{item.name}</strong><small>{item.subject} · {md(item.plannedEndDate)} 중단 예정</small></span><span className="stop-ask">중단할까요?</span>
    <span className="stop-actions"><button type="button" className="primary-button" disabled={Boolean(busy)} onClick={()=>void resolve(item,true)}>{busy===id?'처리 중…':'예, 중단'}</button><button type="button" className="small-button" disabled={Boolean(busy)} onClick={()=>void resolve(item,false)}>아니오, 계속 다님</button></span></li>;})}</ul></div>}
  {upcoming.length>0&&<div className="stop-upcoming"><span className="stop-upcoming-title">30일 안에 중단 예정</span>{upcoming.map(item=><span key={item.studentKey+':'+item.subject} className="stop-chip">{item.name} · {item.subject} <b>{md(item.plannedEndDate)}</b></span>)}</div>}
  {message&&<p role="status" className="stop-message">{message}</p>}
 </section>;
}
