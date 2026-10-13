import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {teacherTransferReasons} from '../src/lib/studentEnrollment';
const read=(f:string)=>fs.readFileSync(new URL(`../src/components/teacher/${f}`,import.meta.url),'utf8');

test('수강 관리: a reason is asked only when an existing teacher leaves a continuing subject; 기타 has an optional note',()=>{
 assert.deepEqual([...teacherTransferReasons],['이사·캠퍼스 이동','시간 변경','학생·학부모 요청','학원 사정','기타']);
 const src=read('StudentEnrollmentEditor.tsx');
 assert.match(src,/value\.status !== '중단' \? \(row\?\.teachers \|\| \[\]\)\.filter\(t => value\.removeTeacherIds\.includes\(t\.id\)\)/,'not for a stop, only for teachers already assigned');
 assert.match(src,/disabled=\{busy \|\| \(!dirty && !intent\) \|\| \(reasonMissing && !intent\)\}/,'cannot save without the reason');
 assert.match(src,/value\.transferReason === '기타' \? <input className="enr-transfer-note" aria-label="기타 사유 메모 \(선택\)"/);
 assert.doesNotMatch(src,/enr-transfer-note[^>]*required/,'the note is optional');
 assert.match(src,/structuredClone\(withoutUnchangedCampus\(needsReason \? value : \{ \.\.\.value, transferReason: null, transferNote: '' \}\)\)/,'no stale reason is sent; campus only when changed');
});
test('관리자 설정 → 선생님: counts on the cards, records only inside a teacher dialog; nothing elsewhere',()=>{
 const src=read('TeacherManager.tsx');
 assert.match(src,/request\('read:teacher-transfers'\)/);
 assert.match(src,/이번 달 담당 변경/);assert.match(src,/이번 달 받음/);assert.match(src,/is-asked/);
 assert.equal((src.match(/className="tt-list"/g)||[]).length,1,'one record list, in TeacherEditor');
 assert.ok(src.indexOf('className="tt-list"')>src.indexOf('function TeacherEditor('),'the list lives in the teacher dialog');
 for(const f of fs.readdirSync(new URL('../src/components/teacher/',import.meta.url)).filter(f=>f.endsWith('.tsx')&&f!=='TeacherManager.tsx'))assert.doesNotMatch(read(f),/read:teacher-transfers/,f);
});
test('teacher dialog: 담당 학생 and 담당 변경 기록 are paged 10 at a time; bulk buttons say they cover every match',()=>{
 const src=read('TeacherManager.tsx');
 assert.match(src,/const STUDENTS_PER_PAGE=10;/);
 assert.match(src,/pageRows=shown\.slice\(\(current-1\)\*STUDENTS_PER_PAGE,current\*STUDENTS_PER_PAGE\)/);assert.match(src,/<div className="gs-rows is-two">\{pageRows\.map\(/,'two per row');
 assert.match(src,/useEffect\(\(\)=>setPage\(1\),\[query,filter,subject\]\)/,'a new search starts from page 1');
 assert.match(src,/mine\.slice\(\(moveCurrent-1\)\*STUDENTS_PER_PAGE,moveCurrent\*STUDENTS_PER_PAGE\)/);
 assert.equal((src.match(/className="review-pagination"/g)||[]).length,2);
 assert.match(src,/조건에 맞는 \{shown\.length\}명 모두 \{subject\} 담당/);assert.doesNotMatch(src,/보이는 학생/);
});
test('teacher dialog: a student taught by another teacher shows that teacher by name, without the subject word',async()=>{
 const {shortTeacherName}=await import('../src/lib/teacherName');
 assert.equal(shortTeacherName('영어 이지원T'),'이지원T');assert.equal(shortTeacherName('수학  김선생'),'김선생');assert.equal(shortTeacherName('이지원T'),'이지원T');assert.equal(shortTeacherName('영어'),'영어','a bare subject is left as is');
 const src=read('TeacherManager.tsx');assert.doesNotMatch(src,/다른 선생님도 담당/);assert.match(src,/\{othersBy\.get\(s\.studentKey\)\?\.join\(', '\)\|\|''\}/);
});
test('담당 변경 record wording: new teacher, co-teacher who stays, nobody left, or an older record',async()=>{
 const {transferTarget}=await import('../src/lib/teacherName');const who=(u:string[])=>u.join(', ');
 assert.equal(transferTarget({toUids:['B'],afterUids:['B']},who),'B');
 assert.equal(transferTarget({toUids:[],afterUids:['B']},who),'B','A removed, co-teacher B stays');
 assert.equal(transferTarget({toUids:[],afterUids:[]},who),'담당 없음');
 assert.equal(transferTarget({toUids:[],afterUids:null},who),'추가 담당 없음','record without the full list');
});
test('a failed transfer read is shown as failed with 다시 시도, never as 0 or 변경 없음',()=>{
 const src=read('TeacherManager.tsx');
 assert.match(src,/\(\)=>\{setTransfers\(null\);setTransferState\('failed'\);\}/,'failure keeps transfers null');
 assert.doesNotMatch(src,/setTransfers\(\[\]\)/,'no empty list on failure');
 assert.match(src,/transferState==='failed'&&<p className="gs-note tt-failed" role="status">담당 변경 기록을 불러오지 못했어요\. <button type="button" className="gs-link" onClick=\{\(\)=>void loadTransfers\(\)\}>다시 시도<\/button>/);
 assert.match(src,/\{transfers&&<div className="rv-stat"><b>\{monthTransfers\.length\}<\/b>/,'the count only once loaded');
 assert.match(src,/\{transfers&&\(\(\)=>\{const got=/,'card badges only once loaded');
 assert.match(src,/transferState==='failed'&&<section className="gs-sec"><h3>담당 변경 기록<\/h3>/,'the dialog says so too');
});
test('co-teacher dropped: "~~A~~ + B" with full labels, no arrow and no 계속 담당',async()=>{
 const {isCoTeacherDrop}=await import('../src/lib/teacherName');
 assert.equal(isCoTeacherDrop({toUids:[],afterUids:['B']}),true);assert.equal(isCoTeacherDrop({toUids:['C'],afterUids:['B','C']}),false,'a new teacher keeps the arrow');assert.equal(isCoTeacherDrop({toUids:[],afterUids:[]}),false);assert.equal(isCoTeacherDrop({toUids:[],afterUids:null}),false);
 const src=read('TeacherManager.tsx');
 assert.match(src,/isCoTeacherDrop\(r\)\?<><s className="tt-dropped">\{who\(r\.fromUids\)\}<\/s> \+ \{who\(r\.afterUids!\)\}<\/>/);
 assert.match(src,/const who=\(uids:string\[\]\)=>uids\.length\?uids\.map\(teacherName\)/,'records keep the full label with the subject (a teacher may teach several)');
 assert.doesNotMatch(src+fs.readFileSync(new URL('../src/lib/teacherName.ts',import.meta.url),'utf8'),/계속 담당/);
});
test('the teacher dialog retries the transfer read itself (no "창을 닫고 다시 열거나")',()=>{
 const src=read('TeacherManager.tsx');
 assert.doesNotMatch(src,/창을 닫고 다시 열거나/);
 assert.match(src,/onRetryTransfers=\{\(\)=>void loadTransfers\(\)\}/);
 assert.match(src,/<h3>담당 변경 기록<\/h3><p className="gs-note tt-failed" role="status">담당 변경 기록을 불러오지 못했어요\. <button type="button" className="gs-link" onClick=\{onRetryTransfers\}>다시 시도<\/button>/);
});
test('teacher dialog asks one reason when students are taken off (not for a stopped subject) and sends it with the save',()=>{
 const src=read('TeacherManager.tsx');
 assert.match(src,/statusOf\(s\.studentKey,s\.subject\)!=='중단'/);
 assert.match(src,/reason=await askTransferReason\(`\$\{teacher\.label\} 선생님 담당에서 빼는 이유`/);assert.match(src,/if\(!reason\)return;/,'취소 saves nothing');
 assert.match(src,/\.\.\.\(reason\?\{transferReason:reason\.reason,transferNote:reason\.note\}:\{\}\)/);
 const dialog=read('TransferReasonDialog.tsx');assert.match(dialog,/disabled=\{!reason\}/,'저장 waits for a reason');assert.match(dialog,/reason==='기타'&&<input className="confirm-modal-note" aria-label="기타 사유 메모 \(선택\)"/);
});
test('일괄 상 and 일괄 중 in both editors; the 회차 hint is short with the full text as tooltip',async()=>{
 for(const f of ['TeacherWorkspace.tsx','TeacherLessonGrid.tsx']){const src=read(f);assert.match(src,/\(\['상','중'\] as const\)\.map\(level=>/,f);assert.match(src,/attitude:level,homework:level/,f);assert.match(src,/출석·태도·숙제 일괄 \{level\}/,f);}
 const {shortRoundHint}=await import('../src/lib/sessionNumbers');
 assert.equal(shortRoundHint('자동 입력 · 직전 6.7회차(10/06) +1'),'직전 6.7 +1');assert.equal(shortRoundHint('자동 입력 · 2026-10 월별 시작 0 +0.9'),'월 첫 수업 +0.9');assert.equal(shortRoundHint('자동 입력 · 2026-10 월별 시작 0 +1','자습'),'월 첫 자습 +1','자습 says 자습');assert.equal(shortRoundHint(''),'');
 assert.match(read('LessonAcademyFields.tsx'),/title=\{roundHints\[round\]\|\|undefined\}>\{shortRoundHint\(roundHints\[round\]\|\|'',title\)\}/);
});
test('선생님 추가 (no app account): form fields, label preview, card with subjects·phone and 앱 미연결; initials helpers',async()=>{
 const React=(await import('react')).default;const {renderToStaticMarkup}=await import('react-dom/server');
 const {default:OfflineTeacherForm}=await import('../src/components/teacher/OfflineTeacherForm');
 const form=renderToStaticMarkup(React.createElement(OfflineTeacherForm,{busy:false,onClose:()=>{},onSubmit:async()=>{}}));
 for(const t of ['이름','담당 과목','연락처','메모'])assert.ok(form.includes(t),t);assert.match(form,/메모 <span class="gs-opt">\(선택\)<\/span>/);
 const {subjectInitials,offlineTeacherLabel,shortTeacherName}=await import('../src/lib/teacherName');
 assert.equal(subjectInitials(['수학','국어','영어']),'국영수');assert.equal(offlineTeacherLabel('박민지 ',['영어','국어']),'국영 박민지T');assert.equal(offlineTeacherLabel('박민지T',[]),'박민지T');
 assert.equal(shortTeacherName('국영 박민지T'),'박민지T');assert.equal(shortTeacherName('영어 이지원T'),'이지원T');assert.equal(shortTeacherName('한지민T'),'한지민T','a name starting with 한 is kept');
 const {default:TeacherManager}=await import('../src/components/teacher/TeacherManager');
 const html=renderToStaticMarkup(React.createElement(TeacherManager,{data:{admin:true,uid:'admin',students:[],staff:[{uid:'offline-1',name:'국영 박민지T'}],access:[{uid:'offline-1',workspaceLabel:'국영 박민지T',offline:true,phone:'01012345678',subjects:['국어','영어'],scopes:[]}]},request:async()=>({transfers:[]}),act:async(f:any)=>{await f();},busy:false,refresh:async()=>{}}));
 assert.match(html,/\+ 선생님 추가/);assert.match(html,/국어·영어 · 01012345678/);assert.match(html,/앱 미연결/);
});
test('앱 계정 연결: only on an offline teacher, only accounts with 선생님 권한 and no teacher record, after saving, with a confirm',async()=>{
 const fsm=await import('node:fs'),src=fsm.readFileSync(new URL('../src/components/teacher/TeacherManager.tsx',import.meta.url),'utf8');
 assert.match(src,/const linkable=offline&&\(data\.admin\|\|data\.principal\)\?\(\(data\.access\|\|\[\]\) as any\[\]\)\.filter\(a=>!a\.offline&&!a\.disabled&&\(!a\.notionTeacherPageId\|\|a\.appTeacherRow&&!a\.linkedOfflineUid\)&&a\.academyId==='main'&&a\.uid!==data\.uid\)/);
 assert.match(src,/const appRow=!offline&&Boolean\(teacher\.profile\)&&\(Boolean\(teacher\.profile\?\.appTeacherRow\)\|\|!teacher\.profile\?\.notionTeacherPageId\)/,'담당 과목 for an app-made 명부 줄');
 assert.match(src,/\.\.\.\(appRow\?\{teacherSubjects:teaches\}:\{\}\)/);
 assert.match(src,/disabled=\{busy\|\|changed\|\|!linkTo\}/,'unsaved edits are saved first');
 assert.match(src,/askConfirm\(\{title:'이 계정과 연결할까요\?'[\s\S]*?confirmText:'연결하기',icon:'link'\}\)\)return;await act\(async\(\)=>\{await request\('link-offline-teacher',\{offlineUid:editing\.uid,uid:account\.uid\}\);/);
 const ws=fsm.readFileSync(new URL('../api/teacher/workspace.ts',import.meta.url),'utf8');
 assert.match(ws,/if\(a\.offline&&!a\.linkedUid&&!staff\.some/,'a linked offline record is no longer listed as a teacher');
 assert.match(ws,/body\.action==='link-offline-teacher'\)\{failureStage='offline-teacher-link';[\s\S]*?invalidateTeacherMutation\('grant'\);teacherReadCache\.clear\(\);/);
});
