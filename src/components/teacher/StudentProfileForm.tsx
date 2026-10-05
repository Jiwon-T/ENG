import {useId,type FormEvent} from 'react';
import type {StudentProfileInput} from '../../lib/studentProfile';
import {registrationGrades} from '../../lib/studentRegistration';
import OptionalMark from './OptionalMark';
export default function StudentProfileForm({value,onChange,onSubmit,disabled,busy,retrying}:{value:StudentProfileInput;onChange:(value:StudentProfileInput)=>void;onSubmit:()=>void;disabled?:boolean;busy?:boolean;retrying?:boolean}) {
    const id=useId();
    function change(key:keyof StudentProfileInput,next:string|number|null){onChange({...value,[key]:next});}
    function submit(event:FormEvent){event.preventDefault();if(!busy)onSubmit();}
    return <form onSubmit={submit}>
        <fieldset disabled={disabled || busy} className="grid sm:grid-cols-2 gap-3">
            <legend className="sr-only">학생 정보 수정</legend>
            <label htmlFor={`${id}-name`} className="sm:col-span-2">학생 표시 이름<input id={`${id}-name`} required maxLength={200} value={value.displayName} onChange={e=>change('displayName',e.target.value)} placeholder="이름(학교 학년)" autoComplete="off"/><span className="block text-xs text-slate-400 mt-1">학교·학년을 바꾸면 이 이름의 표기도 함께 확인해 주세요.</span></label>
            <label htmlFor={`${id}-school`}>학교<OptionalMark/><input id={`${id}-school`} maxLength={80} value={value.school} onChange={e=>change('school',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-grade`}>학년<OptionalMark/><select id={`${id}-grade`} value={value.grade} onChange={e=>change('grade',e.target.value)}><option value="">선택 안 함</option>{registrationGrades.map(grade=><option key={grade}>{grade}</option>)}</select></label>
            <label htmlFor={`${id}-studentPhone`}>학생 연락처<OptionalMark/><input id={`${id}-studentPhone`} type="tel" maxLength={30} value={value.studentPhone} onChange={e=>change('studentPhone',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-guardianPhone`}>보호자 연락처<OptionalMark/><input id={`${id}-guardianPhone`} type="tel" maxLength={30} value={value.guardianPhone} onChange={e=>change('guardianPhone',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-guardianName`}>보호자 이름<OptionalMark/><input id={`${id}-guardianName`} maxLength={80} value={value.guardianName} onChange={e=>change('guardianName',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-studentSalutation`}>학생 호칭<OptionalMark/><input id={`${id}-studentSalutation`} maxLength={80} value={value.studentSalutation} onChange={e=>change('studentSalutation',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-tuition`}>수강료<OptionalMark/><input id={`${id}-tuition`} type="number" min={0} max={100000000} step={1} value={value.tuition ?? ''} onChange={e=>change('tuition',e.target.value===''?null:Number(e.target.value))}/></label>
            <label htmlFor={`${id}-paymentDeadline`}>납부기한<OptionalMark/><input id={`${id}-paymentDeadline`} maxLength={200} value={value.paymentDeadline} onChange={e=>change('paymentDeadline',e.target.value)} autoComplete="off"/></label>
        </fieldset>
        <p className="text-xs text-slate-500 mt-4">보호자 번호를 변경하면 기존 인증이 해제됩니다. 노션 반영 후 같은 리포트 주소에서 새 번호 뒤 4자리로 인증합니다. 번호를 비우면 PIN 인증이 중지됩니다.</p>
        <button type="submit" className="primary-button mt-4" disabled={busy || (disabled && !retrying) || !value.displayName.trim()}>{busy?'저장·반영 중…':retrying?'저장 결과 확인·재시도':'학생 정보 저장·반영'}</button>
    </form>;
}
