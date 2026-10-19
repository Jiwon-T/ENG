import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Scissors, Sparkles, Trash2, Merge, Upload, RefreshCw, Download, ClipboardPaste, FileQuestion } from 'lucide-react';
import {
  WORKBOOK_LIMITS, aiReviewKey, applyAiTranslations, applyTranslations, arrangeLine, blankedText, buildWorkbook, checkWorkbook, passageKey, safeFileName, sentenceId, splitExcerpts, splitPassage, toggleBlank,
  type WorkbookBuild, type WorkbookHistory, type WorkbookSentence,
} from '../../lib/workbook';
import { readWorkbookFile } from '../../lib/workbookImport';
import { AiWorking, workbookTranslate } from './workbookAi';
import { FooterSetting } from '../print/PrintSheet';
import SampleModal, { SampleButton } from '../SampleModal';
import { sampleWorkbook } from '../../lib/samples';
import { PASSAGE_LIMITS } from '../../lib/passageTools';
import CertRequest from '../student/CertRequest';

const QuestionGenerator = lazy(() => import('../generator/QuestionGenerator'));

/** 샘플 보기: the 워크북 of the example passage, Part 1 빈칸 · Part 2 배열 · 정답, as in the 미리보기. */
function WorkbookSample({ onClose }: { onClose: () => void }) {
  const build = useMemo(sampleWorkbook, []), [view, setView] = useState<'part1' | 'part2' | 'key'>('part1');
  return <SampleModal title="워크북 샘플" onClose={onClose}>
    <span className="flex gap-1.5" role="tablist" aria-label="샘플 미리보기">{([['part1', 'Part 1 빈칸'], ['part2', 'Part 2 배열'], ['key', '정답']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${view === id ? 'bg-[#e0587a] text-white' : 'bg-[#f8f1f2] text-[#8b2f40]'}`}>{label}</button>)}</span>
    <ol className="mt-3 space-y-3 rounded-2xl border border-[#f3e6e8] bg-white p-4">
      {view === 'part1' && build.blanks.map((b, n) => <li key={b.id}><p className="text-sm leading-7 text-slate-800"><b className="mr-1 text-[#8b2f40]">{n + 1}.</b>{blankedText(b.tokens, b.blanks)}</p><p className="text-xs text-slate-500">해석 {b.ko}</p></li>)}
      {view === 'part2' && build.arrange.map((a, n) => <li key={a.id}><p className="text-xs text-slate-500"><b className="mr-1 text-[#8b2f40]">{n + 1}.</b>{a.ko}</p><p className="mt-0.5 text-sm text-slate-800">{arrangeLine(a)}</p></li>)}
      {view === 'key' && build.blanks.map((b, n) => <li key={b.id} className="text-sm text-slate-800"><b className="mr-1 text-[#8b2f40]">{n + 1}.</b>{b.text}<span className="block text-xs text-slate-500">{b.ko}</span></li>)}
    </ol>
    <p className="mt-2 text-[11px] text-slate-400">Word 파일에는 Part 1 · Part 2 · 정답이 이 순서로 들어가요. 빈칸은 만들 때마다 다르게 골라요.</p>
  </SampleModal>;
}

// 워크북 만들기 (관리자): 1 지문 입력 → 2 문장·해석 확인 → 3 미리보기·Word. The sentence list keeps each sentence's
// translation by id, so moving, splitting or merging never pairs a translation with the wrong sentence.
type Request = (action?: string, body?: any) => Promise<any>;
type Step = 1 | 2 | 3;
const card = 'rounded-2xl border border-[#f3e6e8] bg-white p-4';
const primary = 'rounded-xl bg-[#e0587a] px-4 py-2 text-sm font-bold text-white hover:bg-[#cc4a6b] disabled:opacity-50';
const quiet = 'inline-flex items-center gap-1 rounded-xl border border-[#f3d5da] bg-white px-3 py-1.5 text-xs font-bold text-[#8b2f40] hover:bg-[#fef2f3] disabled:opacity-50';
const iconBtn = 'rounded-lg p-1 text-slate-400 hover:bg-[#fef2f3] hover:text-[#8b2f40] disabled:opacity-30';

export default function WorkbookMaker({ request }: { request: Request }) {
  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState(''), [source, setSource] = useState(''), [mode, setMode] = useState<'passage' | 'excerpt'>('passage'), [text, setText] = useState('');
  const [sentences, setSentences] = useState<WorkbookSentence[]>([]);
  const [build, setBuild] = useState<WorkbookBuild | null>(null), [history, setHistory] = useState<WorkbookHistory>({ blanks: [], orders: [] });
  // The build already downloaded (and remembered): downloading it again saves nothing new.
  const savedBuild = useRef<WorkbookBuild | null>(null), [savedKey, setSavedKey] = useState('');
  const [view, setView] = useState<'part1' | 'part2' | 'key'>('part1'), [sample, setSample] = useState(false);
  // 이 지문으로 변형 문제 만들기: the generator opens here with the sentences already pasted (워크북 stays as it is)
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [pasteOpen, setPasteOpen] = useState(false), [pasteText, setPasteText] = useState(''), [overwrite, setOverwrite] = useState(false);
  const caret = useRef<Record<string, number>>({});
  // AI translations can't be checked by code for pairing (same count, wrong order): the teacher confirms before the file.
  // The confirmation is tied to the exact AI-filled sentences and translations: editing one of them clears it.
  const [reviewedKey, setReviewedKey] = useState('');
  const aiCount = sentences.filter(s => s.ko.trim() && s.koEdited === false).length, currentReviewKey = aiReviewKey(sentences), reviewed = reviewedKey === currentReviewKey;
  const missing = sentences.filter(s => !s.ko.trim()).length;
  const issues = useMemo(() => build ? checkWorkbook(sentences, build) : [], [build, sentences]);

  const run = async (label: string, work: () => Promise<void>) => { setBusy(label); setMessage(''); try { await work(); } catch (e: any) { setMessage(e?.message || '처리하지 못했어요. 잠시 후 다시 해 주세요.'); } finally { setBusy(''); } };
  const update = (id: string, patch: Partial<WorkbookSentence>) => { setSentences(list => list.map(s => s.id === id ? { ...s, ...patch } : s)); setBuild(null); };
  const change = (next: WorkbookSentence[]) => { setSentences(next); setBuild(null); };

  function splitText() {
    setMessage('');
    if (!text.trim()) return setMessage('영어 지문이나 문장을 넣어 주세요.');
    if (text.length > WORKBOOK_LIMITS.textChars) return setMessage(`글이 너무 길어요. ${WORKBOOK_LIMITS.textChars.toLocaleString()}자 이하로 나눠서 만들어 주세요.`);
    const parts = mode === 'passage' ? splitPassage(text) : splitExcerpts(text);
    if (!parts.length) return setMessage('나눌 문장을 찾지 못했어요.');
    if (parts.length > WORKBOOK_LIMITS.sentences) return setMessage(`문장이 ${parts.length}개예요. 한 번에 ${WORKBOOK_LIMITS.sentences}문장까지 만들 수 있어요.`);
    change(parts.map(t => ({ id: sentenceId(), text: t, ko: '' }))); setStep(2);
  }
  const loadFile = (file?: File) => file && run('file', async () => { const t = await readWorkbookFile(file); setText(t.slice(0, WORKBOOK_LIMITS.textChars + 1)); if (!title) setTitle(file.name.replace(/\.(txt|docx)$/i, '')); });

  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= sentences.length) return; const next = [...sentences]; [next[i], next[j]] = [next[j], next[i]]; change(next); };
  const remove = (i: number) => change(sentences.filter((_, k) => k !== i));
  const addAfter = (i: number) => { const next = [...sentences]; next.splice(i + 1, 0, { id: sentenceId(), text: '', ko: '' }); change(next); };
  const merge = (i: number) => { const a = sentences[i], b = sentences[i + 1]; if (!b) return; const next = [...sentences]; next.splice(i, 2, { id: a.id, text: `${a.text} ${b.text}`.trim(), ko: [a.ko, b.ko].filter(Boolean).join(' ') }); change(next); };
  /** Split at the cursor (or at the first sentence end inside it); the translation stays with the first part. */
  const split = (i: number) => {
    const s = sentences[i], at = caret.current[s.id], cut = at && at > 0 && at < s.text.length ? at : (s.text.search(/[.!?]["'”’)]*\s+\S/) + 1);
    if (cut <= 0) return setMessage('나눌 곳에 커서를 두고 나누기를 눌러 주세요.');
    const end = s.text.slice(0, cut).search(/\s+$/) >= 0 ? cut : s.text.slice(cut).match(/^\S*/)![0].length + cut;
    const first = s.text.slice(0, end).trim(), second = s.text.slice(end).trim(); if (!first || !second) return;
    const next = [...sentences]; next.splice(i, 1, { ...s, text: first }, { id: sentenceId(), text: second, ko: '' }); change(next);
  };

  const translate = () => run('translate', async () => {
    const todo = sentences.filter(s => s.text.trim() && !s.ko.trim()); if (!todo.length) return setMessage('빈 해석이 없어요.');
    const r = await workbookTranslate(todo.map(s => s.text));
    const asked = todo.map(s => ({ id: s.id, text: s.text }));
    // Only the ones still empty are filled: anything typed meanwhile stays.
    // Applied only to sentences whose English is unchanged since the request (and still empty).
    setSentences(list => applyAiTranslations(list, asked, r.translations || [])); setBuild(null); setReviewedKey('');
    setMessage(`해석 ${todo.length}개를 채웠어요. 확인하고 고쳐 주세요.${typeof r.left === 'number' ? ` (이번 달 남은 AI 해석 ${r.left}번)` : ''}`);
  });

  const generate = (again = false) => run('build', async () => {
    const empty = sentences.findIndex(s => !s.text.trim()); if (empty >= 0) throw Error(`${empty + 1}번 문장이 비어 있어요.`);
    if (missing) throw Error(`해석이 없는 문장이 ${missing}개 있어요. 먼저 채워 주세요.`);
    const key = passageKey(sentences.map(s => s.text));
    const h = again && build?.key === key ? history : await request('read:workbook-history', { key });
    const past: WorkbookHistory = { blanks: h.blanks || [], orders: h.orders || [] };
    // "다시 섞기" also avoids what is on screen now.
    if (again && build) { past.blanks = [...past.blanks, build.blanks.map(b => b.blanks)]; past.orders = [...past.orders, build.arrange.map(a => a.order)]; }
    setHistory({ blanks: h.blanks || [], orders: h.orders || [] });
    setBuild(buildWorkbook(sentences, past)); setStep(3); setView('part1');
  });

  const download = () => run('docx', async () => {
    if (!build) return; const problems = checkWorkbook(sentences, build); if (problems.length) throw Error(problems[0]);
    const { workbookDocx } = await import('../../lib/workbookDocx'), { saveAs } = await import('file-saver');
    const blob = await workbookDocx(build, { title, subtitle: source });
    saveAs(blob, safeFileName(title, source));
    if (savedBuild.current === build) return setMessage('같은 워크북을 다시 내려받았어요. 다른 빈칸·배열이 필요하면 다시 섞기를 눌러 주세요.');
    // Remember these blanks and orders, so the next workbook from the same passage picks different ones.
    await request('workbook-save', { key: build.key, title: title.slice(0, 120), blanks: build.blanks.map(b => b.blanks), orders: build.arrange.map(a => a.order) });
    savedBuild.current = build; setSavedKey(build.key);
    setHistory(h => ({ blanks: [...h.blanks, build.blanks.map(b => b.blanks)], orders: [...h.orders, build.arrange.map(a => a.order)] }));
    setMessage('내려받았어요. 이 지문으로 다음에 만들거나 다시 섞기를 누르면 이번과 다른 빈칸·배열이 나와요.');
  });

  const steps: [Step, string][] = [[1, '지문 입력'], [2, '문장·해석 확인'], [3, '미리보기·다운로드']];
  const passage = sentences.map(s => s.text.trim()).filter(Boolean).join(' ');
  if (making) return <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>}><QuestionGenerator initialText={passage} backLabel="워크북으로" onBack={() => setMaking(false)} /></Suspense>;
  return <section className="space-y-3" aria-label="워크북 만들기">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex items-center gap-2"><h2 className="text-lg font-black text-[#5e1e2a]">워크북 만들기</h2><SampleButton onClick={() => setSample(true)} /></span>{sample && <WorkbookSample onClose={() => setSample(false)} />}
      <div className="flex gap-1.5" role="tablist" aria-label="단계">{steps.map(([n, label]) => <button key={n} type="button" role="tab" aria-selected={step === n} disabled={n === 2 ? !sentences.length : n === 3 ? !build : false} onClick={() => setStep(n)} className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-40 ${step === n ? 'bg-[#e0587a] text-white' : 'bg-[#fef2f3] text-[#8b2f40]'}`}>{n} {label}</button>)}</div>
    </div>
    {message && <p role="status" className="rounded-xl bg-[#fdf6f7] px-3 py-2 text-sm text-[#8b2f40]">{message}</p>}

    {step === 1 && <div className={`${card} space-y-3`}>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-500">워크북 제목<input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="예: 2026 고2 10월 모의고사" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" /></label>
        <label className="text-xs font-bold text-slate-500">소제목 <span className="font-normal">(선택 · 교재·지문)</span><input value={source} maxLength={120} onChange={e => setSource(e.target.value)} placeholder="예: 18번 지문" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800" /></label>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500"><FooterSetting /><span>모든 쪽 아래에 들어가요 · 이 기기에 기억</span></div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="자료 유형">{([['passage', '연속 지문'], ['excerpt', '발췌 문장 (한 줄에 한 문장)']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${mode === id ? 'bg-[#e0587a] text-white' : 'bg-[#f8f1f2] text-[#8b2f40]'}`}>{label}</button>)}</div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={10} aria-label="영어 지문 또는 문장" placeholder={mode === 'passage' ? '영어 지문을 붙여 넣으세요. 문장은 앱이 나눠요.' : '한 줄에 한 문장씩 넣으세요. 앞의 번호(1. 2) ①)는 빼고 처리해요.'} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm leading-relaxed" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <label className={quiet}><Upload size={13} aria-hidden="true" />TXT·DOCX 불러오기<input type="file" accept=".txt,.docx" className="sr-only" onChange={e => { void loadFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
        <span className={text.length > WORKBOOK_LIMITS.textChars ? 'font-bold text-[#b04a5a]' : ''}>{text.length.toLocaleString()} / {WORKBOOK_LIMITS.textChars.toLocaleString()}자</span>
      </div>
      <div className="flex justify-end"><button type="button" className={primary} disabled={!!busy} onClick={splitText}>문장 나누기 →</button></div>
    </div>}

    {step === 2 && <div className="space-y-2">
      <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
        <span className="text-sm text-slate-600"><b className="text-[#5e1e2a]">{sentences.length}문장</b> · 해석 {sentences.length - missing}/{sentences.length}{missing > 0 && <span className="ml-1 font-bold text-[#b04a5a]">({missing}개 비어 있음)</span>}</span>
        <span className="flex flex-wrap items-center gap-1.5">{busy === 'translate' && <AiWorking />}<button type="button" className={quiet} disabled={!!busy || !missing} onClick={() => void translate()}><Sparkles size={13} aria-hidden="true" />{busy === 'translate' ? 'AI 해석 중…' : '빈 해석 AI로 채우기'}</button><button type="button" className={quiet} onClick={() => setPasteOpen(o => !o)}><ClipboardPaste size={13} aria-hidden="true" />해석 줄 단위 붙여넣기</button></span>
      </div>
      {pasteOpen && <div className={`${card} space-y-2`}>
        <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={5} aria-label="해석 붙여넣기" placeholder="한 줄에 한 문장의 해석. 1번 문장부터 순서대로 짝지어요." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <div className="flex items-center justify-between text-xs text-slate-500"><label className="flex items-center gap-1"><input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />이미 있는 해석도 바꾸기</label>
          <button type="button" className={primary} onClick={() => { const lines = pasteText.split(/\r?\n/).map(stripKoNumber).filter(Boolean); change(applyTranslations(sentences, lines, overwrite)); setPasteOpen(false); setPasteText(''); setMessage(`해석 ${lines.length}줄을 순서대로 넣었어요${lines.length !== sentences.length ? ` (문장 ${sentences.length}개와 개수가 달라요)` : ''}.`); }}>넣기</button></div>
      </div>}
      <ol className="space-y-2">{sentences.map((s, i) => <li key={s.id} className={`rounded-2xl border bg-white p-3 ${s.ko.trim() ? 'border-[#f3e6e8]' : 'border-[#f5a3a8]'}`}>
        <div className="mb-1 flex items-center justify-between"><b className="text-sm text-[#8b2f40]">{i + 1}</b>
          <span className="flex gap-0.5">
            <button type="button" className={iconBtn} aria-label={`${i + 1}번 위로`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
            <button type="button" className={iconBtn} aria-label={`${i + 1}번 아래로`} disabled={i === sentences.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
            <button type="button" className={iconBtn} aria-label={`${i + 1}번 커서 위치에서 나누기`} onClick={() => split(i)}><Scissors size={15} /></button>
            <button type="button" className={iconBtn} aria-label={`${i + 1}번을 다음 문장과 합치기`} disabled={i === sentences.length - 1} onClick={() => merge(i)}><Merge size={15} /></button>
            <button type="button" className={iconBtn} aria-label={`${i + 1}번 뒤에 문장 추가`} onClick={() => addAfter(i)}><Plus size={15} /></button>
            <button type="button" className={iconBtn} aria-label={`${i + 1}번 삭제`} onClick={() => remove(i)}><Trash2 size={15} /></button>
          </span></div>
        <textarea value={s.text} rows={2} aria-label={`${i + 1}번 영어 문장`} onSelect={e => { caret.current[s.id] = e.currentTarget.selectionStart; }} onChange={e => update(s.id, { text: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm leading-relaxed" />
        <textarea value={s.ko} rows={1} aria-label={`${i + 1}번 한글 해석`} placeholder="해석이 비어 있어요" onChange={e => update(s.id, { ko: e.target.value, koEdited: true })} className={`mt-1 w-full rounded-lg px-2.5 py-1.5 text-sm ${s.ko.trim() ? 'bg-[#fdf6f7] text-[#5e1e2a]' : 'border border-dashed border-[#eaa9b3] text-[#5e1e2a]'}`} />
      </li>)}</ol>
      <div className="flex items-center justify-between"><button type="button" className={quiet} onClick={() => addAfter(sentences.length - 1)}><Plus size={13} aria-hidden="true" />문장 추가</button>
        <button type="button" className={primary} disabled={!!busy || !sentences.length} onClick={() => void generate()}>{busy === 'build' ? '만드는 중…' : '워크북 만들기 →'}</button></div>
    </div>}

    {step === 3 && build && <div className="space-y-2">
      <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
        <span className="flex gap-1.5" role="tablist" aria-label="미리보기">{([['part1', 'Part 1 빈칸'], ['part2', 'Part 2 배열'], ['key', '정답']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${view === id ? 'bg-[#e0587a] text-white' : 'bg-[#f8f1f2] text-[#8b2f40]'}`}>{label}</button>)}</span>
        <span className="text-xs text-slate-500">{history.blanks.length > 0 ? `이 지문으로 만든 이전 워크북 ${history.blanks.length}개와 다르게 골랐어요` : '이 지문으로 처음 만드는 워크북'}</span>
      </div>
      {issues.length ? <ul className="rounded-xl bg-[#fef2f3] px-3 py-2 text-xs text-[#b04a5a]">{issues.slice(0, 6).map(m => <li key={m}>· {m}</li>)}</ul>
        : <p className="rounded-xl bg-[#eef6ea] px-3 py-2 text-xs font-bold text-[#4f7a43]">✓ 문장 {sentences.length} · Part 1 {build.blanks.length} · Part 2 {build.arrange.length} · 정답 {sentences.length} · 모든 문장 빈칸 3개 이상</p>}
      <ol className={`${card} space-y-3`}>
        {view === 'part1' && build.blanks.map((b, n) => <li key={b.id}>
          <p className="text-sm leading-7 text-slate-800"><b className="mr-1 text-[#8b2f40]">{n + 1}.</b>{b.tokens.map((t, i) => <span key={i}><button type="button" onClick={() => setBuild(x => x && ({ ...x, blanks: x.blanks.map((y, k) => k === n ? toggleBlank(y, i) : y) }))} aria-pressed={b.blanks.includes(i)} className={`rounded px-0.5 ${b.blanks.includes(i) ? 'bg-[#fde3e6] font-bold text-[#c2405e] underline' : 'hover:bg-[#fdf6f7]'}`}>{t}</button>{' '}</span>)}</p>
          <p className="text-xs text-slate-500">해석 {b.ko} · <span className={b.blanks.length < 3 ? 'font-bold text-[#b04a5a]' : ''}>빈칸 {b.blanks.length}</span></p>
        </li>)}
        {view === 'part1' && <li className="text-[11px] text-slate-400">단어를 눌러 빈칸을 켜고 끌 수 있어요 (문장마다 3~5개, 관사 제외). Word에는 {blankedText(['word'], [0])} 모양으로 나가요.</li>}
        {view === 'part2' && build.arrange.map((a, n) => <li key={a.id}><p className="text-xs text-slate-500"><b className="mr-1 text-[#8b2f40]">{n + 1}.</b>{a.ko}</p><p className="mt-0.5 text-sm text-slate-800">{arrangeLine(a)}</p></li>)}
        {view === 'key' && build.blanks.map((b, n) => <li key={b.id} className="text-sm text-slate-800"><b className="mr-1 text-[#8b2f40]">{n + 1}.</b>{b.text}<span className="block text-xs text-slate-500">{b.ko}</span></li>)}
      </ol>
      {aiCount > 0 && <label className="flex items-center justify-end gap-1.5 text-xs text-[#8b2f40]"><input type="checkbox" checked={reviewed} onChange={e => setReviewedKey(e.target.checked ? currentReviewKey : '')} />AI 해석 {aiCount}개가 각 문장과 맞는지 확인했어요 (정답 탭에서 문장과 해석을 함께 볼 수 있어요)</label>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`${quiet} sm:mr-auto`} onClick={() => setMaking(true)} title={passage.length > PASSAGE_LIMITS.textChars ? `변형 문제는 ${PASSAGE_LIMITS.textChars.toLocaleString('ko-KR')}자까지만 들어가요` : undefined}><FileQuestion size={13} aria-hidden="true" />이 지문으로 변형 문제 만들기 →</button>
        <button type="button" className={quiet} disabled={!!busy} onClick={() => void generate(true)}><RefreshCw size={13} aria-hidden="true" />다시 섞기</button>
        <button type="button" className={`${primary} inline-flex items-center gap-1`} disabled={!!busy || issues.length > 0 || (aiCount > 0 && !reviewed)} onClick={() => void download()}><Download size={15} aria-hidden="true" />{busy === 'docx' ? '만드는 중…' : 'Word 다운로드'}</button>
      </div>
      {/* 학생: a workbook made (its Word file taken) can be checked by the teacher once done on paper */}
      {(savedKey === build.key || history.blanks.length > 0) && <CertRequest kind="workbook" refId={build.key} />}
    </div>}
  </section>;
}
/** "1. 해석" / "1) 해석" pasted from a numbered list: the number is not part of the translation. */
const stripKoNumber = (line: string) => line.replace(/^\s*(?:\(?\d{1,3}[).]|[①-⑳])\s*/, '').trim();

