import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceError} from '../api/_lib/teacherWorkspaceError.js';

// Codes the app-only paths still raise: each has its own message, none of them talks about Notion.
test('app-only error codes reach the screen with app wording, never Notion',()=>{
 for(const code of ['CORE_NOT_READY','LESSON_APP_REQUIRED','TEMPLATE_APP_REQUIRED','LESSON_APP_ACTIVE','ACADEMIC_APP_ACTIVE','SCHEDULE_APP_ACTIVE','INVALID_TEACHER',
  'NOTION_EDIT_CONFLICT','NOTION_SOURCE_MISMATCH','NOTION_WRITE_RESULT_UNCERTAIN','DUPLICATE_NOTION_RECORD','NOTION_REGISTRATION_SOURCE_REQUIRED','LESSON_TRASH_EXPIRED']){
  const r:any=workspaceError(Error(code),'test');
  assert.equal(r.body.error,code,code);assert.ok(r.body.message,code+' has a message');
  assert.equal(/notion|노션/i.test(r.body.message),false,code+': '+r.body.message);
 }
});
