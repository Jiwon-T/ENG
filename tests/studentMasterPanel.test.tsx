import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentMasterPanel from '../src/components/teacher/StudentMasterPanel';
const students=[{studentKey:'a',studentDisplayName:'이용준 (세교중2)',subjects:[{subject:'영어',status:'등록'}],linkedFirebaseUid:'u',hasGuardianContact:true}];
test('student list shows one search box, three chips incl. 신입생·상담, and passes the shared query to the 상담·신입생 section',()=>{
 const calls:any[]=[];
 const html=renderToStaticMarkup(<StudentMasterPanel students={students} value="" onSelect={()=>{}} registrations={{count:2,onAdd:()=>{},render:(query,active)=>{calls.push([query,active]);return <p>INTAKE</p>;}}}/>);
 assert.equal((html.match(/학생·신입생 이름·초성 검색/g)||[]).length,1,'one search box');
 assert.match(html,/신입생·상담 <b>2<\/b>/);assert.match(html,/상담·신입생/);assert.match(html,/INTAKE/);
 assert.deepEqual(calls,[['',false]],'section rendered once, inactive until chosen or searched');
 assert.match(html,/이용준/);
});
test('without management rights there is no 신입생·상담 chip or add button',()=>{
 const html=renderToStaticMarkup(<StudentMasterPanel students={students} value="" onSelect={()=>{}}/>);
 assert.doesNotMatch(html,/신입생·상담/);
});

test('student rows show the student\'s picked icon on the left and their pet beside the name',()=>{
 const list=[{...students[0],look:{icon:'🦊',pet:{name:'뭉치',level:3,character:'dog'}}},{studentKey:'b',studentDisplayName:'김규림 (용죽고1)',subjects:[{subject:'영어',status:'등록'}],linkedFirebaseUid:null,hasGuardianContact:true}];
 const html=renderToStaticMarkup(<StudentMasterPanel students={list} value="" onSelect={()=>{}}/>);
 assert.match(html,/smr-icon[^>]*>🦊</);assert.match(html,/smr-pet-art[^>]*>(<div[^>]*>)*<svg/,'the pet is drawn as a small picture');assert.match(html,/뭉치<b>Lv\.3<\/b>/);
 assert.match(html,/smr-icon[^>]*>김</,'no icon: first letter of the name');
});

test('teachers see linked/unlinked without the account UID',()=>{
 const render=(accountLinked:boolean)=>renderToStaticMarkup(<StudentMasterPanel students={[{...students[0],linkedFirebaseUid:null,accountLinked}]} value="" onSelect={()=>{}}/>);
 assert.doesNotMatch(render(true),/앱 계정 미연결/);
 assert.match(render(false),/앱 계정 미연결/);
});
