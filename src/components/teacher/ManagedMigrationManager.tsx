import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {runManagedMigration,confirmManagedMigration,type ManagedProgress} from '../../lib/managedMigrationRunner';
const kindLabel=(kind:string)=>kind==='classes'?'반·시간표':'교재';
const VERIFY_MS=15*60*1000;
export default function ManagedMigrationManager({busy,request,act}:any){
 const [open,setOpen]=useState(false),[plan,setPlan]=useState<any>(null),[notice,setNotice]=useState(''),[running,setRunning]=useState<''|'import'|'confirm'>(''),[issue,setIssue]=useState(''),[progress,setProgress]=useState<ManagedProgress|null>(null);
 const stop=useRef(false),flight=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
 const load=async()=>{const p=await request('managed-migration-plan');if(mounted.current)setPlan(p);return p;};
 // Opening the card reads the saved position once; nothing is fetched while it stays closed.
 useEffect(()=>{if(open&&!plan)void act(load);},[open]);
 async function run(mode:'import'|'confirm'){
  if(flight.current||busy)return;
  const question=mode==='import'?'이전과 최종 대조 동안 Notion의 교재·반·시간표 직접 수정을 멈춰 주세요. 전체 자료를 자동으로 가져오고 대조할까요? 앱 저장본 확정은 따로 확인합니다.':'최종 대조를 한 번 더 자동으로 실행하고, 문제가 없으면 반·교재를 앱 저장본으로 확정할까요? 이후 반·교재는 앱에만 저장합니다. 학생·담당 전환 후 수정이 활성화됩니다.';
  if(!window.confirm(question))return;
  flight.current=true;stop.current=false;setRunning(mode);setIssue('');setProgress(null);setNotice('');
  try{await act(async()=>{try{
   const onProgress=(p:ManagedProgress)=>{if(mounted.current)setProgress(p);};
   const r:any=mode==='import'?await runManagedMigration(request,()=>stop.current,onProgress):await confirmManagedMigration(request,()=>stop.current,onProgress);
   const kept=r.preserved?` Notion 반영이 끝나지 않았던 ${r.preserved}건은 앱 저장본을 그대로 지켰습니다.`:'';
   if(mounted.current)setNotice(r.active?'이미 앱 저장본으로 확정됐습니다.':r.stopped?`${r.checked}건 처리 후 멈췄습니다. 다시 시작하면 저장된 위치부터 이어집니다.`:r.activated?`최종 대조 후 반·시간표·교재를 앱 저장본으로 확정했습니다.${kept}`:`${r.checked}건 처리 · 이전과 최종 대조를 마쳤습니다.${kept} 이제 ‘반·교재 앱 저장본 확정’을 누르세요.`);
  }catch(error){if(mounted.current){setIssue(error instanceof Error?error.message:'이전 중 오류가 발생했습니다.');setNotice('자동 진행을 멈췄습니다. 처리한 위치는 저장되어 있어 다시 시작하면 이어집니다.');}throw error;}
  finally{if(mounted.current)await load().catch(()=>{});}});
  }finally{flight.current=false;if(mounted.current){setRunning('');setProgress(null);}}
 }
 const sources:any[]=plan?.sources||[],disabled=busy||Boolean(running);
 const imported=sources.length>0&&sources.every(s=>s.ready&&!s.error),verified=imported&&sources.every(s=>s.verifiedAt);
 const fresh=verified&&sources.every(s=>Date.now()-s.verifiedAt<VERIFY_MS);
 const stage=plan?.active?3:verified?2:1;
 return <section className="panel"><button type="button" className="small-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>반·정규 시간표·교재 이전 {open?'닫기':'열기'}</button><div hidden={!open} className="rv" style={{marginTop:12}}>
 <p className="gs-note">교재 → 반·연결 시간표 순서로 자동 이전하고 대조합니다. 페이지마다 누를 필요가 없습니다. 연결이 잠시 끊기면 스스로 다시 시도하고, 이 화면을 떠나면 현재 요청 후 멈춰 저장된 위치에서 이어집니다.</p>
 <ol className="gs-rows" style={{listStyle:'none',margin:0,padding:0}}>
  {[['1','전체 자료 가져오기·대조','Notion의 교재·반·시간표를 앱으로 가져오고 한 번 더 대조합니다. Notion 반영이 끝나지 않은 앱 저장본은 앱 값을 그대로 지킵니다.'],['2','앱 저장본 확정','버튼을 누르면 최종 대조를 자동으로 다시 한 뒤 확정합니다.'],['3','완료','반·교재는 앱에만 저장됩니다.']].map(([n,title,text])=>{const state=Number(n)<stage?'done':Number(n)===stage?'current':'todo';return <li key={n} className="rv-stat" aria-current={state==='current'?'step':undefined} style={{display:'flex',gap:10,alignItems:'flex-start',opacity:state==='todo'?.6:1,...(state==='current'?{borderColor:'var(--workspace-brand-dot)',background:'var(--workspace-brand-bg)'}:{})}}><span className="gs-num" aria-hidden="true">{state==='done'?'✓':n}</span><span><b style={{fontSize:14}}>{title}</b><span style={{display:'block'}}>{text}</span></span></li>;})}
 </ol>
 <div className="rv-actions"><button type="button" className="primary-button" disabled={disabled||plan?.active} onClick={()=>void run('import')}>{running==='import'?'가져오는 중…':imported?'다시 대조하기':'전체 자료 이전 시작·재개'}</button><button type="button" className="primary-button" disabled={disabled||!plan||plan.active||!imported} title={!imported?'먼저 전체 자료를 가져와 주세요.':undefined} onClick={()=>void run('confirm')}>{running==='confirm'?'대조 후 확정 중…':'반·교재 앱 저장본 확정'}</button><button type="button" className="small-button" disabled={!running} onClick={()=>{stop.current=true;setNotice('현재 요청을 마친 뒤 멈춥니다.');}}>중지</button><button type="button" className="rv-icon" aria-label="진행 확인" title="진행 확인" disabled={disabled} onClick={()=>act(load)}><RefreshCw size={16}/></button></div>
 {progress&&<p role="status" aria-live="polite" className="gs-note"><b>{progress.phase==='import'?'가져오는 중':'최종 대조 중'}</b> · {progress.source.subject} {kindLabel(progress.source.kind)} · {progress.checked}건 처리{progress.preserved?` · 앱 저장본 유지 ${progress.preserved}건`:''}{progress.retrying?` · ${progress.retrying}`:''}</p>}
 {sources.length>0&&<div className="gs-rows">{sources.map((s:any)=><div key={s.key} className="rv-card" style={{gridTemplateColumns:'minmax(0,1fr) auto',alignItems:'center'}}><span><b>{s.subject} · {kindLabel(s.kind)}</b><span className="rv-sub" style={{display:'block'}}>{s.error?'멈춤 · 아래 안내를 확인해 주세요':s.verifiedAt?`최종 대조 ${new Date(s.verifiedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`:s.ready?'가져옴 · 최종 대조 필요':s.hasCursor?'가져오는 중 · 저장된 위치에서 이어짐':'아직 시작 전'}</span></span><StatusBadge kind={s.error?'failed':s.verifiedAt?'done':s.ready||s.hasCursor?'saved':'unwritten'} text={s.error?'확인 필요':s.verifiedAt?'대조 완료':s.ready?'가져옴':s.hasCursor?'진행 중':'시작 전'}/></div>)}</div>}
 {plan?.active&&<p className="rv-muted">반·시간표·교재가 앱 저장본으로 확정됐습니다.</p>}
 {verified&&!fresh&&!plan?.active&&<p className="gs-note">최종 대조가 15분보다 오래되었지만 괜찮습니다. 확정 버튼이 대조를 자동으로 다시 합니다.</p>}
 {notice&&<p role="status" aria-live="polite" className="gs-note">{notice}</p>}{issue&&<p role="alert" className="rv-missing" style={{display:'block'}}>확인 필요: {issue}</p>}
 </div></section>;
}
