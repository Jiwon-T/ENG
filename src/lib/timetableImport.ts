// 일정·시간표 › 엑셀 가져오기: the academy's weekly sheet (월–일 × 수업 / 자습(1,2차시) / Test(3차시), the same format as the
// export) read back into the teacher's classes. Cells are free text written by hand, so the reader is forgiving (no space
// before names, blank lines, 오전/오후 or none). Nothing is saved here: planImport only proposes; the dialog saves.
import {gradeOf,GRADE_ORDER} from './schoolGrade';
import {studentSubjectCampus} from './campus';

export interface SheetCells {weekday:number;lesson:string;study:string;test:string}
export interface ParsedLine {weekday:number;start:string;end:string;names:string[]}

const DAYS:Record<string,number>={일:0,월:1,화:2,수:3,목:4,금:5,토:6};
const TIME=/(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})\s*[:시.]\s*(\d{2})\s*분?\s*[~〜\-–]\s*(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})\s*[:시.]\s*(\d{2})\s*분?/g;
const pad=(n:number)=>String(n).padStart(2,'0');

/** A clock as written on the sheet → 'HH:MM'. Without 오전/오후, 1–8 are afternoon (the academy's hours), 9–11 are
 *  afternoon on weekdays and morning on 토·일, 12 is noon. */
export function sheetTime(hour:number,minute:number,weekday:number,mark?:string){
 const am=/오전|am/i.test(mark||''),pm=/오후|pm/i.test(mark||'');
 let h=hour%24;
 if(h<=12&&!am&&(pm?h<12:h<=8||(h<=11&&weekday>=1&&weekday<=5)))h+=12;
 if(am&&h===12)h=0;
 return `${pad(h%24)}:${pad(minute)}`;
}
/** Every "4:10~5:30" in a text with what follows it (up to the next time). */
function timeRanges(text:string,weekday:number){
 const found:{start:string;end:string;at:number;after:number}[]=[];
 for(const m of text.matchAll(TIME)){
  const start=sheetTime(Number(m[2]),Number(m[3]),weekday,m[1]);let end=sheetTime(Number(m[5]),Number(m[6]),weekday,m[4]||m[1]);
  if(end<=start&&!m[4]){const [eh,em]=end.split(':').map(Number);end=`${pad((eh+12)%24)}:${pad(em)}`;}
  found.push({start,end,at:m.index!,after:m.index!+m[0].length});
 }
 return found;
}
/** Korean names in a piece of text: split at commas, spaces and dots; grades like (중1) and empty bits dropped. */
export function namesIn(text:string){
 return text.replace(/\([^)]*\)/g,' ').split(/[,，、·/\s]+/).map(s=>s.replace(/[^가-힣a-zA-Z]/g,'')).filter(s=>/[가-힣]/.test(s)&&s.length>=2&&s.length<=5);
}

/** 수업 cells: each time line starts a lesson; names follow on the same line or the next ones. */
export function parseLessons(cell:string,weekday:number):ParsedLine[]{
 const out:ParsedLine[]=[];
 for(const raw of cell.split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const ranges=timeRanges(line,weekday);
  if(!ranges.length){if(out.length)out[out.length-1].names.push(...namesIn(line));continue;}
  ranges.forEach((r,i)=>out.push({weekday,start:r.start,end:r.end,names:namesIn(line.slice(r.after,ranges[i+1]?.at??line.length))}));
 }
 return out;
}
/** 자습 and Test cells: "5:30~6:30 김민준, 이서연", several on a line allowed ("…은준영6:00~7:00유재희"). */
export function parseEntries(cell:string,weekday:number):ParsedLine[]{
 const text=cell.replace(/\r?\n/g,' \n '),ranges=timeRanges(text,weekday);
 return ranges.map((r,i)=>({weekday,start:r.start,end:r.end,names:namesIn(text.slice(r.after,ranges[i+1]?.at??text.length))})).filter(l=>l.names.length);
}

