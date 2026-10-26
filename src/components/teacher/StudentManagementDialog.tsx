import {createStudentDialogNavigation,type PanelClose} from '../../lib/studentDialogNavigation';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import WorkspaceDialog from './WorkspaceDialog';
import { WorkspaceDialogEmbedding } from './WorkspaceDialogEmbedding';
export const studentManagementTabs = (canManage: boolean) => [
 { id: 'review', label: '리포트 확인' }, { id: 'lesson', label: '수업 작성' }, { id: 'message', label: '보호자 문자' },
 ...(canManage ? [{ id: 'profile', label: '정보 수정' }, { id: 'admission', label: '입학·상담' }, { id: 'enrollment', label: '수강·담당·반 관리' }] : []),
];
export default function StudentManagementDialog({ name, canManage, onClose, onSelect, render, notice, busy = false, initialTab = 'review', inline = false, registerAttempt, headerExtra, summary, noLesson = false }: {
 name: string; canManage: boolean; headerExtra?: ReactNode; summary?: ReactNode; onClose: () => void; onSelect: (tab: string) => void;
 /** the 수업 일지's 학생 정보 drawer: no 수업 작성 (the 일지 is already open) */ noLesson?: boolean;
 render: (tab: string, leave: () => void, headerId: string) => ReactNode; notice?: string; busy?: boolean; initialTab?: string; inline?: boolean; registerAttempt?: (attempt:(action:()=>void)=>void)=>()=>void;
}) {
 const id = useId(), tabs = studentManagementTabs(canManage);
 const [selected, setSelected] = useState(initialTab);
 const active = tabs.some(t => t.id === selected) ? selected : 'review';
 const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
 // Inline, closing 수업 작성 (opened from the summary card) returns to the report instead of closing the student.
 const backRef = useRef<() => boolean>(() => false); backRef.current = () => { if (!inline || active !== 'lesson') return false; setSelected('review'); return true; };
 const navigationRef = useRef<ReturnType<typeof createStudentDialogNavigation> | null>(null);
 if(!navigationRef.current) navigationRef.current = createStudentDialogNavigation(() => { if (!backRef.current()) onCloseRef.current(); });
 const navigation = navigationRef.current;
 const registerClose = useCallback((close: PanelClose) => navigation.registerClose(close), [navigation]);
 useEffect(()=>registerAttempt?.(action=>void navigation.attempt(action,busy)),[registerAttempt,navigation,busy]);
 function leave() { navigation.leave(); }
 function attempt(action: () => void) { void navigation.attempt(action, busy); }
 function select(tab: string) { if (tab === active) return; attempt(() => { onSelect(tab); setSelected(tab); }); }
 // Inline, 수업 작성 is the summary card's main action, so the tab row holds only the views.
 const row = inline ? tabs.filter(t => t.id !== 'lesson') : tabs;
 const content=<>
  <div role="tablist" aria-label="학생 관리 기능" className="student-management-tabs">{row.map((t,index) => <button key={t.id} id={`${id}-${t.id}-tab`} type="button" role="tab" aria-selected={active === t.id} aria-controls={`${id}-panel`} tabIndex={active === t.id ? 0 : -1} disabled={busy} onClick={() => select(t.id)} onKeyDown={e => { const next = e.key === 'ArrowRight' ? (index+1)%row.length : e.key === 'ArrowLeft' ? (index-1+row.length)%row.length : e.key === 'Home' ? 0 : e.key === 'End' ? row.length-1 : -1; if (next < 0) return; e.preventDefault(); document.getElementById(`${id}-${row[next].id}-tab`)?.focus(); select(row[next].id); }}>{t.label}</button>)}</div>
  {notice && <p role="status" className="text-sm text-slate-600 my-3">{notice}</p>}
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}-tab`}>
   <WorkspaceDialogEmbedding.Provider value={{registerClose}}><div key={active}>{render(active, leave, `${id}-report-tools`)}</div></WorkspaceDialogEmbedding.Provider>
  </div>
 </>;
 return inline?<section className="student-detail-panel"><header className="student-detail-header student-summary">
  <div className="student-summary-who"><h2>{name}</h2>{summary}</div>
  <div className="student-summary-actions"><div id={`${id}-report-tools`} className="student-detail-tools"/>{!noLesson&&<button type="button" id={`${id}-lesson-tab`} className="primary-button" aria-pressed={active==='lesson'} disabled={busy} onClick={()=>select('lesson')}>수업 작성</button>}{/* the drawer has its own ✕ */}{!noLesson&&<button type="button" className="small-button" onClick={()=>attempt(onClose)}>닫기</button>}</div>
  {headerExtra&&<div className="student-summary-links">{headerExtra}</div>}
 </header>{content}</section>:<WorkspaceDialog open title={`${name} · 학생 관리`} onClose={()=>attempt(onClose)}>{content}</WorkspaceDialog>;
}
