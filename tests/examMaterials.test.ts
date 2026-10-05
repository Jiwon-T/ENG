import test from 'node:test';
import assert from 'node:assert/strict';
import {ExamPeriod,isPastExam,examVisible,koreanToday,validateExam} from '../src/lib/examMaterials.ts';
const p:ExamPeriod={id:'old',createdBy:'teacher',school:'용죽고',grade:'1학년',year:2026,semester:'2학기',exam:'중간고사',start:'2026-09-01',end:'2026-10-05',status:'공개 중',keepPublished:true,wordbookIds:['book']};
test('ended exams remain available in archive when publication is retained',()=>{
 assert.equal(isPastExam(p,'2026-10-05'),false);assert.equal(isPastExam(p,'2026-10-06'),true);
 assert.equal(examVisible(p,'2026-10-06'),true);assert.equal(examVisible({...p,keepPublished:false},'2026-10-06'),false);
 assert.equal(examVisible({...p,status:'준비 중'},'2026-10-01'),false);
 assert.equal(isPastExam({...p,status:'종료'},'2026-10-01'),true);
 assert.deepEqual(p.wordbookIds,['book']);
});
test('date boundaries use Korean local day',()=>{assert.equal(koreanToday(new Date('2026-10-05T15:01:00Z')),'2026-10-06');});
test('period validation rejects invalid or reversed dates and missing classification',()=>{
 assert.equal(validateExam(p),'');assert.ok(validateExam({...p,end:'2026-02-30'}));assert.ok(validateExam({...p,end:'2026-08-01'}));assert.ok(validateExam({...p,school:' '}));assert.ok(validateExam({...p,year:NaN}));
});
