import {useId} from 'react';
import {Eye,Lock} from 'lucide-react';
import AutoTextarea from './AutoTextarea';
import {AUDIENCE_HINT,AUDIENCE_LABEL,type LessonAudience} from '../../lib/lessonAudience';

// Small tags beside the lesson-journal fields saying who will see them, and the box for what stays in the academy.
export function AudienceTag({to,label}:{to:LessonAudience;label?:string}){
 return <span className={`audience-tag is-${to}`} title={AUDIENCE_HINT[to]}>{to==='teacher'&&<Lock size={10} aria-hidden="true"/>}{label||AUDIENCE_LABEL[to]}<span className="sr-only"> ({AUDIENCE_HINT[to]})</span></span>;
}
export function AudienceLegend(){
 return <span className="audience-legend">보이는 곳<AudienceTag to="all" label="학생 포함 모두"/><AudienceTag to="parent"/><AudienceTag to="teacher"/></span>;
}
/** 시험범위 and 선생님 메모 side by side in one dashed box: never in a report or a text. */
export function TeacherOnlyFields({value,onChange}:{value:{examScope?:string;teacherNote?:string};onChange:(key:'examScope'|'teacherNote',value:string)=>void}){
 const id=useId();
 return <div className="teacher-only-box" role="group" aria-labelledby={id}>
  <p className="teacher-only-title"><Lock size={12} aria-hidden="true"/><span id={id}>선생님만 봐요</span><span className="teacher-only-note">리포트·문자에 안 나가요</span></p>
  <div className="teacher-only-fields">
   <label><span className="lesson-label-line">시험범위</span><AutoTextarea minRows={1} maxRows={4} maxLength={5000} value={value.examScope||''} onChange={e=>onChange('examScope',e.target.value)}/></label>
   <label><span className="lesson-label-line">선생님 메모</span><AutoTextarea minRows={1} maxRows={4} maxLength={5000} placeholder="다음 수업 준비, 상담할 것" value={value.teacherNote||''} onChange={e=>onChange('teacherNote',e.target.value)}/></label>
  </div>
 </div>;
}
/** An item of the ⋯ menu (shown on PCs too, unlike 새로고침·삭제 which have their own buttons there). */
export function LessonPreviewButton({onClick,disabled}:{onClick:()=>void;disabled?:boolean}){
 return <button type="button" className="lesson-more-item lesson-more-always" disabled={disabled} onClick={onClick}><Eye size={15} aria-hidden="true"/>미리보기</button>;
}
