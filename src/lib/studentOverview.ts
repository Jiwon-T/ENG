import {isCurrentStudent} from './teacherLessonGrid';
import {GRADE_ORDER,gradeOf} from './schoolGrade';
export {gradeOf};

const day=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10):null;
const shortName=(name:string)=>name.replace(/\s*\(.*\)\s*$/,'').trim()||name;
const monthsBetween=(from:string,to:string)=>(Number(to.slice(0,4))-Number(from.slice(0,4)))*12+Number(to.slice(5,7))-Number(from.slice(5,7))-(Number(to.slice(8,10))<Number(from.slice(8,10))?1:0);

/** 학생 관리 overview, from the student list already loaded (no extra reads). A student's start is the earliest subject
 *  start date; a student who no longer studies any subject left on the latest subject end date. */
export function studentOverview(students:readonly any[],today:string,months=12){
 const current=students.filter(s=>isCurrentStudent(s));
 const startOf=(s:any)=>((s.subjects||[]).map((x:any)=>day(x.startDate)).filter(Boolean) as string[]).sort()[0]||null;
 const endOf=(s:any)=>isCurrentStudent(s)?null:((s.subjects||[]).map((x:any)=>day(x.endDate)).filter(Boolean) as string[]).sort().at(-1)||null;
 const keys:string[]=[];for(let i=months-1;i>=0;i--){const d=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1-i,1));keys.push(d.toISOString().slice(0,7));}
 const bars=keys.map(month=>({month,label:`${Number(month.slice(5,7))}월`,year:month.slice(0,4),joined:[] as string[],left:[] as string[]}));
 const byMonth=new Map(bars.map(b=>[b.month,b]));
 for(const s of students){const name=shortName(s.studentDisplayName||'학생');const start=startOf(s),end=endOf(s);
  if(start)byMonth.get(start.slice(0,7))?.joined.push(name);if(end)byMonth.get(end.slice(0,7))?.left.push(name);}
 const thisMonth=byMonth.get(today.slice(0,7))!;
 const subjectCounts=new Map<string,number>();for(const s of current)for(const x of s.subjects||[])if(x.status==='등록')subjectCounts.set(x.subject,(subjectCounts.get(x.subject)||0)+1);
 const gradeCounts=new Map<string,number>();let gradeUnknown=0;for(const s of current){const g=gradeOf(s.studentDisplayName||'');if(g)gradeCounts.set(g,(gradeCounts.get(g)||0)+1);else gradeUnknown++;}
 const tenures=current.map(s=>startOf(s)).filter(Boolean).map(start=>Math.max(0,monthsBetween(start as string,today)));
 const pets=students.filter(s=>isCurrentStudent(s)&&typeof s.look?.pet?.level==='number').sort((a,b)=>b.look.pet.level-a.look.pet.level).slice(0,3)
  .map(s=>({studentKey:s.studentKey,name:shortName(s.studentDisplayName||'학생'),pet:s.look.pet}));
 return {
  current:current.length,joinedThisMonth:thisMonth.joined.length,leftThisMonth:thisMonth.left.length,bars,
  missingStart:current.filter(s=>!startOf(s)).length,
  subjects:[...subjectCounts].map(([subject,count])=>({subject,count})).sort((a,b)=>b.count-a.count),
  // 고3 first, down to 초1.
  grades:[...GRADE_ORDER].reverse().filter(g=>gradeCounts.has(g)).map(grade=>({grade,count:gradeCounts.get(grade)!})),gradeUnknown,
  tenure:{known:tenures.length,overYear:tenures.filter(m=>m>=12).length,averageMonths:tenures.length?Math.round(tenures.reduce((a,b)=>a+b,0)/tenures.length*10)/10:null},
  pets,
 };
}

/** 중단 예약 per subject still 등록: due (the planned date has come) and upcoming (within the next 30 days). */
export function plannedStops(students:readonly any[],today:string){
 const soon=new Date(Date.parse(today+'T00:00:00Z')+30*86400000).toISOString().slice(0,10);
 const items=students.flatMap(s=>(s.subjects||[]).filter((x:any)=>x.status==='등록'&&day(x.plannedEndDate)).map((x:any)=>({studentKey:s.studentKey,name:shortName(s.studentDisplayName||'학생'),subject:x.subject,plannedEndDate:day(x.plannedEndDate) as string})))
  .sort((a,b)=>a.plannedEndDate.localeCompare(b.plannedEndDate)||a.name.localeCompare(b.name,'ko'));
 return {due:items.filter(i=>i.plannedEndDate<=today),upcoming:items.filter(i=>i.plannedEndDate>today&&i.plannedEndDate<=soon)};
}
/** The nearest 중단 예약 of one student, for list badges. */
export function plannedStopOf(student:any){return ((student?.subjects||[]).filter((x:any)=>x.status==='등록').map((x:any)=>day(x.plannedEndDate)).filter(Boolean) as string[]).sort()[0]||null;}
