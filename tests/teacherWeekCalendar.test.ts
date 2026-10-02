import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarWeek,mondayOfWeek,koreanDay,weeklyBoardEvents} from '../src/lib/teacherWeekCalendar.ts';
import {teacherReflectedSchedules} from '../api/_lib/teacherReflectedSchedules.ts';
test('Monday to Sunday range handles Korean midnight, Sunday, month and year boundaries',()=>{
 assert.equal(koreanDay('2026-10-02T15:00:00Z'),'2026-10-03');
 assert.equal(mondayOfWeek('2026-10-04'),'2026-09-28');
 assert.deepEqual(calendarWeek('2026-10-03'),['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04']);
 assert.deepEqual(calendarWeek('2027-01-01'),['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
});
test('weekly board includes saved drafts and regular slots in time order; reflected copies are deduplicated',()=>{
 const schedules=[{id:'a',notionPageId:'a-b',data:{date:'2026-10-05',title:'보강',start:'15:00',end:'16:00',subject:'영어',students:[],kind:'보강',status:'예정'},stage:'draft'}];
 const classes=[{id:'class',name:'정규반',subject:'영어',students:[],slots:[{weekday:1,start:'14:00',end:'15:00'},{weekday:4,start:'16:00',end:'17:00'}]}];
 const reflected=[{id:'old',notionPageId:'ab',date:'2026-10-05',title:'동일 원본',start:'15:00'},{id:'other',notionPageId:'other',date:'2026-10-06',title:'기존 일정',start:'14:00'}];
 const week=weeklyBoardEvents('2026-10-05',schedules,classes,reflected);
 assert.deepEqual(week[0].events.map(e=>e.title),['정규반','보강']);assert.equal(week[1].events[0].type,'reflected');assert.equal(week[3].events[0].type,'regular');assert.equal(week[6].events.length,0);
});
test('reflected group schedules expose only assigned recipients and preserve excluded recipients as cancelled',()=>{
 const mappings=new Map([['one',{internalStudentId:'i1'}],['two',{internalStudentId:'i2'}],['third',{internalStudentId:'i3'}]]);
 const base={notionScheduleId:'source',title:'보강',startAt:'2026-10-04T15:30:00Z',endAt:'2026-10-04T16:30:00Z',subject:'영어',scheduleType:'보강',status:'예정'};
 const records=[{...base,internalStudentId:'i1'},{...base,internalStudentId:'i2'},{...base,internalStudentId:'i3',status:'취소'}];
 const scoped=teacherReflectedSchedules(records,mappings,{admin:false,scopes:[{studentKey:'one',subject:'영어'}]});
 assert.equal(scoped.length,1);assert.deepEqual(scoped[0].students,['one']);assert.equal(scoped[0].date,'2026-10-05');assert.equal(scoped[0].start,'00:30');
 const all=teacherReflectedSchedules(records,mappings,{admin:true,scopes:[]});assert.equal(all.length,2);assert.deepEqual(all[0].students,['one','two']);assert.equal(all[1].status,'취소');
});
