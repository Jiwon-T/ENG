import {useState} from 'react';
import {ArrowRight,Search} from 'lucide-react';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
import {askConfirm} from './ConfirmDialog';
import WorkspaceDialog from './WorkspaceDialog';

const day=(at?:string|null)=>at?new Date(at).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric'}):'';
const counts=(x:any)=>[`학습 기록 ${x.sessions}개`,x.words?`단어 ${x.words}개`:'',x.points==null?'펫 없음':`${x.points.toLocaleString('ko-KR')}P`].filter(Boolean).join(' · ');
const won=(n:number)=>n.toLocaleString('ko-KR');

/** 관리자 설정 › 앱 사용자 › 계정 옮기기, in a pop-up:
 *  - 새 계정으로 옮기기 (`mode` 'new'): a linked student who made a new account. Pick the new account, 미리 세어 보기, then
 *    옮기기 — 학습 기록 merged, 펫·포인트 from the old account, the old one unlinked and its sign-in blocked.
 *  - 기존 계정으로 옮기기 (`mode` 'existing'): an account not linked yet whose student is linked on another account. Pick
 *    that account — 학습 기록 merged into it, only the points added to its pet (its own pet when it has none), and the
 *    moved account's sign-in blocked. */
export default function AccountMovePanel({from,mode='new',users,busy,request,act,onClose,onMoved}:{key?:string;from:any;mode?:'new'|'existing';users:any[];busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>;onClose:()=>void;onMoved:(message:string)=>Promise<void>}){
 const existing=mode==='existing',title=existing?'기존 계정으로 옮기기':'새 계정으로 옮기기';
 const [query,setQuery]=useState(''),[to,setTo]=useState<any|null>(null),[preview,setPreview]=useState<any|null>(null);
 // 새 계정: an unlinked student account, newest first (it was just made). 기존 계정: a linked student account, same name first.
 const base=(from.name||'').trim();
 const candidates=users.filter(u=>u.uid!==from.uid&&!u.isAdmin&&u.role!=='teacher'&&u.role!=='principal'&&(existing?u.linkedStudent:!u.linkedStudent)&&(matchesKoreanSearch(u.name||'',query)||(u.email||'').toLowerCase().includes(query.toLowerCase())))
  .sort((a,b)=>existing?Number(Boolean(base)&&(b.name||'').includes(base))-Number(Boolean(base)&&(a.name||'').includes(base))||(a.name||'').localeCompare(b.name||'','ko'):String(b.joinedAt||'').localeCompare(String(a.joinedAt||'')));
 const pick=(u:any)=>{setTo(u);setPreview(null);void act(async()=>setPreview(await request(existing?'read:account-merge-preview':'read:account-move-preview',{fromUid:from.uid,toUid:u.uid})));};
 const move=async()=>{
  if(!to||!preview)return;
  if(existing){
   const pet=preview.from.points==null?'':preview.to.points==null?' 펫은 그대로 옮겨 가요.':` 포인트 ${won(preview.from.points)}P만 더하고, 이 계정의 펫·탑·원정대는 없어져요.`;
   if(!await askConfirm({title:`${from.email} 계정의 앱 기록을 ${to.email} 계정으로 옮길까요?`,message:`학습 기록은 합치고(같은 기록은 받는 계정 것을 남겨요),${pet} 옮긴 계정으로도 로그인은 계속 되고, 들어오면 이 계정으로 안내해요. 되돌릴 수 없어요.`,confirmText:'옮기기',tone:'danger',icon:'alert'}))return;
   void act(async()=>{const r=await request('merge-student-account',{fromUid:from.uid,toUid:to.uid});await onMoved(`${to.email} 계정으로 옮겼어요.${r.points?` 포인트 ${won(r.points)}P를 더했어요.`:''}`);});
   return;
  }
  if(!await askConfirm({title:`${from.name||from.email} 계정의 앱 기록을 새 계정으로 옮길까요?`,message:`${to.email}로 옮겨요. 학습 기록은 합치고, 펫·포인트는 옛 계정 것으로 바뀌어요(새 계정의 펫 ${preview.to.points==null?'없음':`${preview.to.points}P`}는 없어져요). 옛 계정은 학생 연결이 풀리고 로그인이 막혀요. 되돌릴 수 없어요.`,confirmText:'옮기기',tone:'danger',icon:'alert'}))return;
  void act(async()=>{const r=await request('move-student-account',{fromUid:from.uid,toUid:to.uid});await onMoved(`${to.email} 계정으로 옮겼어요.${r.signInBlocked?' 옛 계정은 로그인이 막혔어요.':' 옛 계정 로그인 막기는 실패했어요. 탈퇴한 계정에서 다시 막아 주세요.'}`);});
 };
 return <WorkspaceDialog open title={title} onClose={onClose}><div className="account-move" role="region" aria-label={title} style={{border:0,padding:0,margin:0}}>
  <p className="rv-sub" style={{margin:'0 0 10px'}}>{existing?'학원과 연결하기 전에 따로 가입해 공부한 계정의 기록을, 학원과 연결된 계정으로 합쳐요.':'로그인이 안 돼서 새로 가입한 학생의 앱 기록을 새 계정으로 옮겨요.'}</p>
  <div className="account-move-pair">
   <div className="account-move-acc"><span className="rv-sub">{existing?'연결 안 된 계정':'지금 연결된 옛 계정'}</span><strong>{from.name||'이름 없음'}</strong><span className="rv-sub">{from.email}{from.joinedAt?` · ${day(from.joinedAt)} 가입`:''}</span>{preview&&<span className="rv-sub">{counts(preview.from)}</span>}</div>
   <ArrowRight size={16} aria-hidden="true"/>
   <div className={'account-move-acc'+(to?' is-picked':'')}><span className="rv-sub">{existing?'학원과 연결된 계정':'새로 가입한 계정'}</span>{to?<><strong>{to.name||'이름 없음'}{existing&&preview?.to.student&&<span className="rv-sub"> · 학생 {preview.to.student}</span>}</strong><span className="rv-sub">{to.email}{to.joinedAt?` · ${day(to.joinedAt)} 가입`:''}</span>{preview&&<span className="rv-sub">{counts(preview.to)}</span>}<button type="button" className="gs-quiet" onClick={()=>{setTo(null);setPreview(null);}}>다른 계정 고르기</button></>:<span className="rv-sub">아래에서 골라 주세요</span>}</div>
  </div>
  {!to&&<><label className="student-master-search"><Search size={16} aria-hidden="true"/><input aria-label={existing?'연결된 계정 검색':'새 계정 검색'} placeholder="이름·이메일 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <ul className="account-move-list">{candidates.slice(0,8).map(u=><li key={u.uid}><span><strong>{u.name||'이름 없음'}</strong><small>{u.email}{u.joinedAt?` · ${day(u.joinedAt)} 가입`:''}</small></span><button type="button" className="small-button" disabled={busy} onClick={()=>pick(u)}>이 계정으로</button></li>)}
    {!candidates.length&&<li className="gs-note">{existing?'학생과 연결된 계정이 없어요.':'연결 안 된 학생 계정이 없어요. 학생이 먼저 새로 가입해야 해요.'}</li>}</ul></>}
  {to&&!preview&&<p className="gs-note">세어 보는 중…</p>}
  {preview&&existing&&<>
   <p className="account-move-cap">옮겨지는 것</p>
   <ul className="account-move-items">
    <li><span>학습 기록 · 단어 외움 · 출석 · 문제 풀이</span><span>{preview.from.sessions} · {preview.from.words} · {preview.from.attendance} · {preview.from.attempts}</span></li>
    <li><span>지문 분석 · 워크북</span><span>{preview.from.passages} · {preview.from.workbooks}</span></li>
    <li><span>펫 · 포인트</span><span>{preview.from.points==null?'펫 없음':preview.to.points==null?`펫 그대로 (${won(preview.from.points)}P)`:`${won(preview.from.points)}P 더하기`}</span></li>
   </ul>
   <p className="gs-note">{preview.from.points!=null&&preview.to.points!=null?'받는 계정의 펫·탑·원정대는 그대로이고, 옮기는 계정의 펫·탑·원정대는 없어져요. ':''}같은 기록이 양쪽에 있으면 받는 계정 것을 남겨요. 옮긴 계정으로도 로그인은 계속 돼요(들어오면 받는 계정으로 안내하고, 거기서 또 공부했으면 다시 옮기면 돼요). 학생 연결과 수업 일지·리포트는 그대로예요.</p>
   <div className="gs-foot"><span className="gs-grow"/><button type="button" className="small-button" onClick={onClose}>취소</button><button type="button" className="primary-button" disabled={busy} onClick={()=>void move()}>옮기기</button></div>
  </>}
  {preview&&!existing&&<>
   <p className="account-move-cap">옮겨지는 것</p>
   <ul className="account-move-items">
    <li><span>학습 기록 · 단어 외움 · 출석 · 문제 풀이</span><span>{preview.from.sessions} · {preview.from.words} · {preview.from.attendance} · {preview.from.attempts}</span></li>
    <li><span>펫 · 포인트 · 탑 · 원정대 · 방</span><span>{preview.from.points==null?'펫 없음':`${preview.from.points.toLocaleString('ko-KR')}P · 펫 ${preview.from.pets}마리${preview.from.floor?` · 탑 ${preview.from.floor}층`:''}`}</span></li>
    <li><span>장학 쿠폰 · 공부 인증 · 숙제 완료 표시</span><span>{preview.from.coupons} · {preview.from.certs} · {preview.from.done}</span></li>
    <li><span>원정대 파티 · 명예의 전당 · 이웃 방의 이름</span><span>새 계정으로 바꿔 적기</span></li>
   </ul>
   <p className="gs-note">새 계정의 학습 기록({preview.to.sessions}개)은 그대로 합쳐지고, 펫·포인트는 옛 계정 것으로 바뀌어요. 옛 계정은 연결이 풀리고 로그인이 막혀요. 수업 일지·리포트·성적은 학생 쪽에 있어서 그대로이고, 이미 받은 수업 보상은 다시 주지 않아요.</p>
   <div className="gs-foot"><span className="gs-grow"/><button type="button" className="small-button" onClick={onClose}>취소</button><button type="button" className="primary-button" disabled={busy} onClick={()=>void move()}>옮기기</button></div>
  </>}
 </div></WorkspaceDialog>;
}
