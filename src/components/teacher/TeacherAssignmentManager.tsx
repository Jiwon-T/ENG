import {useState} from 'react';
import {assignmentError,assignmentStatus,assignmentNeedsRecovery} from '../../lib/teacherAssignmentStatus';
const subjects=['영어','수학','국어','과학','한국사'];
export default function TeacherAssignmentManager({data,request,act,busy,refresh,onAccounts}:{data:any;request:any;act:any;busy:boolean;refresh:any;onAccounts:any}) {
 const [form,setForm]=useState<any>(null),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
 const profile=form&&data.access.find((p:any)=>p.uid===form.uid);
 function choose(uid:string){const p=data.access.find((p:any)=>p.uid===uid)||{};setNotice('');setForm(uid?{uid,scopes:p.scopes||[],notionTeacherPageId:p.notionTeacherPageId||'',workspaceLabel:p.workspaceLabel||'',workspaceRole:p.workspaceRole||'teacher',academyId:p.academyId||data.academyId||'main',assignmentRevision:p.assignmentRevision||0}:null);}
 function patch(values:any){setForm((old:any)=>({...old,...values}));}
 async function save(retry=false){
  const value=retry?{...profile,uid:form.uid,notionTeacherPageId:profile.notionTeacherPageId||null,assignmentRevision:profile.assignmentRevision||0}:form;
  const result=retry?await request('retry-teacher-assignment',{uid:form.uid}):await request('grant',{uid:value.uid,scopes:value.scopes,notionTeacherPageId:value.notionTeacherPageId||null,workspaceLabel:value.workspaceLabel,workspaceRole:value.workspaceRole,academyId:data.admin?value.academyId:data.academyId,assignmentRevision:value.assignmentRevision,academyStudents:[...new Set(value.scopes.map((s:any)=>s.studentKey))]});
  setForm(null);await refresh();setNotice(result.syncError?'앱 저장 완료 · 노션 반영 실패: '+assignmentError(result.syncError):'담당 범위를 노션에 반영했습니다. 목록에서 다시 선택해 확인할 수 있습니다.');
 }
 const locked=assignmentNeedsRecovery(profile);
 return <section className="panel"><h2>선생님 담당 범위</h2><p className="text-sm mt-2">선생님별 앱에 저장된 학생·과목과 마지막 노션 반영 결과를 확인하고 조회·수정하세요.</p>
 <div className="overflow-auto mt-3"><table className="academy-log-table"><thead><tr><th>선생님</th><th>담당 학생·과목</th><th>마지막 노션 반영 상태</th><th>관리</th></tr></thead><tbody>{data.staff.map((s:any)=>{const p=data.access.find((a:any)=>a.uid===s.uid)||{};return <tr key={s.uid}><td>{s.name}<br/>{p.workspaceRole==='principal'?'원장 선생님':'선생님'}</td><td>{p.scopes?.length?p.scopes.map((x:any)=>`${data.students.find((v:any)=>v.studentKey===x.studentKey)?.studentDisplayName||'학생 이름 확인 필요'} · ${x.subject}`).join('\n'):'저장된 담당 없음'}</td><td>{assignmentStatus(p)}{p.notionAssignmentStage==='failed'&&<p className="text-sm text-rose-600">{assignmentError(p.notionAssignmentError)}</p>}{!p.notionTeacherPageId&&<p className="text-sm">노션 선생님 페이지 미연결</p>}</td><td><button className="small-button" disabled={busy||p.disabled} onClick={()=>choose(s.uid)}>조회·수정</button></td></tr>;})}</tbody></table></div>
 <label className="block mt-3">선생님 선택<select value={form?.uid||''} disabled={busy} onChange={e=>choose(e.target.value)}><option value="">선생님 선택</option>{data.staff.map((s:any)=><option key={s.uid} value={s.uid}>{s.name}</option>)}</select></label>
 {form&&<><div className="grid sm:grid-cols-2 gap-3 mt-3"><label>직책<select disabled={busy||!data.admin} value={form.workspaceRole} onChange={e=>patch({workspaceRole:e.target.value})}><option value="teacher">선생님</option><option value="principal">원장 선생님</option></select></label><label>과목·선생님 이름<input disabled={busy} value={form.workspaceLabel} onChange={e=>patch({workspaceLabel:e.target.value})}/></label></div>
 <label className="block mt-3">DB_선생님의 선생님 페이지 ID<input disabled={busy||locked} value={form.notionTeacherPageId} onChange={e=>patch({notionTeacherPageId:e.target.value.trim()})} placeholder="선생님 페이지 URL의 32자리 ID"/></label>
 <button className="small-button mt-2" disabled={busy||!profile?.notionTeacherPageId||locked} onClick={()=>act(async()=>{const r=await request('read:teacher-assignment',{uid:form.uid});patch({scopes:r.scopes});setNotice('현재 노션 담당을 불러왔습니다. 확인 후 담당 범위 저장을 눌러 앱 목록과 맞춰 주세요.');})}>현재 노션 담당 불러오기</button>
 <p className="text-sm mt-3">선택한 범위에 해당 선생님을 연결하고, 해제한 범위에서 해당 선생님만 제외합니다. 다른 공동 담당은 유지합니다.</p>
 {locked&&<p role="alert" className="text-sm text-rose-600 mt-2">일부 반영 결과를 확인해야 합니다. 저장한 범위를 다시 반영한 뒤 변경하세요.</p>}
 <input aria-label="담당 학생 검색" className="mt-3" value={search} placeholder="학생 이름 검색" onChange={e=>setSearch(e.target.value)}/>
 <div className="my-3 max-h-96 overflow-auto">{data.students.filter((s:any)=>s.studentDisplayName.includes(search)).map((s:any)=><div key={s.studentKey} className="py-2 border-b"><p className="text-sm font-bold">{s.studentDisplayName}</p><div className="flex flex-wrap gap-3">{subjects.map(subject=><label key={subject}><input type="checkbox" disabled={busy||locked} checked={form.scopes.some((x:any)=>x.studentKey===s.studentKey&&x.subject===subject)} onChange={e=>patch({scopes:e.target.checked?[...form.scopes,{studentKey:s.studentKey,subject}]:form.scopes.filter((x:any)=>!(x.studentKey===s.studentKey&&x.subject===subject))})}/>{subject}</label>)}</div></div>)}</div>
 <button className="primary-button" disabled={busy||locked} onClick={()=>act(()=>save())}>담당 범위 저장</button>{['pending','failed'].includes(profile?.notionAssignmentStage)&&<button className="small-button ml-2" disabled={busy} onClick={()=>act(()=>save(true))}>저장한 범위 다시 반영</button>}<button className="small-button ml-2" disabled={busy} onClick={()=>setForm(null)}>닫기</button></>}
 {notice&&<p role="status" className="text-sm mt-3">{notice}</p>}
 {data.admin&&<div className="flex flex-wrap gap-2 mt-5"><button className="small-button" onClick={onAccounts}>기존 계정·리포트 관리</button><button className="small-button" disabled={busy} onClick={()=>act(async()=>{await request('prepare-notion');setNotice('수업 일지·성적·일정 연결 속성을 준비했습니다.');})}>Notion 입력 연결 준비</button></div>}
 </section>;
}
