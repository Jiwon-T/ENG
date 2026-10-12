import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import ClassPicker from '../src/components/teacher/ClassPicker';

const students=['전수현 (평여중1)','박경은 (평여중1)','류현수 (용죽고1)','김경현 (용죽고1)','김규림 (용죽고1)','이현준 (용죽고1)'].map((n,i)=>({studentKey:'k'+i,studentDisplayName:n}));
const date='2026-10-12',weekday=new Date(`${date}T12:00:00+09:00`).getUTCDay();
const classes=[
 {id:'off',name:'고2 심화',subject:'영어',students:['k0','k1','k2','k3','k4','k5'],slots:[{weekday:(weekday+1)%7,start:'19:00',end:'20:20'}]},
 {id:'on',name:'중1 문법반',subject:'영어',students:['k0','k1'],slots:[{weekday,start:'16:10',end:'17:30'}]},
];
const render=(query='',added:string[]=[])=>renderToStaticMarkup(<ClassPicker classes={classes} students={students} date={date} query={query} onQuery={()=>{}} selectedId="" isAdded={c=>added.includes(c.id)} onPick={()=>{}}/>);

test('class cards: classes meeting that day first with their time, every student by name with no limit',()=>{
 const html=render();
 assert.ok(html.indexOf('중1 문법반')<html.indexOf('고2 심화'),'meeting that day comes first');
 assert.match(html,/16:10–17:30/);assert.match(html,/이 날 수업 없음/);
 for(const name of ['전수현','박경은','류현수','김경현','김규림','이현준'])assert.ok(html.includes(`>${name}</span>`),name+' shown by name');
 assert.match(html,/6명/);assert.ok(!html.includes('(평여중1)<'),'school only in the tooltip');
});
test('search by class or student name, 초성 too; added classes are marked',()=>{
 assert.ok(!render('ㄹㅎㅅ').includes('중1 문법반')&&render('ㄹㅎㅅ').includes('고2 심화'),'초성 of a student');
 assert.ok(render('문법').includes('중1 문법반')&&!render('문법').includes('고2 심화'),'class name');
 assert.match(render('',['on']),/추가됨/);
});
