import test from 'node:test';
import assert from 'node:assert/strict';
import {examPeriod,examLabel} from '../src/lib/academicExamPeriod';
test('period metadata takes precedence; legacy names are classified only when explicit',()=>{
 assert.equal(examPeriod({examType:'학교 내신',examDate:'2026-10-02',title:'중2-2중간'})?.label,'26년도 2학기 중간고사');
 assert.equal(examPeriod({examType:'학교 내신',examDate:'2026-10-02',title:'중간 시험'}),null);
 assert.equal(examPeriod({examType:'학력평가',examYear:2026,semester:1,examPeriod:'중간고사'}),null);
 assert.equal(examPeriod({examType:'학교 내신',examYear:2025,semester:1,examPeriod:'기말고사',title:'2학기 중간고사'})?.key,'2025-1-기말고사');
});

