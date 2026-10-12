import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTeacherMessage,renderTeacherMessageParts,missingParts,missingKeys,fillMessageVariable,messageSize,messageVariables} from '../src/lib/teacherMessage.js';

const template='{{학생 호칭}} 오늘 수업\n출결: {{출결}}\n테스트: {{테스트}}\n다음 상담: {{상담일}}';
const variables=messageVariables({displayName:'김경현 (용죽고1)',studentSalutation:'경현이'},{attendance:'출석'});
test('preview parts join to exactly the rendered body; filled and missing values are marked; dropped lines stay dropped',()=>{
 const parts=renderTeacherMessageParts(template,variables),body=renderTeacherMessage(template,variables).body;
 assert.equal(parts.map(p=>p.text).join(''),body);
 assert.deepEqual(parts.filter(p=>p.kind==='filled').map(p=>[p.key,p.text]),[['학생 호칭','경현이'],['출결','출석']]);
 assert.deepEqual(parts.filter(p=>p.kind==='missing').map(p=>p.key),['상담일']);
 assert.ok(!body.includes('테스트:'),'the blank optional line is dropped as before');
});
test('missing values after edits, filling one, and SMS/LMS size',()=>{
 const edited='경현이 안녕하세요 {{상담일}} {{ 상담일 }} {{과제}}';
 assert.deepEqual(missingKeys(edited),['상담일','과제']);
 assert.deepEqual(missingParts(edited).filter(p=>p.kind==='missing').map(p=>p.key),['상담일','상담일','과제']);
 assert.equal(fillMessageVariable(edited,'상담일','10월 20일'),'경현이 안녕하세요 10월 20일 10월 20일 {{과제}}');
 assert.deepEqual(messageSize('가'.repeat(45)),{bytes:90,kind:'SMS',limit:90,over:false});
 assert.equal(messageSize('가'.repeat(46)).kind,'LMS');assert.equal(messageSize('a'.repeat(2001)).over,true);
});
