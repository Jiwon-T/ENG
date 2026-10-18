import {useEffect,useState,type ReactNode} from 'react';
import {MoreHorizontal} from 'lucide-react';
import StatusBadge,{statusKind} from './StatusBadge';
/** `statusInTitle`: the save state is shown next to the editor title, so the bar keeps only a failure, the reason and `hint`.
 *  `more`: items for the ⋯ menu, shown on phones in place of the refresh and delete buttons (one row: 저장 / 반영 / ⋯). On a
 *  PC the menu shows only items marked `lesson-more-always` (미리보기), and only when there is one. */
export default function LessonActionBar({status,reason,children,refresh,savedAt,failureReason,onRetry,retryDisabled=false,statusInTitle=false,hint,more,extra}:{status:{text:string;tone:string};reason?:string;children:ReactNode;refresh?:ReactNode;savedAt?:number;failureReason?:string;onRetry?:()=>void;retryDisabled?:boolean;statusInTitle?:boolean;hint?:ReactNode;more?:ReactNode;extra?:ReactNode}){
 const [savedFlash,setSavedFlash]=useState(false);
 useEffect(()=>{const remaining=savedAt?3000-(Date.now()-savedAt):0;setSavedFlash(remaining>0);if(remaining<=0)return;const timer=setTimeout(()=>setSavedFlash(false),remaining);return()=>clearTimeout(timer);},[savedAt]);
 const flash=savedFlash&&status.text==='저장됨';
 const failed=status.tone==='red'||Boolean(failureReason&&status.tone!=='yellow');
 const visibleReason=failed?failureReason||reason:reason;
 return <div className={`lesson-action-bar${statusInTitle?' is-title-status':''}`} aria-label="현재 일지 저장과 반영">
  <div className="lesson-action-state">{(!statusInTitle||failed)&&<span role="status"><StatusBadge kind={failed?'failed':flash?'done':statusKind(status)} text={failed?'저장·반영 실패':flash?'저장됨 ✓ 방금':status.text}/></span>}{visibleReason&&<p className="lesson-action-reason">{visibleReason}</p>}{failed&&onRetry&&<button type="button" className="small-button" disabled={retryDisabled} onClick={onRetry}>다시 시도</button>}{extra}</div>
  {hint&&<span className="lesson-action-hint">{hint}</span>}
  <div className="lesson-action-buttons">{children}{more&&<details className="lesson-action-more"><summary aria-label="더보기" title="더보기"><MoreHorizontal size={18} aria-hidden="true"/></summary><div className="lesson-action-more-menu" onClick={e=>{if((e.target as HTMLElement).closest('button'))e.currentTarget.closest('details')?.removeAttribute('open');}}>{more}</div></details>}</div>{refresh&&<div className="lesson-action-refresh">{refresh}</div>}
 </div>;
}

/** Editor shortcuts: Ctrl/⌘+S saves, Ctrl/⌘+Enter publishes (the editors still ask before publishing). */
export function lessonShortcut(e:{ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean;code?:string;key?:string}):'save'|'publish'|null{
 if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return null;
 if(e.code==='KeyS'||e.key?.toLowerCase()==='s')return 'save';
 if(e.key==='Enter'||e.code==='Enter'||e.code==='NumpadEnter')return 'publish';
 return null;
}
const macLike=()=>typeof navigator!=='undefined'&&/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent||'');
/** The key shown faintly inside 저장 / 반영 (hidden on phones by CSS): "Ctrl S" / "Ctrl ↵", or ⌘ on a Mac. */
export function ShortcutKey({keys,mac=macLike()}:{keys:'S'|'Enter';mac?:boolean}){
 return <kbd className="lesson-kbd" aria-hidden="true">{mac?'⌘':'Ctrl '}{keys==='Enter'?'↵':'S'}</kbd>;
}
