import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {studentRegistrationSchema} from '../api/_lib/teacherStudentRegistration.js';
import {registrationStudentProperties,registrationEnrollmentProperties} from '../api/_lib/studentRegistrationRows.js';
import fs from 'node:fs';
import StudentRegistrationForm from '../src/components/teacher/StudentRegistrationForm';
import {emptyRegistration} from '../src/lib/studentRegistration';
const input={name:'홍길동',enrollments:[{subject:'영어',status:'등록',startDate:'2026-10-05'}]};

test('campus: none, one or two of 용죽·이충·고덕; unknown or repeated campuses are refused; saved as 캠퍼스',()=>{
 assert.deepEqual(studentRegistrationSchema.parse(input).campuses,[],'older forms without campus still save');
 const two=studentRegistrationSchema.parse({...input,campuses:['이충','용죽']});assert.deepEqual(two.campuses,['이충','용죽']);
 assert.equal(studentRegistrationSchema.safeParse({...input,campuses:['서울']}).success,false);
 assert.equal(studentRegistrationSchema.safeParse({...input,campuses:['용죽','용죽']}).success,false);
 assert.deepEqual(registrationStudentProperties('id',two)['캠퍼스'],{multi_select:[{name:'이충'},{name:'용죽'}]});
 assert.deepEqual(registrationStudentProperties('id',studentRegistrationSchema.parse(input))['캠퍼스'],{multi_select:[]});
});
test('원서 form: campus toggle left of the name, no (선택) on 학교·학년·연락처, subjects 수학 국어 영어 과학 한국사, footer 이전·다음·저장 on the right',()=>{
 const html=renderToStaticMarkup(<StudentRegistrationForm value={{...emptyRegistration(),campuses:['용죽']}} onChange={()=>{}} onSubmit={()=>{}}/>);
 const row=html.slice(html.indexOf('adm-name-row'),html.indexOf('학생 이름<input'));
 assert.match(row,/aria-pressed="true"[^>]*>용죽<\/button><button[^>]*aria-pressed="false"[^>]*>이충<\/button><button[^>]*aria-pressed="false"[^>]*>고덕<\/button>/,'campus before the name, 용죽 on');
 for(const label of ['학교','학년','학생 연락처','보호자 연락처']){const at=html.indexOf(`>${label}`);assert.ok(at>0,label);assert.doesNotMatch(html.slice(at,at+80),/선택\)/,label);}
 const pick=html.slice(html.indexOf('adm-subject-pick'));const at=['수학','국어','영어','과학','한국사'].map(s=>pick.indexOf(s));
 assert.deepEqual([...at].sort((a,b)=>a-b),at,'수학 국어 영어 과학 한국사');
 const foot=html.slice(html.indexOf('adm-foot'));
 assert.doesNotMatch(foot,/>이전</,'no 이전 on the first step');assert.match(foot,/gs-grow[^]*다음[^]*>저장(하고 등록)?<\/button>/,'다음 then 저장, after the spacer');
 assert.doesNotMatch(foot,/등록 내용 저장/);
});
test('campus per subject: saved as "{과목} 캠퍼스"; the student 캠퍼스 is every campus they attend',()=>{
 const v=studentRegistrationSchema.parse({...input,campuses:['용죽','이충'],enrollments:[{subject:'수학',status:'등록',startDate:'2026-10-05',campus:'용죽'},{subject:'영어',status:'등록',startDate:'2026-10-05',campus:'이충'}]});
 const enr=registrationEnrollmentProperties('id',v,'student');assert.deepEqual(enr['수학 캠퍼스'],{select:{name:'용죽'}});assert.deepEqual(enr['영어 캠퍼스'],{select:{name:'이충'}});
 assert.deepEqual(registrationStudentProperties('id',v)['캠퍼스'],{multi_select:[{name:'용죽'},{name:'이충'}]});
 assert.equal(studentRegistrationSchema.parse(input).enrollments[0].campus,null,'older forms: no campus');
 assert.equal(studentRegistrationSchema.safeParse({...input,enrollments:[{...input.enrollments[0],campus:'서울'}]}).success,false);
});
test('원서: two campuses → each subject card picks one of them; one campus → no per-subject choice',()=>{
 const two=renderToStaticMarkup(<StudentRegistrationForm value={{...emptyRegistration(),campuses:['용죽','이충'],enrollments:[{subject:'수학',status:'등록',startDate:'2026-10-05',endDate:null,campus:'용죽'}]}} onChange={()=>{}} onSubmit={()=>{}}/>);
 assert.match(two,/aria-label="수학 캠퍼스"/);assert.doesNotMatch(two.slice(two.indexOf('aria-label="수학 캠퍼스"'),two.indexOf('aria-label="수학 캠퍼스"')+400),/고덕/,'only the chosen campuses');
 const one=renderToStaticMarkup(<StudentRegistrationForm value={{...emptyRegistration(),campuses:['용죽'],enrollments:[{subject:'수학',status:'등록',startDate:'2026-10-05',endDate:null,campus:'용죽'}]}} onChange={()=>{}} onSubmit={()=>{}}/>);
 assert.doesNotMatch(one,/aria-label="수학 캠퍼스"/);
 const src=fs.readFileSync(new URL('../src/components/teacher/StudentRegistrationForm.tsx',import.meta.url),'utf8');
 assert.match(src,/campus:cs\.length===1\?cs\[0\]:row\.campus&&cs\.includes\(row\.campus\)\?row\.campus:null/,'one campus applies to every subject');
});
