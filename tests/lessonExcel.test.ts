import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import JSZip from 'jszip';
import {buildLessonExcel,lessonExcelCells,lessonExcelFilename} from '../src/lib/lessonExcel.ts';
import {compareLessonReview,validLessonDay} from '../src/lib/lessonReview.ts';
const day='2026-09-29';
const record=(id:string,start:string,date=day)=>({id,studentDisplayName:'이현준 (용죽고1)',data:{date,start,end:'20:10',classSession:'있음',round:2,content:'=HYPERLINK("private")\n<&> 학습',assignment:'숙제',examScope:'1과',specialNote:'상담',attendance:'출석',selfStudy:'없음'}});
test('newest date first, then numeric class start, missing classes last with stable ties',()=>{
 const rows=[record('late','18:50'),record('early','9:30'),record('missing',''),record('new','20:00','2026-10-01'),record('tie','09:30')];
 assert.deepEqual(rows.sort(compareLessonReview).map(r=>r.id),['new','early','tie','late','missing']);
});
test('export naming and real calendar validation match the reference',()=>{
 assert.equal(lessonExcelFilename(day,'지원T'),'2026-09-29_지원T_수업일지.xlsx');
 assert.equal(validLessonDay('2026-02-30'),false);assert.equal(validLessonDay('2024-02-29'),true);
 assert.ok(!lessonExcelFilename(day,'../T:*').includes('/'));
});
test('cells preserve homework, optional exam scope, special notes and no-class meaning',()=>{
 const r=record('a','18:50'),cells=lessonExcelCells(r);
 assert.equal(cells[0],'1용죽 이현준');assert.match(cells[3],/과제: 숙제\n시험범위: 1과/);assert.equal(cells[5],'상담');
 r.data.classSession='없음';assert.equal(lessonExcelCells(r)[1],'수업 없음');
});
test('real workbook preserves reference styles, literal strings, all rows and chronological order',async()=>{
 const template=await fs.readFile(new URL('../public/templates/lesson-log.xlsx',import.meta.url));
 const rows=Array.from({length:23},(_,i)=>record(String(i),i%2?'18:50':'15:00'));
 const bytes=await buildLessonExcel(template,day,'지원T',rows),zip=await JSZip.loadAsync(bytes);
 const sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
 assert.match(sheet,/지원T/);assert.match(sheet,/9월 29일 \(화\)/);assert.match(sheet,/r="B27"/);assert.match(sheet,/width="39.5"/);
 assert.ok(sheet.indexOf('15:00')<sheet.indexOf('18:50'));assert.match(sheet,/&lt;&amp;&gt;/);assert.match(sheet,/inlineStr/);assert.ok(!/<x:f[ >]/.test(sheet));
 assert.match(sheet,/r="E5" s="12"/);assert.equal((sheet.match(/r="B\d+" s="10"/g)||[]).length,23);
 const strings=await zip.file('xl/sharedStrings.xml')!.async('string');assert.ok(!strings.includes('정재희'));assert.ok(!strings.includes('김연우'));
 await assert.rejects(buildLessonExcel(template,day,'지원T',[record('a','10:00','2026-09-30')]),/선택한 날짜/);
});
test('long notes continue on another row without losing text or exceeding Excel cell limits',async()=>{
 const template=await fs.readFile(new URL('../public/templates/lesson-log.xlsx',import.meta.url)),r=record('a','15:00');
 r.data.content='가'.repeat(40000);r.data.assignment='';r.data.examScope='';
 const zip=await JSZip.loadAsync(await buildLessonExcel(template,day,'지원T',[r]));
 const sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
 assert.equal((sheet.match(/가/g)||[]).length,40000);assert.match(sheet,/r="E6"/);assert.ok((sheet.match(/<x:t[^>]*>([\s\S]*?)<\/x:t>/g)||[]).every((v:string)=>v.replace(/<[^>]+>/g,'').length<=32767));
});

import {excelTextParts,lessonExcelRowHeight,lessonExcelWidths,lessonExcelFontSizes} from '../src/lib/lessonExcelLayout';
test('attendance column contains only late or absent, while attendance memo is retained elsewhere',()=>{
 for(const [attendance,want] of [['보강 지각','지각'],['보강 결석','결석'],['지각','지각'],['결석','결석'],['보강 출석',''],['출석',''],['미확인','']]){
  const r:any=record('a','15:30');r.data.attendance=attendance;r.data.attendanceNote='10분 늦음';
  const cells=lessonExcelCells(r);assert.equal(cells[4],want);assert.match(cells[5],/출결 메모: 10분 늦음/);
 }
});
test('14pt Korean wrapping grows with content and never clips at Excel row height limit',()=>{
 const short=['학생','15:30–16:50','','짧은 내용','',''];
 const long=[...short];long[3]='문장의 형식 채점 및 피드백, 다양한 문장의 종류\n'.repeat(100);
 assert.ok(lessonExcelRowHeight(long)>lessonExcelRowHeight(short));
 const pieces=excelTextParts(long[3],lessonExcelWidths[3],lessonExcelFontSizes[3]);
 assert.ok(pieces.length>1);assert.equal(pieces.join(''),long[3]);
 for(const piece of pieces)assert.ok(lessonExcelRowHeight(['','','',piece,'',''])<=409);
});
test('ordinary paragraphs preserve wrapping styles and tall rows, long notes continue below without clipping',async()=>{
 const template=await fs.readFile(new URL('../public/templates/lesson-log.xlsx',import.meta.url));const r=record('a','15:30');
 r.data.content='문장의 형식 채점 및 피드백, 다양한 문장의 종류\n'.repeat(40);
 const zip=await JSZip.loadAsync(await buildLessonExcel(template,day,'지원T',[r]));const sheet=await zip.file('xl/worksheets/sheet1.xml')!.async('string');
 const heights=[...sheet.matchAll(/<x:row r="(\d+)" ht="([\d.]+)"/g)].filter(m=>Number(m[1])>=5).map(m=>Number(m[2]));
 assert.ok(heights.length>1);assert.ok(heights.every(h=>h<=409&&h>21));
 assert.equal((sheet.match(/문장의 형식/g)||[]).length,40);assert.match(sheet,/r="E5" s="12"/);
});
