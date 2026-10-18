import { useEffect, useRef, useState } from 'react';
import { readingScore, speechRecognitionClass } from './sentenceGame';

/**
 * 낭독 listening, shared by the 문장 세트 game and the 원정대 stage: the words heard show while the student reads (interim
 * results), and it stops as soon as every word of the sentence has been heard — no waiting for the browser to notice
 * the silence. `finish()` (다 읽었어요) stops it at once. `onHeard` gets what was heard once per try (the best
 * alternative of each part, as the score sees it).
 */
export function useReadAloud(text: string, onHeard: (heard: string) => void) {
  const [listening, setListening] = useState(false), [live, setLive] = useState(''), [error, setError] = useState('');
  // Each try has its own generation: a late event from an earlier recognizer (onend, onresult) is ignored.
  const rec = useRef<any>(null), gen = useRef(0), latest = useRef(''), done = useRef(true), handler = useRef(onHeard);
  handler.current = onHeard;
  const settle = (g: number) => { if (g !== gen.current || done.current) return; done.current = true; setListening(false); handler.current(latest.current); };
  const stopQuietly = (g: number) => { if (g !== gen.current) return; done.current = true; setListening(false); };
  useEffect(() => { setLive(''); setError(''); return () => { gen.current++; done.current = true; try { rec.current?.abort(); } catch { /* gone */ } }; }, [text]);
  const start = () => {
    const Rec = speechRecognitionClass(); if (!Rec) { setError('이 기기에서는 음성 인식이 안 돼요.'); return; }
    try { rec.current?.abort(); } catch { /* none */ }
    const g = ++gen.current, r = new Rec(); rec.current = r; latest.current = ''; done.current = false;
    r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = true;
    r.onresult = (e: any) => {
      if (g !== gen.current || done.current) return;
      // each part: the alternative that matches the sentence best (final parts), or the interim guess
      const parts = Array.from(e.results || []).map((res: any) => Array.from(res).map((a: any) => String(a.transcript || '')).sort((x, y) => readingScore(text, y).share - readingScore(text, x).share)[0] || '');
      latest.current = parts.join(' ').replace(/\s+/g, ' ').trim(); setLive(latest.current);
      if (readingScore(text, latest.current).share === 1) { try { r.stop(); } catch { /* ended */ } settle(g); } // every word heard: grade now
    };
    r.onerror = (e: any) => {
      if (g !== gen.current || e?.error === 'aborted') return;
      setError(e?.error === 'not-allowed' || e?.error === 'service-not-allowed' ? '마이크를 쓸 수 없어요. 브라우저 설정에서 마이크를 허용해 주세요.' : e?.error === 'no-speech' ? '소리가 들리지 않았어요. 다시 해 볼까요?' : '잘 듣지 못했어요. 다시 해 볼까요?');
      stopQuietly(g);
    };
    // Some browsers end before the last result arrives: wait a moment, then grade what was heard (or stop if nothing).
    r.onend = () => { if (g !== gen.current || done.current) return; window.setTimeout(() => { if (latest.current) settle(g); else stopQuietly(g); }, 350); };
    setError(''); setLive(''); setListening(true);
    try { r.start(); } catch { stopQuietly(g); setError('잠시 후 다시 눌러 주세요.'); }
  };
  /** 다 읽었어요: stop now and grade what was heard (the last words still arrive before it ends). */
  const finish = () => { const g = gen.current; try { rec.current?.stop(); } catch { settle(g); } };
  return { listening, live, error, setError, start, finish };
}

/** The result line: accuracy, the stars it earns, and what the stars mean. */
export function readingLine(text: string, heard: string) {
  const s = readingScore(text, heard), pct = Math.round(s.share * 100);
  return { ...s, pct, label: s.pass ? `정확도 ${pct}% · ${'⭐'.repeat(s.stars)}` : `정확도 ${pct}% · 80% 넘으면 통과`, legend: '⭐ 80% · ⭐⭐ 90% · ⭐⭐⭐ 100%' };
}
