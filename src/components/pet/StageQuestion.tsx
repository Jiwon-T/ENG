import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { readingScore } from '../../lib/sentenceGame';
import { readingLine, useReadAloud } from '../../lib/useReadAloud';
import './towerHall.css'; // tower-shake

// 원정대 stage games other than the meaning cards: 철자 맞히기, 짝 맞추기, 문장 배열, 낭독, and the voice for 듣고 고르기.
// The server keeps the answers and checks every try or pick; each board is keyed by its question (and try), so it starts fresh.
export type StageAnswer = { text?: string; correct?: boolean; pick?: [number, number] };
const TRIES = 3;
const tile = 'rounded-lg border px-2.5 py-1.5 text-sm font-bold md:text-base';

export const speakWord = (text: string, slow = false) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = slow ? 0.65 : 0.9;
  window.speechSynthesis.speak(u);
};

/** 듣고 고르기: the word is heard (played once when the question opens), shown only after the answer. */
export function ListenButton({ word, revealed }: { word: string; revealed: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => { if (!revealed) speakWord(word); }, [word]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="flex flex-col items-center gap-1">
    {revealed ? <span className="rounded-2xl border border-[#f3d5da] bg-white px-5 py-2 text-xl font-black text-[#1f1a24]" lang="en">{word}</span>
      : <button type="button" onClick={() => { speakWord(word, slow); setSlow(true); }} aria-label="단어 듣기" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d26272] text-white shadow-sm"><Volume2 size={24} aria-hidden="true" /></button>}
    {!revealed && <span className="text-[11px] text-slate-400">{slow ? '한 번 더 듣기 (느리게)' : '눌러서 듣기'}</span>}
  </div>;
}

/** 철자 맞히기: the first two letters are given; tap the shuffled rest in order. The server checks each try (three in all). */
export function SpellBoard({ hint, letters, meaning, triesLeft, busy, onDone }: { hint: string; letters: string[]; meaning: string; triesLeft: number; busy: boolean; onDone: (a: StageAnswer) => void }) {
  const [placed, setPlaced] = useState<number[]>([]);
  useEffect(() => { if (placed.length === letters.length && letters.length && !busy) onDone({ text: hint + placed.map(i => letters[i]).join('') }); }, [placed]); // eslint-disable-line react-hooks/exhaustive-deps
  const pool = letters.map((_, i) => i).filter(i => !placed.includes(i));
  return <div className="text-center">
    <p className="text-base font-black text-[#8b2f40]">{meaning}</p>
    <div className={`mt-3 flex flex-wrap justify-center gap-1 ${triesLeft < TRIES ? 'animate-[tower-shake_.35s_ease-in-out]' : ''}`} aria-label="채운 철자">
      {hint.split('').map((c, i) => <span key={`h${i}`} className={`${tile} min-w-[2rem] border-[#f3d5da] bg-[#fef2f3] text-[#8b2f40]`}>{c}</span>)}
      {letters.map((_, i) => { const at = placed[i]; return <button key={`s${i}`} type="button" disabled={at === undefined || busy} onClick={() => setPlaced(placed.filter((_, k) => k !== i))} className={`${tile} min-w-[2rem] ${at === undefined ? 'border-dashed border-slate-300 text-transparent' : 'border-slate-300 bg-white text-slate-700'}`}>{at === undefined ? '·' : letters[at]}</button>; })}
    </div>
    <div className="mt-3 flex flex-wrap justify-center gap-1.5">{pool.map(i => <button key={i} type="button" disabled={busy} onClick={() => setPlaced([...placed, i])} className={`${tile} min-w-[2.25rem] border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>{letters[i]}</button>)}</div>
    <p className="mt-2 text-[11px] text-slate-400">{triesLeft < TRIES ? `아쉬워요! ${triesLeft}번 더 할 수 있어요` : '글자를 눌러 채워요 · 채운 글자를 누르면 빠져요'}</p>
  </div>;
}

/** 짝 맞추기: tap a word, then a meaning; the server checks each pick (a wrong one shakes and counts as a mistake). */
export function MatchBoard({ words, meanings, matched, mistakes, busy, onPick }: { words: string[]; meanings: string[]; matched: number[]; mistakes: number; busy: boolean; onPick: (word: number, meaning: number) => Promise<boolean> }) {
  const [pick, setPick] = useState<number | null>(null), [doneMeanings, setDoneMeanings] = useState<number[]>([]), [wrong, setWrong] = useState<number | null>(null);
  const chooseMeaning = async (m: number) => {
    if (pick === null || busy) return;
    const w = pick; setPick(null);
    if (await onPick(w, m)) setDoneMeanings(d => [...d, m]); else { setWrong(m); window.setTimeout(() => setWrong(null), 400); }
  };
  const card = 'min-h-[48px] rounded-xl border px-2 py-2 text-sm font-bold transition-colors';
  return <div>
    <p className="text-center text-[11px] text-slate-400">영어를 누르고 뜻을 눌러 짝을 맞춰요 · 실수 {mistakes}번</p>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div className="space-y-2">{words.map((word, i) => <button key={i} type="button" lang="en" disabled={busy || matched.includes(i)} onClick={() => setPick(i)} className={`${card} w-full ${matched.includes(i) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : pick === i ? 'border-[#d26272] bg-[#fef2f3] text-[#8b2f40]' : 'border-slate-200 bg-white text-slate-700'}`}>{word}{matched.includes(i) && ' ✓'}</button>)}</div>
      <div className="space-y-2">{meanings.map((meaning, m) => <button key={m} type="button" disabled={busy || doneMeanings.includes(m)} onClick={() => void chooseMeaning(m)} className={`${card} w-full ${doneMeanings.includes(m) ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : wrong === m ? 'animate-[tower-shake_.35s_ease-in-out] border-[#e0587a] bg-[#fff2f4] text-[#b04a5a]' : 'border-slate-200 bg-white text-slate-700'}`}>{meaning}{doneMeanings.includes(m) && ' ✓'}</button>)}</div>
    </div>
  </div>;
}

/** 문장 배열: the translation above, the shuffled pieces from the server below. The server checks each try (three in all). */
export function OrderBoard({ pieces, meaning, triesLeft, busy, onDone }: { pieces: string[]; meaning: string; triesLeft: number; busy: boolean; onDone: (a: StageAnswer) => void }) {
  const [placed, setPlaced] = useState<number[]>([]);
  const pool = pieces.map((_, i) => i).filter(i => !placed.includes(i));
  return <div>
    <p className="text-sm font-bold text-[#8b2f40] md:text-base">{meaning}</p>
    <div className="mt-2 flex min-h-[56px] flex-wrap content-start gap-1.5 rounded-xl border-2 border-dashed border-[#f3d5da] p-2" aria-label="놓은 조각">
      {placed.map((p, k) => <button key={`${p}-${k}`} type="button" disabled={busy} onClick={() => setPlaced(placed.filter((_, i) => i !== k))} className={`${tile} border-[#f3d5da] bg-[#fef2f3]`}>{pieces[p]}</button>)}
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">{pool.map(p => <button key={p} type="button" disabled={busy} onClick={() => setPlaced([...placed, p])} className={`${tile} border-slate-200 bg-white hover:bg-slate-50`}>{pieces[p]}</button>)}</div>
    <button type="button" disabled={busy || pool.length > 0} onClick={() => onDone({ text: placed.map(i => pieces[i]).join(' ') })} className="mt-3 w-full rounded-2xl bg-[#e0587a] py-2.5 text-sm font-bold text-white disabled:opacity-40">확인</button>
    {triesLeft < TRIES && <p className="mt-1.5 text-center text-xs text-orange-600">아쉬워요! {triesLeft}번 더 할 수 있어요</p>}
  </div>;
}

/** 낭독: listen, then read aloud; 80% of the words heard passes. Three tries; a microphone that can't be used may skip.
 *  The words heard show while reading; it grades as soon as every word is heard, or on 다 읽었어요. */
export function ReadBoard({ text, meaning, busy, onDone }: { text: string; meaning: string; busy: boolean; onDone: (a: StageAnswer) => void }) {
  const [heard, setHeard] = useState(''), [tries, setTries] = useState(0);
  const read = useReadAloud(text, h => {
    setHeard(h);
    if (readingScore(text, h).pass) onDone({ correct: true });
    else { const t = tries + 1; setTries(t); if (t >= TRIES) onDone({ correct: false }); }
  });
  useEffect(() => { setHeard(''); setTries(0); }, [text]);
  const shown = read.listening ? read.live : heard, score = shown ? readingScore(text, shown) : null, line = heard && !read.listening ? readingLine(text, heard) : null;
  return <div className="text-center">
    <p className="text-base leading-relaxed" lang="en">{score ? score.words.map((w, k) => <span key={k} className={score.hit[k] ? 'text-emerald-700' : read.listening ? 'text-slate-400' : 'text-orange-600 underline'}>{w} </span>) : text}</p>
    <p className="mt-1 text-sm text-[#8b2f40]">{meaning}</p>
    <div className="mt-3 flex items-end justify-center gap-4">
      <button type="button" onClick={() => speakWord(text)} className="flex flex-col items-center gap-1 text-xs text-slate-500"><span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200"><Volume2 size={18} aria-hidden="true" /></span>듣기</button>
      {read.listening
        ? <button type="button" onClick={read.finish} className="flex flex-col items-center gap-1 text-xs font-bold text-[#8b2f40]"><span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-[#d26272] text-white"><Square size={18} aria-hidden="true" /></span>다 읽었어요</button>
        : <button type="button" disabled={busy} onClick={read.start} className="flex flex-col items-center gap-1 text-xs font-bold text-[#8b2f40]"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d26272] text-white"><Mic size={22} aria-hidden="true" /></span>말하기</button>}
    </div>
    {read.listening && <p className="mt-2 text-xs text-slate-400">읽는 중이에요 · 다 읽으면 바로 채점해요</p>}
    {line && <p className="mt-2 text-xs text-slate-500"><b className="text-slate-600">{line.label}</b> · {TRIES - tries}번 더<span className="block text-[11px] text-slate-400">{line.legend}</span></p>}
    {read.error && <><p className="mt-2 text-xs font-bold text-orange-600">{read.error}</p><button type="button" disabled={busy} onClick={() => onDone({ correct: false })} className="mt-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">이 문장 넘기기</button></>}
  </div>;
}
