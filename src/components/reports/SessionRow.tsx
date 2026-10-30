import React from 'react';
import type {ReactNode} from 'react';
import {Trophy,CheckCircle2} from 'lucide-react';
export default function SessionRow({test,title,range,tag,meta,score,action,children}:{key?:string;test:boolean;title:string;range:string;tag?:ReactNode;meta:string;score:ReactNode;action?:ReactNode;children?:ReactNode}){const Icon=test?Trophy:CheckCircle2;return <article className="report-session"><div className="report-session-heading"><Icon size={20} aria-hidden="true"/><div><strong>{title}</strong>{range&&<span className="report-range">{range}</span>}{tag}<p>{meta}</p></div>{score}{action}</div>{children}</article>;}
