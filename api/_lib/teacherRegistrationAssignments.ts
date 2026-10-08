import {assertRegistrationAccess, type RegistrationActor, type StudentRegistration} from './teacherStudentRegistration.js';
import {registrationNotion, registrationText, type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {coreActive,coreRegistrationOptions} from './academyCore.js';
import type {RegistrationOptions} from '../../src/lib/studentRegistration.js';
export const REGISTRATION_CLASS_DATABASE='1a554024-20f2-42c5-8837-983bd1a4f61e';
export const REGISTRATION_TEACHER_DATABASE='3d274aff-32ce-4a33-870d-2689259113a6';
const ADMIN_TEACHER='3ec0d0f1-c79a-8108-b714-c1d6fc390ba2';
function validPage(page:any,database:string) {
    try {return !page.archived && !page.in_trash && uuid(page.parent?.database_id || '')===database;} catch {return false;}
}
async function teacherProfiles(db:any,actor:RegistrationActor) {
    const profiles=(await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get()).docs.map((d:any)=>({uid:d.id,...d.data()}));
    if(actor.academyId==='main' && process.env.ADMIN_UID){
        const linked=profiles.find((p:any)=>p.uid===process.env.ADMIN_UID);
        if(linked && !linked.disabled && !linked.notionTeacherPageId)linked.notionTeacherPageId=ADMIN_TEACHER;
        else if(!linked){
            const existing=(await db.collection('teacherWorkspaceAccess').doc(process.env.ADMIN_UID).get()).data();
            if(!existing || !existing.disabled && (!existing.academyId || existing.academyId==='main'))profiles.push({uid:process.env.ADMIN_UID,...existing,academyId:'main',notionTeacherPageId:existing?.notionTeacherPageId || ADMIN_TEACHER});
        }
    }
    const candidates=profiles.filter((p:any)=>!p.disabled && p.notionTeacherPageId);
    const active=(await Promise.all(candidates.map(async(p:any)=>{
        const user=(await db.collection('users').doc(p.uid).get()).data();
        return p.uid===process.env.ADMIN_UID || ['teacher','principal'].includes(user?.role) ? p : null;
    }))).filter(Boolean);
    const seen=new Set<string>();
    for(const profile of active) {
        profile.notionTeacherPageId=uuid(profile.notionTeacherPageId);
        if(seen.has(profile.notionTeacherPageId))throw Error('NOTION_TEACHER_ID_CONFLICT');
        seen.add(profile.notionTeacherPageId);
    }
    return active;
}
async function readTeacher(notion:RegistrationNotion,profile:any) {
    const page=await notion(`pages/${profile.notionTeacherPageId}`);
    if(!validPage(page,REGISTRATION_TEACHER_DATABASE) || page.properties?.['상태']?.select?.name!=='재직')return null;
    return {uid:profile.uid,pageId:profile.notionTeacherPageId,name:(page.properties['선생님']?.title || []).map((p:any)=>p.plain_text ?? p.text?.content ?? '').join('') || '선생님',subjects:(page.properties['담당 과목']?.multi_select || []).map((p:any)=>p.name)};
}
function classOption(page:any,academyId:string,teachers:any[]) {
    if(!validPage(page,REGISTRATION_CLASS_DATABASE) || registrationText(page.properties?.['학원'])!==academyId || page.properties?.['상태']?.status?.name!=='진행 중' || page.properties?.['담당 선생님']?.has_more)return null;
    const subject=page.properties?.['과목']?.select?.name;
    const teacherIds=(page.properties?.['담당 선생님']?.relation || []).map((p:any)=>uuid(p.id));
    const teacherUids=teachers.filter(t=>t.subjects.includes(subject) && teacherIds.includes(t.pageId)).map(t=>t.uid);
    if(!teacherUids.length)return null;
    return {id:uuid(page.id),name:(page.properties['수업명']?.title || []).map((p:any)=>p.plain_text ?? p.text?.content ?? '').join('') || '반',subject,teacherUids};
}
export async function registrationAssignmentOptions(db:any,actor:RegistrationActor,notion:RegistrationNotion=registrationNotion):Promise<RegistrationOptions> {
    if(await coreActive(db,actor))return coreRegistrationOptions(db,actor);
    assertRegistrationAccess(actor);
    if(actor.academyId!=='main')throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
    const profiles=await teacherProfiles(db,actor);
    const teachers=(await Promise.all(profiles.map((p:any)=>readTeacher(notion,p)))).filter(Boolean) as any[];
    const classes:any[]=[];let cursor:string|undefined;
    do {
        const result=await notion(`databases/${REGISTRATION_CLASS_DATABASE}/query`,'POST',{filter:{and:[{property:'학원',rich_text:{equals:actor.academyId}},{property:'상태',status:{equals:'진행 중'}}]},page_size:100,...(cursor?{start_cursor:cursor}:{})});
        for(const page of result.results || []){const item=classOption(page,actor.academyId!,teachers);if(item)classes.push(item);}
        cursor=result.has_more?result.next_cursor:undefined;
        if(result.has_more && !cursor)throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
    }while(cursor);
    return {teachers:teachers.map(({pageId,...teacher})=>teacher),classes};
}
export interface ResolvedAssignments {teachers:Record<string,string>;classIds:string[]}
export async function resolveRegistrationAssignments(db:any,actor:RegistrationActor,value:StudentRegistration,notion:RegistrationNotion=registrationNotion):Promise<ResolvedAssignments> {
    const selected=value.enrollments.filter(row=>row.teacherUid || row.classIds.length);
    if(!selected.length)return {teachers:{},classIds:[]};
    assertRegistrationAccess(actor);
    if(actor.academyId!=='main')throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
    if(await coreActive(db,actor)){
        const options=await coreRegistrationOptions(db,actor),result:ResolvedAssignments={teachers:{},classIds:[]};
        for(const row of selected){const teacher=options.teachers.find(t=>t.uid===row.teacherUid);if(!teacher||!teacher.subjects.includes(row.subject))throw Error('INVALID_TEACHER');const profile=(await db.collection('teacherWorkspaceAccess').doc(teacher.uid).get()).data();result.teachers[row.subject]=profile.notionTeacherPageId;
            for(const id of row.classIds){const klass=options.classes.find(c=>c.id===id);if(!klass||klass.subject!==row.subject||!klass.teacherUids.includes(teacher.uid)||row.status!=='등록')throw Error('FORBIDDEN');result.classIds.push(id);}
        }return result;
    }
    const profiles=await teacherProfiles(db,actor);
    const teachers=(await Promise.all([...new Set(selected.map(row=>row.teacherUid))].filter(Boolean).map(async uid=>{
        const profile=profiles.find((p:any)=>p.uid===uid);if(!profile)throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
        const teacher=await readTeacher(notion,profile);if(!teacher)throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');return teacher;
    }))) as any[];
    const result:ResolvedAssignments={teachers:{},classIds:[]};
    for(const row of selected) {
        const teacher=teachers.find(t=>t.uid===row.teacherUid);
        if(!teacher?.subjects.includes(row.subject))throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
        result.teachers[row.subject]=teacher.pageId;
        for(const id of row.classIds) {
            const page=await notion(`pages/${id}`),item=classOption(page,actor.academyId!,teachers);
            if(!item || item.subject!==row.subject || !item.teacherUids.includes(row.teacherUid!) || row.status!=='등록')throw Error('NOTION_REGISTRATION_ASSIGNMENT_REQUIRED');
            result.classIds.push(item.id);
        }
    }
    return result;
}
