import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {NAV_ITEMS,visibleWorkspaceNav,adjacentWorkspaceTab} from '../src/lib/workspaceNavigation';
import {todayProgressRatios,nextUnwrittenLesson} from '../src/lib/todayLessonProgress';
import {mobileBarsHidden} from '../src/lib/useWorkspaceMobileBars';
import StatusBadge from '../src/components/teacher/StatusBadge';
import WorkspaceNavigation from '../src/components/teacher/WorkspaceNavigation';
import WorkspaceMobileNavigation from '../src/components/teacher/WorkspaceMobileNavigation';
import DateStepper from '../src/components/teacher/DateStepper';
import {readFileSync} from 'node:fs';
import LessonActionBar from '../src/components/teacher/LessonActionBar';
test('one navigation list retains principal/admin visibility and the requested mobile order',()=>{
 assert.equal(new Set(NAV_ITEMS.map(item=>item.id)).size,8);
 assert.equal(visibleWorkspaceNav().some(item=>item.id==='settings'),false);
 assert.equal(visibleWorkspaceNav(true).length,8);assert.equal(visibleWorkspaceNav(false,true).length,8);
 assert.deepEqual(NAV_ITEMS.filter(item=>item.mobilePrimary).sort((a,b)=>a.mobileOrder-b.mobileOrder).map(item=>item.id),['lesson','schedule','students','academy']);
 const secondary=renderToStaticMarkup(<WorkspaceMobileNavigation tab="lesson" onTab={()=>{}} hidden={false}/>);
 assert.ok(secondary.includes('모바일 선생님방 메뉴'));assert.ok(!secondary.includes('관리자 설정'));
});
test('desktop tabs expose selected state, one keyboard stop and cyclic arrow/home/end navigation',()=>{
 const items=visibleWorkspaceNav();
 assert.equal(adjacentWorkspaceTab(items,'lesson','ArrowRight'),'academy');assert.equal(adjacentWorkspaceTab(items,'lesson','ArrowLeft'),'word');
 assert.equal(adjacentWorkspaceTab(items,'word','Home'),'lesson');assert.equal(adjacentWorkspaceTab(items,'lesson','End'),'word');assert.equal(adjacentWorkspaceTab(items,'lesson','Enter'),undefined);
 const html=renderToStaticMarkup(<WorkspaceNavigation tab="lesson" onTab={()=>{}} date="2026-10-07" history={<p>작업</p>}/>);
 assert.ok(html.includes('role="tablist"'));assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);assert.equal((html.match(/tabindex="0"/g)||[]).length,1);assert.ok(!html.includes('관리자 설정'));
});
test('every status badge has a semantic color class, text, dot and icon',()=>{
 for(const [kind,text,tone] of [['done','반영 완료','success'],['saved','저장됨','pending'],['unwritten','미작성','neutral'],['failed','반영 실패','danger'],['editing','작성 중','neutral']] as const){
  const html=renderToStaticMarkup(<StatusBadge kind={kind}/>);assert.ok(html.includes('status-'+tone));assert.ok(html.includes(text));assert.ok(html.includes('workspace-status-dot'));assert.ok(html.includes('<svg'));assert.ok(html.includes('aria-label="'+text+'"'));
 }
});
test('progress ratios handle zero, unwritten, complete and mixed totals without extra reads',()=>{
 assert.deepEqual(todayProgressRatios({total:0,published:0,saved:0,empty:0}),{done:0,saved:0,unwritten:0});
 assert.deepEqual(todayProgressRatios({total:4,published:0,saved:0,empty:4}),{done:0,saved:0,unwritten:100});
 assert.deepEqual(todayProgressRatios({total:4,published:4,saved:0,empty:0}),{done:100,saved:0,unwritten:0});
 assert.deepEqual(todayProgressRatios({total:4,published:2,saved:1,empty:1}),{done:50,saved:25,unwritten:25});
 const event=(start:string)=>({id:start,title:'모의',kind:'보강',subject:'영어',date:'2026-10-07',start,end:'18:00',students:['a']});
 const records=[{stage:'published',data:{studentKey:'a',subject:'영어',date:'2026-10-07',start:'14:00'}}];
 assert.equal(nextUnwrittenLesson([event('16:00'),event('14:00'),event('15:00')],records)?.event.start,'15:00');
 assert.equal(nextUnwrittenLesson([event('14:00')],records),undefined);
});
test('date stepper keeps calendar access and scroll/keyboard changes only bar presentation',()=>{
 const html=renderToStaticMarkup(<DateStepper date="2026-10-07" onDate={()=>{}}/>);assert.ok(html.includes('10/07(수)'));assert.ok(html.includes('이전 날짜'));assert.ok(html.includes('다음 날짜'));assert.ok(html.includes('type="date"'));assert.ok(html.includes('hidden=""'));
 assert.equal(mobileBarsHidden(10,false,false,false),true);assert.equal(mobileBarsHidden(-10,false,false,true),false);assert.equal(mobileBarsHidden(0,true,false,true),false);assert.equal(mobileBarsHidden(-10,true,true,false),true);
});
test('semantic text/background pairs reach WCAG AA and action failures include a retry without new requests',()=>{
 const css=readFileSync(new URL('../src/components/teacher/teacherWorkspace.css',import.meta.url),'utf8');
 const color=(name:string)=>[...css.matchAll(new RegExp('--workspace-'+name+':(#[0-9a-f]{6})[;\\s]','g'))].at(-1)![1];
 const lum=(hex:string)=>{const a=[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
 for(const tone of ['success','pending','danger','neutral','brand']){const fg=lum(color(tone+'-fg')),bg=lum(color(tone+'-bg'));assert.ok((Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)>=4.5,tone);}
 const fg=lum(color('brand-on-solid')),bg=lum(color('brand-dot'));assert.ok((Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)>=4.5);
 const html=renderToStaticMarkup(<LessonActionBar status={{text:'작성 중',tone:'grey'}} failureReason="모의 저장 실패" onRetry={()=>{}}><button>저장</button></LessonActionBar>);
 assert.ok(html.includes('status-danger'));assert.ok(html.includes('모의 저장 실패'));assert.ok(html.includes('다시 시도'));
});
