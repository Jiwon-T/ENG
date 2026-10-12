import {useEffect,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';

const label=(d:string|null)=>d?d.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/,(_,y,m,day)=>`${y}.${Number(m)}.${Number(day)}`):'—';
/** 등록일 at a glance: each subject's start (and stop) date, read from the enrollment; edited in 수강·담당·반 관리. */
export default function EnrollmentDates({studentKey}:{studentKey:string}){
 const [subjects,setSubjects]=useState<any[]|null>(null);
 useEffect(()=>{let live=true;setSubjects(null);
  teacherAuthenticatedRequest<any>(auth,'/api/teacher/workspace?'+new URLSearchParams({action:'student-enrollment',studentKey}))
   .then(r=>{if(live)setSubjects(r.ok&&r.data?.ok?(r.data.record?.subjects||r.data.subjects||[]).filter((s:any)=>s.status):[]);}).catch(()=>{if(live)setSubjects([]);});
  return()=>{live=false;};},[studentKey]);
 if(!subjects?.length)return null;
 return <div className="enrollment-dates" aria-label="과목별 등록일">
  <span className="enrollment-dates-title"><CalendarDays size={14} aria-hidden="true"/>등록일</span>
  {subjects.map((s:any)=><span key={s.subject} className={'enrollment-date'+(s.status==='중단'?' is-stopped':'')}><b>{s.subject}</b>{label(s.startDate)}{s.status==='중단'&&s.endDate?` ~ ${label(s.endDate)} 중단`:s.status!=='등록'?` · ${s.status}`:''}</span>)}
  <span className="enrollment-dates-hint">수정은 ‘수강·담당·반 관리’ 탭에서</span>
 </div>;
}
