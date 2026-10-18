import { useState } from 'react';
import InfoTip from '../InfoTip';
import { ArrowLeft, Languages } from 'lucide-react';
import { PASSAGE_LIMITS } from '../../lib/passageTools';
import { isStaffView, passageCall, type Passage } from '../../lib/passageApi';
import PassageLibrary, { StaffTools } from './PassageLibrary';
import PassageResult from './PassageResult';
import QuestionGenerator from '../generator/QuestionGenerator';

/** 지문 분석기 (Beta): paste a passage → the stored analysis when anyone made one, otherwise the app's own at once.
 *  지문 보관함: the stored passages (all for teachers; public and their own for students). */
export default function PassageAnalyzer() {
  const [view, setView] = useState<'new' | 'library'>('new');
  const [text, setText] = useState('');
  const [passage, setPassage] = useState<Passage | null>(null);
  const [reused, setReused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [making, setMaking] = useState(false);

  const open = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setMessage('');
    try { const r = await passageCall<{ passage: Passage; reused: boolean }>('open', { text }); setPassage(r.passage); setReused(r.reused); }
    catch (e: any) { setMessage(e?.message || '잠시 후 다시 해 주세요.'); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl px-4 pb-10 pt-4 md:px-6 md:pt-8">
    <div role="tablist" aria-label="지문 분석기" className="mb-3 flex gap-1 rounded-xl bg-[#f8f1f2] p-1">{([['new', '새 지문 분석'], ['library', '지문 보관함']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`flex-1 rounded-lg py-1.5 text-sm font-bold ${view === id ? 'bg-white text-[#8b2f40] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
    {view === 'library' ? <PassageLibrary /> : passage && making ? <QuestionGenerator initialPassage={{ id: passage.id, title: passage.title || '', first: passage.sentences?.[0] }} onBack={() => setMaking(false)} /> : !passage ? <div className="rounded-2xl border border-[#f3e6e8] bg-white p-4 md:p-5">
      <div className="mb-2 flex items-center gap-2"><Languages size={18} className="text-[#8b2f40]" aria-hidden="true" /><b className="text-base text-[#5e1e2a]">지문 분석 <span className="text-[11px] font-medium text-slate-400">Beta</span></b>
        <InfoTip label="지문 분석기 설명 보기">영어 지문을 붙여 넣으면 앱이 바로 문장을 나누고 끊어 읽기·문법을 표시해요. 의미 단위 해석과 자세한 설명은 버튼으로 받아요. 같은 지문을 누가 이미 분석했다면 저장된 분석을 그대로 보여 드려요(횟수가 들지 않아요).</InfoTip></div>
      <textarea value={text} onChange={e => setText(e.target.value.slice(0, PASSAGE_LIMITS.textChars))} rows={10} aria-label="분석할 영어 지문" placeholder="영어 지문을 붙여 넣어 주세요." className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed outline-none focus:border-[#eaa0a9] focus:bg-white" />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{PASSAGE_LIMITS.sentences}문장까지</span><span>{text.length.toLocaleString('ko-KR')} / {PASSAGE_LIMITS.textChars.toLocaleString('ko-KR')}자</span></div>
      {message && <p className="mt-2 text-xs font-bold text-[#b04a5a]">{message}</p>}
      <button type="button" disabled={busy || !text.trim()} onClick={() => void open()} className="mt-3 w-full rounded-xl bg-[#d26272] py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? '분석하는 중…' : '분석하기'}</button>
    </div> : <>
      <button type="button" onClick={() => { setPassage(null); setReused(false); }} className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700"><ArrowLeft size={14} aria-hidden="true" />새 지문</button>
      <PassageResult passage={passage} reused={reused} onChange={setPassage} onMakeQuestions={() => setMaking(true)} extra={isStaffView(passage) ? <StaffTools passage={passage} onChange={setPassage} /> : undefined} />
    </>}
  </div>;
}
