import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import InfoTip from '../InfoTip';
import { passageCall, shortDate, type PassageRow } from '../../lib/passageApi';
import { PASSAGE_LIMITS } from '../../lib/passageTools';
import QuestionSolve, { Marked } from './QuestionSolve';
import AssignPanel, { MyAssignments } from './AssignPanel';
import SheetOutput from './SheetOutput';
import { sheetQuestions } from '../../lib/questionSheet';
import { CIRCLED, MAX_TYPES, QUESTION_TYPES, typeLabel, type MadeQuestion, type QuestionType } from '../../lib/questionMaker';
import SampleModal, { SampleButton } from '../SampleModal';
import { sampleQuestions } from '../../lib/samples';

// 변형 문제 만들기 (Beta): a pasted passage or one from the 지문 보관함 → questions. The app-made types (순서 배열·문장
// 삽입·어법 수정·어법 선택) come straight from the passage with the answer known; the AI-helped types take the
// meaning parts from the AI and are checked by the app. Users see one list (app or AI is not theirs to know: every
// 만들기 counts the same); the rest grey out once 3 are picked. Every 만들기 counts once a month
// (the admin has no limit); the sets are kept under 내가 만든 문제.
interface QuestionSet { id: string; title: string; passageId: string | null; text: string; types: QuestionType[]; questions: MadeQuestion[]; createdAt: number; kind?: 'bundle'; sources?: { id: string; title: string; count: number }[] }
interface SetRow { id: string; title: string; types: QuestionType[]; count: number; createdAt: number; kind?: 'bundle' }
const chip = (on: boolean, off = false) => `rounded-full border px-3 py-1 text-xs font-bold ${off ? 'border-dashed border-slate-200 text-slate-300' : on ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-600 hover:border-[#eaa0a9]'}`;

const isAi = (id: QuestionType) => QUESTION_TYPES.find(t => t.id === id)?.by === 'ai';

function Question({ q, n, showAnswer }: { key?: string; q: MadeQuestion; n: number; showAnswer: boolean }) {
  return <section className="break-inside-avoid rounded-2xl border border-[#f3e6e8] bg-white p-4">
    <p className="text-sm font-bold text-[#5e1e2a]">{n}. {q.prompt} <span className="ml-1 whitespace-nowrap rounded-md bg-[#fef2f3] px-1.5 text-[10px] font-bold text-[#8b2f40] print:hidden">{typeLabel(q.type)}</span></p>
    {q.box && <p className="mt-2 rounded-lg border border-slate-400 px-3 py-2 text-sm leading-relaxed">{q.box}</p>}
    {q.paragraphs?.map(p => <p key={p.label} className="mt-2 text-sm leading-relaxed"><b className="mr-1">{p.label}</b>{p.text}</p>)}
    {q.passage && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed"><Marked text={q.passage} /></p>}
    {q.options && <ol className="mt-2 grid gap-0.5 text-sm">{q.options.map((o, i) => <li key={i}>{CIRCLED[i]} {o}</li>)}</ol>}
    {showAnswer && <p className="mt-3 whitespace-pre-line rounded-lg bg-[#f7f6fd] px-3 py-2 text-xs text-[#3c3489]"><b className="mr-1">정답</b>{Array.isArray(q.answer) ? '' : CIRCLED[q.answer - 1]} {q.explanation}</p>}
  </section>;
}

/** 샘플 보기: one question of each type from the example passage; 이 유형 고르기 adds the type to the picks (kept as they
 *  are; at 3 it says so instead of doing nothing). */
function GeneratorSample({ types, onToggle, onClose }: { types: QuestionType[]; onToggle: (t: QuestionType) => void; onClose: () => void }) {
  const samples = useMemo(sampleQuestions, []);
  const [type, setType] = useState<QuestionType>(types[0] || 'order'), [answer, setAnswer] = useState(false), [note, setNote] = useState('');
  const q = samples[type], on = types.includes(type);
  const pick = () => { if (!on && types.length >= MAX_TYPES) return setNote(`${MAX_TYPES}개까지 고를 수 있어요. 고른 유형 하나를 먼저 빼 주세요.`); setNote(''); onToggle(type); };
  return <SampleModal title="변형 문제 샘플" onClose={onClose}>
    <div className="flex flex-wrap gap-1.5">{QUESTION_TYPES.map(t => <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => { setType(t.id); setAnswer(false); setNote(''); }} className={chip(type === t.id)}>{types.includes(t.id) && '✓ '}{t.label}</button>)}</div>
    <div className="mt-3">{q ? <Question q={q} n={1} showAnswer={answer} /> : <p className="py-6 text-center text-sm text-slate-400">이 유형은 샘플이 없어요.</p>}</div>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" aria-expanded={answer} onClick={() => setAnswer(x => !x)} className="text-xs font-bold text-slate-500 hover:text-slate-700">{answer ? '정답·해설 접기 ▴' : '정답·해설 보기 ▾'}</button>
      {note && <span role="status" className="text-xs font-bold text-[#b04a5a]">{note}</span>}
      <button type="button" aria-pressed={on} onClick={pick} className={`ml-auto rounded-lg border px-3 py-1.5 text-xs font-bold ${on ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-[#d26272] text-[#8b2f40] hover:bg-[#fef2f3]'}`}>{on ? '✓ 고른 유형 (빼기)' : '이 유형 고르기'}</button>
    </div>
  </SampleModal>;
}