/** The cells of the sheet: the row with 월…일 gives the columns, and the rows labelled 수업 / 자습 / Test (or 테스트) below it. */
export async function readSheetCells(file:ArrayBuffer|Uint8Array):Promise<SheetCells[]>{
 const {default:JSZip}=await import('jszip');
 const zip=await JSZip.loadAsync(file);
 const workbook=await zip.file('xl/workbook.xml')?.async('string')||'',rels=await zip.file('xl/_rels/workbook.xml.rels')?.async('string')||'';
 const firstId=workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1],target=firstId?rels.match(new RegExp(`Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1]||rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${firstId}"`))?.[1]:null;
 const path=target?('xl/'+target.replace(/^\/?xl\//,'').replace(/^\//,'')):'xl/worksheets/sheet1.xml';
 const sheet=await (zip.file(path)||zip.file('xl/worksheets/sheet1.xml'))?.async('string');
 if(!sheet)throw Error('시간표 시트를 찾지 못했어요.');
 const decode=(s:string)=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16))).replace(/&amp;/g,'&');
 const texts=(xml:string)=>[...xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map(m=>decode(m[1])).join('');
 const shared=[...((await zip.file('xl/sharedStrings.xml')?.async('string'))||'').matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(m=>texts(m[1].replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g,'')));
 const cells=new Map<string,string>();
 for(const m of sheet.matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)){
  const ref=m[1].match(/\br="([A-Z]+\d+)"/)?.[1],type=m[1].match(/\bt="(\w+)"/)?.[1],body=m[2]||'';if(!ref||!body)continue;
  const value=type==='s'?shared[Number(body.match(/<(?:\w+:)?v>(\d+)</)?.[1])]??'':type==='inlineStr'?texts(body):decode(body.match(/<(?:\w+:)?v>([\s\S]*?)</)?.[1]||'');
  if(value.trim())cells.set(ref,value);
 }
 const split=(ref:string)=>{const m=ref.match(/^([A-Z]+)(\d+)$/)!;return {col:m[1],row:Number(m[2])};};
 // The header row: the one with the most weekday names.
 const byRow=new Map<number,{col:string;day:number}[]>();
 for(const [ref,value] of cells){const day=DAYS[value.trim().charAt(0)];if(day===undefined||value.trim().length>8)continue;const {col,row}=split(ref);byRow.set(row,[...(byRow.get(row)||[]),{col,day}]);}
 const header=[...byRow.entries()].sort((a,b)=>b[1].length-a[1].length||a[0]-b[0])[0];
 if(!header||header[1].length<3)throw Error('월~일 머리 칸을 찾지 못했어요. 보내 주신 시간표 서식인지 확인해 주세요.');
 const labelRow=(re:RegExp,fallback:number)=>{for(const [ref,value] of cells){const {row,col}=split(ref);if(row>header[0]&&!header[1].some(h=>h.col===col)&&re.test(value.trim()))return row;}return header[0]+fallback;};
 const rows={lesson:labelRow(/^수업/,1),study:labelRow(/^자습/,2),test:labelRow(/^(test|테스트|시험)/i,3)};
 return header[1].map(({col,day})=>({weekday:day,lesson:cells.get(`${col}${rows.lesson}`)||'',study:cells.get(`${col}${rows.study}`)||'',test:cells.get(`${col}${rows.test}`)||''}));
}

/* ------------------------------------------------------------------ matching */

export interface NameMatch {raw:string;key:string|null;options:string[]}
export interface PlanLine {weekday:number;start:string;end:string;grade:string;names:NameMatch[];study:{start:string;end:string;names:string[]}[];tests:{weekday:number;start:string;end:string;names:string[]}[]}
export interface PlanClass {
 /** An existing class of mine, or null for a new one ('new:N' in `key`, for its fields). */
 classId:string|null;key?:string;name:string;status:'same'|'changed'|'new';changes:string[];
 lines:PlanLine[];
 /** What would be saved (save-class data); null for 'same'. */
 data:any|null;revision:number;notionEditedAt?:string;
}
/** A class of mine the sheet has no lesson line for. 'moved': every student has a lesson on the sheet in another class
 *  (the class was split or merged), so stopping it is suggested; 'missing': not on the sheet at all, left as it is unless
 *  the teacher stops it. `data` is what 중단 saves. */
