import { WorkspaceDialogEmbedding } from './WorkspaceDialogEmbedding';
import { useContext, useEffect, useRef, type ReactNode } from 'react';
export default function WorkspaceDialog({open,title,onClose,children}:{open:boolean;title:string;onClose:()=>void;children:ReactNode}) {
 const embedding=useContext(WorkspaceDialogEmbedding);
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>open?embedding?.registerClose(onClose):undefined,[embedding?.registerClose,onClose,open]);
 useEffect(()=>{if(embedding)return;const dialog=ref.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();else if(!open&&dialog.open)dialog.close();},[open,Boolean(embedding)]);
 if(embedding)return open ? <WorkspaceDialogEmbedding.Provider value={null}><section aria-label={title}>{children}</section></WorkspaceDialogEmbedding.Provider> : null;
 return <dialog ref={ref} className="workspace-dialog" aria-label={title} onCancel={e=>{e.preventDefault();onClose();}}><header className="workspace-dialog-header"><h2>{title}</h2><button type="button" className="small-button" onClick={onClose} aria-label={`${title} 닫기`}>닫기</button></header>{children}</dialog>;
}
