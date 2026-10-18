import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Volume2, X } from 'lucide-react';
import { orderIsRight, orderPieces, readingScore, shuffledOrder, type GameSentence } from '../../lib/sentenceGame';
import { readingLine, useReadAloud } from '../../lib/useReadAloud';

export type SentenceMode = 'order' | 'read';
export interface SentenceMiss { word: string; meaning: string; userChoice: string; correctAnswer: string }
const TRIES = 3;

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.9;
  window.speechSynthesis.speak(u);
};

/** Asked before every sound game (never remembered): play aloud, or switch to 단어 순서 배열. */
export function QuietPrompt({ onLoud, onQuiet, quietLabel = '조용히 해야 해요 → 단어 순서 배열로' }: { onLoud: () => void; onQuiet: () => void; quietLabel?: string }) {
  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="소리 게임 안내">
    <div className="w-full max-w-sm rounded-2xl bg-white p-4 text-slate-700 shadow-xl">
      <b className="block text-base text-[#5e1e2a]">🔊 소리 게임이에요</b>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">소리를 들어야 하는 게임이에요. 조용히 해야 하는 곳이면 다른 게임으로 바꿔 드릴게요.</p>
      <button type="button" onClick={onLoud} className="mt-3 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white">지금 소리 낼 수 있어요</button>
      <button type="button" onClick={onQuiet} className="mt-1.5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600">{quietLabel}</button>
    </div>
  </div>;
}

/**
 * 문장 게임 over a few sentences: 단어 순서 배열 (tap pieces into order; 3 tries, then the answer is shown) or 낭독
 * (listen, then read aloud; 80% of the words heard passes; 3 tries). Calls onFinish once with the result.
 */
