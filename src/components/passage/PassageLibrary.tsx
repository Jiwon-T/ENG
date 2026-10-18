import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { passageCall, roleName, shortDate, type Passage, type PassageRow } from '../../lib/passageApi';
import PassageResult from './PassageResult';
import QuestionGenerator from '../generator/QuestionGenerator';
import type { QuestionType } from '../../lib/questionMaker';

const PART_NAMES: Record<string, string> = { reading: '직독직해', grammar: '문법', summary: '요약' };

/** Title, exam info and 학생 공개 for teachers, with the change record (names and dates). */
export function StaffTools({ passage, onChange }: { passage: Passage; onChange: (p: Passage) => void }) {
  const [title, setTitle] = useState(passage.title), [examInfo, setExamInfo] = useState(passage.examInfo);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [showLog, setShowLog] = useState(false);
  useEffect(() => { setTitle(passage.title); setExamInfo(passage.examInfo); }, [passage.id, passage.title, passage.examInfo]);
  const save = async (change: Record<string, unknown>) => {
    setBusy(true); setMessage('');
    try { const r = await passageCall<{ passage: Passage }>('info', { id: passage.id, ...change }); onChange(r.passage); setMessage('저장했어요.'); }
    catch (e: any) { setMessage(e?.message || '저장하지 못했어요.'); }
    finally { setBusy(false); }
  };
  const dirty = title !== passage.title || examInfo !== passage.examInfo;
  const input = 'min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#eaa0a9]';
  return <div className="mt-3 rounded-xl border border-[#f3e6e8] bg-[#fffafa] p-3 text-sm">
    <div className="flex flex-col gap-1.5 md:flex-row">
      <input value={title} onChange={e => setTitle(e.target.value.slice(0, 120))} placeholder="제목 (예: 노력의 힘)" aria-label="지문 제목" className={input} />
      <input value={examInfo} onChange={e => setExamInfo(e.target.value.slice(0, 120))} placeholder="시험 정보 (예: 2026 3월 고2 18번)" aria-label="시험 정보" className={input} />
      {dirty && <button type="button" disabled={busy} onClick={() => void save({ title, examInfo })} className="rounded-lg bg-[#d26272] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">저장</button>}
    </div>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <label className="inline-flex cursor-pointer items-center gap-2 font-bold text-slate-600">
        <input type="checkbox" className="peer sr-only" checked={passage.public} disabled={busy} onChange={e => void save({ public: e.target.checked })} />
        <span className="relative h-4 w-8 rounded-full bg-slate-300 transition-colors peer-checked:bg-[#d26272] after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" aria-hidden="true" />
        학생에게 공개
      </label>
      <button type="button" onClick={() => setShowLog(v => !v)} className="text-slate-500 underline-offset-2 hover:underline">기록 {passage.history?.length || 0}개 {showLog ? '접기' : '보기'}</button>
    </div>
    {passage.createdBy && <p className="mt-1.5 text-[11px] text-slate-400">처음 분석 {passage.createdBy.name}({roleName(passage.createdBy.role)}) {shortDate(passage.createdBy.at)}</p>}
    {showLog && <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-slate-500">{[...(passage.history || [])].reverse().map((h, i) => <li key={i}>{shortDate(h.at)} · {h.name}({roleName(h.role)}) · {h.action}</li>)}</ul>}
    {message && <p className="mt-1 text-[11px] font-bold text-[#b04a5a]">{message}</p>}
  </div>;
}

/**
 * 지문 보관함. Teachers and the admin: every stored passage with who analysed it and the last change (search, 공개만).
 * Students: the passages a teacher made public, and the ones they analysed themselves (no names).
 */
export default function PassageLibrary() {
  const [data, setData] = useState<{ rows?: PassageRow[]; more?: { at: number; id: string } | null; public?: PassageRow[]; mine?: PassageRow[] } | null>(null);
  const [open, setOpen] = useState<Passage | null>(null);
  const [query, setQuery] = useState(''), [onlyPublic, setOnlyPublic] = useState(false);
  const [message, setMessage] = useState(''), [making, setMaking] = useState(false), [makeTypes, setMakeTypes] = useState<QuestionType[] | undefined>();
  const load = () => passageCall<any>('list').then(setData).catch(e => setMessage(e.message));
  // Teachers: 100 newest at a time; "더 보기" brings the next 100.
  const loadMore = () => data?.more && passageCall<any>('list', { after: data.more }).then(r => setData(d => ({ ...d, rows: [...(d?.rows || []), ...(r.rows || [])], more: r.more }))).catch(e => setMessage(e.message));
  useEffect(() => { void load(); }, []);
  const staff = Boolean(data?.rows);
  const rows = useMemo(() => { const q = query.trim().toLowerCase(); return (data?.rows || []).filter(r => (!onlyPublic || r.public) && (!q || `${r.title} ${r.examInfo} ${r.first}`.toLowerCase().includes(q))); }, [data, query, onlyPublic]);
  const show = (id: string) => passageCall<{ passage: Passage }>('read', { id }).then(r => setOpen(r.passage)).catch(e => setMessage(e.message));

  if (open && making) return <QuestionGenerator initialPassage={{ id: open.id, title: open.title || '', first: open.sentences?.[0] }} initialTypes={makeTypes} onBack={() => setMaking(false)} />;
  if (open) return <>
    <button type="button" onClick={() => { setOpen(null); void load(); }} className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><ArrowLeft size={14} aria-hidden="true" />보관함</button>
    <PassageResult passage={open} onChange={setOpen} onMakeQuestions={types => { setMakeTypes(types); setMaking(true); }} extra={staff ? <StaffTools passage={open} onChange={setOpen} /> : undefined} />
  </>;
  const item = (r: PassageRow, sub?: string) => <li key={r.id}><button type="button" onClick={() => void show(r.id)} className="w-full border-t border-slate-100 px-1 py-2.5 text-left hover:bg-[#fff7f8]">
    <span className="flex items-center justify-between gap-2"><b className={`truncate text-sm font-bold ${r.title || r.examInfo ? 'text-[#5e1e2a]' : 'text-slate-400'}`}>{[r.examInfo, r.title].filter(Boolean).join(' · ') || '제목 없음'}</b>
      {staff && <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${r.public ? 'bg-emerald-50 text-emerald-700' : 'border border-slate-200 text-slate-500'}`}>{r.public ? '학생 공개' : '비공개'}</span>}</span>
    <span className="mt-0.5 block truncate text-xs text-slate-500">{r.first}</span>
    <span className="mt-0.5 block text-[11px] text-slate-400">{sub || ''}{r.parts.filter(p => PART_NAMES[p]).map(p => ` · ${PART_NAMES[p]} ✓`).join('')}</span>
  </button></li>;

  return <div className="rounded-2xl border border-[#f3e6e8] bg-white p-4 md:p-5">
    {message && <p className="mb-2 text-xs font-bold text-[#b04a5a]">{message}</p>}
    {!data ? <p className="py-6 text-center text-sm text-slate-400">불러오는 중…</p> : staff ? <>
      <div className="mb-2 flex gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5"><Search size={14} className="text-slate-400" aria-hidden="true" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="제목·시험 정보·첫 문장으로 찾기" aria-label="지문 찾기" className="min-w-0 flex-1 py-1.5 text-sm outline-none" /></label>
        <button type="button" aria-pressed={onlyPublic} onClick={() => setOnlyPublic(v => !v)} className={`rounded-lg border px-2.5 text-xs font-bold ${onlyPublic ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-600'}`}>공개만</button>
      </div>
      {rows.length ? <ul>{rows.map(r => item(r, `분석 ${r.createdBy?.name || ''}${r.createdBy ? `(${roleName(r.createdBy.role)}) ${shortDate(r.createdBy.at)}` : ''}${r.lastChange && r.lastChange.action !== '지문 분석 시작' ? ` · ${r.lastChange.action} ${r.lastChange.name} ${shortDate(r.lastChange.at)}` : ''}`))}</ul>
        : <p className="py-6 text-center text-sm text-slate-400">{data.rows!.length ? '찾는 지문이 없어요.' : '아직 저장된 지문이 없어요.'}</p>}
      {data.more ? <button type="button" onClick={() => void loadMore()} className="mt-2 w-full rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">더 보기</button> : null}
    </> : <>
      <p className="mb-1 text-xs font-bold text-slate-500">선생님이 공개한 지문</p>
      {data.public?.length ? <ul>{data.public.map(r => item(r))}</ul> : <p className="py-3 text-xs text-slate-400">아직 공개된 지문이 없어요.</p>}
      <p className="mb-1 mt-4 text-xs font-bold text-slate-500">내가 분석한 지문</p>
      {data.mine?.length ? <ul>{data.mine.map(r => item(r, `${shortDate(r.analysedAt)} 분석`))}</ul> : <p className="py-3 text-xs text-slate-400">아직 분석한 지문이 없어요.</p>}
    </>}
  </div>;
}
