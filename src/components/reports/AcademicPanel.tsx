import React, { useEffect, useState } from 'react';
import type { AcademicData } from '../../types/academic';
import { SCORE_VIEWS, scoreRows, chartValue, type ScoreView } from '../../lib/academicChart';

const COLORS: Record<string, string> = { 영어: '#e65d80', 수학: '#219b71', 국어: '#9364ce', 과학: '#db8a30', 한국사: '#3887ce' };
export default function AcademicPanel({ load, subject = '' }: { load: () => Promise<AcademicData>; subject?: string }) {
  const [data, setData] = useState<AcademicData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ScoreView>('학원 단어');
  const [metric, setMetric] = useState<'score' | 'percentile'>('score');
  const [hidden, setHidden] = useState<string[]>([]);
  const refresh = async () => { setLoading(true); setError(''); try { setData(await load()); } catch { setError('성적을 불러오지 못했습니다. 다시 시도해 주세요.'); } finally { setLoading(false); } };
  useEffect(() => { let live = true; setLoading(true); setData(null); setError(''); load().then(d => { if (live) setData(d); }).catch(() => { if (live) setError('성적을 불러오지 못했습니다. 다시 시도해 주세요.'); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [load]);
  const rows = data ? scoreRows(data, view).filter(r => !subject || r.subject === subject) : [];
  const subjects = [...new Set(rows.map(r => r.subject))];
  const visible = rows.filter(r => !hidden.includes(r.subject));
  const dates = [...new Set(visible.filter(r => r.date && Number.isFinite(Date.parse(r.date))).map(r => r.date!))].sort((a, b) => Date.parse(a) - Date.parse(b));
  const values = visible.map(r => chartValue(r, metric)).filter((v): v is number => v !== null);
  const maximum = Math.max(100, ...values);
  const timeMin = dates.length ? Date.parse(dates[0]) : 0;
  const timeMax = dates.length ? Date.parse(dates.at(-1)!) : 0;
  const x = (date: string) => timeMax === timeMin ? 310 : 50 + (Date.parse(date) - timeMin) / (timeMax - timeMin) * 520;
  const y = (value: number) => 215 - value / maximum * 165;
  return <section className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 space-y-4 min-w-0">
    <div className="flex justify-between gap-2"><h3 className="font-black text-slate-900">성적 변화</h3><button type="button" onClick={refresh} disabled={loading} className="text-sm text-indigo-600">새로고침</button></div>
    <div role="tablist" aria-label="시험 종류" className="flex flex-wrap gap-2">{SCORE_VIEWS.map(v => <button type="button" key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); setMetric('score'); }} className={`px-3 py-2 rounded-xl text-sm ${view === v ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{v}</button>)}</div>
    {view === '모의고사' && <label className="text-sm">표시 기준 <select value={metric} onChange={e => setMetric(e.target.value as 'score' | 'percentile')} className="border rounded-lg p-2"><option value="score">원점수</option><option value="percentile">백분위</option></select></label>}
    <div className="flex flex-wrap gap-2">{subjects.map(s => <button key={s} type="button" aria-pressed={!hidden.includes(s)} onClick={() => setHidden(prev => prev.includes(s) ? prev.filter(v => v !== s) : [...prev, s])} className={`px-3 py-1 rounded-full border text-sm ${hidden.includes(s) ? 'opacity-40' : ''}`} style={{ color: COLORS[s] || '#64748b' }}>{s}</button>)}</div>
    {loading ? <p role="status" className="py-8 text-center text-slate-500">성적을 불러오는 중입니다…</p> : error ? <p role="alert" className="text-rose-600">{error}</p> : <>
      {values.length ? <svg viewBox="0 0 620 255" role="img" aria-label={`${view} ${metric === 'score' ? '원점수' : '백분위'} 변화 그래프`} className="w-full">
        {[0, maximum / 2, maximum].map(v => <g key={v}><line x1="45" x2="575" y1={y(v)} y2={y(v)} stroke="#e2e8f0"/><text x="38" y={y(v) + 4} textAnchor="end" fontSize="12" fill="#64748b">{v}</text></g>)}
        {subjects.filter(s => !hidden.includes(s)).map(s => { const group = visible.filter(r => r.subject === s && r.date).sort((a, b) => Date.parse(a.date!) - Date.parse(b.date!)); let previous: { x: number; y: number } | null = null; return <g key={s}>{group.map(r => { const value = chartValue(r, metric); if (value === null) { previous = null; return null; } const point = { x: x(r.date!), y: y(value) }; const before = previous; previous = point; return <g key={r.id}>{before && <line x1={before.x} y1={before.y} x2={point.x} y2={point.y} stroke={COLORS[s]} strokeWidth="2"/>}<circle cx={point.x} cy={point.y} r="4" fill={COLORS[s] || '#64748b'}><title>{`${s} ${r.title} ${r.date?.slice(0, 10)}: ${value}`}</title></circle></g>; })}</g>; })}
        {dates.filter((_, i) => dates.length <= 4 || i === 0 || i === dates.length - 1).map(date => <text key={date} x={x(date)} y="241" textAnchor="middle" fontSize="11" fill="#64748b">{date.slice(0, 10)}</text>)}
      </svg> : <p className="py-8 text-center text-slate-500 text-sm">그래프에 표시할 {metric === 'score' ? '점수' : '백분위'} 기록이 없습니다.</p>}
      <div className="space-y-2">{visible.sort((a, b) => Date.parse(b.date || '') - Date.parse(a.date || '') || a.title.localeCompare(b.title, 'ko')).map(r => <div key={r.id} className="rounded-xl bg-slate-50 p-3 text-sm flex flex-wrap justify-between gap-2"><div className="min-w-0"><span style={{ color: COLORS[r.subject] }}>{r.subject}</span><span className="font-bold ml-2 break-words">{r.title}</span><p className="text-xs text-slate-500 mt-1">{r.date?.slice(0, 10) || '시험일 미입력'}{r.grade ? ` · 등급 ${r.grade}` : ''}</p></div><div className="font-bold">{r.status === '미제출' ? '미제출' : r.score === null ? '점수 미입력' : `${r.score}점${r.maxScore ? ` / ${r.maxScore}` : ''}`}<p className="text-xs font-normal text-slate-500">{r.status !== '미제출' ? r.status : ''}</p></div></div>)}{!visible.length && <p className="text-sm text-slate-500">등록된 시험 기록이 없습니다.</p>}</div>
    </>}
  </section>;
}
