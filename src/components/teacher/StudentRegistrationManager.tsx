import StudentEnrollmentEditor from './StudentEnrollmentEditor';
import { useEffect, useRef, useState } from 'react';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { emptyRegistration, registrationStatusLabels, type RegistrationInput, type RegistrationRecord, type RegistrationSummary, type RegistrationOptions } from '../../lib/studentRegistration';
import { registrationSaveIntent, registrationFailureIsDefinitive, type RegistrationSaveIntent } from '../../lib/studentRegistrationSave';
import WorkspaceDialog from './WorkspaceDialog';
import StudentRegistrationForm from './StudentRegistrationForm';
interface PageResult extends ServerResult {ok:boolean;records:RegistrationSummary[];page:number;pages:number;total:number;counts?:Record<string,number>}
interface ServerResult {ok:boolean;error?:string;message?:string;diagnosticId?:string;id?:string;revision?:number;syncStatus?:string;sourceMode?:string;record?:RegistrationRecord}
async function request<T>(action:string, values:Record<string,unknown>={}) {
    const params=new URLSearchParams({action});
    for(const [key,value] of Object.entries(values))params.set(key,String(value));
    return teacherAuthenticatedRequest<T>(auth,'/api/teacher/workspace?'+params.toString());
}
function responseMessage(result:{userMessage?:string;data?:{message?:string;diagnosticId?:string}}) {
    return `${result.data?.message || result.userMessage || '처리하지 못했습니다. 다시 시도해 주세요.'}${result.data?.diagnosticId ? ` (오류 ID: ${result.data.diagnosticId})` : ''}`;
}
export default function StudentRegistrationManager({onSynced,students=[],coreMode=false}:{onSynced:()=>Promise<void>;coreMode?:boolean;students?:any[]}) {
    const [intake,setIntake]=useState('all'),[enrollmentKey,setEnrollmentKey]=useState('');
    const [page,setPage]=useState(1),[reload,setReload]=useState(0);
    const [list,setList]=useState<PageResult>({ok:true,records:[],page:1,pages:1,total:0});
    const [loading,setLoading]=useState(true),[listError,setListError]=useState('');
    const [open,setOpen]=useState(false),[value,setValue]=useState<RegistrationInput>(emptyRegistration);
    const [key,setKey]=useState(''),[revision,setRevision]=useState<number | undefined>();
    const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[feedback,setFeedback]=useState('');
    const [options,setOptions]=useState<RegistrationOptions | undefined>(),[optionsError,setOptionsError]=useState(''),[optionsReload,setOptionsReload]=useState(0);
    const [locked,setLocked]=useState(false),[retrying,setRetrying]=useState(false);
    const intent=useRef<RegistrationSaveIntent | null>(null),writeBusy=useRef(false),generation=useRef(0);
    useEffect(()=>{
        let live=true;const uid=auth.currentUser?.uid;
        setLoading(true);setListError('');
        request<PageResult>('student-registrations',{page,intake}).then(result=>{
            if(!live || auth.currentUser?.uid!==uid)return;
            if(!result.ok || !result.data?.ok || !Array.isArray(result.data.records))throw new Error(responseMessage(result));
            setList(result.data);
        }).catch(error=>{if(live)setListError(error.message);}).finally(()=>{if(live)setLoading(false);});
        return()=>{live=false;};
    },[page,reload,intake]);
    useEffect(()=>{
        const originalUid=auth.currentUser?.uid;
        const unsubscribe=onAuthStateChanged(auth,user=>{
            if(user?.uid===originalUid)return;
            generation.current++;intent.current=null;setOptions(undefined);setOpen(false);setValue(emptyRegistration());setList({ok:true,records:[],page:1,pages:1,total:0});setFeedback('');setRetrying(false);setLocked(true);
        });
        return()=>{generation.current++;unsubscribe();};
    },[]);
    useEffect(()=>{
        if(!open)return;
        let live=true;const uid=auth.currentUser?.uid;
        setOptions(undefined);setOptionsError('');
        request<RegistrationOptions & ServerResult>('registration-options').then(result=>{
            if(!live || auth.currentUser?.uid!==uid)return;
            if(!result.ok || !result.data?.ok)throw Error(responseMessage(result));
            setOptions({teachers:result.data.teachers,classes:result.data.classes});
        }).catch(error=>{if(live && auth.currentUser?.uid===uid)setOptionsError(error.message);});
        return()=>{live=false;};
    },[open,optionsReload]);
    function start() {
        generation.current++;intent.current=null;setKey(crypto.randomUUID());setRevision(undefined);setValue({...emptyRegistration(),intakeStage:'consultation'});
        setFeedback('');setDirty(false);setLocked(false);setRetrying(false);setOpen(true);
    }
    async function edit(record:RegistrationSummary) {
        if(writeBusy.current)return;
        const current=++generation.current;setBusy(true);setFeedback('');
        try {
            const result=await request<ServerResult>('student-registration',{id:record.id});
            if(current!==generation.current)return;
            if(!result.ok || !result.data?.ok || !result.data.record)throw new Error(responseMessage(result));
            const saved=result.data.record;
            intent.current=null;setKey(saved.requestId);setRevision(saved.revision);setValue(saved.data);setDirty(false);setRetrying(false);
            setLocked(saved.canEdit===false || ['syncing','uncertain','synced'].includes(saved.syncStatus));setOpen(true);
            if(saved.syncStatus==='synced')setFeedback('노션에 반영한 학생 정보는 아래 학생 명부의 ‘정보 수정’에서 변경할 수 있습니다.');
            if(saved.canEdit===false && saved.syncStatus!=='synced')setFeedback('노션 반영 결과를 확인한 뒤 수정할 수 있습니다.');
        } catch(error) { if(current===generation.current)setFeedback(error instanceof Error?error.message:'등록 내용을 불러오지 못했습니다.'); }
        finally { if(current===generation.current)setBusy(false); }
    }
    function close() {
        if(writeBusy.current)return;
        if((dirty || intent.current) && !window.confirm(intent.current?'저장 결과를 확인하지 못했습니다. 창을 닫은 뒤 목록을 새로고침해 저장 여부를 확인해 주세요. 닫을까요?':'저장하지 않은 입력을 닫을까요?'))return;
        generation.current++;intent.current=null;setOptions(undefined);setOpen(false);setValue(emptyRegistration());setKey('');setRevision(undefined);setRetrying(false);setFeedback('');setBusy(false);
    }
    async function save() {
        if(writeBusy.current || (locked && !retrying))return;
        writeBusy.current=true;setBusy(true);setFeedback('');
        const current=generation.current,uid=auth.currentUser?.uid;
        let responseReceived=false;
        try {
            intent.current ||= registrationSaveIntent(value,key,revision);
            const result=await teacherAuthenticatedRequest<ServerResult>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(intent.current)});
            if(current!==generation.current || auth.currentUser?.uid!==uid)return;
            responseReceived=true;
            if(!result.ok || !result.data?.ok || !result.data.id || !Number.isInteger(result.data.revision)) {
                if(registrationFailureIsDefinitive(result.status)) {intent.current=null;setRetrying(false);setLocked(false);}
                else {setRetrying(true);setLocked(true);}
                throw new Error(responseMessage(result));
            }
            intent.current=null;setRevision(result.data.revision);setDirty(false);setLocked(false);setRetrying(false);
            setFeedback(value.purpose==='additional'?'추가 과목 상담을 저장했습니다. 목록에서 기존 학생의 수강 관리로 이어갈 수 있습니다.':value.intakeStage==='consultation'?'상담 내용을 저장했습니다. 아직 학생 명부에는 등록하지 않았습니다.':coreMode?'등록 내용을 저장했습니다. 앱 등록 확정 후 등록 첫 달 목록에서 관리합니다.':'등록 내용을 저장했습니다. 노션 반영 후 등록 첫 달 목록에서 관리합니다.');setReload(old=>old+1);
        } catch(error) {
            if(current!==generation.current)return;
            if(!responseReceived && intent.current){setRetrying(true);setLocked(true);}
            setFeedback(error instanceof Error?error.message:'저장 결과를 확인하지 못했습니다.');
        } finally {
            writeBusy.current=false;if(current===generation.current)setBusy(false);
        }
    }
    async function sync(record:RegistrationSummary) {
        if(writeBusy.current)return;
        writeBusy.current=true;setBusy(true);setFeedback('');
        const current=generation.current,uid=auth.currentUser?.uid;
        try {
            const result=await teacherAuthenticatedRequest<ServerResult>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sync-student-registration',id:record.id,revision:record.revision})});
            if(current!==generation.current || auth.currentUser?.uid!==uid)return;
            if(!result.ok || !result.data?.ok)throw new Error(responseMessage(result));
            setFeedback(result.data.sourceMode==='firestore'?'학생·수강·담당·반 연결을 앱에 저장했습니다.':'학생·수강 정보를 노션에 반영하고 학생 명부에 연결했습니다.');
            try { await onSynced(); } catch { setFeedback('등록은 완료됐지만 학생 명부를 다시 불러오지 못했습니다. 새로고침해 주세요.'); }
        } catch(error) { if(current===generation.current)setFeedback(error instanceof Error?error.message:'반영 결과를 확인하지 못했습니다.'); }
        finally {
            writeBusy.current=false;
            if(current===generation.current){setBusy(false);setReload(old=>old+1);}
        }
    }
    async function convert(record:RegistrationSummary){
        if(writeBusy.current)return;
        if(!window.confirm(record.purpose==='additional'?'선택한 상담 과목의 실제 등록을 확인한 뒤 상담 목록에서 정리할까요?':'재원생으로 전환할까요? 이 목록에서 빠지고 아래 학생 관리 카드에서 계속 관리합니다. 기존 기록과 리포트 주소는 유지됩니다.'))return;
        writeBusy.current=true;setBusy(true);setFeedback('');const current=generation.current,uid=auth.currentUser?.uid;
        try{const result=await teacherAuthenticatedRequest<ServerResult>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'convert-registration-resident',id:record.id,revision:record.revision})});if(current!==generation.current||auth.currentUser?.uid!==uid)return;if(!result.ok||!result.data?.ok)throw Error(responseMessage(result));setReload(n=>n+1);setFeedback('목록에서 정리했습니다. 아래 학생 관리 카드에서 계속 관리할 수 있습니다.');await onSynced();}catch(error){if(current===generation.current)setFeedback(error instanceof Error?error.message:'전환 결과를 확인하지 못했습니다.');}finally{writeBusy.current=false;if(current===generation.current)setBusy(false);}
    }
    return <section className="student-registration-manager mb-5" aria-label="상담·신입생 관리">

        <details ><summary className="report-intake-summary">상담·신입생 {list.counts?.all??list.total??0}건</summary>
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-600">상담·신입생 관리</h3><button type="button" className="small-button" disabled={busy} onClick={start}>+ 상담·신입생 추가</button></div>
        <p className="text-xs text-slate-500 my-2">상담만 저장한 학생은 별도로 관리합니다. 등록 첫 달은 신입생 목록에 두고, 재원생으로 전환하면 이 목록에서 빠져 아래 학생 관리 카드에서 관리합니다.</p>
        <div role="group" aria-label="상담·등록 구분" className="flex flex-wrap gap-2 my-3">{[["all","전체"],["consultation","상담만 진행"],["new","등록 첫 달"],["additional","추가 과목 상담"]].map(([id,label])=><button key={id} type="button" className={intake===id?"primary-button":"small-button"} aria-pressed={intake===id} onClick={()=>{setIntake(id);setPage(1);}}>{label} {list.counts?.[id]??""}</button>)}</div>{loading ? <p role="status" className="text-xs text-slate-500 py-2">불러오는 중…</p> : null}
        {listError ? <div role="alert" className="text-xs text-rose-600 py-2">{listError}<button type="button" className="small-button ml-2" onClick={()=>setReload(old=>old+1)}>다시 불러오기</button></div> : null}
        {!listError ? <div className="student-management-cards">{list.records.map(record=><div key={record.id} className="p-3 rounded-xl border border-pastel-pink-100 bg-pastel-pink-50/30">
            <p className="font-bold text-sm">{record.title}</p><p className="text-xs text-slate-500 mt-1">{record.enrollments.map(row=>`${row.subject} · ${row.status}`).join(' / ')}</p>
            <p className="text-xs text-pastel-pink-500 mt-1">{record.purpose==='additional'?'기존 학생 · 추가 과목 상담':record.intakeStage==='consultation'?'상담만 진행':record.sourceMode==='firestore'&&record.syncStatus==='synced'?'앱 등록 완료':registrationStatusLabels[record.syncStatus] || '상태 확인 필요'}</p>
            {record.studentSaved && record.syncStatus!=='synced' ? <p className="text-xs text-slate-500 mt-1">학생 저장 완료 · {record.enrollmentSaved?'앱 연결 대기':'수강 저장 대기'}</p> : null}
            <button type="button" className="small-button mt-2" disabled={busy} onClick={()=>void edit(record)}>등록 내용 열기</button>
            {record.purpose!=='additional'&&record.intakeStage!=='consultation'&&record.syncStatus!=='synced' ? <button type="button" className="small-button mt-2 ml-2" disabled={busy} onClick={()=>void sync(record)}>{record.syncStatus==='uncertain' || record.syncStatus==='syncing'?'반영 결과 확인':record.syncStatus==='failed'?coreMode?'앱 등록 재시도':'노션 반영 재시도':coreMode?'앱 등록 확정':'노션 반영'}</button> : null}
            {record.purpose==='additional'&&record.existingStudentKey ? <button type="button" className="small-button mt-2 ml-2" disabled={busy} onClick={()=>setEnrollmentKey(record.existingStudentKey!)}>기존 학생 수강 관리</button> : null}
            {(record.syncStatus==='synced'||record.purpose==='additional') ? <button type="button" className="small-button mt-2 ml-2" disabled={busy} onClick={()=>void convert(record)}>{record.purpose==='additional'?'수강 완료 · 목록에서 정리':'재원생으로 전환'}</button> : null}
            {record.purpose!=='additional'&&record.syncStatus==='synced'&&record.enrollments.some(e=>e.status==='등록'&&e.startDate?.slice(0,7)<new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()).slice(0,7)) ? <p className="text-xs text-slate-500 mt-2">등록 다음 달입니다. 재원생으로 전환해 주세요.</p> : null}
        </div>)}</div> : null}
        {!loading && !listError && !list.total ? <p className="text-xs text-slate-400 py-3">이 구분에 저장한 상담·신입생 내용이 없습니다.</p> : null}
        {list.pages>1 ? <div className="review-pagination"><button disabled={loading || list.page===1} onClick={()=>setPage(list.page-1)}>이전</button><span>{list.page} / {list.pages}</span><button disabled={loading || list.page===list.pages} onClick={()=>setPage(list.page+1)}>다음</button></div> : null}
        {feedback && !open ? <p role="status" className="text-xs text-slate-600 py-2">{feedback}</p> : null}
        </details>
        <WorkspaceDialog open={open} title={revision===undefined?'입학·상담 원서 작성':'입학·상담 원서 조회·수정'} onClose={close}>
            {feedback ? <p role="status" className="text-sm text-slate-600 mb-3">{feedback}</p> : null}
            {retrying ? <p className="text-xs text-rose-600 mb-3">저장 결과가 불명확합니다. 입력을 유지한 채 같은 요청으로 다시 확인합니다.</p> : null}
            {optionsError ? <p role="status" className="text-xs text-rose-600 mb-3">{optionsError} <button type="button" className="small-button" onClick={()=>setOptionsReload(n=>n+1)}>담당·반 다시 불러오기</button></p> : !options ? <p role="status" className="text-xs mb-3">담당 선생님·반을 불러오는 중…</p> : null}
            {options ? <button type="button" className="small-button mb-3" disabled={busy} onClick={()=>setOptionsReload(n=>n+1)}>담당·반 목록 새로고침</button> : null}
            <fieldset disabled={busy||locked} className="grid sm:grid-cols-2 gap-3 mb-4">
            <label>상담 유형<select value={value.purpose||'new'} onChange={e=>{setValue({...value,purpose:e.target.value as 'new'|'additional',existingStudentKey:null,intakeStage:'consultation'});setDirty(true);}}><option value="new">신규 학생 상담·등록</option><option value="additional">기존 학생 추가 과목 상담</option></select></label>
            {value.purpose==='additional' ? <label>기존 학생<select required value={value.existingStudentKey||''} onChange={e=>{const student=students.find(s=>s.studentKey===e.target.value);setValue({...value,existingStudentKey:e.target.value||null,name:student?.studentDisplayName||'',school:'',grade:''});setDirty(true);}}><option value="">학생 선택</option>{students.map(student=><option key={student.studentKey} value={student.studentKey}>{student.studentDisplayName}</option>)}</select></label> : <label>진행 상태<select value={value.intakeStage||'new'} onChange={e=>{setValue({...value,intakeStage:e.target.value as 'consultation'|'new'});setDirty(true);}}><option value="consultation">상담만 진행</option><option value="new">등록 첫 달 (신입생)</option></select></label>}
            </fieldset>
            {value.purpose==='additional' ? <p className="text-sm mb-3">기존 학생에 상담만 연결합니다. 학생·수강 행을 새로 만들지 않으며, 실제 수강 변경은 목록의 ‘기존 학생 수강 관리’에서 진행합니다.</p> : null}
            <StudentRegistrationForm options={options} value={value} disabled={locked} busy={busy} retrying={retrying} onChange={next=>{setValue(next);setDirty(true);}} onSubmit={()=>void save()}/>
        </WorkspaceDialog>
        {enrollmentKey&&<StudentEnrollmentEditor studentKey={enrollmentKey} onClose={()=>setEnrollmentKey('')} onSaved={()=>{setEnrollmentKey('');void onSynced().catch(()=>setFeedback('수강 변경은 완료됐지만 학생 목록을 다시 불러오지 못했습니다.'));setReload(n=>n+1);}}/>}
    </section>;
}

