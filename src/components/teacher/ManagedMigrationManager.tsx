import {useEffect,useRef,useState} from 'react';
import {runManagedMigration} from '../../lib/managedMigrationRunner';
export default function ManagedMigrationManager({busy,request,act}:any){
 const [open,setOpen]=useState(false),[plan,setPlan]=useState<any>(null),[notice,setNotice]=useState(''),[running,setRunning]=useState(false),[issue,setIssue]=useState('');
 const stop=useRef(false),flight=useRef(false),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
 const load=async()=>{const p=await request('managed-migration-plan');if(mounted.current)setPlan(p);return p;};
 async function start(){
  if(flight.current||busy)return;
  if(!window.confirm('이전과 최종 대조 동안 Notion의 교재·반·시간표 직접 수정을 멈춰 주세요. 전체 자료를 자동으로 가져오고 대조할까요? 앱 전용 전환은 별도로 확인합니다.'))return;
  flight.current=true;stop.current=false;setRunning(true);setIssue('');
  try{await act(async()=>{try{
   const r=await runManagedMigration(request,()=>stop.current,p=>{if(mounted.current)setNotice(`${p.phase==='import'?'가져오기':'최종 대조'} · ${p.source.subject} · ${p.source.kind==='classes'?'반·시간표':'교재'} · ${p.checked}건 처리`);});
   if(mounted.current){if(r.plan)setPlan(r.plan);setNotice(r.active?'이미 앱 전용으로 전환됐습니다.':r.stopped?`${r.checked}건 처리 후 중지했습니다. 다시 시작하면 저장된 위치부터 이어집니다.`:`${r.checked}건 처리 · 전체 이전·대조 완료. 아래 버튼으로 앱 전용 전환을 확인하세요.`);}
  }catch(error){if(mounted.current){setIssue(error instanceof Error?error.message:'이전 중 오류가 발생했습니다.');setNotice('문제가 발견되어 자동 진행을 멈췄습니다. 해결 후 다시 시작하면 저장된 위치부터 이어집니다.');}throw error;}});
  }finally{flight.current=false;if(mounted.current)setRunning(false);}
 }
 const disabled=busy||running;
 return <section className="panel"><button type="button" className="small-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>반·정규 시간표·교재 이전 {open?'닫기':'열기'}</button><div hidden={!open}>
 <p className="text-xs">교재 → 반·연결 시간표 순서로 자동 이전하고 대조합니다. 페이지마다 누를 필요가 없습니다. 이 화면을 떠나면 현재 요청 후 중지하며, 저장된 위치에서 재개할 수 있습니다.</p>
 <div className="message-template-toolbar"><button type="button" className="primary-button" disabled={disabled||plan?.active} onClick={()=>void start()}>전체 자료 이전 시작·재개</button><button type="button" className="small-button" disabled={!running} onClick={()=>{stop.current=true;setNotice('현재 요청을 마친 뒤 중지합니다.');}}>중지</button><button type="button" className="small-button" disabled={disabled} onClick={()=>act(load)}>진행 확인</button></div>
 {plan?.sources.map((s:any)=><p key={s.key} className="text-xs">{s.subject} · {s.kind==='classes'?'반·시간표':'교재'} · {s.ready?'가져옴':'미완료'} · {s.verifiedAt?'최종 대조 완료':'최종 대조 필요'}{s.error&&' · '+s.error}</p>)}
 <button type="button" className="primary-button" disabled={disabled||!plan||plan.active||!plan.sources.length||plan.sources.some((s:any)=>!s.ready||!s.verifiedAt||s.error)} onClick={()=>act(async()=>{if(!window.confirm('이전·최종 대조 결과를 확인했나요? 이후 반·교재는 앱에만 저장합니다. 학생·담당 전환 후 수정이 활성화됩니다.'))return;await request('managed-activate',{confirmed:true});await load();setNotice('반·시간표·교재의 앱 저장본을 확정했습니다.');})}>반·교재 앱 저장본 확정</button>
 {notice&&<p role="status" aria-live="polite" className="text-xs">{notice}</p>}{issue&&<p role="alert" className="text-xs">확인 필요: {issue}</p>}
 </div></section>;
}
