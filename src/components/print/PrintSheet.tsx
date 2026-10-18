import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { APP_NAME, DEFAULT_FOOTER, PRINT_LOGO, printFooter, setPrintFooter, type Orientation } from '../../lib/printFrame';
import './printSheet.css';

// 출력 공통 틀 (인쇄): the pages to print are drawn apart from the screen (only they print), each A4 page with the logo and
// the app name at the top left, the title on the right, and the footer with the page number at the bottom.

/** One printed page. `number`: the page number shown at the bottom. */
export function PrintPage({ title, subtitle, number, footer, children }: { key?: string | number; title: string; subtitle?: string; number: number; footer: string; children: ReactNode }) {
  return <section className="print-page">
    <header className="print-page-head"><span className="print-brand"><img src={PRINT_LOGO} alt="" width={16} height={16} />{APP_NAME}</span><span className="print-title">{[title, subtitle].filter(Boolean).join(' · ')}</span></header>
    <div className="print-page-body">{children}</div>
    <footer className="print-page-foot"><span>{footer}</span><span>{number}</span></footer>
  </section>;
}

/** While `active`: the pages are put apart from the screen, the browser prints them (A4, the orientation given), then
 *  `onDone`. Nothing shows on screen. */
export function PrintPortal({ active, orientation = 'portrait', onDone, children }: { active: boolean; orientation?: Orientation; onDone: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!active) return;
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 ${orientation}; margin: 0; }`;
    document.head.appendChild(style); document.body.classList.add('print-sheets', `print-${orientation}`);
    let finished = false, printed = false, blurred = false;
    const media = window.matchMedia?.('print');
    const finish = () => { if (finished) return; finished = true; style.remove(); document.body.classList.remove('print-sheets', `print-${orientation}`); window.removeEventListener('afterprint', finish); media?.removeEventListener?.('change', onMedia); window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onBlur); onDone(); };
    // Cleaned up only once printing has ended: afterprint, or the print media turning off, or (browsers with neither)
    // the window getting its focus back after it really lost it to the dialog (a focus without a blur first is ignored).
    const onMedia = (e: MediaQueryListEvent) => { if (!e.matches && printed) finish(); };
    const onBlur = () => { if (printed) blurred = true; };
    const onFocus = () => { if (printed && blurred) window.setTimeout(finish, 300); };
    window.addEventListener('afterprint', finish);
    media?.addEventListener?.('change', onMedia);
    // two frames: the pages (and the logo) are laid out before the print dialog opens
    const t = window.setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => { printed = true; window.addEventListener('blur', onBlur); window.addEventListener('focus', onFocus); window.print(); })), 50);
    return () => { window.clearTimeout(t); finish(); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  return active ? createPortal(<div className={`print-root print-root-${orientation}`}>{children}</div>, document.body) : null;
}

/** 바닥글: shown beside 인쇄 · Word; tap to change (kept on this device; empty = 채움학원 지원T). */
export function FooterSetting({ onChange }: { onChange?: (footer: string) => void }) {
  const [footer, setFooter] = useState(printFooter), [editing, setEditing] = useState(false), [draft, setDraft] = useState('');
  const save = () => { const v = setPrintFooter(draft); setFooter(v); setEditing(false); onChange?.(v); };
  if (editing) return <span className="inline-flex items-center gap-1 text-xs">
    <input autoFocus value={draft} maxLength={80} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} placeholder={DEFAULT_FOOTER} aria-label="바닥글" className="w-40 rounded-lg border border-[#f3d5da] px-2 py-1" />
    <button type="button" onClick={save} className="rounded-lg bg-[#d26272] px-2 py-1 font-bold text-white">저장</button>
  </span>;
  return <button type="button" onClick={() => { setDraft(footer === DEFAULT_FOOTER ? '' : footer); setEditing(true); }} title="바닥글 바꾸기 (이 기기에 기억 · 비우면 기본값)" className="inline-flex items-center gap-1 rounded-full border border-[#f3d5da] bg-[#fef2f3] px-2.5 py-1 text-xs font-bold text-[#8b2f40]">
    <span className="font-medium text-slate-500">바닥글</span>{footer}<Pencil size={11} aria-hidden="true" /></button>;
}
