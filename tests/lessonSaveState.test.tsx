import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {lessonSaveState,savedAgo} from '../src/lib/lessonPresentation';
import LessonActionBar from '../src/components/teacher/LessonActionBar';
import LessonSaveStatus from '../src/components/teacher/LessonSaveStatus';

const now=Date.parse('2026-10-13T10:00:00+09:00');
test('saved time reads 방금, N분 전, N시간 전, then the date',()=>{
 assert.equal(savedAgo(now-20_000,now),'방금 저장됨');
 assert.equal(savedAgo(now-3*60_000,now),'3분 전 저장됨');
 assert.equal(savedAgo(now-2*3600_000,now),'2시간 전 저장됨');
 assert.match(savedAgo(now-3*86400_000,now),/^\d+\/\d+ 저장됨$/);
 assert.equal(savedAgo(0,now),'저장됨');
});
test('title state: busy, failed, unsaved input, published, pending, saved; nothing for an untouched new lesson',()=>{
 const s=(record:any,dirty=false,busy=false,savedAt?:number)=>lessonSaveState({record,dirty,busy,savedAt,now});
 assert.equal(s(undefined),null);
 assert.equal(s({stage:'new'}),null);
 assert.deepEqual(s(undefined,true),{kind:'unsaved',text:'저장 안 됨'});
 assert.deepEqual(s({stage:'published'}),{kind:'published',text:'반영 완료'});
 assert.equal(s({stage:'published'},true)?.text,'저장 안 됨','edited after 반영');
 assert.equal(s({stage:'draft',updatedAt:now-5*60_000})?.text,'5분 전 저장됨');
 assert.equal(s({stage:'draft',updatedAt:{toMillis:()=>now-60_000}})?.text,'1분 전 저장됨');
 assert.equal(s({stage:'draft',updatedAt:now-5*60_000},false,false,now-1000)?.text,'방금 저장됨','this device\'s save time wins');
 assert.equal(s({stage:'processing'})?.kind,'pending');
 assert.equal(s({stage:'failed'},true)?.kind,'failed');
 assert.equal(s({stage:'draft'},true,true)?.kind,'busy');
 assert.match(renderToStaticMarkup(<LessonSaveStatus record={{stage:'published'}} dirty={false} busy={false}/>),/lesson-save-pill is-published[^>]*>.*반영 완료/);
 assert.equal(renderToStaticMarkup(<LessonSaveStatus dirty={false} busy={false}/>),'');
});
test('with the state in the title the bar shows only failures, the reason and the shortcut hint',()=>{
 const bar=(status:any,extra:any={})=>renderToStaticMarkup(<LessonActionBar statusInTitle hint="Ctrl+S 저장" status={status} {...extra}><button>저장</button></LessonActionBar>);
 const ok=bar({text:'저장됨',tone:'pink'},{reason:'수업 내용을 입력하면 반영할 수 있어요'});
 assert.ok(!ok.includes('workspace-status-badge'),'no status badge in the bar');
 assert.match(ok,/수업 내용을 입력하면 반영할 수 있어요/);assert.match(ok,/lesson-action-hint">Ctrl\+S 저장/);
 assert.match(bar({text:'반영 실패',tone:'red'}),/저장·반영 실패/);
 assert.match(renderToStaticMarkup(<LessonActionBar status={{text:'저장됨',tone:'pink'}}><i/></LessonActionBar>),/workspace-status-badge/,'other bars unchanged');
});
test('single editor: 반영 is primary when ready, every lesson switch is guarded, Ctrl/⌘+S saves',()=>{
 const source=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(source,/className=\{publishReady\?'small-button':'primary-button'\}[^>]*>[^<]*(<LoaderCircle[^>]*\/>\})?저장<ShortcutKey keys="S"\/><\/button>/);
 assert.match(source,/className=\{publishReady\?'primary-button':'small-button'\}/);
 for(const call of ['onChange={key=>{setPickHint(false);guarded(()=>selectStudent(key));}}','onNewLesson={()=>guarded(resetLesson)}','onStudent={(key,event,savedId)=>openDayLesson(key,event,savedId)}','{if(manual)setPickHint(false);if(data?.uid)markAutoOpenDone(data.uid,event.date);guarded(()=>selectStudent(key,','onClick={() => guarded(()=>openDraft(d))}','onClick={() => guarded(resetLesson)}','onClick={()=>{setPickHint(false);if(data?.uid)markAutoOpenDone(data.uid,lessonDay);guarded(resetLesson);}}','guarded(()=>selectStudent(lesson.studentKey,{subject}))'])assert.ok(source.includes(call),call);
 assert.match(source,/confirmText:'저장하고 이동',altText:'저장 안 하고 이동'/);
 assert.match(source,/const shortcut=lessonShortcut\(e\);/);assert.match(source,/dialog\.confirm-modal\[open\]/);
 assert.match(source,/publishShortcut\.current=\(\)=>\{if\(!busy&&!autoLoading&&publishReady\)void act\(\(\)=>submitSingleLesson\('publish'\)\);\};/,'Ctrl/⌘+Enter publishes through the confirm, only when ready');
 assert.match(source,/<LessonSaveStatus record=\{currentDraft\} dirty=\{lessonDirty\}/);
});
test('one status icon set: every kind renders its own icon and label',async()=>{
 const {default:StatusBadge,statusIcon}=await import('../src/components/teacher/StatusBadge');
 const kinds=['done','saved','unwritten','failed','running','waiting','stopped','stopPlanned','unlinked'] as const;
 const labels=['반영 완료','저장됨','미작성','반영 실패','진행 중','대기','중단','중단 예정','앱 미연결'];
 const icons=new Set(kinds.map(k=>statusIcon(k)));assert.equal(icons.size,kinds.length,'no two statuses share an icon');
 kinds.forEach((k,i)=>{const html=renderToStaticMarkup(<StatusBadge kind={k}/>);assert.match(html,/<svg/);assert.ok(html.includes(labels[i]),k);});
 assert.match(renderToStaticMarkup(<StatusBadge kind="running"/>),/status-brand/);
});
test('action confirms use the app modal; deleting, deactivating, blocking and unlinking are red',()=>{
 const read=(f:string)=>fs.readFileSync(new URL(`../src/components/teacher/${f}`,import.meta.url),'utf8');
 for(const f of ['AcademyLessonReview.tsx','AppUserManager.tsx','LessonRestorePanel.tsx','ParentLinkControl.tsx','StopReminders.tsx','StudentAccountLink.tsx','WordbookManager.tsx','TeacherAcademicManager.tsx'])assert.doesNotMatch(read(f),/window\.confirm\(/,f);
 const danger=[['AppUserManager.tsx','탈퇴시키기'],['AppUserManager.tsx','로그인 막기'],['StudentAccountLink.tsx','연결 해제'],['TeacherManager.tsx','연결 해제'],['TeacherClassManager.tsx','삭제'],['TeacherScheduleEditor.tsx','삭제'],['WordbookManager.tsx','삭제'],['AcademyLessonReview.tsx','삭제'],['TeacherAcademicManager.tsx','삭제']];
 for(const [f,text] of danger)assert.match(read(f),new RegExp(`confirmText: ?'${text}', ?tone: ?'danger'`),`${f} ${text}`);
 const dialog=read('ConfirmDialog.tsx');
 assert.match(dialog,/\(danger\|\|leave\?cancel:ok\)\.current\?\.focus\(\)/,'취소 is focused on danger');
 assert.match(dialog,/confirm-modal\$\{danger\?' is-danger':''\}/);
});
test('no browser confirm is left in the teacher screens; unsaved input asks 계속 작성 / 버리기',()=>{
 const dir=new URL('../src/components/teacher/',import.meta.url);
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.tsx')))assert.doesNotMatch(fs.readFileSync(new URL(f,dir),'utf8'),/window\.confirm\(/,f);
 const dialog=fs.readFileSync(new URL('ConfirmDialog.tsx',dir),'utf8');
 assert.match(dialog,/cancelText:'계속 작성',tone:'leave'/);assert.match(dialog,/\(danger\|\|leave\?cancel:ok\)/);
 const ws=fs.readFileSync(new URL('TeacherWorkspace.tsx',dir),'utf8');
 assert.match(ws,/title="수업 작성" onClose=\{async\(\)=>\{if\(!await leaveLessonGuard\(\)\)return;/,'closing 수업 작성 offers 저장하고 이동');
 assert.match(ws,/guarded\(\(\)=>selectStudent\(managementStudentKey,/,'opening 수업 작성 from 학생 관리 is guarded');
});
test('shortcuts: Ctrl/⌘+S saves, Ctrl/⌘+Enter publishes; the grid asks before publishing',async()=>{
 const {lessonShortcut,ShortcutKey}=await import('../src/components/teacher/LessonActionBar');
 const key=(k:any)=>({ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...k});
 assert.equal(lessonShortcut(key({ctrlKey:true,code:'KeyS',key:'s'})),'save');
 assert.equal(lessonShortcut(key({metaKey:true,code:'Enter',key:'Enter'})),'publish');
 assert.equal(lessonShortcut(key({ctrlKey:true,code:'NumpadEnter',key:'Enter'})),'publish');
 assert.equal(lessonShortcut(key({code:'Enter',key:'Enter'})),null,'plain Enter types a new line');
 assert.equal(lessonShortcut(key({ctrlKey:true,shiftKey:true,code:'Enter',key:'Enter'})),null);
 assert.equal(lessonShortcut(key({ctrlKey:true,code:'KeyD',key:'d'})),null);
 assert.equal(renderToStaticMarkup(<ShortcutKey keys="S" mac={false}/>),'<kbd class="lesson-kbd" aria-hidden="true">Ctrl S</kbd>');
 assert.match(renderToStaticMarkup(<ShortcutKey keys="Enter" mac/>),/>⌘↵</);
 const css=fs.readFileSync(new URL('../src/components/teacher/teacherWorkspace.css',import.meta.url),'utf8');
 assert.match(css,/\.teacher-workspace\.workspace-mobile \.lesson-kbd\{display:none\}/);assert.match(css,/@media \(pointer:coarse\)\{\.teacher-workspace \.lesson-kbd\{display:none\}\}/,'no shortcut keys on phones');
 const grid=fs.readFileSync(new URL('../src/components/teacher/TeacherLessonGrid.tsx',import.meta.url),'utf8');
 assert.match(grid,/gridPublish\.current=editorOpen&&active\?\(\)=>\{const row=rows\[activeStudent\];if\(!row\|\|row\.pending\|\|row\.loading\|\|isRecordBusy\(row\.id\)\|\|!gridCanSubmit\(row\)\)return;void askConfirm\(\{title:'리포트에 반영할까요\?'/);
 assert.match(grid,/\.then\(ok=>\{if\(ok\)void submitRows\('publish',\[row\.id\]\);\}\);\}:null;/);
 const ws=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 // A held key repeats keydown: both save and publish run once; the browser's own Ctrl+S is still blocked.
 for(const [src,save,publish] of [[ws,'saveShortcut.current?.()','publishShortcut.current?.()'],[grid,'gridSave.current()','gridPublish.current?.()']] as const){
  const handler=src.slice(src.indexOf('const shortcut=lessonShortcut(e);'),src.indexOf("window.addEventListener('keydown',onKey)"));
  const guard=handler.indexOf('e.preventDefault();if(e.repeat)return;');
  assert.ok(guard>0,'repeat is dropped right after preventDefault');
  assert.ok(handler.indexOf(save)>guard&&handler.indexOf(publish)>guard,'save and publish both come after the repeat guard');
  assert.doesNotMatch(handler,/!e\.repeat/,'no branch-only repeat check left');
 }
});
