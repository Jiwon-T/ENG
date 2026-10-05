import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonSpecialNoteProperties, readLessonSpecialNote} from '../api/_lib/lessonSpecialNote.ts';
test('special notes write canonical Notion property with optional legacy mirror, including clearing',()=>{
 const schema={'특이사항':{type:'rich_text'},'앱 특이사항':{type:'rich_text'}};
 const properties=lessonSpecialNoteProperties(schema,'수업 중 질문\n추가 복습');
 assert.equal(readLessonSpecialNote(properties),'수업 중 질문\n추가 복습');
 assert.deepEqual(properties['특이사항'],properties['앱 특이사항']);
 assert.deepEqual(lessonSpecialNoteProperties(schema,'')['특이사항'],{rich_text:[]});
 assert.deepEqual(Object.keys(lessonSpecialNoteProperties({'특이사항':{type:'rich_text'}},'내용')),['특이사항']);
 assert.throws(()=>lessonSpecialNoteProperties({'특이사항':{type:'formula'}},'내용'),/NOTION_SCHEMA_SETUP_REQUIRED/);
});
test('canonical notes take precedence and existing legacy records remain readable',()=>{
 const rich=(value:string)=>({rich_text:[{plain_text:value}]});
 assert.equal(readLessonSpecialNote({'특이사항':rich('새 기록'),'앱 특이사항':rich('기존 기록')}),'새 기록');
 assert.equal(readLessonSpecialNote({'특이사항':rich(''),'앱 특이사항':rich('기존 기록')}),'기존 기록');
});
