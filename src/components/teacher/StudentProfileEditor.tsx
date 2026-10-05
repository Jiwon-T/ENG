import {useEffect,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
import type {StudentProfileInput,StudentProfileRecord} from '../../lib/studentProfile';
import WorkspaceDialog from './WorkspaceDialog';
import StudentProfileForm from './StudentProfileForm';
interface Intent {operationId:string;expectedEditedAt:string;data:StudentProfileInput}
interface Result {ok:boolean;record?:StudentProfileRecord;profile?:StudentProfileInput;status?:string;message?:string;diagnosticId?:string}
function errorMessage(result:any){return `${result.data?.message || result.userMessage || '처리 결과를 확인하지 못했습니다.'}${result.data?.diagnosticId?` (오류 ID: ${result.data.diagnosticId})`:''}`;}
export default function StudentProfileEditor({studentKey,onClose,onSaved}:{studentKey:string;onClose:()=>void;onSaved:(value:StudentProfileInput)=>void}) {
    const [record,setRecord]=useState<StudentProfileRecord|null>(null),[value,setValue]=useState<StudentProfileInput|null>(null);
    const [intent,setIntent]=useState<Intent|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false);
    const version=useRef(0),writing=useRef(false);
    async function read(){
        const r=await teacherAuthenticatedRequest<Result>(auth,'/api/teacher/workspace?'+new URLSearchParams({action:'student-profile',studentKey}));
        if(!r.ok || !r.data?.ok || !r.data.record)throw Error(errorMessage(r));return r.data.record;
    }
    useEffect(()=>{
        const current=++version.current,uid=auth.currentUser?.uid;let live=true;
        const unsubscribe=onAuthStateChanged(auth,user=>{if(user?.uid!==uid){version.current++;setRecord(null);setValue(null);setIntent(null);}});
        read().then(saved=>{
            if(!live || current!==version.current || auth.currentUser?.uid!==uid)return;
            setRecord(saved);setValue(saved.pending?.data || saved.data);
            if(saved.pending)setIntent({operationId:saved.pending.operationId,expectedEditedAt:saved.pending.expectedEditedAt,data:saved.pending.data});
        }).catch(error=>{if(live && current===version.current)setMessage(error.message);}).finally(()=>{if(live && current===version.current)setLoading(false);});
        return()=>{live=false;version.current++;unsubscribe();};
    },[studentKey]);
    async function save(){
        if(writing.current || !record || !value)return;
        const current=version.current,uid=auth.currentUser?.uid;
        const request=intent || {operationId:crypto.randomUUID(),expectedEditedAt:record.editedAt,data:structuredClone(value)};
        writing.current=true;setBusy(true);setIntent(request);setMessage('');
        try {
            const r=await teacherAuthenticatedRequest<Result>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save-student-profile',studentKey,...request})});
            if(current!==version.current || auth.currentUser?.uid!==uid)return;
            if(!r.ok || !r.data?.ok) {
                setMessage(errorMessage(r));
                try {
                    const saved=await read();if(current!==version.current)return;
                    setRecord(saved);
                    if(saved.pending){setIntent({operationId:saved.pending.operationId,expectedEditedAt:saved.pending.expectedEditedAt,data:saved.pending.data});setValue(saved.pending.data);}
                    else if(r.status>=400 && r.status<500 && ![408,425,429].includes(r.status)){setIntent(null);setRecord(saved);}
                }catch{}
                return;
            }
            setDirty(false);setIntent(null);onSaved(r.data.profile || request.data);
        }catch(error){if(current===version.current)setMessage(error instanceof Error?error.message:'저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 확인해 주세요.');}
        finally{writing.current=false;if(current===version.current)setBusy(false);}
    }
    async function discard(){
        if(writing.current || !record?.pending?.canDiscard || !intent)return;
        if(!window.confirm('노션에 기록되지 않은 수정 요청을 취소하고 현재 학생 정보를 다시 불러올까요?'))return;
        writing.current=true;setBusy(true);const current=version.current,uid=auth.currentUser?.uid;
        try {
            const r=await teacherAuthenticatedRequest<Result>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'discard-student-profile',studentKey,operationId:intent.operationId})});
            if(current!==version.current || auth.currentUser?.uid!==uid)return;
            if(!r.ok || !r.data?.ok)throw Error(errorMessage(r));
            const saved=await read();if(current!==version.current)return;
            setRecord(saved);setValue(saved.data);setIntent(null);setDirty(false);setMessage('수정 요청을 취소했습니다. 현재 노션 정보를 불러왔습니다.');
        }catch(error){if(current===version.current)setMessage(error instanceof Error?error.message:'취소 결과를 확인하지 못했습니다.');}
        finally{writing.current=false;if(current===version.current)setBusy(false);}
    }
    function close(){
        if(dirty && !intent && !window.confirm('저장하지 않은 학생 정보 변경을 닫을까요?'))return;
        onClose();
    }
    return <WorkspaceDialog open title="학생 정보 수정" onClose={close}>
        {loading?<p role="status" className="text-sm">학생 정보를 불러오는 중…</p>:null}
        {message?<p role="status" className="text-sm text-rose-600 mb-3">{message}</p>:null}
        {intent?<p className="text-xs text-slate-500 mb-3">수정 요청의 입력을 보존하고 있습니다. 창을 닫아도 서버에 접수한 요청은 유지됩니다.</p>:null}
        {value?<StudentProfileForm value={value} busy={busy} disabled={Boolean(intent)} retrying={Boolean(intent)} onChange={next=>{setValue(next);setDirty(true);}} onSubmit={()=>void save()}/>:null}
        {record?.pending?.canDiscard?<button type="button" disabled={busy} className="small-button mt-3" onClick={()=>void discard()}>미반영 수정 요청 취소</button>:null}
    </WorkspaceDialog>;
}
