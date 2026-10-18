import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import type { Passage } from '../../lib/passageApi';
import { DEFAULT_SHEET_OPTIONS, SHEET_KIND_LABEL, layoutSheet, sheetAvailability, stars, type SheetKind, type SheetLayout, type SheetLine, type SheetOptions, type SheetRun } from '../../lib/analysisSheet';
import { fileName, partTitle, printFooter, saveBlob } from '../../lib/printFrame';
import { FooterSetting, PrintPage, PrintPortal } from '../print/PrintSheet';
import './analysisSheet.css';

// 지문 분석지 · 해석 연습 (5단계): 인쇄 | Word beside the passage title. Either opens a small panel (which sheet, what to
// put in, landscape or portrait, 바닥글), then prints or saves. Both outputs use the same layout (layoutSheet).

const OPTIONS_KEY = 'analysis-sheet-options';
function savedOptions(): SheetOptions {
  try { const v = JSON.parse(localStorage.getItem(OPTIONS_KEY) || 'null'); if (v && typeof v === 'object') return { ...DEFAULT_SHEET_OPTIONS, ...v }; } catch { /* storage off */ }
  return DEFAULT_SHEET_OPTIONS;
}

const Runs = ({ runs }: { runs: SheetRun[] }) => <>{runs.map((r, k) => <span key={k}>{k ? ' ' : ''}{r.kind ? <span className="as-link">{r.text}</span> : r.text}</span>)}</>;
function Line({ line, meaning }: { key?: number; line: SheetLine; meaning: boolean }) {
  const essay = line.essay && <span className="as-essay">서술형</span>, last = line.rows.length - 1;
  return <div className={`as-line${line.write ? ' as-practice' : ''}`}>
    {meaning ? line.rows.map((row, r) => <div key={r} className="as-row" style={r ? { paddingLeft: '4.5mm' } : undefined}>
      {r === 0 && <span className="as-num">{line.index + 1}</span>}
      {row.map((c, k) => <span key={k} className="as-row"><span className="as-chunk"><span className="as-en"><Runs runs={c.runs} />{r === last && k === row.length - 1 && essay}</span><span className="as-ko">{c.ko}</span></span>{(k < row.length - 1 || r < last) && <span className="as-slash">/</span>}</span>)}
    </div>) : <p className="as-flow"><span className="as-num" style={{ display: 'inline-block', textIndent: 0 }}>{line.index + 1}</span>{line.rows.flat().map((c, k) => <span key={k}>{k > 0 && <span className="as-slash">/</span>}<Runs runs={c.runs} /></span>)}{essay}</p>}
    {line.notes.map((n, k) => <p key={k} className="as-note">· {n}</p>)}
    {line.full && <p className="as-full">{line.full}</p>}
    {Array.from({ length: line.write }, (_, k) => <div key={k} className="as-write" />)}
  </div>;
}
function Panel({ layout }: { layout: SheetLayout }) {
  const p = layout.panel!;
  return <div>
    {p.structure.length > 0 && <div className="as-box"><b>글의 구조</b>{p.structure.map((e, k) => <span key={k} className={`as-role${e.key ? ' key' : ''}`}><i>{e.key ? '★ ' : ''}{e.role}</i>{e.nums}</span>)}</div>}
    {p.mainIdea && <div className="as-box"><b>요지</b>{p.mainIdea}</div>}
    {p.summary && <div className="as-box"><b>요약</b>{p.summary.ko}{p.summary.en && <span className="block text-[7.5pt] text-[#5f5e5a]">{p.summary.en}</span>}</div>}
    {p.title && <div className="as-box"><b>제목</b>{p.title}</div>}
    {p.words.length > 0 && <div className="as-box"><b>핵심 어휘</b><div className="as-words">{p.words.map(w => <div key={w.word}>{w.word} <span className="text-[#5f5e5a]">{w.meaning}</span></div>)}</div></div>}
  </div>;
}
/** The printed pages (A4) of a laid-out sheet. */
export function AnalysisSheetPages({ layout, footer }: { layout: SheetLayout; footer: string }) {
  const kind = SHEET_KIND_LABEL[layout.kind], name = `${layout.title} · ${kind}`;
  return <>{layout.pages.map(page => <PrintPage key={page.number} title={partTitle(name, page.number, layout.pages.length)} number={page.number} footer={footer}>
    {page.first && <div className="as-top"><div><div className="as-title">{name}</div><div className="as-sub">{[layout.subtitle, layout.topic && `주제 ${layout.topic}`, layout.level && `난이도 ${stars(layout.level)}`].filter(Boolean).join(' · ')}</div></div><span className="as-name">이름 __________ &nbsp; 날짜 ______</span></div>}
    <div className={`as-grid ${page.first && layout.panel ? 'as-grid-panel' : 'as-grid-two'}`}>
      {page.columns.map((col, c) => <div key={c}>{col.map(l => <Line key={l.index} line={l} meaning={layout.meaning} />)}</div>)}
      {page.first && layout.panel && <Panel layout={layout} />}
    </div>
  </PrintPage>)}</>;
}