export interface PlanOther {classId:string;name:string;reason:'moved'|'missing';students:string[];movedTo:string[];slots:string[];data:any;revision:number;notionEditedAt?:string}
/** What the teacher may set on a new class before saving (name, campus, subject). */
export interface NewClassFields {name?:string;campus?:string|null;subject?:string}
export interface ImportPlan {classes:PlanClass[];others:PlanOther[];skipped:number;unknown:NameMatch[];counts:{lessons:number;study:number;tests:number}}

const DAY_NAMES=['일','월','화','수','목','금','토'];
const shortOf=(name:string)=>name.replace(/\s*\(.*\)\s*$/,'').trim();
/** Students whose name is this one, else (when none) names differing in one letter — offered, never chosen by themselves. */
function matchName(raw:string,students:{key:string;short:string}[]):NameMatch{
 const exact=students.filter(s=>s.short===raw).map(s=>s.key);
 if(exact.length===1)return {raw,key:exact[0],options:exact};
 if(exact.length>1)return {raw,key:null,options:exact};
 const near=students.filter(s=>s.short.length===raw.length&&[...s.short].filter((ch,i)=>ch!==raw[i]).length===1).map(s=>s.key);
 return {raw,key:null,options:near};
}
const same=(a:string[],b:string[])=>a.length===b.length&&a.every(x=>b.includes(x));
const clean=(slot:any)=>JSON.stringify({w:slot.weekday,s:slot.start,e:slot.end,k:slot.kind==='test'?'test':'lesson',st:[...(slot.students||[])].sort(),sd:(slot.study||[]).map((b:any)=>[b.start,b.end,[...(b.students||[])].sort()]).sort()});

/**
 * Lessons, 자습 and tests read from the sheet → a proposal per class.
 * - Names: one exact student → chosen; several or none → `choices[raw]` (a key, or '' to leave out) decides.
 * - A lesson line goes to my class with exactly those students (its slot that weekday gets the time and 자습); otherwise a
 *   new class (lines with the same students share it). 자습 joins the student's lesson that weekday; a Test line joins the
 *   class that has its students, as a 3차시 line — one written for students of several classes is split, each student to
 *   their own class. Lines without names are skipped.
 * - Classes of mine with no line on the sheet come back as `others` (stopping one is the teacher's choice; the dialog saves it).
 * - `newNames`/`newFields` (by 'new:N'): the name, campus and subject the teacher gave a new class.
 */
