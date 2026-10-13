import {useState} from 'react';
import WorkspaceDialog from './WorkspaceDialog';
import {offlineTeacherLabel} from '../../lib/teacherName';

const SUBJECTS=['국어','영어','수학','과학','한국사'];
const phoneOk=(v:string)=>/^0\d{8,10}$/.test(v.replace(/[\s()-]/g,''));

/** + 선생님 추가 (principal/admin): a teacher without an app account — name, subjects, phone (required), memo. */
export default function OfflineTeacherForm({busy,onClose,onSubmit}:{busy:boolean;onClose:()=>void;onSubmit:(v:{name:string;subjects:string[];phone:string;memo:string})=>Promise<void>}){
 const [name,setName]=useState(''),[subjects,setSubjects]=useState<string[]>([]),[phone,setPhone]=useState(''),[memo,setMemo]=useState(''),[tried,setTried]=useState(false);
 const problems=[!name.trim()&&'이름을 입력해 주세요.',!subjects.length&&'담당 과목을 하나 이상 골라 주세요.',!phoneOk(phone)&&'연락처를 확인해 주세요 (예: 010-0000-1234).'].filter(Boolean) as string[];
 const submit=()=>{setTried(true);if(!problems.length)void onSubmit({name:name.trim(),subjects,phone,memo:memo.trim()});};
 return <WorkspaceDialog open title="선생님 추가" onClose={onClose}><section className="gs offline-teacher-form">
  <p className="gs-note">앱에 가입하지 않은 선생님도 담당 학생을 정하고 정산에 넣을 수 있어요. 나중에 가입하면 이 기록과 연결할 수 있어요.</p>
  <label><span className="gs-lbl">이름 <b className="otf-req">*</b></span><input value={name} maxLength={40} disabled={busy} onChange={e=>setName(e.target.value)} placeholder="박민지"/></label>
  <div><span className="gs-lbl">담당 과목 <b className="otf-req">*</b></span><div className="otf-subjects" role="group" aria-label="담당 과목">{SUBJECTS.map(s=>{const on=subjects.includes(s);return <button key={s} type="button" aria-pressed={on} disabled={busy} onClick={()=>setSubjects(prev=>prev.includes(s)?prev.filter(x=>x!==s):[...prev,s])}>{s}</button>;})}</div></div>
  <label><span className="gs-lbl">연락처 <b className="otf-req">*</b></span><input type="tel" inputMode="tel" value={phone} maxLength={30} disabled={busy} onChange={e=>setPhone(e.target.value)} placeholder="010-0000-1234"/></label>
  <label><span className="gs-lbl">메모 <span className="gs-opt">(선택)</span></span><input value={memo} maxLength={200} disabled={busy} onChange={e=>setMemo(e.target.value)} placeholder="예: 엑셀로 일지 제출"/></label>
  {name.trim()&&<p className="gs-note">화면에는 <b>{offlineTeacherLabel(name,subjects)}</b>로 보여요.</p>}
  {tried&&problems.length>0&&<p role="alert" className="otf-error">{problems[0]}</p>}
  <div className="gs-foot"><span className="gs-grow"/><button type="button" className="small-button" disabled={busy} onClick={onClose}>취소</button><button type="button" className="primary-button" disabled={busy} onClick={submit}>추가</button></div>
 </section></WorkspaceDialog>;
}
