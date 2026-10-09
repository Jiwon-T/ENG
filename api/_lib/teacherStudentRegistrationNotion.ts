import { recordNotionCall } from './notionUsage.js';
import {emptyAdmission} from '../../src/lib/studentAdmission.js';
import {admissionNotionProperties} from './studentAdmission.js';
import { studentRegistrationTitle, type StudentRegistration } from './teacherStudentRegistration.js';
import { normalizeNotionPageId } from './notionPageId.js';
import { ENROLLMENT_DATABASE,STUDENT_DATABASE } from './notionAcademicSources.js';
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
        '수강료':{number:value.tuition}, '납부기한':rich(value.paymentDeadline), '등록상태':{status:{name:overall}},
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
function pageId(value:unknown) { try{return normalizeNotionPageId(String(value || ''));}catch{return null;} }
export function assertRegistrationSchema(student:any,enrollment:any) {
    const required:any={'학생':'title','학교':'rich_text','학년':'select','앱 등록 ID':'rich_text','학생 호칭':'rich_text','학생연락처':'phone_number','보호자연락처':'phone_number','보호자이름':'rich_text','수강료':'number','납부기한':'rich_text','등록상태':'status','강의명':'multi_select','수강시작일':'date'};
    for(const [key,type] of Object.entries(required))if(student.properties?.[key]?.type!==type)throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
    for(const [key,type] of Object.entries({'수강 내역':'title','학생':'relation','앱 등록 ID':'rich_text'}))if(enrollment.properties?.[key]?.type!==type)throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
    if(pageId(enrollment.properties['학생'].relation?.database_id)!==REGISTRATION_STUDENT_DATABASE)throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
    for(const subject of ['영어','수학','국어','과학','한국사'])for(const [key,type] of [[subject,'status'],[`${subject} 시작일`,'date'],[`${subject} 중단일`,'date']])if(enrollment.properties?.[key]?.type!==type)throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
}
export function registrationText(property:any) { return (property?.rich_text || []).map((row:any)=>row.plain_text ?? row.text?.content ?? '').join(''); }
export function assertRegistrationPage(page:any, database:string, registrationId:string, studentId?:string) {
    if(!page || page.archived || page.in_trash || pageId(page.parent?.database_id)!==database || registrationText(page.properties?.['앱 등록 ID'])!==registrationId)throw Error('NOTION_REGISTRATION_ID_MISMATCH');
    if(studentId && (page.properties?.['학생']?.has_more || page.properties?.['학생']?.relation?.length!==1 || pageId(page.properties['학생'].relation[0].id)!==studentId))throw Error('NOTION_REGISTRATION_ID_MISMATCH');
    const id=pageId(page.id);if(!id)throw Error('NOTION_REGISTRATION_ID_MISMATCH');return id;
}
export type RegistrationNotion=(path:string,method?:string,body?:unknown)=>Promise<any>;
// Never retry page creation automatically. Rate limits/4xx are definitive failures;
// a timeout, transport failure or 5xx may have committed the page remotely.
export async function registrationNotion(path:string,method='GET',body?:unknown) {
    const token=process.env.NOTION_INTEGRATION_TOKEN;if(!token)throw Error('CONFIG_ERROR');
    recordNotionCall(path);
    const response=await fetch(`https://api.notion.com/v1/${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2022-06-28','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error(`NOTION_${response.status}`);
    return response.json();
}
export async function findRegistrationPages(notion:RegistrationNotion,database:string,id:string) {
    const result=await notion(`databases/${database}/query`,'POST',{filter:{property:'앱 등록 ID',rich_text:{equals:id}},page_size:2});
    if(result.has_more || !Array.isArray(result.results) || result.results.length>1)throw Error('NOTION_REGISTRATION_DUPLICATE');
    return result.results;
}
export const REGISTRATION_ENROLLMENT_DATABASE=ENROLLMENT_DATABASE;
