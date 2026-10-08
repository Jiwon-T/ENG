import {createStudentDialogNavigation} from '../../lib/studentDialogNavigation';
import { useCallback, useId, useRef, useState, type ReactNode } from 'react';
import WorkspaceDialog from './WorkspaceDialog';
import { WorkspaceDialogEmbedding } from './WorkspaceDialogEmbedding';
export const studentManagementTabs = (canManage: boolean) => [
 { id: 'review', label: '리포트 확인' }, { id: 'lesson', label: '수업 작성' }, { id: 'message', label: '보호자 문자' },
 ...(canManage ? [{ id: 'profile', label: '정보 수정' }, { id: 'enrollment', label: '수강·담당·반 관리' }] : []),
];
export default function StudentManagementDialog({ name, canManage, onClose, onSelect, render, notice, busy = false, initialTab = 'review' }: {
 name: string; canManage: boolean; onClose: () => void; onSelect: (tab: string) => void;
 render: (tab: string, leave: () => void) => ReactNode; notice?: string; busy?: boolean; initialTab?: string;
}) {
 const id = useId(), tabs = studentManagementTabs(canManage);
 const [selected, setSelected] = useState(initialTab);
 const active = tabs.some(t => t.id === selected) ? selected : 'review';
 const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
 const navigationRef = useRef<ReturnType<typeof createStudentDialogNavigation> | null>(null);
 if(!navigationRef.current) navigationRef.current = createStudentDialogNavigation(() => onCloseRef.current());
 const navigation = navigationRef.current;
 const registerClose = useCallback((close: () => void) => navigation.registerClose(close), [navigation]);
 function leave() { navigation.leave(); }
 function attempt(action: () => void) { navigation.attempt(action, busy); }
 function select(tab: string) { if (tab === active) return; attempt(() => { onSelect(tab); setSelected(tab); }); }
 return <WorkspaceDialog open title={`${name} · 학생 관리`} onClose={() => attempt(onClose)}>
  <div role="tablist" aria-label="학생 관리 기능" className="student-management-tabs">{tabs.map((t,index) => <button key={t.id} id={`${id}-${t.id}-tab`} type="button" role="tab" aria-selected={active === t.id} aria-controls={`${id}-panel`} tabIndex={active === t.id ? 0 : -1} disabled={busy} onClick={() => select(t.id)} onKeyDown={e => { const next = e.key === 'ArrowRight' ? (index+1)%tabs.length : e.key === 'ArrowLeft' ? (index-1+tabs.length)%tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length-1 : -1; if (next < 0) return; e.preventDefault(); document.getElementById(`${id}-${tabs[next].id}-tab`)?.focus(); select(tabs[next].id); }}>{t.label}</button>)}</div>
  {notice && <p role="status" className="text-sm text-slate-600 my-3">{notice}</p>}
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}-tab`}>
   <WorkspaceDialogEmbedding.Provider value={{registerClose}}><div key={active}>{render(active, leave)}</div></WorkspaceDialogEmbedding.Provider>
  </div>
 </WorkspaceDialog>;
}
