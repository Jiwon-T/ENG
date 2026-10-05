import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherMakeTrigger} from '../api/_lib/teacherMakeTrigger.ts';
test('trusted transmission properties accept regional Make links and rich text hyperlinks',()=>{
 assert.equal(teacherMakeTrigger({properties:{전송하기:{formula:{string:'전송 https://hook.eu1.make.com/abc123?pageId=page'}}}}),'https://hook.eu1.make.com/abc123?pageId=page');
 assert.equal(teacherMakeTrigger({properties:{전송:{url:'https://hook.us2.make.com/abc123?id=page'}}}),'https://hook.us2.make.com/abc123?id=page');
 assert.equal(teacherMakeTrigger({properties:{'반영 요청':{rich_text:[{text:{link:{url:'https://hook.eu2.make.com/abc123'}}}]}}}),'https://hook.eu2.make.com/abc123');
 for(const url of ['https://evil.test/abc','https://hook.eu1.make.com.evil.test/abc','https://hook.eu1.make.com/abc/extra'])assert.equal(teacherMakeTrigger({properties:{전송하기:{url}}}),null);
 assert.equal(teacherMakeTrigger({properties:{'수업 내용':{url:'https://hook.eu1.make.com/abc'}}}),null);
});
