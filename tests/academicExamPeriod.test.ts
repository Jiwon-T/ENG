import test from 'node:test';
import assert from 'node:assert/strict';
import {examPeriod,examLabel} from '../src/lib/academicExamPeriod';
import {gradeFromPage} from '../api/_lib/teacherAcademicNotion';
test('period metadata takes precedence; legacy names are classified only when explicit',()=>{
 assert.equal(examPeriod({examType:'학교 내신',examDate:'2026-10-02',title:'중2-2중간'})?.label,'26년도 2학기 중간고사');
 assert.equal(examPeriod({examType:'학교 내신',examDate:'2026-10-02',title:'중간 시험'}),null);
 assert.equal(examPeriod({examType:'학력평가',examYear:2026,semester:1,examPeriod:'중간고사'}),null);
 assert.equal(examPeriod({examType:'학교 내신',examYear:2025,semester:1,examPeriod:'기말고사',title:'2학기 중간고사'})?.key,'2025-1-기말고사');
});
test('Notion grades retain their year, semester and exam period',()=>{
 const v=gradeFromPage({properties:{'학생':{relation:[{id:'11111111-1111-4111-8111-111111111111'}]},'시험 연도':{number:2026},'학기':{select:{name:'2학기'}},'고사 구분':{select:{name:'중간고사'}}}});
 assert.equal(v.examYear,2026);assert.equal(v.semester,2);assert.equal(v.examPeriod,'중간고사');
});

test('Notion detail overrides ambiguous or conflicting legacy labels',()=>{
 const p={properties:{'학생':{relation:[{id:'11111111-1111-4111-8111-111111111111'}]},'시험 종류':{select:{name:'학교 내신'}},'세부 종류':{select:{name:'2학기 기말고사'}},'학기':{select:{name:'1학기'}},'고사 구분':{select:{name:'중간고사'}},'시험일':{date:{start:'2026-12-04'}},'시험명':{title:[{plain_text:'1학기 중간'}]}}};
 const value=gradeFromPage(p);assert.equal(value.semester,2);assert.equal(value.examPeriod,'기말고사');assert.equal(examPeriod(value)?.label,'26년도 2학기 기말고사');
 assert.equal(examLabel({examType:'학력평가',examDetail:'9월',examDate:'2026-09-04'}),'26년도 9월 학력평가');
});
