import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,Search} from 'lucide-react';
import {studentSearchResults} from '../../lib/koreanSearch';
interface Props {students:readonly {studentKey:string;studentDisplayName:string}[];value:string;onChange:(key:string)=>void;disabled?:boolean;todayKeys?:readonly string[];filters?:{label:string;keys:readonly string[]}[]}
export default function StudentCombobox({students,value,onChange,disabled=false,todayKeys=[],filters}:Props){
 const id=useId(),input=useRef<HTMLInputElement>(null),composing=useRef(false);
 const selected=students.find(student=>student.studentKey===value)?.studentDisplayName||'';
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0),[space,setSpace]=useState({height:280,above:false});
 const [filterIndex,setFilterIndex]=useState(0);
 const filtered=filters?students.filter(s=>filters[filterIndex]?.keys.includes(s.studentKey)):students;
 const results=studentSearchResults(filtered,query,todayKeys),current=new Set(todayKeys),index=Math.min(active,Math.max(0,results.length-1));
 useEffect(()=>{setOpen(false);setQuery('');setActive(0);},[value]);
 useEffect(()=>{
  if(!open)return;
  const fit=()=>{const rect=input.current?.getBoundingClientRect();if(!rect)return;const viewport=window.visualViewport;const top=viewport?.offsetTop||0,bottom=top+(viewport?.height||window.innerHeight);const below=bottom-rect.bottom-12,above=rect.top-top-12;const useAbove=below<140&&above>below;setSpace({above:useAbove,height:Math.max(0,Math.min(280,useAbove?above:below))});};
  fit();window.addEventListener('resize',fit);window.addEventListener('scroll',fit,true);window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);
  return()=>{window.removeEventListener('resize',fit);window.removeEventListener('scroll',fit,true);window.visualViewport?.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('scroll',fit);};
 },[open]);
 useEffect(()=>{if(open)document.getElementById(`${id}-option-${index}`)?.scrollIntoView({block:'nearest'});},[open,index,id]);
 const choose=(key:string)=>{setOpen(false);setQuery('');onChange(key);};
 return <div className="student-combobox" data-placement={space.above?'above':'below'}>
  <label htmlFor={`${id}-input`}>학생</label><div className="student-combobox-input"><Search size={15} aria-hidden="true"/><input ref={input} id={`${id}-input`} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open&&results.length?`${id}-option-${index}`:undefined} autoComplete="off" disabled={disabled} placeholder="학생 이름·초성 검색" value={open?query:selected}
   onFocus={()=>{setQuery('');setActive(0);setOpen(true);}} onClick={()=>setOpen(true)} onBlur={()=>setOpen(false)}
   onChange={event=>{setQuery(event.target.value);setActive(0);setOpen(true);}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
   onKeyDown={event=>{
    if(event.nativeEvent.isComposing||composing.current||event.nativeEvent.keyCode===229)return;
    if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open){setOpen(true);setActive(0);}else setActive((index+(event.key==='ArrowDown'?1:-1)+Math.max(1,results.length))%Math.max(1,results.length));}
    if(event.key==='Enter'&&open){event.preventDefault();if(results[index])choose(results[index].studentKey);}
   }}/><ChevronDown size={15} aria-hidden="true"/></div>
  {open&&<div className="student-combobox-popup" style={{'--student-list-height':`${space.height}px`} as any}>
   {filters&&<div className="report-picker-filters" role="group" aria-label="학생 수강 상태">{filters?.map((filter,i)=><button type="button" key={filter.label} aria-pressed={i===filterIndex} onMouseDown={e=>e.preventDefault()} onClick={()=>{setFilterIndex(i);setActive(0);}}>{filter.label}</button>)}</div>}
   <div id={`${id}-list`} role="listbox" aria-label="학생 검색 결과">{results.map((student,i)=>{const isToday=current.has(student.studentKey);return <div key={student.studentKey}>
    {(i===0||isToday!==current.has(results[i-1].studentKey))&&<div role="presentation" className="student-combobox-group">{isToday?'오늘':'학생'}</div>}
    <div id={`${id}-option-${i}`} role="option" aria-selected={value===student.studentKey} className={`student-combobox-option ${i===index?'is-active':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(student.studentKey)}>{student.studentDisplayName}{isToday&&<span className="student-today-tag">오늘</span>}</div>
   </div>;})}</div>{!results.length&&<p role="status" className="student-combobox-empty">일치하는 학생이 없어요</p>}
  </div>}
 </div>;
}
