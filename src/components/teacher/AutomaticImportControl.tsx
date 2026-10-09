import {useEffect,useRef,useState} from 'react';
import {runAutomaticImport} from '../../lib/automaticImportRunner';
export default function AutomaticImportControl({kind,request,act,busy=false,onComplete,onRunningChange}: {kind:'templates'|'directory'|'academic';request:(action:string,body?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>any;busy?:boolean;onComplete?:()=>Promise<any>;onRunningChange?:(running:boolean)=>void}){
 const [running,setRunning]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');const stop=useRef(false),flight=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;stop.current=true;};},[]);
 async function start(){if(flight.current||busy)return;if(!window.confirm('Notion 직접 수정을 잠시 멈추고 전체 자료를 자동으로 가져와 대조할까요? 기존 앱 수정은 보호하며, 앱 전용 전환과 충돌 해결은 별도로 확인합니다.'))return;
  flight.current=true;stop.current=false;setRunning(true);onRunningChange?.(true);setError('');
  try{await act(async()=>{try{const r=await runAutomaticImport(kind,request,()=>stop.current,m=>{if(live.current)setMessage(m);});if(live.current)setMessage(r.stopped?'현재 요청 후 중지했습니다. 다시 시작하면 저장된 위치에서 이어집니다.':'전체 처리 완료. 앱 전용 전환이 있는 자료는 최종 전환 버튼을 따로 확인하세요.');if(live.current&&onComplete)await onComplete();}catch(e){if(live.current){setError(e instanceof Error?e.message:'처리 실패');setMessage('자동 진행을 멈췄습니다. 문제 해결 후 저장된 위치에서 재개할 수 있습니다.');}throw e;}});}finally{flight.current=false;if(live.current){setRunning(false);onRunningChange?.(false);}}
 }
 return <div className="my-2"><div className="message-template-toolbar"><button type="button" className="primary-button" disabled={busy||running} onClick={()=>void start()}>전체 자료 이전 시작·재개</button><button type="button" className="small-button" disabled={!running} onClick={()=>{stop.current=true;setMessage('현재 요청을 마친 뒤 중지합니다.');}}>중지</button></div><p className="text-xs">페이지 확인·가져오기·대조를 자동 반복합니다. 화면을 떠나면 중지하며 재개 위치는 서버에 남습니다.</p>{message&&<p role="status" aria-live="polite" className="text-xs">{message}</p>}{error&&<p role="alert" className="text-xs">확인 필요: {error}</p>}</div>;
}

