import {useState} from 'react';
import {examDetail,schoolExamDetails,assessmentDetails,suggestedExamTitle} from '../../lib/academicExamPeriod';
/** Shared by the single and batch editors: type, detail chips, date/year and the auto title. */
export default function ExamFields({value,onField,schoolTag,onSchoolTag}:{value:any;onField:(key:string,v:any)=>void;schoolTag:string;onSchoolTag:(v:string)=>void}){
 const suggestion=suggestedExamTitle(value,schoolTag),[custom,setCustom]=useState(Boolean(value.title&&value.title!==suggestion));
 const details=value.examType==='학교 내신'?schoolExamDetails:assessmentDetails;
 return <>
  <div className="gs-seg" role="group" aria-label="구분">{['학교 내신','학력평가'].map(k=><button key={k} type="button" aria-pressed={value.examType===k} onClick={()=>onField('examType',k)}>{k==='학교 내신'?'내신':k}</button>)}</div>
  <div className="gs-chips" role="group" aria-label="세부 종류">{[...details,''].map(d=><button key={d||'none'} type="button" className="rv-chip" aria-pressed={examDetail(value)===d} onClick={()=>onField('examDetail',d)}>{d?d.replace('고사',''):'미분류'}</button>)}</div>
  <div className="gs-two"><label><span className="gs-lbl">시험일</span><input type="date" required value={value.examDate} onChange={e=>onField('examDate',e.target.value)}/></label><label><span className="gs-lbl">연도 <span className="gs-opt">(선택)</span></span><input type="number" min="1900" max="2200" value={value.examYear??''} onChange={e=>onField('examYear',e.target.value?Number(e.target.value):null)}/></label></div>
  {value.examType==='학교 내신'&&<label><span className="gs-lbl">학교·학년 <span className="gs-opt">(학생 관리 정보로 채워져요 · 예: 세교중2)</span></span><input value={schoolTag} maxLength={30} onChange={e=>onSchoolTag(e.target.value)} placeholder="예: 세교중2"/></label>}
  {suggestion&&!custom?<p className="gs-title">시험명 <b>{value.title||suggestion}</b> <button type="button" className="gs-link" onClick={()=>setCustom(true)}>직접 입력</button></p>
   :<label><span className="gs-lbl">시험명</span><input value={value.title} maxLength={200} onChange={e=>onField('title',e.target.value)} placeholder={suggestion||'예: 세교중2-2중간'}/>{suggestion&&<button type="button" className="gs-link" onClick={()=>{onField('title',suggestion);setCustom(false);}}>자동 시험명 쓰기</button>}</label>}
 </>;
}
