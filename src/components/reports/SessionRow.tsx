import React from 'react';
import type {ReactNode} from 'react';
import {Trophy,CheckCircle2} from 'lucide-react';
export default function SessionRow({test,title,range,meta,score,children}:{key?:string;test:boolean;title:string;range:string;meta:string;score:ReactNode;children?:ReactNode}){const Icon=test?Trophy:CheckCircle2;return <article className="report-session"><div className="report-session-heading"><Icon size={20} aria-hidden="true"/><div><strong>{title}</strong>{range&&<span className="report-range">{range}</span>}<p>{meta}</p></div>{score}</div>{children}</article>;}
