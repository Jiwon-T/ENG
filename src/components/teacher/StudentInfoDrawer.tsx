import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** 수업 일지 › 학생 정보: a drawer over the right of the screen (a sheet from below on a phone) with 학생 관리's page of the
 *  chosen student. It lies over the 일지 instead of moving it, scrolls on its own, and closes with ✕ or Esc (asking first
 *  when something there is not saved). */
export default function StudentInfoDrawer({ name, onClose, children }: { name: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose(); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  return <aside role="complementary" aria-label={`${name} 학생 정보`}
    className="fixed z-50 flex flex-col bg-white shadow-2xl max-sm:inset-x-0 max-sm:bottom-0 max-sm:h-[85vh] max-sm:rounded-t-3xl sm:inset-y-0 sm:right-0 sm:w-[440px] sm:border-l sm:border-[#f3e6e8]">
    <div className="flex flex-none items-center gap-2 border-b border-[#f3e6e8] px-4 py-2.5">
      <b className="min-w-0 flex-1 truncate text-xs font-bold text-slate-500">학생 정보</b>
      <button type="button" onClick={onClose} aria-label="학생 정보 닫기" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} aria-hidden="true" /></button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">{children}</div>
  </aside>;
}
