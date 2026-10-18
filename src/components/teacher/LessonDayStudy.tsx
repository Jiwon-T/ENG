import {useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronUp,Smartphone,X} from 'lucide-react';

/** One app session of the lesson day (summary fields from read:lesson-day-study). */
export type DayStudySession={id:string;wordbookTitle:string;type:string;category:string;createdAt:string|null;duration:number|null;score:number|null;totalItems:number|null;dayStart:number|null;dayEnd:number|null;incorrectCount:number;wrongWords:string[]};
const MODES:Record<string,string>={test:'단어 테스트',quiz:'객관식 퀴즈',flashcard:'플래시카드',match:'매치 게임',conjugation:'3단 변화'};
const CATEGORIES:Record<string,string>={grammar:'문법',exam:'시험 대비'};
const pad=(n:number)=>String(n).padStart(2,'0');
export const dayStudyLabel=(s:DayStudySession)=>CATEGORIES[s.category]||MODES[s.type]||'학습';
export const dayStudyRange=(s:DayStudySession)=>s.dayStart?` · DAY ${pad(s.dayStart)}${s.dayEnd&&s.dayEnd!==s.dayStart?`~${pad(s.dayEnd)}`:''}`:'';
/** A session that has a score out of a count can fill 테스트 점수 (오답 = 문항 − 정답). */
export const dayStudyScore=(s:DayStudySession)=>typeof s.score==='number'&&typeof s.totalItems==='number'&&s.totalItems>0&&s.score>=0&&s.score<=s.totalItems?{wrong:s.totalItems-s.score,total:s.totalItems}:null;

// The same student and day read again within a minute reuses the answer (switching students back and forth); after that
// it is read again, so a test the student takes during the lesson shows up.
const cache=new Map<string,{at:number;list:Promise<DayStudySession[]>}>();

/**
 * 수업 일지 › 이날 앱 학습: a small chip (in a row that is already there, so the form never grows) shown only when the
 * student has app sessions that day; it opens a floating list. Nothing is filled by itself: '점수로 넣기' is in the list
 * only, for the teacher who wants that score in 테스트 점수. Any teacher of the student sees it, whatever the subject.
 */
export default function LessonDayStudy({studentKey,date,request,onFill}:{studentKey:string;date:string;request:(action:string,body?:any)=>Promise<any>;onFill:(score:{wrong:number;total:number;word:boolean})=>void}){
 const [sessions,setSessions]=useState<DayStudySession[]>([]),[open,setOpen]=useState(false),box=useRef<HTMLSpanElement>(null);
 useEffect(()=>{
  setOpen(false);setSessions([]);
  if(!studentKey||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  let live=true;const key=`${studentKey}:${date}`,hit=cache.get(key);
  const list=hit&&Date.now()-hit.at<60_000?hit.list:request('read:lesson-day-study',{studentKey,date}).then((r:any)=>Array.isArray(r?.sessions)?r.sessions as DayStudySession[]:[]).catch(()=>{cache.delete(key);return [] as DayStudySession[];});
  if(list!==hit?.list)cache.set(key,{at:Date.now(),list});
  void list.then(found=>{if(live)setSessions(found);});
  return()=>{live=false;};
 },[studentKey,date]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);};
 },[open]);
 if(!sessions.length)return null;
 const [,month,day]=date.split('-').map(Number);
 return <span className="lesson-day-study" ref={box}>
  <button type="button" className="lesson-day-study-chip" aria-expanded={open} onClick={()=>setOpen(o=>!o)}><Smartphone size={12} aria-hidden="true"/>이날 앱 학습 {sessions.length}건{open?<ChevronUp size={12} aria-hidden="true"/>:<ChevronDown size={12} aria-hidden="true"/>}</button>
  {open&&<div className="lesson-day-study-pop" role="dialog" aria-label="이날 앱 학습">
   <div className="lesson-day-study-head"><b>{month}/{day} 앱 학습</b><button type="button" aria-label="닫기" onClick={()=>setOpen(false)}><X size={14} aria-hidden="true"/></button></div>
   <ul>{sessions.map(s=>{const score=dayStudyScore(s),time=s.createdAt?new Date(s.createdAt).toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}):'';
    return <li key={s.id}>
     <span className={`lesson-day-study-kind${s.type==='test'?' is-test':''}`}>{dayStudyLabel(s)}</span>
     <span className="lesson-day-study-main"><span className="lesson-day-study-title">{s.wordbookTitle}{dayStudyRange(s)}</span>
      <span className="lesson-day-study-meta">{[time,s.duration?`${Math.max(1,Math.round(s.duration/60))}분`:'',s.wrongWords.length?`틀린 단어 ${s.wrongWords.join(', ')}${s.incorrectCount>s.wrongWords.length?` 외 ${s.incorrectCount-s.wrongWords.length}개`:''}`:''].filter(Boolean).join(' · ')}</span></span>
     {typeof s.score==='number'&&typeof s.totalItems==='number'&&s.totalItems>0&&<b className="lesson-day-study-score">{s.score}/{s.totalItems}</b>}
     {score&&<button type="button" className="lesson-day-study-fill" onClick={()=>{onFill({...score,word:s.category==='word'});setOpen(false);}}>점수로 넣기</button>}
    </li>;})}</ul>
  </div>}
 </span>;
}
