export default function LessonAcademyFields({value, onChange}: {value: any; onChange: (key: string, value: any) => void}) {
 return <div className="grid sm:grid-cols-2 gap-2 mt-3">
  <label>수업 여부<select value={value.classSession || '있음'} onChange={e => {onChange('classSession', e.target.value); if(e.target.value === '없음') {onChange('round', null); onChange('start', ''); onChange('end', '');} }}><option>있음</option><option>없음</option></select></label>
  <label>자습 여부 · 필수<select value={value.selfStudy || '미확인'} onChange={e => {onChange('selfStudy', e.target.value); onChange('selfStudyRound', null); onChange('selfStudyStart', ''); onChange('selfStudyEnd', '');}}><option>미확인</option><option>없음</option><option>있음</option></select></label>
  <label>자습 회차 · 필수<input type="number" step="any" min="0" required disabled={value.selfStudy !== '있음'} value={value.selfStudyRound ?? ''} onChange={e => onChange('selfStudyRound', e.target.value === '' ? null : Number(e.target.value))}/></label>
  {value.selfStudy === '있음' && <>{[['selfStudyStart','자습 시작'],['selfStudyEnd','자습 종료']].map(([key,label]) => <label key={key}>{label}<input type="time" required value={value[key] || ''} onChange={e => onChange(key,e.target.value)}/></label>)}</>}
  <label>지각·결석 메모<textarea rows={2} value={value.attendanceNote || ''} onChange={e => onChange('attendanceNote',e.target.value)}/></label>
  <label>학원 특이사항<textarea rows={2} value={value.specialNote || ''} onChange={e => onChange('specialNote',e.target.value)}/></label>
 </div>;
}
