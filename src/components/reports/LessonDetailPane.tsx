import React from 'react';
import type {ReactNode} from 'react';
export default function LessonDetailPane({date,subject,attendance,children}:{date:string;subject:string;attendance:string;children:ReactNode}){return <article className="report-lesson-detail"><header><div><small>수업 날짜</small><h3>{date}</h3></div><span>{attendance}</span><span>{subject} · 수업</span></header>{children}</article>;}
