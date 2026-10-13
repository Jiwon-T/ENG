import { WorkspaceDialogEmbedding } from './WorkspaceDialogEmbedding';
import { useContext, useEffect, useRef, type ReactNode } from 'react';
/** `onClose` may be async (it can ask with the app's confirm modal first). */
export default function WorkspaceDialog({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void|Promise<unknown>;children:ReactNode}) {
 const embedding=useContext(WorkspaceDialogEmbedding);
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>open?embedding?.registerClose(onClose):undefined,[embedding?.registerClose,onClose,open]);
 useEffect(()=>{if(embedding)return;const dialog=ref.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();else if(!open&&dialog.open)dialog.close();},[open,Boolean(embedding)]);
 if(embedding)return open ? <WorkspaceDialogEmbedding.Provider value={null}><section aria-label={title}>{children}</section></WorkspaceDialogEmbedding.Provider> : null;
 return <dialog ref={ref} className="workspace-dialog" aria-label={title} onCancel={e=>{e.preventDefault();void onClose();}}><header className="workspace-dialog-header"><h2>{title}</h2><button type="button" className="small-button" onClick={()=>void onClose()} aria-label={`${title} 닫기`}>닫기</button></header><div className="workspace-dialog-scroll" tabIndex={0} role="region" aria-label={`${title} 내용`}>{children}</div></dialog>;
}

