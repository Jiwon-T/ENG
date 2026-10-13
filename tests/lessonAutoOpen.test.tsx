import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {autoOpenLesson} from '../src/lib/todayLessonProgress';
const ev=(id:string,start:string,students:string[])=>({id,title:id,kind:'정규',date:'2026-10-13',subject:'영어',start,end:start.replace(/^(\d+)/,h=>String(Number(h)+1).padStart(2,'0')),students}) as any;
const rec=(key:string,start:string,stage:string)=>({id:key+start,stage,data:{studentKey:key,date:'2026-10-13',subject:'영어',start}});

test('opens by itself: the first lesson when nothing is 반영 yet, else the latest 반영 lesson',()=>{
 const events=[ev('b','18:50',['s2','s3']),ev('a','16:10',['s1']),ev('c','20:20',['s4'])];
 assert.deepEqual(autoOpenLesson(events,[]) && {id:autoOpenLesson(events,[])!.event.id,key:autoOpenLesson(events,[])!.key},{id:'a',key:'s1'},'all unwritten → the first lesson of the day');
 const saved=[rec('s1','16:10','draft')];assert.equal(autoOpenLesson(events,saved)!.key,'s1','a saved (not 반영) lesson does not count');
 const some=[rec('s1','16:10','published'),rec('s2','18:50','published'),rec('s4','20:20','draft')];
 assert.deepEqual({id:autoOpenLesson(events,some)!.event.id,key:autoOpenLesson(events,some)!.key},{id:'b',key:'s2'},'the latest 반영 lesson, easy to correct');
 assert.equal(autoOpenLesson([],[]),undefined);
});
test('editor: auto-open only for today with an empty editor, hint until a manual pick, next lesson after 반영',()=>{
 const ws=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ws,/autoOpen=\{tab==='lesson'&&lessonMode==='single'&&!lessonDialogOpen&&lessonDay===today\(\)&&!lesson\.studentKey&&!autoTouches\.current\.size&&!autoOpenDone\(data\.uid,lessonDay\)\}/);
 assert.match(ws,/onAutoOpen=\{\(key,event,savedId\)=>\{setPickHint\(true\);openDayLesson\(key,event,savedId,false\);\}\}/);
 assert.match(ws,/\{pickHint&&<span className="lesson-pick-hint" role="note"><Info size=\{13\} aria-hidden="true"\/>왼쪽에서 수업을 고르세요<\/span>\}/);assert.doesNotMatch(ws,/lesson-pick-hint[^<]*<ArrowLeft/,'no arrow (it would point at 새 일지)');
 assert.match(ws,/if\(manual\)setPickHint\(false\)/,'a row, the next button or the student search clears the hint');
 assert.match(ws,/currentDraft\?\.stage==='published'&&!lessonDirty\?nextUnwrittenLesson\(/);assert.match(ws,/className="lesson-next-lesson"/);
 const list=fs.readFileSync(new URL('../src/components/teacher/TeacherTodayLessons.tsx',import.meta.url),'utf8');
 assert.match(list,/autoOpenDone\(data\.uid,date\)/,'once per day');assert.match(list,/remote\?\.uid!==data\.uid\|\|remote\?\.date!==date/,'only after that day\'s lessons are loaded');
});
test('auto-open happens once per teacher and day even if the list is unmounted (tab change) and mounted again',async()=>{
 const {autoOpenDone,markAutoOpenDone}=await import('../src/lib/autoOpenGuard');
 assert.equal(autoOpenDone('t1','2026-10-13'),false);markAutoOpenDone('t1','2026-10-13');
 assert.equal(autoOpenDone('t1','2026-10-13'),true,'kept outside the component, so a remount still sees it');
 assert.equal(autoOpenDone('t1','2026-10-14'),false,'another day');assert.equal(autoOpenDone('t2','2026-10-13'),false,'another teacher');
 const list=fs.readFileSync(new URL('../src/components/teacher/TeacherTodayLessons.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(list,/autoOpened=useRef/,'no per-mount ref');assert.match(list,/autoOpenDone\(data\.uid,date\)/);assert.match(list,/markAutoOpenDone\(data\.uid,date\)/);
 const ws=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ws,/if\(data\?\.uid\)markAutoOpenDone\(data\.uid,event\.date\)/,'a manual pick ends auto-open for that day');
 assert.match(ws,/if\(data\?\.uid\)markAutoOpenDone\(data\.uid,lessonDay\);guarded\(resetLesson\)/,'+ 새 일지 too');
 assert.match(ws,/&&!autoOpenDone\(data\.uid,lessonDay\)\}/);
});
