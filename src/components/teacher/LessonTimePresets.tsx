import {useState,type ReactNode} from 'react';
import {lessonDurationMinutes,timeAfterMinutes} from '../../lib/lessonTimePresets';
export default function LessonTimePresets({title,start,end,enabled,normal,onChange,children}:{title:string;start:string;end:string;enabled:boolean;normal?:{start:string;end:string};onChange:(start:string,end:string)=>void;children:ReactNode}){
 const [notice,setNotice]=useState('');
 return <div className="lesson-time-presets"><div role="group" aria-label={`${title} 시간 프리셋`} className="lesson-time-preset-buttons">
  {normal&&<button type="button" className="lesson-time-preset" disabled={!enabled} onClick={()=>{setNotice('');onChange(normal.start,normal.end);}}>오늘 정규 {normal.start}–{normal.end}</button>}
  {lessonDurationMinutes.map(minutes=><button key={minutes} type="button" disabled={!enabled} aria-pressed={Boolean(start)&&timeAfterMinutes(start,minutes)===end} className={`lesson-time-preset ${minutes===80?'is-recommended':''}`} onClick={()=>{
   const next=timeAfterMinutes(start,minutes);if(!next){setNotice(start?'자정을 넘기는 시간은 선택할 수 없어요. 시작 시간을 확인해 주세요.':'시작 시간을 먼저 입력해 주세요.');return;}
   setNotice('');onChange(start,next);
  }}>+{minutes}분{minutes===80&&<span className="sr-only"> · 기본 추천</span>}</button>)}
 </div><p className="lesson-time-current">{title} {start||'시작 미입력'}–{end||'종료 미입력'}</p>{notice&&<p role="alert" className="lesson-time-notice">{notice}</p>}
 <div className="lesson-time-direct-inputs">{children}</div></div>;
}

