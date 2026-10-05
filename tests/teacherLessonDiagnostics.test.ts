import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {assertLessonNotionFields,lessonSyncWarning} from '../api/_lib/teacherLessonDiagnostics.js';
import {workspaceError} from '../api/_lib/teacherWorkspaceError.js';
test('missing lesson properties show exact fields instead of generic schema error',()=>{let caught:unknown;try{assertLessonNotionFields({properties:{학생:{}}},{학생:{},'앱 기록 ID':{},과목:{}});}catch(e){caught=e;}const failure=workspaceError(caught,'lesson-reflection');assert.equal(failure.body.error,'NOTION_SCHEMA_SETUP_REQUIRED');assert.match(failure.body.message!,/앱 기록 ID, 과목/);assert.match(lessonSyncWarning(failure),/노션 저장 대기/);assert.match(lessonSyncWarning(failure),new RegExp(failure.body.diagnosticId));});
test('lesson input diagnostic names invalid field and excludes supplied personal value',()=>{const parsed=z.object({total:z.number().positive()}).safeParse({total:'private input'});assert.equal(parsed.success,false);if(parsed.success)return;const failure=workspaceError(parsed.error,'lesson-draft-validation');assert.equal(failure.status,400);assert.match(failure.body.message!,/일반 테스트 문항 수/);assert.ok(!failure.body.message?.includes('private input'));});
test('matching schema passes; unrelated validation retains general message',()=>{assert.doesNotThrow(()=>assertLessonNotionFields({properties:{학생:{}}},{학생:{}}));const parsed=z.object({total:z.number()}).safeParse({total:'private'});if(parsed.success)return;assert.equal(workspaceError(parsed.error,'student-registration').body.message,'입력한 값과 중복된 교재 선택을 확인해 주세요.');});
