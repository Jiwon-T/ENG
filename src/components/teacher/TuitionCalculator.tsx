import {useMemo,useState} from 'react';
import {Calculator,ChevronLeft,ChevronRight,Download,Search} from 'lucide-react';
import {matchesKoreanSearch} from '../../lib/koreanSearch';
import {tuitionCharge,tuitionCsv,TUITION_SESSIONS} from '../../lib/tuition';
type Edit={sessions?:number|null;free?:number|null;tuition?:number|null};
const won=(n:number|null|undefined)=>n==null?'—':`${n.toLocaleString('ko-KR')}원`;
const shift=(m:string,d:number)=>{const [y,mo]=m.split('-').map(Number),t=new Date(Date.UTC(y,mo-1+d,1));return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}`;};
const thisMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()).slice(0,7);
/** 관리자 설정 > 수강료 계산: monthly tuition sheet built from 일지 + timetable; the admin corrects rows, saves and confirms. */
export default function TuitionCalculator({busy,request,act}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>}){
 const [month,setMonth]=useState(thisMonth()),[sheet,setSheet]=useState<any>(null),[edits,setEdits]=useState<Record<string,Edit>>({}),[query,setQuery]=useState(''),[filter,setFilter]=useState<'all'|'missing'|'edited'|'left'|'changed'>('all'),[notice,setNotice]=useState('');
 const load=async(m=month)=>{const r=await request('read:tuition-month',{month:m});setSheet(r);setEdits({});setMonth(m);setNotice('');};
 const go=(m:string)=>{if(Object.keys(edits).length&&!window.confirm('저장하지 않은 수정이 있습니다. 다른 달로 옮길까요?'))return;void act(()=>load(m));};
 const rows=useMemo(()=>(sheet?.rows||[]).map((r:any)=>{const e=edits[r.key]||{};const sessions=e.sessions!==undefined?(e.sessions??r.expected):r.sessions,free=e.free!==undefined?(e.free??0):r.free,tuition=e.tuition!==undefined?e.tuition:r.tuition;return {...r,sessions,free,tuition,dirty:Boolean(edits[r.key]),...tuitionCharge(tuition,sessions,free)};}),[sheet,edits]);
 const shown=rows.filter((r:any)=>(filter==='all'||filter==='missing'&&r.tuition==null||filter==='edited'&&(r.edited||r.dirty)||filter==='left'&&r.left||filter==='changed'&&r.changedSinceConfirm)&&matchesKoreanSearch(r.name,query));
 const total=rows.reduce((n:number,r:any)=>n+(r.amount||0),0),missing=rows.filter((r:any)=>r.tuition==null).length,students=new Set(rows.map((r:any)=>r.studentKey)).size;
 const edit=(key:string,field:keyof Edit,text:string)=>{const digits=text.replace(/\D/g,'').slice(0,field==='tuition'?9:2);setEdits(old=>({...old,[key]:{...old[key],[field]:digits===''?null:Number(digits)}}));};
 const save=(confirm=false)=>{if(confirm&&!window.confirm(`${month} 수강료 ${won(total)}을 확정할까요? 확정 후에도 수정할 수 있습니다.`))return;
  void act(async()=>{const r=await request('save-tuition-month',{month,revision:sheet.revision,rows:Object.fromEntries(Object.entries(edits)),confirm});await load(month);setNotice(confirm?`${month} 수강료를 확정했습니다.`:'수정 내용을 저장했습니다.');return r;});};
 const download=()=>{const csv=tuitionCsv([['학생','과목','일지 작성','남은 시간표','수업 횟수','무료 보강','청구 회차','수강료(8회)','청구액','메모'],...rows.map((r:any)=>[r.name,r.subject,r.written,r.planned,r.sessions,r.free,r.charged,r.tuition,r.amount,r.note])]);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`수강료_${month}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const past=sheet&&sheet.today>`${month}-31`,future=sheet&&sheet.today<`${month}-01`;
 return <section className="panel rv tu">
  <div className="rv-head"><h2>수강료 계산{sheet&&<small>{students}명</small>}</h2>{!sheet&&<button type="button" className="small-button" disabled={busy} onClick={()=>act(()=>load())}><Calculator size={16} aria-hidden="true"/>이번 달 계산하기</button>}</div>
  {sheet&&<>
   <div className="tu-bar">
    <div className="tu-month"><button type="button" aria-label="이전 달" disabled={busy} onClick={()=>go(shift(month,-1))}><ChevronLeft size={18}/></button><strong>{Number(month.slice(0,4))}년 {Number(month.slice(5))}월</strong><button type="button" aria-label="다음 달" disabled={busy} onClick={()=>go(shift(month,1))}><ChevronRight size={18}/></button></div>
    <div className="tu-stats"><span>청구 합계 <strong>{won(total)}</strong></span>{missing>0&&<span className="warn">수강료 없음 <strong>{missing}</strong></span>}<span className={sheet.confirmedAt?'ok':''}>{sheet.confirmedAt?`확정 ${new Date(sheet.confirmedAt).toLocaleDateString('ko-KR')}`:past?'지난 달 · 미확정':future?'다음 달 · 예상':'이번 달 · 예상'}</span></div>
   </div>
   {sheet.changedSinceConfirm>0&&<div className="tu-changed" role="status"><strong>확정 후 바뀐 청구 {sheet.changedSinceConfirm}건</strong><span>확정한 뒤 일지가 고쳐지거나 추가·삭제되어 청구 회차나 금액이 달라졌습니다. 노란 줄을 확인하고 ‘이 달 수강료 확정’을 다시 눌러 주세요.</span>{sheet.removedSinceConfirm?.length>0&&<span>목록에서 빠진 학생: {sheet.removedSinceConfirm.map((r:any)=>`${r.name} ${r.subject} (확정 ${won(r.amount)})`).join(', ')}</span>}<button type="button" className="gs-quiet" onClick={()=>setFilter('changed')}>바뀐 줄만 보기</button></div>}
   <div className="rv-filters"><label className="student-master-search"><Search size={16} aria-hidden="true"/><input aria-label="학생 검색" placeholder="학생 이름·초성 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="rv-seg" role="group" aria-label="보기">{([['all','전체',rows.length],['missing','수강료 없음',missing],['edited','직접 고친 행',rows.filter((r:any)=>r.edited||r.dirty).length],['left','퇴원·중단',rows.filter((r:any)=>r.left).length]] as const).map(([k,l,n])=><button key={k} type="button" aria-pressed={filter===k} onClick={()=>setFilter(k)}>{l} {n}</button>)}</div></div>
   <div className="tu-table-wrap"><table className="tu-table">
    <thead><tr><th scope="col">학생</th><th scope="col">과목</th><th scope="col" title="이번 달 이미 쓴 일지(수업 있음) 개수">일지</th><th scope="col" title="오늘 이후 남은 정규 수업(휴강 제외, 보강 포함)">남은 수업</th><th scope="col">수업 횟수</th><th scope="col" title="청구하지 않을 무료 보강 횟수">무료 보강</th><th scope="col">청구</th><th scope="col">수강료 (8회)</th><th scope="col">청구액</th></tr></thead>
    <tbody>{shown.map((r:any)=><tr key={r.key} className={r.changedSinceConfirm?'is-changed':r.dirty?'is-dirty':r.edited?'is-edited':''}>
     <th scope="row"><span className="tu-name">{r.name}</span>{r.classes.length>0&&<small>{r.classes.join(', ')}</small>}</th>
     <td>{r.subject}{r.left&&<small className="warn">{/퇴원|탈퇴/.test(r.enrollment||'')?r.enrollment:r.status==='기록만'?'수강 정보 없음':'중단'}{r.endDate?` · ${Number(r.endDate.slice(5,7))}/${Number(r.endDate.slice(8))}`:''}</small>}</td>
     <td className="num">{r.written}{r.lastRound!=null&&<small>마지막 {r.lastRound}회</small>}</td>
     <td className="num">{r.planned}</td>
     <td><input className="tu-in" inputMode="numeric" aria-label={`${r.name} ${r.subject} 수업 횟수`} value={r.sessions} onChange={e=>edit(r.key,'sessions',e.target.value)}/>{r.sessions!==r.expected&&<small>예상 {r.expected}</small>}</td>
     <td><input className="tu-in" inputMode="numeric" aria-label={`${r.name} ${r.subject} 무료 보강`} value={r.free||''} placeholder="0" onChange={e=>edit(r.key,'free',e.target.value)}/></td>
     <td className="num"><strong>{r.charged}</strong>/{TUITION_SESSIONS}{r.sessions-r.free>TUITION_SESSIONS&&<small className="ok">{r.sessions-r.free-TUITION_SESSIONS}회 무료</small>}</td>
     <td><input className="tu-in wide" inputMode="numeric" aria-label={`${r.name} ${r.subject} 수강료`} placeholder="입력" value={r.tuition==null?'':r.tuition.toLocaleString('ko-KR')} onChange={e=>edit(r.key,'tuition',e.target.value)}/>{r.tuition==null&&<small className="warn">수강료 없음</small>}</td>
     <td className="num amount">{won(r.amount)}{r.changedSinceConfirm&&<small className="warn">확정 {r.changedSinceConfirm.charged}회 · {won(r.changedSinceConfirm.amount)}</small>}</td>
    </tr>)}</tbody>
   </table>{!shown.length&&<p className="rv-empty">조건에 맞는 학생이 없습니다.</p>}</div>
   <div className="gs-foot"><button type="button" className="small-button" onClick={download} disabled={!rows.length}><Download size={14} aria-hidden="true"/>엑셀(CSV) 받기</button><span className="gs-grow"/>{Object.keys(edits).length>0&&<span className="gs-note">수정 {Object.keys(edits).length}건 저장 전</span>}<button type="button" className="small-button" disabled={busy||!Object.keys(edits).length} onClick={()=>save(false)}>수정 저장</button><button type="button" className="primary-button" disabled={busy||!rows.length} onClick={()=>save(true)}>이 달 수강료 확정</button></div>
  </>}
  {notice&&<p role="status" className="gs-note">{notice}</p>}
 </section>;
}
