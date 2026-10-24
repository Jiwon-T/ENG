import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('학생 관리 › 신입생: the 원서 opens in the right column with 원서 / 시범 수업 기록 / 상담 일정·메모 under the next-step buttons', async () => {
  const manager = await fs.readFile('src/components/teacher/StudentRegistrationManager.tsx', 'utf8');
  assert.match(manager, /paneTarget \? \(open \? createPortal\(paneView,paneTarget\) : null\) : <WorkspaceDialog/, 'a pop-up only without the right column');
  assert.match(manager, /\['trial','시범 수업 기록'\]/);
  assert.match(manager, /\['consult','상담 일정·메모'\]/);
  assert.match(manager, /actions\(current\)/);
  assert.match(manager, />시범 수업 쓰기</);
  assert.match(manager, /<div hidden=\{paneTab!=='form'\}>\{formBody\}<\/div>/, 'the 원서 stays as written while another tab is shown');
  const workspace = await fs.readFile('src/components/teacher/TeacherWorkspace.tsx', 'utf8');
  assert.match(workspace, /<div ref=\{setIntakeEl\} hidden=\{!intakeOpen\}\/>/);
  assert.match(workspace, /initialSection="lessons"/);
  assert.match(workspace, /const change=\(\)=>\{intakePane\.current\?\.\(\);/, 'choosing a student closes the 원서 (after its own ask)');
});
