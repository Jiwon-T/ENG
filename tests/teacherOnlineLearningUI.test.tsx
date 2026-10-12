import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import TeacherOnlineLearning from '../src/components/teacher/TeacherOnlineLearning';
const base={reason:'',progress:{recorded:2,learned:1},sessions:[],assignments:[],nextCursor:null};
test('online activity shows time/zero score/mistakes and task state without completion/edit buttons',()=>{
 const html=renderToStaticMarkup(<TeacherOnlineLearning data={{...base,sessions:[{id:'s',wordbookTitle:'교재',type:'quiz',category:'word',duration:60,score:0,totalItems:10,createdAt:'2026-10-08T00:00:00Z',dayStart:1,dayEnd:2,incorrectCount:1,incorrectAnswers:[{word:'word',meaning:'뜻',userChoice:'오답',correctAnswer:'정답'}]}],assignments:[{id:'a',content:'단어 50개 외우기',isDone:true,createdAt:null}]}} page={0} loading={false}/>);
 assert.ok(html.replace(/<[^>]*>/g,'').includes('정답 0/10')); assert.ok(html.includes('오답 1')&&html.includes('aria-expanded="false"'));assert.ok(html.includes('과제 · 최근 10개')&&html.includes('단어 50개 외우기')&&!html.includes('앱 과제'),'one 과제 list, no separate app box');assert.ok(html.includes('읽기 전용'));assert.ok(!html.includes('복습 처리'));assert.ok(!html.includes('포인트 지급'));
});
test('unlinked and empty states are distinct and never imply an unlinked student has no study records',()=>{
 assert.ok(renderToStaticMarkup(<TeacherOnlineLearning data={{...base,reason:'account-not-linked'}}/>).includes('계정이 연결되지 않아'));
 assert.ok(renderToStaticMarkup(<TeacherOnlineLearning data={base} page={0} loading={false}/>).includes('저장된 온라인 학습 활동이 없습니다.'));
});
test('학습 성취도 평가 box shows the saved note on the first page only, and the records stay read-only',()=>{
 const html=renderToStaticMarkup(<TeacherOnlineLearning data={{...base,evaluation:{text:'꾸준히 하고 있어요',updatedAt:'2026-10-08T00:00:00Z'}}} studentKey="11111111-1111-4111-8111-111111111111" page={0} loading={false}/>);
 assert.ok(html.includes('학습 성취도 평가'));assert.ok(html.includes('꾸준히 하고 있어요'));assert.ok(html.includes('학생 학습 리포트에 보입니다'));assert.ok(html.includes('기록은 읽기 전용'));
 assert.ok(/<button[^>]*>수정<\/button>/.test(html)&&!html.includes('평가 저장'),'collapsed to one line until the teacher opens the editor');
 assert.ok(html.indexOf('학습 성취도 평가')>html.indexOf('과제 · 최근 10개'),'placed at the bottom, below the records');
 assert.ok(renderToStaticMarkup(<TeacherOnlineLearning data={{...base,evaluation:{text:'',updatedAt:null}}} studentKey="11111111-1111-4111-8111-111111111111" page={0} loading={false}/>).includes('평가 쓰기'),'empty note offers to write one');
 assert.ok(!renderToStaticMarkup(<TeacherOnlineLearning data={base} studentKey="11111111-1111-4111-8111-111111111111" page={1} loading={false}/>).includes('학습 성취도 평가'),'later pages have no evaluation');
});
