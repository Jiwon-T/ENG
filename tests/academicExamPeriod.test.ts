import test from 'node:test';
import assert from 'node:assert/strict';
import {examPeriod} from '../src/lib/academicExamPeriod';
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
