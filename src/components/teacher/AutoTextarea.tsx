import type {TextareaHTMLAttributes} from 'react';
import {useAutoGrowTextarea} from '../../lib/useAutoGrowTextarea';
export default function AutoTextarea({minRows=2,maxRows=8,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>&{minRows?:number;maxRows?:number}){
 const ref=useAutoGrowTextarea(props.value,minRows,maxRows);
 return <textarea {...props} ref={ref} rows={minRows} className={`auto-lesson-textarea ${props.className||''}`}/>;
}
