import {assertRegistrationAccess, type RegistrationActor, type StudentRegistration} from './teacherStudentRegistration.js';
import {coreActive,coreRegistrationOptions} from './academyCore.js';
import type {RegistrationOptions} from '../../src/lib/studentRegistration.js';
export async function registrationAssignmentOptions(db:any,actor:RegistrationActor):Promise<RegistrationOptions> {
    assertRegistrationAccess(actor);
    if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
    return coreRegistrationOptions(db,actor);
}
export interface ResolvedAssignments {teachers:Record<string,string>;classIds:string[]}
export async function resolveRegistrationAssignments(db:any,actor:RegistrationActor,value:StudentRegistration):Promise<ResolvedAssignments> {
    const selected=value.enrollments.filter(row=>row.teacherUid || row.classIds.length);
    if(!selected.length)return {teachers:{},classIds:[]};
    assertRegistrationAccess(actor);
    if(actor.academyId!=='main')throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
    if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
    {
        const options=await coreRegistrationOptions(db,actor),result:ResolvedAssignments={teachers:{},classIds:[]};
        for(const row of selected){const teacher=options.teachers.find(t=>t.uid===row.teacherUid);if(!teacher||!teacher.subjects.includes(row.subject))throw Error('INVALID_TEACHER');const profile=(await db.collection('teacherWorkspaceAccess').doc(teacher.uid).get()).data();result.teachers[row.subject]=profile.notionTeacherPageId;
            for(const id of row.classIds){const klass=options.classes.find(c=>c.id===id);if(!klass||klass.subject!==row.subject||!klass.teacherUids.includes(teacher.uid)||row.status!=='등록')throw Error('FORBIDDEN');result.classIds.push(id);}
        }return result;
    }
}
