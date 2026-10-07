import React from 'react';
import test from 'node:test';import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
import {syncStatusMap,scheduleStatusMap,classStatusMap} from '../src/lib/statusMap';
import {initialWeekSelection,adjacentWeekDay,filterScheduleClasses} from '../src/lib/schedulePresentation';
import ScheduleEventCard from '../src/components/teacher/ScheduleEventCard';
import WeekBoard from '../src/components/teacher/WeekBoard';
test('only sync exceptions use state badges; calendar/class states are neutral except cancellation',()=>{
 assert.equal(syncStatusMap('published')?.quiet,true);assert.equal(syncStatusMap('synced')?.quiet,true);assert.equal(syncStatusMap('draft')?.kind,'saved');assert.equal(syncStatusMap('failed')?.kind,'failed');
 for(const value of ['예정','변경','완료'])assert.equal(scheduleStatusMap(value)?.tone,'neutral');
 assert.equal(scheduleStatusMap('취소')?.tone,'danger');assert.equal(scheduleStatusMap('취소')?.strike,true);assert.equal(classStatusMap('진행 중'),null);
 assert.equal(classStatusMap('중단')?.tone,'neutral');assert.equal(classStatusMap('대기')?.tone,'neutral');
});
test('event card completion is icon-only, failures are badges, native button opens by keyboard and link is separate',()=>{
 const card=(patch:any={})=>renderToStaticMarkup(<ScheduleEventCard time="14:00–15:20" title="모의 수업" subtitle="학생 외 2명 · 영어" syncStatus="published" onOpen={()=>{}} {...patch}/>);
 const html=card({notionUrl:'https://www.notion.so/example'});assert.ok(html.includes('title="Notion 반영 완료"'));assert.ok(!html.includes('workspace-status-badge'));assert.ok(html.includes('type="button"'));assert.ok(html.includes('</button><a'));assert.ok(html.includes('rel="noopener noreferrer"'));
 assert.ok(card({syncStatus:'failed'}).includes('status-danger'));assert.ok(card({scheduleStatus:'취소'}).includes('is-cancelled'));assert.ok(card({syncStatus:'draft'}).includes('초안'));
});
test('week board uses a 700px container boundary with accessible strip and deterministic initial selection',()=>{
 const days=Array.from({length:7},(_,i)=>({id:'2026-10-'+String(5+i).padStart(2,'0'),date:'2026-10-'+String(5+i).padStart(2,'0'),label:['월','화','수','목','금','토','일'][i],events:[]}));
 assert.equal(initialWeekSelection(days,'2026-10-07','dated'),'2026-10-07');assert.equal(initialWeekSelection(days,'2026-11-01','dated'),'2026-10-05');
 assert.equal(adjacentWeekDay(days,'2026-10-05','ArrowLeft'),'2026-10-11');assert.equal(adjacentWeekDay(days,'2026-10-07','ArrowRight'),'2026-10-08');
 const html=renderToStaticMarkup(<WeekBoard days={days} today="2026-10-07" mode="dated" renderEvent={()=>null} onAdd={()=>{}}/>);
 assert.ok(html.includes('role="tablist"'));assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);assert.ok(html.includes('role="tabpanel"'));assert.ok(html.includes('일정 없음'));
 const css=readFileSync(new URL('../src/components/teacher/scheduleWorkspace.css',import.meta.url),'utf8');assert.ok(css.includes('@container schedule-board (width < 700px)'));assert.ok(!css.includes('.schedule-day-events {overflow'));
});
test('class filter searches class/student names and initials without mutating loaded data',()=>{
 const students=[{studentKey:'a',studentDisplayName:'가나다'},{studentKey:'b',studentDisplayName:'English Kim'}],classes=[{name:'중등 기본반',students:['a'],status:'진행 중'},{name:'영어반',students:['b'],status:'중단'},{name:'대기반',students:[],status:'대기'}];
 assert.equal(filterScheduleClasses(classes,students,'ㄱㄴㄷ','').length,1);assert.equal(filterScheduleClasses(classes,students,'kim','중단').length,1);assert.equal(filterScheduleClasses(classes,students,'','진행 중').length,1);assert.equal(classes.length,3);
});
function clickHandler(path:string,label:string){const source=readFileSync(new URL(path,import.meta.url),'utf8'),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression='';const visit=(node:ts.Node)=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(tree)==='button'&&node.children.filter(ts.isJsxText).map(n=>n.text).join('').trim()===label){const attr=node.openingElement.attributes.properties.find(n=>ts.isJsxAttribute(n)&&n.name.getText(tree)==='onClick') as ts.JsxAttribute;expression=(attr.initializer as ts.JsxExpression).expression!.getText(tree);}ts.forEachChild(node,visit);};visit(tree);assert.ok(expression);return ts.transpileModule('globalThis.callback='+expression,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;}
test('schedule save and class save emit the exact pre-redesign browser payload snapshots',async()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/scheduleUiPayloads.json',import.meta.url),'utf8'));
 for(const [kind,path,label] of [['schedule','../src/components/teacher/TeacherScheduleEditor.tsx','저장'],['klass','../src/components/teacher/TeacherClassManager.tsx','저장·반영']]){
  const expected=fixture[kind],calls:any[]=[];const noop=()=>{};
  const context:any={id:expected.id,revision:expected.revision,classRevision:expected.revision,form:structuredClone(expected.data),classes:[{id:expected.id,notionEditedAt:expected.notionEditedAt}],request:async(action:string,body:any)=>{calls.push(JSON.parse(JSON.stringify({action,...body})));return {id:body.id,revision:2};},act:async(fn:()=>Promise<void>)=>fn(),refresh:async()=>{},setId:noop,setRevision:noop,setBaseline:noop,setNotice:noop,setClassWorking:noop,setClassRevision:noop,setClassBaseline:noop,JSON};
  vm.createContext(context);vm.runInContext(clickHandler(path,label),context);await context.callback();assert.deepEqual(calls,[expected]);
 }
});
