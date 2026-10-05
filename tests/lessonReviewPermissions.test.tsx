import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AcademyLessonReview from '../src/components/teacher/AcademyLessonReview';
import {teacherCacheRead} from '../src/lib/teacherReadCache';
function render(patch:any={}) {
 const uid='review-'+JSON.stringify(patch),key='academy-lessons:'+JSON.stringify({page:1,teacher:'',day:'',student:''});
 teacherCacheRead(uid,key,{records:[{id:'a',ownerUid:uid,revision:1,stage:'draft',data:{date:'2026-09-29',subject:'영어',studentKey:'s'}},{id:'b',ownerUid:'other',revision:1,stage:'draft',data:{date:'2026-09-29',subject:'영어',studentKey:'s'}}],total:2,page:1,pages:1,teachers:[{uid:'other',name:'다른 선생님'}]});
 return renderToStaticMarkup(<AcademyLessonReview data={{uid,students:[],...patch}} request={async()=>({})} act={async()=>{}} busy={false} onEdit={()=>{}}/>);
}
test('regular teacher has no author selector and only own edit/delete controls',()=>{
 const html=render();assert.ok(!html.includes('작성자 선생님'));assert.equal((html.match(/일지 수정/g)||[]).length,1);assert.equal((html.match(/일지 삭제/g)||[]).length,1);assert.match(html,/엑셀 내보내기/);
});
test('principal may select teacher but cannot edit or delete another teacher log',()=>{
 const html=render({principal:true});assert.match(html,/작성자 선생님/);assert.equal((html.match(/일지 수정/g)||[]).length,1);assert.equal((html.match(/일지 삭제/g)||[]).length,1);
});
test('administrator may select teacher and oversee both log controls',()=>{
 const html=render({admin:true});assert.match(html,/작성자 선생님/);assert.equal((html.match(/일지 수정/g)||[]).length,2);assert.equal((html.match(/일지 삭제/g)||[]).length,2);
});
