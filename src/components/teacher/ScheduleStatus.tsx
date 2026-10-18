import {CalendarClock,CheckCircle2,XCircle,RefreshCw,PauseCircle,Hourglass} from 'lucide-react';
import {syncStatusMap,scheduleStatusMap,classStatusMap} from '../../lib/statusMap';
import StatusBadge from './StatusBadge';
// Cards show only what needs attention (반영 중·실패 …); a saved or reflected one shows nothing (the app is the record now).
export function SyncStatus({value}:{value?:string}){const status=syncStatusMap(value);return !status||status.quiet||value==='app_saved'?null:<StatusBadge kind={status.kind} text={status.text}/>;}
export function ScheduleStatus({value}:{value?:string}){const status=scheduleStatusMap(value);if(!status)return null;const Icon={cancel:XCircle,done:CheckCircle2,changed:RefreshCw,planned:CalendarClock}[status.icon]||CalendarClock;return <span className={`schedule-status status-${status.tone}`}><Icon size={12} aria-hidden="true"/>{status.text}</span>;}
export function ClassStatus({value}:{value?:string}){const status=classStatusMap(value);if(!status)return null;const Icon=status.icon==='paused'?PauseCircle:Hourglass;return <span className="schedule-class-status"><Icon size={12} aria-hidden="true"/>{status.text}</span>;}
