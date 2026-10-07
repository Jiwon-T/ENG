import {Fragment,useId,useRef} from 'react';
import {lessonOptionTone} from '../../lib/lessonOptions';
interface Props {label:string;options:readonly string[];value:string;onChange:(value:string)=>void;disabled?:boolean;splitAt?:number}
export default function ChipGroup({label,options,value,onChange,disabled=false,splitAt}:Props){
 const labelId=useId(),buttons=useRef<(HTMLButtonElement|null)[]>([]);
 const selected=options.indexOf(value),tabIndex=selected<0?0:selected;
 return <div className="lesson-chip-field"><span id={labelId} className="lesson-chip-label">{label}</span>
  <div role="radiogroup" aria-labelledby={labelId} aria-disabled={disabled||undefined} className="lesson-chip-options">
   {options.map((option,index)=><Fragment key={option}>
    {index===splitAt&&<span className="lesson-chip-divider" aria-hidden="true"/>}
    <button ref={element=>{buttons.current[index]=element;}} type="button" role="radio" aria-checked={value===option} disabled={disabled} tabIndex={index===tabIndex?0:-1}
     className={`lesson-option-chip tone-${lessonOptionTone(option)} ${option.startsWith('보강 ')?'is-makeup':''} ${index===splitAt?'is-split-start':''}`}
     onClick={()=>{if(value!==option)onChange(option);}}
     onKeyDown={event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)||event.currentTarget.matches(':disabled'))return;
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+options.length)%options.length;
      buttons.current[next]?.focus();if(value!==options[next])onChange(options[next]);
     }}>{option}</button>
   </Fragment>)}
  </div>
 </div>;
}
