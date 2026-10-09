import {useEffect,useRef,useState} from 'react';
import StatusBadge from './StatusBadge';
import {runAutomaticImport} from '../../lib/automaticImportRunner';
type Props={request:(action:string,input?:any)=>Promise<any>;act:(fn:()=>Promise<any>)=>any;busy?:boolean;onStatus?:(active:boolean)=>void};
export const templateCutoverCheckLabel:Record<string,string>={imported:'Notion 템플릿 최초 가져오기 완료',freshPull:'최근 15분 안에 Notion 변경 가져오기',freshCheck:'최근 15분 안에 원본 보관·접근 점검',conflicts:'양쪽 수정 충돌 없음',sourceAccess:'원본 접근 확인 안 된 템플릿 없음',idle:'진행 중인 가져오기·점검 없음'};
/** One button: import + source check run automatically, then the server verifies and switches in one transaction. */
export default function TemplateCutoverPanel({request,act,busy=false,onStatus}:Props){
 const [status,setStatus]=useState<any>(null),[running,setRunning]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const live=useRef(true),stop=useRef(false);
 async function load(){const s=await request('template-cutover-status',{});if(live.current){setStatus(s);onStatus?.(Boolean(s.active));}return s;}
 useEffect(()=>{live.current=true;void load().catch(e=>setError(e instanceof Error?e.message:'상태 확인 실패'));return()=>{live.current=false;stop.current=true;};},[]);
 function cutover(){
  if(!window.confirm('Notion 템플릿을 마지막으로 가져오고 원본을 점검한 뒤, 문제가 없으면 문자 템플릿을 앱 전용으로 바꿉니다. 그동안 Notion 템플릿 직접 수정을 멈춰 주세요. 진행할까요?'))return;
  stop.current=false;setRunning(true);setError('');
  void act(async()=>{try{
   await runAutomaticImport('templates',request,()=>stop.current||!live.current,m=>{if(live.current)setMessage(m);});
   if(stop.current||!live.current)return;
   setMessage('대조 결과를 확인하고 전환하는 중…');
   const r=await request('template-cutover',{confirmed:true});
   if(live.current)setMessage(r.convertedWaiting?`앱 전용으로 전환했습니다. Notion 반영을 기다리던 수정 ${r.convertedWaiting}건은 앱 저장으로 확정했습니다.`:'앱 전용으로 전환했습니다.');
  }catch(e){if(live.current){setError(e instanceof Error?e.message:'전환하지 못했습니다');setMessage('전환하지 않았습니다. 기존 방식은 그대로 유지됩니다.');}}
  finally{if(live.current){setRunning(false);await load().catch(()=>{});}}});
 }
 // Conflicts and unconfirmed source access need a person; the import/check can't settle them.
 const blocked=Boolean(status?.items?.some((i:any)=>['conflicts','sourceAccess'].includes(i.key)&&!i.ok));
 if(!status)return <div className="lesson-cutover"><p className="lesson-cutover-muted">{error||'전환 상태를 확인하는 중…'}</p></div>;
 return <div className="lesson-cutover" aria-labelledby="template-cutover-title">
  <header className="lesson-cutover-header"><div><h3 id="template-cutover-title">문자 템플릿 앱 전환</h3><p className="lesson-cutover-muted">전환하면 문자 화면과 템플릿 편집이 앱 저장본만 사용하고, Notion으로는 더 이상 반영하지 않습니다.</p></div>
   <StatusBadge kind={status.active?'done':'unwritten'} text={status.active?'앱 전용 사용 중':'Notion 사용 중'}/></header>
  <ul className="lesson-cutover-checks">{(status.items||[]).map((i:any)=><li key={i.key}><StatusBadge kind={i.ok?'done':'failed'} text={i.ok?'완료':'확인 필요'} compact/><span>{templateCutoverCheckLabel[i.key]||i.key}{!i.ok&&i.count?` (${i.count}건)`:''}</span></li>)}</ul>
  {!status.active&&!status.ready&&<p className="lesson-cutover-muted">'최근 15분' 항목은 전환 버튼을 누르면 자동으로 채워집니다. 충돌·접근 확인 항목은 아래 템플릿 목록에서 먼저 정리해 주세요.</p>}
  {message&&<p role="status" aria-live="polite" className="lesson-cutover-note">{message}</p>}
  {error&&<p role="alert" className="lesson-cutover-warn">{error}</p>}
  <div className="lesson-cutover-actions">
   {status.active?<button type="button" className="lesson-cutover-link" disabled={busy||running} onClick={()=>{if(!window.confirm('문자 템플릿 앱 전용 전환을 해제할까요? 앱에 저장된 템플릿은 그대로 남습니다.'))return;void act(async()=>{await request('template-cutover-deactivate',{confirmed:true});await load();});}}>전환 해제</button>
   :<><button type="button" className="primary-button" disabled={busy||running||blocked} onClick={cutover}>가져오기·점검 후 앱 전용으로 전환</button>{running&&<button type="button" className="small-button" onClick={()=>{stop.current=true;setMessage('현재 요청을 마친 뒤 멈춥니다.');}}>중지</button>}</>}
  </div>
 </div>;
}
