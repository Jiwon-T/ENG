import {useEffect,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {auth} from '../../lib/firebase';
import {teacherAuthenticatedRequest} from '../../lib/teacherAuthenticatedRequest';
type Audit={checkedAt:string;studentCount:number;complete:boolean;batiConfigured:boolean;sources:{source:string;ok:boolean}[];issues:{code:string;severity:string;studentKey:string|null;recordId:string|null;message:string}[]};
export default function TeacherIntegrityAudit(){
 const [result,setResult]=useState<Audit|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');const generation=useRef(0);
 useEffect(()=>{const unsubscribe=onAuthStateChanged(auth,()=>{generation.current++;setResult(null);setError('');setBusy(false);});return()=>{generation.current++;unsubscribe();};},[]);
 async function inspect(){const token=++generation.current,uid=auth.currentUser?.uid;setBusy(true);setResult(null);setError('');try{
 const r=await teacherAuthenticatedRequest<Audit & {ok:boolean;message?:string}>(auth,'/api/teacher/workspace?action=integrity-audit');
 if(token!==generation.current||auth.currentUser?.uid!==uid)return;
 if(!r.ok||!r.data?.ok||!Array.isArray(r.data.issues))throw Error(r.data?.message||r.userMessage||'점검 결과를 불러오지 못했습니다.');setResult(r.data);
 }catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'점검에 실패했습니다.');}finally{if(token===generation.current)setBusy(false);}}
 return <section className="panel"><h2>연결 정합성 점검</h2><p className="text-sm text-slate-600 mt-2">학생·수강·담당·반·리포트 연결과 미완료 작업을 읽어서 확인합니다. 점검으로 데이터가 수정되지는 않습니다.</p><button className="small-button mt-3" disabled={busy} onClick={()=>void inspect()}>{busy?'점검 중…':'현재 연결 점검'}</button>{error&&<p role="alert" className="mt-3 text-red-600">{error}</p>}{result&&<div className="mt-3"><p role="status">학생 {result.studentCount}명 · {result.complete?'원본 조회 완료':'일부 원본 조회 실패'} · 확인 항목 {result.issues.length}개</p><p className="text-xs text-slate-500">점검 시각: {new Date(result.checkedAt).toLocaleString('ko-KR')}</p><p className="text-sm mt-2">{result.sources.map(s=>`${s.source}: ${s.ok?'조회 완료':'조회 실패'}`).join(' / ')}</p><p className="text-sm mt-2">문자 서버 설정: {result.batiConfigured?'입력됨':'확인 필요'}. 실제 발송 접수 계약과 배포 후 동작 확인은 별도로 필요합니다.</p>{!result.issues.length&&result.complete&&<p className="mt-3">이번 점검 범위에서 문제를 발견하지 못했습니다.</p>}<ul className="mt-3 space-y-3">{result.issues.map((issue,i)=><li key={`${issue.code}:${i}`} className="border rounded-xl p-3"><p>{issue.severity==='error'?'연결 확인':'처리 확인'} · {issue.message}</p>{issue.studentKey&&<a className="text-xs underline" href={`https://www.notion.so/${issue.studentKey.replace(/-/g,'')}`} target="_blank" rel="noreferrer">노션 학생 열기</a>}{issue.recordId&&<p className="text-xs text-slate-500 break-all">작업 ID: {issue.recordId}</p>}</li>)}</ul></div>}</section>;
}
