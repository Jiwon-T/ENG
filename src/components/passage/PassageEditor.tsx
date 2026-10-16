import { useState } from 'react';
import { passageCall, type Passage, type PassagePartName } from '../../lib/passageApi';

const box = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#eaa0a9]';
const SEP = ' = ';

/**
 * Teachers fix a part of a stored analysis (what everyone sees from then on; the change is recorded with their name).
 * 직독직해: one meaning unit per line, "영어 = 뜻" (the English pieces must give the sentence back).
 */
export default function PassageEditor({ passage, part, onSaved, onCancel }: { passage: Passage; part: PassagePartName; onSaved: (p: Passage) => void; onCancel: () => void }) {
  const p = passage.parts;
  const [reading, setReading] = useState(() => passage.sentences.map((s, i) => ({
    lines: (p.reading?.sentences[i]?.chunks || passage.hints[i].map(en => ({ en, ko: '' }))).map(c => `${c.en}${SEP}${c.ko}`).join('\n'),
    ko: p.reading?.sentences[i]?.ko || '',
  })));
  const [grammar, setGrammar] = useState(() => ({
    sentences: passage.sentences.map((_, i) => ({ structure: p.grammar?.sentences[i]?.structure || '', points: (p.grammar?.sentences[i]?.points || []).join('\n') })),
    essay: p.grammar?.essay.index ?? 0, reason: p.grammar?.essay.reason || '',
  }));
  const [summary, setSummary] = useState(() => ({
    title: p.summary?.title || '', englishTitle: p.summary?.englishTitle || '', logic: p.summary?.logic || '',
    topic: p.summary?.topic || { ko: '', en: '' }, mainIdea: p.summary?.mainIdea || { ko: '', en: '' }, summary: p.summary?.summary || { ko: '', en: '' },
  }));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const data = () => part === 'reading'
    ? { sentences: reading.map(r => ({ chunks: r.lines.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const at = l.indexOf('='); return at < 0 ? { en: l, ko: '' } : { en: l.slice(0, at).trim(), ko: l.slice(at + 1).trim() }; }), ko: r.ko })) }
    : part === 'grammar'
      ? { sentences: grammar.sentences.map(g => ({ structure: g.structure, points: g.points.split('\n').map(x => x.trim()).filter(Boolean) })), essay: { index: grammar.essay, reason: grammar.reason } }
      : summary;
  const save = async () => {
    setBusy(true); setMessage('');
    try { const r = await passageCall<{ passage: Passage }>('edit', { id: passage.id, part, data: data(), note }); onSaved(r.passage); }
    catch (e: any) { setMessage(e?.message || '저장하지 못했어요.'); setBusy(false); }
  };

  return <div className="mt-3 space-y-2.5 rounded-xl border border-[#f3d5da] bg-[#fffafa] p-3">
    <p className="text-xs font-bold text-[#8b2f40]">고치기 — 저장하면 모두에게 이 내용이 보여요{part === 'reading' ? ' · 한 줄에 의미 단위 하나, "영어 = 뜻"' : ''}</p>
    {part === 'reading' && passage.sentences.map((s, i) => <div key={i} className="rounded-lg border border-slate-100 bg-white p-2.5">
      <p className="mb-1 text-[11px] text-slate-400">{i + 1}. {s}</p>
      <textarea value={reading[i].lines} rows={Math.max(2, reading[i].lines.split('\n').length)} onChange={e => setReading(list => list.map((r, k) => k === i ? { ...r, lines: e.target.value } : r))} aria-label={`${i + 1}번 의미 단위`} className={`${box} font-mono text-xs leading-relaxed`} />
      <input value={reading[i].ko} onChange={e => setReading(list => list.map((r, k) => k === i ? { ...r, ko: e.target.value } : r))} placeholder="문장 전체 해석" aria-label={`${i + 1}번 전체 해석`} className={`${box} mt-1.5`} />
    </div>)}
    {part === 'grammar' && <>
      {passage.sentences.map((s, i) => <div key={i} className="rounded-lg border border-slate-100 bg-white p-2.5">
        <label className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="radio" name="essay" checked={grammar.essay === i} onChange={() => setGrammar(g => ({ ...g, essay: i }))} />서술형 출제 예상</label>
        <p className="mb-1 text-[11px] text-slate-400">{i + 1}. {s}</p>
        <input value={grammar.sentences[i].structure} onChange={e => setGrammar(g => ({ ...g, sentences: g.sentences.map((x, k) => k === i ? { ...x, structure: e.target.value } : x) }))} placeholder="구조 (예: S(…) V(…) O(…))" aria-label={`${i + 1}번 구조`} className={box} />
        <textarea value={grammar.sentences[i].points} rows={2} onChange={e => setGrammar(g => ({ ...g, sentences: g.sentences.map((x, k) => k === i ? { ...x, points: e.target.value } : x) }))} placeholder="문법 포인트 (한 줄에 하나)" aria-label={`${i + 1}번 문법 포인트`} className={`${box} mt-1.5 text-xs`} />
      </div>)}
      <input value={grammar.reason} onChange={e => setGrammar(g => ({ ...g, reason: e.target.value }))} placeholder="서술형 포인트 (왜 이 문장인지)" aria-label="서술형 포인트" className={box} />
    </>}
    {part === 'summary' && <div className="grid gap-1.5">
      <input value={summary.title} onChange={e => setSummary(x => ({ ...x, title: e.target.value }))} placeholder="제목 (한국어)" aria-label="제목" className={box} />
      <input value={summary.englishTitle} onChange={e => setSummary(x => ({ ...x, englishTitle: e.target.value }))} placeholder="영어 제목" aria-label="영어 제목" className={box} />
      {(['topic', 'mainIdea', 'summary'] as const).map(k => <div key={k} className="grid gap-1 md:grid-cols-2">
        <textarea value={summary[k].ko} rows={k === 'summary' ? 3 : 1} onChange={e => setSummary(x => ({ ...x, [k]: { ...x[k], ko: e.target.value } }))} placeholder={`${k === 'topic' ? '주제' : k === 'mainIdea' ? '요지' : '요약'} (한국어)`} aria-label={`${k} 한국어`} className={box} />
        <textarea value={summary[k].en} rows={k === 'summary' ? 3 : 1} onChange={e => setSummary(x => ({ ...x, [k]: { ...x[k], en: e.target.value } }))} placeholder="영어" aria-label={`${k} 영어`} className={box} />
      </div>)}
      <input value={summary.logic} onChange={e => setSummary(x => ({ ...x, logic: e.target.value }))} placeholder="전개 방식" aria-label="전개 방식" className={box} />
    </div>}
    <input value={note} onChange={e => setNote(e.target.value.slice(0, 60))} placeholder="무엇을 고쳤는지 (선택, 기록에 남아요)" aria-label="고친 내용 메모" className={box} />
    {message && <p className="text-xs font-bold text-[#b04a5a]">{message}</p>}
    <div className="flex gap-2"><button type="button" disabled={busy} onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-bold text-slate-600">취소</button><button type="button" disabled={busy} onClick={() => void save()} className="flex-[2] rounded-xl bg-[#d26272] py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? '저장 중…' : '저장'}</button></div>
  </div>;
}