export default function SentenceGame({ items, mode, onFinish, onClose, earned, note, onSwitchToOrder }: {
  items: GameSentence[]; mode: SentenceMode; onFinish: (r: { correct: number; total: number; incorrect: SentenceMiss[] }) => void; onClose: () => void; earned?: number | null; note?: string;
  /** 낭독 only: start 단어 순서 배열 instead (shown when the microphone can't be used). */ onSwitchToOrder?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [tries, setTries] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [misses, setMisses] = useState<SentenceMiss[]>([]);
  const [done, setDone] = useState(false);
  const [state, setState] = useState<'play' | 'right' | 'shown'>('play');
  const item = items[index];
  const pieces = useMemo(() => item ? orderPieces(item) : [], [item]);
  const [pool, setPool] = useState<number[]>([]), [placed, setPlaced] = useState<number[]>([]);
  const [heard, setHeard] = useState('');

  useEffect(() => { setPool(shuffledOrder(pieces)); setPlaced([]); setHeard(''); setTries(0); setState('play'); }, [index, pieces]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const next = (ok: boolean, answer: string) => {
    const nCorrect = correct + (ok ? 1 : 0), nMisses = ok ? misses : [...misses, { word: item.word, meaning: item.meaning, userChoice: answer || '(없음)', correctAnswer: item.word }];
    setCorrect(nCorrect); setMisses(nMisses);
    if (index + 1 >= items.length) { setDone(true); onFinish({ correct: nCorrect, total: items.length, incorrect: nMisses }); }
    else setIndex(index + 1);
  };
  const check = () => {
    if (orderIsRight(pieces, placed)) { setState('right'); return; }
    const t = tries + 1; setTries(t);
    if (t >= TRIES) setState('shown'); else { setPool(shuffledOrder(pieces)); setPlaced([]); }
  };
  // 낭독: the words heard show while reading; graded as soon as every word is heard, or on 다 읽었어요.
  const read = useReadAloud(item?.word || '', h => {
    setHeard(h);
    if (readingScore(item.word, h).pass) setState('right'); else { const t = tries + 1; setTries(t); if (t >= TRIES) setState('shown'); }
  });

  const shown = read.listening ? read.live : heard, score = shown ? readingScore(item?.word || '', shown) : null, line = heard && !read.listening ? readingLine(item?.word || '', heard) : null;
  const micError = read.error;
  const chip = 'rounded-lg border px-2.5 py-1.5 text-sm md:text-base';
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-3" role="dialog" aria-modal="true" aria-label={mode === 'order' ? '단어 순서 배열' : '낭독'}>
    <div className="relative w-full max-w-lg rounded-2xl bg-white p-4 text-slate-700 shadow-xl md:p-5">
      <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
      {done ? <div className="py-4 text-center">
        <b className="block text-lg text-[#5e1e2a]">{mode === 'order' ? '단어 순서 배열' : '낭독'} 끝!</b>
        <p className="mt-2 text-sm text-slate-600">{items.length}문장 중 <b className="text-[#8b2f40]">{correct}문장</b> 맞았어요.</p>
        {typeof earned === 'number' && earned > 0 && <p className="mt-1 text-sm font-bold text-[#8b2f40]">+{earned}P</p>}
        {misses.length > 0 && <p className="mt-1 text-xs text-slate-400">틀린 문장은 오답 복습에 들어가요.</p>}
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white">닫기</button>
      </div> : <>
        {note && index === 0 && <p className="mb-2 mr-8 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">{note}</p>}
        <div className="flex justify-between pr-8 text-[11px] text-slate-400"><span>{index + 1} / {items.length}</span><span>{state === 'play' ? `${TRIES - tries}번 더 할 수 있어요` : ''}</span></div>
        {mode === 'order' ? <>
          <p className="mt-2 text-sm font-bold text-[#8b2f40] md:text-base">{item.meaning || '(해석 없음)'}</p>
          <div className="mt-3 flex min-h-[64px] flex-wrap content-start gap-1.5 rounded-xl border-2 border-dashed border-[#f3d5da] p-2" aria-label="놓은 조각">
            {placed.map((p, k) => <button key={`${p}-${k}`} type="button" disabled={state !== 'play'} onClick={() => { setPlaced(placed.filter((_, i) => i !== k)); setPool([...pool, p]); }} className={`${chip} ${state === 'right' ? 'border-emerald-300 bg-emerald-50' : 'border-[#f3d5da] bg-[#fef2f3]'}`}>{pieces[p]}</button>)}
          </div>
          {state === 'play' && <><p className="mt-2 text-[11px] text-slate-400">조각을 눌러 순서대로 놓아요 (놓은 조각을 누르면 돌아가요)</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{pool.map((p, k) => <button key={`${p}-${k}`} type="button" onClick={() => { setPool(pool.filter((_, i) => i !== k)); setPlaced([...placed, p]); }} className={`${chip} border-slate-200 bg-white hover:bg-slate-50`}>{pieces[p]}</button>)}</div>
            <button type="button" disabled={pool.length > 0} onClick={check} className="mt-4 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white disabled:opacity-40">확인</button>
            {tries > 0 && <p className="mt-1.5 text-center text-xs text-orange-600">아쉬워요! 다시 놓아 볼까요?</p>}</>}
        </> : <div className="text-center">
          <p className="mt-3 text-base leading-relaxed md:text-lg">{score ? score.words.map((w, k) => <span key={k} className={score.hit[k] ? 'text-emerald-700' : read.listening ? 'text-slate-400' : 'text-orange-600 underline'}>{w} </span>) : item.word}</p>
          <p className="mt-1 text-sm text-[#8b2f40]">{item.meaning}</p>
          {state === 'play' && <div className="mt-4 flex items-end justify-center gap-4">
            <button type="button" onClick={() => speak(item.word)} className="flex flex-col items-center gap-1 text-xs text-slate-500"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200"><Volume2 size={18} aria-hidden="true" /></span>듣기</button>
            {read.listening
              ? <button type="button" onClick={read.finish} className="flex flex-col items-center gap-1 text-xs font-bold text-[#8b2f40]"><span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-[#d26272] text-white"><Square size={18} aria-hidden="true" /></span>다 읽었어요</button>
              : <button type="button" onClick={read.start} className="flex flex-col items-center gap-1 text-xs font-bold text-[#8b2f40]"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d26272] text-white"><Mic size={22} aria-hidden="true" /></span>말하기</button>}
          </div>}
          {micError && <p className="mt-2 text-xs font-bold text-orange-600">{micError}</p>}
          {micError && onSwitchToOrder && <button type="button" onClick={onSwitchToOrder} className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">단어 순서 배열로 바꾸기</button>}
          {read.listening && <p className="mt-2 text-xs text-slate-400">읽는 중이에요 · 다 읽으면 바로 채점해요</p>}
          {line && state === 'play' && <p className="mt-2 text-xs text-slate-500"><b className="text-slate-600">{line.label}</b> · {line.hit.filter(Boolean).length}/{line.words.length}단어<span className="block text-[11px] text-slate-400">{line.legend}</span></p>}
        </div>}
        {state === 'right' && <div className="mt-4 text-center">
          <p className="text-sm font-bold text-emerald-700">{mode === 'read' && line ? `통과! ${line.label}` : '정답이에요!'}</p>
          <button type="button" onClick={() => next(true, '')} className="mt-2 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white">{index + 1 >= items.length ? '결과 보기' : '다음 문장'}</button>
        </div>}
        {state === 'shown' && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-500">정답</p>
          <p className="mt-0.5 text-sm font-bold text-slate-700 md:text-base">{item.word}</p>
          <button type="button" onClick={() => next(false, mode === 'order' ? placed.map(p => pieces[p]).join(' ') : heard)} className="mt-2 w-full rounded-xl bg-[#d26272] py-2.5 text-sm font-bold text-white">{index + 1 >= items.length ? '결과 보기' : '다음 문장'}</button>
        </div>}
      </>}
    </div>
  </div>;
}
