import {useState} from 'react';
export default function ManagedMigrationManager({busy,request,act}:any){
 const [open,setOpen]=useState(false),[plan,setPlan]=useState<any>(null),[notice,setNotice]=useState(''),[dry,setDry]=useState<Record<string,any>>({});
 const load=async()=>setPlan(await request('managed-migration-plan'));
 return <section className="panel"><button type="button" className="small-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>반·정규 시간표·교재 이전 {open?'닫기':'열기'}</button><div hidden={!open}>
  <p className="text-xs">교재 → 반·연결 시간표 순서로 이전합니다. 앱에 저장한 미완료 변경은 덮어쓰지 않습니다.</p><button type="button" className="small-button" disabled={busy} onClick={()=>act(load)}>이전 원본·진행 확인</button>
  {plan?.sources.map((s:any)=><div key={s.key} className="message-template-toolbar"><span className="text-xs">{s.subject} · {s.kind==='classes'?'반·시간표':'교재'} · {s.ready?'가져옴':'미완료'} · {s.verifiedAt?'최종 대조 완료':'최종 대조 필요'}{s.error&&' · '+s.error}</span>
   <button type="button" className="small-button" disabled={busy||plan.active} onClick={()=>act(async()=>{const r=await request('managed-import-step',{key:s.key,kind:s.kind,dryRun:true,...(dry[s.key]?.cursor?{cursor:dry[s.key].cursor}:{})});setDry(old=>({...old,[s.key]:r}));setNotice(`dry-run: ${r.decision} · 쓰기 ${r.writes}${r.continue?' · 다음 원본 있음':''}`);})}>dry-run·다음</button>
   {[false,true].map(final=><button type="button" key={String(final)} className="small-button" disabled={busy||plan.active} onClick={()=>act(async()=>{if(!window.confirm(final?'Notion 직접 수정을 중단했나요? 원본 1건과 연결을 다시 대조할까요?':'원본 1건과 연결된 시간표·교재를 가져올까요?'))return;const r=await request('managed-import-step',{key:s.key,kind:s.kind,final,confirmed:true});setNotice(`${r.decision}${r.continue?' · 이어서 실행 필요':' · 이번 원본 완료'}`);await load();})}>{final?'최종 대조·이어서':'가져오기·이어서'}</button>)}
  </div>)}<button type="button" className="primary-button" disabled={busy||!plan||plan.active} onClick={()=>act(async()=>{if(!window.confirm('모든 원본과 연결의 최종 대조를 완료했나요? 이후 반·교재는 앱에만 저장합니다. 학생·담당 전환 후 수정이 활성화됩니다.'))return;await request('managed-activate',{confirmed:true});await load();setNotice('반·시간표·교재의 앱 저장본을 확정했습니다. 학생·담당 권한 전환 후 앱에서 수정할 수 있습니다.');})}>반·교재 앱 저장본 확정</button>
  {notice&&<p role="status" className="text-xs">{notice}</p>}
 </div></section>;
}
