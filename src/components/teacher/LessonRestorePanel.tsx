import {useState} from 'react';
import StatusBadge from './StatusBadge';
type Props={request:(action:string,body?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>any;busy?:boolean;students?:{studentKey:string;studentDisplayName?:string}[];staff?:{uid:string;name:string}[];onRestored?:()=>any};
/** Deleted lessons (app-only mode). Loads nothing until opened; restore keeps the original public report ID. */
export default function LessonRestorePanel({request,act,busy=false,students=[],staff=[],onRestored}:Props){
 const [state,setState]=useState<any>(null),[message,setMessage]=useState(''),[error,setError]=useState('');
 const names=new Map(students.map(s=>[s.studentKey,s.studentDisplayName||'학생'])),teachers=new Map(staff.map(s=>[s.uid,s.name]));
 async function load(){try{setError('');setState(await request('read:archived-lessons'));}catch(e){setError(e instanceof Error?e.message:'불러오지 못했습니다');}}
 function restore(r:any){
  const who=`${r.data.date} ${names.get(r.data.studentKey)||'학생'} ${r.data.subject}`;
  if(!window.confirm(r.publicRestore?`${who} 일지와 학생·학부모 리포트를 삭제 전 상태로 되돌릴까요?`:`${who} 일지를 비공개 초안으로 되돌릴까요? 리포트에 보이려면 다시 반영해야 합니다.`))return;
  void act(async()=>{const result=await request('restore-lesson',{id:r.id,revision:r.revision,confirmed:true});setMessage(result.publicRestored?`${who} 일지와 리포트를 복원했습니다.`:`${who} 일지를 비공개 초안으로 복원했습니다. 확인 후 반영해 주세요.`);await load();await onRestored?.();});
 }
 return <details className="panel lesson-cutover" onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open&&!state)void load();}}>
  <summary><strong>삭제한 일지 복원</strong></summary>
  {error&&<p role="alert" className="lesson-cutover-warn">{error}</p>}
  {message&&<p role="status" aria-live="polite" className="lesson-cutover-note">{message}</p>}
  {state&&!state.appMode&&<p className="lesson-cutover-muted">일지 앱 전용 전환 후에 사용할 수 있습니다. </p>}
  {state?.appMode&&<>
   <p className="lesson-cutover-muted">삭제 직전 기록으로 되돌립니다. 학생·학부모 리포트가 있던 일지는 같은 리포트 주소와 번호로 다시 보이고, 전환 전에 삭제한 일지는 비공개 초안으로 돌아옵니다.{state.truncated?' 최근 삭제 기준 일부만 표시합니다.':''}</p>
   {state.records.length===0?<p className="lesson-cutover-muted">복원할 일지가 없습니다.</p>:<ul className="lesson-cutover-items">{state.records.map((r:any)=><li key={r.id}>
    <span>{r.data.date} · {names.get(r.data.studentKey)||'학생'} · {r.data.subject}{r.data.classSession==='있음'&&r.data.start?` ${r.data.start}`:''} · {teachers.get(r.ownerUid)||'선생님'}{r.deletedAt?` · ${new Date(r.deletedAt).toLocaleString('ko-KR')} 삭제`:''}</span>
    <StatusBadge kind={r.publicRestore?'done':'saved'} text={r.publicRestore?'리포트까지 복원':'초안으로 복원'}/>
    <button type="button" className="lesson-cutover-link" disabled={busy} onClick={()=>restore(r)}>복원</button>
   </li>)}</ul>}
  </>}
 </details>;
}
