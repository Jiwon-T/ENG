import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentProfileForm from '../src/components/teacher/StudentProfileForm';
import {studentProfileSchema,profileProperties} from '../api/_lib/teacherStudentProfile';
const value={displayName:'학생(학교 고1)',school:'학교',grade:'고1',studentPhone:'',guardianPhone:'01000000000',guardianName:'보호자',studentSalutation:'학생',tuition:0,paymentDeadline:'매월 5일'};
test('profile form preserves original display names, explains PIN renewal, labels inputs and leaves readonly retry enabled',()=>{
 const html=renderToStaticMarkup(<StudentProfileForm value={value} disabled retrying onChange={()=>{}} onSubmit={()=>{}}/>);
 for(const label of ['학생 표시 이름','학교','학년','보호자 연락처','보호자 이름','학생 호칭','수강료','납부기한','새 번호 뒤 4자리','저장 결과 확인·재시도'])assert.ok(html.includes(label));
 assert.ok(html.includes('학생(학교 고1)'));assert.ok(html.includes('fieldset disabled'));assert.ok(html.includes('type="tel"'));
 const submit=html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];assert.ok(submit);assert.equal(submit.includes('disabled'),false);
 const busy=renderToStaticMarkup(<StudentProfileForm value={value} busy onChange={()=>{}} onSubmit={()=>{}}/>);assert.ok(busy.includes('저장·반영 중'));assert.ok(busy.match(/<button[^>]*disabled/));
});
test('profile validation distinguishes zero and cleared fees, normalizes phones and prevents identity overrides',()=>{
 assert.equal(studentProfileSchema.parse(value).tuition,0);
 assert.equal(studentProfileSchema.parse({...value,tuition:null}).tuition,null);
 assert.equal(studentProfileSchema.parse({...value,guardianPhone:'010-0000-0000'}).guardianPhone,'01000000000');
 for(const change of [{displayName:'   '},{guardianPhone:'unknown'},{tuition:-1},{tuition:0.5},{internalStudentId:'hijack'},{firebaseUid:'owner'}])assert.equal(studentProfileSchema.safeParse({...value,...change}).success,false);
 assert.deepEqual(profileProperties(value,value),{});
 assert.deepEqual(profileProperties({...value,tuition:null},value),{'수강료':{number:null}});
});
