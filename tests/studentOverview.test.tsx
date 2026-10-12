import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {studentOverview,gradeOf,plannedStops,plannedStopOf} from '../src/lib/studentOverview';
import StudentOverview from '../src/components/teacher/StudentOverview';

const s=(i:number,name:string,subjects:any[],look:any=null)=>({studentKey:'k'+i,studentDisplayName:name,subjects,look});
const students=[
 s(1,'가 (평여중1)',[{subject:'영어',status:'등록',startDate:'2026-10-02'},{subject:'수학',status:'등록',startDate:'2026-03-01'}],{pet:{name:'a',level:30}}),
 s(2,'나 (용죽고1)',[{subject:'영어',status:'등록',startDate:'2025-09-01'}],{pet:{name:'b',level:50}}),
 s(3,'다',[{subject:'영어',status:'등록',startDate:null}]),
 s(4,'라 (비전고2)',[{subject:'영어',status:'중단',startDate:'2026-01-10',endDate:'2026-10-03'}],{pet:{name:'gone',level:99}}),
];
test('monthly joins use the earliest subject start; leaves only for students who stopped every subject',()=>{
 const o=studentOverview(students,'2026-10-12');
 assert.equal(o.bars.length,12);assert.equal(o.bars[11].month,'2026-10');assert.equal(o.bars[0].month,'2025-11');
 assert.deepEqual(o.bars.find(b=>b.month==='2026-03')!.joined,['가'],'earliest start, not the newer subject');
 assert.deepEqual(o.bars[11].left,['라']);assert.equal(o.joinedThisMonth,0);assert.equal(o.leftThisMonth,1);
 assert.equal(o.current,3);assert.equal(o.missingStart,1);
});
test('subjects, grades, tenure and pets count current students only',()=>{
 const o=studentOverview(students,'2026-10-12');
 assert.deepEqual(o.subjects,[{subject:'영어',count:3},{subject:'수학',count:1}]);
 assert.deepEqual(o.grades,[{grade:'고1',count:1},{grade:'중1',count:1}],'highest grade first');assert.equal(o.gradeUnknown,1);
 assert.equal(o.tenure.known,2);assert.equal(o.tenure.overYear,1);assert.equal(o.tenure.averageMonths,(7+13)/2);
 assert.deepEqual(o.pets.map(p=>p.name),['나','가'],'a stopped student is not ranked');
 assert.equal(gradeOf('전수현 (평여중1)'),'중1');assert.equal(gradeOf('송지효'),null);
 assert.equal(gradeOf('학생 (고덕중2)'),'중2','a level letter inside the school name is not the grade');assert.equal(gradeOf('학생 (중앙초3)'),'초3');
 assert.equal(gradeOf('학생 (용죽고1)'),'고1');assert.equal(gradeOf('학생 (한국중학교 2학년)'),'중2');assert.equal(gradeOf('학생 (고덕중)'),null);
});
test('the overview renders cards, the chart and the empty-date note',()=>{
 const html=renderToStaticMarkup(<StudentOverview students={students} intakeCount={2} today="2026-10-12"/>);
 for(const text of ['학원 한눈에 보기','재원생','이번 달 신규','이번 달 중단','신입생·상담','월별 신규 등록 · 중단','과목 · 학년 구성','재원 기간','펫 랭킹','등록일이 비어 있는 재원생 1명'])assert.ok(html.includes(text),text);
 assert.ok(!renderToStaticMarkup(<StudentOverview students={students} today="2026-10-12"/>).includes('신입생·상담'),'no intake card without management rights');
});
test('중단 예약: due from the planned day until decided, upcoming within 30 days, only for subjects still 등록',()=>{
 const list=[s(1,'가 (평여중1)',[{subject:'영어',status:'등록',plannedEndDate:'2026-10-01'},{subject:'수학',status:'등록',plannedEndDate:'2026-11-05'}]),
  s(2,'나',[{subject:'영어',status:'등록',plannedEndDate:'2026-10-12'}]),s(3,'다',[{subject:'영어',status:'중단',plannedEndDate:'2026-10-01'}]),s(4,'라',[{subject:'영어',status:'등록',plannedEndDate:'2027-01-01'}])];
 const {due,upcoming}=plannedStops(list,'2026-10-12');
 assert.deepEqual(due.map(d=>d.name+d.subject),['가영어','나영어'],'a past planned date stays due on later visits; today counts');
 assert.deepEqual(upcoming.map(d=>d.name+d.subject),['가수학']);
 assert.equal(plannedStopOf(list[0]),'2026-10-01');assert.equal(plannedStopOf(list[2]),null);
});
