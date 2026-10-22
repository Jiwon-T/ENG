import '../teacher/modalFrame.css';
import './examMaterialCatalog.css';
import React, {useEffect, useRef, useState} from 'react';
import {BookOpen, ChevronRight, ChevronLeft, Archive, CalendarDays, Copy, Edit3, FileSpreadsheet, Link2, Plus} from 'lucide-react';
import {addDoc, collection, doc, getDoc, onSnapshot, query, Timestamp, updateDoc, where} from 'firebase/firestore';
import {auth, db} from '../../lib/firebase';
import {ExamPeriod, examVisible, isPastExam, koreanToday, periodLabel, validateExam} from '../../lib/examMaterials';

type Book = {id:string;title:string;category?:string};
const blank = ():ExamPeriod => ({id:'',createdBy:auth.currentUser?.uid||'',school:'',grade:'',year:Number(koreanToday().slice(0,4)),semester:'1학기',exam:'중간고사',start:koreanToday(),end:koreanToday(),status:'준비 중',keepPublished:true,wordbookIds:[]});
export default function ExamMaterialCatalog<T extends Book>({books, manage=false, onOpen, onCreate, onBulkAdd}:{books:T[];manage?:boolean;onOpen:(b:T)=>void;onCreate?:()=>void;onBulkAdd?:()=>void}) {
  const [periods,setPeriods]=useState<ExamPeriod[]>([]),[school,setSchool]=useState(''),[grade,setGrade]=useState(''),[period,setPeriod]=useState('');
  const [editing,setEditing]=useState<ExamPeriod|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[linkSearch,setLinkSearch]=useState('');
  const [openedPeriodId,setOpenedPeriodId]=useState('');
  const interacted=useRef(false);
  const uid=auth.currentUser?.uid;
  useEffect(()=>{
    if(!uid)return;
    const q=manage?query(collection(db,'examMaterialPeriods'),where('createdBy','==',uid)):query(collection(db,'examMaterialPeriods'));
    return onSnapshot(q,s=>{setPeriods(s.docs.map(d=>({...d.data(),id:d.id} as ExamPeriod)));setLoading(false);setError('');},()=>{setError('시험기간을 불러오지 못했습니다. 연결과 접근 권한을 확인해 주세요.');setLoading(false);});
  },[uid,manage]);
  useEffect(()=>{
    if(manage||!uid)return;
    let active=true;
    getDoc(doc(db,'users',uid)).then(s=>{if(active&&!interacted.current){const p=s.data();setSchool(p?.school||p?.schoolName||'');setGrade(String(p?.grade||''));}}).catch(()=>{});
    return()=>{active=false;};
  },[uid,manage]);
  const available=periods.filter(p=>manage||examVisible(p)).sort((a,b)=>b.year-a.year||b.start.localeCompare(a.start));
  const schools=[...new Set(available.map(p=>p.school))].sort();
  const selectedSchool=schools.includes(school)?school:'';
  const grades=[...new Set(available.filter(p=>!selectedSchool||p.school===selectedSchool).map(p=>p.grade))].sort();
  const selectedGrade=grades.includes(grade)?grade:'';
  const filtered=available.filter(p=>(!selectedSchool||p.school===selectedSchool)&&(!selectedGrade||p.grade===selectedGrade));
  const effectivePeriod=filtered.some(p=>p.id===period)?period:'';
  const current=filtered.filter(p=>!isPastExam(p)),past=filtered.filter(p=>isPastExam(p));
  const linked=new Set(periods.flatMap(p=>p.wordbookIds));
  const unassigned=books.filter(b=>b.category==='exam'&&!linked.has(b.id));
  const field=<K extends keyof ExamPeriod>(key:K,value:ExamPeriod[K])=>setEditing(p=>p?{...p,[key]:value}:p);
  async function save(){
    if(!editing||busy)return;
    const message=validateExam(editing);if(message){setError(message);return;}
    setBusy(true);setError('');
    try {const {id,...data}=editing;const payload={...data,school:data.school.trim(),grade:data.grade.trim(),updatedAt:Timestamp.now()};
      if(id)await updateDoc(doc(db,'examMaterialPeriods',id),payload);else await addDoc(collection(db,'examMaterialPeriods'),{...payload,createdBy:uid,createdAt:Timestamp.now()});
      setEditing(null);
    }catch{setError('저장하지 못했습니다. 다시 시도해 주세요.');}finally{setBusy(false);}
  }
  function cards(rows:ExamPeriod[]){return rows.filter(p=>!effectivePeriod||p.id===effectivePeriod).map(p=><article key={p.id} className="exam-period-card">
    <button type="button" className="exam-period-select" onClick={()=>setOpenedPeriodId(p.id)} aria-label={`${p.school} ${p.grade} ${periodLabel(p)} 자료 보기`}>
    <span className="exam-card-heading"><span className="exam-grade-badge">{p.grade}</span><span className={`exam-status-badge ${isPastExam(p)?'past':p.status==='공개 중'?'published':'preparing'}`}>{isPastExam(p)?'지난 시험기간':p.status}</span></span>
    <span className="exam-school-name">{p.school}</span><span className="exam-period-name">{periodLabel(p)}</span>
    <span className="exam-period-dates">{p.start} ~ {p.end}</span>
    <span className="exam-period-open"><span className="exam-period-icon" aria-hidden="true"><BookOpen size={22}/></span><span>학습 자료 <strong>{p.wordbookIds.length}개</strong></span><ChevronRight size={20} aria-hidden="true"/></span>
    </button>
  </article>);}
  const openedPeriod=available.find(p=>p.id===openedPeriodId);
  const control='border rounded-lg p-2 bg-white';
  // 선생님 화면: the same look as the 단어장 tab (tools on the left, compact cards); students keep the larger catalogue.
  const newPeriod=()=>{setError('');setEditing({...blank(),school:selectedSchool,grade:selectedGrade});};
  const editPeriod=(p:ExamPeriod)=>{setError('');setEditing({...p,wordbookIds:[...p.wordbookIds]});};
  const copyPeriod=(p:ExamPeriod)=>{setError('');setEditing({...p,id:'',year:Number(koreanToday().slice(0,4)),start:koreanToday(),end:koreanToday(),status:'준비 중',wordbookIds:[...p.wordbookIds]});};
  const shownCurrent=current.filter(p=>!effectivePeriod||p.id===effectivePeriod);
  const shortDate=(d:string)=>d.slice(5).replace('-','.');
  const statusBadge=(p:ExamPeriod)=><span className={`exam-status-badge ${isPastExam(p)?'past':p.status==='공개 중'?'published':'preparing'}`}>{isPastExam(p)?'지난 기간':p.status}</span>;
  const tools=(linking?:ExamPeriod)=><div className="wordbook-tools flex flex-col gap-2">
    <button type="button" onClick={linking?()=>editPeriod(linking):newPeriod} className="rounded-[2.5rem] border-2 border-dashed flex items-center justify-center gap-4 transition-all group border-slate-200 text-slate-400 hover:border-pastel-pink-300 hover:text-pastel-pink-500 hover:bg-pastel-pink-50/30"><div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 text-slate-500 group-hover:bg-pastel-pink-100">{linking?<Link2 size={24}/>:<Plus size={24}/>}</div><span className="font-bold">{linking?'단어장 연결·해제':'시험기간 만들기'}</span></button>
    {onBulkAdd&&<button type="button" onClick={onBulkAdd} className="py-4 bg-emerald-50 text-emerald-600 rounded-3xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"><FileSpreadsheet size={18}/>텍스트 일괄 등록으로 단어장 만들기</button>}
    {onCreate&&<button type="button" onClick={onCreate} className="py-4 bg-amber-50 text-amber-700 rounded-3xl font-bold text-sm hover:bg-amber-100 transition-all flex items-center justify-center gap-2 border border-amber-100"><BookOpen size={18}/>새 시험 단어장 만들기</button>}
  </div>;
  const periodCard=(p:ExamPeriod)=><article key={p.id} className="exam-m-card">
    <button type="button" className="exam-m-open" onClick={()=>setOpenedPeriodId(p.id)} aria-label={`${p.school} ${p.grade} ${periodLabel(p)} 자료 보기`}>
      <span className="exam-m-top"><span className="exam-m-icon"><CalendarDays size={20}/></span>{statusBadge(p)}</span>
      <strong className="exam-m-title">{p.school} {p.grade}</strong><span className="exam-m-sub">{periodLabel(p)}</span>
    </button>
    <div className="exam-m-foot"><span>{shortDate(p.start)} ~ {shortDate(p.end)} · 자료 <b>{p.wordbookIds.length}</b>개</span><span className="exam-m-actions"><button type="button" title="기간·자료 관리" aria-label={`${p.school} ${p.grade} 기간·자료 관리`} onClick={()=>editPeriod(p)}><Edit3 size={15}/></button><button type="button" title="새 기간으로 복사" aria-label={`${p.school} ${p.grade} 새 기간으로 복사`} onClick={()=>copyPeriod(p)}><Copy size={15}/></button></span></div>
  </article>;
  const bookCard=(book:T,label:string)=><button type="button" key={book.id} className="exam-m-card exam-m-book" onClick={()=>onOpen(book)}>
    <span className="exam-m-top"><span className="exam-m-icon book"><BookOpen size={20}/></span><span className="exam-m-num">{label}</span></span>
    <strong className="exam-m-title">{book.title}</strong><span className="exam-m-foot"><span>단어장 열기</span><ChevronRight size={16} aria-hidden="true"/></span>
  </button>;
  const managedView=openedPeriod?<>
    <div className="exam-m-detail-head"><button type="button" className="exam-m-back" onClick={()=>setOpenedPeriodId('')}><ChevronLeft size={16}/>시험기간</button>
      <div className="exam-m-detail-title"><strong>{openedPeriod.school} {openedPeriod.grade}</strong><span>{periodLabel(openedPeriod)} · {shortDate(openedPeriod.start)} ~ {shortDate(openedPeriod.end)}</span>{statusBadge(openedPeriod)}</div>
      <span className="exam-m-actions"><button type="button" title="기간·자료 관리" aria-label="기간·자료 관리" onClick={()=>editPeriod(openedPeriod)}><Edit3 size={15}/></button><button type="button" title="새 기간으로 복사" aria-label="새 기간으로 복사" onClick={()=>copyPeriod(openedPeriod)}><Copy size={15}/></button></span></div>
    <div className="exam-m-grid">{tools(openedPeriod)}{openedPeriod.wordbookIds.map((id,index)=>{const book=books.find(b=>b.id===id);return book?bookCard(book,`자료 ${String(index+1).padStart(2,'0')}`):<p className="exam-m-empty" key={id}>사용할 수 없는 자료 · 연결 해제할 수 있어요</p>;})}{!openedPeriod.wordbookIds.length&&<p className="exam-m-empty">아직 연결된 단어장이 없어요. 왼쪽에서 연결해 주세요.</p>}</div>
  </>:<>
    <div className="exam-m-filters"><select aria-label="학교" value={selectedSchool} onChange={e=>{interacted.current=true;setSchool(e.target.value);setGrade('');setPeriod('');}}><option value="">전체 학교</option>{schools.map(s=><option key={s}>{s}</option>)}</select><select aria-label="학년" value={selectedGrade} onChange={e=>{interacted.current=true;setGrade(e.target.value);setPeriod('');}}><option value="">전체 학년</option>{grades.map(g=><option key={g}>{g}</option>)}</select><select aria-label="기간" value={effectivePeriod} onChange={e=>setPeriod(e.target.value)}><option value="">전체 기간</option>{filtered.map(p=><option key={p.id} value={p.id}>{periodLabel(p)} · {p.school} {p.grade}</option>)}</select></div>
    {error&&!editing&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="exam-m-grid">{tools()}{loading?<p className="exam-m-empty">시험기간 불러오는 중…</p>:shownCurrent.length?shownCurrent.map(periodCard):<p className="exam-m-empty">진행 중인 시험기간이 없어요. 왼쪽에서 만들어 주세요.</p>}</div>
    {past.length>0&&<details className="exam-m-fold" open={Boolean(period&&past.some(p=>p.id===period))}><summary><Archive size={16} aria-hidden="true"/>지난 시험기간 <span>{past.length}</span><ChevronRight className="exam-m-chevron" size={16} aria-hidden="true"/></summary><div className="exam-m-grid">{past.filter(p=>!effectivePeriod||p.id===effectivePeriod).map(periodCard)}</div></details>}
    {unassigned.length>0&&<details className="exam-m-fold"><summary><BookOpen size={16} aria-hidden="true"/>시험기간에 연결되지 않은 단어장 <span>{unassigned.length}</span><ChevronRight className="exam-m-chevron" size={16} aria-hidden="true"/></summary><div className="exam-m-grid">{unassigned.map(b=>bookCard(b,'미연결'))}</div></details>}
  </>;
  return <section className={`exam-material-catalog ${manage?'exam-manage':'space-y-4'}`}>{manage?managedView:<>
    <h2 className="text-2xl font-bold">시험기간 대비 단어장</h2>
    <div className="exam-filters"><label>학교 <select className={control} value={selectedSchool} onChange={e=>{interacted.current=true;setSchool(e.target.value);setGrade('');setPeriod('');setOpenedPeriodId('');}}><option value="">전체 학교</option>{schools.map(s=><option key={s}>{s}</option>)}</select></label><label>학년 <select className={control} value={selectedGrade} onChange={e=>{interacted.current=true;setGrade(e.target.value);setPeriod('');setOpenedPeriodId('');}}><option value="">전체 학년</option>{grades.map(g=><option key={g}>{g}</option>)}</select></label><label>기간 <select className={control} value={filtered.some(p=>p.id===period)?period:''} onChange={e=>{setPeriod(e.target.value);setOpenedPeriodId('');}}><option value="">전체 기간</option>{filtered.map(p=><option key={p.id} value={p.id}>{periodLabel(p)} · {p.school} {p.grade}</option>)}</select></label></div>
    {openedPeriod&&<section className="exam-period-detail"><button type="button" className="exam-back" onClick={()=>setOpenedPeriodId('')}>← 시험기간 목록으로</button><div className="exam-detail-heading"><span className="exam-grade-badge">{openedPeriod.grade}</span><h3>{openedPeriod.school}</h3><p>{periodLabel(openedPeriod)}</p><span className="exam-period-dates">{openedPeriod.start} ~ {openedPeriod.end}</span></div><div className="exam-wordbook-grid">{openedPeriod.wordbookIds.map((id,index)=>{const book=books.find(b=>b.id===id);return book?<button type="button" key={id} className="exam-wordbook-card" onClick={()=>onOpen(book)}><span className="exam-book-icon" aria-hidden="true"><BookOpen size={26}/></span><span className="exam-book-number">자료 {String(index+1).padStart(2,'0')}</span><strong>{book.title}</strong><span className="exam-book-cta">{manage?'자료 열기':'학습 시작'} <ChevronRight size={20} aria-hidden="true"/></span></button>:manage?<p className="exam-missing-material" key={id}>사용할 수 없는 자료 · 기간 관리에서 연결 해제 가능</p>:null;})}</div>{!openedPeriod.wordbookIds.length&&<p className="exam-missing-material">연결된 자료가 없습니다. 기간·자료 관리에서 연결해 주세요.</p>}</section>}
    <div hidden={Boolean(openedPeriod)}>{error&&<p role="alert" className="text-red-600">{error}</p>}{loading?<p>시험기간 불러오는 중…</p>:<><div className="exam-period-grid">{cards(current)}</div>{!current.length&&<p className="text-slate-500">선택한 학교·학년의 현재 시험기간이 없습니다.</p>}<details className="exam-archive" open={Boolean(period&&past.some(p=>p.id===period))}><summary><span className="exam-archive-icon" aria-hidden="true"><Archive size={22}/></span><span>지난 시험기간 <span className="exam-archive-count">{past.length}</span></span><ChevronRight className="exam-archive-chevron" size={20} aria-hidden="true"/></summary><p className="exam-archive-description">과거 자료를 보관하며, 다시 열거나 다음 시험기간에 재사용할 수 있습니다.</p><div className="exam-period-grid">{cards(past)}</div></details></>}
    {unassigned.length>0&&<details><summary className="cursor-pointer font-bold">시험기간 미지정 자료 ({unassigned.length})</summary><div className="grid sm:grid-cols-2 gap-2 mt-3">{unassigned.map(b=><button className={control+' text-left'} key={b.id} onClick={()=>onOpen(b)}>{b.title} →</button>)}</div></details>}
    </div></>}
    {editing&&<div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><form role="dialog" aria-modal="true" aria-label="시험기간 관리" onSubmit={e=>{e.preventDefault();void save();}} className="teacher-modal-shell teacher-exam-modal bg-white rounded-2xl w-full max-w-2xl max-h-[90vh]"><div className="teacher-modal-scroll space-y-4">
      <h3 className="text-xl font-bold">{editing.id?'시험기간 수정':'시험기간 만들기'}</h3><div className="grid sm:grid-cols-2 gap-3">
      <label>학교<input required className={control+' w-full'} value={editing.school} onChange={e=>field('school',e.target.value)} placeholder="예: 용죽고"/></label><label>학년<input required className={control+' w-full'} value={editing.grade} onChange={e=>field('grade',e.target.value)} placeholder="예: 1학년"/></label>
      <label>연도<input type="number" min="2000" max="2200" required className={control+' w-full'} value={editing.year} onChange={e=>field('year',Number(e.target.value))}/></label><label>학기<select className={control+' w-full'} value={editing.semester} onChange={e=>field('semester',e.target.value)}><option>1학기</option><option>2학기</option></select></label>
      <label>시험<select className={control+' w-full'} value={editing.exam} onChange={e=>field('exam',e.target.value)}><option>중간고사</option><option>기말고사</option></select></label><label>공개 상태<select className={control+' w-full'} value={editing.status} onChange={e=>field('status',e.target.value as ExamPeriod['status'])}><option>준비 중</option><option>공개 중</option><option>종료</option></select></label>
      <label>준비 시작일<input required type="date" className={control+' w-full'} value={editing.start} onChange={e=>field('start',e.target.value)}/></label><label>종료일<input required type="date" className={control+' w-full'} value={editing.end} onChange={e=>field('end',e.target.value)}/></label></div>
      <label className="flex gap-2"><input type="checkbox" checked={editing.keepPublished} onChange={e=>field('keepPublished',e.target.checked)}/>종료 후에도 학생에게 지난 시험기간 자료 공개</label>
      <p className="text-sm text-slate-500">단어장은 여러 기간에 연결할 수 있습니다. 연결 해제는 원본 자료를 삭제하지 않습니다. 공유된 단어장을 수정하면 연결된 모든 기간에 반영됩니다.</p>
      <label>연결할 자료 검색<input className={control+' w-full'} value={linkSearch} onChange={e=>setLinkSearch(e.target.value)}/></label><div className="max-h-48 overflow-auto space-y-2">{books.filter(b=>b.title.toLowerCase().includes(linkSearch.toLowerCase())).map(b=><label key={b.id} className="flex gap-2"><input type="checkbox" checked={editing.wordbookIds.includes(b.id)} onChange={e=>field('wordbookIds',e.target.checked?[...editing.wordbookIds,b.id]:editing.wordbookIds.filter(id=>id!==b.id))}/>{b.title}</label>)}</div>
      {error&&<p role="alert" className="text-red-600">{error}</p>}<div className="flex gap-3"><button disabled={busy} className="primary-button">{busy?'저장 중…':'저장'}</button><button type="button" className="small-button" disabled={busy} onClick={()=>setEditing(null)}>닫기</button></div>
    </div></form></div>}
  </section>;
}

