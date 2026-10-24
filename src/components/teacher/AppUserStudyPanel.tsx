import {useEffect,useState} from 'react';
import {Info,Link2,PawPrint} from 'lucide-react';
import {PetCharacter} from '../pet/PetCharacters';
import {petStage,wornAccessories} from '../../lib/petCatalog';
import TeacherOnlineLearning from './TeacherOnlineLearning';
import StudentPartyCard from './StudentPartyCard';
import TeacherPetView from './TeacherPetView';
import TeacherQuestionAttempts from './TeacherQuestionAttempts';

const kstMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).format(new Date()).slice(0,7);
const md=(day:string)=>`${Number(day.slice(5,7))}/${Number(day.slice(8,10))}`;
const atDay=(ms:number|null)=>ms?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric'}).format(new Date(ms)):'';

/** 지문 분석 (the passages the student opened) and 워크북 (versions made of each passage), newest first. */
function Materials({uid,request}:{uid:string;request:(a:string,b?:any)=>Promise<any>}){
 const [m,setM]=useState<{passages:any[];workbooks:any[]}|null|undefined>(undefined);
 useEffect(()=>{let live=true;setM(undefined);request('read:app-user-materials',{uid}).then(r=>{if(live)setM({passages:r.passages||[],workbooks:r.workbooks||[]});}).catch(()=>{if(live)setM(null);});return()=>{live=false;};},[uid]); // eslint-disable-line react-hooks/exhaustive-deps
 if(m===undefined)return <section className="report-online-assignments"><h4>지문 분석 · 워크북</h4><p className="report-caption">불러오는 중…</p></section>;
 if(m===null)return <section className="report-online-assignments"><h4>지문 분석 · 워크북</h4><p className="report-caption">불러오지 못했어요.</p></section>;
 return <>
  <section className="report-online-assignments" aria-label="지문 분석"><h4>지문 분석 · {m.passages.length}개</h4>
   {m.passages.length?m.passages.map(p=><article key={p.id} className="report-assignment"><p>{atDay(p.openedAt)} <b>{p.title||'제목 없는 지문'}</b>{p.examInfo&&<span className="text-xs text-slate-400"> · {p.examInfo}</span>}</p>{p.first&&<p className="text-xs text-slate-500">{p.first}</p>}</article>):<p className="report-caption">분석한 지문이 없습니다.</p>}</section>
  <section className="report-online-assignments" aria-label="워크북"><h4>워크북 · {m.workbooks.length}개 지문</h4>
   {m.workbooks.length?m.workbooks.map(b=><article key={b.key} className="report-assignment"><p>{atDay(b.updatedAt)} <b>{b.title||'제목 없는 워크북'}</b> <span className="text-xs text-slate-500">· {b.versions.length}번 만듦</span></p><p className="text-xs text-slate-500">{b.versions.map((v:any)=>`${v.version}번째 ${atDay(v.at)} (${v.sentences}문장)`).join(' · ')}</p></article>):<p className="report-caption">만든 워크북이 없습니다.</p>}</section>
 </>;
}

/** 관리자 설정 › 앱 사용자 › 학습 기록: a student account not linked to the 학생 명부 yet — its online learning, 출석 체크,
 *  pet, party and 변형 문제 as a linked student's page shows them, and its 지문 분석 and 워크북, read only. 학생과 연결하기 goes to 학생 관리 (the usual linking). */
