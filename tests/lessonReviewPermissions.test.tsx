import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AcademyLessonReview from '../src/components/teacher/AcademyLessonReview';
import {teacherCacheRead} from '../src/lib/teacherReadCache';
function render(patch:any={}) {
 const uid='review-'+JSON.stringify(patch),key='academy-lessons:'+JSON.stringify({page:1,teacher:'',day:'',student:'',period:'7'});
 teacherCacheRead(uid,key,{records:[{id:'a',ownerUid:uid,revision:1,stage:'draft',data:{date:'2026-09-29',subject:'영어',studentKey:'s'}},{id:'b',ownerUid:'other',revision:1,stage:'draft',data:{date:'2026-09-29',subject:'영어',studentKey:'s'}}],total:2,page:1,pages:1,teachers:[{uid:'other',name:'다른 선생님'}]});
 return renderToStaticMarkup(<AcademyLessonReview data={{uid,students:[],...patch}} request={async()=>({})} act={async()=>{}} busy={false} onEdit={()=>{}}/>);
}
test('regular teacher has native row open controls without inline editing',()=>{
 const html=render();assert.ok(!html.includes('작성자 선생님'));assert.equal((html.match(/일지 수정/g)||[]).length,0);assert.equal((html.match(/일지 삭제/g)||[]).length,0);assert.equal((html.match(/class="lesson-review-open"/g)||[]).length,2);assert.match(html,/엑셀 내보내기/);
});
test('principal may select teacher but cannot edit or delete another teacher log',()=>{
 const html=render({principal:true});assert.match(html,/작성자 선생님/);assert.equal((html.match(/일지 수정/g)||[]).length,0);assert.equal((html.match(/일지 삭제/g)||[]).length,0);
});
test('administrator may select teacher and oversee both log controls',()=>{
 const html=render({admin:true});assert.match(html,/작성자 선생님/);assert.equal((html.match(/일지 수정/g)||[]).length,0);assert.equal((html.match(/일지 삭제/g)||[]).length,0);
});

import LessonReviewActions,{canManageLessonReview} from '../src/components/teacher/LessonReviewActions';
import fs from 'node:fs';
test('own saved and published lessons show both actions; foreign/unlinked author does not gain edit rights',()=>{
 for(const stage of ['draft','published','report_published_notion_pending']){
  const viewer={uid:'support-teacher',admin:false};const record={ownerUid:viewer.uid,stage,teacherName:'지원T'};
  const html=renderToStaticMarkup(<LessonReviewActions allowed={canManageLessonReview(viewer,record)} busy={false} onEdit={()=>{}} onDelete={()=>{}}/>);
  assert.match(html,/일지 수정/);assert.match(html,/일지 삭제/);
 }
 for(const ownerUid of ['other','__unlinked_author__',undefined])assert.equal(canManageLessonReview({uid:'support-teacher',admin:false},{ownerUid,teacherName:'지원T'}),false);
 assert.equal(canManageLessonReview({uid:'admin',admin:true},{ownerUid:'other'}),true);
});
test('review actions precede long details and dialog body has a header-aware scroll frame',()=>{
 const source=fs.readFileSync(new URL('../src/components/teacher/AcademyLessonReview.tsx',import.meta.url),'utf8');
 assert.ok(source.indexOf('<LessonReviewActions')<source.indexOf('<dl className="lesson-review-detail">'));
 const css=fs.readFileSync(new URL('../src/components/teacher/teacherWorkspace.css',import.meta.url),'utf8');
 assert.match(css,/workspace-dialog\[open\]:has\(\.lesson-review-summary\).*display:flex/);
});
