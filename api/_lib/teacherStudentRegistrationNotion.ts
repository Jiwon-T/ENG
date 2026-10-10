import {registrationTuitionTotal} from '../../src/lib/studentRegistration.js';
import {emptyAdmission} from '../../src/lib/studentAdmission.js';
import {admissionNotionProperties} from './studentAdmission.js';
import { studentRegistrationTitle, type StudentRegistration } from './teacherStudentRegistration.js';
import { normalizeNotionPageId } from './notionPageId.js';
import { STUDENT_DATABASE } from './notionAcademicSources.js';
export const REGISTRATION_STUDENT_DATABASE=STUDENT_DATABASE;
const rich=(value:string)=>({rich_text:value ? [{text:{content:value}}] : []});
const title=(value:string)=>({title:[{text:{content:value}}]});
export function registrationStudentProperties(id:string, value:StudentRegistration, classIds:string[]=[]) {
    const overall=value.enrollments.some(row=>row.status==='등록')?'등록':value.enrollments.some(row=>row.status==='대기')?'대기':'중단';
    return {
        ...admissionNotionProperties(value.admission||emptyAdmission(),value.guardianSalutation),
        '학생':title(studentRegistrationTitle(value)), '학교':rich(value.school), '학년':{select:value.grade?{name:value.grade}:null},
        '앱 등록 ID':rich(id), '학생 호칭':rich(value.studentSalutation), '학생연락처':{phone_number:value.studentPhone || null},
        '보호자연락처':{phone_number:value.guardianPhone || null}, '보호자이름':rich(value.guardianName),
        '수강료':{number:registrationTuitionTotal(value)}, '납부기한':rich(value.paymentDeadline), '등록상태':{status:{name:overall}},
        '강의명':{multi_select:value.enrollments.filter(row=>row.status==='등록').map(row=>({name:row.subject}))},
        ...(classIds.length?{'소속반':{relation:classIds.map(id=>({id}))}}:{}),
        '수강시작일':{date:{start:value.enrollments.map(row=>row.startDate).sort()[0]}},
    };
}
export function registrationEnrollmentProperties(id:string, value:StudentRegistration, studentId:string, teachers:Record<string,string>={}) {
    const properties:any={'수강 내역':title(studentRegistrationTitle(value)+' 수강'),'학생':{relation:[{id:studentId}]},'앱 등록 ID':rich(id)};
    for(const row of value.enrollments) {
        if(teachers[row.subject])properties[`${row.subject} 담당`]={relation:[{id:teachers[row.subject]}]};
        properties[row.subject]={status:{name:row.status}};
        properties[`${row.subject} 시작일`]={date:{start:row.startDate}};
        properties[`${row.subject} 중단일`]={date:row.endDate?{start:row.endDate}:null};
    }
    return properties;
}
export function registrationText(property:any) { return (property?.rich_text || []).map((row:any)=>row.plain_text ?? row.text?.content ?? '').join(''); }
