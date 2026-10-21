import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Download,Printer,Upload} from 'lucide-react';
import {doc,getDoc} from 'firebase/firestore';
import {auth,db} from '../../lib/firebase';
import {saveBlob,printFooter} from '../../lib/printFrame';
import {addCalendarDays,koreanDay,mondayOfWeek} from '../../lib/teacherWeekCalendar';
import {buildTimetableExcel,isLessonTime,timetableFilename,timetableSheet,type TimetableBase,type TimetableSheet} from '../../lib/timetableSheet';
import {PrintPage,PrintPortal} from '../print/PrintSheet';
import {readSheetCells,type SheetCells} from '../../lib/timetableImport';
import TimetableImport from './TimetableImport';
import './timetableExport.css';

const NAME_KEY='timetable-teacher';
const savedName=()=>{try{return localStorage.getItem(NAME_KEY);}catch{return null;}};

/** The printed sheet: the same table as the Excel file (A4 landscape). */
function TimetablePrintTable({sheet}:{sheet:TimetableSheet}){
 return <table className="tt-sheet"><thead><tr><th/>{sheet.days.map(d=><th key={d.date}>{d.label}</th>)}</tr></thead>
  <tbody>{([['수업','lesson'],['자습\n(1,2차시)','study'],['Test\n(3차시)','test']] as const).map(([label,key])=><tr key={key} className={`tt-row-${key}`}><th>{label}</th>{sheet.days.map(d=><td key={d.date}>{key==='lesson'?d.lesson.map((line,i)=><span key={i}>{i>0&&'\n'}{isLessonTime(line)?<b>{line}</b>:line}</span>):d[key].join('\n')}</td>)}</tr>)}</tbody></table>;
}

/**
 * 일정·시간표 › 내보내기: the academy's weekly sheet (월–일 × 수업 / 자습 / Test) as Excel in its own format, or printed.
 * 정규 시간표 = the classes' regular lines; 이번 주 = one week with its 휴강·보강·자습·테스트. Only the teacher's own classes.
 * 가져오기 (its own button, apart from the 내보내기 one) reads such a sheet back into the classes (a preview first; see
 * TimetableImport).
 */
