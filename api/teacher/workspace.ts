import {readIntegrityAudit} from '../_lib/teacherIntegrityAudit.js';
import {lessonSyncWarning} from '../_lib/teacherLessonDiagnostics.js';
import {readTeacherMessages,prepareTeacherMessage,sendTeacherMessage} from '../_lib/teacherMessages.js';
import {readStudentEnrollment,saveStudentEnrollment,discardStudentEnrollment} from '../_lib/teacherStudentEnrollment.js';
import {readStudentProfile,saveStudentProfile,discardStudentProfile} from '../_lib/teacherStudentProfile.js';
import {registrationAssignmentOptions, resolveRegistrationAssignments} from '../_lib/teacherRegistrationAssignments.js';
import { syncStudentRegistration } from '../_lib/teacherStudentRegistrationSync.js';
import { studentRegistrationSchema, saveStudentRegistration, listStudentRegistrations, readStudentRegistration } from '../_lib/teacherStudentRegistration.js';
import {writeDirectLessonReport} from '../_lib/teacherDirectReport.js';
import {classStatusOnlyChange,changedStatusSlots} from '../_lib/teacherClassStatus.js';
import {scheduleRange,readReflectedRange,readManagedScheduleRange} from '../_lib/teacherScheduleRange.js';
import { latestPreviousLesson, previousLessonValues } from '../../src/lib/teacherTodayLessons.js';
import { teacherReadCache, teacherReadKey, pageRows, pageNumber, invalidateTeacherMutation } from '../_lib/teacherReadCache.js';
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
import { readTeacherStudentSnapshot, saveTeacherStudentSnapshot } from '../_lib/teacherStudentSnapshot.js';
import { publishTeacherDraft, prepareNotionWorkspace, previousNotionLesson, publishTeacherSchedule, confirmTeacherReflection } from '../_lib/teacherNotionPublish.js';
async function confirmLessonRecords(db:any,records:any[]) {
    await Promise.all(records.map(async r=>{
        if(r.stage!=='processing'||!r.notionPageId)return;
        const canonical=await db.collection('lessonReports').doc(r.notionPageId.replace(/-/g,'')).get();
        const reflected=canonical.exists?canonical:await db.collection('lessonReports').doc(r.notionPageId).get();
        if(reflected.exists&&Date.parse(reflected.data()?.serverUpdatedAt||'')>=r.publishStartedAt&&await confirmTeacherReflection(r.notionPageId,'lesson').catch(()=>false)){
            r.stage='published';await db.collection('teacherLessonDrafts').doc(r.id).update({stage:'published'});
        }
    }));
}
async function reportReview(db:any,actor:any,studentKey:string,audience:'parent'|'student',values:any) {
    if(!values.section)return loadTeacherReportReview(db,actor,studentKey,audience);
    const section=z.enum(['schedule','lessons','grades']).parse(values.section);
    const subject=z.string().max(100).parse(values.subject||'');const page=pageNumber(values.page);
    const snapshot=await teacherReadCache.get(teacherReadKey(actor,`report:${studentKey}:${audience}:${section}`),()=>loadTeacherReportReview(db,actor,studentKey,audience,undefined,{section,page:1,subject:'',snapshot:true}),values.force==='1');
    const filtered=snapshot.reports.filter((r:any)=>!subject||r.subject===subject);
    const paged=pageRows(filtered,page,5);
    return {...snapshot,reports:paged.records,reportTotal:paged.total,reportPage:paged.page,reportPages:paged.pages};
}
export default async function handler(req: IncomingMessage,res:ServerResponse){return handleWorkspace(req,res);}
export async function handleWorkspace(req: IncomingMessage, res: ServerResponse, actorProvider=teacherActor) {
    let failureStage = 'authentication';
    let mutation:string|null=null;
    try {
        const actor = await actorProvider(req);
        const { db } = actor;
        failureStage = 'workspace-data';
        if (req.method === 'GET') {
            const params = new URL(req.url || '', 'http://localhost').searchParams;
            const action = params.get('action') || 'bootstrap';
            const force = params.get('force') === '1';
            if(action==='integrity-audit'){failureStage='integrity-audit';return sendJson(res,200,{ok:true,...await readIntegrityAudit(db,actor)});}
            if(action==='messages'){failureStage='message-read';return sendJson(res,200,{ok:true,...await readTeacherMessages(db,actor,params.get('studentKey'),params.get('subject'))});}
            if(action==='student-enrollment'){failureStage='student-enrollment-read';return sendJson(res,200,{ok:true,record:await readStudentEnrollment(db,actor,params.get('studentKey'))});}
            if(action==='student-profile'){failureStage='student-profile-read';return sendJson(res,200,{ok:true,record:await readStudentProfile(db,actor,params.get('studentKey'))});}
            if (action === 'registration-options') {
                failureStage='student-registration-options';
                return sendJson(res,200,{ok:true,...await registrationAssignmentOptions(db,actor)});
            }
            if (action === 'student-registrations') {
                failureStage = 'student-registration-list';
                const records = await listStudentRegistrations(db,actor);
                return sendJson(res,200,{ok:true,...pageRows(records,pageNumber(params.get('page')),8)});
            }
            if (action === 'student-registration') {
                failureStage = 'student-registration-read';
                return sendJson(res,200,{ok:true,record:await readStudentRegistration(db,actor,params.get('id'))});
            }
            if (action === 'academic-records'||action==='academic-records-fast') {
                const localPromise=teacherReadCache.get(teacherReadKey(actor,'academic-local'),async()=>{const saved=actor.admin ? await db.collection('teacherAcademicDrafts').get() : actor.principal ? await db.collection('teacherAcademicDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherAcademicDrafts').where('ownerUid','==',actor.uid).get();return saved.docs.map(d=>({id:d.id,...d.data()})).filter((r:any)=>canViewAcademyRecord(actor,r));},force);
                const sourcePromise=action==='academic-records-fast'?Promise.resolve([]):teacherReadCache.get(teacherReadKey(actor,'academic-source'),()=>listTeacherNotionGrades(db,actor,force),force);
                const [appRecords,source]=await Promise.all([localPromise,sourcePromise]);
                const records=action==='academic-records-fast'?appRecords:mergeNotionRows(appRecords,source);
                if (!params.has('page')) return sendJson(res,200,{ok:true,records});
                const {examPeriod}=await import('../../src/lib/academicExamPeriod.js');
                const students=await teacherReadCache.get(teacherReadKey(actor,'students'),listNotionStudents,force);const names=new Map(students.map(s=>[s.studentKey,s.studentDisplayName]));
                const filtered=records.filter((r:any)=>(!params.get('teacher')||r.ownerUid===params.get('teacher')||r.teacherUids?.includes(params.get('teacher')))&&(!params.get('student')||r.data.studentKey===params.get('student'))&&(!params.get('kind')||r.data.examType===params.get('kind'))&&(!params.get('subject')||r.data.subject===params.get('subject'))&&(!params.get('period')||examPeriod(r.data)?.key===params.get('period'))&&(!params.get('search')||[names.get(r.data.studentKey),r.data.title,r.data.subject,r.data.note].join(' ').toLowerCase().includes(params.get('search')!.toLowerCase()))).sort((a:any,b:any)=>b.data.examDate.localeCompare(a.data.examDate)||a.id.localeCompare(b.id));
                return sendJson(res,200,{ok:true,...pageRows(filtered,pageNumber(params.get('page')),12),teachers:[...new Set(records.flatMap((r:any)=>r.teacherUids?.length?r.teacherUids:[r.ownerUid]).filter(Boolean))],periods:[...new Map(records.map((r:any)=>examPeriod(r.data)).filter(Boolean).map((p:any)=>[p.key,p])).values()]});
            }
            if (action === 'academy-lessons' || action === 'academy-lessons-fast') {
                const records=await teacherReadCache.get(teacherReadKey(actor,'academy-local'),async()=>{const saved=actor.admin ? await db.collection('teacherLessonDrafts').get() : actor.principal ? await db.collection('teacherLessonDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).get();return saved.docs.map(d=>({id:d.id,...d.data()}));},force);
                const rows=mergeNotionRows(records,action==='academy-lessons-fast'?[]:await teacherReadCache.get(teacherReadKey(actor,'academy-source'),()=>readSourceLessons(db,actor,force),force)).filter((r:any)=>canViewAcademyRecord(actor,r));
                const names=new Map<string,string>();
                await Promise.all([...new Set(rows.map((r:any)=>r.ownerUid))].map(async uid=>{if(!uid)return;const name=await teacherReadCache.get(teacherReadKey(actor,'staff:'+uid),async()=>{const user=(await db.collection('users').doc(uid as string).get()).data();return user?.alias||user?.name||'선생님';},force);names.set(uid as string,name);}));
                const named=rows.map((r:any)=>({...r,teacherName:names.get(r.ownerUid)||'선생님'}));
                if(!params.has('page'))return sendJson(res,200,{ok:true,records:named});
                const filtered=named.filter((r:any)=>(!params.get('teacher')||r.ownerUid===params.get('teacher'))&&(!params.get('day')||r.data.date===params.get('day'))&&(!params.get('student')||r.data.studentKey===params.get('student'))).sort((a:any,b:any)=>b.data.date.localeCompare(a.data.date)||a.id.localeCompare(b.id));
                return sendJson(res,200,{ok:true,...pageRows(filtered,pageNumber(params.get('page')),10),teachers:[...names].map(([uid,name])=>({uid,name}))});
            }
            if(action==='schedule-records') {
                const range=scheduleRange({day:params.get('day'),from:params.get('from'),to:params.get('to')});
                const mappingsPromise=readStudentDirectoryMappings(db);
                const [local,remote,reflected,mappings]=await Promise.all([
                    readManagedScheduleRange(db,actor,range),
                    teacherReadCache.get(teacherReadKey(actor,`schedules:${range.from}:${range.to}`),()=>readSourceSchedules(db,actor,range,force),force),
                    mappingsPromise.then(m=>readReflectedRange(db,actor,m,range)),mappingsPromise,
                ]);
                const records=local.docs.map(d=>({id:d.id,...d.data()}));
                if(force)await Promise.all(records.map(async(r:any)=>{if(r.stage==='processing'&&r.notionPageId&&await confirmTeacherReflection(r.notionPageId,'schedule').catch(()=>false)){r.stage='published';if(r.deleteRequested)r.archived=true;await db.collection('teacherSchedules').doc(r.id).update({stage:'published',...(r.archived?{archived:true}:{})});}}));
                const day=params.get('day');if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('INVALID_INPUT');
                return sendJson(res,200,{ok:true,schedules:mergeNotionRows(records,remote).filter((r:any)=>!r.archived&&(!day||r.data?.date===day)),reflectedSchedules:teacherReflectedSchedules(reflected.map(d=>d.data()),mappings,actor).filter((r:any)=>!day||r.date===day)});
            }
            if(action==='managed-record') {
                const kind=z.enum(['lesson','academic','schedule','class','curriculum']).parse(params.get('kind'));
                const collections={lesson:'teacherLessonDrafts',academic:'teacherAcademicDrafts',schedule:'teacherSchedules',class:'teacherClasses',curriculum:'teacherCurricula'};
                const id=z.string().uuid().parse(params.get('id'));
                const doc=await db.collection(collections[kind]).doc(id).get();
                if(!doc.exists||!canAccessOwned(actor,doc.data()!.ownerUid))throw new Error('FORBIDDEN');
                return sendJson(res,200,{ok:true,record:{id:doc.id,...doc.data()}});
            }
            if(action==='drafts-page') {
                const summaries=await teacherReadCache.get(teacherReadKey(actor,'draft-summaries'),async()=>{
                    const rows=await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).select('updatedAt').get();
                    return rows.docs.map(d=>({id:d.id,updatedAt:d.data().updatedAt||0})).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
                },force);
                const page=pageRows(summaries,pageNumber(params.get('page')),10);
                const docs=page.records.length?await db.getAll(...page.records.map(r=>db.collection('teacherLessonDrafts').doc(r.id))):[];
                const records=docs.filter(d=>d.exists&&d.data()?.ownerUid===actor.uid).map(d=>({id:d.id,...d.data()}));if(force)await confirmLessonRecords(db,records);
                return sendJson(res,200,{ok:true,...page,records});
            }
            if(action==='draft-records') {
                const ids=z.array(z.string().uuid()).max(100).parse((params.get('ids')||'').split(',').filter(Boolean));
                const docs=ids.length?await db.getAll(...ids.map(id=>db.collection('teacherLessonDrafts').doc(id))):[];
                const records=docs.filter(d=>d.exists&&canAccessOwned(actor,d.data()!.ownerUid)).map(d=>({id:d.id,...d.data()}));
                if(force)await confirmLessonRecords(db,records);return sendJson(res,200,{ok:true,records});
            }
            if (action === 'report-review') {
                failureStage = 'report-review';
                const url = new URL(req.url || '', 'http://localhost');
                const studentKey = z.string().uuid().parse(url.searchParams.get('studentKey'));
                const audience = z.enum(['parent', 'student']).parse(url.searchParams.get('audience'));
                return sendJson(res, 200, { ok: true, ...await reportReview(db,actor,studentKey,audience,Object.fromEntries(params)) });
            }
            if (action === 'bootstrap' || action === 'bootstrap-fast') {
                const fast = action === 'bootstrap-fast';
                const section=params.get('section')||'all';
                const resourcesOnly=params.get('resourcesOnly')==='1'&&section==='curriculum';
                if(!['all','lesson','students','schedule','curriculum','settings','base'].includes(section))throw new Error('INVALID_INPUT');
                const needs=(...sections:string[])=>section==='all'||sections.includes(section);
                const empty={docs:[]};const range=scheduleRange();
                const mappingsPromise=resourcesOnly?Promise.resolve(new Map()):readStudentDirectoryMappings(db);
                const [notion, mappings, enrollments, curricula, drafts, classes, schedules, reflected, sourceWorkspace, sourceEnrollments, sourceSchedules] = await Promise.all([
                    resourcesOnly?Promise.resolve([]):fast?readTeacherStudentSnapshot(db,actor):teacherReadCache.get(teacherReadKey(actor,'students'),async()=>{const rows=await listNotionStudents();await saveTeacherStudentSnapshot(db,actor,rows);return rows;},force),mappingsPromise, !resourcesOnly&&needs('lesson','students','schedule','curriculum')?db.collection('studentEnrollments').get():Promise.resolve(empty),
                    !needs('schedule','curriculum','settings')?Promise.resolve(empty):actor.admin ? db.collection('teacherCurricula').get() : actor.principal ? db.collection('teacherCurricula').where('academyId','==',actor.academyId).get() : db.collection('teacherCurricula').where('ownerUid', '==', actor.uid).get(),
                    section==='all'?(actor.admin ? db.collection('teacherLessonDrafts').get() : db.collection('teacherLessonDrafts').where('ownerUid', '==', actor.uid).get()):Promise.resolve(empty),
                    !needs('lesson','schedule','curriculum','settings')?Promise.resolve(empty):actor.admin ? db.collection('teacherClasses').get() : actor.principal ? db.collection('teacherClasses').where('academyId','==',actor.academyId).get() : db.collection('teacherClasses').where('ownerUid', '==', actor.uid).get(),
                    !needs('schedule')?Promise.resolve(empty):readManagedScheduleRange(db,actor,range),
                    needs('schedule')?mappingsPromise.then(m=>readReflectedRange(db,actor,m,range)):Promise.resolve([]),fast||!needs('lesson','schedule','curriculum')?Promise.resolve({classes:[],curricula:[],issues:[],sources:[]}):teacherReadCache.get(teacherReadKey(actor,'workspace-'+section),()=>readNotionWorkspace(db,actor,section==='lesson'?'classes':'all',force),force),fast||!needs('students')?Promise.resolve(new Map()):teacherReadCache.get(teacherReadKey(actor,'enrollments'),()=>readSourceEnrollments(db,actor,force),force),fast||!needs('schedule')?Promise.resolve([]):teacherReadCache.get(teacherReadKey(actor,`schedules:${range.from}:${range.to}`),()=>readSourceSchedules(db,actor,range,force),force),
                ]);
                const localClasses=classes.docs.map(d=>({id:d.id,...d.data()}));const mergedClasses=fast?localClasses:mergeNotionRows(localClasses,sourceWorkspace.classes);
                const localCurricula=curricula.docs.map(d=>({id:d.id,...d.data()}));const mergedCurricula=(fast?localCurricula:mergeNotionRows(localCurricula,sourceWorkspace.curricula)).map((r:any)=>({...r,classId:mergedClasses.find((c:any)=>c.notionPageId===r.classId)?.id||r.classId}));
                const directory=notion??[...mappings.entries()].map(([studentKey,mapping])=>({studentKey,studentDisplayName:mapping.studentDisplayName||'학생',hasGuardianContact:false,enrollmentStatus:''}));
                const students = directory.filter(s => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey)).map(s => {
                    const mapping = mappings.get(s.studentKey);
                    if(!needs('lesson','students','schedule','curriculum'))return {...s,linkedFirebaseUid:mapping?.firebaseUid||null};
                    const cachedSubjects = enrollments.docs.filter(d => !d.data().removed && d.data().internalStudentId === mapping?.internalStudentId).flatMap(d => d.data().subjects || []).filter(subject => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey && scope.subject === subject.subject));
                    const subjects=(sourceEnrollments.get(s.studentKey)||cachedSubjects).filter((entry:any)=>actor.admin||actor.scopes.some((scope:any)=>scope.studentKey===s.studentKey&&scope.subject===entry.subject));
                    return { ...s, linkedFirebaseUid: mapping?.firebaseUid || null, subjects };
                });
                const records = drafts.docs.map(d => ({ id: d.id, ...d.data() }));
                // Show only confirmed downstream reflection as published.
                await Promise.all(records.map(async (r: any) => {
                    if (!fast && r.stage === 'processing' && r.notionPageId) {
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
                    if (!fast && r.stage === 'processing' && r.notionPageId && await confirmTeacherReflection(r.notionPageId, 'schedule').catch(() => false)) {
                        r.stage = 'published';
                        await db.collection('teacherSchedules').doc(r.id).update({ stage: 'published', ...(r.deleteRequested?{archived:true}:{}) });
                        if(r.deleteRequested)r.archived=true;
                    }
                }));
                const access = !needs('settings')?[]:actor.admin ? (await db.collection('teacherWorkspaceAccess').get()).docs.map(d=>({uid:d.id,...d.data()})) : actor.principal ? (await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get()).docs.filter(d=>!d.data().disabled).map(d=>({uid:d.id,...d.data()})) : [];
                const staffAccess=!resourcesOnly&&actor.principal&&!needs('settings')&&needs('schedule','curriculum')?(await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).select('disabled').get()).docs.filter(d=>!d.data().disabled).map(d=>({uid:d.id})):access;
                const staff = resourcesOnly||!needs('settings','schedule','curriculum')?[]:actor.admin ? (await db.collection('users').where('role','in',['teacher','principal']).get()).docs.map(d=>({uid:d.id,name:d.data().alias||d.data().name||'선생님'})) : await Promise.all(staffAccess.map(async (a:any)=>{const u=(await db.collection('users').doc(a.uid).get()).data();return {uid:a.uid,name:u?.alias||u?.name||'선생님'};}));
                const result:any = { ok: true, admin: actor.admin, principal: actor.principal, academyId: actor.academyId, teachingScopes: actor.teachingScopes, uid: actor.uid, scopes: actor.scopes, students, curricula: mergedCurricula.filter((r:any)=>!r.archived), drafts: records, schedules: (fast?scheduleRecords:mergeNotionRows(scheduleRecords,sourceSchedules)).filter((r:any)=>!r.archived), reflectedSchedules: teacherReflectedSchedules(reflected.map(d => d.data()), mappings, actor), classes: mergedClasses.filter((r:any)=>!r.archived), notionIssues:sourceWorkspace.issues, notionSources:sourceWorkspace.sources, staff, access };
                if(section!=='all') {
                    delete result.drafts;
                    if(!needs('lesson','schedule','curriculum','settings'))delete result.classes;
                    if(!needs('schedule','curriculum','settings'))delete result.curricula;
                    if(!needs('schedule')){delete result.schedules;delete result.reflectedSchedules;}
                    if(!needs('settings'))delete result.access;
                    if(!needs('settings','schedule','curriculum'))delete result.staff;
                    if(!needs('lesson','schedule','curriculum')){delete result.notionSources;delete result.notionIssues;}
                }
                if(resourcesOnly){delete result.students;delete result.staff;}
                return sendJson(res,200,result);
            }
            return sendJson(res, 404, { ok: false });
        }
        if (req.method !== 'POST')
            return sendJson(res, 405, { ok: false });
        const body = await parseJsonBody(req);
        if(body.action==='prepare-message'){failureStage='message-prepare';return sendJson(res,200,{ok:true,record:await prepareTeacherMessage(db,actor,body)});}
        if(body.action==='send-message'){failureStage='message-send';const v=z.object({action:z.literal('send-message'),id:z.string().uuid(),confirmed:z.literal(true)}).strict().parse(body);return sendJson(res,200,{ok:true,record:await sendTeacherMessage(db,actor,v.id,v.confirmed)});}
        // Body dispatch also works when a deployment rewrite drops URL parameters.
        if(body.action!=='report-review'&&body.action!=='previous-lesson'){mutation=body.action;invalidateTeacherMutation(body.action);}
        if (body.action === 'sync-student-registration') {
            failureStage = 'student-registration-sync';
            const value=z.object({action:z.literal('sync-student-registration'),id:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().positive()}).strict().parse(body);
            return sendJson(res,200,{ok:true,...await syncStudentRegistration(db,actor,value.id,value.revision)});
        }
        if(body.action==='save-student-enrollment') {
            failureStage='student-enrollment-save';
            const v=z.object({action:z.literal('save-student-enrollment'),studentKey:z.string().uuid(),operationId:z.string().uuid(),studentEditedAt:z.string().datetime(),enrollmentEditedAt:z.string().datetime(),data:z.unknown()}).strict().parse(body);
            return sendJson(res,200,{ok:true,...await saveStudentEnrollment(db,actor,v.studentKey,v)});
        }
        if(body.action==='discard-student-enrollment') {
            failureStage='student-enrollment-discard';
            const v=z.object({action:z.literal('discard-student-enrollment'),studentKey:z.string().uuid(),operationId:z.string().uuid()}).strict().parse(body);
            return sendJson(res,200,{ok:true,...await discardStudentEnrollment(db,actor,v.studentKey,v.operationId)});
        }
        if(body.action==='save-student-profile') {
            failureStage='student-profile-save';
            const v=z.object({action:z.literal('save-student-profile'),studentKey:z.string().uuid(),operationId:z.string().uuid(),expectedEditedAt:z.string().datetime(),data:z.unknown()}).strict().parse(body);
            return sendJson(res,200,{ok:true,...await saveStudentProfile(db,actor,v.studentKey,v.operationId,v.expectedEditedAt,v.data)});
        }
        if(body.action==='discard-student-profile') {
            failureStage='student-profile-discard';
            const v=z.object({action:z.literal('discard-student-profile'),studentKey:z.string().uuid(),operationId:z.string().uuid()}).strict().parse(body);
            return sendJson(res,200,{ok:true,...await discardStudentProfile(db,actor,v.studentKey,v.operationId)});
        }
        if (body.action === 'save-student-registration') {
            failureStage = 'student-registration-save';
            const value = z.object({action:z.literal('save-student-registration'), requestId:z.string().uuid(), writeId:z.string().uuid(), revision:z.number().int().positive().optional(), data:z.unknown()}).strict().parse(body);
            await resolveRegistrationAssignments(db,actor,studentRegistrationSchema.parse(value.data));
            const saved = await saveStudentRegistration(db,actor,value.data,value.requestId,value.revision,value.writeId);
            return sendJson(res,200,{ok:true,...saved});
        }
        if (body.action === 'report-review') {
            failureStage = 'report-review';
            const studentKey = z.string().uuid().parse(body.studentKey);
            const audience = z.enum(['parent', 'student']).parse(body.audience);
            return sendJson(res, 200, { ok: true, ...await reportReview(db,actor,studentKey,audience,body) });
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
            const value = z.object({ uid: z.string().min(1), workspaceLabel:z.string().trim().max(100).optional(), notionTeacherPageId: z.preprocess(v=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v)?v.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5'):v,z.string().uuid().nullable().optional()), academyId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), workspaceRole: z.enum(['teacher','principal']).default('teacher'), academyStudents: z.array(z.string().uuid()).max(400).default([]), notionSources:z.array(z.object({subject:z.enum(['영어','수학','국어','과학','한국사']),classDatabaseId:dbId,curriculumDatabaseId:dbId,timetableDatabaseId:dbId,lessonDatabaseId:z.preprocess(v=>v===''?undefined:typeof v==='string'&&/^[a-f0-9-]{32,36}$/i.test(v)?normalizeNotionPageId(v):v,z.string().uuid().optional())})).max(5).optional(), scopes: z.array(z.object({ studentKey: z.string().uuid(), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']) })).max(1000) }).parse(body);
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
                t.set(targetRef,{...target,scopes:value.scopes,workspaceLabel:value.workspaceLabel||target?.workspaceLabel||'',academyId:value.academyId,workspaceRole:value.workspaceRole,disabled:false,notionTeacherPageId:value.notionTeacherPageId||null,...(actor.admin&&value.notionSources?{notionSources:value.notionSources}:{}),notionAssignmentStage:'pending',previousNotionAssignment:{scopes:target?.scopes||[],notionTeacherPageId:target?.notionTeacherPageId||null}});
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
            let importedPageId: string | undefined;let importedEditedAt:string|undefined;
            if(body.notionPageId) {
                importedPageId=z.string().uuid().parse(body.notionPageId);
                const page=await gradeNotion(`pages/${importedPageId}`);importedEditedAt=page.last_edited_time;
                const profile=(await db.collection('teacherWorkspaceAccess').doc(actor.uid).get()).data();
                if(actor.principal || !canReadNotionGrade(actor,profile,page)) throw new Error('FORBIDDEN');
                if(page.properties['학생']?.relation?.[0]?.id.replace(/-/g,'') !== value.studentKey.replace(/-/g,'')) throw new Error('SOURCE_IDENTITY_LOCKED');
                if(id !== importedPageId || page.properties['과목']?.select?.name !== value.subject) throw new Error('SOURCE_IDENTITY_LOCKED');
            }
            await db.runTransaction(async t=>{
                const ref=db.collection('teacherAcademicDrafts').doc(id), old=(await t.get(ref)).data();
                if(old && !canAccessOwned(actor,old.ownerUid)) throw new Error('FORBIDDEN');
                assertDraftEditable(old,body.revision,value);
                t.set(ref,{...old,data:value,ownerUid:old?.ownerUid||actor.uid,academyId:old?.academyId||actor.academyId,revision:(old?.revision||0)+1,stage:'draft',updatedAt:Date.now(),...(importedPageId?{notionPageId:importedPageId,notionEditedAt:importedEditedAt}:{})});
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
            const value = z.object({ name: z.string().min(1).max(200), status: z.enum(['대기','진행 중','중단']).optional(), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']), students: z.array(z.string().uuid()).max(100), slots: z.array(timetableSlotSchema.and(z.object({id:z.string().uuid().optional(),notionEditedAt:z.string().optional(),status:z.enum(['대기','진행 중','중단']).optional()}))).max(14), books: z.array(z.object({id:z.string().uuid().optional(),linkedPlanId:z.string().uuid().optional(),progress:z.string().max(100).optional(),notionEditedAt:z.string().optional(),title:z.string().trim().min(1).max(300),status:z.enum(['past','current','planned'])})).max(100).optional() }).parse(body.data);
            value.slots=value.slots.map(slot=>({...slot,id:slot.id||randomUUID()}));
            value.books=(value.books||[]).map(book=>({...book,id:book.id||randomUUID()}));
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            const saved=(await db.collection('teacherClasses').doc(id).get()).data();
            const imported=!saved&&body.id?(await readNotionWorkspace(db,actor)).classes.find((r:any)=>r.id===id):undefined;
            const statusOnly=classStatusOnlyChange(saved||imported,value);
            if(!statusOnly&&value.books.some(book=>book.linkedPlanId)) {
                const sourcePlans=(await readNotionWorkspace(db,actor)).curricula;
                for(const book of value.books) if(book.linkedPlanId){
                    const local=(await db.collection('teacherCurricula').doc(book.linkedPlanId).get()).data();
                    const linked=local?{id:book.linkedPlanId,...local}:sourcePlans.find((c:any)=>c.id===book.linkedPlanId);
                    if(!linked||linked.archived||(!linked.isCommon&&linked.classId)||linked.subject!==value.subject||(!actor.admin&&linked.academyId!==actor.academyId))throw new Error('FORBIDDEN');
                    if(!actor.admin&&!sourcePlans.some((c:any)=>c.id===book.linkedPlanId||c.notionPageId===linked.notionPageId))throw new Error('FORBIDDEN');
                    if(!linked.notionPageId)throw new Error('COMMON_PLAN_NOT_SYNCED');
                    book.id=linked.notionPageId;book.title=linked.title;book.notionEditedAt=linked.notionEditedAt;
                }
            }

            if(new Set(value.books.map(book=>book.id)).size!==value.books.length)throw new Error('INVALID_INPUT');
            if (value.students.some(key => !canTeach(actor, key, value.subject)))
                throw new Error('FORBIDDEN');
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
                const status=value.status||old?.status||'진행 중';
                const slots=value.slots.map(slot=>({...slot,status:status==='중단'?'중단':slot.status||old?.slots?.find((s:any)=>s.id===slot.id)?.status||'진행 중'}));
                t.set(ref, { ...old, ...value, status, slots,notionStatusOnly:classStatusOnlyChange(old,{...value,status,slots}),notionStatusSlotIds:changedStatusSlots(old,{...value,status,slots}),revision:(old?.revision||0)+1, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, notionSyncStage:'pending', ...(body.notionEditedAt?{notionEditedAt:body.notionEditedAt}:{}), updatedAt: Date.now() });
            });
            let syncError:string|undefined;try{await syncManagedRecord(db,'teacherClasses',id);}catch(e:any){syncError=e.message;await db.collection('teacherClasses').doc(id).update({notionSyncStage:'failed',notionSyncError:syncError});}
            return sendJson(res,200,{ok:true,id,statusOnly,revision:(body.revision||0)+1,...(syncError?{syncError}:{})});
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
                try{await publishTeacherSchedule(db,id,old);return sendJson(res,200,{ok:true,stage:'published',cancelled:true});}
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
                if(old?.notionWrite && (!old.notionWrite.done || old.lastSubmittedRevision!==old.revision))throw new Error('NOTION_WRITE_PENDING');
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
            failureStage='lesson-draft-validation';
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
                // Publish to the app first. Notion is an additional copy, never a Make trigger.
                await writeDirectLessonReport(db,id,draft);
                const pageId = await publishTeacherDraft(db, id, draft);
                await writeDirectLessonReport(db,id,{...draft,notionPageId:pageId});
                await ref.update({stage:'published',lastSubmittedRevision:draft.revision,failureCode:null});
                return sendJson(res, 200, { ok: true, stage: 'published', pageId });
            }
            catch (error: any) {
                const saved=(await ref.get()).data();
                if(saved?.directReportRevision===draft.revision) {
                    await ref.update({stage:'report_published_notion_pending',failureCode:error.message});
                    const failure=workspaceError(error,failureStage);
                    console.warn('TEACHER_LESSON_NOTION_PENDING',{error:failure.body.error,diagnosticId:failure.body.diagnosticId,failureStage,draftId:id,revision:draft.revision});
                    return sendJson(res,200,{ok:true,stage:'report_published_notion_pending',failureCode:failure.body.error,warning:lessonSyncWarning(failure),diagnosticId:failure.body.diagnosticId});
                }
                await ref.update({ stage: 'failed', failureCode: error.message });
                throw error;
            }
        }
        if (body.action === 'previous-lesson') {
            const key = z.string().uuid().parse(body.studentKey);
            const subject = z.enum(['영어', '수학', '국어', '과학', '한국사']).parse(body.subject);
            if (!canTeach(actor, key, subject))
                throw new Error('FORBIDDEN');
            const date=body.date===undefined?undefined:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(body.date);
            const records=await teacherReadCache.get(teacherReadKey(actor,'previous-lessons-local'),async()=>(await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).get()).docs.map(d=>d.data()));
            const previous=latestPreviousLesson(records,key,subject,date) || await previousNotionLesson(key,{db,actor,subject,date});
            return sendJson(res, 200, { ok: true, data: previousLessonValues(previous) });
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
        if (result.status >= 500 || failureStage.startsWith('lesson-')) console.warn('TEACHER_WORKSPACE_FAILED', {error: result.body.error, diagnosticId: result.body.diagnosticId, failureStage});
        return sendJson(res, result.status, result.body);
    } finally { if(mutation)invalidateTeacherMutation(mutation); }
}
