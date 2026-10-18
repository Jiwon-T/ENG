import { useEffect, useRef, type ReactNode } from 'react';
import { Eye, X } from 'lucide-react';

// 샘플 보기: a small button and the popup it opens, shared by 지문 분석, 변형 문제 만들기 and 워크북. The popup says that
// the sample is made from one example passage, with no request and nothing counted.
export function SampleButton({ onClick, label = '샘플 보기' }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:border-[#eaa0a9] hover:text-[#8b2f40]"><Eye size={12} aria-hidden="true" />{label}</button>;
}

export default function SampleModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); before?.focus?.(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sample-title" onClick={onClose}>
    <section ref={box} tabIndex={-1} className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#fffafa] px-4 pb-5 pt-3 outline-none sm:rounded-3xl" onClick={e => e.stopPropagation()}>
      <header className="sticky top-0 z-10 -mx-4 flex items-start gap-2 bg-[#fffafa] px-4 pb-2 pt-1">
        <div className="min-w-0 flex-1"><h2 id="sample-title" className="text-base font-black text-[#5e1e2a]">{title}</h2>
          <p className="text-[11px] text-slate-400">예시 지문 1개로 만든 샘플이에요 · 서버에 요청하지 않고 사용 횟수도 들지 않아요</p></div>
        <button type="button" onClick={onClose} aria-label="샘플 닫기" className="rounded-lg p-1 text-slate-400 hover:bg-[#fef2f3] hover:text-[#8b2f40]"><X size={18} /></button>
      </header>
      {children}
    </section>
  </div>;
}
