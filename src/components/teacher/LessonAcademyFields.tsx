import { shortRoundHint } from '../../lib/sessionNumbers';
import LessonTimePresets from './LessonTimePresets';
import {AudienceTag} from './LessonAudience';
export default function LessonAcademyFields({ value, onChange,regularTime,roundHints={},error=false }: { value: any; onChange: (key: string, value: any,manual?:boolean) => void;regularTime?:{start:string;end:string};roundHints?:Record<string,string>;error?:boolean }) {
  const changeSession = (kind: 'classSession' | 'selfStudy', choice: string) => {
    onChange(kind, choice);
    if (kind==='selfStudy' && choice==='있음' && value.end && !value.selfStudyStart && !value.selfStudyEnd) {
      const [hour,minute]=value.end.split(':').map(Number);
      if(hour<23){onChange('selfStudyStart',value.end);onChange('selfStudyEnd',`${String(hour+1).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);}
    }
    if (choice !== '있음' && kind === 'selfStudy' && value.selfStudyMore?.length) onChange('selfStudyMore', [], false);
    if (choice !== '있음') {
      for (const key of kind === 'classSession' ? ['start', 'end', 'round'] : ['selfStudyStart', 'selfStudyEnd', 'selfStudyRound'])
        onChange(key, key.endsWith('Round') || key === 'round' ? null : '',false);
    }
  };
  const more: {start: string; end: string}[] = Array.isArray(value.selfStudyMore) ? value.selfStudyMore : [];
  const setPiece = (i: number, patch: Partial<{start: string; end: string}>) => onChange('selfStudyMore', more.map((p, j) => j === i ? {...p, ...patch} : p));
  return <div className="lesson-time-block" aria-label="수업·자습 시간과 회차">
    <p className="lesson-audience-line">시간<AudienceTag to="parent"/><span aria-hidden="true">·</span>회차<AudienceTag to="teacher"/></p>
    {([
      ['classSession', '수업', 'start', 'end', 'round'],
      ['selfStudy', '자습', 'selfStudyStart', 'selfStudyEnd', 'selfStudyRound'],
    ] as const).map(([kind, title, start, end, round]) => {
      // 자습 has only 있음/없음; an old 미확인 shows (and is saved) as 없음.
      const choice = kind === 'selfStudy' ? (value[kind] === '있음' ? '있음' : '없음') : value[kind] || '있음';
      const enabled = choice === '있음';
      return <fieldset className="lesson-time-row" data-session-kind={kind} key={kind}>
        <legend className="sr-only">{title} 시간·회차</legend>
        <label>{title}<select aria-label={`${title} 여부`} value={choice} onChange={e => changeSession(kind, e.target.value)}>
          <option>있음</option><option>없음</option>
        </select></label>
        <div className="lesson-session-controls"><label>회차<input aria-label={`${title} 회차`} type="number" step="any" inputMode="decimal" min="0" disabled={!enabled} required={enabled} placeholder={enabled ? '필수' : '—'} value={value[round] ?? ''} onChange={e => onChange(round, e.target.value === '' ? null : Number(e.target.value))}/><span className="lesson-round-hint" title={roundHints[round]||undefined}>{shortRoundHint(roundHints[round]||'',title)}</span></label>
        <LessonTimePresets title={title} start={value[start]||''} end={value[end]||''} enabled={enabled} normal={kind==='classSession'?regularTime:undefined} lesson={kind==='selfStudy'&&value.classSession==='있음'?{start:value.start||'',end:value.end||''}:undefined} onChange={(newStart,newEnd)=>{if(newStart!==value[start])onChange(start,newStart);onChange(end,newEnd);}}><label>시작<input aria-label={`${title} 시작`} type="time" disabled={!enabled} required={enabled} value={value[start] || ''} onChange={e => onChange(start, e.target.value)}/></label>
        <label>종료<input aria-label={`${title} 종료`} type="time" disabled={!enabled} required={enabled} value={value[end] || ''} onChange={e => onChange(end, e.target.value)}/></label></LessonTimePresets></div>
        {/* 자습을 나눠 할 때 (수업 전·후): up to 3 pieces; the round counts all of them together. No <label> here: the row layout keys on label order. */}
        {kind === 'selfStudy' && enabled && <div className="lesson-study-more">
          {more.map((piece: {start: string; end: string}, i: number) => <div className="lesson-study-piece" key={i}>
            <span className="lesson-study-piece-name">자습 {i + 2}</span>
            <input aria-label={`자습 ${i + 2} 시작`} type="time" required value={piece.start || ''} onChange={e => setPiece(i, {start: e.target.value})}/>
            <span aria-hidden="true">–</span>
            <input aria-label={`자습 ${i + 2} 종료`} type="time" required value={piece.end || ''} onChange={e => setPiece(i, {end: e.target.value})}/>
            <button type="button" className="lesson-study-remove" aria-label={`자습 ${i + 2} 빼기`} onClick={() => onChange('selfStudyMore', more.filter((_: unknown, j: number) => j !== i))}>×</button>
          </div>)}
          {more.length < 2 && <button type="button" className="lesson-study-add" onClick={() => onChange('selfStudyMore', [...more, {start: '', end: ''}])}><span aria-hidden="true">+</span> 자습 시간</button>}
        </div>}

      </fieldset>;
    })}
  </div>;
}

