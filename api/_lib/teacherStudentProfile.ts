import {z} from 'zod';
import {registrationGrades} from '../../src/lib/studentRegistration.js';
import type {StudentProfileInput,StudentProfileRecord} from '../../src/lib/studentProfile.js';
import {assertRegistrationAccess,type RegistrationActor} from './teacherStudentRegistration.js';
import {REGISTRATION_STUDENT_DATABASE,registrationText} from './teacherStudentRegistrationNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {hashPin,hashStudentKey} from './security.js';
import {invalidateTeacherMutation} from './teacherReadCache.js';
import {coreActive,coreStudentPage,readCoreProfile,saveCoreProfile} from './academyCore.js';
const phone=z.string().trim().max(30).transform(v=>v.replace(/[\s()-]/g,'')).refine(v=>!v || /^0\d{8,10}$/.test(v));
export const studentProfileSchema=z.object({
    displayName:z.string().trim().min(1).max(200),school:z.string().trim().max(80),grade:z.enum(['',...registrationGrades]),
    studentPhone:phone,guardianPhone:phone,guardianName:z.string().trim().max(80),studentSalutation:z.string().trim().max(80),
    tuition:z.number().int().nonnegative().max(100_000_000).nullable(),paymentDeadline:z.string().trim().max(200),
}).strict();
const names:Record<keyof StudentProfileInput,string>={displayName:'학생',school:'학교',grade:'학년',studentPhone:'학생연락처',guardianPhone:'보호자연락처',guardianName:'보호자이름',studentSalutation:'학생 호칭',tuition:'수강료',paymentDeadline:'납부기한'};
const rich=(v:string)=>({rich_text:v?[{text:{content:v}}]:[]});
export function profileFromPage(page:any):StudentProfileInput {
    const p=page.properties || {};
    return studentProfileSchema.parse({displayName:(p['학생']?.title || []).map((t:any)=>t.plain_text ?? t.text?.content ?? '').join(''),school:registrationText(p['학교']),grade:p['학년']?.select?.name || '',studentPhone:p['학생연락처']?.phone_number || '',guardianPhone:p['보호자연락처']?.phone_number || '',guardianName:registrationText(p['보호자이름']),studentSalutation:registrationText(p['학생 호칭']),tuition:p['수강료']?.number ?? null,paymentDeadline:registrationText(p['납부기한'])}) as StudentProfileInput;
}
export function profileProperties(data:StudentProfileInput,base:StudentProfileInput) {
    const all:any={'학생':{title:[{text:{content:data.displayName}}]},'학교':rich(data.school),'학년':{select:data.grade?{name:data.grade}:null},'학생연락처':{phone_number:data.studentPhone || null},'보호자연락처':{phone_number:data.guardianPhone || null},'보호자이름':rich(data.guardianName),'학생 호칭':rich(data.studentSalutation),'수강료':{number:data.tuition},'납부기한':rich(data.paymentDeadline)};
    return Object.fromEntries((Object.keys(names) as (keyof StudentProfileInput)[]).filter(key=>data[key]!==base[key]).map(key=>[names[key],all[names[key]]]));
}
function assertPage(page:any,key:string) {
    if(!page || page.archived || page.in_trash || uuid(page.id)!==key || uuid(page.parent?.database_id || '')!==REGISTRATION_STUDENT_DATABASE)throw Error('NOTION_SOURCE_MISMATCH');
}
async function access(db:any,actor:RegistrationActor,key:string) {
    assertRegistrationAccess(actor);
    if(actor.academyId!=='main')throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
    if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
    const member=(await db.collection('academyStudentMemberships').doc(key).get()).data();
    assertMember(actor,member);
}
function assertMember(actor:RegistrationActor,member:any) {
    if(member?.academyId && member.academyId!==actor.academyId || !actor.admin && (!member || member.disabled || member.academyId!==actor.academyId))throw Error('FORBIDDEN');
}
const editRef=(db:any,key:string)=>db.collection('teacherStudentEdits').doc(hashStudentKey(key));
const unfinished=(r:any)=>r && !['synced','discarded'].includes(r.status);
export async function readStudentProfile(db:any,actor:RegistrationActor,id:unknown):Promise<StudentProfileRecord> {
    if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
    return readCoreProfile(db,actor,id,profileFromPage);
}
// Profiles live in the app (saveCoreProfile): a changed contact locks every existing PIN and revokes all existing
// sessions in the same transaction that saves the edit. The URL stays intact.
export async function saveStudentProfile(db:any,actor:RegistrationActor,id:unknown,operation:unknown,expected:unknown,input:unknown) {
    if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
    const result=await saveCoreProfile(db,actor,id,operation,expected,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);invalidateTeacherMutation('save-student-profile');return result;
}
export async function discardStudentProfile(db:any,actor:RegistrationActor,id:unknown,operation:unknown) {
    const key=uuid(z.string().uuid().parse(id)),operationId=z.string().uuid().parse(operation);await access(db,actor,key);
    // The current profile comes from the app record (access already required the core switch).
    const page=await coreStudentPage(db,key);
    if(page.origin==='app'){if(uuid(page.id)!==key)throw Error('NOTION_SOURCE_MISMATCH');}else assertPage(page,key);
    const profile=profileFromPage(page);
    const ref=editRef(db,key);
    const pending=(await ref.get()).data();const pin=pending?.contactChanged && profile.guardianPhone?hashPin(profile.guardianPhone.slice(-4)):'';
    await db.runTransaction(async(tx:any)=>{
        const r=(await tx.get(ref)).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data();assertMember(actor,member);
        if(!r || r.academyId!==actor.academyId || r.operationId!==operationId || !unfinished(r) || r.patchAttempted || r.status==='syncing' && r.leaseUntil>Date.now())throw Error('STUDENT_PROFILE_IN_PROGRESS');
        const slugs=r.contactChanged?await tx.get(db.collection('reportSlugs').where('internalStudentId','==',r.internalStudentId)):null;
        if(r.contactChanged)for(const slug of slugs.docs) {
            if(slug.data().contactUpdateOperationId!==operationId)throw Error('STUDENT_PROFILE_AUTH_CONFLICT');
            tx.update(slug.ref,{parentPhonePinHash:pin,authVersion:(slug.data().authVersion || 1)+1,contactUpdateOperationId:null,updatedAt:new Date().toISOString()});
        }
        tx.set(ref,{...r,status:'discarded',lease:null,leaseUntil:0,updatedAt:Date.now()});
    });
    invalidateTeacherMutation('discard-student-profile');return {studentKey:key,status:'discarded'};
}
