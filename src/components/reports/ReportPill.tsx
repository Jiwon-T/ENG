import React from 'react';
// Teacher-only mirror of ParentReportView attendance classes; public code is unchanged.
export default function ReportPill({text,attendance=false}:{text:string;attendance?:boolean}){const color=attendance?(text.includes('출석')?'bg-emerald-500 text-white':text.includes('지각')?'bg-amber-500 text-white':text.includes('결석')?'bg-rose-500 text-white':'bg-slate-100 text-slate-600 border border-slate-200'):'bg-slate-100 text-slate-600';return <span className={`report-public-pill ${color}`}>{text}</span>;}