export default function TimetableExport({data,disabled,request,onImported,onRegister}:{data:any;disabled?:boolean;request:(action:string,body?:any)=>Promise<any>;onImported:()=>Promise<void>|void;/** 원장님·관리자: open 상담·신입생 등록 with a name the import could not find. */onRegister?:(name:string)=>void}){
 const [open,setOpen]=useState(false),[base,setBase]=useState<TimetableBase>('regular'),[week,setWeek]=useState(()=>mondayOfWeek(koreanDay()));
 const [teacher,setTeacher]=useState(()=>savedName()??''),[printing,setPrinting]=useState<TimetableSheet|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const box=useRef<HTMLDivElement>(null),picker=useRef<HTMLInputElement>(null),[importing,setImporting]=useState<{fileName:string;cells:SheetCells[]}|null>(null),[pickError,setPickError]=useState('');
 const pick=async(file?:File)=>{if(!file)return;setPickError('');
  try{const cells=await readSheetCells(await file.arrayBuffer());setOpen(false);setImporting({fileName:file.name,cells});}
  catch(e:any){setPickError(e?.message&&/[가-힣]/.test(e.message)?e.message:'엑셀 파일을 읽지 못했어요. 보내 주신 시간표 서식(.xlsx)인지 확인해 주세요.');}
  finally{if(picker.current)picker.current.value='';}};
 // The name on the sheet ("이지원 T"): the one typed here before, else the account's name.
 useEffect(()=>{if(savedName()!==null||!auth.currentUser)return;let live=true;
  void getDoc(doc(db,'users',auth.currentUser.uid)).then(snap=>{const p:any=snap.data()||{},name=String(p.alias||p.name||'').trim();if(live&&name)setTeacher(/(T|쌤|선생님)$/.test(name)?name:`${name} T`);}).catch(()=>{});
  return()=>{live=false;};},[]);
 useEffect(()=>{if(!open&&!pickError)return;const close=()=>{setOpen(false);setPickError('');};const outside=(e:PointerEvent)=>{if(box.current&&!box.current.contains(e.target as Node))close();};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[open,pickError]);
 const name=(value:string)=>{setTeacher(value);try{localStorage.setItem(NAME_KEY,value);}catch{}};
 const sheet=()=>timetableSheet(data,base,base==='week'?week:koreanDay(),teacher);
 const empty=(s:TimetableSheet)=>s.days.every(d=>!d.lesson.length&&!d.study.length&&!d.test.length);
 const excel=async()=>{
  const s=sheet();if(empty(s)){setMessage('넣을 수업이 없어요. 반 관리에서 내 반의 정규 시간을 확인해 주세요.');return;}
  setBusy(true);setMessage('');
  try{const r=await fetch('/templates/timetable.xlsx');if(!r.ok)throw Error();const file=await buildTimetableExcel(await r.arrayBuffer(),s);
   saveBlob(new Blob([file as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),timetableFilename(s));setOpen(false);}
  catch{setMessage('엑셀 파일을 만들지 못했어요. 다시 시도해 주세요.');}
  finally{setBusy(false);}
 };
 const print=()=>{const s=sheet();if(empty(s)){setMessage('넣을 수업이 없어요. 반 관리에서 내 반의 정규 시간을 확인해 주세요.');return;}setMessage('');setOpen(false);setPrinting(s);};
 const md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
 return <div className="tt-export" ref={box}>
  <button type="button" className="small-button tt-export-button" disabled={disabled} onClick={()=>{setOpen(false);setPickError('');picker.current?.click();}}><Upload size={15} aria-hidden="true"/>가져오기</button>
  <input ref={picker} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden aria-label="시간표 엑셀 파일" onChange={e=>void pick(e.target.files?.[0])}/>
  <button type="button" className="small-button tt-export-button" disabled={disabled} aria-expanded={open} onClick={()=>{setMessage('');setPickError('');setOpen(o=>!o);}}><Download size={15} aria-hidden="true"/>엑셀·인쇄</button>
  {pickError&&!open&&<div className="tt-export-pop" role="alert"><p className="tt-export-error">{pickError}</p></div>}
  {open&&<div className="tt-export-pop" role="dialog" aria-label="시간표 내보내기">
   <div className="lesson-mode-switch" role="group" aria-label="기준">{([['regular','정규 시간표'],['week','이번 주']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={base===key} onClick={()=>setBase(key)}>{label}</button>)}</div>
   {base==='week'&&<div className="tt-export-week"><button type="button" aria-label="이전 주" onClick={()=>setWeek(w=>addCalendarDays(w,-7))}><ChevronLeft size={15} aria-hidden="true"/></button><span>{md(week)}~{md(addCalendarDays(week,6))}</span><button type="button" aria-label="다음 주" onClick={()=>setWeek(w=>addCalendarDays(w,7))}><ChevronRight size={15} aria-hidden="true"/></button></div>}
   <label className="tt-export-name">표시 이름<input value={teacher} maxLength={30} placeholder="이지원 T" onChange={e=>name(e.target.value)}/></label>
   <p className="tt-export-note">{base==='week'?'이 주의 휴강·보강·자습·테스트까지 반영해요':'반 관리의 정규 시간 그대로예요'} · 내 반만 · 같은 시간 자습은 한 줄</p>
   {message&&<p className="tt-export-error" role="alert">{message}</p>}
   <div className="tt-export-actions"><button type="button" className="small-button" disabled={busy} onClick={()=>void excel()}><Download size={14} aria-hidden="true"/>{busy?'만드는 중…':'Excel'}</button><button type="button" className="primary-button" onClick={print}><Printer size={14} aria-hidden="true"/>인쇄</button></div>
  </div>}
  {importing&&<TimetableImport fileName={importing.fileName} cells={importing.cells} data={data} request={request} onSaved={onImported} onRegister={onRegister?name=>{setImporting(null);onRegister(name);}:undefined} onClose={()=>setImporting(null)}/>}
  <PrintPortal active={Boolean(printing)} orientation="landscape" onDone={()=>setPrinting(null)}>
   {printing&&<PrintPage title={printing.title} subtitle={printing.teacher} number={1} footer={printFooter()}><TimetablePrintTable sheet={printing}/></PrintPage>}
  </PrintPortal>
 </div>;
}
