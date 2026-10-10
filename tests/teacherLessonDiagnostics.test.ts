import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {workspaceError} from '../api/_lib/teacherWorkspaceError.js';
test('lesson input diagnostic names invalid field and excludes supplied personal value',()=>{const parsed=z.object({total:z.number().positive()}).safeParse({total:'private input'});assert.equal(parsed.success,false);if(parsed.success)return;const failure=workspaceError(parsed.error,'lesson-draft-validation');assert.equal(failure.status,400);assert.match(failure.body.message!,/일반 테스트 문항 수/);assert.ok(!failure.body.message?.includes('private input'));});
