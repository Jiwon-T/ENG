import {CheckCircle2,Clock3,AlertCircle,Pencil,MinusCircle} from 'lucide-react';
export type StatusKind='done'|'saved'|'unwritten'|'failed'|'editing';
const definitions={done:{label:'반영 완료',tone:'success',Icon:CheckCircle2},saved:{label:'저장됨',tone:'pending',Icon:Clock3},unwritten:{label:'미작성',tone:'neutral',Icon:MinusCircle},failed:{label:'반영 실패',tone:'danger',Icon:AlertCircle},editing:{label:'작성 중',tone:'neutral',Icon:Pencil}};
export function statusKind(status:{tone:string;text:string}):StatusKind{return status.tone==='green'?'done':status.tone==='red'?'failed':['pink','yellow'].includes(status.tone)?'saved':status.text==='미작성'?'unwritten':'editing';}
export default function StatusBadge({kind,text,compact=false}:{kind:StatusKind;text?:string;compact?:boolean}){
 const {label,tone,Icon}=definitions[kind];return <span className={`workspace-status-badge status-${tone}${compact?' is-compact':''}`} aria-label={text||label}><span className="workspace-status-dot" aria-hidden="true"/><Icon size={12} aria-hidden="true"/><span className={compact?'sr-only':''}>{text||label}</span></span>;
}
