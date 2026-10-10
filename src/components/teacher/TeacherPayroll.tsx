import {Fragment,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,Eye,EyeOff,Lock,Wallet} from 'lucide-react';
import {tuitionCsv} from '../../lib/tuition';
const won=(n:number|null|undefined)=>n==null?'—':`${n.toLocaleString('ko-KR')}원`;
const shift=(m:string,d:number)=>{const [y,mo]=m.split('-').map(Number),t=new Date(Date.UTC(y,mo-1+d,1));return `${t.getUTCFullYear()}-${String(t.getUTCMonth()+1).padStart(2,'0')}`;};
const thisMonth=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()).slice(0,7);
const digits=(text:string,max:number)=>{const neg=text.trim().startsWith('-'),d=text.replace(/\D/g,'').slice(0,max);return d===''?null:(neg?-1:1)*Number(d);};
/** 관리자 설정 > 선생님 정산 (admin and principal only). Shares are hidden until 비율 보기, so the screen can be open near others. */
export default function TeacherPayroll({busy,request,act}:{busy:boolean;request:(a:string,b?:any)=>Promise<any>;act:(f:()=>Promise<any>)=>Promise<void>}){
 const [month,setMonth]=useState(thisMonth()),[data,setData]=useState<any>(null),[reveal,setReveal]=useState(false),[editShares,setEditShares]=useState<null|{defaultShare:number;shares:Record<string,number|null>}>(null);
 const [adjust,setAdjust]=useState<Record<string,{amount:number|null;note:string}>>({}),[notice,setNotice]=useState('');
 const load=async(m=month)=>{const r=await request('read:teacher-payroll',{month:m});setData(r);setMonth(m);setAdjust({});setNotice('');};
 const go=(m:string)=>{if(Object.keys(adjust).length&&!window.confirm('저장하지 않은 조정이 있습니다. 다른 달로 옮길까요?'))return;void act(()=>load(m));};
 const pct=(n:number)=>reveal?`${n}%`:'••%';
 const saveAdjust=()=>void act(async()=>{await request('save-payroll-adjust',{month,revision:data.revision,adjust:Object.fromEntries(Object.entries(adjust).map(([uid,a]:[string,{amount:number|null;note:string}])=>[uid,a.amount==null&&!a.note?null:{amount:a.amount??0,note:a.note}]))});await load(month);setNotice('조정 금액을 저장했습니다.');});
 const saveShares=()=>{if(!editShares)return;void act(async()=>{await request('save-teacher-shares',editShares);setEditShares(null);await load(month);setNotice('정산 비율을 저장했습니다.');});};
 const download=()=>{const rows:(string|number|null)[][]=[['선생님','학생','과목','청구 회차','청구액','선생님 몫(비율 전)','비율(%)','정산액']];
  for(const t of data.teachers){for(const r of t.rows)rows.push([t.name,r.name,r.subject,r.charged,r.amount,r.revenue,t.share,r.pay]);rows.push([t.name,'조정','',null,null,null,null,t.adjust]);rows.push([t.name,'합계','',null,t.revenue,null,t.share,t.total]);}
  const url=URL.createObjectURL(new Blob([tuitionCsv(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`선생님정산_${month}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <section className="panel rv pay">
  <div className="rv-head"><h2>선생님 정산<span className="pay-lock"><Lock size={12} aria-hidden="true"/>관리자·원장님만 보임</span></h2>{!data&&<button type="button" className="small-button" disabled={busy} onClick={()=>act(()=>load())}><Wallet size={16} aria-hidden="true"/>이번 달 정산 보기</button>}</div>
  {data&&<>
   <div className="tu-bar">
    <div className="tu-month"><button type="button" aria-label="이전 달" disabled={busy} onClick={()=>go(shift(month,-1))}><ChevronLeft size={18}/></button><strong>{Number(month.slice(0,4))}년 {Number(month.slice(5))}월</strong><button type="button" aria-label="다음 달" disabled={busy} onClick={()=>go(shift(month,1))}><ChevronRight size={18}/></button></div>
    <div className="tu-stats"><span>원비 합계 <strong>{won(data.revenue)}</strong></span><span>선생님 지급 <strong>{won(data.teacherTotal)}</strong></span><span className="ok">학원 <strong>{won(data.academy)}</strong></span></div>
   </div>
   {!data.sheetConfirmedAt&&<p className="pay-warn">이 달 수강료가 아직 확정되지 않아 예상 금액입니다. 위 ‘수강료 계산’에서 확정하면 정산도 확정 금액이 됩니다.</p>}
   <div className="pay-tools"><button type="button" className="gs-quiet" onClick={()=>setReveal(!reveal)}>{reveal?<EyeOff size={14} aria-hidden="true"/>:<Eye size={14} aria-hidden="true"/>}{reveal?'비율 숨기기':'비율 보기'}</button>
    <button type="button" className="gs-quiet" onClick={()=>{setReveal(true);setEditShares({defaultShare:data.defaultShare,shares:Object.fromEntries(data.staff.map((s:any)=>[s.uid,s.share]))});}}>비율 설정</button><span className="gs-grow"/><span className="gs-note">기본 선생님 {pct(data.defaultShare)} · 학원 {reveal?`${100-data.defaultShare}%`:'••%'}</span></div>
   {editShares&&<div className="pay-shares">
    <label className="pay-share-default">기본 비율 (선생님 몫)<span><input inputMode="numeric" value={editShares.defaultShare} onChange={e=>setEditShares({...editShares,defaultShare:Math.min(digits(e.target.value,3)??0,100)})}/>%</span></label>
    <div className="pay-share-list">{data.staff.map((s:any)=>{const v=editShares.shares[s.uid];return <label key={s.uid}><span>{s.name}</span><span><input inputMode="numeric" placeholder={`기본 ${editShares.defaultShare}`} value={v??''} onChange={e=>{const n=digits(e.target.value,3);setEditShares({...editShares,shares:{...editShares.shares,[s.uid]:n==null?null:Math.min(Math.abs(n),100)}});}}/>%</span></label>;})}</div>
    <p className="gs-note">비워 두면 기본 비율을 씁니다. 비율은 관리자와 원장님만 볼 수 있고, 선생님 화면에는 나오지 않습니다.</p>
    <div className="gs-foot"><span className="gs-grow"/><button type="button" className="small-button" onClick={()=>setEditShares(null)}>취소</button><button type="button" className="primary-button" disabled={busy} onClick={saveShares}>비율 저장</button></div>
   </div>}
   <div className="tu-table-wrap"><table className="tu-table pay-table">
    <thead><tr><th scope="col">선생님</th><th scope="col">학생</th><th scope="col">원비</th><th scope="col">비율</th><th scope="col">정산액</th><th scope="col">조정 (+/−)</th><th scope="col">지급액</th></tr></thead>
    <tbody>{data.teachers.map((t:any)=>{const a=adjust[t.uid],amount=a?a.amount:t.adjust,note=a?a.note:t.adjustNote,total=t.pay+(amount??0);return <Fragment key={t.uid}>
     <tr className={a?'is-dirty':''}>
      <th scope="row"><details className="pay-detail"><summary><span className="tu-name">{t.name}</span>{t.disconnected&&<small className="warn">연결 해제</small>}</summary>
       <ul>{t.rows.map((r:any)=><li key={r.key}><span>{r.name} · {r.subject}</span><span>{r.written?`일지 ${r.written}회`:''}{r.written&&r.planned?' + ':''}{r.planned?`예정 ${r.planned}회`:''}{!r.written&&!r.planned?`${r.charged}회`:''} · {won(r.revenue)}{r.shared&&<small> ({Math.round(r.part*100)}%{r.assigned?'':' · 지금은 담당 아님'})</small>}</span><strong>{won(r.pay)}</strong></li>)}{!t.rows.length&&<li className="rv-sub">이 달 담당 원비가 없습니다.</li>}</ul></details></th>
      <td className="num">{t.rows.length}</td>
      <td className="num">{won(t.revenue)}</td>
      <td className="num">{pct(t.share)}{t.customShare&&<small>{reveal?'개별':'•'}</small>}</td>
      <td className="num">{won(t.pay)}</td>
      <td><input className="tu-in wide" inputMode="numeric" aria-label={`${t.name} 조정 금액`} placeholder="0" value={amount==null||amount===0?'':amount.toLocaleString('ko-KR')} onChange={e=>setAdjust(old=>({...old,[t.uid]:{amount:digits(e.target.value,9),note:note||''}}))}/>
       <input className="tu-in pay-note" aria-label={`${t.name} 조정 메모`} placeholder="메모 (수당·교재비 등)" maxLength={200} value={note||''} onChange={e=>setAdjust(old=>({...old,[t.uid]:{amount:amount??null,note:e.target.value}}))}/></td>
      <td className="num amount">{won(total)}</td>
     </tr></Fragment>;})}</tbody>
   </table>{!data.teachers.length&&<p className="rv-empty">이 달 정산할 선생님이 없습니다.</p>}</div>
   {data.unassigned.length>0&&<details className="pay-unassigned"><summary>정산에서 빠진 원비 {data.unassigned.length}건 · {won(data.unassigned.reduce((n:number,r:any)=>n+(r.amount||0),0))} (학원 몫으로 계산)</summary>
    <ul>{data.unassigned.map((r:any)=><li key={r.key}>{r.name} · {r.subject} — {r.reason==='no-price'?'수강료 없음':`담당 선생님 없음 · ${won(r.amount)}`}</li>)}</ul><p className="gs-note">담당은 선생님 관리에서, 수강료는 수강료 계산 표에서 넣을 수 있습니다.</p></details>}
   <div className="gs-foot"><button type="button" className="small-button" onClick={download} disabled={!data.teachers.length}><Download size={14} aria-hidden="true"/>엑셀(CSV) 받기</button><span className="gs-grow"/>{Object.keys(adjust).length>0&&<span className="gs-note">조정 {Object.keys(adjust).length}건 저장 전</span>}<button type="button" className="primary-button" disabled={busy||!Object.keys(adjust).length} onClick={saveAdjust}>조정 저장</button></div>
  </>}
  {notice&&<p role="status" className="gs-note">{notice}</p>}
 </section>;
}
