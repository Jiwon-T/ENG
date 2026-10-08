import {Calendar,CheckCircle2,XCircle} from 'lucide-react';
import { formatScheduleDateTime } from '../../lib/reportDateUtils';
export default function ReportScheduleRow({schedule,variant='public'}:{schedule:any;variant?:'public'|'teacher'}) {
 const {dateStr,timeStr}=formatScheduleDateTime(schedule.startAt,schedule.endAt);
 if(variant==='teacher'){const Icon=schedule.status==='취소'?XCircle:schedule.status==='완료'?CheckCircle2:Calendar;return <article className={`report-preview-schedule${schedule.status==='취소'?' is-cancelled':''}`}><header><strong>{schedule.title}</strong><span><Icon size={14} aria-hidden="true"/>{schedule.status}</span></header><p>{dateStr}{timeStr&&` · ${timeStr}`}</p><small>{schedule.subject} · {schedule.kind||schedule.type||'일정'}</small>{schedule.notice&&<p className="whitespace-pre-wrap">{schedule.notice}</p>}</article>;}
 return <div className="review-row"><p className="font-semibold">{schedule.title} <span className="text-slate-400 font-normal">· {schedule.status}</span></p><p className="text-slate-500">{dateStr}{timeStr&&<> · {timeStr}</>}</p>{schedule.notice&&<p className="whitespace-pre-wrap">{schedule.notice}</p>}</div>;
}
