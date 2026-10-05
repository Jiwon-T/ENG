import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentRegistrationForm from '../src/components/teacher/StudentRegistrationForm';
import {emptyRegistration} from '../src/lib/studentRegistration';
import {registrationSaveIntent,registrationFailureIsDefinitive} from '../src/lib/studentRegistrationSave';
import {studentRegistrationSchema} from '../api/_lib/teacherStudentRegistration';
test('등록 화면의 과목 상태·연락처·수강료 및 읽기 전용 재시도',()=>{
    const value=emptyRegistration();value.enrollments[0]={...value.enrollments[0],status:'중단',endDate:'2026-10-06'};
    const html=renderToStaticMarkup(<StudentRegistrationForm value={value} onChange={()=>{}} onSubmit={()=>{}} disabled retrying/>);
    for(const label of ['학생 이름','학교','학년','보호자 연락처','보호자 이름','수강료','납부기한','영어 중단일','저장 결과 확인·재시도'])assert.ok(html.includes(label));
    assert.ok(html.includes('fieldset disabled'));assert.ok(html.includes('type="tel"'));assert.ok(html.includes('type="date"'));
    const submit=html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];assert.ok(submit);assert.equal(submit.includes('disabled'),false);
    const busy=renderToStaticMarkup(<StudentRegistrationForm value={value} onChange={()=>{}} onSubmit={()=>{}} busy/>);assert.ok(busy.includes('저장 중…'));assert.ok(busy.match(/<button[^>]*disabled/));
});
test('재시도 payload는 입력 변경과 독립적이며 오류 응답을 분류함',()=>{
    const value=emptyRegistration();value.name='학생';const intent=registrationSaveIntent(value,'11111111-1111-4111-8111-111111111111',2);
    value.name='바뀐 이름';value.enrollments[0].status='중단';
    assert.equal(intent.data.name,'학생');assert.equal(intent.data.enrollments[0].status,'등록');assert.equal(intent.revision,2);assert.ok(intent.writeId);
    for(const status of [400,401,403,404,409,422])assert.equal(registrationFailureIsDefinitive(status),true);
    for(const status of [0,200,408,425,429,500,502,503])assert.equal(registrationFailureIsDefinitive(status),false);
});
test('실제 노션 학년 옵션 및 납부기한 텍스트, 대기 수강 입력 허용',()=>{
    const value=emptyRegistration();value.name='학생';value.grade='고1';value.tuition=0;value.paymentDeadline='매월 5일';value.enrollments[0].status='대기';
    assert.equal(studentRegistrationSchema.parse(value).paymentDeadline,'매월 5일');assert.equal(studentRegistrationSchema.parse(value).tuition,0);
    assert.equal(studentRegistrationSchema.safeParse({...value,grade:'대1'}).success,false);
    assert.equal(studentRegistrationSchema.safeParse({...value,tuition:-1}).success,false);
});

test('담당 및 소속반 선택은 해당 과목·담당의 반만 표시',()=>{
 const value=emptyRegistration();value.enrollments[0]={...value.enrollments[0],teacherUid:'teacher',classIds:[]};
 const options:any={teachers:[{uid:'teacher',name:'영어 선생님',subjects:['영어']},{uid:'math',name:'수학 선생님',subjects:['수학']}],classes:[{id:'one',name:'영어반',subject:'영어',teacherUids:['teacher']},{id:'two',name:'다른 담당 반',subject:'영어',teacherUids:['other']}]};
 const html=renderToStaticMarkup(<StudentRegistrationForm value={value} options={options} onChange={()=>{}} onSubmit={()=>{}}/>);
 assert.ok(html.includes('영어 담당 선생님'));assert.ok(html.includes('영어 선생님'));assert.ok(html.includes('영어반'));
 assert.equal(html.includes('수학 선생님'),false);assert.equal(html.includes('다른 담당 반'),false);
});
