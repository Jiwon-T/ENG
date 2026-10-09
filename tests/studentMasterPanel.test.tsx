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
