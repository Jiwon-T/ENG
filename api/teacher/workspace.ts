import { normalizeNotionPageId } from '../_lib/notionPageId.js';
import {enableSharedWorkspace,sourcesFor,readNotionWorkspace,mergeNotionRows,syncManagedRecord,readSourceEnrollments,syncTeacherAssignments,readSourceLessons,readSourceSchedules} from '../_lib/teacherNotionWorkspace.js';
import { scheduleArchivePatch } from '../_lib/teacherRecordArchive.js';
import { assertTeacherSettingsAccess } from '../_lib/teacherSettingsPolicy.js';
import { teacherReflectedSchedules } from '../_lib/teacherReflectedSchedules.js';
import { loadTeacherReportReview } from '../_lib/teacherReportReview.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { academicDraftSchema, canViewAcademyRecord } from '../_lib/teacherAcademicPolicy.js';
import { listTeacherNotionGrades, publishTeacherGrade, gradeNotion, canReadNotionGrade } from '../_lib/teacherAcademicNotion.js';
import { workspaceError } from '../_lib/teacherWorkspaceError.js';
import { teacherActor } from '../_lib/teacherWorkspaceAuth.js';
import { canAccessOwned, canTeach, assertLessonComplete, lessonDraftSchema, percentage, continuation, timetableSlotSchema, assertDraftEditable, publishDecision, teacherScheduleSchema } from '../_lib/teacherWorkspacePolicy.js';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { listNotionStudents } from '../_lib/notion.js';
import { readStudentDirectoryMappings } from '../_lib/studentDirectoryMappings.js';
import { publishTeacherDraft, prepareNotionWorkspace, previousNotionLesson, publishTeacherSchedule, confirmTeacherReflection } from '../_lib/teacherNotionPublish.js';
export default async function handler(req: IncomingMessage, res: ServerResponse) {
    let failureStage = 'authentication';
    try {
        const actor = await teacherActor(req);
        const { db } = actor;
        failureStage = 'workspace-data';
        if (req.method === 'GET') {
            const action = new URL(req.url || '', 'http://localhost').searchParams.get('action') || 'bootstrap';
            if (action === 'academic-records') {
                const saved = actor.admin ? await db.collection('teacherAcademicDrafts').get() : actor.principal ? await db.collection('teacherAcademicDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherAcademicDrafts').where('ownerUid','==',actor.uid).get();
                const appRecords = saved.docs.map(d => ({id:d.id,...d.data()})).filter((r:any)=>canViewAcademyRecord(actor,r));
                const source = await listTeacherNotionGrades(db,actor);
                return sendJson(res,200,{ok:true,records:mergeNotionRows(appRecords,source)});
            }
            if (action === 'academy-lessons') {
                const records = actor.admin ? await db.collection('teacherLessonDrafts').get() : actor.principal ? await db.collection('teacherLessonDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).get();
                const rows=mergeNotionRows(records.docs.map(d=>({id:d.id,...d.data()})),await readSourceLessons(db,actor)).filter((r:any)=>canViewAcademyRecord(actor,r));
                const names=new Map<string,string>();
                await Promise.all([...new Set(rows.map((r:any)=>r.ownerUid))].map(async uid=>{if(!uid)return;const user=(await db.collection('users').doc(uid as string).get()).data();names.set(uid as string,user?.alias||user?.name||'선생님');}));
                return sendJson(res,200,{ok:true,records:rows.map((r:any)=>({...r,teacherName:names.get(r.ownerUid)||'선생님'}))});
            }
            if (action === 'report-review') {
                failureStage = 'report-review';
                const url = new URL(req.url || '', 'http://localhost');
                const studentKey = z.string().uuid().parse(url.searchParams.get('studentKey'));
                const audience = z.enum(['parent', 'student']).parse(url.searchParams.get('audience'));
                return sendJson(res, 200, { ok: true, ...await loadTeacherReportReview(db, actor, studentKey, audience) });
            }
            if (action === 'bootstrap') {
                const [notion, mappings, enrollments, curricula, drafts, classes, schedules, reflected, sourceWorkspace, sourceEnrollments, sourceSchedules] = await Promise.all([
                    listNotionStudents(), readStudentDirectoryMappings(db), db.collection('studentEnrollments').get(),
                    actor.admin ? db.collection('teacherCurricula').get() : actor.principal ? db.collection('teacherCurricula').where('academyId','==',actor.academyId).get() : db.collection('teacherCurricula').where('ownerUid', '==', actor.uid).get(),
                    actor.admin ? db.collection('teacherLessonDrafts').get() : db.collection('teacherLessonDrafts').where('ownerUid', '==', actor.uid).get(),
                    actor.admin ? db.collection('teacherClasses').get() : actor.principal ? db.collection('teacherClasses').where('academyId','==',actor.academyId).get() : db.collection('teacherClasses').where('ownerUid', '==', actor.uid).get(),
                    actor.admin ? db.collection('teacherSchedules').get() : actor.principal ? db.collection('teacherSchedules').where('academyId','==',actor.academyId).get() : db.collection('teacherSchedules').where('ownerUid', '==', actor.uid).get(),
                    db.collection('studentSchedules').get(),readNotionWorkspace(db,actor),readSourceEnrollments(db,actor),readSourceSchedules(db,actor),
                ]);
                const mergedClasses=mergeNotionRows(classes.docs.map(d=>({id:d.id,...d.data()})),sourceWorkspace.classes);
                const mergedCurricula=mergeNotionRows(curricula.docs.map(d=>({id:d.id,...d.data()})),sourceWorkspace.curricula).map((r:any)=>({...r,classId:mergedClasses.find((c:any)=>c.notionPageId===r.classId)?.id||r.classId}));
                const students = notion.filter(s => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey)).map(s => {
                    const mapping = mappings.get(s.studentKey);
                    const cachedSubjects = enrollments.docs.filter(d => !d.data().removed && d.data().internalStudentId === mapping?.internalStudentId).flatMap(d => d.data().subjects || []).filter(subject => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey && scope.subject === subject.subject));
                    const subjects=(sourceEnrollments.get(s.studentKey)||[]).filter((entry:any)=>actor.admin||actor.scopes.some((scope:any)=>scope.studentKey===s.studentKey&&scope.subject===entry.subject));
                    return { ...s, linkedFirebaseUid: mapping?.firebaseUid || null, subjects };
                });
                const records = drafts.docs.map(d => ({ id: d.id, ...d.data() }));
                // Show only confirmed downstream reflection as published.
                await Promise.all(records.map(async (r: any) => {
                    if (r.stage === 'processing' && r.notionPageId) {
                        const reflected = await db.collection('lessonReports').doc(r.notionPageId.replace(/-/g, '')).get();
                        const fallback = reflected.exists ? reflected : await db.collection('lessonReports').doc(r.notionPageId).get();
                        if (fallback.exists && fallback.data()?.serverUpdatedAt && Date.parse(fallback.data()!.serverUpdatedAt) >= r.publishStartedAt && await confirmTeacherReflection(r.notionPageId, 'lesson').catch(() => false)) {
                            r.stage = 'published';
                            await db.collection('teacherLessonDrafts').doc(r.id).update({ stage: 'published' });
                        }
                    }
                }));
                const scheduleRecords = schedules.docs.map(d => ({ id: d.id, ...d.data() }));
                await Promise.all(scheduleRecords.map(async (r: any) => {
                    if (r.stage === 'processing' && r.notionPageId && await confirmTeacherReflection(r.notionPageId, 'schedule').catch(() => false)) {
                        r.stage = 'published';
                        await db.collection('teacherSchedules').doc(r.id).update({ stage: 'published', ...(r.deleteRequested?{archived:true}:{}) });
                        if(r.deleteRequested)r.archived=true;
                    }
                }));
                const access = actor.admin ? (await db.collection('teacherWorkspaceAccess').get()).docs.map(d=>({uid:d.id,...d.data()})) : actor.principal ? (await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get()).docs.filter(d=>!d.data().disabled).map(d=>({uid:d.id,...d.data()})) : [];
                const staff = actor.admin ? (await db.collection('users').where('role','in',['teacher','principal']).get()).docs.map(d=>({uid:d.id,name:d.data().alias||d.data().name||'선생님'})) : await Promise.all(access.map(async (a:any)=>{const u=(await db.collection('users').doc(a.uid).get()).data();return {uid:a.uid,name:u?.alias||u?.name||'선생님'};}));
                return sendJson(res, 200, { ok: true, admin: actor.admin, principal: actor.principal, academyId: actor.academyId, teachingScopes: actor.teachingScopes, uid: actor.uid, scopes: actor.scopes, students, curricula: mergedCurricula.filter((r:any)=>!r.archived), drafts: records, schedules: mergeNotionRows(scheduleRecords,sourceSchedules).filter((r:any)=>!r.archived), reflectedSchedules: teacherReflectedSchedules(reflected.docs.map(d => d.data()), mappings, actor), classes: mergedClasses.filter((r:any)=>!r.archived), notionIssues:sourceWorkspace.issues, notionSources:sourceWorkspace.sources, staff, access });
            }
            return sendJson(res, 404, { ok: false });
        }
        if (req.method !== 'POST')
            return sendJson(res, 405, { ok: false });
        const body = await parseJsonBody(req);
        // Body dispatch also works when a deployment rewrite drops URL parameters.
        if (body.action === 'report-review') {
            failureStage = 'report-review';
            const studentKey = z.string().uuid().parse(body.studentKey);
            const audience = z.enum(['parent', 'student']).parse(body.audience);
            return sendJson(res, 200, { ok: true, ...await loadTeacherReportReview(db, actor, studentKey, audience) });
        }
        if(body.action==='migrate-notion-records') {
            let migrated=0;const failures:any[]=[];
            for(const collection of ['teacherClasses','teacherCurricula']) {
                const rows=actor.admin?await db.collection(collection).get():await db.collection(collection).where('ownerUid','==',actor.uid).get();
                for(const doc of rows.docs.filter((d:any)=>!d.data().archived&&!d.data().notionPageId).slice(0,10)) {
                    if(!canAccessOwned(actor,doc.data().ownerUid))continue;
                    try{await syncManagedRecord(db,collection,doc.id);migrated++;}catch(e:any){failures.push({id:doc.id,error:e.message});}
                }
            }
            return sendJson(res,200,{ok:true,migrated,failures});
        }
        if(body.action==='retry-teacher-assignment') {
            const uid=z.string().min(1).parse(body.uid),ref=db.collection('teacherWorkspaceAccess').doc(uid),profile=(await ref.get()).data();
            if(!profile||!actor.admin&&(!actor.principal||profile.disabled||profile.academyId!==actor.academyId))throw new Error('FORBIDDEN');
            await syncTeacherAssignments(profile,profile.previousNotionAssignment||null);
            await ref.update({notionAssignmentStage:'synced'});return sendJson(res,200,{ok:true});
        }
        if (body.action === 'enable-shared-notion') return sendJson(res,200,{ok:true,...await enableSharedWorkspace(db,actor)});
        if (body.action === 'grant') {
            if (!actor.admin && !actor.principal)
                throw new Error('FORBIDDEN');
            const dbId=z.preprocess(v=>typeof v==='string'&&/^[a-f0-9-]{32,36}$/i.test(v)?normalizeNotionPageId(v):v,z.string().uuid());
            const value = z.object({ uid: z.string().min(1), notionTeacherPageId: z.preprocess(v=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v)?v.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5'):v,z.string().uuid().nullable().optional()), academyId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), workspaceRole: z.enum(['teacher','principal']).default('teacher'), academyStudents: z.array(z.string().uuid()).max(400).default([]), notionSources:z.array(z.object({subject:z.enum(['영어','수학','국어','과학','한국사']),classDatabaseId:dbId,curriculumDatabaseId:dbId,timetableDatabaseId:dbId,lessonDatabaseId:z.preprocess(v=>v===''?undefined:typeof v==='string'&&/^[a-f0-9-]{32,36}$/i.test(v)?normalizeNotionPageId(v):v,z.string().uuid().optional())})).max(5).optional(), scopes: z.array(z.object({ studentKey: z.string().uuid(), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']) })).max(1000) }).parse(body);
            if(value.notionSources&&new Set(value.notionSources.map(s=>s.subject)).size!==value.notionSources.length)throw new Error('NOTION_DUPLICATE_SOURCE');
            let previousProfile:any;
            await db.runTransaction(async t=>{
                const targetRef=db.collection('teacherWorkspaceAccess').doc(value.uid),userRef=db.collection('users').doc(value.uid);
                const user=(await t.get(userRef)).data(),target=(await t.get(targetRef)).data();
                if(!['teacher','principal'].includes(user?.role))throw new Error('INVALID_TEACHER');
                const keys=[...new Set([...value.academyStudents,...value.scopes.map(s=>s.studentKey)])];
                z.array(z.string().uuid()).max(400).parse(keys);
                const membershipRefs=keys.map(key=>db.collection('academyStudentMemberships').doc(key));
                const memberships=await Promise.all(membershipRefs.map(async ref=>(await t.get(ref)).data()));
                assertTeacherSettingsAccess(actor,value,target,user,memberships);
                previousProfile=target;
                if(!actor.admin && value.notionSources && JSON.stringify(value.notionSources)!==JSON.stringify(target.notionSources||[]))throw new Error('FORBIDDEN');
                // Changing an existing academy requires a separate migration of historical records.
                if(target?.academyId&&target.academyId!==value.academyId)throw new Error('ACADEMY_MIGRATION_REQUIRED');
                if(memberships.some(m=>m?.academyId&&m.academyId!==value.academyId))throw new Error('ACADEMY_MEMBERSHIP_CONFLICT');
                t.set(targetRef,{...target,scopes:value.scopes,academyId:value.academyId,workspaceRole:value.workspaceRole,disabled:false,notionTeacherPageId:value.notionTeacherPageId||null,...(actor.admin&&value.notionSources?{notionSources:value.notionSources}:{}),notionAssignmentStage:'pending',previousNotionAssignment:{scopes:target?.scopes||[],notionTeacherPageId:target?.notionTeacherPageId||null}});
                if(actor.admin)t.update(userRef,{role:value.workspaceRole==='principal'?'principal':'teacher'});
                for(const ref of membershipRefs)t.set(ref,{academyId:value.academyId,disabled:false});
            });
            for (const collection of ['teacherLessonDrafts','teacherAcademicDrafts','teacherSchedules','teacherClasses','teacherCurricula']) {
                const historical = await db.collection(collection).where('ownerUid','==',value.uid).get();
                for (const record of historical.docs) if(!record.data().academyId) await record.ref.update({academyId:value.academyId});
            }
            let syncError:string|undefined;
            try{await syncTeacherAssignments(value,previousProfile);await db.collection('teacherWorkspaceAccess').doc(value.uid).update({notionAssignmentStage:'synced'});}catch(e:any){syncError=e.message;await db.collection('teacherWorkspaceAccess').doc(value.uid).update({notionAssignmentStage:'failed',notionAssignmentError:syncError});}
            return sendJson(res,200,{ok:true,...(syncError?{syncError}:{})});
        }
        if(body.action==='import-source-record'){
            const id=z.string().uuid().parse(body.id),kind=z.enum(['lesson','schedule']).parse(body.kind),collection=kind==='lesson'?'teacherLessonDrafts':'teacherSchedules';
            const source=(await (kind==='lesson'?readSourceLessons(db,actor):readSourceSchedules(db,actor))).find(r=>r.id===id);
            if(!source||!canAccessOwned(actor,source.ownerUid))throw new Error('FORBIDDEN');
            const matching=await db.collection(collection).where('notionPageId','==',id).get();
            if(matching.docs.length>1)throw new Error('DUPLICATE_NOTION_RECORD');
            const localId=matching.docs[0]?.id||id,ref=db.collection(collection).doc(localId);
            const record=await db.runTransaction(async t=>{const old=(await t.get(ref)).data();if(old&&!canAccessOwned(actor,old.ownerUid))throw new Error('FORBIDDEN');
                if(old&&['processing','publishing','notion_saved'].includes(old.stage))throw new Error('PUBLISH_IN_PROGRESS');
                if(old?.stage==='draft'&&old.revision>0)return {id:localId,...old};
                const value={...old,...source,id:localId,ownerUid:old?.ownerUid||source.ownerUid,source:'notion',revision:(old?.revision||0)+1};t.set(ref,value);return value;});
            return sendJson(res,200,{ok:true,record});
        }
        if(body.action==='sync-notion-record'){
            const id=z.string().uuid().parse(body.id),collection=z.enum(['teacherClasses','teacherCurricula']).parse(body.collection),record=(await db.collection(collection).doc(id).get()).data();
            if(!record||!canAccessOwned(actor,record.ownerUid))throw new Error('FORBIDDEN');
            try{await syncManagedRecord(db,collection,id);}catch(e:any){await db.collection(collection).doc(id).update({notionSyncStage:'failed',notionSyncError:e.message});throw e;}return sendJson(res,200,{ok:true});
        }
        if (body.action === 'prepare-notion') {
            if (!actor.admin)
                throw new Error('FORBIDDEN');
            return sendJson(res, 200, { ok: true, ...await prepareNotionWorkspace(db) });
        }
        if (body.action === 'save-academic') {
            const value = academicDraftSchema.parse(body.data);
            if(!canTeach(actor,value.studentKey,value.subject)) throw new Error('FORBIDDEN');
            if(!actor.academyId) throw new Error('ACADEMY_REQUIRED');
            const id=body.id ? z.string().uuid().parse(body.id) : randomUUID();
            let importedPageId: string | undefined;
            if(body.notionPageId) {
                importedPageId=z.string().uuid().parse(body.notionPageId);
                const page=await gradeNotion(`pages/${importedPageId}`);
                const profile=(await db.collection('teacherWorkspaceAccess').doc(actor.uid).get()).data();
                if(actor.principal || !canReadNotionGrade(actor,profile,page)) throw new Error('FORBIDDEN');
                if(page.properties['학생']?.relation?.[0]?.id.replace(/-/g,'') !== value.studentKey.replace(/-/g,'')) throw new Error('SOURCE_IDENTITY_LOCKED');
                if(id !== importedPageId || page.properties['과목']?.select?.name !== value.subject) throw new Error('SOURCE_IDENTITY_LOCKED');
            }
            await db.runTransaction(async t=>{
                const ref=db.collection('teacherAcademicDrafts').doc(id), old=(await t.get(ref)).data();
                if(old && !canAccessOwned(actor,old.ownerUid)) throw new Error('FORBIDDEN');
                assertDraftEditable(old,body.revision,value);
                t.set(ref,{...old,data:value,ownerUid:old?.ownerUid||actor.uid,academyId:old?.academyId||actor.academyId,revision:(old?.revision||0)+1,stage:'draft',updatedAt:Date.now(),...(importedPageId?{notionPageId:importedPageId}:{})});
            });
            return sendJson(res,200,{ok:true,id});
        }
        if(body.action === 'publish-academic') {
            failureStage='academic-reflection';
            const id=z.string().uuid().parse(body.id),ref=db.collection('teacherAcademicDrafts').doc(id);
            const record=await db.runTransaction(async t=>{
                const old=(await t.get(ref)).data();
                if(!old || !canAccessOwned(actor,old.ownerUid) || !canTeach(actor,old.data.studentKey,old.data.subject)) throw new Error('FORBIDDEN');
                if(publishDecision(old)==='already-published') return {...old,alreadyPublished:true};
                academicDraftSchema.parse(old.data);
                t.update(ref,{stage:'publishing',publishStartedAt:Date.now()});return old;
            });
            if(record.alreadyPublished) return sendJson(res,200,{ok:true,stage:'published'});
            try {return sendJson(res,200,{ok:true,stage:'published',pageId:await publishTeacherGrade(db,id,record)});}
            catch(e:any) {await ref.update({stage:'failed'});throw e;}
        }
        if (body.action === 'save-curriculum') {
            const value = z.object({ title: z.string().min(1).max(200), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']), content: z.string().max(30000), classId: z.string().uuid().nullable().optional() }).parse(body.data);
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            const saved=(await db.collection('teacherCurricula').doc(id).get()).data();
            const imported=!saved&&body.id?(await readNotionWorkspace(db,actor)).curricula.find((r:any)=>r.id===id):undefined;
            if(imported&&!canAccessOwned(actor,imported.ownerUid))throw new Error('FORBIDDEN');
            if(imported&&body.notionEditedAt&&imported.notionEditedAt!==body.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
            const sourceClass=value.classId?(await readNotionWorkspace(db,actor)).classes.find((c:any)=>c.id===value.classId):undefined;
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherCurricula').doc(id);
                const previous = (await t.get(ref)).data()||imported;
                if(value.classId){const linked=(await t.get(db.collection('teacherClasses').doc(value.classId))).data()||sourceClass;if(!linked||linked.archived||!canAccessOwned(actor,linked.ownerUid)||linked.subject!==value.subject)throw new Error('FORBIDDEN');}
                if (previous?.archived||previous?.deleteRequested||previous?.notionSyncStage==='syncing')throw new Error('FORBIDDEN');
                if(previous?.notionPageId && previous.subject!==value.subject)throw new Error('SOURCE_IDENTITY_LOCKED');
                if(previous && (body.revision??0)!==(previous.revision??0))throw new Error('DRAFT_CONFLICT');
                if (previous && !canAccessOwned(actor, previous.ownerUid))
                    throw new Error('FORBIDDEN');
                t.set(ref, { ...previous, ...value, previousClassPageId:previous?.previousClassPageId||(previous?.source==='notion'?previous.classId:null)||null, revision:(previous?.revision||0)+1, ownerUid: previous?.ownerUid || actor.uid, academyId: previous?.academyId || actor.academyId, notionSyncStage:'pending', ...(body.notionEditedAt?{notionEditedAt:body.notionEditedAt}:{}), updatedAt: Date.now() });
            });
            let syncError:string|undefined;try{await syncManagedRecord(db,'teacherCurricula',id);}catch(e:any){syncError=e.message;await db.collection('teacherCurricula').doc(id).update({notionSyncStage:'failed',notionSyncError:syncError});}
            return sendJson(res,200,{ok:true,id,revision:(body.revision||0)+1,...(syncError?{syncError}:{})});
        }
        if (body.action === 'save-class') {
            const value = z.object({ name: z.string().min(1).max(200), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']), students: z.array(z.string().uuid()).max(100), slots: z.array(timetableSlotSchema.and(z.object({id:z.string().uuid().optional(),notionEditedAt:z.string().optional()}))).max(14), books: z.array(z.object({id:z.string().uuid().optional(),progress:z.string().max(100).optional(),notionEditedAt:z.string().optional(),title:z.string().trim().min(1).max(300),status:z.enum(['past','current','planned'])})).max(100).optional() }).parse(body.data);
            value.slots=value.slots.map(slot=>({...slot,id:slot.id||randomUUID()}));
            value.books=(value.books||[]).map(book=>({...book,id:book.id||randomUUID()}));
            if (value.students.some(key => !canTeach(actor, key, value.subject)))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            const saved=(await db.collection('teacherClasses').doc(id).get()).data();
            const imported=!saved&&body.id?(await readNotionWorkspace(db,actor)).classes.find((r:any)=>r.id===id):undefined;
            if(imported&&!canAccessOwned(actor,imported.ownerUid))throw new Error('FORBIDDEN');
            if(imported&&body.notionEditedAt&&imported.notionEditedAt!==body.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherClasses').doc(id);
                const old = (await t.get(ref)).data()||imported;
                if(old?.archived||old?.deleteRequested||old?.notionSyncStage==='syncing')throw new Error('FORBIDDEN');
                if (old && !canAccessOwned(actor, old.ownerUid))
                    throw new Error('FORBIDDEN');
                if(old?.notionPageId && old.subject!==value.subject)throw new Error('SOURCE_IDENTITY_LOCKED');
                if(old && (body.revision??0)!==(old.revision??0))throw new Error('DRAFT_CONFLICT');
                t.set(ref, { ...old, ...value, revision:(old?.revision||0)+1, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, notionSyncStage:'pending', ...(body.notionEditedAt?{notionEditedAt:body.notionEditedAt}:{}), updatedAt: Date.now() });
            });
            let syncError:string|undefined;try{await syncManagedRecord(db,'teacherClasses',id);}catch(e:any){syncError=e.message;await db.collection('teacherClasses').doc(id).update({notionSyncStage:'failed',notionSyncError:syncError});}
            return sendJson(res,200,{ok:true,id,revision:(body.revision||0)+1,...(syncError?{syncError}:{})});
        }
        if (['archive-class','archive-curriculum','archive-schedule'].includes(body.action)) {
            const id=z.string().uuid().parse(body.id), collection=body.action==='archive-class'?'teacherClasses':body.action==='archive-curriculum'?'teacherCurricula':'teacherSchedules',ref=db.collection(collection).doc(id);
            const imported=collection==='teacherSchedules'?(await readSourceSchedules(db,actor)).find(r=>r.id===id):(await readNotionWorkspace(db,actor))[collection==='teacherClasses'?'classes':'curricula'].find((r:any)=>r.id===id);
            const old=await db.runTransaction(async t=>{
                const r=(await t.get(ref)).data()||imported;if(!r||!canAccessOwned(actor,r.ownerUid))throw new Error('FORBIDDEN');
                if(r.archived)return {...r,alreadyArchived:true};
                if(collection==='teacherSchedules'){
                    const patch=scheduleArchivePatch(r,body.revision,Date.now());
                    if(patch){t.set(ref,{...r,...patch});return {...r,...patch};}

                }
                if(collection!=='teacherSchedules'){t.set(ref,{...r,deleteRequested:true,notionSyncStage:'pending',revision:r.revision||0});return r;}
                t.update(ref,{archived:true,updatedAt:Date.now()});return r;
            });
            if(!old.alreadyArchived&&collection==='teacherSchedules'&&old.notionPageId){
                try{await publishTeacherSchedule(db,id,old);return sendJson(res,200,{ok:true,pendingCancellation:true});}
                catch(e:any){await ref.update({stage:'failed',failureCode:e.message});throw e;}
            }
            if(collection!=='teacherSchedules')await syncManagedRecord(db,collection,id);
            return sendJson(res,200,{ok:true});
        }
        if (body.action === 'save-schedule') {
            const value = teacherScheduleSchema.parse(body.data);
            if (value.students.some(key => !canTeach(actor, key, value.subject)))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            const saved=(await db.collection('teacherSchedules').doc(id).get()).data();
            const imported=!saved&&body.id?(await readSourceSchedules(db,actor)).find(r=>r.id===id):undefined;
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherSchedules').doc(id);
                const old = (await t.get(ref)).data()||imported;
                if(old?.archived || old?.deleteRequested)throw new Error('FORBIDDEN');
                if (old && !canAccessOwned(actor, old.ownerUid))
                    throw new Error('FORBIDDEN');
                if (old && ['processing', 'publishing', 'notion_saved'].includes(old.stage))
                    throw new Error('PUBLISH_IN_PROGRESS');
                if (old && body.revision !== old.revision)
                    throw new Error('DRAFT_CONFLICT');
                t.set(ref, { ...old, data: value, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'publish-schedule') {
            failureStage='schedule-reflection';
            const id = z.string().uuid().parse(body.id), ref = db.collection('teacherSchedules').doc(id);
            const record = await db.runTransaction(async (t) => {
                const old = (await t.get(ref)).data();
                if (!old || old.archived || !canAccessOwned(actor, old.ownerUid) || old.data.students.some((key: string) => !canTeach(actor, key, old.data.subject)))
                    throw new Error('FORBIDDEN');
                if (publishDecision(old) === 'already-published')
                    return { ...old, alreadyPublished: true };
                t.update(ref, { stage: 'publishing', publishStartedAt: Date.now() });
                return old;
            });
            if (record.alreadyPublished)
                return sendJson(res, 200, { ok: true, stage: 'published' });
            try {
                return sendJson(res, 200, { ok: true, pageId: await publishTeacherSchedule(db, id, record) });
            }
            catch (error: any) {
                await ref.update({ stage: 'failed', failureCode: error.message });
                throw error;
            }
        }
        if (body.action === 'save-draft') {
            const value = lessonDraftSchema.parse(body.data);
            if (!canTeach(actor, value.studentKey, value.subject))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherLessonDrafts').doc(id);
                const old = (await t.get(ref)).data();
                if(old?.archived)throw new Error('FORBIDDEN');
                if (old && !canAccessOwned(actor, old.ownerUid))
                    throw new Error('FORBIDDEN');
                assertDraftEditable(old, body.revision, value);
                t.set(ref, { ...old, data: value, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', percentage: percentage(value.correct, value.total), updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'publish') {
            failureStage='lesson-reflection';
            const id = z.string().uuid().parse(body.id);
            const ref = db.collection('teacherLessonDrafts').doc(id);
            const draft = await db.runTransaction(async (t) => {
                const old = (await t.get(ref)).data();
                if (!old || old.archived || !canAccessOwned(actor, old.ownerUid) || !canTeach(actor, old.data.studentKey, old.data.subject))
                    throw new Error('FORBIDDEN');
                if (publishDecision(old) === 'already-published')
                    return { ...old, alreadyPublished: true };
                assertLessonComplete(old.data);
                t.update(ref, { stage: 'publishing', publishStartedAt: Date.now() });
                return old;
            });
            if (draft.alreadyPublished)
                return sendJson(res, 200, { ok: true, stage: 'published', pageId: draft.notionPageId });
            try {
                const pageId = await publishTeacherDraft(db, id, draft);
                return sendJson(res, 200, { ok: true, stage: 'processing', pageId });
            }
            catch (error: any) {
                await ref.update({ stage: 'failed', failureCode: error.message });
                throw error;
            }
        }
        if (body.action === 'previous-lesson') {
            const key = z.string().uuid().parse(body.studentKey);
            const subject = z.enum(['영어', '수학', '국어', '과학', '한국사']).parse(body.subject);
            if (!canTeach(actor, key, subject))
                throw new Error('FORBIDDEN');
            const records = (await db.collection('teacherLessonDrafts').where('ownerUid', '==', actor.uid).get()).docs.map(d => d.data()).filter(d => d.data.studentKey === key && d.data.subject === subject).sort((a, b) => b.updatedAt - a.updatedAt);
            const previous = records[0]?.data || (subject === '영어' ? await previousNotionLesson(key) : {});
            return sendJson(res, 200, { ok: true, data: continuation(previous) });
        }
        if (body.action === 'continue') {
            const id = z.string().uuid().parse(body.id);
            const old = (await db.collection('teacherLessonDrafts').doc(id).get()).data();
            if (!old || old.archived || !canAccessOwned(actor, old.ownerUid))
                throw new Error('FORBIDDEN');
            return sendJson(res, 200, { ok: true, data: continuation(old.data) });
        }
        return sendJson(res, 400, { ok: false, error: 'UNKNOWN_ACTION' });
    }
    catch (error: any) {
        const result = workspaceError(error, failureStage);
        if (result.status >= 500) console.warn('TEACHER_WORKSPACE_FAILED', {error: result.body.error, diagnosticId: result.body.diagnosticId, failureStage});
        return sendJson(res, result.status, result.body);
    }
}
