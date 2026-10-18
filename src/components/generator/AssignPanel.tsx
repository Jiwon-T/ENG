import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { askConfirm } from '../teacher/ConfirmDialog';

// 변형 문제 내주기 (선생님): pick classes and/or students (the ones the teacher teaches), an optional deadline, then 내주기.
// Students see it in their 수업 숙제 list; it is solved once, graded on submit, answers shown after. Students without a
// linked app account can't get it (listed after giving).
interface Targets { classes: { id: string; name: string; count: number }[]; students: { studentKey: string; name: string; linked: boolean }[] }
async function assignCall<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const r = await teacherAuthenticatedRequest<any>(auth, '/api/teacher/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
  if (!r.ok || !r.data?.ok) throw Error(r.data?.message || (r as any).userMessage || '잠시 후 다시 해 주세요.');
  return r.data;
}
const chip = (on: boolean, off = false) => `rounded-full border px-3 py-1 text-xs font-bold ${off ? 'border-dashed border-slate-200 text-slate-300' : on ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-600 hover:border-[#eaa0a9]'}`;
/** A KST date-time input value → epoch ms (the input has no zone; the academy is in Korea). */
const kstMs = (value: string) => value ? Date.parse(`${value}:00+09:00`) : null;
const tomorrow22 = () => { const d = new Date(Date.now() + 9 * 3_600_000 + 86_400_000); return `${d.toISOString().slice(0, 10)}T22:00`; };

export default function AssignPanel({ setId, count, onClose }: { key?: string; setId: string; count: number; onClose: () => void }) {
  const [targets, setTargets] = useState<Targets | null>(null), [classIds, setClassIds] = useState<string[]>([]), [keys, setKeys] = useState<string[]>([]);
  const [due, setDue] = useState<string>(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [done, setDone] = useState('');
  useEffect(() => { assignCall<Targets>('qset-targets').then(setTargets).catch(e => setMessage(e?.message || '불러오지 못했어요.')); }, []);
  const flip = (list: string[], id: string) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
  const people = new Set([...keys, ...(targets?.classes.filter(c => classIds.includes(c.id)).length ? ['_class'] : [])]);
  const give = async () => {
    if (busy || (!classIds.length && !keys.length)) return;
    setBusy(true); setMessage('');
    try {
      const r = await assignCall<{ assignment: { count: number }; skipped: string[] }>('qset-assign', { setId, classIds, studentKeys: keys, dueAt: kstMs(due) });
      setDone(`${r.assignment.count}명에게 내줬어요.${r.skipped.length ? ` 앱에 연결되지 않아 못 받은 학생: ${r.skipped.join(', ')}` : ''}`);
    } catch (e: any) { setMessage(e?.message || '내주지 못했어요.'); } finally { setBusy(false); }
  };
  return <section aria-label="변형 문제 내주기" className="mb-3 rounded-2xl border border-[#f3d5da] bg-white p-4 print:hidden">
    <div className="mb-2 flex items-center justify-between"><b className="text-sm text-[#5e1e2a]">학생에게 내주기 <span className="text-[11px] font-medium text-slate-400">{count}문제</span></b>
      <button type="button" onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600">닫기</button></div>
    {done ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{done}</p> : !targets ? <p className="text-xs text-slate-400">{message || '불러오는 중…'}</p> : <>
      <p className="mb-1 text-[11px] text-slate-500">누구에게</p>
      <div className="flex flex-wrap gap-1.5">
        {targets.classes.map(c => <button key={c.id} type="button" aria-pressed={classIds.includes(c.id)} onClick={() => setClassIds(flip(classIds, c.id))} className={chip(classIds.includes(c.id))}>{c.name} <span className="font-medium opacity-70">{c.count}명</span></button>)}
        {targets.students.map(s => <button key={s.studentKey} type="button" disabled={!s.linked} title={s.linked ? undefined : '앱에 연결되지 않은 학생'} aria-pressed={keys.includes(s.studentKey)} onClick={() => setKeys(flip(keys, s.studentKey))} className={chip(keys.includes(s.studentKey), !s.linked)}>{s.name}</button>)}
        {!targets.classes.length && !targets.students.length && <span className="text-xs text-slate-400">내줄 수 있는 학생이 없어요.</span>}
      </div>
      <p className="mb-1 mt-3 text-[11px] text-slate-500">마감</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={!due} onClick={() => setDue('')} className={chip(!due)}>마감 없음</button>
        <button type="button" aria-pressed={Boolean(due)} onClick={() => setDue(due || tomorrow22())} className={chip(Boolean(due))}>마감 정하기</button>
        {due && <input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} aria-label="마감 날짜와 시각" className="rounded-lg border border-slate-200 px-2 py-1 text-xs" />}
      </div>
      <p className="mt-3 text-[11px] text-slate-400">학생의 수업 숙제 목록에 떠요 · 한 번만 제출 · 채점하면 정답·해설 공개 · 마감 뒤 제출은 포인트 90%</p>
      {message && <p role="alert" className="mt-2 text-xs font-bold text-[#b04a5a]">{message}</p>}
      <button type="button" disabled={busy || !people.size} onClick={() => void give()} className="mt-3 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? '내주는 중…' : '내주기'}</button>
    </>}
  </section>;
}

