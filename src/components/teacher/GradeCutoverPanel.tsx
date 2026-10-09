import {useEffect,useRef,useState} from 'react';
import StatusBadge from './StatusBadge';
import {runAutomaticImport} from '../../lib/automaticImportRunner';
type Props={request:(action:string,body?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>any;busy?:boolean;onChanged?:()=>any;onStatus?:(active:boolean)=>void};
export const gradeCutoverCheckLabel:Record<string,string>={core:'학생·선생님 앱 전환 완료',migration:'과거 성적 전체 대조 완료',fresh:'최근 15분 안에 대조 완료',inFlight:'지금 반영 중인 성적 없음',idle:'진행 중인 대조 없음'};
/** One button: fresh full comparison of past Notion grades, then the server verifies and switches. */
export default function GradeCutoverPanel({request,act,busy=false,onChanged,onStatus}:Props){
 const [status,setStatus]=useState<any>(null),[running,setRunning]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const live=useRef(true),stop=useRef(false);
 async function load(){const s=await request('read:academic-cutover-status');if(live.current){setStatus(s);onStatus?.(Boolean(s.active));}return s;}
 useEffect(()=>{live.current=true;void load().catch(e=>setError(e instanceof Error?e.message:'상태 확인 실패'));return()=>{live.current=false;stop.current=true;};},[]);
 const blocked=Boolean(status?.items?.some((i:any)=>['core','inFlight'].includes(i.key)&&!i.ok));
 function cutover(){
  if(!window.confirm('과거 Notion 성적을 처음부터 다시 대조한 뒤, 문제가 없으면 성적을 앱 전용으로 바꿉니다. 그동안 Notion 성적 직접 수정을 멈춰 주세요. 진행할까요?'))return;
  stop.current=false;setRunning(true);setError('');
  void act(async()=>{try{
   if(!status?.ready){await request('academic-migration-reset',{confirmed:true});await runAutomaticImport('academic',request,()=>stop.current||!live.current,m=>{if(live.current)setMessage(m);});}
   if(stop.current||!live.current)return;
   setMessage('대조 결과를 확인하고 전환하는 중…');await request('academic-cutover',{confirmed:true});
   if(live.current)setMessage('성적을 앱 전용으로 전환했습니다. 이제 Notion 성적 수정은 앱에 반영되지 않습니다.');await onChanged?.();
  }catch(e){if(live.current){setError(e instanceof Error?e.message:'전환하지 못했습니다');setMessage('전환하지 않았습니다. 기존 방식은 그대로 유지됩니다.');}}
  finally{if(live.current){setRunning(false);await load().catch(()=>{});}}});
 }
 if(!status)return <div className="lesson-cutover"><p className="lesson-cutover-muted">{error||'전환 상태를 확인하는 중…'}</p></div>;
 return <div className="lesson-cutover" aria-labelledby="grade-cutover-title">
  <header className="lesson-cutover-header"><div><h3 id="grade-cutover-title">성적 앱 전환</h3><p className="lesson-cutover-muted">성적은 이미 앱에서 작성합니다. 전환하면 Notion에서 고친 성적이 더 이상 앱에 들어오지 않아, Make 성적 시나리오를 끌 수 있습니다.</p></div>
   <StatusBadge kind={status.active?'done':'unwritten'} text={status.active?'앱 전용 사용 중':'Notion 반영 받는 중'}/></header>
  <ul className="lesson-cutover-checks">{status.items.map((i:any)=><li key={i.key}><StatusBadge kind={i.ok?'done':'failed'} text={i.ok?'완료':'확인 필요'} compact/><span>{gradeCutoverCheckLabel[i.key]||i.key}{!i.ok&&i.count?` (${i.count}건)`:''}</span></li>)}</ul>
  {!status.active&&!status.ready&&!blocked&&<p className="lesson-cutover-muted">대조 항목은 전환 버튼을 누르면 자동으로 채워집니다.</p>}
  {message&&<p role="status" aria-live="polite" className="lesson-cutover-note">{message}</p>}
  {error&&<p role="alert" className="lesson-cutover-warn">{error}</p>}
  <div className="lesson-cutover-actions">
   {status.active?<button type="button" className="lesson-cutover-link" disabled={busy||running} onClick={()=>{if(!window.confirm('성적 앱 전용 전환을 해제할까요? 앱에 저장된 성적은 그대로 남습니다.'))return;void act(async()=>{await request('academic-cutover-deactivate',{confirmed:true});await load();});}}>전환 해제</button>
   :<><button type="button" className="primary-button" disabled={busy||running||blocked} onClick={cutover}>대조 후 성적 앱 전용으로 전환</button>{running&&<button type="button" className="small-button" onClick={()=>{stop.current=true;setMessage('현재 요청을 마친 뒤 멈춥니다.');}}>중지</button>}</>}
  </div>
 </div>;
}
