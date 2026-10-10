import {emptyAdmission} from '../../lib/studentAdmission';
import StudentAdmissionFields from './StudentAdmissionFields';
import { useId, useState, type FormEvent, type MouseEvent } from 'react';
const steps=['학생 정보','상담 내용','수강·수강료'];
import { registrationGrades, registrationSubjects, registrationTuitionTotal, type RegistrationInput, type RegistrationOptions } from '../../lib/studentRegistration';
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
    const [step,setStep]=useState(0);
    // Older drafts kept one 수강료; with a single subject it belongs to that subject.
    const tuitionOf=(item:RegistrationInput['enrollments'][number])=>item.tuition??(value.enrollments.length===1?value.tuition:null);
    const total=value.enrollments.length===1?tuitionOf(value.enrollments[0]):registrationTuitionTotal(value);
    function setTuition(subject:string,text:string){const digits=text.replace(/\D/g,'').slice(0,9),n=digits===''?null:Number(digits);const enrollments=value.enrollments.map(row=>row.subject===subject?{...row,tuition:n}:row);const next={...value,enrollments};onChange({...next,tuition:registrationTuitionTotal({...next,tuition:null})});}
    function submit(event:FormEvent) { event.preventDefault(); if(!busy)onSubmit(); }
    // Steps are only hidden with CSS, so a required field on another step is shown before the browser reports it.
    function check(event:MouseEvent<HTMLButtonElement>) { const form=event.currentTarget.form,bad=form?.querySelector<HTMLElement>(':invalid:not(fieldset)'); const at=bad?.closest<HTMLElement>('[data-step]')?.dataset.step; if(!bad||at===undefined||Number(at)===step)return; event.preventDefault(); setStep(Number(at)); setTimeout(()=>(bad as HTMLInputElement).reportValidity?.(),0); }
    return <form onSubmit={submit} className="student-registration-form admission-application">
        <div className="adm-steps" role="tablist" aria-label="원서 단계">{steps.map((label,n)=><button key={label} type="button" role="tab" aria-selected={step===n} onClick={()=>setStep(n)}><span className="gs-num">{n+1}</span>{label}{n===0&&value.name.trim()&&<small>{value.name.trim()}</small>}{n===2&&<small>{value.enrollments.map(e=>e.subject).join('·')||'과목 없음'}</small>}</button>)}</div>
        <p className="adm-note">상담 내용은 학생·학부모 공개 리포트에 표시되지 않습니다. 어느 단계에서든 저장할 수 있습니다.</p>
        <fieldset data-step="0" data-current={step===0} disabled={disabled || busy} className="adm-step admission-section adm-grid">
            <legend className="font-bold text-sm text-slate-600">학생·보호자 정보</legend>
            <label htmlFor={`${id}-name`}>학생 이름<input id={`${id}-name`} required maxLength={60} value={value.name} onChange={e=>change('name',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-school`}>학교<OptionalMark/><input id={`${id}-school`} maxLength={80} value={value.school} onChange={e=>change('school',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-grade`}>학년<OptionalMark/><select id={`${id}-grade`} value={value.grade} onChange={e=>change('grade',e.target.value)}><option value="">선택 안 함</option>{registrationGrades.map(grade=><option key={grade}>{grade}</option>)}</select></label>
            <label htmlFor={`${id}-salutation`}>학생 호칭<OptionalMark/><input id={`${id}-salutation`} maxLength={80} value={value.studentSalutation} onChange={e=>change('studentSalutation',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-student-phone`}>학생 연락처<OptionalMark/><input id={`${id}-student-phone`} type="tel" maxLength={30} value={value.studentPhone} onChange={e=>change('studentPhone',e.target.value)} autoComplete="off"/></label>
            <label htmlFor={`${id}-guardian-phone`}>보호자 연락처<OptionalMark/><input id={`${id}-guardian-phone`} type="tel" maxLength={30} value={value.guardianPhone} onChange={e=>change('guardianPhone',e.target.value)} autoComplete="off"/></label>
            <StudentAdmissionFields section="basic" value={value.admission||emptyAdmission()} onChange={admission=>onChange({...value,admission})}/>
        </fieldset>
        <fieldset data-step="1" data-current={step===1} className="adm-step" disabled={disabled||busy}><StudentAdmissionFields section="learning" value={value.admission||emptyAdmission()} onChange={admission=>onChange({...value,admission})}/></fieldset>
        <div data-step="2" data-current={step===2} className="adm-step"><fieldset disabled={disabled || busy} className="admission-section">
            <legend className="text-sm font-bold text-slate-600">과목별 수강</legend>
            <div className="adm-subject-pick" role="group" aria-label="수강 과목">{registrationSubjects.map(subject=>{const on=value.enrollments.some(item=>item.subject===subject);return <label key={subject} className="rv-chip" data-on={on}><input type="checkbox" className="sr-only" checked={on} onChange={e=>onChange({...value,enrollments:e.target.checked?[...value.enrollments.map(row=>value.enrollments.length===1&&row.tuition==null?{...row,tuition:value.tuition}:row),{subject,status:'등록',startDate:value.enrollments[0]?.startDate || new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),endDate:null,tuition:null}]:value.enrollments.filter(item=>item.subject!==subject)})}/>{on?'✓ ':'+ '}{subject}</label>;})}</div>
            {value.enrollments.map(item=><div key={item.subject} className="registration-enrollment adm-subject">
                <div className="adm-subject-head"><strong>{item.subject}</strong>
                 <label className="adm-money">수강료 <span className="gs-opt">(8회 기준)</span><span className="adm-money-box"><input aria-label={`${item.subject} 수강료`} inputMode="numeric" placeholder="0" value={tuitionOf(item)==null?'':tuitionOf(item)!.toLocaleString('ko-KR')} onChange={e=>setTuition(item.subject,e.target.value)}/><em>원</em></span>{tuitionOf(item)!=null&&tuitionOf(item)!>0&&<small>1회 {Math.round(tuitionOf(item)!/8).toLocaleString('ko-KR')}원</small>}</label></div>
                <label>수강 상태<select aria-label={`${item.subject} 수강 상태`} value={item.status} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,status:e.target.value as typeof row.status,endDate:e.target.value==='중단'?row.endDate:null,classIds:e.target.value==='등록'?row.classIds:[]}:row)})}>{['등록','대기','중단'].map(status=><option key={status}>{status}</option>)}</select></label>
                <label>담당 선생님<OptionalMark/><select aria-label={`${item.subject} 담당 선생님`} disabled={!options} value={item.teacherUid || ''} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,teacherUid:e.target.value || null,classIds:[]}:row)})}><option value="">배정 안 함</option>{item.teacherUid && !options?.teachers.some(t=>t.uid===item.teacherUid && t.subjects.includes(item.subject)) ? <option value={item.teacherUid}>기존 담당 (연결 확인 필요)</option> : null}{options?.teachers.filter(t=>t.subjects.includes(item.subject)).map(teacher=><option key={teacher.uid} value={teacher.uid}>{teacher.name}</option>)}</select>{options && !options.teachers.some(t=>t.subjects.includes(item.subject)) ? <p role="status" className="text-xs text-rose-600 mt-1">이 과목의 재직 선생님 연결이 없습니다. 담당·반 목록을 새로고침하거나 관리자 설정에서 선생님 연결을 확인해 주세요.</p> : null}</label>
                <label>시작일<input aria-label={`${item.subject} 시작일`} type="date" required value={item.startDate} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,startDate:e.target.value}:row)})}/></label>
                {item.status==='중단' ? <label>중단일<input aria-label={`${item.subject} 중단일`} type="date" required min={item.startDate} value={item.endDate || ''} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,endDate:e.target.value || null}:row)})}/></label> : null}
                <fieldset className="registration-class-selection" disabled={!options || item.status!=='등록' || !item.teacherUid}><legend className="text-xs">소속반<OptionalMark/></legend>{Boolean(item.classIds?.length) && <button type="button" className="small-button" onClick={()=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,classIds:[]}:row)})}>반 선택 해제</button>}{options?.classes.filter(c=>c.subject===item.subject && c.teacherUids.includes(item.teacherUid || '')).map(c=><label key={c.id} className="flex items-center gap-2 my-2 text-sm"><input type="checkbox" checked={item.classIds?.includes(c.id) || false} onChange={e=>onChange({...value,enrollments:value.enrollments.map(row=>row.subject===item.subject?{...row,classIds:e.target.checked?[...(row.classIds || []),c.id]:(row.classIds || []).filter(id=>id!==c.id)}:row)})}/>{c.name}</label>)}{(item.classIds || []).filter(id=>!options?.classes.some(c=>c.id===id && c.subject===item.subject && c.teacherUids.includes(item.teacherUid || ''))).map(id=><p className="text-xs text-rose-600" key={id}>기존 반 연결을 확인해 주세요.</p>)}<p className="text-xs text-slate-400">등록 상태에서 담당 선생님을 선택하면 진행 중인 반을 선택할 수 있습니다.</p></fieldset>
            </div>)}
            {!value.enrollments.length ? <p className="text-xs text-rose-600">수강 과목을 하나 이상 선택해 주세요.</p> : null}
        </fieldset>
        <fieldset disabled={disabled||busy} className="admission-section adm-total"><legend className="font-bold text-sm text-slate-600">수강료·납부 안내</legend>
            <div className="adm-total-sum"><span>합계 수강료 <small>8회 기준</small></span><strong>{total==null?'—':`${total.toLocaleString('ko-KR')}원`}</strong>{value.enrollments.length>1&&<small>{value.enrollments.map(e=>`${e.subject} ${tuitionOf(e)==null?'—':tuitionOf(e)!.toLocaleString('ko-KR')}`).join(' + ')}</small>}</div>
            <label htmlFor={`${id}-deadline`}>납부기한<OptionalMark/><input id={`${id}-deadline`} maxLength={200} value={value.paymentDeadline} onChange={e=>change('paymentDeadline',e.target.value)} placeholder="예: 매월 5일" autoComplete="off"/></label>
        </fieldset></div>
        <div className="adm-foot"><button type="button" className="small-button" disabled={step===0} onClick={()=>setStep(step-1)}>이전</button>{step<steps.length-1&&<button type="button" className="small-button" onClick={()=>setStep(step+1)}>다음 · {steps[step+1]}</button>}<span className="gs-grow"/>{!value.enrollments.length&&<span className="adm-warn">수강 과목을 골라 주세요</span>}<button type="submit" className="primary-button" onClick={check} disabled={busy || (disabled && !retrying) || !value.enrollments.length}>{busy?'저장 중…':retrying?'저장 결과 확인·재시도':'등록 내용 저장'}</button></div>
    </form>;
}
