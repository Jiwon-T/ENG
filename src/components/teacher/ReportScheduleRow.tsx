import { formatScheduleDateTime } from '../../lib/reportDateUtils';
export default function ReportScheduleRow({schedule}:{schedule:any}) {
 const {dateStr,timeStr}=formatScheduleDateTime(schedule.startAt,schedule.endAt);
 return <div className="review-row"><p className="font-semibold">{schedule.title} <span className="text-slate-400 font-normal">· {schedule.status}</span></p><p className="text-slate-500">{dateStr}{timeStr&&<> · {timeStr}</>}</p>{schedule.notice&&<p className="whitespace-pre-wrap">{schedule.notice}</p>}</div>;
}
