import {Check,CalendarClock,CheckCircle2,XCircle,RefreshCw,PauseCircle,Clock3} from 'lucide-react';
import {syncStatusMap,scheduleStatusMap,classStatusMap} from '../../lib/statusMap';
import StatusBadge from './StatusBadge';
export function SyncStatus({value}:{value?:string}){const status=syncStatusMap(value);return !status?null:status.quiet?<span className="schedule-sync-done" title={status.text} aria-label={status.text}><Check size={14} aria-hidden="true"/></span>:<StatusBadge kind={status.kind} text={status.text}/>;}
export function ScheduleStatus({value}:{value?:string}){const status=scheduleStatusMap(value);if(!status)return null;const Icon={cancel:XCircle,done:CheckCircle2,changed:RefreshCw,planned:CalendarClock}[status.icon]||CalendarClock;return <span className={`schedule-status status-${status.tone}`}><Icon size={12} aria-hidden="true"/>{status.text}</span>;}
export function ClassStatus({value}:{value?:string}){const status=classStatusMap(value);if(!status)return null;const Icon=status.icon==='paused'?PauseCircle:Clock3;return <span className="schedule-class-status"><Icon size={12} aria-hidden="true"/>{status.text}</span>;}
