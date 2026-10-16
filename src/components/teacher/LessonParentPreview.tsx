import {useEffect} from 'react';
import {X} from 'lucide-react';
import {getAttendanceBadgeClass,getDisplayStatus,getStatusBadgeClass} from '../parent/ParentReportView';
import {parentFeedbackText,percentage} from '../../lib/lessonReportText';
import {studyTimeText} from '../../lib/sessionNumbers';

// 학부모 리포트 미리보기: what the parent will see from the lesson as typed now (nothing is saved). The feedback text comes
// from the same function the server uses; the public report screen itself is not touched. Loaded lazily (the editors import
// it with lazy()) so the report helpers stay out of the teacher bundle until a preview opens.
export default function LessonParentPreview({lesson,studentName,onClose}:{lesson:any;studentName:string;onClose:()=>void}){
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const d=lesson||{},feedback=parentFeedbackText(d),word=percentage(d.correct,d.total),exam=percentage(d.examCorrect,d.examTotal);
 const times=[d.classSession==='있음'&&['수업 시간',`${d.start||'미입력'} ~ ${d.end||'미입력'}`],d.selfStudy==='있음'&&['자습 시간',studyTimeText(d,' ~ ')]].filter(Boolean) as [string,string][];
 return <div className="lesson-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="lesson-preview-title" onClick={onClose}>
  <section className="lesson-preview-sheet" onClick={e=>e.stopPropagation()}>
   <header className="lesson-preview-head"><div><h2 id="lesson-preview-title">학부모 리포트 미리보기</h2><p>{studentName||'학생'} · {d.date||'날짜 미입력'} · {d.subject||''}</p></div><button type="button" className="lesson-preview-close" aria-label="닫기" onClick={onClose}><X size={18} aria-hidden="true"/></button></header>
   <p className="lesson-preview-note">지금 입력한 내용 그대로예요. <b>반영</b>해야 학부모에게 보여요.</p>
   <div className="lesson-preview-body">
    <div className="lesson-preview-row"><span className={`lesson-preview-badge ${getAttendanceBadgeClass(d.attendance)}`}>{getDisplayStatus(d.attendance)}</span>{times.map(([k,v])=><span key={k} className="lesson-preview-time"><b>{k}</b>{v}</span>)}</div>
    <div className="lesson-preview-grid">{([['태도',d.attitude],['숙제',d.homework],['테스트',d.test]] as const).map(([k,v])=><div key={k} className="lesson-preview-tile"><span>{k}</span><b className={`lesson-preview-badge ${getStatusBadgeClass(v)}`}>{getDisplayStatus(v)}</b></div>)}</div>
    {(word!==null||exam!==null)&&<div className="lesson-preview-grid">{word!==null&&<div className="lesson-preview-tile"><span>단어 점수</span><b>{word}점</b></div>}{exam!==null&&<div className="lesson-preview-tile"><span>내신 대비 점수</span><b>{exam}점</b></div>}</div>}
    <div className="lesson-preview-feedback"><p className="lesson-preview-label">수업 내용 및 피드백</p><p className="lesson-preview-text">{feedback||'아직 입력한 내용이 없어요'}</p></div>
   </div>
   <p className="lesson-preview-foot">학생 리포트에는 출결·숙제·점수·과제만 보여요 · 회차·시험범위·선생님 메모는 어디에도 나가지 않아요</p>
  </section>
 </div>;
}
