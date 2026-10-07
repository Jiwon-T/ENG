import type {ReactNode} from 'react';
export default function LessonActionBar({status,reason,children,refresh}:{status:{text:string;tone:string};reason?:string;children:ReactNode;refresh?:ReactNode}){
 return <div className="lesson-action-bar" aria-label="현재 일지 저장과 반영">
  <div className="lesson-action-state"><span role="status"><span aria-hidden="true" className={`lesson-status-dot status-${status.tone}`}/>{status.text}</span>{reason&&<p className="lesson-action-reason">{reason}</p>}</div>
  <div className="lesson-action-buttons">{children}</div>{refresh&&<div className="lesson-action-refresh">{refresh}</div>}
 </div>;
}
