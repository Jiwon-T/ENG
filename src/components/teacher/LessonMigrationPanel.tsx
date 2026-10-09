import {useEffect,useRef,useState} from 'react';
import StatusBadge from './StatusBadge';
import {nextDriverAction,lessonCutoverStep,lessonMigrationStatusLabel,lessonMigrationPhaseLabel,lessonMigrationPhaseOrder,lessonMigrationHoldLabel,lessonCutoverCheckLabel,lessonMigrationSummary,type LessonMigrationJob} from '../../lib/lessonMigrationDriver';
type Props={request:(action:string,body?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>any;students?:{studentKey:string;studentDisplayName?:string}[];staff?:{uid:string;name:string}[]};
const STEPS=['과거 일지 가져오기','확인 필요 항목','앱 전용 전환'];
/** Admin-only lesson cutover. Firestore status only on open; Notion is read by the server job, never by this view. */
export default function LessonMigrationPanel({request,act,students=[],staff=[]}:Props){
 const [status,setStatus]=useState<any>(null),[driving,setDriving]=useState(false),[error,setError]=useState(''),[expanded,setExpanded]=useState<string|null>(null);
 const live=useRef(true),driver=useRef(0),autoRecheck=useRef(0);
 useEffect(()=>{live.current=true;void load().then(s=>{if(s&&nextDriverAction(s.job).kind!=='stop')void drive(s.job);}).catch(e=>setError(message(e)));return()=>{live.current=false;driver.current++;};},[]);
 const message=(e:unknown)=>e instanceof Error?e.message:'처리하지 못했습니다';
 async function load(){const r=await request('read:lesson-migration-status');if(!live.current)return null;const next={...r,job:r.job?.status==='none'?null:r.job};setStatus(next);return next;}
 // While this card is on screen, keep a started job moving. The server keeps the position either way.
 async function drive(initial:LessonMigrationJob|null){
  const token=++driver.current;let current=initial;setDriving(true);setError('');
  try{while(live.current&&driver.current===token){
   const next=nextDriverAction(current);if(next.kind==='stop')break;
   if(next.kind==='wait'){await new Promise(r=>setTimeout(r,next.ms));if(driver.current!==token)break;current=(await load())?.job;continue;}
   const r=await request('lesson-migration-step',{});current=r.job;if(live.current)setStatus((old:any)=>({...old,job:r.job}));
  }}catch(e){if(live.current)setError(message(e));}
  finally{if(driver.current===token&&live.current){setDriving(false);const s=await load().catch(()=>null);
   // A decision made while a recheck was already past it is picked up once more, automatically.
   const decided=Object.values(s?.holdGroups||{}).some((g:any)=>g.decided>0);
   if(s&&decided&&s.job?.status==='completed'&&autoRecheck.current<2){autoRecheck.current++;run('lesson-migration-start',{mode:'recheck'});}}}
 }
 function run(action:string,body:any,confirmText?:string){
  if(confirmText&&!window.confirm(confirmText))return;
  void act(async()=>{let r=await request(action,{confirmed:true,...body});
   // Decisions apply right away: start (or join) a recheck instead of asking for another click.
   if(action.startsWith('lesson-migration-hold')){autoRecheck.current=0;r=await request('lesson-migration-start',{confirmed:true,mode:'recheck'});}
   const s=await load();const job=r.job||s?.job;if(job&&nextDriverAction(job).kind!=='stop')void drive(job);});
 }
 const names=new Map(students.map(s=>[s.studentKey,s.studentDisplayName||'학생'])),teachers=new Map(staff.map(s=>[s.uid,s.name]));
 const job:LessonMigrationJob|null=status?.job||null,cutover=status?.cutover,groups:Record<string,any>=status?.holdGroups||{};
 const step=lessonCutoverStep(status),running=['running','waiting'].includes(job?.status||'');
 const stoppable=running||job?.status==='blocked';
 const summary=lessonMigrationSummary(job);
 const jobLine=job&&<div className="lesson-cutover-progress" role="status" aria-live="polite">
  <div className="lesson-cutover-progress-head"><StatusBadge kind={job.status==='blocked'?'failed':job.status==='completed'&&job.result?.ready?'done':job.status==='paused'?'unwritten':'saved'} text={(lessonMigrationStatusLabel[job.status||'']||job.status||'')+(running&&job.phase?' · '+(lessonMigrationPhaseLabel[job.phase]||job.phase):'')+(job.mode==='dry-run'?' · 미리 점검':job.final?' · 최종 대조':'')}/>{driving&&<span className="lesson-cutover-muted">이 화면에서 진행 중</span>}</div>
  {/* Notion gives no total count, so progress is shown as live counts rather than a guessed percentage. */}
  {running&&<div className="lesson-cutover-bar" aria-hidden="true"><span/></div>}
  {running&&job.phase&&<ol className="lesson-cutover-phases" aria-label="진행 단계">{lessonMigrationPhaseOrder.slice(0,-1).filter(p=>p!=='recheck'||job.phase==='recheck').map(p=>{const at=lessonMigrationPhaseOrder.indexOf(job.phase!),me=lessonMigrationPhaseOrder.indexOf(p);return <li key={p} className={me<at?'is-done':me===at?'is-current':''}>{lessonMigrationPhaseLabel[p]}</li>;})}</ol>}
  {summary.length>0&&<p className="lesson-cutover-muted">{summary.map(([k,v])=>`${k} ${v.toLocaleString()}건`).join(' · ')}</p>}
  {job.lastError&&<p className="lesson-cutover-warn">{job.status==='waiting'?'잠시 연결이 불안정해 자동으로 다시 시도합니다.':'진행을 멈췄습니다. 원인을 해결한 뒤 이어서 진행하세요.'} ({job.lastError})</p>}
  {stoppable&&<div className="lesson-cutover-actions">{running?<button type="button" className="small-button" onClick={()=>run('lesson-migration-pause',{})}>일시 중지</button>:<button type="button" className="primary-button" onClick={()=>run('lesson-migration-start',{mode:job.mode==='dry-run'?'dry-run':job.final?'final':'full'})}>이어서 진행</button>}</div>}
 </div>;
 if(!status)return <section className="panel lesson-cutover" aria-busy="true"><h3>일지 앱 전환</h3>{error?<p role="alert" className="lesson-cutover-warn">{error}</p>:<p className="lesson-cutover-muted">상태를 불러오는 중…</p>}</section>;
 return <section className="panel lesson-cutover" aria-labelledby="lesson-cutover-title">
  <header className="lesson-cutover-header"><div><h3 id="lesson-cutover-title">일지 앱 전환</h3><p className="lesson-cutover-muted">과거 Notion 일지를 앱으로 옮기고, 확인이 끝나면 일지를 앱에서만 쓰도록 바꿉니다. 진행 위치는 서버에 저장되어 창을 닫아도 이어집니다{status.cronConfigured?' (예약 실행 사용 중)':''}.</p></div>
   <StatusBadge kind={cutover?.active?'done':'unwritten'} text={cutover?.active?'앱 전용 사용 중':'Notion 사용 중'}/></header>
  <ol className="lesson-cutover-steps">{STEPS.map((label,i)=>{const n=i+1,state=n<step||n===3&&cutover?.active?'done':n===step?'current':'todo';return <li key={label} className={'is-'+state} aria-current={state==='current'?'step':undefined}><span className="lesson-cutover-step-dot">{state==='done'?'✓':n}</span><span>{label}</span></li>;})}</ol>
  {error&&<p role="alert" className="lesson-cutover-warn">{error}</p>}

  {step===1&&<div className="lesson-cutover-body">
   {jobLine}
   {!stoppable&&<>{job?.mode==='dry-run'&&job.status==='completed'&&<p className="lesson-cutover-note">미리 점검 결과: 이전 예정 {(job.counts?.wouldStage||0).toLocaleString()}건 · 확인 필요 {(job.result?.openHolds||0).toLocaleString()}건. 저장된 것은 없습니다.</p>}
    <p>Notion 일지를 처음부터 끝까지 읽어 앱 보관함으로 옮깁니다. 선생님 화면, 학부모 리포트, Notion 원본은 바뀌지 않습니다. 확인이 필요한 일지만 따로 모아 보여 드립니다.</p>
    <div className="lesson-cutover-actions"><button type="button" className="primary-button" onClick={()=>run('lesson-migration-start',{mode:'full'},'과거 Notion 일지를 앱으로 가져올까요? 화면·리포트·Notion 원본은 바뀌지 않습니다.')}>과거 일지 가져오기 시작</button>
     <button type="button" className="lesson-cutover-link" onClick={()=>run('lesson-migration-start',{mode:'dry-run'},'저장하지 않고 몇 건이 옮겨지고 몇 건이 확인 필요한지만 볼까요?')}>저장 없이 미리 점검</button></div></>}
  </div>}

  {step===2&&<div className="lesson-cutover-body">
   {running?jobLine:<>
    <p>아래 일지는 자동으로 판단하지 않았습니다. Notion에서 고치거나, 안내된 방법 그대로 확정하면 다시 확인할 때 반영됩니다. 나머지 일지는 이미 옮겨졌습니다.</p>
    <ul className="lesson-cutover-groups">{Object.entries(groups).sort((a:any,b:any)=>b[1].count-a[1].count).map(([code,g]:any)=>{const label:{label:string;accept?:string;fix:string}=lessonMigrationHoldLabel[code]||{label:code,fix:''};const items=(status.holds||[]).filter((h:any)=>h.code===code);return <li key={code} className="lesson-cutover-group">
     <div className="lesson-cutover-group-head"><strong>{label.label}</strong><span className="lesson-cutover-count">{g.count.toLocaleString()}건{g.decided?` · ${g.decided}건 확정됨`:''}</span></div>
     <p className="lesson-cutover-muted">{label.fix}</p>
     <div className="lesson-cutover-actions">{g.acknowledgeable&&label.accept&&g.decided<g.count&&<button type="button" className="small-button" onClick={()=>run('lesson-migration-hold-group',{code},`${label.label} ${g.count}건을 모두 '${label.accept}'(으)로 확정할까요? 원본이 다시 바뀌면 새로 확인합니다.`)}>모두 {label.accept}</button>}
      <button type="button" className="lesson-cutover-link" aria-expanded={expanded===code} onClick={()=>setExpanded(expanded===code?null:code)}>{expanded===code?'목록 닫기':'일지 보기'}</button></div>
     {expanded===code&&<ul className="lesson-cutover-items">{items.length===0&&<li className="lesson-cutover-muted">처음 50건 안에 이 유형이 없습니다. 다른 유형을 먼저 정리하면 표시됩니다.</li>}{items.map((h:any)=><li key={h.sourceKey}>
      <span>{h.date||'날짜 없음'} · {h.studentKey?names.get(h.studentKey)||'학생':'학생 없음'} · {h.ownerUid?teachers.get(h.ownerUid)||'선생님':'작성자 없음'}</span>
      {h.sourceId&&<a href={`https://www.notion.so/${String(h.sourceId).replace(/-/g,'')}`} target="_blank" rel="noreferrer">Notion에서 열기</a>}
      {h.decided?<span className="lesson-cutover-muted">확정됨</span>:h.acknowledgeable&&label.accept&&<button type="button" className="lesson-cutover-link" onClick={()=>run('lesson-migration-hold',{sourceKey:h.sourceKey,decision:'acknowledge'},`이 일지를 '${label.accept}'(으)로 확정할까요?`)}>이 일지만 확정</button>}
     </li>)}</ul>}
    </li>;})}</ul>
    <div className="lesson-cutover-actions"><button type="button" className="primary-button" onClick={()=>run('lesson-migration-start',{mode:'recheck'})}>고친 내용 다시 확인</button></div></>}
  </div>}

  {step===3&&<div className="lesson-cutover-body">
   {running?jobLine:<>
    <ul className="lesson-cutover-checks">{(cutover?.items||[]).map((i:any)=><li key={i.key}><StatusBadge kind={i.ok?'done':i.key==='paths'?'unwritten':'failed'} text={i.ok?'완료':i.key==='paths'?'다음 업데이트':'확인 필요'} compact/><span>{lessonCutoverCheckLabel[i.key]||i.key}{i.key==='inFlight'&&!i.ok?` (${i.count}건)`:''}</span></li>)}</ul>
    {cutover?.active?<><p className="lesson-cutover-note">일지는 앱에서만 저장·조회합니다. 문제가 생기면 전환을 해제해도 앱에 저장된 일지와 리포트는 그대로 남습니다.</p>
     <div className="lesson-cutover-actions"><button type="button" className="lesson-cutover-link" onClick={()=>run('lesson-cutover-deactivate',{},'일지 앱 전용 전환을 해제할까요? 앱에 저장된 일지와 리포트는 지워지지 않습니다.')}>전환 해제</button></div></>
    :<><p>버튼을 누르면 서버가 Notion 일지를 마지막으로 한 번 더 대조하고, 문제가 없으면 바로 앱 전용으로 바꿉니다. 대조 중 문제가 나오면 전환하지 않고 확인 필요 항목으로 돌아갑니다. 누르기 전에 선생님들께 Notion 일지 직접 수정을 멈춰 달라고 알려 주세요.</p>
     {job?.result?.activation?.error&&<p className="lesson-cutover-warn">지난 전환 시도는 완료되지 않았습니다 ({job.result.activation.error}).</p>}
     <div className="lesson-cutover-actions"><button type="button" className="primary-button" disabled={!cutover?.pathsReady} onClick={()=>run('lesson-cutover',{},'최종 대조 후 문제가 없으면 일지를 앱 전용으로 바꿉니다. 진행할까요?')}>최종 대조 후 앱 전용으로 전환</button>
      <button type="button" className="lesson-cutover-link" onClick={()=>run('lesson-migration-start',{mode:'final'},'전환하지 않고 최종 대조만 미리 실행할까요?')}>최종 대조만 미리 실행</button></div>
     {!cutover?.pathsReady&&<p className="lesson-cutover-muted">앱 일지 조회·저장 연결이 다음 업데이트에 들어간 뒤 전환 버튼이 열립니다. 지금은 대조까지 미리 해 둘 수 있습니다.</p>}</>}
   </>}
  </div>}
 </section>;
}
