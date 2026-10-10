import AutomaticImportControl from './AutomaticImportControl';
import TemplateCutoverPanel from './TemplateCutoverPanel';
import {useRef,useState} from 'react';
import StatusBadge from './StatusBadge';
import AutoTextarea from './AutoTextarea';
type Template={id:string;title:string;body:string;target:string;archived:boolean;revision:number;status:string;lastSuccessAt:number|null;error:string|null;sourceWarning?:string|null;remote:any;remoteHash:string|null};
type Props={busy:boolean;request:(action:string,input?:any)=>Promise<any>;act:(fn:()=>Promise<void>)=>any};
const kind=(status:string)=>status==='synced'||status==='app'?'done':['failed','conflict'].includes(status)?'failed':'saved';
export function MessageTemplateEditor({record,busy,onSave,onRetry,onResolve,onDirty,appOnly=false}:{record:Template;busy:boolean;onSave:(data:{title:string;body:string})=>void;onRetry:()=>void;onResolve:(choice:'app'|'notion')=>void;onDirty?:(dirty:boolean)=>void;appOnly?:boolean}){
 const [title,setTitle]=useState(record.title),[body,setBody]=useState(record.body);
 const locked=busy||record.status==='conflict'||record.archived;
 return <div className="message-template-editor">
  {!appOnly&&<div className="message-template-toolbar"><StatusBadge kind={kind(record.status)} text={record.status==='app'?'앱 저장 완료':record.status==='conflict'?'양쪽 수정 · 확인 필요':record.status==='synced'?'Notion 동기화 완료':record.status==='failed'?'앱 저장 유지 · 동기화 실패':'앱 저장 완료 · Notion 대기'}/>{record.lastSuccessAt&&<span className="text-xs">마지막 성공 {new Date(record.lastSuccessAt).toLocaleString('ko-KR')}</span>}</div>}
  <label>템플릿 이름<input value={title} maxLength={300} disabled={locked} onChange={e=>{setTitle(e.target.value);onDirty?.(e.target.value!==record.title||body!==record.body);}}/></label>
  <p className="text-xs">대상: {record.target||'지정 없음'}{record.archived?' · 원본 보관됨':''}</p>
  <label>문자 템플릿 본문<AutoTextarea value={body} maxLength={10000} maxRows={10} disabled={locked} onChange={e=>{setBody(e.target.value);onDirty?.(e.target.value!==record.body||title!==record.title);}}/></label>
  {record.error&&<p role="status" className="text-xs">{record.error}</p>}
  {!appOnly&&record.sourceWarning&&<p role="status" className="text-xs">원본 접근 확인 필요: {record.sourceWarning} · 앱 자료는 유지됩니다.</p>}
  {!appOnly&&record.remote&&<div className="message-template-conflict" role="status"><strong>Notion에서 수정된 내용</strong><p>{record.remote.title}</p><pre>{record.remote.body}</pre><div className="message-template-toolbar"><button type="button" className="small-button" disabled={busy} onClick={()=>onResolve('notion')}>Notion 내용 가져오기</button><button type="button" className="small-button" disabled={busy||record.remote.archived} onClick={()=>onResolve('app')}>앱 내용으로 다시 반영 요청</button></div></div>}
  <div className="message-template-toolbar"><button type="button" className="primary-button" disabled={locked||!title.trim()||title.trim()===record.title&&body===record.body} onClick={()=>onSave({title,body})}>{appOnly?'저장':'앱에 저장 · 동기화 요청'}</button>{record.status==='failed'&&!appOnly&&<button type="button" className="small-button" disabled={busy} onClick={onRetry}>동기화 다시 시도</button>}</div>
  <p className="text-xs">템플릿만 수정합니다. 실제 문자는 발송하지 않습니다.</p>
 </div>;
}
export default function MessageTemplateManager({busy,request,act}:Props){
 const [open,setOpen]=useState(false),[result,setResult]=useState<any>(null),[selected,setSelected]=useState<Template|null>(null),[dry,setDry]=useState<any>(null),[notice,setNotice]=useState(''),[dirty,setDirty]=useState(false),[versions,setVersions]=useState<any[]>([]),[appOnly,setAppOnly]=useState(false);
 const operation=useRef<{fingerprint:string;id:string}|null>(null);
 const load=async(cursor?:string)=>{if(dirty&&!window.confirm('저장하지 않은 템플릿 편집을 닫고 목록을 새로 불러올까요?'))return;const next=await request('template-list',cursor?{cursor}:{});setResult(next);setSelected(null);setDirty(false);setVersions([]);};
 const command=(data:any)=>{const fingerprint=JSON.stringify(data);if(operation.current?.fingerprint!==fingerprint)operation.current={fingerprint,id:crypto.randomUUID()};return operation.current.id;};
 const applyRecord=(record:Template)=>{setSelected(record);setDirty(false);setVersions([]);setResult((old:any)=>({...old,records:old.records.map((r:Template)=>r.id===record.id?record:r)}));};
 const save=async(data:any)=>{if(!selected)return;const input={id:selected.id,revision:selected.revision,data};const next=await request('template-save',{...input,operationId:command(input)});applyRecord(next.record);setNotice(next.record.status==='app'?'앱에 저장했습니다.':'앱에 저장했습니다. 별도 동기화 서버가 Notion에 반영합니다.');};
 const resolve=async(choice:'app'|'notion')=>{if(!selected||!window.confirm(choice==='app'?'앱 내용을 유지하고 Notion에 다시 반영할까요?':'확인한 Notion 내용을 앱에 가져올까요?'))return;const input={id:selected.id,revision:selected.revision,remoteHash:selected.remoteHash,choice};const next=await request('template-resolve',{...input,operationId:command(input)});applyRecord(next.record);};
 return <section className="panel message-template-manager"><button type="button" className="small-button" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>문자 템플릿 영구 저장·동기화 {open?'닫기':'열기'}</button><div hidden={!open}>
  {open&&<TemplateCutoverPanel request={request} act={act} busy={busy} onStatus={setAppOnly}/>}
  <p className="text-sm">목록 조회·새로고침은 Notion 가져오기를 실행하지 않습니다.</p>{!appOnly&&<AutomaticImportControl kind="templates" request={request} act={act} busy={busy} onComplete={()=>load()}/>}
  <div className="message-template-toolbar"><button type="button" className="small-button" disabled={busy} onClick={()=>act(()=>load())}>앱 저장본 조회</button>{!appOnly&&<>
   <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>{const next=await request('template-dry-run',dry?.cursor?{cursor:dry.cursor}:{});setDry(next);setNotice('이번 페이지를 점검했습니다. 저장 변경은 없습니다.');})}>{dry?.cursor?'다음 페이지 dry-run':'이전 대상 dry-run'}</button>
   <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>{if(!window.confirm('Notion 템플릿을 최대 20개 가져와 앱에 저장할까요? 기존 앱 수정은 보호합니다.'))return;const next=await request('template-import-step',{confirmed:true});setNotice(`신규 ${next.counts.created} · 수정 ${next.counts.updated} · 동일 ${next.counts.unchanged} · 충돌 ${next.counts.conflict}${next.continue?' · 이어서 가져오기가 필요합니다.':' · 가져오기 완료'}`);await load();})}>Notion 변경 가져오기·이어서 실행</button>
   <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>{if(!window.confirm('원본 보관·접근 상태를 최대 5개 확인할까요? 확인되지 않은 자료는 삭제하지 않습니다.'))return;const next=await request('template-reconcile-step',{confirmed:true});setNotice(`원본 확인 ${next.counts.checked} · 확인 필요 ${next.counts.unknown}${next.continue?' · 이어서 점검이 필요합니다.':''}`);await load();})}>원본 상태 점검·이어서 실행</button></>}</div>
  {notice&&<p role="status" className="text-xs">{notice}</p>}
  {dry&&<div className="text-xs"><p>이번 페이지: 신규 {dry.counts.new} · 동일 {dry.counts.unchanged} · 갱신 {dry.counts.update} · 확인 필요 {dry.counts.review} · 쓰기 {dry.writes}</p>{dry.items.map((i:any)=><p key={i.id}>{i.title||'(제목 없음)'} · {i.decision}</p>)}</div>}
  {result&&<><p className="text-xs">화면 조회: {result.readMode==='firestore'?'Firestore':'기존 Notion'} · 최초 가져오기 {result.sync.ready?'완료':'미완료'} · {result.sync.phase}{result.sync.lastSuccessAt&&` · 마지막 성공 ${new Date(result.sync.lastSuccessAt).toLocaleString('ko-KR')}`}{result.sync.error&&` · ${result.sync.error}`}</p>
   <div className="message-template-grid"><div>{!result.records.length&&<p>앱에 저장된 템플릿이 없습니다.</p>}{result.records.map((r:Template)=><button type="button" key={r.id} className="message-template-row" aria-pressed={selected?.id===r.id} disabled={busy} onClick={()=>{if(dirty&&!window.confirm('저장하지 않은 편집을 닫고 다른 템플릿을 열까요?'))return;setSelected(r);setDirty(false);setVersions([]);}}>{r.title||'(제목 없음)'}<StatusBadge kind={kind(r.status)} text={r.status==='app'?'앱 저장':r.status==='conflict'?'충돌 확인':r.status==='synced'?'동기화 완료':r.status==='failed'?'동기화 실패':'반영 대기'}/>{r.archived&&' · 보관됨'}</button>)}</div>
    {selected&&<div key={selected.id+':'+selected.revision+':'+selected.status}><MessageTemplateEditor record={selected} busy={busy} appOnly={appOnly} onDirty={setDirty} onSave={v=>act(()=>save(v))} onRetry={()=>act(async()=>{await request('template-retry',{id:selected.id});await load();setNotice('동기화 작업을 다시 등록했습니다.');})} onResolve={v=>act(()=>resolve(v))}/>
     <button type="button" className="small-button" disabled={busy} onClick={()=>act(async()=>setVersions((await request('template-history',{id:selected.id})).records))}>최근 변경 이력 확인</button>
     {versions.map(v=><div key={v.revision} className="message-template-toolbar text-xs"><span>버전 {v.revision} · {v.data.title} · {v.reason}</span><button type="button" className="small-button" disabled={busy||selected.status==='conflict'||selected.archived||v.data.archived} onClick={()=>act(async()=>{if(!window.confirm(appOnly?'이 버전의 템플릿 이름과 본문을 새 수정으로 복원할까요?':'이 버전의 템플릿 이름과 본문을 새 수정으로 복원하고 동기화를 요청할까요?'))return;const input={id:selected.id,revision:selected.revision,historyRevision:v.revision};const next=await request('template-restore',{...input,operationId:command(input)});applyRecord(next.record);setNotice('이전 내용을 새 버전으로 저장했습니다.');})}>이 버전 복원 요청</button></div>)}</div>}</div>
   <div className="message-template-toolbar"><button type="button" className="small-button" disabled={busy} onClick={()=>act(()=>load())}>첫 페이지·상태 새로고침</button><button type="button" className="small-button" disabled={busy||!result.cursor} onClick={()=>act(()=>load(result.cursor))}>다음 페이지</button></div></>}
 </div></section>;
}

