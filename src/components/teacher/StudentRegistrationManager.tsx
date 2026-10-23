import StudentEnrollmentEditor from './StudentEnrollmentEditor';
import { useEffect, useRef, useState } from 'react';
import StatusBadge from './StatusBadge';
import { studentSearchResults } from '../../lib/koreanSearch';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { teacherAuthenticatedRequest } from '../../lib/teacherAuthenticatedRequest';
import { emptyRegistration, registrationStatusLabels, type RegistrationInput, type RegistrationRecord, type RegistrationSummary, type RegistrationOptions } from '../../lib/studentRegistration';
import { registrationSaveIntent, registrationFailureIsDefinitive, type RegistrationSaveIntent } from '../../lib/studentRegistrationSave';
import WorkspaceDialog from './WorkspaceDialog';
import StudentRegistrationForm from './StudentRegistrationForm';
import {askConfirm,askDiscard} from './ConfirmDialog';
import {useLeaveProtection} from '../../lib/leaveProtection';
import {INTAKE_PHOTO_RULES,shrinkFormPhoto} from '../../lib/intakePhotos';
import {PrintPortal} from '../print/PrintSheet';
import AdmissionFormSheet from '../print/AdmissionFormSheet';
import '../print/admissionForm.css';
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
/** 상담·신입생 inside the student list: rows appear when the 신입생·상담 chip is on, or when the shared search matches; the 원서 opens in a dialog. */
export default function StudentRegistrationManager({onSynced,students=[],coreMode=false,query='',active=false,startSignal=0,startName='',startId='',onSavedNew,onClosed,onCount,canAdditional=true}:{/** the 원서 closed (not when 닫기 was cancelled) */onClosed?:()=>void;onSynced:()=>Promise<void>;/** with startSignal: open this saved 원서 instead of a new one */startId?:string;/** a new 원서's first save (상담 일정 ties it) */onSavedNew?:(id:string)=>void;/** 기존 학생 추가 과목 상담 (it changes a registered student's enrollment): 원장님·관리자 only */canAdditional?:boolean;coreMode?:boolean;students?:any[];query?:string;active?:boolean;startSignal?:number;/** The name to start the form with (시간표 엑셀 가져오기 › 새 학생 등록). */startName?:string;onCount?:(count:number)=>void}) {
    const [intake,setIntake]=useState('all'),[enrollmentKey,setEnrollmentKey]=useState('');
    const [page,setPage]=useState(1),[reload,setReload]=useState(0);
    const [list,setList]=useState<PageResult>({ok:true,records:[],page:1,pages:1,total:0});
    const [loading,setLoading]=useState(true),[listError,setListError]=useState('');
    const [open,setOpen]=useState(false),[value,setValue]=useState<RegistrationInput>(emptyRegistration);
    const [key,setKey]=useState(''),[revision,setRevision]=useState<number | undefined>();
    const [busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[feedback,setFeedback]=useState('');
    useLeaveProtection(dirty);
    const [options,setOptions]=useState<RegistrationOptions | undefined>(),[optionsError,setOptionsError]=useState(''),[optionsReload,setOptionsReload]=useState(0);
    const [locked,setLocked]=useState(false),[retrying,setRetrying]=useState(false);
    const intent=useRef<RegistrationSaveIntent | null>(null),writeBusy=useRef(false),generation=useRef(0);
    const [current,setCurrent]=useState<RegistrationSummary | null>(null);
    // 입학원서 인쇄 (PDF로 저장): this 원서 as it is on screen, or a blank one to write by hand
    const [printing,setPrinting]=useState<RegistrationInput | 'blank' | null>(null);
    // 같은 학생 원서 (another teacher talked to this student too): shown while the 원서 is written; 같이 쓰기 opens that one
    const [matches,setMatches]=useState<{id:string;title:string;writer:string;updatedAt:number;by:'phone'|'school';mine:boolean}[]>([]),[notSame,setNotSame]=useState<string[]>([]);
    useEffect(()=>{
        setMatches([]);if(!open||value.purpose==='additional'||value.name.trim().length<2)return;let live=true;
        const timer=setTimeout(()=>{request<{ok:boolean;matches:typeof matches}>('student-registration-matches',{name:value.name,studentPhone:value.studentPhone||'',guardianPhone:value.guardianPhone||'',school:value.school||'',grade:value.grade||'',...(current?{exceptId:current.id}:{})})
            .then(result=>{if(live&&result.ok&&result.data?.ok)setMatches(result.data.matches||[]);}).catch(()=>{});},400);
        return()=>{live=false;clearTimeout(timer);};
    },[open,value.name,value.studentPhone,value.guardianPhone,value.school,value.grade,value.purpose,current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // 종이 원서 사진 (a saved 원서): the list, then one photo opened at a time
    const [photos,setPhotos]=useState<{id:string;at:number}[]>([]),[viewing,setViewing]=useState(''),[photoBusy,setPhotoBusy]=useState(false),photoInput=useRef<HTMLInputElement>(null);
    const loadPhotos=async(id:string)=>{const result=await request<{ok:boolean;photos:{id:string;at:number}[]}>('intake-photos',{id});if(result.ok&&result.data?.ok)setPhotos(result.data.photos||[]);};
    useEffect(()=>{setPhotos([]);setViewing('');if(open&&current?.id)void loadPhotos(current.id).catch(()=>{});},[open,current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    const post=(body:Record<string,unknown>)=>teacherAuthenticatedRequest<ServerResult>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    async function addPhoto(file?:File){
        if(!file||!current)return;setPhotoBusy(true);setFeedback('');
        try{const photo=await shrinkFormPhoto(file),result=await post({action:'add-intake-photo',id:current.id,photo});if(!result.ok||!result.data?.ok)throw Error(responseMessage(result));await loadPhotos(current.id);}
        catch(e:any){setFeedback(e?.message||'사진을 붙이지 못했어요.');}finally{setPhotoBusy(false);if(photoInput.current)photoInput.current.value='';}
    }
    async function openPhoto(id:string){setPhotoBusy(true);try{const result=await request<{ok:boolean;photo:string;message?:string;diagnosticId?:string}>('intake-photo',{photoId:id});if(!result.ok||!result.data?.ok)throw Error(responseMessage(result));setViewing(result.data.photo);}catch(e:any){setFeedback(e?.message||'사진을 열지 못했어요.');}finally{setPhotoBusy(false);}}
    async function removePhoto(id:string){if(!current||!await askConfirm({title:'이 사진을 뺄까요?',message:'원서 내용은 그대로예요.',confirmText:'빼기',tone:'danger',icon:'trash'}))return;setPhotoBusy(true);try{const result=await post({action:'remove-intake-photo',photoId:id});if(!result.ok||!result.data?.ok)throw Error(responseMessage(result));await loadPhotos(current.id);}catch(e:any){setFeedback(e?.message||'사진을 빼지 못했어요.');}finally{setPhotoBusy(false);}}
    // 상담 일정 (a saved 원서): the one it is tied to, or 상담 일정으로 남기기 (today, from now) when written without one
    const [consultSchedule,setConsultSchedule]=useState<{id:string;title:string;date:string;start:string;end:string}|null|undefined>(undefined),[scheduling,setScheduling]=useState(false);
    useEffect(()=>{setConsultSchedule(undefined);if(!open||!current?.id||current.purpose==='additional')return;let live=true;
        request<{ok:boolean;schedule:any}>('registration-consult-schedule',{id:current.id}).then(result=>{if(live&&result.ok&&result.data?.ok)setConsultSchedule(result.data.schedule||null);}).catch(()=>{});
        return()=>{live=false;};},[open,current?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    async function keepAsSchedule(){
        if(!current||scheduling)return;setScheduling(true);setFeedback('');
        try{const result=await teacherAuthenticatedRequest<ServerResult & {schedule?:any;created?:boolean}>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'consult-schedule-from-registration',id:current.id})});
            if(!result.ok||!result.data?.ok)throw Error(responseMessage(result));setConsultSchedule(result.data.schedule||null);setFeedback(result.data.created?'오늘 상담 일정을 만들고 이 원서와 묶었어요. 시간표·일정에서 시간을 고칠 수 있어요.':'이미 묶인 상담 일정이 있어요.');}
        catch(e:any){setFeedback(e?.message||'상담 일정을 만들지 못했어요.');}finally{setScheduling(false);}
    }
    async function joinMatch(id:string){
        if(writeBusy.current)return;
        if(dirty&&!await askDiscard(revision===undefined?'지금 쓴 내용은 저장되지 않아요. 같은 학생 원서를 열까요?':'저장하지 않은 수정이 있어요. 같은 학생 원서를 열까요?'))return;
        const result=await teacherAuthenticatedRequest<ServerResult & {record?:RegistrationSummary}>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'join-student-registration',id})});
        if(!result.ok||!result.data?.ok||!result.data.record){setFeedback(responseMessage(result));return;}
        setDirty(false);setReload(n=>n+1);await edit(result.data.record as RegistrationSummary);
    }
    useEffect(()=>{if(!startSignal)return;if(startId)void openById(startId);else start(startName);},[startSignal]); // eslint-disable-line react-hooks/exhaustive-deps
    async function openById(id:string){const result=await request<ServerResult & {record?:RegistrationSummary}>('student-registration',{id});if(result.ok&&result.data?.ok&&result.data.record){setOpen(true);await edit(result.data.record as RegistrationSummary);}else setFeedback(responseMessage(result));}
    useEffect(()=>{onCount?.(list.counts?.all??list.total??0);},[list]);
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
    function start(name='') {
        generation.current++;intent.current=null;setCurrent(null);setKey(crypto.randomUUID());setRevision(undefined);setValue({...emptyRegistration(),intakeStage:'consultation',name:name.trim()});
        setFeedback('');setDirty(false);setLocked(false);setRetrying(false);setOpen(true);
    }
    async function edit(record:RegistrationSummary) {
        if(writeBusy.current)return;
        const current=++generation.current;setBusy(true);setFeedback('');setCurrent(record);
        try {
            const result=await request<ServerResult>('student-registration',{id:record.id});
            if(current!==generation.current)return;
            if(!result.ok || !result.data?.ok || !result.data.record)throw new Error(responseMessage(result));
            const saved=result.data.record;
            intent.current=null;setKey(saved.requestId);setRevision(saved.revision);setValue(saved.data);setDirty(false);setRetrying(false);
            setLocked(saved.canEdit===false || ['syncing','uncertain','synced'].includes(saved.syncStatus));setOpen(true);
            if(saved.syncStatus==='synced')setFeedback('등록한 학생 정보는 학생 목록의 ‘정보 수정’에서 변경할 수 있습니다.');
            if(saved.canEdit===false && saved.syncStatus!=='synced')setFeedback('등록 결과를 확인한 뒤 수정할 수 있습니다.');
        } catch(error) { if(current===generation.current)setFeedback(error instanceof Error?error.message:'등록 내용을 불러오지 못했습니다.'); }
        finally { if(current===generation.current)setBusy(false); }
    }
    async function close() {
        if(writeBusy.current)return;
        if((dirty || intent.current) && !await (intent.current?askConfirm({title:'저장 결과를 확인하지 못했어요',message:'창을 닫은 뒤 목록을 새로고침해 저장 여부를 확인해 주세요.',confirmText:'닫기',icon:'alert'}):askDiscard('저장하지 않은 입력을 닫을까요?')))return;
        generation.current++;intent.current=null;setCurrent(null);setOptions(undefined);setOpen(false);setValue(emptyRegistration());setKey('');setRevision(undefined);setRetrying(false);setFeedback('');setBusy(false);onClosed?.();
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
            if(revision===undefined)onSavedNew?.(result.data.id);
            intent.current=null;setRevision(result.data.revision);setDirty(false);setLocked(false);setRetrying(false);
            setFeedback(value.purpose==='additional'?'추가 과목 상담을 저장했습니다. 목록에서 기존 학생의 수강 관리로 이어갈 수 있습니다.':value.intakeStage==='consultation'?'상담 내용을 저장했습니다. 아직 학생 명부에는 등록하지 않았습니다.':coreMode?'등록 내용을 저장했습니다. 앱 등록 확정 후 등록 첫 달 목록에서 관리합니다.':'등록 내용을 저장했습니다. 등록 확정 후 등록 첫 달 목록에서 관리합니다.');setReload(old=>old+1);
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
        // 등록 확정 전: a student already on the list that looks like this one (another teacher may have registered them)
        if(record.purpose!=='additional'&&['pending','failed'].includes(record.syncStatus)){
            const found=await request<{ok:boolean;matches:{title:string;status:string;subjects:string[];by:'phone'|'school'}[]}>('student-registration-registered-matches',{id:record.id}).catch(()=>null);
            const list=found?.ok&&found.data?.ok?found.data.matches||[]:[];
            if(list.length&&!await askConfirm({title:'이미 학생 목록에 같은 학생이 있어요',message:`${list.map(m=>`${m.title}${m.status?` · ${m.status}`:''}${m.subjects.length?` ${m.subjects.join('·')}`:''} (${m.by==='phone'?'연락처가 같아요':'이름·학교·학년이 같아요'})`).join(', ')}. 같은 학생이면 새로 등록하지 말고, 과목 추가는 원장님·관리자께 요청해 주세요.`,confirmText:'그래도 새로 등록',tone:'danger',icon:'alert'}))return;
            if(writeBusy.current)return;
        }
        writeBusy.current=true;setBusy(true);setFeedback('');
        const current=generation.current,uid=auth.currentUser?.uid;
        try {
            const result=await teacherAuthenticatedRequest<ServerResult>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sync-student-registration',id:record.id,revision:record.revision})});
            if(current!==generation.current || auth.currentUser?.uid!==uid)return;
            if(!result.ok || !result.data?.ok)throw new Error(responseMessage(result));
            setFeedback(result.data.sourceMode==='firestore'?'학생·수강·담당·반 연결을 앱에 저장했습니다.':'학생·수강 정보를 등록하고 학생 목록에 연결했습니다.');
            try { await onSynced(); } catch { setFeedback('등록은 완료됐지만 학생 명부를 다시 불러오지 못했습니다. 새로고침해 주세요.'); }
        } catch(error) { if(current===generation.current)setFeedback(error instanceof Error?error.message:'반영 결과를 확인하지 못했습니다.'); }
        finally {
            writeBusy.current=false;
            if(current===generation.current){setBusy(false);setReload(old=>old+1);}
        }
    }
    // 시범 수업: put a 상담 student on the roster as '시범' (lessons and 일정 can name them; 일지 stay out of 수강료 and 문자),
    // or end it without 등록. 등록 later is the usual 등록 확정 and continues the same student.
    async function trial(record:RegistrationSummary,end:boolean){
        if(writeBusy.current)return;
        if(!await askConfirm(end?{title:'시범 수업을 끝낼까요?',message:'학생 명부와 담당 선생님 목록에서 빠져요. 나중에 등록하면 같은 학생으로 이어지고, 시범 수업 일지도 그대로 남아요.',confirmText:'시범 끝',icon:'check'}
            :{title:'시범 수업 학생으로 올릴까요?',message:'원서에 적은 과목과 담당 선생님으로 학생 명부에 \'시범\'으로 올라가요. 수업 일지와 일정에서 고를 수 있고, 시범 수업 일지는 수강료와 학부모 문자에서 빠져요.',confirmText:'올리기',icon:'check'}))return;
        writeBusy.current=true;setBusy(true);setFeedback('');const current=generation.current,uid=auth.currentUser?.uid;
        try{
            const result=await teacherAuthenticatedRequest<ServerResult>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:end?'end-trial-registration':'trial-student-registration',id:record.id,revision:record.revision})});
            if(current!==generation.current||auth.currentUser?.uid!==uid)return;
            if(!result.ok||!result.data?.ok)throw Error(responseMessage(result));
            setFeedback(end?'시범 수업을 끝냈어요. 등록하면 같은 학생으로 이어져요.':'시범 수업 학생으로 올렸어요. 수업 일지와 일정에서 \'시범\'으로 고를 수 있어요.');
            try{await onSynced();}catch{setFeedback('저장은 됐지만 학생 명부를 다시 불러오지 못했어요. 새로고침해 주세요.');}
        }catch(error){if(current===generation.current)setFeedback(error instanceof Error?error.message:'잠시 후 다시 해 주세요.');}
        finally{writeBusy.current=false;if(current===generation.current){setBusy(false);setReload(old=>old+1);}}
    }
    async function convert(record:RegistrationSummary){
        if(writeBusy.current)return;
        if(!await askConfirm(record.purpose==='additional'?{title:'상담 목록에서 정리할까요?',message:'선택한 상담 과목의 실제 등록을 확인한 뒤 정리해 주세요.',confirmText:'정리',icon:'check'}:{title:'재원생으로 전환할까요?',message:'이 목록에서 빠지고 아래 학생 관리 카드에서 계속 관리합니다. 기존 기록과 리포트 주소는 유지됩니다.',confirmText:'전환',icon:'check'}))return;
        writeBusy.current=true;setBusy(true);setFeedback('');const current=generation.current,uid=auth.currentUser?.uid;
        try{const result=await teacherAuthenticatedRequest<ServerResult>(auth,'/api/teacher/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'convert-registration-resident',id:record.id,revision:record.revision})});if(current!==generation.current||auth.currentUser?.uid!==uid)return;if(!result.ok||!result.data?.ok)throw Error(responseMessage(result));setReload(n=>n+1);setFeedback('목록에서 정리했습니다. 아래 학생 관리 카드에서 계속 관리할 수 있습니다.');await onSynced();}catch(error){if(current===generation.current)setFeedback(error instanceof Error?error.message:'전환 결과를 확인하지 못했습니다.');}finally{writeBusy.current=false;if(current===generation.current)setBusy(false);}
    }
    const stageText=(record:RegistrationSummary)=>record.purpose==='additional'?'추가 과목 상담':record.intakeStage==='consultation'?(record.trialStudentKey?(record.trialEndedAt?'시범 끝':'시범 수업 중'):'상담만 진행'):record.syncStatus==='synced'?'등록 첫 달':registrationStatusLabels[record.syncStatus]||'등록 확인 필요';
    const actions=(record:RegistrationSummary)=><>
        {record.purpose!=='additional'&&record.intakeStage!=='consultation'&&record.syncStatus!=='synced' ? <button type="button" className="primary-button" disabled={busy} onClick={()=>void sync(record)}>{record.syncStatus==='uncertain' || record.syncStatus==='syncing'?'반영 결과 확인':record.syncStatus==='failed'?coreMode?'앱 등록 재시도':'등록 재시도':coreMode?'앱 등록 확정':'등록 확정'}</button> : null}
        {record.purpose!=='additional'&&record.intakeStage==='consultation'&&!record.trialStudentKey ? <button type="button" className="small-button" disabled={busy} onClick={()=>void trial(record,false)}>시범 수업 학생으로 올리기</button> : null}
        {record.purpose!=='additional'&&record.intakeStage==='consultation'&&record.trialStudentKey&&!record.trialEndedAt ? <button type="button" className="small-button" disabled={busy} onClick={()=>void trial(record,true)}>시범 끝 (등록 안 함)</button> : null}
        {record.purpose==='additional'&&record.existingStudentKey ? <button type="button" className="small-button" disabled={busy} onClick={()=>setEnrollmentKey(record.existingStudentKey!)}>기존 학생 수강 관리</button> : null}
        {(record.syncStatus==='synced'||record.purpose==='additional') ? <button type="button" className="small-button" disabled={busy} onClick={()=>void convert(record)}>{record.purpose==='additional'?'수강 완료 · 목록에서 정리':'재원생으로 전환'}</button> : null}
    </>;
    const matched=query.trim()?studentSearchResults(list.records.map(r=>({...r,studentKey:r.id,studentDisplayName:r.title})),query):list.records;
    const showList=active||Boolean(query.trim()&&matched.length);
    return <section className="student-registration-manager" aria-label="상담·신입생">
        {showList&&<div className="student-intake-list">
            {!active&&<p className="student-intake-heading">상담·신입생</p>}
            {active&&<div role="group" aria-label="상담·등록 구분" className="student-intake-filters">{[["all","전체"],["consultation","상담만"],["new","등록 첫 달"],["additional","추가 과목"]].map(([id,label])=><button key={id} type="button" aria-pressed={intake===id} onClick={()=>{setIntake(id);setPage(1);}}>{label} {list.counts?.[id]??""}</button>)}</div>}
            {loading ? <p role="status" className="report-caption">불러오는 중…</p> : null}
            {listError ? <div role="alert" className="report-caption">{listError}<button type="button" className="small-button ml-2" onClick={()=>setReload(old=>old+1)}>다시 불러오기</button></div> : null}
            {!listError&&matched.map(record=>{const parts=record.title.match(/^(.*?)\s*\((.*)\)$/);const old=record.purpose!=='additional'&&record.syncStatus==='synced'&&record.enrollments.some(e=>e.status==='등록'&&e.startDate?.slice(0,7)<new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()).slice(0,7));
                return <button key={record.id} type="button" className="student-master-row student-intake-row" disabled={busy} onClick={()=>void edit(record)}><strong>{parts?.[1]||record.title}</strong>{parts&&<small>{parts[2]}</small>}<small>{record.enrollments.map(row=>`${row.subject} ${row.status}`).join(' · ')||'과목 미정'}</small><div><StatusBadge kind={record.intakeStage==='consultation'||record.purpose==='additional'?'editing':record.syncStatus==='synced'?'done':record.syncStatus==='failed'?'failed':'saved'} text={stageText(record)}/>{old&&<StatusBadge kind="saved" text="재원생 전환 필요"/>}</div></button>;})}
            {active&&<div className="intake-print-row"><button type="button" className="small-button" onClick={()=>setPrinting('blank')}>빈 원서 인쇄</button></div>}
            {active&&!loading&&!listError&&!list.total ? <p className="report-caption">이 구분에 저장한 상담·신입생이 없습니다.</p> : null}
            {active&&list.pages>1 ? <div className="review-pagination"><button disabled={loading || list.page===1} onClick={()=>setPage(list.page-1)}>이전</button><span>{list.page} / {list.pages}</span><button disabled={loading || list.page===list.pages} onClick={()=>setPage(list.page+1)}>다음</button></div> : null}
        </div>}
        {feedback && !open ? <p role="status" className="report-caption">{feedback}</p> : null}
        <WorkspaceDialog open={open} title={revision===undefined?'입학·상담 원서 작성':'입학·상담 원서 조회·수정'} onClose={close}>
            <div className="intake-print-row">{current&&revision!==undefined&&value.purpose!=='additional'&&consultSchedule!==undefined&&(consultSchedule?<span className="intake-consult-schedule" title="이 원서와 묶인 상담 일정">상담 일정 · {Number(consultSchedule.date?.slice(5,7))}/{Number(consultSchedule.date?.slice(8,10))} {consultSchedule.start}–{consultSchedule.end}</span>:<button type="button" className="small-button" disabled={scheduling||busy} onClick={()=>void keepAsSchedule()} title="오늘 날짜·지금 시간으로 상담 일정을 만들고 이 원서와 묶어요">{scheduling?'만드는 중…':'상담 일정으로 남기기'}</button>)}<button type="button" className="small-button" onClick={()=>setPrinting(value)} title="인쇄 창에서 'PDF로 저장'을 고르면 파일이 돼요">원서 PDF·인쇄</button></div>
            {current&&revision!==undefined ? <div className="student-intake-actions"><span className="student-intake-status">{stageText(current)}</span>{actions(current)}</div> : null}
            {feedback ? <p role="status" className="text-sm text-slate-600 mb-3">{feedback}</p> : null}
            {retrying ? <p className="text-xs text-rose-600 mb-3">저장 결과가 불명확합니다. 입력을 유지한 채 같은 요청으로 다시 확인합니다.</p> : null}
            {optionsError ? <p role="status" className="text-xs text-rose-600 mb-3">{optionsError} <button type="button" className="small-button" onClick={()=>setOptionsReload(n=>n+1)}>담당·반 다시 불러오기</button></p> : !options ? <p role="status" className="text-xs mb-3">담당 선생님·반을 불러오는 중…</p> : null}
            {options ? <button type="button" className="small-button mb-3" disabled={busy} onClick={()=>setOptionsReload(n=>n+1)}>담당·반 목록 새로고침</button> : null}
            <fieldset disabled={busy||locked} className="grid sm:grid-cols-2 gap-3 mb-4">
            <label>상담 유형<select value={value.purpose||'new'} onChange={e=>{setValue({...value,purpose:e.target.value as 'new'|'additional',existingStudentKey:null,intakeStage:'consultation'});setDirty(true);}}><option value="new">신규 학생 상담·등록</option>{canAdditional&&<option value="additional">기존 학생 추가 과목 상담</option>}</select></label>
            {value.purpose==='additional' ? <label>기존 학생<select required value={value.existingStudentKey||''} onChange={e=>{const student=students.find(s=>s.studentKey===e.target.value);setValue({...value,existingStudentKey:e.target.value||null,name:student?.studentDisplayName||'',school:'',grade:''});setDirty(true);}}><option value="">학생 선택</option>{students.map(student=><option key={student.studentKey} value={student.studentKey}>{student.studentDisplayName}</option>)}</select></label> : <label>진행 상태<select value={value.intakeStage||'new'} onChange={e=>{setValue({...value,intakeStage:e.target.value as 'consultation'|'new'});setDirty(true);}}><option value="consultation">상담만 진행</option><option value="new">등록 첫 달 (신입생)</option></select></label>}
            </fieldset>
            {value.purpose==='additional' ? <p className="text-sm mb-3">기존 학생에 상담만 연결합니다. 학생·수강 행을 새로 만들지 않으며, 실제 수강 변경은 목록의 ‘기존 학생 수강 관리’에서 진행합니다.</p> : null}
            {matches.filter(m=>!notSame.includes(m.id)).map(m=><div key={m.id} role="status" className="intake-match"><b>같은 학생 원서가 이미 있어요</b><span>{m.title} · {m.writer} 작성 · {new Date(m.updatedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'})} 수정 · {m.by==='phone'?'연락처가 같아요':'학교·학년이 같아요'}</span><span className="intake-match-actions"><button type="button" className="small-button" disabled={busy} onClick={()=>void joinMatch(m.id)}>{m.mine?'그 원서 열기':'이 원서로 같이 쓰기'}</button><button type="button" className="small-button" onClick={()=>setNotSame(list=>[...list,m.id])}>다른 학생이에요</button></span></div>)}
            {current&&revision!==undefined?<div className="intake-photos"><span className="intake-photos-title">종이 원서 사진 {photos.length}장</span>{photos.map((ph,i)=><span key={ph.id} className="intake-photo"><button type="button" disabled={photoBusy} onClick={()=>void openPhoto(ph.id)}>사진 {i+1}</button><button type="button" className="intake-photo-remove" aria-label={`사진 ${i+1} 빼기`} disabled={photoBusy} onClick={()=>void removePhoto(ph.id)}>×</button></span>)}{photos.length<INTAKE_PHOTO_RULES.maxPhotos&&<button type="button" className="small-button" disabled={photoBusy||busy} onClick={()=>photoInput.current?.click()}>{photoBusy?'처리 중…':'+ 사진 추가'}</button>}<input ref={photoInput} type="file" accept="image/*" hidden aria-label="종이 원서 사진" onChange={e=>void addPhoto(e.target.files?.[0])}/></div>:<p className="intake-photos-note">원서를 저장하면 종이 원서 사진을 붙일 수 있어요.</p>}{viewing&&<div className="intake-photo-view" role="dialog" aria-label="종이 원서 사진" onClick={()=>setViewing('')}><img src={viewing} alt="종이 원서"/><span>누르면 닫혀요</span></div>}
            <StudentRegistrationForm options={options} value={value} disabled={locked} busy={busy} retrying={retrying} onChange={next=>{setValue(next);setDirty(true);}} onSubmit={()=>void save()}/>
        </WorkspaceDialog>
        {printing&&<PrintPortal active orientation="portrait" onDone={()=>setPrinting(null)}><AdmissionFormSheet value={printing==='blank'?null:printing}/></PrintPortal>}
        {enrollmentKey&&<StudentEnrollmentEditor studentKey={enrollmentKey} onClose={()=>setEnrollmentKey('')} onSaved={()=>{setEnrollmentKey('');void onSynced().catch(()=>setFeedback('수강 변경은 완료됐지만 학생 목록을 다시 불러오지 못했습니다.'));setReload(n=>n+1);}}/>}
    </section>;
}

