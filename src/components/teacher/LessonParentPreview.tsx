import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {getAttendanceBadgeClass,getDisplayStatus,getStatusBadgeClass} from '../parent/ParentReportView';
import {lessonFeedbackText,parentFeedbackText,percentage} from '../../lib/lessonReportText';
import {studyTimeText} from '../../lib/sessionNumbers';
import {extractAssignmentFromFeedback} from '../../../api/_lib/assignmentExtractor';

// 리포트 미리보기: what the parent and the student will see from the lesson as typed now (nothing is saved). The texts
// come from the same functions the server uses; the report screens themselves are not touched. Loaded lazily (the editors
// import it with lazy() or import()) so the report helpers stay out of the teacher bundle until a preview opens.

function ParentPreview({lesson:d}:{lesson:any}){
 const feedback=parentFeedbackText(d),word=percentage(d.correct,d.total),exam=percentage(d.examCorrect,d.examTotal);
 const times=[d.classSession==='있음'&&['수업 시간',`${d.start||'미입력'} ~ ${d.end||'미입력'}`],d.selfStudy==='있음'&&['자습 시간',studyTimeText(d,' ~ ')]].filter(Boolean) as [string,string][];
 return <div className="lesson-preview-body">
  <div className="lesson-preview-row"><span className={`lesson-preview-badge ${getAttendanceBadgeClass(d.attendance)}`}>{getDisplayStatus(d.attendance)}</span>{times.map(([k,v])=><span key={k} className="lesson-preview-time"><b>{k}</b>{v}</span>)}</div>
  <div className="lesson-preview-grid">{([['태도',d.attitude],['숙제',d.homework],['테스트',d.test]] as const).map(([k,v])=><div key={k} className="lesson-preview-tile"><span>{k}</span><b className={`lesson-preview-badge ${getStatusBadgeClass(v)}`}>{getDisplayStatus(v)}</b></div>)}</div>
  {(word!==null||exam!==null)&&<div className="lesson-preview-grid">{word!==null&&<div className="lesson-preview-tile"><span>단어 점수</span><b>{word}점</b></div>}{exam!==null&&<div className="lesson-preview-tile"><span>내신 대비 점수</span><b>{exam}점</b></div>}</div>}
  <div className="lesson-preview-feedback"><p className="lesson-preview-label">수업 내용 및 피드백</p><p className="lesson-preview-text">{feedback||'아직 입력한 내용이 없어요'}</p></div>
 </div>;
}

/** The card in the student's 학습 리포트 (출결·숙제·단어·내신) and the 과제 the student checks off. */
function StudentPreview({lesson:d}:{lesson:any}){
 const word=percentage(d.correct,d.total),exam=percentage(d.examCorrect,d.examTotal),assignment=extractAssignmentFromFeedback(lessonFeedbackText(d));
 return <div className="lesson-preview-body">
  <div className="lesson-preview-grid is-four">{([['출결',d.attendance||'미확인'],['숙제',d.homework||'미확인'],['단어',word!==null?`${word}점`:'—'],['내신',exam!==null?`${exam}점`:'—']] as const).map(([k,v])=><div key={k} className="lesson-preview-tile"><span>{k}</span><b>{v}</b></div>)}</div>
  <div className="lesson-preview-feedback"><p className="lesson-preview-label">과제 (학생이 완료 표시)</p><p className="lesson-preview-text">{assignment||'과제 없음'}</p></div>
 </div>;
}

/** 학부모 / 학생 tabs over the two previews. */
export function LessonReportPreview({lesson}:{lesson:any}){
 const [tab,setTab]=useState<'parent'|'student'>('parent'),d=lesson||{};
 return <div className="lesson-preview-tabs-wrap">
  <div className="lesson-preview-tabs" role="tablist" aria-label="미리볼 화면">{([['parent','학부모'],['student','학생']] as const).map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
  {tab==='parent'?<ParentPreview lesson={d}/>:<StudentPreview lesson={d}/>}
  <p className="lesson-preview-foot">{tab==='parent'?'학부모 리포트 화면이에요':'학생 앱 학습 리포트예요 · 태도·테스트 평가와 피드백 글은 보이지 않아요'} · 회차·시험범위·선생님 메모는 어디에도 나가지 않아요</p>
 </div>;
}

export default function LessonParentPreview({lesson,studentName,onClose}:{lesson:any;studentName:string;onClose:()=>void}){
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const d=lesson||{};
 return <div className="lesson-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="lesson-preview-title" onClick={onClose}>
  <section className="lesson-preview-sheet" onClick={e=>e.stopPropagation()}>
   <header className="lesson-preview-head"><div><h2 id="lesson-preview-title">리포트 미리보기</h2><p>{studentName||'학생'} · {d.date||'날짜 미입력'} · {d.subject||''}</p></div><button type="button" className="lesson-preview-close" aria-label="닫기" onClick={onClose}><X size={18} aria-hidden="true"/></button></header>
   <p className="lesson-preview-note">지금 입력한 내용 그대로예요. <b>반영</b>해야 학생·학부모에게 보여요.</p>
   <LessonReportPreview lesson={d}/>
  </section>
 </div>;
}
