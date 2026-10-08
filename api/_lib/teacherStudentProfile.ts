import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {registrationGrades} from '../../src/lib/studentRegistration.js';
import type {StudentProfileInput,StudentProfileRecord} from '../../src/lib/studentProfile.js';
import {assertRegistrationAccess,type RegistrationActor} from './teacherStudentRegistration.js';
import {REGISTRATION_STUDENT_DATABASE,registrationNotion,registrationText,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {migrateStudentMapping} from './studentIdentity.js';
import {generateInternalStudentId,hashPin,hashStudentKey} from './security.js';
import {invalidateTeacherMutation} from './teacherReadCache.js';
import {coreActive,readCoreProfile,saveCoreProfile} from './academyCore.js';
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
function schemaRequired(schema:any,properties:any) {
    const types:any={'학생':'title','학교':'rich_text','학년':'select','학생연락처':'phone_number','보호자연락처':'phone_number','보호자이름':'rich_text','학생 호칭':'rich_text','수강료':'number','납부기한':'rich_text'};
    for(const key of Object.keys(properties))if(schema.properties?.[key]?.type!==types[key])throw Error('NOTION_REGISTRATION_SCHEMA_REQUIRED');
}
async function access(db:any,actor:RegistrationActor,key:string) {
    assertRegistrationAccess(actor);
    let configured='';try{configured=uuid(process.env.NOTION_STUDENT_DATABASE_ID || '');}catch{}
    if(actor.academyId!=='main' || configured!==REGISTRATION_STUDENT_DATABASE)throw Error('NOTION_REGISTRATION_SOURCE_REQUIRED');
    const member=(await db.collection('academyStudentMemberships').doc(key).get()).data();
    assertMember(actor,member);
}
function assertMember(actor:RegistrationActor,member:any) {
    if(member?.academyId && member.academyId!==actor.academyId || !actor.admin && (!member || member.disabled || member.academyId!==actor.academyId))throw Error('FORBIDDEN');
}
const editRef=(db:any,key:string)=>db.collection('teacherStudentEdits').doc(hashStudentKey(key));
const unfinished=(r:any)=>r && !['synced','discarded'].includes(r.status);
export async function readStudentProfile(db:any,actor:RegistrationActor,id:unknown,notion:RegistrationNotion=registrationNotion):Promise<StudentProfileRecord> {
    if(await coreActive(db,actor))return readCoreProfile(db,actor,id,profileFromPage);
    const key=uuid(z.string().uuid().parse(id));await access(db,actor,key);
    const [page,saved]=await Promise.all([notion(`pages/${key}`),editRef(db,key).get()]);assertPage(page,key);
    const r=saved.data();if(r && r.academyId!==actor.academyId)throw Error('FORBIDDEN');
    return {studentKey:key,data:profileFromPage(page),editedAt:page.last_edited_time,pending:unfinished(r)?{operationId:r.operationId,expectedEditedAt:r.expectedEditedAt,data:r.data,status:r.status,canDiscard:!r.patchAttempted && !(r.status==='syncing' && r.leaseUntil>Date.now())}:null};
}
// A changed contact locks every existing PIN and revokes all existing sessions
// in the same transaction that durably saves the edit. The URL stays intact.
export async function saveStudentProfile(db:any,actor:RegistrationActor,id:unknown,operation:unknown,expected:unknown,input:unknown,notion:RegistrationNotion=registrationNotion) {
    if(await coreActive(db,actor)){const result=await saveCoreProfile(db,actor,id,operation,expected,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);invalidateTeacherMutation('save-student-profile');return result;}
    const key=uuid(z.string().uuid().parse(id)),operationId=z.string().uuid().parse(operation),expectedEditedAt=z.string().datetime().parse(expected),data=studentProfileSchema.parse(input) as StudentProfileInput;
    await access(db,actor,key);
    const ref=editRef(db,key),lease=randomUUID();
    const page=await notion(`pages/${key}`);assertPage(page,key);const base=profileFromPage(page);
    const old=(await ref.get()).data();
    // Do not rename metadata from a late replay after an already completed edit.
    if(old?.operationId===operationId && old.status==='synced') {
        if(old.expectedEditedAt!==expectedEditedAt || JSON.stringify(old.data)!==JSON.stringify(data))throw Error('STUDENT_PROFILE_REQUEST_CONFLICT');
        return {studentKey:key,status:'synced',alreadySaved:true,profile:base};
    }
    const identities=await db.collection('notionStudentMappings').where('notionStudentPageId','in',[key,key.replace(/-/g,'')]).get();
    const internalIds=[...new Set(identities.docs.map((doc:any)=>doc.data().internalStudentId).filter(Boolean))] as string[];
    if(internalIds.length>1)throw Error('STUDENT_MAPPING_CONFLICT');
    const mapping={internalStudentId:internalIds[0] || generateInternalStudentId(key)};
    let record:any=await db.runTransaction(async(tx:any)=>{
        const current=(await tx.get(ref)).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data();assertMember(actor,member);
        if(current && current.academyId!==actor.academyId)throw Error('FORBIDDEN');
        if(current?.operationId===operationId) {
            if(current.expectedEditedAt!==expectedEditedAt || JSON.stringify(current.data)!==JSON.stringify(data))throw Error('STUDENT_PROFILE_REQUEST_CONFLICT');
            if(current.status==='synced')return {...current,alreadySaved:true};
            if(current.status==='discarded')throw Error('STUDENT_PROFILE_REQUEST_CONFLICT');
            if(current.status==='syncing' && current.leaseUntil>Date.now())throw Error('STUDENT_PROFILE_IN_PROGRESS');
            const next={...current,status:'syncing',lease,leaseUntil:Date.now()+180_000};tx.set(ref,next);return next;
        }
        if(unfinished(current))throw Error('STUDENT_PROFILE_IN_PROGRESS');
        if(page.last_edited_time!==expectedEditedAt)throw Error('NOTION_EDIT_CONFLICT');
        const properties=profileProperties(data,base),contactChanged=data.guardianPhone!==base.guardianPhone;
        const slugs=contactChanged?await tx.get(db.collection('reportSlugs').where('internalStudentId','==',mapping.internalStudentId)):null;
        const next={studentKey:key,academyId:actor.academyId,ownerUid:actor.uid,operationId,expectedEditedAt,data,base,properties,internalStudentId:mapping.internalStudentId,contactChanged,status:'syncing',lease,leaseUntil:Date.now()+180_000,patchAttempted:false,createdAt:Date.now(),updatedAt:Date.now()};
        if(contactChanged)for(const slug of slugs.docs)tx.update(slug.ref,{parentPhonePinHash:'',authVersion:(slug.data().authVersion || 1)+1,contactUpdateOperationId:operationId,failedAttempts:0,lockedUntil:null,updatedAt:new Date().toISOString()});
        tx.set(ref,next);return next;
    });
    if(record.alreadySaved)return {studentKey:key,status:'synced',alreadySaved:true,profile:base};
    async function checkpoint(patch:any,requireAccess=true) {
        record=await db.runTransaction(async(tx:any)=>{const r=(await tx.get(ref)).data();
            if(requireAccess)assertMember(actor,(await tx.get(db.collection('academyStudentMemberships').doc(key))).data());if(r?.lease!==lease || r.operationId!==operationId)throw Error('STUDENT_PROFILE_IN_PROGRESS');const next={...r,leaseUntil:Date.now()+180_000,...patch,updatedAt:Date.now()};tx.set(ref,next);return next;});
    }
    try {
        let remote=page,current=profileFromPage(remote);
        const changed=(Object.keys(names) as (keyof StudentProfileInput)[]).filter(k=>record.data[k]!==record.base[k]);
        if(!changed.every(k=>current[k]===record.data[k])) {
            if(record.patchAttempted)throw Error('STUDENT_PROFILE_RESULT_UNCERTAIN');
            if(remote.last_edited_time!==record.expectedEditedAt)throw Error('NOTION_EDIT_CONFLICT');
            schemaRequired(await notion(`databases/${REGISTRATION_STUDENT_DATABASE}`),record.properties);
            const latest=await notion(`pages/${key}`);assertPage(latest,key);
            if(latest.last_edited_time!==record.expectedEditedAt)throw Error('NOTION_EDIT_CONFLICT');
            await checkpoint({patchAttempted:true});
            try {remote=await notion(`pages/${key}`,'PATCH',{properties:record.properties});}
            catch(error) {if(/^NOTION_4\d\d$/.test(error instanceof Error?error.message:''))await checkpoint({patchAttempted:false});throw error;}
            assertPage(remote,key);
            remote=await notion(`pages/${key}`);assertPage(remote,key);current=profileFromPage(remote);
            if(!changed.every(k=>current[k]===record.data[k]))throw Error('STUDENT_PROFILE_RESULT_UNCERTAIN');
        }
        // Preserve unrelated Notion changes made while this operation was pending.
        const guardedDb={collection:(name:string)=>db.collection(name),runTransaction:(callback:any)=>db.runTransaction(async(tx:any)=>{
            const r=(await tx.get(ref)).data();assertMember(actor,(await tx.get(db.collection('academyStudentMemberships').doc(key))).data());
            if(r?.lease!==lease || r.operationId!==operationId || r.status!=='syncing')throw Error('STUDENT_PROFILE_IN_PROGRESS');
            return callback(tx);
        })};
        const updated=await migrateStudentMapping(guardedDb as any,key,current.displayName);
        if(updated.internalStudentId!==record.internalStudentId)throw Error('STUDENT_MAPPING_CONFLICT');
        const pin=record.contactChanged && current.guardianPhone?hashPin(current.guardianPhone.slice(-4)):'';
        await db.runTransaction(async(tx:any)=>{
            const r=(await tx.get(ref)).data(),member=(await tx.get(db.collection('academyStudentMemberships').doc(key))).data();assertMember(actor,member);
            if(r?.lease!==lease || r.operationId!==operationId)throw Error('STUDENT_PROFILE_IN_PROGRESS');
            const slugs=r.contactChanged?await tx.get(db.collection('reportSlugs').where('internalStudentId','==',r.internalStudentId)):null;
            if(r.contactChanged)for(const slug of slugs.docs) {
                const stored=slug.data();
                if(stored.contactUpdateOperationId!==operationId)throw Error('STUDENT_PROFILE_AUTH_CONFLICT');
                tx.update(slug.ref,{parentPhonePinHash:pin,contactUpdateOperationId:null,failedAttempts:0,lockedUntil:null,updatedAt:new Date().toISOString()});
            }
            tx.set(ref,{...r,status:'synced',remoteEditedAt:remote.last_edited_time,lease:null,leaseUntil:0,updatedAt:Date.now()});
        });
        invalidateTeacherMutation('save-student-profile');
        return {studentKey:key,status:'synced',alreadySaved:false,profile:current};
    }catch(error) {
        await checkpoint({status:record.patchAttempted?'uncertain':'failed',lease:null,leaseUntil:0},false).catch(()=>{});
        invalidateTeacherMutation('save-student-profile');throw error;
    }
}
export async function discardStudentProfile(db:any,actor:RegistrationActor,id:unknown,operation:unknown,notion:RegistrationNotion=registrationNotion) {
    const key=uuid(z.string().uuid().parse(id)),operationId=z.string().uuid().parse(operation);await access(db,actor,key);
    const page=await notion(`pages/${key}`);assertPage(page,key);const profile=profileFromPage(page);
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
