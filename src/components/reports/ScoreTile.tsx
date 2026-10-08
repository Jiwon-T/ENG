import React from 'react';
export default function ScoreTile({value,label,tone='neutral'}:{value:number|null;label:string;tone?:string}){return <div className={`report-score status-${tone}`}><strong>{value===null?'—':`${value}%`}</strong><span>{label}</span>{value!==null&&<progress max={100} value={Math.min(100,Math.max(0,value))} aria-label={label}/>}</div>;}
