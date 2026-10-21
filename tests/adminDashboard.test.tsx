import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AdminDashboard from '../src/components/teacher/AdminDashboard';

const noop=async()=>{},request=async()=>({});
const base={academyId:'main',coreMode:true,students:[{studentKey:'s1',studentDisplayName:'학생'}],staff:[{uid:'t1',name:'선생님'},{uid:'t2',name:'새 선생님'}],access:[{uid:'t1',scopes:[{studentKey:'s1',subject:'영어'}]},{uid:'t2',scopes:[]}]};
const render=(data:any)=>renderToStaticMarkup(<div className="teacher-workspace"><AdminDashboard data={data} request={request} act={noop as any} busy={false} refresh={noop}/></div>);

test('관리자 설정 is a menu with one open tool: the teacher list first, no admin-only badge, menu summaries', () => {
 const html=render({...base,admin:true,principal:false});
 for(const label of ['선생님','수강료 계산','선생님 정산','앱 사용자','문자 템플릿','관리 기록','점검'])assert.ok(html.includes(`<strong>${label}`),label);
 assert.ok(/aria-current="page"[^>]*>.*?<strong>선생님/.test(html),'teachers open by default');
 assert.ok(html.includes('선생님 관리'),'the open tool is shown right away');
 assert.ok(html.includes('재직 2명 · 담당 미설정 1'),'menu summary');
 assert.equal(html.includes('관리자·원장님만 보임'),false);
 assert.equal(/<details/.test(html),false,'no collapsed sections');
});

test('principals see the academy tools but not the admin-only account and template menus', () => {
 const html=render({...base,admin:false,principal:true});
 for(const label of ['선생님','수강료 계산','선생님 정산','관리 기록'])assert.ok(html.includes(`<strong>${label}`),label);
 for(const label of ['앱 사용자','문자 템플릿'])assert.equal(html.includes(`<strong>${label}`),false,label);
});

test('탑 단어장, 원정대 문장 세트 and 원정대 이름·별칭 share one menu item and one screen; an old choice of either opens it',()=>{
 const html=render({...base,admin:true,principal:false});
 assert.ok(html.includes('<strong>탑·원정대'));assert.ok(html.includes('<small>학습 범위 · 원정대 이름·별칭</small>'));
 for(const label of ['탑 단어장','원정대 문장 세트','원정대 이름·별칭'])assert.equal(html.includes(`<strong>${label}`),false,label);
 const saved=(globalThis as any).localStorage;
 for(const old of ['sentences','guild']){
  (globalThis as any).localStorage={getItem:()=>old,setItem(){}};
  try{
   const open=render({...base,admin:true,principal:false});
   assert.ok(/aria-current="page"[^>]*>.*?<strong>탑·원정대/.test(open),old);
   assert.ok(open.includes('<h2>탑 단어장</h2>')&&open.includes('<h2>원정대 문장 세트</h2>')&&open.includes('<h2>원정대 이름·별칭'),'all three on the screen');
  }finally{(globalThis as any).localStorage=saved;}
 }
});
