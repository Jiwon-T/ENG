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
