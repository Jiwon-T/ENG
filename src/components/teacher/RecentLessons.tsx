import {useEffect,useRef,useState} from 'react';
import {ChevronDown,ChevronUp,History,X} from 'lucide-react';

/** One earlier lesson (read:recent-lessons). */
export type RecentLesson={id:string;date:string;start:string;kind:'수업'|'테스트';content:string;assignment:string;teacher:string};
const WEEK='일월화수목금토';
const dayLabel=(date:string)=>{const [,m,d]=date.split('-').map(Number);return `${m}/${d}(${WEEK[new Date(`${date}T00:00:00Z`).getUTCDay()]})`;};
/** 내용에 넣기: into an empty box as it is, else on a new line after what is there (nothing is written over). */
export const appendLessonText=(current:string,text:string)=>{const kept=(current||'').replace(/\s+$/,'');return kept?`${kept}\n${text}`:text;};

/**
 * 수업 일지 › 지난 수업: a chip over 수업 내용 that opens the student's last lessons in the subject (read when opened, not
 * before) — date, 수업 or 테스트, who wrote it, what was taught and the 과제 — each to copy or to add to 수업 내용.
 * The list floats like 이날 앱 학습 (a sheet at the bottom of a phone).
 */
export default function RecentLessons({studentKey,subject,date,excludeId,request,onInsert}:{studentKey:string;subject:string;date:string;excludeId?:string|null;request:(action:string,body?:any)=>Promise<any>;onInsert:(text:string)=>void}){
 const [open,setOpen]=useState(false),[list,setList]=useState<RecentLesson[]|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(''),box=useRef<HTMLSpanElement>(null);
 useEffect(()=>{setOpen(false);setList(null);setError('');},[studentKey,subject,date,excludeId]);
 useEffect(()=>{
  if(!open||list)return;let live=true;
  request('read:recent-lessons',{studentKey,subject,date,...(excludeId?{exclude:excludeId}:{})}).then((r:any)=>{if(live)setList(Array.isArray(r?.lessons)?r.lessons:[]);}).catch(()=>{if(live)setError('지난 수업을 불러오지 못했어요.');});
  return()=>{live=false;};
 },[open,list]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false);};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);};
 },[open]);
 if(!studentKey||!subject)return null;
 const copy=async(l:RecentLesson)=>{try{await navigator.clipboard.writeText(l.content);setCopied(l.id);setTimeout(()=>setCopied(c=>c===l.id?'':c),1500);}catch{setError('복사하지 못했어요. 내용을 길게 눌러 복사해 주세요.');}};
 // inside the 수업 내용 label: a click here must not move the focus to the box
 return <span className="lesson-day-study recent-lessons" ref={box} onClick={e=>e.preventDefault()}>
  <button type="button" className="lesson-day-study-chip" aria-expanded={open} onClick={()=>setOpen(o=>!o)}><History size={12} aria-hidden="true"/>지난 수업{open?<ChevronUp size={12} aria-hidden="true"/>:<ChevronDown size={12} aria-hidden="true"/>}</button>
  {open&&<div className="lesson-day-study-pop" role="dialog" aria-label="지난 수업">
   <div className="lesson-day-study-head"><b>지난 수업 · {subject}</b><button type="button" aria-label="닫기" onClick={()=>setOpen(false)}><X size={14} aria-hidden="true"/></button></div>
   {error&&<p className="recent-lessons-note text-rose-600">{error}</p>}
   {!list&&!error&&<p className="recent-lessons-note">불러오는 중…</p>}
   {list&&!list.length&&<p className="recent-lessons-note">지난 수업이 없어요.</p>}
   {list&&list.length>0&&<ul>{list.map(l=><li key={l.id} className="recent-lesson">
    <span className="recent-lesson-head"><span className="lesson-day-study-meta">{dayLabel(l.date)}{l.start?` ${l.start}`:''} · {l.kind} · {l.teacher}</span>
     <span className="recent-lesson-actions"><button type="button" className="lesson-day-study-fill is-plain" disabled={!l.content} onClick={()=>void copy(l)}>{copied===l.id?'복사됨':'복사'}</button><button type="button" className="lesson-day-study-fill" disabled={!l.content} onClick={()=>{onInsert(l.content);setOpen(false);}}>내용에 넣기</button></span></span>
    <span className="recent-lesson-content">{l.content||'(수업 내용 없음)'}</span>
    {l.assignment&&<span className="lesson-day-study-meta recent-lesson-assignment">과제: {l.assignment}</span>}
   </li>)}</ul>}
  </div>}
 </span>;
}
