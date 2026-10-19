import type {ReactNode} from 'react';
import {Plus} from 'lucide-react';
export type ScheduleView='dated'|'regular'|'classes';
/** `extra`: shown before the add button (내보내기). */
export default function ScheduleViewHeader({view,onView,count,onCreate,disabled,extra}:{view:ScheduleView;onView:(view:ScheduleView)=>void;count:number;onCreate:()=>void;disabled:boolean;extra?:ReactNode}){
 return <div className="schedule-view-header"><div className="lesson-mode-switch" role="group" aria-label="시간표 보기">{([['dated','이번 주 일정'],['regular','정규 시간표'],['classes',`반 관리 ${count}`]] as const).map(([key,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>onView(key)}>{label}</button>)}</div><span className="schedule-view-actions">{extra}<button type="button" className="primary-button" disabled={disabled} onClick={onCreate}><Plus size={16}/>{view==='dated'?'일정 추가':view==='regular'?'정규 수업 추가':'새 반'}</button></span></div>;
}
