import {useState,type ReactNode} from 'react';
import {chipTimes,isAfterLesson,isBeforeLesson,lessonDurationMinutes,studyAroundLesson} from '../../lib/lessonTimePresets';
/** `lesson`: for 자습, the lesson's times. '수업 전' puts 자습 right before the lesson (ending when it starts) and then the
 *  minute chips count back from the lesson start (+80분 = 80 minutes before); '수업 후' starts it when the lesson ends. */
export default function LessonTimePresets({title,start,end,enabled,normal,lesson,onChange,children}:{title:string;start:string;end:string;enabled:boolean;normal?:{start:string;end:string};lesson?:{start:string;end:string};onChange:(start:string,end:string)=>void;children:ReactNode}){
 const around=(when:'before'|'after')=>lesson?studyAroundLesson(lesson,when):null;
 // Selected only for a complete span; an unfinished one can be completed by pressing the button.
 const before=isBeforeLesson(lesson,start,end),after=isAfterLesson(lesson,start,end);
 const [notice,setNotice]=useState('');
 return <div className="lesson-time-presets"><div className="lesson-time-direct-inputs">{children}</div><div role="group" aria-label={`${title} 시간 프리셋`} className="lesson-time-preset-buttons">{lesson&&(['before','after'] as const).map(when=>{const t=around(when),on=when==='before'?before:after;return <button key={when} type="button" className="lesson-time-preset" disabled={!enabled||!t} aria-pressed={on} title={t?undefined:'수업 시작·종료 시간을 먼저 입력해 주세요'} onClick={()=>{if(!t||on)return;setNotice('');onChange(t.start,t.end);}}>수업 {when==='before'?'전':'후'}</button>;})}<span className="lesson-preset-label">{before?'시작 = 수업 시작 −':'종료 = 시작 +'}</span>
  {normal&&<button type="button" className="lesson-time-preset" disabled={!enabled} onClick={()=>{setNotice('');onChange(normal.start,normal.end);}}>오늘 정규 {normal.start}–{normal.end}</button>}
  {lessonDurationMinutes.map(minutes=><button key={minutes} type="button" disabled={!enabled} aria-pressed={(()=>{const t=chipTimes(minutes,start,end,lesson);return Boolean(start&&t&&t.start===start&&t.end===end);})()} className={`lesson-time-preset ${minutes===80?'is-recommended':''}`} onClick={()=>{
   const t=chipTimes(minutes,start,end,lesson);
   if(!t){setNotice(before?'자정 전으로 넘어가는 시간은 선택할 수 없어요. 수업 시작 시간을 확인해 주세요.':start?'자정을 넘기는 시간은 선택할 수 없어요. 시작 시간을 확인해 주세요.':'시작 시간을 먼저 입력해 주세요.');return;}
   setNotice('');onChange(t.start,t.end);
  }}>{before?'':'+'}{minutes}분{minutes===80&&<span className="sr-only"> · 기본 추천</span>}</button>)}
 </div>{notice&&<p role="alert" className="lesson-time-notice">{notice}</p>}</div>;
}

