import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

/** A small ⓘ beside a title: the explanation shows on hover (mouse) or tap (touch) and closes on Esc, a tap outside or
 *  a second tap. Keeps long guide text off the screen until someone wants it. */
export default function InfoTip({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false), id = useId(), box = useRef<HTMLSpanElement>(null), hoverable = useRef(false);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  return <span ref={box} className={`relative inline-flex ${className}`}
    onPointerEnter={e => { if (e.pointerType === 'mouse') { hoverable.current = true; setOpen(true); } }}
    onPointerLeave={e => { if (e.pointerType === 'mouse') setOpen(false); }}>
    <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined}
      onClick={() => { if (!hoverable.current) setOpen(o => !o); hoverable.current = false; }}
      className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-[#8b2f40] focus-visible:text-[#8b2f40]">
      <Info size={15} aria-hidden="true" />
    </button>
    {open && <span id={id} role="tooltip" className="absolute left-1/2 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-[#f3e6e8] bg-white px-3 py-2 text-left text-xs font-normal leading-relaxed text-slate-600 shadow-lg">{children}</span>}
  </span>;
}
