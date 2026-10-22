import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FileText, X } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { matchesKoreanSearch } from '../../lib/koreanSearch';
import { daySheets, memoPicks, type MemoBook, type MemoPick } from '../../lib/memoWordbooks';
import { prefetchBookWords, prefetchWordbookManager } from '../../lib/wordbookPrefetch';

// 바로 출력 칩 (수업 일지): a memo line naming a word book and its DAYs, or starting with "단어:", gives a chip under it;
// the chip opens that book's 시험지 or 단어장 출력 right here (the 학습 세트 screen's own windows), so the teacher stays
// on the 수업 일지.
const WordbookManager = lazy(() => import('./WordbookManager'));

/** A word book as the chip keeps it: the stored book too, so the window opens it without reading the whole list again. */
type Book = MemoBook & { data?: any };
/** The teacher's word books (the 학습 세트 › 단어장 list), read once a visit — per account (another sign-in reads its own). */
let booksOnce: { uid: string; read: Promise<Book[]> } | null = null;
function teacherBooks() {
  const user = auth.currentUser; if (!user) return Promise.resolve([]);
  if (booksOnce?.uid === user.uid) return booksOnce.read;
  const read = getDocs(user.email === 'lizzieshere1@gmail.com' ? query(collection(db, 'wordbooks')) : query(collection(db, 'wordbooks'), where('createdBy', '==', user.uid)))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(b => (b.category || (b.type === 'irregular' ? 'grammar' : 'word')) === 'word' && !b.deletedAt).map(b => ({ id: b.id, title: String(b.title || '단어장'), data: b })))
    .catch(() => { if (booksOnce?.read === read) booksOnce = null; return [] as Book[]; });
  booksOnce = { uid: user.uid, read };
  return read;
}
const dayText = (p: MemoPick) => p.start === null ? '' : p.start === p.end ? ` · Day ${p.start}` : ` · Day ${p.start}~${p.end}`;

/** `preset`: the books to match instead of reading them (the design preview). */
export default function MemoPrintChips({ text, studentName, preset }: { text: string; studentName?: string; preset?: MemoBook[] }) {
  const [books, setBooks] = useState<MemoBook[]>(preset || []), [open, setOpen] = useState<MemoPick | null>(null);
  const wants = /단어\s*:|\bday\s*\d/i.test(text || '');
  useEffect(() => { if (wants && !books.length) void teacherBooks().then(setBooks); }, [wants]); // eslint-disable-line react-hooks/exhaustive-deps
  const { picks, ask } = useMemo(() => wants ? memoPicks(text, books) : { picks: [], ask: null }, [text, books, wants]);
  // a chip shown: the 학습 세트 window's code comes ahead, so 시험지 만들기 does not wait for it
  const shown = Boolean(picks.length || ask);
  useEffect(() => { if (shown) prefetchWordbookManager(); }, [shown]);
  // 한번에 / 나눠서 per chip: the memo's own split first ("1~2, 3~4"), else 한번에 until the teacher picks 나눠서
  const [split, setSplit] = useState<Record<number, boolean>>({});
  if (!picks.length && !ask) return null;
  const chip = 'inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11px] font-bold';
  const seg = (on: boolean) => `px-2 py-0.5 ${on ? 'bg-slate-100 text-slate-700' : 'text-slate-400'}`;
  return <div className="mt-1 flex flex-wrap items-center gap-1">
    {picks.map((p, i) => {
      const sheets = daySheets(p), apart = sheets.length >= 2 && (split[i] ?? Boolean(p.groups?.length)), title = p.books.length === 1 ? p.books[0].title : `${p.books[0].title} 외 ${p.books.length - 1}개`;
      const parts: MemoPick[] = apart ? sheets.map(s => ({ ...p, start: s.start, end: s.end })) : [p];
      return <span key={i} className="inline-flex max-w-full flex-wrap items-center gap-1">
        {parts.map((part, k) => <button key={k} type="button" onClick={() => setOpen(part)} className={`${chip} border-[#b5d4f4] bg-[#e6f1fb] text-[#0c447c]`} title="시험지·단어장 바로 출력">
          <FileText size={11} aria-hidden="true" />{k === 0 ? title : ''}{k === 0 ? dayText(part) : dayText(part).replace(/^ · /, '')}</button>)}
        {sheets.length >= 2 && <span role="group" aria-label="시험지 나누기" className="inline-flex overflow-hidden rounded-full border border-slate-200 text-[11px] font-bold">
          <button type="button" aria-pressed={!apart} onClick={() => setSplit(s => ({ ...s, [i]: false }))} className={seg(!apart)}>한번에</button>
          <button type="button" aria-pressed={apart} onClick={() => setSplit(s => ({ ...s, [i]: true }))} className={seg(apart)}>나눠서</button></span>}
      </span>;
    })}
    {ask && <button type="button" onClick={() => setOpen({ ...ask, books })} className={`${chip} border-dashed border-slate-300 bg-white text-slate-500`}><FileText size={11} aria-hidden="true" />학습 세트 고르기{dayText(ask)}</button>}
    {open && <QuickPrint pick={open} studentName={studentName} onClose={() => setOpen(null)} />}
  </div>;
}

