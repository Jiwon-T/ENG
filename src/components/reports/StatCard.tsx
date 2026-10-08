import React from 'react';
import type {ReactNode} from 'react';
export default function StatCard({label,value,caption}:{label:string;value:ReactNode;caption?:string}){return <div className="report-stat"><span>{label}</span><strong>{value}</strong>{caption&&<small>{caption}</small>}</div>;}