const chip = (on: boolean, off = false) => `rounded-full border px-2.5 py-1 text-xs font-bold ${off ? 'cursor-not-allowed border-dashed border-slate-200 text-slate-300' : on ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 text-slate-600 hover:border-[#eaa0a9]'}`;
const PARTS: { id: keyof Pick<SheetOptions, 'meaning' | 'full' | 'grammar' | 'summary' | 'words'>; label: string; kinds: SheetKind[]; missing: string }[] = [
  { id: 'meaning', label: '덩어리 해석', kinds: ['analysis'], missing: '직독직해 해석을 먼저 받아 주세요' },
  { id: 'full', label: '문장 전체 해석', kinds: ['analysis'], missing: '직독직해 해석을 먼저 받아 주세요' },
  { id: 'grammar', label: '문법 포인트', kinds: ['analysis'], missing: '' },
  { id: 'summary', label: '구조·요지·요약', kinds: ['analysis', 'practice'], missing: '주제·요약을 먼저 받아 주세요' },
  { id: 'words', label: '핵심 어휘', kinds: ['analysis', 'practice'], missing: '③ 단어 탭을 한 번 열어 주세요' },
];

/** 인쇄 | Word for a passage: one joined pair of buttons, then the small options panel. */
export default function AnalysisSheetOutput({ passage }: { passage: Passage }) {
  const [open, setOpen] = useState<'' | 'print' | 'word'>(''), [options, setOptions] = useState(savedOptions), [printing, setPrinting] = useState<SheetLayout | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const has = sheetAvailability(passage), box = useRef<HTMLDivElement>(null);
  // what the sheet really uses: options for parts not made yet are off
  const used = useMemo<SheetOptions>(() => ({ ...options, meaning: options.meaning && has.meaning, full: options.full && has.full, summary: options.summary && has.summary, words: options.words && has.words }), [options, has.meaning, has.full, has.summary, has.words]);
  const set = (patch: Partial<SheetOptions>) => setOptions(o => { const next = { ...o, ...patch }; try { localStorage.setItem(OPTIONS_KEY, JSON.stringify(next)); } catch { /* not kept */ } return next; });
  useEffect(() => { // closes on Escape or a tap outside
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(''); };
    const tap = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(''); };
    window.addEventListener('keydown', key); window.addEventListener('mousedown', tap);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('mousedown', tap); };
  }, [open]);
  const go = async () => {
    const layout = layoutSheet(passage, used);
    if (open === 'print') { setOpen(''); setPrinting(layout); return; }
    setBusy(true); setMessage('');
    try { const { analysisSheetDocx } = await import('../../lib/analysisSheetDocx'); saveBlob(await analysisSheetDocx(layout, printFooter()), fileName(layout.title, SHEET_KIND_LABEL[used.kind])); setOpen(''); }
    catch { setMessage('Word 파일을 만들지 못했어요.'); } finally { setBusy(false); }
  };
  const pages = open ? layoutSheet(passage, used).pages.length : 0;
  return <div ref={box} className="relative">
    <span className="inline-flex overflow-hidden rounded-lg border border-slate-200 text-xs font-bold text-slate-600">
      <button type="button" aria-expanded={open === 'print'} onClick={() => setOpen(x => x === 'print' ? '' : 'print')} className={`inline-flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-50 ${open === 'print' ? 'bg-[#fef2f3] text-[#8b2f40]' : ''}`}><Printer size={14} aria-hidden="true" />인쇄</button>
      <button type="button" aria-expanded={open === 'word'} onClick={() => setOpen(x => x === 'word' ? '' : 'word')} className={`inline-flex items-center gap-1 border-l border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 ${open === 'word' ? 'bg-[#eef4fb] text-[#185fa5]' : ''}`}><FileText size={14} className="text-[#185fa5]" aria-hidden="true" />Word</button>
    </span>
    {open && <div role="dialog" aria-label={open === 'print' ? '분석지 인쇄' : '분석지 Word 저장'} className="fixed inset-x-3 bottom-3 z-30 rounded-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-[19rem] border border-[#f3e6e8] bg-white p-3 text-left shadow-lg">
      <p className="text-[11px] font-bold text-slate-500">종류</p>
      <div className="mt-1 flex gap-1.5">{(['analysis', 'practice'] as const).map(k => <button key={k} type="button" aria-pressed={options.kind === k} onClick={() => set({ kind: k })} className={chip(options.kind === k)}>{SHEET_KIND_LABEL[k]}</button>)}</div>
      <p className="mt-1 text-[11px] text-slate-400">{options.kind === 'analysis' ? '끊은 덩어리마다 아래에 해석이 붙어요.' : '해석 자리에 한 줄씩 쓰는 칸이 생겨요. 요지·요약·제목은 빠져요.'}</p>
      <p className="mt-2.5 text-[11px] font-bold text-slate-500">넣을 내용</p>
      <div className="mt-1 flex flex-wrap gap-1.5">{PARTS.filter(x => x.kinds.includes(options.kind)).map(x => { const off = !has[x.id];
        return <button key={x.id} type="button" aria-pressed={used[x.id]} disabled={off} title={off ? x.missing : undefined} onClick={() => set({ [x.id]: !options[x.id] })} className={chip(used[x.id], off)}>{x.label}</button>; })}</div>
      {PARTS.some(x => x.kinds.includes(options.kind) && !has[x.id]) && <p className="mt-1 text-[11px] text-slate-400">흐린 항목은 아직 받지 않은 내용이에요.</p>}
      <p className="mt-2.5 text-[11px] font-bold text-slate-500">방향</p>
      <div className="mt-1 flex gap-1.5">{([['landscape', '가로'], ['portrait', '세로']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={options.orientation === id} onClick={() => set({ orientation: id })} className={chip(options.orientation === id)}>{label}</button>)}</div>
      <div className="mt-2.5"><FooterSetting /></div>
      {message && <p role="alert" className="mt-2 text-xs font-bold text-[#b04a5a]">{message}</p>}
      <div className="mt-3 flex items-center gap-2"><span className="text-[11px] text-slate-400">A4 {pages}쪽 · 이름·날짜 칸 포함</span>
        <button type="button" disabled={busy} onClick={() => void go()} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#d26272] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{open === 'print' ? <><Printer size={13} aria-hidden="true" />인쇄하기</> : <><FileText size={13} aria-hidden="true" />{busy ? '만드는 중…' : 'Word 저장'}</>}</button></div>
    </div>}
    <PrintPortal active={Boolean(printing)} orientation={printing?.orientation} onDone={() => setPrinting(null)}>{printing && <AnalysisSheetPages layout={printing} footer={printFooter()} />}</PrintPortal>
  </div>;
}
