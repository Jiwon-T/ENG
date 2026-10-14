import test from 'node:test';
import assert from 'node:assert/strict';
import {nameMatch,givenName,teacherBaseName,matchLinkSuggestions,dismissalId,markJustBefore} from '../api/_lib/linkSuggestions.js';

test('연결 제안 names: same name first, then the given name with or without the surname',()=>{
 assert.equal(nameMatch('정하늘','정 하늘'),2,'spaces ignored');
 assert.equal(nameMatch('하늘','정하늘'),1,'surname left out');
 assert.equal(nameMatch('김하늘','정하늘'),1,'same given name, other surname (offered with a warning)');
 assert.equal(nameMatch('남궁민수','민수'),1,'two-letter surname');
 assert.equal(nameMatch('정하늘','정하나'),0);assert.equal(nameMatch('','정하늘'),0);
 assert.equal(nameMatch('정훈','김훈'),0,'a one-letter given name is too weak to compare');
 assert.equal(givenName('남궁민수'),'민수');assert.equal(givenName('정훈'),null);
 assert.equal(teacherBaseName('영수 박민지T'),'박민지');assert.equal(teacherBaseName('박민지 선생님'),'박민지');
});
test('연결 제안 matching: only a single best match, never a target two accounts point at, never a turned-down pair',()=>{
 const targets=[{id:'s1',name:'정하늘'},{id:'s2',name:'김서연'},{id:'s3',name:'이서연'},{id:'s4',name:'박도윤'}];
 const accounts=[{id:'a',name:'정하늘'},{id:'b',name:'서연'},{id:'c',name:'김하늘'},{id:'d',name:'박도윤'},{id:'e',name:'박 도윤'}];
 const r=matchLinkSuggestions({kind:'student',accounts,targets,dismissed:new Set()});
 assert.deepEqual(r.found,[],'s1 is matched by two accounts (정하늘, 김하늘) and s4 by two (박도윤 ×2): none offered');
 assert.ok(r.unclear.some(u=>u.uid==='b'&&u.count===2),'two 서연 students: link by hand');
 assert.ok(r.unclear.some(u=>u.uid==='a')&&r.unclear.some(u=>u.uid==='c'));
 assert.ok(r.unclear.some(u=>u.uid==='d')&&r.unclear.some(u=>u.uid==='e'),'two accounts for one student');
 const one=matchLinkSuggestions({kind:'student',accounts:[{id:'a',name:'정하늘'}],targets,dismissed:new Set()});
 assert.deepEqual(one.found,[{kind:'student',uid:'a',targetId:'s1',level:2}]);
 const exactWins=matchLinkSuggestions({kind:'student',accounts:[{id:'x',name:'김서연'}],targets,dismissed:new Set()});
 assert.deepEqual(exactWins.found.map(f=>f.targetId),['s2'],'the same full name beats a given-name match');
 const hidden=matchLinkSuggestions({kind:'student',accounts:[{id:'a',name:'정하늘'}],targets,dismissed:new Set([dismissalId('student','a','s1')])});
 assert.deepEqual(hidden,{found:[],unclear:[]},'아니요 hides it');
});
test('same-name students: "가입 직전 등록" only when exactly one came within 14 days before the sign-up; unclear cases list their candidates',()=>{
 const c=(id:string,registered:string|null)=>({id,registered});
 assert.deepEqual(markJustBefore([c('new','2026-10-10'),c('old','2025-03-04')],'2026-10-12').map(x=>x.justBefore),[true,false]);
 assert.deepEqual(markJustBefore([c('a','2026-10-01'),c('b','2026-10-05')],'2026-10-12').map(x=>x.justBefore),[false,false],'two recent ones: no hint');
 assert.deepEqual(markJustBefore([c('a','2026-09-01')],'2026-10-12').map(x=>x.justBefore),[false],'more than 14 days before');
 assert.deepEqual(markJustBefore([c('a','2026-10-13')],'2026-10-12').map(x=>x.justBefore),[false],'after the sign-up');
 assert.deepEqual(markJustBefore([c('a','2026-10-10')],null).map(x=>x.justBefore),[false],'unknown sign-up day');
 const r=matchLinkSuggestions({kind:'student',accounts:[{id:'k',name:'김서연'}],targets:[{id:'s1',name:'김서연'},{id:'s2',name:'김서연'}],dismissed:new Set()});
 assert.deepEqual(r.unclear,[{kind:'student',uid:'k',count:2,targetIds:['s1','s2'],reason:'same-name',level:2}]);
 const partial=matchLinkSuggestions({kind:'student',accounts:[{id:'k',name:'서연'}],targets:[{id:'s1',name:'김서연'},{id:'s2',name:'이서연'}],dismissed:new Set()});
 assert.equal(partial.unclear[0].level,1,'given name only: the pick keeps the warning');
});
