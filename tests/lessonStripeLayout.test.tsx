import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import LessonAcademyFields from '../src/components/teacher/LessonAcademyFields';import LessonTests from '../src/components/teacher/LessonTests';import {textareaHeight} from '../src/lib/useAutoGrowTextarea';
const read=(name:string)=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('both editors keep shared bands in basics schedule content assessment extras DOM order',()=>{
 const single=read('src/components/teacher/TeacherWorkspace.tsx');const editor=single.slice(single.indexOf('const lessonEditor ='),single.indexOf('    return <div className',single.indexOf('const lessonEditor =')));
 const grid=read('src/components/teacher/TeacherLessonGrid.tsx');const popup=grid.slice(grid.indexOf('<td className="grid-lesson-top">'),grid.indexOf('</tr>)}</tbody>'));
 for(const [source,basics]of [[editor,'lesson-area-basics'],[popup,'grid-lesson-top']]){const order=[basics,'lesson-area-schedule','lesson-area-content','lesson-area-assessment','lesson-area-extras'].map(name=>source.indexOf(name));assert.ok(order.every((at,i)=>at>=0&&(!i||at>order[i-1])));assert.ok(source.includes('lesson-first-band'));assert.ok(source.includes('lesson-second-band'));assert.ok(!source.match(/tabIndex=\{[1-9]/));}
});
test('self-study remains present and has reserved hint geometry for either presence value',()=>{
 for(const selfStudy of ['있음','미확인','없음']){const html=renderToStaticMarkup(<LessonAcademyFields value={{classSession:'있음',selfStudy}} onChange={()=>{}}/>);assert.ok(!html.includes(' hidden'));assert.equal((html.match(/class="lesson-time-row"/g)||[]).length,2);assert.equal((html.match(/class="lesson-round-hint"/g)||[]).length,2);assert.ok(html.includes('aria-label="자습 시작"'));assert.ok(html.includes('aria-label="자습 종료"'));}
});
test('both score cards stay visible for empty values and validation errors',()=>{
 for(const [value,error,open]of [[{},false,false],[{wrong:0},false,true],[{wrong:3,total:20,correct:17},false,true],[{},true,true]] as const){const copy=structuredClone(value);const html=renderToStaticMarkup(<LessonTests value={value} error={error} onChange={()=>{}}/>);assert.ok(!html.includes('<details'));assert.equal((html.match(/<input/g)||[]).length,4);assert.deepEqual(value,copy);}
});
test('content grows to fourteen rows and optional writing grows to six without changing the default helper',()=>{
 assert.equal(textareaHeight(20,12,2,1000,3,14),294);assert.equal(textareaHeight(20,12,2,1000,2,6),134);assert.equal(textareaHeight(20,12,2,1,3,14),74);assert.equal(textareaHeight(20,12,2,1000),174);
 const css=read('src/components/teacher/teacherWorkspace.css');assert.ok(css.includes('--textarea-max-rows:14'));assert.ok(css.includes('--textarea-max-rows:6'));assert.ok(css.includes('min-width:1000px'));assert.ok(css.includes('max-width:999.99px'));assert.ok(css.includes('max-width:899.99px'));assert.ok(!css.match(/\.lesson-area-(?:content|assessment|extras)[^}]*\border\s*:/));
});
