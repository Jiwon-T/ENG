import AutomaticImportControl from './AutomaticImportControl';
import {useState} from 'react';
export default function AcademyDirectoryManager({busy,request,act}:any){
 const [open,setOpen]=useState(false),[kind,setKind]=useState('students'),[data,setData]=useState<any>(null),[dry,setDry]=useState<any>(null),[notice,setNotice]=useState('');
 const labels:any={students:'학생',teachers:'선생님',enrollments:'수강'};
 const load=async(cursor?:string)=>setData(await request('directory-list',{kind,...(cursor?{cursor}:{})}));
 return <section className="panel"><button type="button" className="small-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>학생·선생님·수강 이전 {open?'닫기':'열기'}</button><div hidden={!open}>
  <p className="text-xs">기존 계정·리포트·PIN을 유지합니다. 전환 후에는 해당 자료를 앱에서만 수정합니다.</p>
  <AutomaticImportControl kind="directory" request={request} act={act} busy={busy} onComplete={()=>load()}/><div className="message-template-toolbar">{Object.keys(labels).map(k=><button type="button" key={k} className="small-button" disabled={busy} aria-pressed={kind===k} onClick={()=>{setKind(k);setData(null);setDry(null);}}>{labels[k]}</button>)}</div>
  <div className="message-template-toolbar"><button type="button" className="small-button" disabled={busy} onClick={()=>act(()=>load())}>저장본 조회</button>
   <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>setDry(await request('directory-dry-run',{kind,...(dry?.cursor?{cursor:dry.cursor}:{})})))}>{dry?.cursor?'다음 페이지 dry-run':'dry-run'}</button>
   <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>{if(!window.confirm(`${labels[kind]} 원본을 최대 10개 가져와 연결을 대조할까요? 계정은 새로 만들지 않습니다.`))return;const r=await request('directory-import-step',{kind,confirmed:true});setNotice(`신규 ${r.counts.created} · 수정 ${r.counts.updated} · 확인 필요 ${r.counts.review}${r.continue?' · 이어서 실행 필요':''}`);await load();})}>가져오기·이어서 실행</button>
   <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>{if(!window.confirm('현재 페이지의 연결과 값 비교를 완료했나요? 미확인 연결이 있으면 승인되지 않습니다.'))return;await request('directory-approve',{kind,confirmed:true});setNotice('이 자료의 검증 완료를 기록했습니다.');await load();})}>비교 검증 완료 기록</button>
   <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>{if(!window.confirm('Notion 수정을 중단하고 세 자료의 최종 변경분을 비교했나요? 전환 후에는 오래된 Notion으로 단순 복귀하지 않습니다.'))return;await request('directory-cutover',{kind,confirmed:true});setNotice('학생·수강·담당 권한을 Firestore 운영으로 전환했습니다. Notion 동기화는 필수가 아닙니다.');})}>최종 대조 후 앱 전용 전환</button></div>
  {notice&&<p role="status">{notice}</p>}{dry&&<div className="text-xs"><p>이번 페이지 쓰기: {dry.writes}</p>{dry.items.map((r:any)=><p key={r.id}>{r.id} · {r.decision} · {r.issue||'연결 확인'}{r.reusesProjection?' · 기존 공개 저장본 연결':''}</p>)}</div>}
  {data&&<><p className="text-xs">{data.sync.phase} · 가져오기 {data.sync.ready?'완료':'미완료'} · 비교 {data.sync.approved?'확인':'미확인'}</p>{data.records.map((r:any)=><p key={r.id} className="text-xs">{r.id} · {r.excluded?`옮기지 않음 (${r.excludedIssue||'확인 필요'})`:r.issue||'연결됨'}{r.archived?' · 보관됨':''}{r.issue&&!r.excluded&&<> <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>{if(!window.confirm(`이 ${labels[kind]} 행을 앱으로 옮기지 않을까요? (테스트용 등) Notion 원본은 그대로 두며, 이후 동기화와 앱 전용 전환에서 제외됩니다.`))return;await request('directory-exclude',{kind,id:r.id,confirmed:true});setNotice('이 행을 옮기지 않음으로 기록했습니다. 이제 비교 검증 완료를 기록할 수 있습니다.');await load();})}>옮기지 않음</button></>}</p>)}<button type="button" className="small-button" disabled={busy||!data.cursor} onClick={()=>act(()=>load(data.cursor))}>다음 저장본 페이지</button></>}
 </div></section>;
}

