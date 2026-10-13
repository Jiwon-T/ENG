import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {protectLeave,leaveProtectionCount} from '../src/lib/leaveProtection';

test('closing the tab asks while any screen has unsaved input, and stops asking when none has',()=>{
 const listeners=new Set<any>();const g=globalThis as any,had='window' in g,old=g.window;
 g.window={addEventListener:(type:string,fn:any)=>{if(type==='beforeunload')listeners.add(fn);},removeEventListener:(type:string,fn:any)=>{if(type==='beforeunload')listeners.delete(fn);}};
 try{
  const a=protectLeave(),b=protectLeave();
  assert.equal(listeners.size,1,'one listener for any number of dirty screens');assert.equal(leaveProtectionCount(),2);
  const event={prevented:false,returnValue:'x',preventDefault(){this.prevented=true;}};[...listeners][0](event);
  assert.equal(event.prevented,true);assert.equal(event.returnValue,'','the browser shows its leave dialog');
  a();a();assert.equal(leaveProtectionCount(),1,'releasing twice counts once');assert.equal(listeners.size,1);
  b();assert.equal(listeners.size,0,'nothing unsaved: closing the tab does not ask');
 }finally{if(had)g.window=old;else delete g.window;}
});
test('every editor with an unsaved-input confirm also protects the tab close',()=>{
 const dir=new URL('../src/components/teacher/',import.meta.url);
 const expected:Record<string,string>={'TeacherWorkspace.tsx':'lessonDirty||scheduleDirty','TeacherLessonGrid.tsx':'rows.some(','StudentProfileEditor.tsx':'dirty&&!intent','StudentAdmissionEditor.tsx':'dirty','StudentEnrollmentEditor.tsx':'dirty && !intent','TeacherMessageComposer.tsx':'body.trim()','StudentRegistrationManager.tsx':'dirty','AcademicBatchEditor.tsx':'rows.some(','TeacherClassManager.tsx':'editorOpen&&','TeacherManager.tsx':'changed','AppTemplateManager.tsx':'dirty','TuitionCalculator.tsx':'unsaved','TeacherPayroll.tsx':'unsaved','TeacherOnlineLearning.tsx':'text.trim()','TeacherScheduleEditor.tsx':'baseline','TeacherAcademicManager.tsx':'dialog&&changed'};
 for(const [f,expr] of Object.entries(expected)){const call=fs.readFileSync(new URL(f,dir),'utf8').match(/useLeaveProtection\(([^;]*)\);/);assert.ok(call&&call[1].includes(expr),f);}
});
test('여러 학생 editor has the 3단계 save state, 반영 primary when ready, Ctrl/⌘+S; the student report confirm uses the app modal',()=>{
 const grid=fs.readFileSync(new URL('../src/components/teacher/TeacherLessonGrid.tsx',import.meta.url),'utf8');
 assert.match(grid,/<LessonSaveStatus record=\{\{stage:row\.stage/);
 assert.match(grid,/<LessonActionBar statusInTitle more=\{[^]*?\} savedAt=/);
 assert.match(grid,/className=\{gridCanSubmit\(row\)\?'primary-button':'small-button'\}[^>]*>[^]*?반영<ShortcutKey keys="Enter"\/><\/button>/);
 assert.match(grid,/gridSave\.current=editorOpen&&active\?/);assert.match(grid,/dialog\.confirm-modal\[open\]/);
 const report=fs.readFileSync(new URL('../src/components/student/LearningReport.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(report,/window\.confirm\(/);assert.match(report,/askConfirm\(\{ title: '과제를 다 했나요\?'/);
 const main=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 assert.match(main,/import '\.\/components\/teacher\/confirmDialog\.css';/,'modal styles load app-wide (student screens too)');
});
test('phones: one row 저장 / 반영 / ⋯, with 새로고침 and 일지 삭제 in the ⋯ menu (single and 여러 학생)',()=>{
 const bar=fs.readFileSync(new URL('../src/components/teacher/LessonActionBar.tsx',import.meta.url),'utf8');
 assert.match(bar,/<details className="lesson-action-more"><summary aria-label="더보기"/);
 const ws=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ws,/more=\{<><button type="button" className="lesson-more-item"[^]*?새로고침<\/button><LessonDeleteButton/);
 const grid=fs.readFileSync(new URL('../src/components/teacher/TeacherLessonGrid.tsx',import.meta.url),'utf8');
 assert.match(grid,/more=\{<button type="button" className="lesson-more-item" onClick=\{checkStatus\}>/);assert.match(grid,/aria-label="반영 상태 확인" title="반영 상태 확인" onClick=\{checkStatus\}/);
});
test('여러 학생: typed 공통 입력 not yet applied also protects the tab close; the hint is just the shortcut',()=>{
 const grid=fs.readFileSync(new URL('../src/components/teacher/TeacherLessonGrid.tsx',import.meta.url),'utf8');
 const call=grid.match(/useLeaveProtection\((.*)\);/);assert.ok(call&&call[1].includes('Object.values(common).some('),'common input counts');
 assert.ok(grid.indexOf('useLeaveProtection(')>grid.indexOf('const [common, setCommon] = useState('),'after common is declared');
 const ws=fs.readFileSync(new URL('../src/components/teacher/TeacherWorkspace.tsx',import.meta.url),'utf8');
 for(const src of [grid,ws]){assert.doesNotMatch(src,/'Ctrl\+S'\} 저장/);assert.doesNotMatch(src,/ShortcutHint/);assert.match(src,/저장<ShortcutKey keys="S"\/><\/button>/);assert.match(src,/반영<ShortcutKey keys="Enter"\/><\/button>/);}
});
test('rosy peach everywhere: no hot pink left in the teacher styles; the confirm button uses the app primary look',()=>{
 for(const f of ['reviewRedesign.css','confirmDialog.css']){const css=fs.readFileSync(new URL(`../src/components/teacher/${f}`,import.meta.url),'utf8');assert.doesNotMatch(css,/#f472b6|#ec4899|#be185d|#fce7f3|#fff1f3|#fbcfe8|#f9a8c0|#db2777/i,f);}
 const dialog=fs.readFileSync(new URL('../src/components/teacher/confirmDialog.css',import.meta.url),'utf8');
 assert.match(dialog,/\.confirm-modal-ok\{background:#f5a3a8;color:#5e1e2a;/,'light solid with dark text, like .primary-button');
 assert.match(dialog,/\.confirm-modal\.is-danger \.confirm-modal-ok\{background:#dc2626;color:#fff;/,'danger stays red');
});
