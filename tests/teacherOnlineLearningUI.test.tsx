import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TeacherOnlineLearning from '../src/components/teacher/TeacherOnlineLearning';
const base={reason:'',progress:{recorded:2,learned:1},sessions:[],assignments:[],nextCursor:null};
test('online activity shows time/zero score/mistakes and task state without completion/edit buttons',()=>{
 const html=renderToStaticMarkup(<TeacherOnlineLearning data={{...base,sessions:[{id:'s',wordbookTitle:'교재',type:'quiz',category:'word',duration:60,score:0,totalItems:10,createdAt:'2026-10-08T00:00:00Z',dayStart:1,dayEnd:2,incorrectCount:1,incorrectAnswers:[{word:'word',meaning:'뜻',userChoice:'오답',correctAnswer:'정답'}]}],assignments:[{id:'a',content:'앱 과제',isDone:true,createdAt:null}]}} page={0} loading={false}/>);
 assert.ok(html.replace(/<[^>]*>/g,'').includes('정답 0/10')); assert.ok(html.includes('오답 1')&&html.includes('aria-expanded="false"'));assert.ok(html.includes('앱 과제'));assert.ok(html.includes('읽기 전용'));assert.ok(!html.includes('복습 처리'));assert.ok(!html.includes('포인트 지급'));
});
test('unlinked and empty states are distinct and never imply an unlinked student has no study records',()=>{
 assert.ok(renderToStaticMarkup(<TeacherOnlineLearning data={{...base,reason:'account-not-linked'}}/>).includes('계정이 연결되지 않아'));
 assert.ok(renderToStaticMarkup(<TeacherOnlineLearning data={base} page={0} loading={false}/>).includes('저장된 온라인 학습 활동이 없습니다.'));
});
