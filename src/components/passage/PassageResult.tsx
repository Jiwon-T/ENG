import { useEffect, useState, type ReactNode } from 'react';
import { Download, Sparkles } from 'lucide-react';
import { grammarTags } from '../../lib/passageTools';
import { isStaffView, passageCall, roleName, shortDate, type Passage, type PassagePartName } from '../../lib/passageApi';
import PassageEditor from './PassageEditor';
import { AiWorking } from '../teacher/workbookAi';

type Tab = 'reading' | 'grammar' | 'words' | 'summary';
const TABS: [Tab, string][] = [['reading', '① 직독직해'], ['grammar', '② 문법·구조'], ['words', '③ 단어'], ['summary', '④ 주제·요약']];
const ASK: Record<PassagePartName, { label: string; cost: string }> = {
  reading: { label: '직독직해 해석 채우기', cost: '워크북 AI 해석 1번' },
  grammar: { label: '모든 문장 문법·구조 설명 + 서술형 문장 고르기', cost: '지문 분석 1번' },
  summary: { label: '주제·요지·요약 받기', cost: '지문 분석 1번' },
};
const TAG_COLOR: Record<string, string> = { clause: 'bg-violet-50 text-violet-800', verb: 'bg-teal-50 text-teal-800', compare: 'bg-amber-50 text-amber-800', phrase: 'bg-rose-50 text-rose-800' };

/**
 * One analysed passage: ① 직독직해 first (pauses from the app at once, meanings by button), ② 문법·구조 (the app's marks
 * at once, explanations and the 서술형 sentence by button), ③ 단어 (from the academy word sets), ④ 주제·요약.
 * `extra` adds the teacher tools (지문 정보, 고치기, 기록) under the header.
 */
