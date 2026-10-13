import {CheckCircle2,Clock3,AlertCircle,Pencil,Circle,Play,Hourglass,PauseCircle,CalendarClock,Link2Off} from 'lucide-react';
export type StatusKind='done'|'saved'|'unwritten'|'failed'|'editing'|'running'|'waiting'|'stopped'|'stopPlanned'|'unlinked';
const definitions={done:{label:'반영 완료',tone:'success',Icon:CheckCircle2},saved:{label:'저장됨',tone:'pending',Icon:Clock3},unwritten:{label:'미작성',tone:'neutral',Icon:Circle},failed:{label:'반영 실패',tone:'danger',Icon:AlertCircle},editing:{label:'작성 중',tone:'neutral',Icon:Pencil},
 running:{label:'진행 중',tone:'brand',Icon:Play},waiting:{label:'대기',tone:'pending',Icon:Hourglass},stopped:{label:'중단',tone:'neutral',Icon:PauseCircle},stopPlanned:{label:'중단 예정',tone:'pending',Icon:CalendarClock},unlinked:{label:'앱 미연결',tone:'neutral',Icon:Link2Off}};
/** One icon per status everywhere: 반영 완료 ✓, 저장됨 clock, 미작성 empty circle, 실패 !, 진행 중 play, 대기 hourglass,
 *  중단 pause, 중단 예정 calendar, 앱 미연결 link-off. For chips that are not badges. */
export const statusIcon=(kind:StatusKind)=>definitions[kind].Icon;
export function statusKind(status:{tone:string;text:string}):StatusKind{return status.tone==='green'?'done':status.tone==='red'?'failed':['pink','yellow'].includes(status.tone)?'saved':status.text==='미작성'?'unwritten':'editing';}
export default function StatusBadge({kind,text,compact=false}:{kind:StatusKind;text?:string;compact?:boolean}){
 const {label,tone,Icon}=definitions[kind];return <span className={`workspace-status-badge status-${tone}${compact?' is-compact':''}`} aria-label={text||label}><span className="workspace-status-dot" aria-hidden="true"/><Icon size={12} aria-hidden="true"/><span className={compact?'sr-only':''}>{text||label}</span></span>;
}
