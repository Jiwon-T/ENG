import {useState} from 'react';
import StatusBadge from './StatusBadge';
type Props={request:(action:string,body?:any)=>Promise<any>};
// Where each switch lives, in the recommended order (the server returns areas in this order).
const areaWhere:Record<string,string>={core:'관리자 설정 탭 → 학생·선생님·수강 이전',class:'관리자 설정 탭 → 반·정규 시간표·교재 이전',schedule:'시간표·일정 탭 → 일정 앱 전환 · 관리자',lesson:'관리자 설정 탭 → 일지 앱 전환',template:'관리자 설정 탭 → 문자 템플릿 영구 저장·동기화 → 문자 템플릿 앱 전환',grade:'성적 관리 탭 → 과거 Notion 성적 이전 · 관리자 → 성적 앱 전환'};
const areaLabel:Record<string,string>={core:'학생·선생님·수강·담당 권한',class:'반·교재·시간표',schedule:'일정',lesson:'수업 일지',template:'문자 템플릿',grade:'성적'};
const notionAreaLabel:Record<string,string>={lesson:'일지 DB',grade:'성적 DB',schedule:'일정 DB',class:'반·교재·시간표 DB',directory:'학생·선생님·수강 DB',template:'문자 템플릿 DB',page:'개별 페이지',database:'기타 DB',other:'기타'};
const routeLabel:Record<string,string>={'workspace:bootstrap':'화면 처음 불러오기','workspace:bootstrap-fast':'화면 처음 불러오기','workspace:academy-lessons':'일지 조회','workspace:previous-lesson':'직전 수업 불러오기','workspace:publish':'일지 반영','workspace:save-draft':'일지 저장','workspace:archive-lesson':'일지 삭제','workspace:import-source-record':'Notion 기록 가져오기','workspace:schedule-records':'일정 조회','workspace:lesson-migration-step':'과거 일지 이전','cron:lesson-migration':'과거 일지 이전(예약)','workspace:integrity-audit':'무결성 점검(관리자 진단)','webhook:academic':'Make 성적 반영','webhook:lesson':'Make 일지 반영','webhook:schedule':'Make 일정 반영','student-link':'학생 계정 연결','report-slug':'리포트 주소','notion-students':'학생 목록(계정 연결)','workspace:messages':'문자 화면','workspace:prepare-message':'문자 준비'};
function stepText(s:any){
 switch(s.key){
  case 'make-lesson':return {title:'Make 수업 일지 시나리오 끄기',ready:`일지가 앱 전용이라 Make가 보내도 반영되지 않습니다(최근 7일 수신 ${s.deliveries}회, 차단 ${s.blockedAfterSwitch}회). Make에서 일지 리포트 시나리오를 꺼 주세요.`,wait:'일지 앱 전환 후에 끌 수 있습니다.'};
  case 'make-schedule':return {title:'Make 일정 시나리오 끄기',ready:`일정이 앱 전용이라 Make가 보내도 반영되지 않습니다(최근 7일 수신 ${s.deliveries}회, 차단 ${s.blockedAfterSwitch}회). Make에서 일정 시나리오를 꺼 주세요.`,wait:'일정 앱 전환 후에 끌 수 있습니다.'};
  case 'make-academic':return {title:'Make 성적 시나리오 끄기',ready:`성적이 앱 전용이라 Make가 보내도 반영되지 않습니다(최근 7일 수신 ${s.deliveries}회). Make에서 성적 시나리오를 꺼 주세요.`,wait:s.notionEditsApplied?`성적 앱 전환 후에 끌 수 있습니다. 최근 7일 Notion에서 고친 성적 ${s.notionEditsApplied}건이 아직 앱에 반영됐습니다.`:'성적 앱 전환(과거 성적 이전 화면) 후에 끌 수 있습니다.'};
  case 'template-worker':return {title:'문자 템플릿 반영 작업기 중지',ready:`템플릿이 앱 전용이라 작업기가 Notion에 쓰지 않습니다. Cloud Run 작업기를 중지하고 MESSAGE_TEMPLATE_SYNC_ENABLED를 false로 두세요.${s.workerEnabled?' (지금 이 서버 설정은 true입니다)':''}`,wait:'문자 템플릿 앱 전환 후에 중지할 수 있습니다.'};
  default:return {title:'Notion 연동 권한 줄이기',ready:'앱 화면에서 Notion을 부르는 곳이 없습니다(관리자 진단 제외). Notion 연동에서 쓰기 권한을 빼고 읽기만 남기거나, 필요 없는 DB 공유를 해제할 수 있습니다. 원본 보관을 위해 읽기 권한은 당분간 유지하길 권합니다.',wait:s.remainingRoutes?.length?`아직 Notion을 부르는 곳: ${s.remainingRoutes.map((r:any)=>(routeLabel[r.route]||r.route)+` ${r.count}회`).join(', ')}`:'모든 영역이 앱 전용으로 전환된 뒤에 줄일 수 있습니다.'};
 }
}
/** Admin readiness for turning off Make and narrowing Notion access. Reads only; changes nothing. */
export default function NotionDisconnectPanel({request}:Props){
 const [state,setState]=useState<any>(null),[error,setError]=useState('');
 async function load(){try{setError('');setState(await request('read:notion-disconnect-status'));}catch(e){setError(e instanceof Error?e.message:'불러오지 못했습니다');}}
 const total=(k:'notion'|'webhooks')=>state?.usage.days.reduce((s:number,d:any)=>s+d[k],0)||0;
 return <details className="panel lesson-cutover" onToggle={e=>{if((e.currentTarget as HTMLDetailsElement).open&&!state)void load();}}>
  <summary><strong>Notion·Make 연결 정리 준비</strong></summary>
  {error&&<p role="alert" className="lesson-cutover-warn">{error}</p>}
  {state&&<>
   <p className="lesson-cutover-muted">이 화면은 확인만 합니다. Make 시나리오·작업기·Notion 권한은 아래 안내에 따라 직접 바꿔 주세요.</p>
   <h4 className="text-sm font-bold">영역별 앱 전환 (위에서부터 순서대로)</h4>
   <ol className="lesson-cutover-groups">{state.areas.map((a:any)=>{const next=!a.appOnly&&state.areas.find((x:any)=>!x.appOnly)?.key===a.key;return <li key={a.key} className="lesson-cutover-group" aria-current={next?'step':undefined}><div className="lesson-cutover-group-head"><strong>{areaLabel[a.key]||a.key}</strong><StatusBadge kind={a.appOnly?'done':next?'saved':'unwritten'} text={a.appOnly?'앱 전용':next?'다음 차례':'Notion 사용 중'}/></div>{!a.appOnly&&<p className="lesson-cutover-muted">전환 위치: {areaWhere[a.key]}</p>}</li>;})}</ol>
   <h4 className="text-sm font-bold">외부 연결 정리 단계</h4>
   <ul className="lesson-cutover-groups">{state.steps.map((s:any)=>{const t=stepText(s);return <li key={s.key} className="lesson-cutover-group"><div className="lesson-cutover-group-head"><strong>{t.title}</strong><StatusBadge kind={s.ready?'done':'saved'} text={s.ready?'진행 가능':'대기'}/></div><p className="lesson-cutover-muted">{s.ready?t.ready:t.wait}</p></li>;})}</ul>
   <h4 className="text-sm font-bold">최근 7일 사용량 ({state.measuredSince}부터)</h4>
   <p className="lesson-cutover-muted">Notion 호출 {total('notion').toLocaleString()}회 · Make 수신 {total('webhooks').toLocaleString()}회. 이 기록은 배포 이후부터 쌓입니다.</p>
   {state.usage.routes.length>0&&<ul className="lesson-cutover-items">{state.usage.routes.slice(0,12).map((r:any)=><li key={r.route+r.area}><span>{routeLabel[r.route]||r.route} · {notionAreaLabel[r.area]||r.area}</span><span className="lesson-cutover-muted">{r.count.toLocaleString()}회</span></li>)}</ul>}
  </>}
 </details>;
}
