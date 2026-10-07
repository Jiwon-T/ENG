import {excelTextParts,lessonExcelWidths,lessonExcelFontSizes,lessonExcelRowHeight} from './lessonExcelLayout';
import JSZip from 'jszip';
import {compareLessonReview,validLessonDay} from './lessonReview';

export function excelStudentName(name:string) {
 const m=/^(.+?)\s*\((.+?)([1-6])\)$/.exec(name);
 return m?`${m[3]}${m[2].trim().replace(/(?:고등학교|중학교|초등학교|고|중|초)$/,'')} ${m[1].trim()}`:name;
}
export function lessonExcelFilename(day:string,teacher:string) {
 if(!validLessonDay(day))throw Error('수업 날짜를 확인해 주세요.');
 const safe=teacher.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim().slice(0,80)||'선생님';
 return `${day}_${safe}_수업일지.xlsx`;
}
export function lessonExcelCells(record:any):string[] {
 const d=record.data,round=d.round!=null?` (${d.round})`:'';
 const time=d.classSession==='없음'?'수업 없음':`${d.start||'미입력'}-${d.end||'미입력'}${round}${String(d.attendance||'').startsWith('보강')?'-보강':''}`;
 const study=d.selfStudy==='있음'?`${d.selfStudyStart||'미입력'}-${d.selfStudyEnd||'미입력'}${d.selfStudyRound!=null?` (${d.selfStudyRound})`:''}`:d.selfStudy==='없음'?'.':'미확인';
 const learning=[d.content,d.assignment&&`과제: ${d.assignment}`,d.examScope&&`시험범위: ${d.examScope}`,d.note&&`피드백: ${d.note}`,d.nextPlan&&`다음 계획: ${d.nextPlan}`,d.total>0&&`일반 테스트: ${d.correct??'미입력'}/${d.total}`,d.examTotal>0&&`내신 대비 테스트: ${d.examCorrect??'미입력'}/${d.examTotal}`].filter(Boolean).join('\n');
 const attendance=d.attendance==='지각'||d.attendance==='보강 지각'?'지각':d.attendance==='결석'||d.attendance==='보강 결석'?'결석':'';
 const attendanceMemo=d.attendanceNote?`출결 메모: ${d.attendanceNote}`:'';
 return [excelStudentName(record.studentDisplayName||'학생'),time,study,learning||'.',attendance,[d.specialNote,attendanceMemo].filter(Boolean).join('\n')||'.'];
}
function xml(value:string) {
 // All exported values are literal strings, including leading =, +, - and @.
 return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
const cell=(address:string,style:number,value:string)=>`<x:c r="${address}" s="${style}" t="inlineStr"><x:is><x:t xml:space="preserve">${xml(value)}</x:t></x:is></x:c>`;
const row=(n:number,height:number,cells:string)=>`<x:row r="${n}" ht="${height}" customHeight="1">${cells}</x:row>`;
/** Fill the sanitized reference workbook in the browser; no spreadsheet service required. */
export async function buildLessonExcel(template:ArrayBuffer|Uint8Array,day:string,teacher:string,records:any[]) {
 lessonExcelFilename(day,teacher);
 if(records.some(r=>r.data?.date!==day))throw Error('선택한 날짜의 일지만 내보낼 수 있습니다.');
 const zip=await JSZip.loadAsync(template);
 const sheet=zip.file('xl/worksheets/sheet1.xml');
 if(!sheet)throw Error('엑셀 서식을 불러오지 못했습니다.');
 const sorted=[...records].sort(compareLessonReview), date=new Date(day+'T00:00:00Z');
 const label=`${date.getUTCMonth()+1}월 ${date.getUTCDate()}일 (${['일','월','화','수','목','금','토'][date.getUTCDay()]})`;
 const names=[...new Set(sorted.map(r=>excelStudentName(r.studentDisplayName||'학생')))];
 const roster=names.join(', ');
 let body=row(1,14.65,cell('F1',8,teacher))+row(2,22,cell('F2',8,roster.length<=32767?roster:`총 ${names.length}명 (전체 학생 이름은 아래 일지에 표시)`))+row(3,17.4,cell('B3',9,label));
 const headers=['학생 이름','수업 시간 (회차)','자습 시간','학습 내용','지각, 결석','특이사항'],cols=['B','C','D','E','F','G'];
 body+=row(4,43.5,headers.map((v,i)=>cell(cols[i]+'4',[1,2,2,1,5,6][i],v)).join(''));
 let n=5;
 for(const r of sorted){
  const pieces=lessonExcelCells(r).map((value,i)=>excelTextParts(value,lessonExcelWidths[i],lessonExcelFontSizes[i]));
  for(let part=0;part<Math.max(...pieces.map(p=>p.length));part++,n++){
  if(n>1048576)throw Error('엑셀의 최대 행 수를 초과했습니다. 학생 조건으로 나누어 내보내 주세요.');
  const values=pieces.map(p=>p[part]||'');
  body+=row(n,lessonExcelRowHeight(values),values.map((v,c)=>cell(cols[c]+n,[10,11,11,12,11,13][c],v)).join(''));
  }
 }
 const source=await sheet.async('string');
 zip.file('xl/worksheets/sheet1.xml',source.replace(/<x:sheetData>[\s\S]*?<\/x:sheetData>/,`<x:sheetData>${body}</x:sheetData>`));
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}

export async function downloadLessonExcel(result:{day:string;teacherName:string;records:any[]}) {
 if(!result.records.length)throw Error('선택한 날짜·선생님·학생 조건에 해당하는 일지가 없습니다.');
 const response=await fetch('/templates/lesson-log.xlsx');
 if(!response.ok)throw Error('엑셀 서식을 불러오지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.');
 const bytes=await buildLessonExcel(await response.arrayBuffer(),result.day,result.teacherName,result.records);
 const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=lessonExcelFilename(result.day,result.teacherName);a.click();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
