import {emptyAdmission} from '../../lib/studentAdmission';
import StudentAdmissionFields from './StudentAdmissionFields';
import { useId, type FormEvent } from 'react';
import { registrationGrades, registrationSubjects, type RegistrationInput, type RegistrationOptions } from '../../lib/studentRegistration';
import OptionalMark from './OptionalMark';
interface Props {
    value: RegistrationInput;
    onChange: (value: RegistrationInput) => void;
    onSubmit: () => void;
    disabled?: boolean;
    busy?: boolean;
    retrying?: boolean;
    options?: RegistrationOptions;
}
export default function StudentRegistrationForm({value,onChange,onSubmit,disabled=false,busy=false,retrying=false,options}: Props) {
    const id=useId();
    function change(key: keyof RegistrationInput, next: string | number | null) { onChange({...value,[key]:next}); }
    function submit(event:FormEvent) { event.preventDefault(); if(!busy)onSubmit(); }
    return <form onSubmit={submit} className="student-registration-form">
        <fieldset disabled={disabled || busy} className="grid sm:grid-cols-2 gap-3">
            <legend className="sr-only">신입생 정보</legend>
            <label htmlFor={`${id}-name`}>학생 이름<input id={`${id}-name`} required maxLength={60} value={value.name} onChange={e=>change('name',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-school`}>학교<OptionalMark/><input id={`${id}-school`} maxLength={80} value={value.school} onChange={e=>change('school',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-grade`}>학년<OptionalMark/><select id={`${id}-grade`} value={value.grade} onChange={e=>change('grade',e.target.value)}><option value="">선택 안 함</option>{registrationGrades.map(grade=><option key={grade}>{grade}</option>)}</select></label>
            <label htmlFor={`${id}-salutation`}>학생 호칭<OptionalMark/><input id={`${id}-salutation`} maxLength={80} value={value.studentSalutation} onChange={e=>change('studentSalutation',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-student-phone`}>학생 연락처<OptionalMark/><input id={`${id}-student-phone`} type="tel" maxLength={30} value={value.studentPhone} onChange={e=>change('studentPhone',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-guardian-phone`}>보호자 연락처<OptionalMark/><input id={`${id}-guardian-phone`} type="tel" maxLength={30} value={value.guardianPhone} onChange={e=>change('guardianPhone',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-guardian-name`}>보호자 이름<OptionalMark/><input id={`${id}-guardian-name`} maxLength={80} value={value.guardianName} onChange={e=>change('guardianName',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-tuition`}>수강료<OptionalMark/><input id={`${id}-tuition`} type="number" min={0} max={100000000} step={1} value={value.tuition ?? ''} onChange={e=>change('tuition',e.target.value===''?null:Number(e.target.value))}/></label>
            <label htmlFor={`${id}-deadline`} className="sm:col-span-2">납부기한<OptionalMark/><input id={`${id}-deadline`} maxLength={200} value={value.paymentDeadline} onChange={e=>change('paymentDeadline',e.target.value)} placeholder="예: 매월 5일" autoComplete="off"/></label>
        </fieldset>
        <fieldset disabled={disabled || busy} className="mt-5">
            <legend className="text-sm font-bold text-slate-600">과목별 수강</legend>
            <div className="flex flex-wrap gap-4 py-3">{registrationSubjects.map(subject=><label key={subject} className="flex items-center gap-1.5"><input type="checkbox" checked={value.enrollments.some(item=>item.subject===subject)} onChange={e=>onChange({...value,enrollments:e.target.checked?[...value.enrollments,{subject,status:'등록',startDate:value.enrollments[0]?.startDate || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),endDate:null}]:value.enrollments.filter(item=>item.subject!==subject)})}/>{subject}</label>)}</div>
            {value.enrollments.map(item=><div key={item.subject} className="registration-enrollment">
                <span className="font-bold text-sm text-slate-600">{item.subject}</span>
                <label>수강 상태<select aria-label={`${item.subject} 수강 상태`} value={item.status} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,status:e.target.value as typeof row.status,endDate:e.target.value==='중단'?row.endDate:null,classIds:e.target.value==='등록'?row.classIds:[]}:row)})}>{['등록','대기','중단'].map(status=><option key={status}>{status}</option>)}</select></label>
                <label>담당 선생님<OptionalMark/><select aria-label={`${item.subject} 담당 선생님`} disabled={!options} value={item.teacherUid || ''} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,teacherUid:e.target.value || null,classIds:[]}:row)})}><option value="">배정 안 함</option>{item.teacherUid && !options?.teachers.some(t=>t.uid===item.teacherUid && t.subjects.includes(item.subject)) ? <option value={item.teacherUid}>기존 담당 (연결 확인 필요)</option> : null}{options?.teachers.filter(t=>t.subjects.includes(item.subject)).map(teacher=><option key={teacher.uid} value={teacher.uid}>{teacher.name}</option>)}</select></label>
                <label>시작일<input aria-label={`${item.subject} 시작일`} type="date" required value={item.startDate} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,startDate:e.target.value}:row)})}/></label>
                {item.status==='중단' ? <label>중단일<input aria-label={`${item.subject} 중단일`} type="date" required min={item.startDate} value={item.endDate || ''} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,endDate:e.target.value || null}:row)})}/></label> : null}
                <fieldset className="registration-class-selection" disabled={!options || item.status!=='등록' || !item.teacherUid}><legend className="text-xs">소속반<OptionalMark/></legend>{Boolean(item.classIds?.length) && <button type="button" className="small-button" onClick={()=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,classIds:[]}:row)})}>반 선택 해제</button>}{options?.classes.filter(c=>c.subject===item.subject && c.teacherUids.includes(item.teacherUid || '')).map(c=><label key={c.id} className="flex items-center gap-2 my-2 text-sm"><input type="checkbox" checked={item.classIds?.includes(c.id) || false} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,classIds:e.target.checked?[...(row.classIds || []),c.id]:(row.classIds || []).filter(id=>id!==c.id)}:row)})}/>{c.name}</label>)}{(item.classIds || []).filter(id=>!options?.classes.some(c=>c.id===id && c.subject===item.subject && c.teacherUids.includes(item.teacherUid || ''))).map(id=><p className="text-xs text-rose-600" key={id}>기존 반 연결을 확인해 주세요.</p>)}<p className="text-xs text-slate-400">등록 상태에서 담당 선생님을 선택하면 진행 중인 반을 선택할 수 있습니다.</p></fieldset>
            </div>)}
            {!value.enrollments.length ? <p className="text-xs text-rose-600">수강 과목을 하나 이상 선택해 주세요.</p> : null}
        </fieldset>
        <fieldset disabled={disabled||busy}><StudentAdmissionFields value={value.admission||emptyAdmission()} onChange={admission=>onChange({...value,admission})}/></fieldset>
        <button type="submit" className="primary-button mt-5" disabled={busy || (disabled && !retrying) || !value.enrollments.length}>{busy?'저장 중…':retrying?'저장 결과 확인·재시도':'등록 내용 저장'}</button>
    </form>;
}
