import LessonTimePresets from './LessonTimePresets';
export default function LessonAcademyFields({ value, onChange,regularTime,roundHints={} }: { value: any; onChange: (key: string, value: any,manual?:boolean) => void;regularTime?:{start:string;end:string};roundHints?:Record<string,string> }) {
  const changeSession = (kind: 'classSession' | 'selfStudy', choice: string) => {
    onChange(kind, choice);
    if (kind==='selfStudy' && choice==='있음' && value.end && !value.selfStudyStart && !value.selfStudyEnd) {
      const [hour,minute]=value.end.split(':').map(Number);
      if(hour<23){onChange('selfStudyStart',value.end);onChange('selfStudyEnd',`${String(hour+1).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);}
    }
    if (choice !== '있음') {
      for (const key of kind === 'classSession' ? ['start', 'end', 'round'] : ['selfStudyStart', 'selfStudyEnd', 'selfStudyRound'])
        onChange(key, key.endsWith('Round') || key === 'round' ? null : '',false);
    }
  };
  return <div className="lesson-time-block" aria-label="수업·자습 시간과 회차">
    {([
      ['classSession', '수업', 'start', 'end', 'round'],
      ['selfStudy', '자습', 'selfStudyStart', 'selfStudyEnd', 'selfStudyRound'],
    ] as const).map(([kind, title, start, end, round]) => {
      const choice = value[kind] || (kind === 'classSession' ? '있음' : '미확인');
      const enabled = choice === '있음';
      return <fieldset className="lesson-time-row" key={kind}>
        <legend className="sr-only">{title} 시간·회차</legend>
        <label>{title}<select aria-label={`${title} 여부`} value={choice} onChange={e => changeSession(kind, e.target.value)}>
          {kind === 'selfStudy' && <option>미확인</option>}<option>있음</option><option>없음</option>
        </select></label>
        <label>회차<input aria-label={`${title} 회차`} type="number" step="any" inputMode="decimal" min="0" disabled={!enabled} required={enabled} placeholder={enabled ? '필수' : '—'} value={value[round] ?? ''} onChange={e => onChange(round, e.target.value === '' ? null : Number(e.target.value))}/>{roundHints[round]&&<span className="lesson-round-hint">{roundHints[round]}</span>}</label>
        <LessonTimePresets title={title} start={value[start]||''} end={value[end]||''} enabled={enabled} normal={kind==='classSession'?regularTime:undefined} onChange={(newStart,newEnd)=>{if(newStart!==value[start])onChange(start,newStart);onChange(end,newEnd);}}><label>시작<input aria-label={`${title} 시작`} type="time" disabled={!enabled} required={enabled} value={value[start] || ''} onChange={e => onChange(start, e.target.value)}/></label>
        <label>종료<input aria-label={`${title} 종료`} type="time" disabled={!enabled} required={enabled} value={value[end] || ''} onChange={e => onChange(end, e.target.value)}/></label></LessonTimePresets>

      </fieldset>;
    })}
  </div>;
}