/** `initialTypes`: the types to start with (연습 유형 추천; up to 3), else 순서 배열 · 문장 삽입. */
export default function QuestionGenerator({ initialPassage, initialTypes, onBack }: { initialPassage?: { id: string; title: string; first?: string } | null; initialTypes?: QuestionType[]; onBack?: () => void }) {
  const [source, setSource] = useState<'paste' | 'library'>(initialPassage ? 'library' : 'paste');
  const [text, setText] = useState(''), [picked, setPicked] = useState(initialPassage || null);
  const [rows, setRows] = useState<PassageRow[] | null>(null), [types, setTypes] = useState<QuestionType[]>(() => initialTypes?.length ? initialTypes.slice(0, MAX_TYPES) : ['order', 'insert']);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [left, setLeft] = useState<number | null>(null);
  const [set, setSet] = useState<QuestionSet | null>(null), [skipped, setSkipped] = useState<{ type: QuestionType; reason: string }[]>([]), [answers, setAnswers] = useState(false);
  const [mine, setMine] = useState<SetRow[] | null>(null), [solving, setSolving] = useState(false);
  // 더 만들기 (the same passage, numbering goes on) and the sets picked to print together
  const [moreOpen, setMoreOpen] = useState(false), [moreTypes, setMoreTypes] = useState<QuestionType[]>([]), [picks, setPicks] = useState<string[]>([]), [moreFrom, setMoreFrom] = useState('');
  useEffect(() => { if (source === 'library' && !rows) passageCall<{ rows?: PassageRow[]; mine?: PassageRow[]; public?: PassageRow[] }>('list').then(r => setRows(r.rows || [...(r.mine || []), ...(r.public || [])].filter((x, i, all) => all.findIndex(y => y.id === x.id) === i))).catch(() => setRows([])); }, [source, rows]);
  const [canAssign, setCanAssign] = useState(false), [assigning, setAssigning] = useState(false), [sample, setSample] = useState(false);
  useEffect(() => { passageCall<{ sets: SetRow[]; canAssign?: boolean }>('question-sets').then(r => { setMine(r.sets || []); setCanAssign(Boolean(r.canAssign)); }).catch(() => setMine([])); }, [set]);
  const aiCount = types.filter(isAi).length;
  const toggle = (id: QuestionType) => setTypes(t => t.includes(id) ? t.filter(x => x !== id) : t.length >= MAX_TYPES ? t : [...t, id]);
  const make = async () => {
    if (busy) return; setBusy(true); setMessage(''); setSkipped([]);
    try {
      const r = await passageCall<{ set: QuestionSet | null; skipped: { type: QuestionType; reason: string }[]; left: number | null }>('make-questions', { types, ...(source === 'library' && picked ? { passageId: picked.id } : { text }) });
      setSkipped(r.skipped || []); if (r.left !== null && r.left !== undefined) setLeft(r.left);
      if (r.set) { setSet(r.set); setAnswers(false); } else setMessage('이 지문으로는 고른 문제를 만들 수 없어요.');
    } catch (e: any) { setMessage(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); }
  };
  const makeMore = async () => {
    if (busy || !set || !moreTypes.length || (set.kind === 'bundle' && !moreFrom)) return; setBusy(true); setMessage(''); setSkipped([]);
    try {
      const before = set.questions.length;
      const r = await passageCall<{ set: QuestionSet | null; skipped: { type: QuestionType; reason: string }[]; left: number | null; added?: number }>('make-questions', { appendTo: set.id, types: moreTypes, ...(set.kind === 'bundle' ? { fromSet: moreFrom } : {}) });
      setSkipped(r.skipped || []); if (r.left !== null && r.left !== undefined) setLeft(r.left);
      if (r.set && r.added) { setSet(r.set); setMoreOpen(false); setMoreTypes([]); setMessage(r.added > 1 ? `${before + 1}~${before + r.added}번을 더했어요.` : `${before + 1}번을 더했어요.`); } else setMessage('이 지문으로는 고른 문제를 더 만들 수 없어요.');
    } catch (e: any) { setMessage(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); }
  };
  /** The picked sets, fetched in list order, numbered on (one 문제지). */
  const pickedSheet = async () => {
    const order = (mine || []).filter(m => picks.includes(m.id)).map(m => m.id);
    const sets = await Promise.all(order.map(id => passageCall<{ set: QuestionSet }>('question-set', { id }).then(r => r.set)));
    return sheetQuestions(sets);
  };
  /** 합본으로 저장: the picked sets become one new set (in list order); it opens right away. */
  const bundle = async () => {
    if (busy || picks.length < 2) return; setBusy(true); setMessage('');
    try {
      const ids = (mine || []).filter(m => picks.includes(m.id)).map(m => m.id);
      const r = await passageCall<{ set: QuestionSet }>('bundle-sets', { ids });
      setPicks([]); setSet(r.set); setSkipped([]); setAnswers(false); setMessage(`${ids.length}세트를 합본으로 저장했어요. 원래 세트도 그대로 있어요.`);
    } catch (e: any) { setMessage(e?.message || '합본을 만들지 못했어요.'); } finally { setBusy(false); }
  };
  const openSet = async (id: string) => { try { const r = await passageCall<{ set: QuestionSet }>('question-set', { id }); setSet(r.set); setSkipped([]); setAnswers(false); } catch (e: any) { setMessage(e?.message || '불러오지 못했어요.'); } };
  const ready = types.length > 0 && (source === 'paste' ? text.trim().length > 0 : Boolean(picked));

  if (set && solving) return <QuestionSolve setId={set.id} onBack={() => setSolving(false)} />;
  if (set) return <div className="mx-auto max-w-3xl px-4 pb-10 pt-4 md:px-6 md:pt-8">
    <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" onClick={() => setSet(null)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><ArrowLeft size={14} aria-hidden="true" />다시 만들기</button>
      <span className="ml-auto flex gap-1.5">
        {canAssign && set.questions.some(q => q.type !== 'workbook') && <button type="button" onClick={() => setAssigning(a => !a)} className="rounded-lg border border-[#d26272] px-2.5 py-1 text-xs font-bold text-[#8b2f40]">내주기</button>}
        {set.questions.some(q => q.type !== 'workbook') && <button type="button" onClick={() => setSolving(true)} className="rounded-lg bg-[#d26272] px-2.5 py-1 text-xs font-bold text-white">풀어 보기</button>}
        <button type="button" onClick={() => setAnswers(a => !a)} className="rounded-lg border border-[#f3d5da] px-2.5 py-1 text-xs font-bold text-[#8b2f40]">{answers ? '정답 숨기기' : '정답 보기'}</button>
      </span>
    </div>
    <div className="mb-3 flex flex-wrap items-center gap-1.5 print:hidden">
      {set.questions.length < (set.kind === 'bundle' ? 60 : 30) && <button type="button" onClick={() => { setMoreOpen(o => !o); setMessage(''); setMoreFrom(set.sources?.length === 1 ? set.sources[0].id : ''); }} className="rounded-lg border border-[#d26272] px-2.5 py-1 text-xs font-bold text-[#8b2f40]">{set.kind === 'bundle' ? '+ 지문을 골라 더 만들기' : '+ 같은 지문으로 더 만들기'}</button>}
      <span className="ml-auto"><SheetOutput title={set.title} load={() => sheetQuestions([set])} /></span>
    </div>
    {moreOpen && <section aria-label="더 만들기" className="mb-3 rounded-2xl border border-[#f3d5da] bg-white p-4 print:hidden">
      {set.kind === 'bundle' && set.sources && <><p className="mb-1 text-[11px] text-slate-500">어느 지문으로 만들까요?</p>
        <div className="mb-3 flex flex-wrap gap-1.5">{set.sources.map(x => <button key={x.id} type="button" aria-pressed={moreFrom === x.id} onClick={() => setMoreFrom(x.id)} className={chip(moreFrom === x.id)}>{x.title}</button>)}</div></>}
      <p className="mb-1 text-[11px] text-slate-500">더 만들 문제 유형 <span className="text-slate-400">({MAX_TYPES}개까지 · {set.questions.length + 1}번부터 이어져요)</span></p>
      <div className="flex flex-wrap gap-1.5">{QUESTION_TYPES.map(t => { const on = moreTypes.includes(t.id), full = !on && moreTypes.length >= MAX_TYPES;
        return <button key={t.id} type="button" aria-pressed={on} disabled={full} onClick={() => setMoreTypes(x => x.includes(t.id) ? x.filter(y => y !== t.id) : x.length >= MAX_TYPES ? x : [...x, t.id])} className={chip(on, full)}>{t.label}</button>; })}</div>
      <button type="button" disabled={busy || !moreTypes.length || (set.kind === 'bundle' && !moreFrom)} onClick={() => void makeMore()} className="mt-3 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? '만드는 중…' : '더 만들기'}</button>
    </section>}
    {message && <p role="status" className="mb-3 text-xs font-bold text-[#8b2f40] print:hidden">{message}</p>}
    {assigning && <AssignPanel key={set.id} setId={set.id} count={set.questions.length} onClose={() => setAssigning(false)} />}
    <h1 className="mb-1 text-base font-black text-[#5e1e2a]">{set.title}</h1>
    {set.kind === 'bundle' && set.sources && <p className="mb-1 text-[11px] text-slate-500 print:hidden">합본 · {set.sources.map(x => `${x.title} (${x.count})`).join(' + ')}</p>}
    <p className="mb-3 text-[11px] text-slate-400 print:hidden">{shortDate(set.createdAt)} · {set.questions.length}문제{left !== null ? ` · 이번 달 ${left}번 더 만들 수 있어요` : ''}</p>
    {skipped.length > 0 && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 print:hidden">{skipped.map(s => `${typeLabel(s.type)}: ${s.reason}`).join(' · ')}</p>}
    <div className="space-y-3">{set.questions.map((q, i) => <Question key={q.id + i} q={q} n={i + 1} showAnswer={answers} />)}</div>
  </div>;

  return <div className="mx-auto max-w-3xl px-4 pb-10 pt-4 md:px-6 md:pt-8">
    {onBack && <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><ArrowLeft size={14} aria-hidden="true" />지문으로</button>}
    <div className="rounded-2xl border border-[#f3e6e8] bg-white p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2"><FileQuestion size={18} className="text-[#8b2f40]" aria-hidden="true" /><b className="text-base text-[#5e1e2a]">변형 문제 만들기 <span className="text-[11px] font-medium text-slate-400">Beta</span></b>
        <InfoTip label="변형 문제 만들기 설명 보기">지문을 붙여 넣거나 지문 보관함에서 고르면 문제를 만들어요. 모든 문제는 원문과 맞는지 확인한 뒤 보여 줘요. 문제 유형은 한 번에 3개까지 고를 수 있어요. 만들기 한 번에 이번 달 횟수가 한 번 들어요(패스면 더 많이).</InfoTip></div>
      <div role="tablist" aria-label="지문 고르기" className="mb-2 flex gap-1 rounded-xl bg-[#f8f1f2] p-1">{([['paste', '붙여 넣기'], ['library', '보관함 지문']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={source === id} onClick={() => setSource(id)} className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${source === id ? 'bg-white text-[#8b2f40] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
      {source === 'paste' ? <>
        <textarea value={text} onChange={e => setText(e.target.value.slice(0, PASSAGE_LIMITS.textChars))} rows={8} aria-label="문제를 만들 영어 지문" placeholder="영어 지문을 붙여 넣어 주세요." className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed outline-none focus:border-[#eaa0a9] focus:bg-white" />
        <p className="mt-1 text-right text-[11px] text-slate-400">{text.length.toLocaleString('ko-KR')} / {PASSAGE_LIMITS.textChars.toLocaleString('ko-KR')}자</p>
      </> : <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
        {picked && <p className="border-b border-slate-100 bg-[#fef2f3] px-3 py-2 text-xs text-[#8b2f40]"><b>고른 지문</b> {picked.title || picked.first || '제목 없는 지문'}</p>}
        {!rows ? <p className="p-3 text-xs text-slate-400">불러오는 중…</p> : !rows.length ? <p className="p-3 text-xs text-slate-400">보관함에 지문이 없어요. 지문 분석기에서 먼저 분석해 주세요.</p>
          : rows.map(r => <button key={r.id} type="button" onClick={() => setPicked({ id: r.id, title: r.title, first: r.first })} className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-xs last:border-0 ${picked?.id === r.id ? 'bg-[#fef2f3]' : 'hover:bg-slate-50'}`}><b className="block truncate text-slate-700">{r.title || '제목 없는 지문'}</b><span className="block truncate text-slate-400">{r.first}</span></button>)}
      </div>}
      <p className="mb-1 mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">만들 문제 유형 <span className="text-slate-400">({MAX_TYPES}개까지)</span><SampleButton onClick={() => setSample(true)} /></p>
      {sample && <GeneratorSample types={types} onToggle={toggle} onClose={() => setSample(false)} />}
      <div className="flex flex-wrap gap-1.5">{QUESTION_TYPES.map(t => { const on = types.includes(t.id), full = !on && types.length >= MAX_TYPES;
        return <button key={t.id} type="button" aria-pressed={on} disabled={full} onClick={() => toggle(t.id)} className={chip(on, full)}>{t.label}</button>; })}</div>
      {message && <p role="alert" className="mt-3 text-xs font-bold text-[#b04a5a]">{message}</p>}
      <button type="button" disabled={busy || !ready} onClick={() => void make()} className="mt-4 w-full rounded-xl bg-[#d26272] py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? (aiCount || types.some(t => t === 'grammar' || t === 'choice') ? '만드는 중… (20초쯤 걸려요)' : '만드는 중…') : '문제 만들기'}</button>
    </div>
    {mine && mine.length > 0 && <div className="mt-4 rounded-2xl border border-[#f3e6e8] bg-white p-4">
      <b className="text-sm text-[#5e1e2a]">내가 만든 문제</b>
      <ul className="mt-2 divide-y divide-slate-100">{mine.map(m => <li key={m.id} className="flex items-center gap-2">
        <input type="checkbox" checked={picks.includes(m.id)} onChange={() => setPicks(x => x.includes(m.id) ? x.filter(y => y !== m.id) : [...x, m.id])} aria-label={`${m.title} 묶어서 출력에 넣기`} className="h-4 w-4 flex-none accent-[#d26272]" />
        <button type="button" onClick={() => void openSet(m.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs"><span className="min-w-0 flex-1 truncate font-bold text-slate-700">{m.kind === 'bundle' && <span className="mr-1 rounded bg-[#fef2f3] px-1 text-[10px] text-[#8b2f40]">합본</span>}{m.title}</span><span className="text-slate-400">{m.types.map(typeLabel).join('·')} · {shortDate(m.createdAt)}</span></button></li>)}</ul>
      {picks.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-[#fef2f3] px-3 py-2 text-xs"><b className="text-[#8b2f40]">{picks.length}세트 묶어서</b><span className="text-slate-500">번호를 이어서 한 문제지로</span>{picks.length >= 2 && <button type="button" disabled={busy} onClick={() => void bundle()} className="rounded-lg bg-[#d26272] px-2.5 py-1 font-bold text-white disabled:opacity-50">합본으로 저장</button>}<span className="ml-auto"><SheetOutput title="변형 문제지" load={pickedSheet} /></span></div>}
    </div>}
    {canAssign && <MyAssignments refresh={mine?.length} />}
  </div>;
}
