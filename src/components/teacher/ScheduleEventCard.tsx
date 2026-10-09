import {useState} from 'react';
import {SyncStatus,ScheduleStatus,ClassStatus} from './ScheduleStatus';
const SCHEDULE_STATUSES=['예정','변경','완료','취소'];
export interface ScheduleEventCardProps {time:string;title:string;subtitle:string;subtitleFull?:string;kindBadge?:string;scheduleStatus?:string;syncStatus?:string;cancelled?:boolean;onOpen:()=>void;notionUrl?:string;variant?:'dated'|'regular';classState?:string;disabled?:boolean;onStatus?:(status:string)=>void}
export default function ScheduleEventCard({time,title,subtitle,subtitleFull,kindBadge,scheduleStatus,syncStatus,cancelled=false,onOpen,notionUrl,variant='dated',classState,disabled=false,onStatus}:ScheduleEventCardProps){
 const [picking,setPicking]=useState(false);
 const isCancelled=cancelled||scheduleStatus==='취소';
 const separator=subtitle.lastIndexOf(' · '),summary=separator<0?subtitle:subtitle.slice(0,separator),subject=separator<0?'':subtitle.slice(separator+3);
 return <article className={`schedule-event-card variant-${variant}${isCancelled?' is-cancelled':''}`}><button type="button" className="schedule-event-open" disabled={disabled} onClick={onOpen} aria-label={`${title} · ${time} · ${scheduleStatus||classState||''} 열기`}><span className="schedule-event-top"><strong className="schedule-event-time">{time}</strong>{kindBadge&&<span className="schedule-kind">{kindBadge}</span>}</span><span className="schedule-event-title-row"><strong className="schedule-event-title">{title}</strong><SyncStatus value={syncStatus}/></span><span className="schedule-event-bottom"><span className="schedule-event-subtitle" title={subtitleFull||subtitle}><span className="schedule-student-summary">{summary}</span>{subject&&<span className="schedule-event-subject">· {subject}</span>}</span>{variant==='regular'?<ClassStatus value={classState}/>:!onStatus&&<ScheduleStatus value={scheduleStatus}/>}</span></button>
  {/* Status is changed right on the card (saved and published at once) without opening the editor. */}
  {variant!=='regular'&&onStatus&&<div className="schedule-status-pick"><button type="button" className="schedule-status-button" disabled={disabled} aria-haspopup="menu" aria-expanded={picking} aria-label={`${title} 진행 상태 ${scheduleStatus||''} 바꾸기`} onClick={()=>setPicking(v=>!v)}><ScheduleStatus value={scheduleStatus}/></button>
   {picking&&<div className="schedule-status-menu" role="menu">{SCHEDULE_STATUSES.map(s=><button key={s} type="button" role="menuitemradio" aria-checked={s===scheduleStatus} disabled={s===scheduleStatus} onClick={()=>{setPicking(false);onStatus(s);}}><ScheduleStatus value={s}/></button>)}</div>}</div>}
 </article>;
}
