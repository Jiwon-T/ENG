import { useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { CIRCLED, typeLabel } from '../../lib/questionMaker';
import { fileName, printFooter, saveBlob } from '../../lib/printFrame';
import { answerText, packQuestions, type SheetQuestion } from '../../lib/questionSheet';
import { FooterSetting, PrintPage, PrintPortal } from '../print/PrintSheet';
import { Marked } from './QuestionSolve';

// 변형 문제지 출력: 바닥글 · 인쇄 · Word for one set or several put together (numbering goes on). Printing draws the A4
// pages apart from the screen (questions never cut in two, the answers and explanations last).

function SheetPages({ title, items, footer }: { title: string; items: SheetQuestion[]; footer: string }) {
  const pages = packQuestions(items), keyPages: SheetQuestion[][] = [];
  for (let i = 0; i < items.length; i += 18) keyPages.push(items.slice(i, i + 18));
  let number = 0;
  return <>
    {pages.map((page, k) => <PrintPage key={`q${k}`} title={title} number={++number} footer={footer}><div className="print-columns">
      {page.map(it => <div key={it.n} className="mb-4 break-inside-avoid">
        <p className="font-bold">{it.n}. {it.q.prompt}</p>
        {it.q.box && <p className="mt-1.5 border border-slate-500 px-3 py-1.5">{it.q.box}</p>}
        {it.q.paragraphs?.map(p => <p key={p.label} className="mt-1"><b className="mr-1">{p.label}</b>{p.text}</p>)}
        {it.q.passage && <p className="mt-1.5 whitespace-pre-wrap"><Marked text={it.q.passage} /></p>}
        {it.q.options && <ol className="mt-1.5 pl-3">{it.q.options.map((o, i) => <li key={i}>{CIRCLED[i]} {o}</li>)}</ol>}
        {it.q.type === 'correct' && (it.q.answer as string[]).map((_, k) => <p key={k} className="mt-1.5">(&nbsp;&nbsp;&nbsp;&nbsp;) ______________ → ______________</p>)}
        {it.q.type === 'compose' && <div className="mt-5 border-b border-slate-500" aria-hidden="true" />}
      </div>)}
    </div></PrintPage>)}
    {keyPages.map((list, k) => <PrintPage key={`a${k}`} title={`${title} · 정답 · 해설`} number={++number} footer={footer}>
      {list.map(it => <div key={it.n} className="mb-2 break-inside-avoid text-[9.5pt]">
        <p><b>{it.n}. <span className="text-[#8b2f40]">{answerText(it.q)}</span></b> <span className="text-[8pt] text-slate-400">{typeLabel(it.q.type)}</span></p>
        {it.q.explanation && <p className="whitespace-pre-line pl-4 text-slate-600">{it.q.explanation}</p>}
      </div>)}
    </PrintPage>)}
  </>;
}

/** 바닥글 · 인쇄 · Word. `load` gives the questions (numbered); it may fetch (several sets). */
export default function SheetOutput({ title, load, disabled = false }: { title: string; load: () => Promise<SheetQuestion[]> | SheetQuestion[]; disabled?: boolean }) {
  const [items, setItems] = useState<SheetQuestion[] | null>(null), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const run = async (kind: 'print' | 'word') => {
    if (busy || disabled) return; setBusy(kind); setMessage('');
    try {
      const list = await load();
      if (!list.length) throw Error('출력할 문제가 없어요.');
      if (kind === 'print') { setItems(list); return; }
      const { questionSheetDocx } = await import('../../lib/questionSheet');
      saveBlob(await questionSheetDocx({ title }, list), fileName(title, '변형 문제'));
    } catch (e: any) { setMessage(e?.message || '만들지 못했어요.'); } finally { if (kind === 'word') setBusy(''); }
  };
  return <span className="inline-flex flex-wrap items-center gap-1.5">
    <FooterSetting />
    <button type="button" disabled={disabled || Boolean(busy)} onClick={() => void run('print')} className="inline-flex items-center gap-1 rounded-lg border border-[#f3d5da] px-2.5 py-1 text-xs font-bold text-[#8b2f40] disabled:opacity-50"><Printer size={13} aria-hidden="true" />인쇄</button>
    <button type="button" disabled={disabled || Boolean(busy)} onClick={() => void run('word')} className="inline-flex items-center gap-1 rounded-lg border border-[#f3d5da] px-2.5 py-1 text-xs font-bold text-[#8b2f40] disabled:opacity-50"><FileDown size={13} aria-hidden="true" />{busy === 'word' ? '만드는 중…' : 'Word'}</button>
    {message && <span role="alert" className="text-xs font-bold text-[#b04a5a]">{message}</span>}
    <PrintPortal active={Boolean(items)} orientation="portrait" onDone={() => { setItems(null); setBusy(''); }}>
      {items && <SheetPages title={title} items={items} footer={printFooter()} />}
    </PrintPortal>
  </span>;
}
