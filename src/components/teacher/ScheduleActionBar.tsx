import type {ReactNode} from 'react';
import LessonActionBar from './LessonActionBar';
import {syncStatusMap} from '../../lib/statusMap';
export default function ScheduleActionBar({syncStatus,children,reason}:{syncStatus?:string;children:ReactNode;reason?:string}){
 const state=syncStatusMap(syncStatus);
 return <div className={`schedule-action-shell${state?.quiet?' is-synced':''}`} title={state?.quiet?'Notion 반영 완료':undefined}><LessonActionBar status={{text:state?.text||'작성 중',tone:state?.kind==='done'?'green':state?.kind==='failed'?'red':state?.kind==='saved'?'yellow':'grey'}} reason={reason}>{children}</LessonActionBar></div>;
}
