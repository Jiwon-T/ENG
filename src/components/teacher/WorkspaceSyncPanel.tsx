import {assignmentError} from '../../lib/teacherAssignmentStatus';
export default function WorkspaceSyncPanel({data,busy,request,refresh,act}:any) {
  const managed=[...(data.classes||[]).map((r:any)=>({...r,collection:'teacherClasses'})),...(data.curricula||[]).map((r:any)=>({...r,collection:'teacherCurricula'}))];
  const own=(r:any)=>data.admin||r.ownerUid===data.uid;
  const pending=managed.filter((r:any)=>own(r)&&['failed','pending'].includes(r.notionSyncStage));
  const unmigrated=managed.filter((r:any)=>own(r)&&!r.notionPageId);
  return <section className="panel mb-4"><h2>학원 공용 DB 연결</h2>
    <p className="text-sm text-slate-600">{data.notionShared?'공용 연결 사용 중 · 선생님별 담당 범위로 조회합니다.':'기존 연결 사용 중 · 관리자가 공용 연결을 시작할 수 있습니다.'}</p>
    {data.admin && !data.notionShared && <button className="small-button mt-3" disabled={busy} onClick={()=>act(async()=>{await request('enable-shared-notion');await refresh();})}>공용 DB 연결 시작</button>}
    {(data.notionIssues||[]).map((issue:string,i:number)=><p key={i} role="status" className="mt-2 text-xs text-rose-600">{issue}</p>)}
    {unmigrated.length>0 && <button className="small-button mt-3" disabled={busy} onClick={()=>act(async()=>{await request('migrate-notion-records');await refresh();})}>기존 앱 반·계획을 노션에 옮기기 ({unmigrated.length})</button>}
    {pending.length>0 && <p className="text-xs mt-3">앱 저장 완료 · 노션 반영 대기·실패 {pending.length}건</p>}
    {pending.map((r:any)=><div key={r.collection+r.id} className="flex flex-wrap items-center gap-2 py-2 text-xs"><span>{r.name||r.title} · {r.notionSyncError||'반영 대기'}</span><button className="small-button" disabled={busy} onClick={()=>act(async()=>{await request('sync-notion-record',{collection:r.collection,id:r.id});await refresh();})}>노션 반영 다시 시도</button></div>)}
    {(data.access||[]).filter((a:any)=>a.notionAssignmentStage==='failed').map((a:any)=><div key={a.uid} className="text-xs mt-2">{data.staff?.find((s:any)=>s.uid===a.uid)?.name||a.workspaceLabel||'선생님'} · 담당 연결 반영 실패: {assignmentError(a.notionAssignmentError)} <button className="small-button" disabled={busy} onClick={()=>act(async()=>{const saved=await request('retry-teacher-assignment',{uid:a.uid});await refresh();if(saved.syncError)throw Error(assignmentError(saved.syncError));})}>다시 시도</button></div>)}
  </section>;
}