/** Pick the book (when the memo did not name just one), then 시험지 or 단어장 출력: the 학습 세트 window opens on that book with
 *  the memo's DAYs (the start, and the end the memo gave or the next DAY). */
function QuickPrint({ pick, studentName, onClose }: { pick: MemoPick; studentName?: string; onClose: () => void }) {
  const [book, setBook] = useState<MemoBook | null>(pick.books.length === 1 ? pick.books[0] : null), [q, setQ] = useState(''), [mode, setMode] = useState<'test' | 'print' | null>(null);
  // the book chosen: its words are read while 시험지 or 단어장 출력 is picked
  useEffect(() => { if (book) void prefetchBookWords(book.id).catch(() => {}); }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = pick.books.filter(b => !q.trim() || matchesKoreanSearch(b.title, q.trim())).slice(0, 30);
  if (book && mode) return <Suspense fallback={null}><WordbookManager quick={{ wordbookId: book.id, wordbook: (book as Book).data, mode, startDay: pick.start ?? undefined, endDay: pick.end ?? undefined, studentName }} onQuickClose={onClose} /></Suspense>;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
    <div role="dialog" aria-label="바로 출력" className="w-full max-w-sm rounded-3xl bg-white p-5 text-slate-800 shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between"><b className="text-sm font-black">{book ? book.title : '학습 세트 고르기'}</b><button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-1 hover:bg-slate-100"><X size={16} /></button></div>
      {studentName && <p className="mt-0.5 text-xs text-slate-500">{studentName}{dayText(pick)}</p>}
      {!book ? <>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="이름·초성 검색 (예: ㄴㄹ)" aria-label="학습 세트 검색" className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-blue-100" />
        <ul className="mt-2 max-h-64 overflow-y-auto">{list.map(b => <li key={b.id}><button type="button" onClick={() => setBook(b)} className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-blue-50">{b.title}</button></li>)}
          {!list.length && <li className="px-3 py-4 text-center text-xs text-slate-400">찾는 학습 세트가 없어요</li>}</ul>
      </> : <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode('test')} className="rounded-2xl bg-blue-500 py-3 text-sm font-bold text-white">시험지 만들기</button>
        <button type="button" onClick={() => setMode('print')} className="rounded-2xl border border-pink-200 bg-pink-50 py-3 text-sm font-bold text-pink-700">단어장 출력</button>
        {pick.books.length > 1 && <button type="button" onClick={() => setBook(null)} className="col-span-2 text-xs font-bold text-slate-500">다른 학습 세트 고르기</button>}
      </div>}
    </div>
  </div>;
}