export function planImport(cells:SheetCells[],data:any,choices:Record<string,string>={},newNames:Record<string,string>={},newFields:Record<string,NewClassFields>={}):ImportPlan{
 const students=(data.students||[]).map((s:any)=>({key:s.studentKey as string,short:shortOf(String(s.studentDisplayName||'')),name:String(s.studentDisplayName||'')}));
 const nameOf=(key:string)=>students.find((s:any)=>s.key===key)?.name||'';
 const unknown=new Map<string,NameMatch>();
 const resolve=(raw:string):NameMatch=>{const m=matchName(raw,students);if(m.key)return m;if(raw in choices)return {...m,key:choices[raw]||null};unknown.set(raw,m);return m;};
 let skipped=0;const counts={lessons:0,study:0,tests:0};
 const lessons:PlanLine[]=[];
 for(const c of cells)for(const l of parseLessons(c.lesson,c.weekday)){
  if(!l.names.length){skipped++;continue;}
  const names=l.names.map(resolve),keys=names.map(n=>n.key).filter(Boolean) as string[];
  const grade=[...new Set(keys.map(k=>gradeOf(nameOf(k))).filter(Boolean) as string[])].sort((a,b)=>GRADE_ORDER.indexOf(a)-GRADE_ORDER.indexOf(b)).join('·');
  lessons.push({weekday:l.weekday,start:l.start,end:l.end,grade,names,study:[],tests:[]});counts.lessons++;
 }
 const keysOf=(line:PlanLine)=>[...new Set(line.names.map(n=>n.key).filter(Boolean) as string[])];
 // 자습: to the lesson that weekday which has the student (the nearest in time when there are two).
 for(const c of cells)for(const e of parseEntries(c.study,c.weekday)){
  counts.study+=e.names.length;
  for(const raw of e.names){const key=resolve(raw).key;if(!key)continue;
   const options=lessons.filter(l=>l.weekday===e.weekday&&keysOf(l).includes(key)).sort((a,b)=>Math.abs(toMin(a.start)-toMin(e.start))-Math.abs(toMin(b.start)-toMin(e.start)));
   const line=options[0];if(!line)continue;
   const block=line.study.find(b=>b.start===e.start&&b.end===e.end);if(block){if(!block.names.includes(key))block.names.push(key);}else line.study.push({start:e.start,end:e.end,names:[key]});
  }
 }
 // Group lesson lines by their students: one class each.
 const mine=(data.classes||[]).filter((c:any)=>c.status!=='중단'&&!c.archived&&(c.ownerUid===data.uid||(c.assignedUids||[]).includes(data.uid)));
 const groups:{keys:string[];lines:PlanLine[];existing:any|null}[]=[];
 for(const line of lessons){const keys=keysOf(line);if(!keys.length)continue;
  let g=groups.find(g=>same(g.keys,keys));
  if(!g){g={keys,lines:[],existing:mine.find((c:any)=>same(c.students||[],keys))||null};groups.push(g);}
  g.lines.push(line);
 }
 // Test (3차시): to the group with all its students; else split, each student to their own group (the first that has them).
 for(const c of cells)for(const e of parseEntries(c.test,c.weekday)){
  counts.tests++;
  const keys=[...new Set(e.names.map(raw=>resolve(raw).key).filter(Boolean) as string[])];if(!keys.length)continue;
  const whole=groups.find(g=>keys.every(k=>g.keys.includes(k)));
  const parts=whole?[whole]:[...new Set(keys.map(k=>groups.find(g=>g.keys.includes(k))).filter(Boolean) as typeof groups)];
  for(const g of parts){const names=keys.filter(k=>g.keys.includes(k)&&(whole||groups.find(x=>x.keys.includes(k))===g)),target=g.lines[0];
   const test=target.tests.find(t=>t.weekday===e.weekday&&t.start===e.start&&t.end===e.end);if(test)test.names=[...new Set([...test.names,...names])];else target.tests.push({weekday:e.weekday,start:e.start,end:e.end,names});}
 }
 const subjectFor=(keys:string[])=>{const scopes=data.teachingScopes||data.scopes||[];const subjects=keys.map(k=>scopes.find((s:any)=>s.studentKey===k)?.subject).filter(Boolean);return subjects.includes('영어')||!subjects.length?'영어':subjects[0];};
 const classes:PlanClass[]=groups.map((g,index)=>{
  const lessonSlots=g.lines.map(l=>({weekday:l.weekday,start:l.start,end:l.end,kind:'lesson',study:l.study.map(b=>({start:b.start,end:b.end,students:same(b.names,g.keys)?undefined:b.names}))}));
  const testSlots=g.lines.flatMap(l=>l.tests).map(t=>({weekday:t.weekday,start:t.start,end:t.end,kind:'test',students:same(t.names,g.keys)?undefined:t.names}));
  const tidy=(s:any)=>{const out:any={...s};if(!out.study?.length)delete out.study;else out.study=out.study.map((b:any)=>{const x={...b};if(!x.students)delete x.students;return x;});if(!out.students)delete out.students;return out;};
  if(!g.existing){
   const grade=[...new Set(g.lines.map(l=>l.grade).filter(Boolean))].join('·'),first=students.find((s:any)=>s.key===g.keys[0])?.short||'학생';
   const auto=`${grade?grade+' ':''}${first}${g.keys.length>1?` 외 ${g.keys.length-1}명`:''}반`,key=`new:${index}`,set=newFields[key]||{};
   const name=(set.name??newNames[key]??auto).trim()||auto,subject=set.subject||subjectFor(g.keys);
   // campus: the teacher's pick, else the one campus every student takes this subject at
   const campuses=[...new Set(g.keys.map(k=>studentSubjectCampus(data.students,k,subject)))],campus=set.campus!==undefined?set.campus:campuses.length===1?campuses[0]:null;
   return {classId:null,key,name,status:'new',changes:g.lines.map(l=>`${DAY_NAMES[l.weekday]} ${l.start}~${l.end}`),lines:g.lines,revision:0,
    data:{name,status:'진행 중',subject,campus,students:g.keys,slots:[...lessonSlots,...testSlots].map(tidy),books:[]}};
  }
  // An existing class: the sheet's weekdays take the lesson slot of that weekday (time and 자습), and the 3차시 lines on the
  // sheet's test weekdays; every other slot stays as it was.
  const c=g.existing,old=(c.slots||[]) as any[],next=[...old],changes:string[]=[];
  for(const s of lessonSlots.map(tidy)){
   const at=next.findIndex(o=>o.kind!=='test'&&o.weekday===s.weekday&&o.status!=='중단');
   if(at<0){next.push(s);changes.push(`${DAY_NAMES[s.weekday]} 수업 추가 ${s.start}~${s.end}`);continue;}
   const o=next[at];if(o.start!==s.start||o.end!==s.end)changes.push(`${DAY_NAMES[s.weekday]} ${o.start}~${o.end} → ${s.start}~${s.end}`);
   else if(clean({...o,study:o.study||[]})!==clean({...s,study:s.study||[]}))changes.push(`${DAY_NAMES[s.weekday]} 자습 시간 바뀜`);
   next[at]={...o,start:s.start,end:s.end,study:s.study};if(!s.study)delete next[at].study;
  }
  const testDays=new Set(testSlots.map(t=>t.weekday));
  const keptTests=next.filter(o=>o.kind==='test'&&testDays.has(o.weekday));
  const newTests=testSlots.map(tidy);
  if(keptTests.length!==newTests.length||keptTests.some(o=>!newTests.some(t=>clean(t)===clean(o))))changes.push(...[...testDays].map(d=>`${DAY_NAMES[d]} 테스트 바뀜`));
  // an old test keeps its id (and status) only on the same weekday and time, and only once: two slots never share an id
  const reused=new Set<any>();
  const slots=[...next.filter(o=>!(o.kind==='test'&&testDays.has(o.weekday))),...newTests.map(t=>{const was=keptTests.find(o=>!reused.has(o)&&o.weekday===t.weekday&&o.start===t.start&&o.end===t.end);if(was)reused.add(was);return was?{...(was.id?{id:was.id}:{}),...(was.status?{status:was.status}:{}),...t}:t;})];
  const changed=changes.length>0;
  return {classId:c.id,name:c.name,status:changed?'changed':'same',changes,lines:g.lines,revision:c.revision||0,notionEditedAt:c.notionEditedAt,
   data:changed?saved(c,{slots:slots.slice(0,14)}):null};
 });
 // My classes the sheet has no line for: suggest 중단 when all their students are now in other classes on the sheet.
 const used=new Set(groups.map(g=>g.existing?.id).filter(Boolean)),onSheet=new Set(groups.flatMap(g=>g.keys));
 const others:PlanOther[]=mine.filter((c:any)=>!used.has(c.id)).map((c:any)=>{
  const keys:string[]=c.students||[],moved=keys.length>0&&keys.every(k=>onSheet.has(k));
  const movedTo=classes.filter((_,i)=>groups[i].keys.some(k=>keys.includes(k))).map(p=>p.name); // classes[i] is groups[i]
  return {classId:c.id,name:c.name,reason:moved?'moved':'missing',students:keys,movedTo,
   slots:(c.slots||[]).filter((s:any)=>s.kind!=='test'&&s.status!=='중단').map((s:any)=>`${DAY_NAMES[s.weekday]} ${s.start}`),
   data:saved(c,{status:'중단'}),revision:c.revision||0,notionEditedAt:c.notionEditedAt};
 });
 return {classes,others,skipped,unknown:[...unknown.values()],counts};
}
/** A class of mine as save-class takes it (books: only the saved fields), with some fields changed. */
function saved(c:any,change:any){
 return {name:c.name,status:c.status||'진행 중',subject:c.subject||'영어',campus:c.campus||null,students:c.students||[],slots:c.slots||[],
  books:(c.books||[]).map((b:any)=>({...(b.id?{id:b.id}:{}),...(b.linkedPlanId?{linkedPlanId:b.linkedPlanId}:{}),...(b.progress?{progress:b.progress}:{}),title:b.title,status:b.status})),...change};
}
const toMin=(t:string)=>{const [h,m]=t.split(':').map(Number);return h*60+m;};
