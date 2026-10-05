import { useEffect, useRef, useState } from 'react';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { emptyRegistration, registrationStatusLabels, type RegistrationInput, type RegistrationRecord, type RegistrationSummary, type RegistrationOptions } from '../../lib/studentRegistration';
import { registrationSaveIntent, registrationFailureIsDefinitive, type RegistrationSaveIntent } from '../../lib/studentRegistrationSave';
import WorkspaceDialog from './WorkspaceDialog';
import StudentRegistrationForm from './StudentRegistrationForm';
interface PageResult extends ServerResult {ok:boolean;records:RegistrationSummary[];page:number;pages:number;total:number}
interface ServerResult {ok:boolean;error?:string;message?:string;diagnosticId?:string;id?:string;revision?:number;syncStatus?:string;record?:RegistrationRecord}
async function request<T>(action:string, values:Record<string,unknown>={}) {
    const params=new URLSearchParams({action});
    for(const [key,value] of Object.entries(values))params.set(key,String(value));
    return teacherAuthenticatedRequest<T>(auth,'/api/teacher/workspace?'+params.toString());
}
function responseMessage(result:{userMessage?:string;data?:{message?:string;diagnosticId?:string}}) {
    return `${result.data?.message || result.userMessage || '처리하지 못했습니다. 다시 시도해 주세요.'}${result.data?.diagnosticId ? ` (오류 ID: ${result.data.diagnosticId})` : ''}`;
}
export default function StudentRegistrationManager({onSynced}:{onSynced:()=>Promise<void>}) {
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
        request<PageResult>('student-registrations',{page}).then(result=>{
            if(!live || auth.currentUser?.uid!==uid)return;
            if(!result.ok || !result.data?.ok || !Array.isArray(result.data.records))throw new Error(responseMessage(result));
            setList(result.data);
        }).catch(error=>{if(live)setListError(error.message);}).finally(()=>{if(live)setLoading(false);});
        return()=>{live=false;};
    },[page,reload]);
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
        generation.current++;intent.current=null;setKey(crypto.randomUUID());setRevision(undefined);setValue(emptyRegistration());
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
            setFeedback('등록 내용을 저장했습니다. 창을 닫고 ‘노션 반영’을 누르면 학생 명부에 추가됩니다.');setReload(old=>old+1);
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
            setFeedback('학생·수강 정보를 노션에 반영하고 학생 명부에 연결했습니다.');
            try { await onSynced(); } catch { setFeedback('노션 반영은 완료됐지만 학생 명부를 다시 불러오지 못했습니다. 새로고침해 주세요.'); }
        } catch(error) { if(current===generation.current)setFeedback(error instanceof Error?error.message:'반영 결과를 확인하지 못했습니다.'); }
        finally {
            writeBusy.current=false;
            if(current===generation.current){setBusy(false);setReload(old=>old+1);}
        }
    }
    return <section className="student-registration-manager mb-5" aria-label="신입생 등록 준비">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-600">신입생 등록 준비</h3><button type="button" className="small-button" disabled={busy} onClick={start}>+ 신입생 등록</button></div>
        <p className="text-xs text-slate-500 my-2">등록 내용을 저장한 뒤 노션에 반영하면 학생·수강 정보와 앱 명부가 연결됩니다.</p>
        {loading ? <p role="status" className="text-xs text-slate-500 py-2">불러오는 중…</p> : null}
        {listError ? <div role="alert" className="text-xs text-rose-600 py-2">{listError}<button type="button" className="small-button ml-2" onClick={()=>setReload(old=>old+1)}>다시 불러오기</button></div> : null}
        {!listError ? <div className="student-management-cards">{list.records.map(record=><div key={record.id} className="p-3 rounded-xl border border-pastel-pink-100 bg-pastel-pink-50/30">
            <p className="font-bold text-sm">{record.title}</p><p className="text-xs text-slate-500 mt-1">{record.enrollments.map(row=>`${row.subject} · ${row.status}`).join(' / ')}</p>
            <p className="text-xs text-pastel-pink-500 mt-1">{registrationStatusLabels[record.syncStatus] || '상태 확인 필요'}</p>
            {record.studentSaved && record.syncStatus!=='synced' ? <p className="text-xs text-slate-500 mt-1">학생 저장 완료 · {record.enrollmentSaved?'앱 연결 대기':'수강 저장 대기'}</p> : null}
            <button type="button" className="small-button mt-2" disabled={busy} onClick={()=>void edit(record)}>등록 내용 열기</button>
            {record.syncStatus!=='synced' ? <button type="button" className="small-button mt-2 ml-2" disabled={busy} onClick={()=>void sync(record)}>{record.syncStatus==='uncertain' || record.syncStatus==='syncing'?'반영 결과 확인':record.syncStatus==='failed'?'노션 반영 재시도':'노션 반영'}</button> : null}
        </div>)}</div> : null}
        {!loading && !listError && !list.total ? <p className="text-xs text-slate-400 py-3">저장한 신입생 등록 내용이 없습니다.</p> : null}
        {list.pages>1 ? <div className="review-pagination"><button disabled={loading || list.page===1} onClick={()=>setPage(list.page-1)}>이전</button><span>{list.page} / {list.pages}</span><button disabled={loading || list.page===list.pages} onClick={()=>setPage(list.page+1)}>다음</button></div> : null}
        {feedback && !open ? <p role="status" className="text-xs text-slate-600 py-2">{feedback}</p> : null}
        <WorkspaceDialog open={open} title={revision===undefined?'입학·상담 원서 작성':'입학·상담 원서 조회·수정'} onClose={close}>
            {feedback ? <p role="status" className="text-sm text-slate-600 mb-3">{feedback}</p> : null}
            {retrying ? <p className="text-xs text-rose-600 mb-3">저장 결과가 불명확합니다. 입력을 유지한 채 같은 요청으로 다시 확인합니다.</p> : null}
            {optionsError ? <p role="status" className="text-xs text-rose-600 mb-3">{optionsError} <button type="button" className="small-button" onClick={()=>setOptionsReload(n=>n+1)}>담당·반 다시 불러오기</button></p> : !options ? <p role="status" className="text-xs mb-3">담당 선생님·반을 불러오는 중…</p> : null}
            {options ? <button type="button" className="small-button mb-3" disabled={busy} onClick={()=>setOptionsReload(n=>n+1)}>담당·반 목록 새로고침</button> : null}
            <StudentRegistrationForm options={options} value={value} disabled={locked} busy={busy} retrying={retrying} onChange={next=>{setValue(next);setDirty(true);}} onSubmit={()=>void save()}/>
        </WorkspaceDialog>
    </section>;
}