/** 내가 내준 문제 (선생님): each given set with how many submitted, the deadline, and 취소 (students who have not submitted
 *  stop seeing it; graded results stay). Each student's answers are in their 학습 리포트. */
interface Given { id: string; title: string; count: number; submitted: number | null; names: string[]; classNames: string[]; dueAt: number | null; cancelled: boolean; createdAt: number }
const shortDay = (at: number) => new Date(at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
export function MyAssignments({ refresh }: { refresh?: number }) {
  const [rows, setRows] = useState<Given[] | null>(null), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const load = () => assignCall<{ assignments: Given[] }>('qset-assignments').then(r => setRows(r.assignments || [])).catch(() => setRows([]));
  useEffect(() => { load(); }, [refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const cancel = async (g: Given) => {
    if (busy || !await askConfirm({ title: '내주기를 취소할까요?', message: `'${g.title}' · 아직 풀지 않은 학생에게서 사라지고, 채점한 결과는 남아요.`, confirmText: '내주기 취소', tone: 'danger' })) return;
    setBusy(g.id); setMessage('');
    try { await assignCall('qset-cancel', { id: g.id }); await load(); } catch (e: any) { setMessage(e?.message || '취소하지 못했어요.'); } finally { setBusy(''); }
  };
  if (!rows?.length) return null;
  return <div className="mt-4 rounded-2xl border border-[#f3e6e8] bg-white p-4">
    <b className="text-sm text-[#5e1e2a]">내가 내준 문제</b>
    {message && <p role="alert" className="mt-1 text-xs font-bold text-[#b04a5a]">{message}</p>}
    <ul className="mt-2 divide-y divide-slate-100">{rows.map(g => <li key={g.id} className="flex items-center gap-2 py-2 text-xs">
      <span className="min-w-0 flex-1"><b className={`block truncate ${g.cancelled ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{g.title}</b>
        <span className="block truncate text-slate-400">{[...g.classNames, ...(g.classNames.length ? [] : g.names.slice(0, 3))].join(', ')}{!g.classNames.length && g.names.length > 3 ? ` 외 ${g.names.length - 3}명` : ''} · {shortDay(g.createdAt)}{g.dueAt ? ` · 마감 ${shortDay(g.dueAt)}` : ''}</span></span>
      <span className="flex-none font-bold text-slate-600">{g.submitted ?? '–'}/{g.count} 제출</span>
      {g.cancelled ? <span className="flex-none text-slate-400">취소됨</span> : <button type="button" disabled={busy === g.id} onClick={() => void cancel(g)} className="flex-none rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-500 hover:border-rose-200 hover:text-rose-700 disabled:opacity-50">취소</button>}
    </li>)}</ul>
    <p className="mt-1 text-[11px] text-slate-400">학생별 답과 풀이 기록 시간은 선생님방 학습 리포트에서 볼 수 있어요.</p>
  </div>;
}
