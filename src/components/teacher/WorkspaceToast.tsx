import {createPortal} from 'react-dom';
import {CheckCircle2,AlertCircle,X} from 'lucide-react';
// Timing lives in useWorkspaceNotice; this only picks the look.
const problem=/실패|오류|불명확|못했|확인해|없습니다|필요합니다|다시 시도|새로고침/;
/** Small floating notice at the bottom of the screen instead of a wide banner above the page. */
export default function WorkspaceToast({message,onClose}:{message:string;onClose:()=>void}){
 const warn=problem.test(message);
 return createPortal(<div role={warn?'alert':'status'} className={'ws-toast'+(warn?' is-warn':'')}>
  {warn?<AlertCircle size={18} aria-hidden="true"/>:<CheckCircle2 size={18} aria-hidden="true"/>}
  <span>{message}</span>
  <button type="button" aria-label="알림 닫기" onClick={onClose}><X size={16} aria-hidden="true"/></button>
 </div>,document.body);
}
