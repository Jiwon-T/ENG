import {Link2,Link2Off,CalendarClock,MapPin} from 'lucide-react';
import StatusBadge from './StatusBadge';
import {plannedStopOf} from '../../lib/studentOverview';
import {studentCampusLabel} from '../../lib/campus';
/** 학생 관리 summary line under the name: subjects, today's lesson log, and (for those who cannot link accounts) one link state. */
export default function StudentSummary({student,unwritten,lessonToday,showLink}:{student:any;unwritten:boolean;lessonToday:boolean;showLink:boolean}){
 if(!student)return null;
 const linked=Boolean(student.accountLinked??student.linkedFirebaseUid);
 const subjects=(student.subjects||[]).map((s:any)=>`${s.subject} · ${s.status}`).join(' / ');
 return <div className="student-summary-meta">
  {subjects&&<span className="student-summary-subjects">{subjects}</span>}
  {studentCampusLabel(student)&&<span className="student-summary-chip is-campus"><MapPin size={13} aria-hidden="true"/>{studentCampusLabel(student)}</span>}
  {unwritten?<StatusBadge kind="unwritten" text="오늘 일지 미작성"/>:lessonToday&&<StatusBadge kind="done" text="오늘 일지 작성됨"/>}
  {showLink&&<span className={'student-summary-chip'+(linked?' is-linked':'')}>{linked?<Link2 size={13} aria-hidden="true"/>:<Link2Off size={13} aria-hidden="true"/>}{linked?'앱 계정 연결됨':'앱 계정 미연결'}</span>}
  {plannedStopOf(student)&&<span className="student-summary-chip is-stop"><CalendarClock size={13} aria-hidden="true"/>{plannedStopOf(student)!.slice(5).replace('-','/').replace(/^0/,'')} 중단 예정</span>}
  {!student.hasGuardianContact&&<span className="student-summary-chip">보호자 연락처 없음</span>}
 </div>;
}