export default function AppUserStudyPanel({uid,name,request,onOpenStudents}:{uid:string;name:string;request:(a:string,b?:any)=>Promise<any>;onOpenStudents?:()=>void}){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[cursors,setCursors]=useState<string[]>([]),[loading,setLoading]=useState(false);
 const [attendance,setAttendance]=useState<string[]|null>(null),[pet,setPet]=useState<any>(undefined),[petOpen,setPetOpen]=useState(false);
 const load=async(cursor?:string)=>{setLoading(true);setError('');
  try{const r=await request('read:app-user-study',{uid,cursor});setData(r.online);if(r.attendance)setAttendance(r.attendance.days||[]);}
  catch(e:any){setError(e?.message||'학습 기록을 불러오지 못했어요.');}finally{setLoading(false);}};
 useEffect(()=>{setData(null);setCursors([]);setAttendance(null);setPet(undefined);void load();
  let live=true;request('read:app-user-pet',{uid}).then(r=>{if(live)setPet(r.pet||null);}).catch(()=>{if(live)setPet(null);});return()=>{live=false;};},[uid]); // eslint-disable-line react-hooks/exhaustive-deps
 const main=pet?(pet.pets.find((p:any)=>p.slot===pet.currentPetSlot)||pet.pets[0]):null,month=kstMonth();
 return <div className="border-t border-[#f3e6e8] bg-[#fffafb] px-3 py-3 text-sm">
  <p className="mb-2 flex items-center gap-1 text-xs text-slate-500"><Info size={13} aria-hidden="true"/>학생 명부와 연결되지 않은 계정이에요. 앱에서 한 공부만 보여요 (수업 리포트·성적 없음).</p>
  <div className="mb-2 grid gap-2 sm:grid-cols-2">
   <section aria-label="펫" className="flex items-center gap-3 rounded-xl border border-[#f3e6e8] bg-white px-3 py-2">
    {pet===undefined?<p role="status" className="text-xs text-slate-500">펫을 불러오는 중…</p>:!main?<p className="text-xs text-slate-500"><PawPrint size={13} className="mr-1 inline" aria-hidden="true"/>아직 펫을 키우지 않았어요.</p>:<>
     <span className="inline-flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-full bg-[#fdecef]"><PetCharacter character={main.character} stage={petStage(main.level)} clothing={main.clothing} accessory={wornAccessories(main)} gear={main.gear} portrait size={52}/></span>
     <span className="min-w-0 flex-1"><b className="block truncate text-[#5e1e2a]">{main.name} <span className="rounded-full bg-[#8b2f40] px-1.5 py-0.5 text-[10px] font-bold text-white">Lv.{main.level}</span></b><span className="text-xs text-slate-500">{pet.points.toLocaleString('ko-KR')}P{pet.pets.length>1?` · 펫 ${pet.pets.length}마리`:''}</span></span>
     <button type="button" className="small-button" onClick={()=>setPetOpen(true)}>펫 화면 보기</button></>}
   </section>
   <section aria-label="출석 체크" className="rounded-xl border border-[#f3e6e8] bg-white px-3 py-2">
    <p className="flex items-center justify-between"><b className="text-[#5e1e2a]">출석 체크</b>{attendance&&<span className="text-xs text-slate-500">모두 {attendance.length}일 · 이번 달 {attendance.filter(d=>d.startsWith(month)).length}일</span>}</p>
    {!attendance?<p role="status" className="text-xs text-slate-500">불러오는 중…</p>:attendance.length?<p className="mt-1 flex flex-wrap gap-1">{attendance.slice(0,14).map(d=><span key={d} className="rounded-full bg-[#fdf2f4] px-2 py-0.5 text-[11px] text-[#8b2f40]">{md(d)}</span>)}{attendance.length>14&&<span className="text-[11px] text-slate-400">…</span>}</p>:<p className="mt-1 text-xs text-slate-500">출석 체크한 날이 없어요.</p>}
   </section>
  </div>
  <StudentPartyCard uid={uid} request={request}/>
  <div className="mt-2">{error?<p role="alert" className="text-xs text-[#b04a5a]">{error}</p>:
   <TeacherOnlineLearning data={data} page={cursors.length} loading={loading} onPrevious={()=>{const prev=cursors.slice(0,-1);setCursors(prev);void load(prev.at(-1));}} onNext={()=>{if(!data?.nextCursor)return;const next=[...cursors,data.nextCursor];setCursors(next);void load(data.nextCursor);}}/>}</div>
  <TeacherQuestionAttempts uid={uid}/>
  <Materials uid={uid} request={request}/>
  <p className="mt-2 text-xs text-slate-500">원정대 단어 과제·장학 쿠폰·인증·학습 성취도 평가는 학생과 연결한 뒤에 생겨요.</p>
  {onOpenStudents&&<div className="mt-2 flex justify-end"><button type="button" className="small-button" onClick={onOpenStudents}><Link2 size={14} aria-hidden="true"/>학생과 연결하기</button></div>}
  {petOpen&&<TeacherPetView uid={uid} name={name} request={request} onClose={()=>setPetOpen(false)}/>}
 </div>;
}
