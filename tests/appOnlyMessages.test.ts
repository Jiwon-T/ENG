import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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

// Every code the error module knows (and an unknown NOTION_* code, which falls back) is worded without Notion.
test('no workspace error message mentions Notion',()=>{
 const source=readFileSync(new URL('../api/_lib/teacherWorkspaceError.ts',import.meta.url),'utf8');
 const codes=[...new Set(source.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)),'NOTION_UNKNOWN'];
 for(const code of codes)for(const stage of ['test','workspace-data']){
  const message=String(workspaceError(Error(code),stage).body.message||'');
  assert.equal(/notion|노션/i.test(message),false,code+': '+message);
 }
 // the admin link routes write their own messages
 for(const route of ['report-slug','student-link']){
  const text=readFileSync(new URL(`../api/teacher/${route}.ts`,import.meta.url),'utf8');
  for(const [,message] of text.matchAll(/message:\s*'([^']*)'/g))assert.equal(/notion|노션/i.test(message),false,route+': '+message);
 }
});