export default function PassageResult({ passage, onChange, reused, extra }: { passage: Passage; onChange: (p: Passage) => void; reused?: boolean; extra?: ReactNode }) {
  const staff = isStaffView(passage);
  const [editing, setEditing] = useState<PassagePartName | null>(null);
  const [tab, setTab] = useState<Tab>('reading');
  const [busy, setBusy] = useState<'' | PassagePartName | 'words' | 'docx'>('');
  const [message, setMessage] = useState('');
  const { parts } = passage;

  useEffect(() => { // ③ 단어 is worked out on the server once (no AI) when first opened
    if (tab !== 'words' || parts.words || busy) return;
    setBusy('words');
    passageCall<{ passage: Passage }>('words', { id: passage.id }).then(r => onChange(r.passage)).catch(e => setMessage(e.message)).finally(() => setBusy(''));
  }, [tab, passage.id, Boolean(parts.words)]); // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (part: PassagePartName) => {
    if (busy) return;
    setBusy(part); setMessage('');
    try {
      const r = await passageCall<{ passage: Passage; left: number | null; reused: boolean }>('ai', { id: passage.id, part });
      onChange(r.passage);
      setMessage(r.reused ? '이미 저장된 분석이 있어 그대로 불러왔어요(횟수는 들지 않았어요).' : typeof r.left === 'number' ? `이번 달 남은 ${ASK[part].cost.replace(' 1번', '')} ${r.left}번` : '');
    } catch (e: any) { setMessage(e?.message || '잠시 후 다시 해 주세요.'); }
    finally { setBusy(''); }
  };
  const download = async () => {
    setBusy('docx');
    try { const { passageDocx } = await import('../../lib/passageDocx'); await passageDocx(passage); }
    catch { setMessage('Word 파일을 만들지 못했어요.'); }
    finally { setBusy(''); }
  };
  const askButton = (part: PassagePartName) => <div className="mt-3 flex flex-col items-stretch gap-1.5">
    {busy === part && <div className="flex justify-center"><AiWorking /></div>}
    <button type="button" disabled={!!busy} onClick={() => void ask(part)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#f3d5da] bg-white px-3 py-2.5 text-sm font-bold text-[#8b2f40] hover:bg-[#fff7f8] disabled:opacity-50">
      <Sparkles size={15} aria-hidden="true" />{busy === part ? 'AI가 분석하는 중…' : ASK[part].label}<span className="text-xs font-medium text-slate-400">· {ASK[part].cost}</span>
    </button>
  </div>;

  return <div className="rounded-2xl border border-[#f3e6e8] bg-white p-4 text-slate-700 md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <b className="block truncate text-base text-[#5e1e2a]">{passage.title || parts.summary?.title || '지문 분석'} <span className="text-[11px] font-medium text-slate-400">Beta</span></b>
        {passage.examInfo && <span className="text-xs text-slate-500">{passage.examInfo}</span>}
      </div>
      <span className="flex items-center gap-1.5">
        {reused && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">저장된 분석을 불러왔어요</span>}
        <button type="button" disabled={!!busy} onClick={() => void download()} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Download size={13} aria-hidden="true" />{busy === 'docx' ? '만드는 중…' : 'Word 저장'}</button>
      </span>
    </div>
    {extra}
    <div role="tablist" aria-label="분석 보기" className="mt-3 flex gap-1 overflow-x-auto border-b border-slate-100">
      {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setMessage(''); setEditing(null); }} className={`flex-1 whitespace-nowrap border-b-2 px-2 py-2 text-xs font-bold md:text-sm ${tab === id ? 'border-[#d26272] text-[#8b2f40]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>)}
    </div>
    {message && <p className="mt-2 text-xs font-bold text-[#b04a5a]">{message}</p>}
    {staff && tab !== 'words' && (() => { const part = parts[tab as PassagePartName]; return <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
      <span>{part?.by ? `받음 ${part.by.name}(${roleName(part.by.role)}) ${shortDate(part.at)}` : '아직 받지 않았어요'}{part?.editedBy ? ` · 고침 ${part.editedBy.name}(${roleName(part.editedBy.role)}) ${shortDate(part.editedAt)}` : ''}</span>
      {editing !== tab && <button type="button" onClick={() => setEditing(tab as PassagePartName)} className="rounded-lg border border-[#f3d5da] px-2 py-1 font-bold text-[#8b2f40] hover:bg-[#fff7f8]">{part ? '이 탭 고치기' : '직접 쓰기'}</button>}
    </div>; })()}
    {editing && editing === tab && <PassageEditor passage={passage} part={editing} onCancel={() => setEditing(null)} onSaved={next => { onChange(next); setEditing(null); setMessage('고친 내용을 저장했어요.'); }} />}

    {tab === 'reading' && editing !== 'reading' && <div className="mt-3 space-y-2.5">
      <p className="text-[11px] text-slate-400">끊는 자리는 앱이 바로 표시해요.{parts.reading ? '' : ' 의미 단위 해석은 아래 버튼으로 채워요.'}</p>
      {passage.sentences.map((s, i) => { const r = parts.reading?.sentences[i]; return <div key={i} className="rounded-xl border border-slate-100 p-3">
        <span className="text-[11px] text-slate-400">{i + 1}</span>
        {r ? <div className="mt-1 flex flex-wrap items-start gap-x-1.5 gap-y-2 text-sm leading-snug md:text-base">{r.chunks.map((c, k) => <span key={k} className="inline-flex items-start gap-1.5">
          <span className="inline-flex flex-col"><span>{c.en}</span><span className="text-xs text-[#8b2f40] md:text-sm">{c.ko}</span></span>{k < r.chunks.length - 1 && <span className="text-[#e07a87]" aria-hidden="true">/</span>}</span>)}</div>
          : <p className="mt-1 text-sm md:text-base">{passage.hints[i].map((c, k) => <span key={k}>{c}{k < passage.hints[i].length - 1 && <span className="mx-1 text-[#e07a87]" aria-hidden="true">/</span>}</span>)}</p>}
        {r?.ko ? <p className="mt-2 border-t border-dashed border-slate-200 pt-1.5 text-xs text-slate-600 md:text-sm">{r.ko}</p> : !r && <p className="mt-1 text-[11px] text-orange-600">의미 단위 해석이 아직 없어요</p>}
      </div>; })}
      {!parts.reading && askButton('reading')}
    </div>}

    {tab === 'grammar' && editing !== 'grammar' && <div className="mt-3 space-y-2.5">
      {passage.sentences.map((s, i) => { const g = parts.grammar?.sentences[i], essay = parts.grammar?.essay.index === i, tags = grammarTags(s); return <div key={i} className={`rounded-xl border p-3 ${essay ? 'border-[#d26272] bg-[#fffafa]' : 'border-slate-100'}`}>
        <div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">{i + 1}</span>{essay && <span className="rounded-full bg-[#8b2f40] px-2 py-0.5 text-[11px] font-bold text-white">서술형 출제 예상</span>}</div>
        <p className="mt-1 text-sm md:text-base">{s}</p>
        {tags.length > 0 && <div className="mt-1.5 flex flex-wrap items-center gap-1">{tags.map(t => <span key={t.label} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${TAG_COLOR[t.kind]}`}>{t.label}</span>)}<span className="text-[11px] text-slate-400">· 앱 자동 표시</span></div>}
        {g && <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600 md:text-sm">
          <p><b className="font-bold text-slate-700">구조</b> {g.structure}</p>
          {g.points.length > 0 && <ul className="list-disc pl-4">{g.points.map((p, k) => <li key={k}>{p}</li>)}</ul>}
          {essay && parts.grammar?.essay.reason && <p className="text-[#8b2f40]"><b className="font-bold">서술형 포인트</b> {parts.grammar.essay.reason}</p>}
        </div>}
      </div>; })}
      {!parts.grammar && askButton('grammar')}
    </div>}

    {tab === 'words' && <div className="mt-3">
      {!parts.words ? <p className="py-6 text-center text-sm text-slate-400">{busy === 'words' ? '학원 단어 세트에서 찾는 중…' : ''}</p> : <>
        <p className="text-[11px] text-slate-400">학원 단어 세트에 있는 뜻이에요.</p>
        {parts.words.known.length ? <table className="mt-1.5 w-full text-sm"><tbody>{parts.words.known.map(w => <tr key={w.word} className="border-t border-slate-100"><td className="w-2/5 py-1.5 pr-2 align-top font-bold text-[#5e1e2a]">{w.word}{w.seen !== w.word && <span className="ml-1 text-[11px] font-normal text-slate-400">({w.seen})</span>}</td><td className="py-1.5 text-slate-600">{w.meaning}</td></tr>)}</tbody></table>
          : <p className="mt-2 text-sm text-slate-400">학원 단어 세트에서 찾은 단어가 없어요.</p>}
        {parts.words.unknown.length > 0 && <><p className="mt-4 text-xs font-bold text-slate-500">모르는 단어 (단어 세트에 없어요)</p><div className="mt-1.5 flex flex-wrap gap-1">{parts.words.unknown.map(w => <span key={w} className="rounded-md bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600">{w}</span>)}</div></>}
      </>}
    </div>}

    {tab === 'summary' && editing !== 'summary' && <div className="mt-3">
      {parts.summary ? <dl className="space-y-2.5 text-sm">
        {([['제목', `${parts.summary.title}${parts.summary.englishTitle ? ` · ${parts.summary.englishTitle}` : ''}`], ['주제', parts.summary.topic], ['요지', parts.summary.mainIdea], ['요약', parts.summary.summary], ['전개 방식', parts.summary.logic]] as const).map(([label, v]) => <div key={label} className="rounded-xl border border-slate-100 p-3">
          <dt className="text-[11px] font-bold text-slate-400">{label}</dt>
          {typeof v === 'string' ? <dd className="mt-0.5 text-slate-700">{v}</dd> : <dd className="mt-0.5"><p className="text-slate-700">{v.ko}</p><p className="mt-0.5 text-xs text-slate-500">{v.en}</p></dd>}
        </div>)}
      </dl> : askButton('summary')}
    </div>}
  </div>;
}
