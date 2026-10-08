import ReportPill from './ReportPill';
import React from 'react';
import type {ReactNode} from 'react';
export default function LessonDetailPane({date,subject,attendance,children}:{date:string;subject:string;attendance:string;children:ReactNode}){return <article className="report-lesson-detail"><header><div><small>수업 날짜</small><h3>{date}</h3></div><ReportPill text={attendance} attendance/><ReportPill text={`${subject} · 수업`}/></header>{children}</article>;}
