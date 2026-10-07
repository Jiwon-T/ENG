import React from 'react';import test from 'node:test';import assert from 'node:assert/strict';import {renderToStaticMarkup} from 'react-dom/server';import {readFileSync} from 'node:fs';
import LessonAcademyFields from '../src/components/teacher/LessonAcademyFields';import LessonTests from '../src/components/teacher/LessonTests';import AutoTextarea from '../src/components/teacher/AutoTextarea';
import {scoreDisclosure,studyDisclosure} from '../src/lib/lessonDisclosure';import {textareaHeight} from '../src/lib/useAutoGrowTextarea';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('both score cards are always mounted without a toggle',()=>{
 const empty=renderToStaticMarkup(<LessonTests value={{}} onChange={()=>{}}/>);assert.ok(!empty.match(/<details[^>]* open/));assert.equal((empty.match(/<input/g)||[]).length,4);
 for(const value of [{wrong:0},{correct:0,total:20},{examWrong:2},{examTotal:20}]){const html=renderToStaticMarkup(<LessonTests value={value} onChange={()=>{}}/>);assert.ok(!html.includes('<details'));assert.equal((html.match(/<input/g)||[]).length,4);}
 const error=renderToStaticMarkup(<LessonTests value={{}} error onChange={()=>{}}/>);assert.ok(!error.includes('<details'));
 const scored=renderToStaticMarkup(<LessonTests value={{wrong:3,total:20,correct:17}} onChange={()=>{}}/>);assert.ok(scored.includes('환산 85 / 100'));
});
test('study inputs are always visible while presence and disabled conditions are preserved',()=>{
 const html=(value:any,error=false)=>renderToStaticMarkup(<LessonAcademyFields value={{classSession:'있음',start:'14:00',end:'15:20',round:1,selfStudy:'미확인',...value}} error={error} onChange={()=>{}}/>);
 assert.ok(!html({}).includes('class="lesson-session-controls" hidden'));assert.equal((html({}).match(/<input/g)||[]).length,6);
 assert.ok(!html({selfStudy:'있음'}).includes('class="lesson-session-controls" hidden'));
 for(const patch of [{selfStudyRound:0},{selfStudyStart:'16:00'}])assert.ok(!html(patch).includes('class="lesson-session-controls" hidden'));
 assert.ok(!html({},true).includes('class="lesson-session-controls" hidden'));
 assert.equal((html({selfStudy:'미확인',selfStudyRound:0}).match(/<input[^>]* disabled/g)||[]).length,3);
});
test('disclosure decisions leave field values unchanged across visibility decisions',()=>{
 const value={selfStudy:'미확인',selfStudyRound:0.5,wrong:3,total:20,correct:17};const before=structuredClone(value);
 assert.equal(studyDisclosure(value),true);assert.equal(scoreDisclosure(value),true);assert.equal(scoreDisclosure({},true),true);assert.deepEqual(value,before);
});
test('focusable session inputs follow visual kind round start end order without positive tab indices',()=>{
 const html=renderToStaticMarkup(<LessonAcademyFields value={{classSession:'있음',selfStudy:'있음'}} onChange={()=>{}}/>);
 const names=[...html.matchAll(/<(?:select|input)[^>]*aria-label="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(names,['수업 여부','수업 회차','수업 시작','수업 종료','자습 여부','자습 회차','자습 시작','자습 종료']);
 const root=source('src/components/teacher/TeacherWorkspace.tsx');const editor=root.slice(root.indexOf('const lessonEditor ='),root.indexOf('    return <div className',root.indexOf('const lessonEditor =')));
 const order=['<StudentCombobox','<label>날짜','<label>과목','<LessonAcademyFields','lesson-area-content','lesson-area-assessment','lesson-area-extras'].map(token=>editor.indexOf(token));assert.ok(order.every((at,i)=>at>=0&&(!i||at>order[i-1])));
 assert.ok(!editor.match(/tabIndex=\{[1-9]/));
});
test('text fields preserve attributes and values while bounding displayed height to two through eight rows',()=>{
 assert.equal(textareaHeight(20,12,2,10),54);assert.equal(textareaHeight(20,12,2,300),174);assert.equal(textareaHeight(20,12,2,95),97);
 const html=renderToStaticMarkup(<AutoTextarea required aria-required maxLength={5000} disabled value="유지할 입력" onChange={()=>{}}/>);assert.ok(html.includes('유지할 입력'));assert.ok(html.includes('rows="2"'));assert.ok(html.includes('required'));assert.ok(html.includes('disabled'));assert.ok(html.includes('maxLength="5000"'));
});
test('popup toolbar keeps small-group navigation mounted but hidden and uses persistent native common disclosure',()=>{
 const grid=source('src/components/teacher/TeacherLessonGrid.tsx');assert.ok(grid.includes('hidden={rows.length<=2}'));assert.ok(grid.includes('grid-editor-toolbar'));assert.ok(grid.includes('<details className="grid-common-input"'));assert.ok(grid.includes('Object.values(common).some(Boolean)'));
 assert.ok(!grid.includes('<strong>{data.students.find'));
});

test('successful save/publish notices do not force optional fields open; relevant validation errors do',async()=>{
 const {fieldDisclosureError}=await import('../src/lib/lessonDisclosure');
 for(const message of ['앱에 저장했습니다.','학생·학부모 리포트와 노션에 반영했습니다.']){assert.equal(fieldDisclosureError(message,'study'),false);assert.equal(fieldDisclosureError(message,'scores'),false);}
 assert.equal(fieldDisclosureError('자습 여부를 선택하고 시간과 회차를 입력해 주세요.','study'),true);assert.equal(fieldDisclosureError('오답 수와 문항 수를 확인해 주세요.','scores'),true);assert.equal(fieldDisclosureError('노션 연결 권한을 확인해 주세요.','scores'),false);
});


