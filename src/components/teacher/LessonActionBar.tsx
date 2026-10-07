import {useEffect,useState,type ReactNode} from 'react';
import StatusBadge,{statusKind} from './StatusBadge';
export default function LessonActionBar({status,reason,children,refresh,savedAt,failureReason,onRetry,retryDisabled=false}:{status:{text:string;tone:string};reason?:string;children:ReactNode;refresh?:ReactNode;savedAt?:number;failureReason?:string;onRetry?:()=>void;retryDisabled?:boolean}){
 const [savedFlash,setSavedFlash]=useState(false);
 useEffect(()=>{const remaining=savedAt?3000-(Date.now()-savedAt):0;setSavedFlash(remaining>0);if(remaining<=0)return;const timer=setTimeout(()=>setSavedFlash(false),remaining);return()=>clearTimeout(timer);},[savedAt]);
 const flash=savedFlash&&status.text==='저장됨';
 const failed=status.tone==='red'||Boolean(failureReason&&status.tone!=='yellow');
 const visibleReason=failed?failureReason||reason:reason;
 return <div className="lesson-action-bar" aria-label="현재 일지 저장과 반영">
  <div className="lesson-action-state"><span role="status"><StatusBadge kind={failed?'failed':flash?'done':statusKind(status)} text={failed?'저장·반영 실패':flash?'저장됨 ✓ 방금':status.text}/></span>{visibleReason&&<p className="lesson-action-reason">{visibleReason}</p>}{failed&&onRetry&&<button type="button" className="small-button" disabled={retryDisabled} onClick={onRetry}>다시 시도</button>}</div>
  <div className="lesson-action-buttons">{children}</div>{refresh&&<div className="lesson-action-refresh">{refresh}</div>}
 </div>;
}
