// 일정·시간표 › 내보내기: the weekly sheet the teachers used to send the principal by hand ("10월 시간표.xlsx"):
// 월–일 columns and three rows — 수업 (time, grade, students), 자습 (1,2차시) and Test (3차시). Built from the teacher's own
// classes; '이번 주' also applies that week's dated schedules (휴강 removes a lesson, 보강·자습·테스트 add lines).
// Shared by the Excel export and the print view, so the two always match.
import {gradeOf,GRADE_ORDER} from './schoolGrade';
import {slotStudents,slotStudy} from './teacherTodayLessons';
import {calendarWeek} from './teacherWeekCalendar';

export type TimetableBase='regular'|'week';
export interface TimetableDay {label:string;date:string;lesson:string[];study:string[];test:string[]}
export interface TimetableSheet {title:string;teacher:string;days:TimetableDay[]}

const DAY_NAMES=['일','월','화','수','목','금','토'];
/** '16:10' → '4:10' (the sheet writes afternoon times without 오후, as the academy does). */
export const sheetClock=(value:string)=>{const [h,m]=value.split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?`${h%12||12}:${String(m).padStart(2,'0')}`:value;};
const range=(start:string,end:string)=>`${sheetClock(start)}~${sheetClock(end)}`;
const overlaps=(a:{start:string;end:string},b:{start:string;end:string})=>a.start<b.end&&b.start<a.end;

interface Lesson {start:string;end:string;students:string[];from?:string}
interface Entry {start:string;end:string;student:string;from?:string}

