import {useEffect,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
import {messageVariables,renderTeacherMessage,renderTeacherMessageParts,missingParts,missingKeys,fillMessageVariable,messageSize,unresolvedMessage,type MessagePart} from '../../lib/teacherMessage';
import WorkspaceDialog from './WorkspaceDialog';
const labels:Record<string,string>={prepared:'저장 대기',ready:'발송 전',sending:'발송 요청 중 · 결과 확인 필요',accepted:'발송 요청 접수',uncertain:'발송 결과 불명확 · 자동 재전송 차단'};
export default function TeacherMessageComposer({studentKey,subjects,onClose}:{studentKey:string;subjects:string[];onClose:()=>void}){
 const [subject,setSubject]=useState(subjects[0]||'영어'),[data,setData]=useState<any>(null),[templateId,setTemplateId]=useState(''),[lessonId,setLessonId]=useState(''),[body,setBody]=useState(''),[record,setRecord]=useState<any>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
 const version=useRef(0),working=useRef(false),intent=useRef<any>(null);
 // The body as the template made it (with which parts came from the data), the bubble mode, and an empty value being filled.
 const [generated,setGenerated]=useState<{body:string;parts:MessagePart[]}|null>(null),[editing,setEditing]=useState(false),[stale,setStale]=useState(false),[filling,setFilling]=useState<{key:string;value:string}|null>(null);
 async function request(action:string,values:any={},read=false){const q=new URLSearchParams({action,...values});const r=await teacherAuthenticatedRequest<any>(auth,read?`/api/teacher/workspace?${q}`:'/api/teacher/workspace',read?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values})});if(!r.ok||!r.data?.ok)throw Error(r.data?.message||'결과를 확인하지 못했습니다. 목록에서 저장한 요청을 확인해 주세요.');return r.data;}
 useEffect(()=>{++version.current;let live=true;setData(null);setRecord(null);setBody('');intent.current=null;setTemplateId('');setLessonId('');setConfirmed(false);setMessage('');setGenerated(null);setEditing(false);setStale(false);setFilling(null);const initialUid=auth.currentUser?.uid;const unsub=onAuthStateChanged(auth,user=>{if(user?.uid!==initialUid){version.current++;setData(null);setRecord(null);setMessage('로그인 계정이 변경되었습니다. 창을 다시 열어 주세요.');}});const generation=version.current;void request('messages',{studentKey,subject},true).then(r=>{if(live&&version.current===generation)setData(r);}).catch(e=>{if(live)setMessage(e.message);});return()=>{live=false;version.current++;unsub();};},[studentKey,subject]);
 function generate(){const template=data?.templates.find((t:any)=>t.id===templateId),lesson=data?.lessons.find((l:any)=>l.id===lessonId);if(!template)return;const variables=messageVariables(data.profile,lesson?.data),r=renderTeacherMessage(template.body,variables);setBody(r.body);setGenerated({body:r.body,parts:renderTeacherMessageParts(template.body,variables)});setEditing(false);setStale(false);setFilling(null);setMessage([r.missing.length?`확인할 변수: ${r.missing.join(', ')}`:'본문을 확인하고 필요한 내용을 수정해 주세요.',r.dropped.length?`이 수업에 값이 없어 빠진 줄: ${r.dropped.join(', ')}`:''].filter(Boolean).join(' · '));setConfirmed(false);}
 async function run(send=false){if(working.current)return;const generation=version.current,uid=auth.currentUser?.uid;working.current=true;setBusy(true);setMessage('');try{if(send){const r=await request('send-message',{id:record.id,confirmed:true});if(generation!==version.current||auth.currentUser?.uid!==uid)return;setRecord(r.record);setConfirmed(false);setMessage(labels[r.record.status]);}else{const v=intent.current||{id:crypto.randomUUID(),studentKey,subject,templateId,lessonId:lessonId||null,body};intent.current=v;const r=await request('prepare-message',v);if(generation!==version.current||auth.currentUser?.uid!==uid)return;setRecord(r.record);setMessage('본문을 저장했습니다. 수신자와 본문을 최종 확인해 주세요.');}}catch(e){if(generation===version.current)setMessage(e instanceof Error?e.message:'결과 확인 필요');}finally{working.current=false;if(generation===version.current)setBusy(false);}}
 // Choosing a template or a lesson shows the message right away; an edited body is kept and the change is only offered.
 useEffect(()=>{if(!data||!templateId||record||intent.current)return;if(!body.trim()||generated&&body===generated.body)generate();else setStale(true);},[templateId,lessonId,data]);
 function revert(){if(body.trim()&&generated&&body!==generated.body&&!window.confirm('고친 내용을 버리고 템플릿으로 다시 만들까요?'))return;generate();}
 function fill(){if(!filling||!filling.value.trim())return;setBody(b=>fillMessageVariable(b,filling.key,filling.value.trim()));setFilling(null);setConfirmed(false);setMessage('');}
 function close(){if(working.current)return;if(body.trim()&&!record&&!intent.current&&!window.confirm('저장하지 않은 문자본문을 닫을까요?'))return;onClose();}
 const locked=Boolean(record)||Boolean(intent.current)||busy,text=record?.body??body;
 const parts=!record&&generated&&text===generated.body?generated.parts:missingParts(text),empty=missingKeys(text),size=messageSize(text);
 const tone=(s:string)=>s==='accepted'?'is-ok':s==='uncertain'||s==='sending'?'is-warn':'is-wait';
 return <WorkspaceDialog open title="보호자 문자" onClose={close}>
 <div className="msg">
 <p className="msg-lead">수업일지 반영과 별도로 발송합니다. 단체 유형 템플릿도 선택한 학생 한 명에게 보냅니다.</p>
 {data&&!data.delivery?.configured&&<p role="status" className="msg-alert">Bati 수신자·본문·응답 규약 설정을 확인하기 전에는 실제 발송을 사용할 수 없습니다. 본문 생성과 저장은 가능합니다.</p>}
 <div className="msg-grid">
  <section className="msg-panel" aria-label="문자 작성">
   <h3 className="msg-step"><b>1</b>내용 고르기</h3>
   <div className="msg-field"><span className="msg-label">과목</span><div className="msg-seg" role="group" aria-label="과목">{subjects.map(s=><button type="button" key={s} aria-pressed={subject===s} disabled={busy} onClick={()=>setSubject(s)}>{s}</button>)}</div></div>
   {data&&<>
    <label className="msg-field"><span className="msg-label">템플릿</span><select disabled={locked} value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">템플릿 선택</option>{data.templates.map((t:any)=><option key={t.id} value={t.id}>{t.title} · {t.target}</option>)}</select></label>
    <label className="msg-field"><span className="msg-label">반영된 수업일지</span><select disabled={locked} value={lessonId} onChange={e=>setLessonId(e.target.value)}><option value="">수업일지 없이 작성</option>{data.lessons.map((l:any)=><option key={l.id} value={l.id}>{l.data.date} · {l.data.subject}</option>)}</select></label>
    <p className="msg-hint">{templateId?'오른쪽에 실제로 보낼 문자가 바로 나와요. 색칠된 부분은 학생·수업일지에서 가져온 값이에요.':'템플릿을 고르면 오른쪽에 실제로 보낼 문자가 바로 나와요.'}</p>
   </>}
   {data?.records?.length?<details className="msg-history"><summary>저장·발송 이력 <span>{data.records.length}</span></summary><ul>{data.records.map((r:any)=><li key={r.id}><button type="button" disabled={busy} onClick={()=>{setRecord(r);setConfirmed(false);setBody(r.body);intent.current=null;}}><span>{new Date(r.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'})}</span><span className={`msg-badge ${tone(r.status)}`}>{labels[r.status]}</span></button></li>)}</ul></details>:null}
  </section>
  <section className="msg-panel msg-preview" aria-label="문자 미리보기">
   <h3 className="msg-step"><b>2</b>확인하고 보내기</h3>
   {data&&<p className="msg-to"><span>받는 사람</span><strong>{data.profile.displayName} 보호자</strong><em>{record?.recipient??data.profile.guardianPhone}</em></p>}
   {stale&&!locked&&<p className="msg-stale">템플릿이나 수업일지가 바뀌었어요. 고친 본문은 그대로 두었어요. <button type="button" className="gs-quiet" onClick={revert}>새로 만들기</button></p>}
   <div className={`msg-bubble${editing&&!locked?' is-editing':''}`}>
    {editing&&!locked?<textarea aria-label="문자본문" autoFocus maxLength={5000} placeholder="직접 입력하세요." value={text} onChange={e=>{setBody(e.target.value);setConfirmed(false);}}/>
     :<div className={`msg-render${text?'':' is-empty'}`} role={locked?undefined:'button'} tabIndex={locked?undefined:0} aria-label={locked?'문자본문':'문자본문 · 눌러서 고치기'} onClick={()=>{if(!locked)setEditing(true);}} onKeyDown={e=>{if(!locked&&(e.key==='Enter'||e.key===' ')){e.preventDefault();setEditing(true);}}}>
      {text?parts.map((p,i)=>p.kind==='plain'?<span key={i}>{p.text}</span>:<mark key={i} className={`msg-var is-${p.kind}`} title={p.kind==='filled'?`${p.key} · 자동으로 채운 값`:`${p.key} · 값이 비어 있어요`}>{p.text}</mark>):'템플릿을 고르거나 여기를 눌러 직접 입력하세요.'}</div>}
    <div className="msg-bubble-foot"><span className={`msg-size${size.over?' is-over':''}`}>{size.kind==='SMS'?'단문 SMS':'장문 LMS'} · {size.bytes}/{size.limit}바이트</span>{!locked&&<button type="button" className="gs-quiet" onClick={()=>setEditing(e=>!e)}>{editing?'미리보기로 보기':'직접 고치기'}</button>}</div>
   </div>
   {!locked&&empty.length>0&&<div className="msg-missing"><span>빈 값</span>{empty.map(key=><button type="button" key={key} className={filling?.key===key?'is-open':''} onClick={()=>setFilling(filling?.key===key?null:{key,value:''})}>{`{{${key}}}`}</button>)}
    {filling&&<form className="msg-fill" onSubmit={e=>{e.preventDefault();fill();}}><input autoFocus aria-label={`${filling.key} 값`} placeholder={`${filling.key}에 넣을 내용`} value={filling.value} onChange={e=>setFilling({...filling,value:e.target.value})}/><button type="submit" className="small-button" disabled={!filling.value.trim()}>넣기</button><button type="button" className="gs-quiet" onClick={()=>setFilling(null)}>취소</button></form>}
    <p className="msg-hint">빈 값이 남아 있으면 저장할 수 없어요. 눌러서 채우거나 직접 고쳐 주세요.</p></div>}
   {!locked&&generated&&body!==generated.body&&<button type="button" className="gs-quiet msg-revert" onClick={revert}>원래 템플릿으로 되돌리기</button>}
   {data&&!record&&<button className="primary-button msg-main" disabled={busy||!templateId||!body.trim()||unresolvedMessage(body)} onClick={()=>void run()}>{intent.current?'저장 결과 확인 · 재시도':'본문 저장 · 발송 준비'}</button>}
   {record?.context&&<details className="msg-context"><summary>기존 Bati 연동 정보 확인</summary><dl>{Object.entries(record.context).map(([key,value])=><div key={key} className="text-xs py-1"><dt className="font-bold">{key}</dt><dd className="whitespace-pre-wrap">{String(value)}</dd></div>)}</dl><p className="text-xs mt-2">기존 수식 방식이 설정된 경우에만 위 항목을 함께 전송합니다.</p></details>}
   {record&&<div className="msg-record"><p role="status" className={`msg-badge ${tone(record.status)}`}>{labels[record.status]}</p>
    {record.status==='prepared'&&<button className="small-button" disabled={busy} onClick={()=>{intent.current={id:record.id,studentKey,subject:record.subject,templateId:record.templateId,lessonId:record.lessonId||null,body:record.body};void run();}}>저장 결과 확인 · 재시도</button>}
    {record.status==='ready'&&<><label className="msg-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> 위 수신자 번호·문자본문과 연동 정보를 최종 확인했습니다.</label><button className="primary-button msg-main" disabled={busy||!confirmed||!data.delivery?.configured||(data.delivery?.payloadMode==='legacy-student'&&!record.context)} onClick={()=>void run(true)}>확인한 문자 발송</button></>}
    <button type="button" className="gs-quiet msg-rewrite" disabled={busy||record.status==='sending'||record.status==='uncertain'} onClick={()=>{setBody(record.body);setTemplateId(record.templateId);setLessonId(record.lessonId||'');setRecord(null);intent.current=null;setConfirmed(false);setMessage('기존 요청을 보존하고 새 본문을 작성합니다.');}}>새 본문으로 수정</button>
   </div>}
  </section>
 </div>
 {!data&&!message&&<p role="status">문자 정보를 불러오는 중…</p>}{message&&<p role="status" className="msg-message">{message}</p>}
 </div>
 </WorkspaceDialog>;
}





