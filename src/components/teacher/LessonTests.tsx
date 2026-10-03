import { gridScore } from '../../lib/teacherLessonGrid';
export default function LessonTests({ value, onChange }: { value: any; onChange: (key: string, value: number | null) => void }) {
  return <div className="lesson-tests">{[
    ['일반 테스트', 'correct', 'total'], ['내신 대비 테스트', 'examCorrect', 'examTotal'],
  ].map(([name, correct, total]) => <fieldset key={name} className="lesson-test">
    <legend>{name} <span className="text-xs font-normal text-slate-400">선택</span></legend>
    <div className="grid grid-cols-2 gap-2">{[[correct, '정답 수'], [total, '문항 수']].map(([key, label]) => <label key={key}>{label}<input aria-label={`${name} ${label}`} type="number" step="1" min={key === correct ? 0 : 1} value={value[key] ?? ''} onChange={e => onChange(key, e.target.value === '' ? null : Number(e.target.value))}/></label>)}</div>
    <p className="text-xs text-pink-600 mt-2">환산 {gridScore(value[correct] ?? null, value[total] ?? null) ?? '—'} / 100</p>
  </fieldset>)}</div>;
}