/** The sheet for the week of `weekDate` (any day in it). */
export function timetableSheet(data:any,base:TimetableBase,weekDate:string,teacher:string):TimetableSheet {
 const names=new Map<string,string>((data.students||[]).map((s:any)=>[s.studentKey,String(s.studentDisplayName||'학생')]));
 const short=(key:string)=>(names.get(key)||'학생').replace(/\s*\(.*\)\s*$/,'').trim();
 const grades=(keys:string[])=>[...new Set(keys.map(key=>gradeOf(names.get(key)||'')).filter(Boolean) as string[])].sort((a,b)=>GRADE_ORDER.indexOf(a)-GRADE_ORDER.indexOf(b)).join('·');
 const mine=(data.classes||[]).filter((c:any)=>c.status!=='중단'&&(c.ownerUid===data.uid||(c.assignedUids||[]).includes(data.uid)));
 const schedules=base==='week'?(data.schedules||[]).filter((r:any)=>!r.archived&&!r.deleteRequested&&r.ownerUid===data.uid&&['예정','변경','완료'].includes(r.data?.status)):[];
 const dates=calendarWeek(weekDate);
 const days=dates.map(date=>{
  const weekday=new Date(`${date}T00:00:00Z`).getUTCDay(),lessons:Lesson[]=[],study:Entry[]=[],tests:Entry[]=[];
  for(const c of mine)(c.slots||[]).forEach((slot:any,i:number)=>{
   if(slot.status==='중단'||slot.weekday!==weekday||!slot.start||!slot.end)return;
   const students=slotStudents(c,slot),from=`${c.id}:${slot.id||i}`;
   if(slot.kind==='test'){for(const student of students)tests.push({start:slot.start,end:slot.end,student});return;}
   lessons.push({start:slot.start,end:slot.end,students,from});
   for(const [student,block] of Object.entries(slotStudy(c,slot)))study.push({...block,student,from});
  });
  for(const r of schedules.filter((r:any)=>r.data.date===date&&r.data.start&&r.data.end)){
   const d=r.data,students:string[]=[...new Set<string>(d.students||[])];
   if(d.kind==='휴강'){
    // A 휴강 takes out the regular lessons it overlaps for its students, with their 자습 from those lessons.
    for(const lesson of lessons.filter(l=>l.from&&overlaps(l,d))){
     const off=students.length?lesson.students.filter(key=>students.includes(key)):lesson.students;
     lesson.students=lesson.students.filter(key=>!off.includes(key));
     for(let k=study.length-1;k>=0;k--)if(study[k].from===lesson.from&&off.includes(study[k].student))study.splice(k,1);
    }
    for(let k=lessons.length-1;k>=0;k--)if(lessons[k].from&&!lessons[k].students.length)lessons.splice(k,1);
   }
   else if(d.kind==='상담')continue; // not a lesson: off the sheet
   else if(d.kind==='자습')for(const student of students)study.push({start:d.start,end:d.end,student});
   else if(d.kind==='테스트'||d.kind==='시험')for(const student of students)tests.push({start:d.start,end:d.end,student});
   else lessons.push({start:d.start,end:d.end,students});
  }
  // 자습 and Test: the same time is one line ("5:50~6:50 김민준, 이서연").
  const grouped=(list:Entry[])=>{const by=new Map<string,Entry[]>();for(const e of list){const key=`${e.start}-${e.end}`;by.set(key,[...(by.get(key)||[]),e]);}
   return [...by.values()].sort((a,b)=>a[0].start.localeCompare(b[0].start)||a[0].end.localeCompare(b[0].end)).map(group=>`${range(group[0].start,group[0].end)} ${[...new Set(group.map(e=>short(e.student)))].join(', ')}`);};
  return {
   label:base==='week'?`${DAY_NAMES[weekday]} ${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`:DAY_NAMES[weekday],date,
   lesson:lessons.sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end)).flatMap(l=>{const g=grades(l.students);return [`${range(l.start,l.end)}${g?` (${g})`:''}`,l.students.map(short).join(', ')];}),
   study:grouped(study),test:grouped(tests),
  };
 });
 const [first,last]=[dates[0],dates[6]],md=(d:string)=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`;
 return {title:base==='week'?`${md(first)}~${md(last)} 시간표`:`${Number(weekDate.slice(5,7))}월 시간표`,teacher:teacher.trim(),days};
}

export function timetableFilename(sheet:TimetableSheet){
 const safe=(v:string)=>v.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim().slice(0,60);
 return `${safe(sheet.title)}${sheet.teacher?`_${safe(sheet.teacher)}`:''}.xlsx`;
}

const xml=(value:string)=>value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cell=(ref:string,style:number,value='')=>value?`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`:`<c r="${ref}" s="${style}"/>`;
const COLUMNS=['C','D','E','F','G','H','I'];
/** Rows grow with the longest cell (the template's heights are the minimum), 13.5pt a line. */
const height=(min:number,cells:string[][])=>Math.max(min,Math.max(0,...cells.map(lines=>lines.length))*13.5+8);

/** Fills the template (public/templates/timetable.xlsx: the academy's sheet with its styles, no data) with the sheet.
 *  Styles from the template: 9 teacher (right), 1 corner, 2 day header, 3 수업 label, 6 자습·Test label, 4 body. */
export async function buildTimetableExcel(template:ArrayBuffer|Uint8Array,sheet:TimetableSheet){
 const {default:JSZip}=await import('jszip');
 const zip=await JSZip.loadAsync(template),file=zip.file('xl/worksheets/sheet1.xml');
 if(!file)throw Error('시간표 서식 파일을 읽지 못했어요.');
 const source=await file.async('string');
 const rows=[
  `<row r="2">${cell('C2',0,sheet.title)}${cell('I2',9,sheet.teacher)}</row>`,
  `<row r="3">${cell('B3',1)}${sheet.days.map((d,i)=>cell(`${COLUMNS[i]}3`,2,d.label)).join('')}</row>`,
  ...([['수업','lesson',3,174.65],['자습\n(1,2차시)','study',6,125.25],['Test\n(3차시)','test',6,108.75]] as const).map(([label,key,style,min],k)=>{
   const r=4+k,lines=sheet.days.map(d=>d[key]);
   return `<row r="${r}" ht="${height(min,lines).toFixed(2)}" customHeight="1">${cell(`B${r}`,style,label)}${lines.map((l,i)=>cell(`${COLUMNS[i]}${r}`,4,l.join('\n'))).join('')}</row>`;
  }),
 ];
 if(!/<sheetData\s*\/>|<sheetData>[\s\S]*?<\/sheetData>/.test(source))throw Error('시간표 서식 파일을 읽지 못했어요.');
 zip.file('xl/worksheets/sheet1.xml',source.replace(/<sheetData\s*\/>|<sheetData>[\s\S]*?<\/sheetData>/,`<sheetData>${rows.join('')}</sheetData>`));
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
