import {useEffect,useState} from 'react';
import {Copy,Gauge,Trash2} from 'lucide-react';
import {clearTimings,onTimings,recentTimings,type RequestTiming} from '../../lib/requestTimings';
const labels:Record<string,string>={cold:'서버 깨어남','auth-token':'로그인 확인','auth-account':'계정 확인','auth-scopes':'담당 학생 확인',auth:'인증 전체',prepare:'준비',read:'자료 읽기',total:'서버 전체'};
const stageText=(t:RequestTiming)=>t.server.filter(s=>s.name!=='total').map(s=>s.name==='cold'?labels.cold:`${labels[s.name]||s.name} ${s.ms}ms`).join(' · ');
const serverTotal=(t:RequestTiming)=>t.server.find(s=>s.name==='total')?.ms??null;
const sec=(ms:number|null)=>ms==null?'—':ms>=1000?`${(ms/1000).toFixed(1)}초`:`${ms}ms`;
/** 관리자 설정 › 정리·점검 › 속도 점검: where the seconds go for requests made in this browser tab. */
export default function SpeedCheckPanel(){
 const [rows,setRows]=useState<RequestTiming[]>(recentTimings()),[copied,setCopied]=useState(false);
 useEffect(()=>onTimings(()=>setRows(recentTimings())),[]);
 const copy=async()=>{const text=rows.map(t=>`${new Date(t.at).toLocaleTimeString('ko-KR')} | ${t.action} | 전체 ${t.ms}ms | 서버 ${serverTotal(t)??'?'}ms | 토큰 ${t.token}ms | ${stageText(t)}`).join('\n');try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{window.prompt('아래 내용을 복사해 주세요.',text);}};
 return <section className="speed">
  <div className="rv-head"><h3><Gauge size={16} aria-hidden="true"/>속도 점검<small>이 탭에서 보낸 요청 {rows.length}건</small></h3>
   <span className="speed-tools"><button type="button" className="gs-quiet" disabled={!rows.length} onClick={()=>void copy()}><Copy size={14} aria-hidden="true"/>{copied?'복사됨':'결과 복사'}</button><button type="button" className="gs-quiet" disabled={!rows.length} onClick={clearTimings}><Trash2 size={14} aria-hidden="true"/>지우기</button></span></div>
  <p className="gs-note">다른 탭으로 이동하거나 새로고침한 뒤 여기로 오면 방금 걸린 시간이 나옵니다. ‘전체’는 버튼을 누른 뒤 답을 받기까지, ‘서버’는 그중 서버가 일한 시간입니다. 나머지는 인터넷으로 오가는 시간입니다. 학생 정보는 기록하지 않습니다.</p>
  {rows.length?<div className="tu-table-wrap"><table className="tu-table speed-table"><thead><tr><th scope="col">시각</th><th scope="col">요청</th><th scope="col">전체</th><th scope="col">서버</th><th scope="col">오가는 시간</th><th scope="col">서버 안에서 걸린 곳</th></tr></thead>
   <tbody>{rows.map((t,i)=>{const server=serverTotal(t),travel=server==null?null:Math.max(t.ms-server-t.token,0);return <tr key={i} className={t.ms>=2000?'is-slow':''}><td className="num">{new Date(t.at).toLocaleTimeString('ko-KR')}</td><td>{t.action}{t.status>=400&&<small className="warn">오류 {t.status}</small>}</td><td className="num"><strong>{sec(t.ms)}</strong></td><td className="num">{sec(server)}</td><td className="num">{sec(travel)}{t.token>200&&<small>로그인 토큰 {sec(t.token)}</small>}</td><td className="speed-stages">{t.server.some(s=>s.name==='cold')&&<span className="speed-cold">서버 깨어남</span>}{stageText(t).replace(labels.cold,'').replace(/^ · /,'')||'—'}</td></tr>;})}</tbody></table></div>
  :<p className="rv-empty">아직 기록이 없습니다. 다른 탭을 열었다가 돌아오면 기록이 생깁니다.</p>}
 </section>;
}
