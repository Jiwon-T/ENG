import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StudentProfileForm from '../src/components/teacher/StudentProfileForm';
import {studentProfileSchema,profileProperties} from '../api/_lib/teacherStudentProfile';
const value={displayName:'학생(학교 고1)',school:'학교',grade:'고1',studentPhone:'',guardianPhone:'01000000000',guardianName:'보호자',studentSalutation:'학생',tuition:0,paymentDeadline:'매월 5일',academyStartDate:''};
test('profile form preserves original display names, explains PIN renewal, labels inputs and leaves readonly retry enabled',()=>{
 const html=renderToStaticMarkup(<StudentProfileForm value={value} disabled retrying onChange={()=>{}} onSubmit={()=>{}}/>);
 for(const label of ['학생 표시 이름','학교','학년','보호자 연락처','학생 호칭','수강료','납부기한','새 번호 뒤 4자리','저장 결과 확인·재시도'])assert.ok(html.includes(label));
 assert.ok(!html.includes('보호자 이름')&&!html.includes('보호자 호칭'),'guardian name and salutation inputs are removed');
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
test('학원 등록일: optional date in 학생 정보, a small fill button only while empty, saved as a date property',()=>{
 const empty=renderToStaticMarkup(<StudentProfileForm value={value} firstSubjectStart="2025-03-04" onChange={()=>{}} onSubmit={()=>{}}/>);
 assert.ok(empty.includes('학원 등록일'));assert.ok(empty.includes('가장 이른 과목 시작일로 채우기'));assert.ok(empty.includes('2025-03-04'));
 const filled=renderToStaticMarkup(<StudentProfileForm value={{...value,academyStartDate:'2025-03-01'}} firstSubjectStart="2025-03-04" onChange={()=>{}} onSubmit={()=>{}}/>);
 assert.ok(!filled.includes('가장 이른 과목 시작일로 채우기'),'gone once there is a date');
 assert.ok(!renderToStaticMarkup(<StudentProfileForm value={value} onChange={()=>{}} onSubmit={()=>{}}/>).includes('채우기'),'no subject dates: no button');
 assert.deepEqual(profileProperties({...value,academyStartDate:'2025-03-01'},value),{'학원 등록일':{date:{start:'2025-03-01'}}});
 assert.deepEqual(profileProperties(value,{...value,academyStartDate:'2025-03-01'}),{'학원 등록일':{date:null}});
 assert.equal(studentProfileSchema.safeParse({...value,academyStartDate:'3월'}).success,false);assert.equal(studentProfileSchema.parse({...value,academyStartDate:undefined}).academyStartDate,'');
});
test('학교·학년·연락처 carry no (선택) mark (they are expected), other optional fields keep it',()=>{
 const html=renderToStaticMarkup(<StudentProfileForm value={value} onChange={()=>{}} onSubmit={()=>{}}/>);
 for(const label of ['학교','학년','학생 연락처','보호자 연락처'])assert.doesNotMatch(html,new RegExp(`>${label}<span[^>]*>\\(선택\\)`),label);
 assert.match(html,/>학생 호칭<span[^>]*>\(선택\)/);
});
test('학생 표시 이름 follows 학교 and 학년: the (학교학년) part changes, the name stays',async()=>{
 const {studentTitle,studentBaseName}=await import('../src/lib/studentRegistration');
 assert.equal(studentTitle('이용준','세교중학교','중2'),'이용준 (세교중2)');assert.equal(studentTitle('이용준','효명고','고1'),'이용준 (효명고1)');assert.equal(studentTitle('이용준','',''),'이용준');assert.equal(studentTitle('이용준','','중3'),'이용준 (중3)');
 assert.equal(studentBaseName('이용준 (세교중2)'),'이용준');assert.equal(studentBaseName('김 민수'),'김 민수');
 const fs=await import('node:fs'),src=fs.readFileSync(new URL('../src/components/teacher/StudentProfileForm.tsx',import.meta.url),'utf8');
 assert.match(src,/onChange=\{e=>changePlace\('school',e\.target\.value\)\}/);assert.match(src,/onChange=\{e=>changePlace\('grade',e\.target\.value\)\}/);
 assert.match(src,/displayName:studentTitle\(base,v\.school,v\.grade\)/);
});
