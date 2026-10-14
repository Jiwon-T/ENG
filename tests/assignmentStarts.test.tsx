import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {templateFirestore} from './helpers/templateFirestore.js';
import {resolveStarts,setAssignmentStart,startDayFor,startId} from '../api/_lib/assignmentStarts.js';
import AssignmentSince from '../src/components/teacher/AssignmentSince';
const K='11111111-1111-4111-8111-111111111111';

test('담당 시작일: the stored day, else the 담당 변경 that added the teacher, else the 과목 시작일',()=>{
 const pairs=[{uid:'a',studentKey:K,subject:'영어',subjectStart:'2025-03-04'},{uid:'b',studentKey:K,subject:'영어',subjectStart:'2025-03-04'},{uid:'c',studentKey:K,subject:'영어',subjectStart:'2025-03-04'}];
 const stored=[{uid:'a',studentKey:K,subject:'영어',since:'2025-09-01'}];
 const transfers=[{studentKey:K,subject:'영어',toUids:['b'],at:Date.parse('2026-05-10T16:00:00Z')},{studentKey:K,subject:'영어',toUids:['b'],at:Date.parse('2026-01-01T03:00:00Z')}];
 assert.deepEqual(resolveStarts(pairs,stored,transfers).map(r=>[r.uid,r.since,r.known]),[['a','2025-09-01',true],['b','2026-05-11',false],['c','2025-03-04',false]],'the latest transfer, in Seoul time');
 assert.equal(startDayFor('2099-01-01'),'2099-01-01','a later 과목 시작일 wins');assert.match(startDayFor('2000-01-01'),/^\d{4}-\d{2}-\d{2}$/);
});
test('담당 시작일 is corrected by the teacher themselves, the principal or the admin, only for a student they teach',async()=>{
 const f=templateFirestore();
 f.rows.set('teacherWorkspaceAccess/t1',{academyId:'main',scopes:[{studentKey:K,subject:'영어'}]});
 const input={uid:'t1',studentKey:K,subject:'영어',since:'2026-05-11'};
 await assert.rejects(setAssignmentStart(f.db,{uid:'t2',academyId:'main',admin:false,principal:false},input),/FORBIDDEN/,'another teacher');
 await setAssignmentStart(f.db,{uid:'t1',academyId:'main',admin:false,principal:false},input);
 assert.equal(f.rows.get('teacherAssignmentStarts/'+startId('t1',K,'영어')).since,'2026-05-11');
 await setAssignmentStart(f.db,{uid:'p',academyId:'main',admin:false,principal:true},{...input,since:'2026-05-12'});
 assert.equal(f.rows.get('teacherAssignmentStarts/'+startId('t1',K,'영어')).since,'2026-05-12','the principal');
 assert.equal([...f.rows.keys()].filter(k=>k.startsWith('teacherAssignmentStartHistory/')).length,2,'each change kept');
 await assert.rejects(setAssignmentStart(f.db,{uid:'t1',academyId:'main',admin:true},{...input,subject:'수학'}),/ASSIGNMENT_NOT_FOUND/,'not their subject');
 await assert.rejects(setAssignmentStart(f.db,{uid:'t1',academyId:'main',admin:true},{...input,since:'5월'}));
});
test('담당 시작일 chip: read-only text, or a small date box when it can be corrected',()=>{
 assert.match(renderToStaticMarkup(<AssignmentSince label="영어" since="2026-05-11" canEdit={false} onSave={()=>{}}/>),/<b>영어<\/b>담당 2026\.5\.11부터/);
 const edit=renderToStaticMarkup(<AssignmentSince since="2026-05-11" canEdit onSave={()=>{}}/>);assert.match(edit,/<details class="asn-edit"/);assert.match(edit,/type="date"/);
 assert.equal(renderToStaticMarkup(<AssignmentSince since={null} canEdit={false} onSave={()=>{}}/>),'');
});
test('수강 이력: 등록, 중단, 재시작, 담당 변경 in date order; nothing for a subject never taken',async()=>{
 const {subjectHistory}=await import('../api/_lib/academyCore.js');
 const P=(status:string|null,start:string|null,end:string|null,teachers:string[])=>({properties:{'영어':status?{status:{name:status}}:undefined,'영어 시작일':{date:start?{start}:null},'영어 중단일':{date:end?{start:end}:null},'영어 담당':{relation:teachers.map(id=>({id}))}}});
 const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const docs=[{before:null,after:P('등록','2025-03-04',null,[A]),at:1},{before:P('등록','2025-03-04',null,[A]),after:P('등록','2025-03-04',null,[B]),at:Date.parse('2026-05-11T01:00:00Z')},{before:P('등록','2025-03-04',null,[B]),after:P('중단','2025-03-04','2026-07-31',[B]),at:Date.parse('2026-08-01T01:00:00Z')},{before:P('중단','2025-03-04','2026-07-31',[B]),after:P('등록','2026-09-01',null,[B]),at:Date.parse('2026-09-01T01:00:00Z')}];
 const names=(id:string)=>id===A?'이지원T':'박민지T';
 assert.deepEqual(subjectHistory('영어',docs,names),[{date:'2025-03-04',kind:'등록',text:'담당 이지원T'},{date:'2026-05-11',kind:'담당 변경',text:'이지원T → 박민지T'},{date:'2026-07-31',kind:'중단',text:''},{date:'2026-09-01',kind:'재시작',text:'담당 박민지T'}]);
 assert.deepEqual(subjectHistory('수학',docs,names),[]);
});
