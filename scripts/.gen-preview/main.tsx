import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './h.css';
import MemoPrintChips from '../../src/components/teacher/MemoPrintChips';
const books = [{ id: 'a', title: '능률VOCA 수능 필수' }, { id: 'b', title: '수능 2000' }, { id: 'c', title: '수특라 단어' }, { id: 'd', title: '수특라 영어독해 어휘' }, { id: 'e', title: '중등 실력 단어' }];
function Row({ name, start, content = '' }: { name: string; start: string; content?: string }) {
  const [v, setV] = useState(start), [c, setC] = useState(content);
  return <tr className="border-b border-slate-100 align-top"><td className="p-2 text-sm font-bold">{name}</td><td className="p-2" style={{ width: 240 }}><label className="block text-xs font-bold text-slate-500">수업 내용<textarea value={c} onChange={e => setC(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal text-slate-800" /></label><MemoPrintChips text={c} studentName={name} preset={books} /></td>
    <td className="p-2" style={{ width: 260 }}><label className="block text-xs font-bold text-slate-500">특이 사항<textarea value={v} onChange={e => setV(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-normal text-slate-800" /></label><MemoPrintChips text={v} studentName={name} preset={books} /></td></tr>;
}
createRoot(document.getElementById('root')!).render(<div className="p-4" style={{ maxWidth: 640 }}>
  <p className="mb-2 text-xs text-slate-500">미리보기 · 특이 사항 칸에 직접 써 보세요 (예: "단어:" 또는 "수능2000 day 3 4")</p>
  <table className="w-full rounded-2xl bg-white"><thead><tr className="text-left text-xs text-slate-400"><th className="p-2">학생</th><th className="p-2">수업 내용</th><th className="p-2">특이 사항</th></tr></thead>
  <tbody><Row name="류**" start="" content="수특라 5과 / 단어: 능률voca day30 31" /><Row name="최**" start="수능2000 day 32 33" /><Row name="김**" start="수특라 day 3" /><Row name="이**" start="단어:" /><Row name="박**" start="서술형 숙제 해야함" /></tbody></table></div>);
