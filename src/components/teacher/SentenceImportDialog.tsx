import { useMemo, useState } from 'react';
import { Sparkles, Trash2, X } from 'lucide-react';
import { collection, doc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { WORKBOOK_LIMITS } from '../../lib/workbook';
import { parseSentences, showSentence, type SentenceRow } from '../../lib/sentenceImport';

// Each row keeps an id, so an AI answer or an edit always lands on the row it was meant for.
type Row = SentenceRow & { id: number };
let nextRowId = 1;
import { AiWorking, workbookTranslate } from './workbookAi';
import type { Word } from './wordbookTypes';

/**
 * 문장 세트 › 문장 붙여넣기: paste → a table to check and fix (numbers taken off, empty translations marked) → save to a
 * Day. "빈 해석 AI로 채우기" uses the 워크북 AI 해석 (the same monthly count).
 */
export default function SentenceImportDialog({ wordbookId, words, defaultDay, onClose, onSaved }: {
  wordbookId: string; words: Word[]; defaultDay: number; onClose: () => void; onSaved: (count: number, day: number) => void;
}) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [day, setDay] = useState(Math.max(1, defaultDay));
  const [busy, setBusy] = useState<'' | 'ai' | 'save'>('');
  const [message, setMessage] = useState('');
  const [savedCount, setSavedCount] = useState(0); // saved before a later part failed
  // Fixed at the first 저장: the Day and each row's document id and order (see save).
  const [plan, setPlan] = useState<{ day: number; slots: Record<number, { docId: string; order: number }> } | null>(null);
  const missing = useMemo(() => (rows || []).filter(r => r.english.trim() && !r.korean.trim()).length, [rows]);

  const read = () => { const r = parseSentences(text); setRows(r.rows.map(row => ({ ...row, id: nextRowId++ }))); setSkipped(r.skipped); setMessage(r.rows.length ? '' : '영어 문장을 찾지 못했어요. 붙여 넣은 내용을 확인해 주세요.'); };
  const edit = (id: number, key: keyof SentenceRow, value: string) => setRows(list => list && list.map(r => r.id === id ? { ...r, [key]: value } : r));
  const remove = (id: number) => setRows(list => list && list.filter(r => r.id !== id));

  const fill = async () => {
    if (!rows || busy) return;
    const asked = rows.filter(r => r.english.trim() && !r.korean.trim()).map(r => ({ id: r.id, english: r.english }));
    if (!asked.length) return;
    setBusy('ai'); setMessage('');
    try {
      let left: number | null | undefined;
      // The AI gets the sentence without the / marks; 80 sentences a call at most.
      for (let at = 0; at < asked.length; at += WORKBOOK_LIMITS.sentences) {
        const part = asked.slice(at, at + WORKBOOK_LIMITS.sentences);
        const r = await workbookTranslate(part.map(x => showSentence(x.english)));
        left = r.left;
        // Only rows still empty and with the same English get the translation (anything typed meanwhile stays).
        setRows(list => list && list.map(row => { const j = part.findIndex(x => x.id === row.id); return j >= 0 && !row.korean.trim() && row.english === part[j].english ? { ...row, korean: r.translations[j] || '' } : row; }));
      }
      setMessage(`해석 ${asked.length}개를 채웠어요. 확인하고 고쳐 주세요.${typeof left === 'number' ? ` (이번 달 남은 AI 해석 ${left}번)` : ''}`);
    } catch (e: any) { setMessage(e?.message || 'AI 해석을 받지 못했어요.'); }
    finally { setBusy(''); }
  };

  const save = async () => {
    const list = (rows || []).filter(r => r.english.trim());
    if (!list.length || busy) return;
    setBusy('save'); setMessage('');
    // The first press fixes the Day and, for every row, its document id and order. Trying again after a failure (or
    // after a reply that never came) writes the same documents again, so nothing is saved twice and nothing moves.
    let fixed = plan;
    if (!fixed) {
      const inDay = words.filter(w => (Number(w.day) || 1) === day), start = inDay.length ? Math.max(...inDay.map(w => Number(w.order) || 0)) + 1 : 1;
      fixed = { day, slots: Object.fromEntries(list.map((r, k) => [r.id, { docId: doc(collection(db, `wordbooks/${wordbookId}/words`)).id, order: start + k }])) };
      setPlan(fixed);
    }
    let saved = 0;
    try {
      // A Firestore batch holds 500 writes: save in parts of 400; a part that went in leaves the table.
      for (let at = 0; at < list.length; at += 400) {
        const part = list.slice(at, at + 400), batch = writeBatch(db);
        part.forEach(r => { const slot = fixed!.slots[r.id]; batch.set(doc(db, `wordbooks/${wordbookId}/words`, slot.docId), { word: r.english.trim(), meaning: r.korean.trim(), day: fixed!.day, order: slot.order, createdAt: Timestamp.now() }); });
        await batch.commit();
        saved += part.length;
        const done = new Set(part.map(r => r.id));
        setRows(cur => cur && cur.filter(r => !done.has(r.id)));
      }
      onSaved(savedCount + saved, fixed.day);
    } catch {
      setSavedCount(n => n + saved);
      setMessage(saved || savedCount ? `${savedCount + saved}문장은 저장됐어요. 남은 ${list.length - saved}문장은 저장하지 못했어요. 다시 저장을 눌러 주세요(같은 자리에 저장돼요).` : '저장하지 못했어요. 다시 저장을 눌러 주세요(두 번 저장되지 않아요).');
      setBusy('');
    }
  };

  const input = 'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none hover:border-slate-200 focus:border-[#eaa0a9] focus:bg-white';
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="문장 붙여넣기">
    <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-4 text-slate-700 shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <b className="text-base text-[#5e1e2a]">문장 붙여넣기</b>
        <span className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Day <input type="number" min={1} max={999} value={plan?.day ?? day} disabled={!!plan} onChange={e => setDay(Math.max(1, Math.min(999, Number(e.target.value) || 1)))} className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm" /></label>
          <button type="button" onClick={onClose} aria-label="닫기" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </span>
      </div>
      {!rows ? <>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={10} autoFocus aria-label="붙여 넣을 문장" placeholder={'001. I want / to be a doctor.\n나는 의사가 되고 싶다.\n2 She is reading / a book. 그녀는 책을 읽고 있다.'} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed outline-none focus:border-[#eaa0a9] focus:bg-white" />
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">번호(001. 1. 2 ① ❶ (3))는 자동으로 떼요. 영어 줄·한글 줄 번갈아, 또는 한 줄에 "영어 한글" 모두 돼요. / 는 끊어 읽기 표시로 남겨요(학생 화면에선 보이지 않아요).</p>
        {message && <p className="mt-2 text-xs font-bold text-[#b04a5a]">{message}</p>}
        <div className="mt-3 flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600">취소</button><button type="button" disabled={!text.trim()} onClick={read} className="flex-[2] rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white disabled:opacity-50">미리보기</button></div>
      </> : <>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-100">
          <table className="w-full table-fixed text-xs">
            <thead className="sticky top-0 bg-white text-left text-slate-500"><tr><th className="w-7 py-1.5 pl-2 font-medium">#</th><th className="font-medium">영어</th><th className="font-medium">해석</th><th className="w-8" /></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={r.id} className={`border-t border-slate-100 ${r.korean.trim() ? '' : 'bg-orange-50'}`}>
              <td className="py-1 pl-2 align-top text-slate-400">{i + 1}</td>
              <td className="align-top"><input value={r.english} disabled={busy === 'save'} onChange={e => edit(r.id, 'english', e.target.value)} aria-label={`${i + 1}번 영어`} className={input} /></td>
              <td className="align-top"><input value={r.korean} disabled={busy === 'save'} onChange={e => edit(r.id, 'korean', e.target.value)} placeholder="해석 없음 — 직접 입력" aria-label={`${i + 1}번 해석`} className={`${input} placeholder:text-orange-600`} /></td>
              <td className="align-top"><button type="button" disabled={busy === 'save'} onClick={() => remove(r.id)} aria-label={`${i + 1}번 빼기`} className="p-1.5 text-slate-300 hover:text-[#b04a5a]"><Trash2 size={13} /></button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {skipped.length > 0 && <p className="mt-2 text-[11px] text-orange-700">짝이 없는 한글 줄 {skipped.length}개는 넣지 않았어요: {skipped.slice(0, 3).map(s => `"${s.slice(0, 20)}"`).join(', ')}{skipped.length > 3 ? ' …' : ''}</p>}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">{rows.length}문장{missing ? ` · 해석 없는 문장 ${missing}개 (칸을 눌러 고칠 수 있어요)` : ''}</span>
          <span className="flex items-center gap-1.5">{busy === 'ai' && <AiWorking />}{missing > 0 && <button type="button" disabled={!!busy} onClick={() => void fill()} className="inline-flex items-center gap-1 rounded-lg border border-[#f3d5da] px-2.5 py-1.5 text-xs font-bold text-[#8b2f40] disabled:opacity-50"><Sparkles size={13} aria-hidden="true" />{busy === 'ai' ? 'AI 해석 중…' : '빈 해석 AI로 채우기'}</button>}</span>
        </div>
        {message && <p className="mt-1.5 text-xs font-bold text-[#b04a5a]">{message}</p>}
        <div className="mt-3 flex gap-2"><button type="button" disabled={!!busy || !!plan} onClick={() => setRows(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600">다시 붙여넣기</button><button type="button" disabled={!!busy || !rows.some(r => r.english.trim())} onClick={() => void save()} className="flex-[2] rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy === 'save' ? '저장 중…' : `Day ${plan?.day ?? day}에 ${rows.filter(r => r.english.trim()).length}문장 저장`}</button></div>
      </>}
    </div>
  </div>;
}
