import {registrationCampuses} from '../../lib/studentRegistration';

/** One campus out of 용죽·이충·고덕 (or the given subset); pressing the chosen one again clears it. */
export default function CampusToggle({value,onChange,options=registrationCampuses,label='캠퍼스',disabled=false}:{value?:string|null;onChange:(campus:string|null)=>void;options?:readonly string[];label?:string;disabled?:boolean}){
 return <div className="campus-toggle" role="group" aria-label={label}>{options.map(campus=><button key={campus} type="button" disabled={disabled} aria-pressed={value===campus} onClick={()=>onChange(value===campus?null:campus)}>{campus}</button>)}</div>;
}
