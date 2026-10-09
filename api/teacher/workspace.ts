import {academicAppActive,academicCutoverStatus,activateAcademicApp,deactivateAcademicApp} from '../_lib/academicAuthority.js';
import {withNotionUsageRoute,setNotionUsageRoute} from '../_lib/notionUsage.js';
import {auditScheduleReadiness,activateAppSchedules,prepareScheduleRecords} from '../_lib/scheduleReadiness.js';
import {saveAppSchedule,publishAppSchedule,archiveAppSchedule,readAppSchedulePlaces,appSchedulesActive} from '../_lib/appSchedule.js';
import {previewAcademicMigration,importAcademicMigrationStep,resetAcademicMigration} from '../_lib/academicMigration.js';
import {lessonMigrationStatus,startLessonMigration,runLessonMigration,pauseLessonMigration,decideLessonMigrationHold,runLessonMigrationCron,acknowledgeLessonMigrationHoldGroup} from '../_lib/lessonMigration.js';
import {lessonCutoverStatus,requestLessonCutover,deactivateLessonApp,lessonAppActive} from '../_lib/lessonAuthority.js';
import {readAppSourceLessons,previousAppSourceLesson,ensureAppLessonDraft,settleUncertainLessonWrite} from '../_lib/appLessonSource.js';
import {validLessonSliceFilter,lessonDraftSlice,filterSourceRows,narrowsLessonSlice} from '../_lib/lessonReviewSlice.js';
import {listArchivedAppLessons,restoreAppLesson} from '../_lib/appLessonRestore.js';
import {saveAppLesson,publishAppLesson,archiveAppLesson} from '../_lib/appLesson.js';
import {getFirebaseAdmin} from '../_lib/firebaseAdmin.js';
import {timingSafeCompare} from '../_lib/security.js';
import {saveAppAcademic,publishAppAcademic,archiveAppAcademic,listAppAcademicSources,appAcademicStudents} from '../_lib/appAcademic.js';
import {commitAppStudentRegistration} from '../_lib/appStudentRegistration.js';
import {lessonImportPublicationPatch} from '../_lib/teacherLessonImport.js';
import {templateAction} from '../_lib/messageTemplateActions.js';
import {directoryAction,directoryStudentReads,readDirectoryStudents,applyDirectoryStudentSummary} from '../_lib/academyDirectorySource.js';
import {coreActive,readCoreScopes,saveCoreGrant,restoreCoreProfile} from '../_lib/academyCore.js';
import {studentProfileSchema,profileFromPage,profileProperties} from '../_lib/teacherStudentProfile.js';
import {classesActive,managedPlan,importManagedStep,activateManaged,saveManaged,archiveManaged} from '../_lib/managedAcademy.js';
import {loadTeacherOnlineLearning} from '../_lib/teacherOnlineLearning.js';
import {readTodayVisibility,changeTodayVisibility} from '../_lib/teacherTodayVisibility.js';
import {workspaceFailureDiagnostic} from '../_lib/workspaceFailureDiagnostic.js';
import {readRecordConflict,resolveRecordConflict} from '../_lib/teacherRecordConflict.js';
import { readSchedulePlaceOptions } from '../_lib/teacherSchedulePlaces.js';
import {assignmentNeedsRecovery} from '../../src/lib/teacherAssignmentStatus.js';
import {assignmentCheckpoint,retryTeacherAssignment} from '../_lib/teacherAssignmentRetry.js';
import {compareLessonReview,validLessonDay} from '../../src/lib/lessonReview.js';
import {readLessonConflict,resolveLessonConflict} from '../_lib/teacherLessonConflict.js';
import {archiveTeacherLesson} from '../_lib/teacherLessonArchive.js';
import {readIntegrityAudit} from '../_lib/teacherIntegrityAudit.js';
import {lessonSyncWarning} from '../_lib/teacherLessonDiagnostics.js';
import {readTeacherMessages,prepareTeacherMessage,sendTeacherMessage} from '../_lib/teacherMessages.js';
import {readStudentEnrollment,saveStudentEnrollment,discardStudentEnrollment} from '../_lib/teacherStudentEnrollment.js';
import {readStudentProfile,saveStudentProfile,discardStudentProfile} from '../_lib/teacherStudentProfile.js';
import {registrationAssignmentOptions, resolveRegistrationAssignments} from '../_lib/teacherRegistrationAssignments.js';
import { syncStudentRegistration } from '../_lib/teacherStudentRegistrationSync.js';
import { convertRegistrationToResident, studentRegistrationSchema, saveStudentRegistration, listStudentRegistrations, readStudentRegistration } from '../_lib/teacherStudentRegistration.js';
import {writeDirectLessonReport} from '../_lib/teacherDirectReport.js';
import {classStatusOnlyChange,changedStatusSlots} from '../_lib/teacherClassStatus.js';
import {scheduleRange,readReflectedRange,readManagedScheduleRange} from '../_lib/teacherScheduleRange.js';
import { latestPreviousLesson, previousLessonValues } from '../../src/lib/teacherTodayLessons.js';
import {sessionBase,sessionRecordSummaries} from '../../src/lib/sessionNumbers.js';
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
import {archiveTeacherAcademic,cancelAcademicArchive} from '../_lib/teacherAcademicArchive.js';
import {updatePublicationRevision} from '../_lib/teacherNotionWrite.js';
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
    // App-only lessons never wait on Notion; their publication is confirmed in the same transaction.
    if(await lessonAppActive(db,{academyId:'main'}))return;
    await Promise.all(records.map(async r=>{
        if(r.stage!=='processing'||!r.notionPageId)return;
        const canonical=await db.collection('lessonReports').doc(r.notionPageId.replace(/-/g,'')).get();
        const reflected=canonical.exists?canonical:await db.collection('lessonReports').doc(r.notionPageId).get();
        if(reflected.exists&&Date.parse(reflected.data()?.serverUpdatedAt||'')>=r.publishStartedAt&&await confirmTeacherReflection(r.notionPageId,'lesson').catch(()=>false)){
            r.stage='published';await db.collection('teacherLessonDrafts').doc(r.id).update({stage:'published'});
        }
    }));
}
async function workspaceStudents(db:any,actor:any,force:boolean,saveSnapshot=false){
    if(directoryStudentReads(actor))return readDirectoryStudents(db,actor);
    return teacherReadCache.get(teacherReadKey(actor,'students'),async()=>{const rows=await listNotionStudents();if(saveSnapshot)await saveTeacherStudentSnapshot(db,actor,rows);return rows;},force);
}
async function reportReview(db:any,actor:any,studentKey:string,audience:'parent'|'student',values:any) {
    if(values.section==='online'){if(audience!=='student')throw Error('FORBIDDEN');return loadTeacherOnlineLearning(db,actor,studentKey,values.subject,values.cursor);}
    if(!values.section)return loadTeacherReportReview(db,actor,studentKey,audience);
    const section=z.enum(['schedule','lessons','grades']).parse(values.section);
    const subject=z.string().max(100).parse(values.subject||'');const page=pageNumber(values.page);
    const snapshot=await teacherReadCache.get(teacherReadKey(actor,`report:${studentKey}:${audience}:${section}`),()=>loadTeacherReportReview(db,actor,studentKey,audience,undefined,{section,page:1,subject:'',snapshot:true}),values.force==='1');
    const filtered=snapshot.reports.filter((r:any)=>!subject||r.subject===subject);
    const paged=pageRows(filtered,page,5);
    return {...snapshot,reports:paged.records,reportTotal:paged.total,reportPage:paged.page,reportPages:paged.pages};
}
export default async function handler(req: IncomingMessage,res:ServerResponse){
    const params=new URL(req.url||'','http://localhost').searchParams;
    if(params.get('__cron')==='lesson-migration')return withNotionUsageRoute('cron:lesson-migration',()=>handleLessonMigrationCron(req,res));
    return withNotionUsageRoute('workspace:'+(req.method==='GET'?params.get('action')||'bootstrap':'post'),()=>handleWorkspace(req,res));
}
/** Scheduler entry (Vercel Cron sends Authorization: Bearer CRON_SECRET). Idle cost: one document read. */
export async function handleLessonMigrationCron(req: IncomingMessage,res:ServerResponse,initialize=getFirebaseAdmin){
    const secret=process.env.CRON_SECRET||'',header=req.headers.authorization||'';
    if(secret.length<16||!timingSafeCompare(header,'Bearer '+secret))return sendJson(res,401,{ok:false,error:'UNAUTHORIZED'});
    try{const {db}=initialize();const result:any=await runLessonMigrationCron(db);return sendJson(res,200,{ok:true,status:result.status,phase:result.phase||null,idle:Boolean(result.idle)});}
    catch(error:any){const result=workspaceError(error,'lesson-migration-cron');console.warn('LESSON_MIGRATION_CRON_FAILED',{error:result.body.error,diagnosticId:result.body.diagnosticId});return sendJson(res,result.status,result.body);}
}
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
            if(action==='schedule-transition-audit'){const result=await auditScheduleReadiness(db,actor);return sendJson(res,200,{ok:true,ready:result.ready,count:result.count,issues:result.issues});}
            if(action==='schedule-options'){failureStage='schedule-place-options';return sendJson(res,200,{ok:true,places:await appSchedulesActive(db,actor)?await readAppSchedulePlaces(db,actor):await readSchedulePlaceOptions()});}
            if(action==='teacher-assignment'){
                if(!actor.admin&&!actor.principal)throw Error('FORBIDDEN');
                const uid=z.string().min(1).parse(params.get('uid')),profile=(await db.collection('teacherWorkspaceAccess').doc(uid).get()).data();
                if(!profile||profile.disabled||!actor.admin&&profile.academyId!==actor.academyId)throw Error('FORBIDDEN');
                const {notionTeachingScopes}=await import('../_lib/teacherNotionWorkspace.js');
                return sendJson(res,200,{ok:true,scopes:await coreActive(db,actor)?await readCoreScopes(db,{...profile,uid}):await notionTeachingScopes(db,profile)});
            }
            if(action==='schedule-conflict'&&await appSchedulesActive(db,actor))throw Error('SCHEDULE_APP_ACTIVE');
            if(action==='academic-conflict'&&await academicAppActive(db))throw Error('ACADEMIC_APP_ACTIVE');
            if(action==='academic-cutover-status'){failureStage='academic-cutover';return sendJson(res,200,{ok:true,...await academicCutoverStatus(db,actor)});}
            if(action==='academic-conflict'||action==='schedule-conflict')return sendJson(res,200,{ok:true,...await readRecordConflict(db,actor,action==='academic-conflict'?'academic':'schedule',params.get('id'))});
            if(action==='lesson-conflict'&&await lessonAppActive(db,actor))throw Error('LESSON_APP_ACTIVE');
            if(action==='lesson-conflict'){failureStage='lesson-conflict-review';return sendJson(res,200,{ok:true,...await readLessonConflict(db,actor,params.get('id'))});}
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
                const all = await listStudentRegistrations(db,actor);
                const intake=z.enum(['all','consultation','new','additional']).parse(params.get('intake')||'all');
                const group=(r:any)=>r.purpose==='additional'?'additional':r.intakeStage==='consultation'?'consultation':'new';
                const records=all.filter(r=>intake==='all'||group(r)===intake);
                return sendJson(res,200,{ok:true,...pageRows(records,pageNumber(params.get('page')),8),counts:{all:all.length,consultation:all.filter(r=>group(r)==='consultation').length,new:all.filter(r=>group(r)==='new').length,additional:all.filter(r=>group(r)==='additional').length}});
            }
            if (action === 'student-registration') {
                failureStage = 'student-registration-read';
                return sendJson(res,200,{ok:true,record:await readStudentRegistration(db,actor,params.get('id'))});
            }
            if(action==='academic-migration-preview')return sendJson(res,200,{ok:true,...await previewAcademicMigration(db,actor)});
            if(action==='notion-disconnect-status'){failureStage='notion-disconnect';const {notionDisconnectStatus}=await import('../_lib/notionDisconnect.js');return sendJson(res,200,{ok:true,...await notionDisconnectStatus(db,actor)});}
            if(action==='archived-lessons'){failureStage='lesson-restore';return sendJson(res,200,{ok:true,appMode:await lessonAppActive(db,actor),...(await lessonAppActive(db,actor)?await listArchivedAppLessons(db,actor):{records:[]})});}
            if(action==='lesson-migration-status'){failureStage='lesson-migration';const [migration,cutover]=await Promise.all([lessonMigrationStatus(db,actor),lessonCutoverStatus(db,actor)]);return sendJson(res,200,{ok:true,...migration,cutover});}
            if (action === 'academic-records'||action==='academic-records-fast') {
                const localPromise=teacherReadCache.get(teacherReadKey(actor,'academic-local'),async()=>{const saved=actor.admin ? await db.collection('teacherAcademicDrafts').get() : actor.principal ? await db.collection('teacherAcademicDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherAcademicDrafts').where('ownerUid','==',actor.uid).get();return saved.docs.map(d=>({id:d.id,...d.data()})).filter((r:any)=>canViewAcademyRecord(actor,r));},force);
                const sourcePromise=action==='academic-records-fast'?Promise.resolve([]):teacherReadCache.get(teacherReadKey(actor,'academic-firestore-source:'+JSON.stringify([params.get('student'),params.get('subject')])),()=>listAppAcademicSources(db,actor,{studentKey:params.get('student')||undefined,subject:params.get('subject')||undefined}),force);
                const [appRecords,source]=await Promise.all([localPromise,sourcePromise]);
                const records=(action==='academic-records-fast'?appRecords:mergeNotionRows(appRecords,source)).filter((r:any)=>!r.archived);
                if (!params.has('page')) return sendJson(res,200,{ok:true,records});
                const {examPeriod}=await import('../../src/lib/academicExamPeriod.js');
                const students=await teacherReadCache.get(teacherReadKey(actor,'academic-firestore-students'),()=>appAcademicStudents(db,actor),force);const names=new Map(students.map(s=>[s.studentKey,s.studentDisplayName]));
                const filtered=records.filter((r:any)=>(!params.get('teacher')||r.ownerUid===params.get('teacher')||r.teacherUids?.includes(params.get('teacher')))&&(!params.get('student')||r.data.studentKey===params.get('student'))&&(!params.get('kind')||r.data.examType===params.get('kind'))&&(!params.get('subject')||r.data.subject===params.get('subject'))&&(!params.get('period')||examPeriod(r.data)?.key===params.get('period'))&&(!params.get('search')||[names.get(r.data.studentKey),r.data.title,r.data.subject,r.data.note].join(' ').toLowerCase().includes(params.get('search')!.toLowerCase()))).sort((a:any,b:any)=>b.data.examDate.localeCompare(a.data.examDate)||a.id.localeCompare(b.id));
                return sendJson(res,200,{ok:true,...pageRows(filtered,pageNumber(params.get('page')),12),teachers:[...new Set(records.flatMap((r:any)=>r.teacherUids?.length?r.teacherUids:[r.ownerUid]).filter(Boolean))],periods:[...new Map(records.map((r:any)=>examPeriod(r.data)).filter(Boolean).map((p:any)=>[p.key,p])).values()]});
            }
            if (action === 'academy-lessons' || action === 'academy-lessons-fast' || action === 'academy-lessons-export') {
                const exporting=action==='academy-lessons-export';
                const exportTeacher=params.get('teacher')||actor.uid;
                if(exporting){
                    if(!validLessonDay(params.get('day')||''))throw new Error('INVALID_INPUT');
                    if(!actor.admin&&!actor.principal&&exportTeacher!==actor.uid)throw new Error('FORBIDDEN');
                }
                // A chosen date/student (and every export) reads only that slice; the unfiltered list keeps the full read.
                // Paged review defaults to the last 7 days (period=7|31|92|all); a chosen day wins; export always has a day.
                const slice=exporting||params.has('page')?validLessonSliceFilter(params.get('day')||'',params.get('student')||'',exporting?'all':params.get('period')||'7'):{} as {day?:string;student?:string;days?:string[]};
                let records:any[],source:any[];
                if(narrowsLessonSlice(slice)){
                    // The quick first paint shows app lessons only (as before), now also limited to the slice.
                    source=action==='academy-lessons-fast'?[]:await lessonAppActive(db,actor)?await readAppSourceLessons(db,actor,slice):filterSourceRows(await teacherReadCache.get(teacherReadKey(actor,'academy-source'),()=>readSourceLessons(db,actor,force),force),slice);
                    records=await lessonDraftSlice(db,actor,slice,source);
                }else{
                const recordsPromise=teacherReadCache.get(teacherReadKey(actor,'academy-local'),async()=>{const saved=actor.admin ? await db.collection('teacherLessonDrafts').get() : actor.principal ? await db.collection('teacherLessonDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).get();return saved.docs.map(d=>({id:d.id,...d.data()}));},force);
                [records,source]=await Promise.all([recordsPromise,action==='academy-lessons-fast'?Promise.resolve([]):(await lessonAppActive(db,actor)?teacherReadCache.get(teacherReadKey(actor,'academy-app-source'),()=>readAppSourceLessons(db,actor),force):teacherReadCache.get(teacherReadKey(actor,'academy-source'),()=>readSourceLessons(db,actor,force),force))]);
                }
                const rows=mergeNotionRows(records,source).filter((r:any)=>canViewAcademyRecord(actor,r));
                const names=new Map<string,string>();
                await Promise.all([...new Set(rows.map((r:any)=>r.ownerUid))].map(async uid=>{if(!uid)return;const name=await teacherReadCache.get(teacherReadKey(actor,'staff:'+uid),async()=>{const user=(await db.collection('users').doc(uid as string).get()).data();return user?.alias||user?.name||'선생님';},force);names.set(uid as string,name);}));
                const named=rows.map((r:any)=>({...r,teacherName:names.get(r.ownerUid)||'선생님'})).sort(compareLessonReview);
                if(exporting){
                    const selected=named.filter((r:any)=>r.ownerUid===exportTeacher&&r.data.date===params.get('day')&&(!params.get('student')||r.data.studentKey===params.get('student')));
                    const students=await workspaceStudents(db,actor,force);
                    const studentNames=new Map(students.map(s=>[s.studentKey,s.studentDisplayName]));
                    return sendJson(res,200,{ok:true,day:params.get('day'),teacherName:names.get(exportTeacher)||'선생님',records:selected.map((r:any)=>({...r,studentDisplayName:studentNames.get(r.data.studentKey)||'학생'}))});
                }
                if(!params.has('page'))return sendJson(res,200,{ok:true,records:named});
                const periodDays=slice.days?new Set(slice.days):null;
                const filtered=named.filter((r:any)=>(!params.get('teacher')||r.ownerUid===params.get('teacher'))&&(!params.get('day')||r.data.date===params.get('day'))&&(!periodDays||periodDays.has(r.data.date))&&(!params.get('student')||r.data.studentKey===params.get('student'))).sort(compareLessonReview);
                if(narrowsLessonSlice(slice)&&(actor.admin||actor.principal)){
                    // The teacher filter keeps listing every teacher even when only one day is loaded.
                    const access=(await teacherReadCache.get(teacherReadKey(actor,'review-teachers'),async()=>(await (actor.admin?db.collection('teacherWorkspaceAccess').get():db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get())).docs.filter((d:any)=>!d.data().disabled).map((d:any)=>d.id),force)) as string[];
                    await Promise.all(access.filter(uid=>!names.has(uid)).map(async uid=>names.set(uid,await teacherReadCache.get(teacherReadKey(actor,'staff:'+uid),async()=>{const user=(await db.collection('users').doc(uid).get()).data();return user?.alias||user?.name||'선생님';},force))));
                }
                return sendJson(res,200,{ok:true,...pageRows(filtered,pageNumber(params.get('page')),10),teachers:[...names].map(([uid,name])=>({uid,name})),range:slice.days?{from:slice.days.at(-1),to:slice.days[0]}:null});
            }
            if(action==='schedule-records') {
                const range=scheduleRange({day:params.get('day'),from:params.get('from'),to:params.get('to')});
                const mappingsPromise=readStudentDirectoryMappings(db);
                const [local,remote,reflected,mappings]=await Promise.all([
                    readManagedScheduleRange(db,actor,range),
                    teacherReadCache.get(teacherReadKey(actor,`schedules:${range.from}:${range.to}`),async()=>await appSchedulesActive(db,actor)?[]:await readSourceSchedules(db,actor,range,force),force),
                    mappingsPromise.then(m=>readReflectedRange(db,actor,m,range)),mappingsPromise,
                ]);
                const records=local.docs.map(d=>({id:d.id,...d.data()}));
                if(force&&!await appSchedulesActive(db,actor))await Promise.all(records.map(async(r:any)=>{if(r.stage==='processing'&&r.notionPageId&&await confirmTeacherReflection(r.notionPageId,'schedule').catch(()=>false)){r.stage='published';if(r.deleteRequested)r.archived=true;await db.collection('teacherSchedules').doc(r.id).update({stage:'published',...(r.archived?{archived:true}:{})});}}));
                const day=params.get('day');if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('INVALID_INPUT');
                const hiddenTodayLessons=day?await readTodayVisibility(db,actor.uid,day):[];
                return sendJson(res,200,{ok:true,hiddenTodayLessons,schedules:mergeNotionRows(records,remote).filter((r:any)=>!r.archived&&(!day||r.data?.date===day)),reflectedSchedules:teacherReflectedSchedules(reflected.map(d=>d.data()),mappings,actor).filter((r:any)=>!day||r.date===day)});
            }
            if(action==='managed-record') {
                const kind=z.enum(['lesson','academic','schedule','class','curriculum']).parse(params.get('kind'));
                const collections={lesson:'teacherLessonDrafts',academic:'teacherAcademicDrafts',schedule:'teacherSchedules',class:'teacherClasses',curriculum:'teacherCurricula'};
                const id=z.string().uuid().parse(params.get('id'));
                const doc=await db.collection(collections[kind]).doc(id).get();
                if(!doc.exists||!canAccessOwned(actor,doc.data()!.ownerUid,doc.data()!.academyId))throw new Error('FORBIDDEN');
                return sendJson(res,200,{ok:true,record:{id:doc.id,...doc.data()}});
            }
            if(action==='drafts-page') {
                const summaries=await teacherReadCache.get(teacherReadKey(actor,'draft-summaries'),async()=>{
                    const rows=await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).select('updatedAt','archived').get();
                    return rows.docs.filter(d=>!d.data().archived).map(d=>({id:d.id,updatedAt:d.data().updatedAt||0})).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
                },force);
                const page=pageRows(summaries,pageNumber(params.get('page')),10);
                const docs=page.records.length?await db.getAll(...page.records.map(r=>db.collection('teacherLessonDrafts').doc(r.id))):[];
                const records=docs.filter(d=>d.exists&&d.data()?.ownerUid===actor.uid).map(d=>({id:d.id,...d.data()}));if(force)await confirmLessonRecords(db,records);
                return sendJson(res,200,{ok:true,...page,records});
            }
            if(action==='draft-records') {
                const ids=z.array(z.string().uuid()).max(100).parse((params.get('ids')||'').split(',').filter(Boolean));
                const docs=ids.length?await db.getAll(...ids.map(id=>db.collection('teacherLessonDrafts').doc(id))):[];
                const records=docs.filter(d=>d.exists&&canAccessOwned(actor,d.data()!.ownerUid,d.data()!.academyId)).map(d=>({id:d.id,...d.data()}));
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
                const empty={docs:[]};const range=scheduleRange(),managedMode=await classesActive(db,actor);
                const mappingsPromise=resourcesOnly?Promise.resolve(new Map()):readStudentDirectoryMappings(db);
                const [notion, mappings, enrollments, curricula, drafts, classes, schedules, reflected, sourceWorkspace, sourceEnrollments, sourceSchedules] = await Promise.all([
                    resourcesOnly?Promise.resolve([]):fast&&!directoryStudentReads(actor)?readTeacherStudentSnapshot(db,actor):workspaceStudents(db,actor,force,true),mappingsPromise, !resourcesOnly&&needs('lesson','students','schedule','curriculum')?db.collection('studentEnrollments').get():Promise.resolve(empty),
                    !needs('schedule','curriculum','settings')?Promise.resolve(empty):actor.admin ? db.collection('teacherCurricula').get() : actor.principal ? db.collection('teacherCurricula').where('academyId','==',actor.academyId).get() : db.collection('teacherCurricula').where('ownerUid', '==', actor.uid).get(),
                    section==='all'?(actor.admin ? db.collection('teacherLessonDrafts').get() : db.collection('teacherLessonDrafts').where('ownerUid', '==', actor.uid).get()):Promise.resolve(empty),
                    !needs('lesson','schedule','curriculum','settings')?Promise.resolve(empty):actor.admin ? db.collection('teacherClasses').get() : actor.principal ? db.collection('teacherClasses').where('academyId','==',actor.academyId).get() : db.collection('teacherClasses').where('ownerUid', '==', actor.uid).get(),
                    !needs('schedule')?Promise.resolve(empty):readManagedScheduleRange(db,actor,range),
                    needs('schedule')?mappingsPromise.then(m=>readReflectedRange(db,actor,m,range)):Promise.resolve([]),managedMode?readNotionWorkspace(db,actor,section==='lesson'?'classes':'all',force):fast||!needs('lesson','schedule','curriculum')?Promise.resolve({classes:[],curricula:[],issues:[],sources:[]}):teacherReadCache.get(teacherReadKey(actor,'workspace-'+section),()=>readNotionWorkspace(db,actor,section==='lesson'?'classes':'all',force),force),fast||!needs('students')?Promise.resolve(new Map()):teacherReadCache.get(teacherReadKey(actor,'enrollments'),()=>readSourceEnrollments(db,actor,force),force),fast||!needs('schedule')?Promise.resolve([]):teacherReadCache.get(teacherReadKey(actor,`schedules:${range.from}:${range.to}`),async()=>await appSchedulesActive(db,actor)?[]:await readSourceSchedules(db,actor,range,force),force),
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
                const lessonApp=!fast&&records.some((r:any)=>r.stage==='processing')&&await lessonAppActive(db,actor);
                await Promise.all(records.map(async (r: any) => {
                    if (!fast && !lessonApp && r.stage === 'processing' && r.notionPageId) {
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
                    if (!fast && !await appSchedulesActive(db,actor) && r.stage === 'processing' && r.notionPageId && await confirmTeacherReflection(r.notionPageId, 'schedule').catch(() => false)) {
                        r.stage = 'published';
                        await db.collection('teacherSchedules').doc(r.id).update({ stage: 'published', ...(r.deleteRequested?{archived:true}:{}) });
                        if(r.deleteRequested)r.archived=true;
                    }
                }));
                const access = !needs('settings')?[]:actor.admin ? (await db.collection('teacherWorkspaceAccess').get()).docs.map(d=>({uid:d.id,...d.data()})) : actor.principal ? (await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get()).docs.filter(d=>!d.data().disabled).map(d=>({uid:d.id,...d.data()})) : [];
                const staffAccess=!resourcesOnly&&actor.principal&&!needs('settings')&&needs('schedule','curriculum')?(await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).select('disabled').get()).docs.filter(d=>!d.data().disabled).map(d=>({uid:d.id})):access;
                const staff = resourcesOnly||!needs('settings','schedule','curriculum')?[]:actor.admin ? (await db.collection('users').where('role','in',['teacher','principal']).get()).docs.map(d=>({uid:d.id,name:d.data().alias||d.data().name||'선생님'})) : await Promise.all(staffAccess.map(async (a:any)=>{const u=(await db.collection('users').doc(a.uid).get()).data();return {uid:a.uid,name:u?.alias||u?.name||'선생님'};}));
                if(actor.admin&&needs('settings')&&process.env.ADMIN_UID&&!staff.some((s:any)=>s.uid===process.env.ADMIN_UID)){const adminUser=(await db.collection('users').doc(process.env.ADMIN_UID).get()).data();staff.push({uid:process.env.ADMIN_UID,name:adminUser?.alias||adminUser?.name||'관리자 선생님'});}
                const result:any = { ok: true, admin: actor.admin, principal: actor.principal, academyId: actor.academyId, teachingScopes: actor.teachingScopes, uid: actor.uid, scopes: actor.scopes, students, curricula: mergedCurricula.filter((r:any)=>!r.archived), drafts: records.filter((r:any)=>!r.archived), schedules: (fast?scheduleRecords:mergeNotionRows(scheduleRecords,sourceSchedules)).filter((r:any)=>!r.archived), reflectedSchedules: teacherReflectedSchedules(reflected.map(d => d.data()), mappings, actor), classes: mergedClasses.filter((r:any)=>!r.archived), notionIssues:sourceWorkspace.issues, notionSources:sourceWorkspace.sources, staff, access };
                result.coreMode=Boolean(actor.coreMode);
                if(needs('lesson'))result.lessonAppMode=await lessonAppActive(db,actor);
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
        if(typeof body?.action==='string')setNotionUsageRoute('workspace:'+body.action.slice(0,60));
        if(body.action==='managed-migration-plan')return sendJson(res,200,{ok:true,...await managedPlan(db,actor)});
        if(body.action==='managed-import-step'){const {action,...input}=body;return sendJson(res,200,{ok:true,...await importManagedStep(db,actor,input)});}
        if(body.action==='managed-activate'){z.object({action:z.literal('managed-activate'),confirmed:z.literal(true)}).strict().parse(body);const result=await activateManaged(db,actor);invalidateTeacherMutation(body.action);return sendJson(res,200,{ok:true,...result});}
        if(['save-class','save-curriculum'].includes(body.action)&&await classesActive(db,actor)){const result=await saveManaged(db,actor,body.action==='save-class'?'classes':'curricula',body);invalidateTeacherMutation(body.action);return sendJson(res,200,{ok:true,...result});}
        if(['archive-class','archive-curriculum'].includes(body.action)&&await classesActive(db,actor))return sendJson(res,200,{ok:true,...await archiveManaged(db,actor,body.action==='archive-class'?'classes':'curricula',body.id,z.number().int().nonnegative().parse(body.revision))});
        if(body.action==='directory-restore-student'){
            const {action,...input}=body;const result=await restoreCoreProfile(db,actor,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);invalidateTeacherMutation('save-student-profile');return sendJson(res,200,{ok:true,...result});
        }
        if(typeof body.action==='string'&&body.action.startsWith('directory-')){
            failureStage='academy-directory';return sendJson(res,200,{ok:true,...await directoryAction(db,actor,body)});
        }
        if(typeof body.action==='string'&&body.action.startsWith('template-')){
            failureStage='message-template';return sendJson(res,200,{ok:true,...await templateAction(db,actor,body)});
        }
        if(body.action==='prepare-message'){failureStage='message-prepare';return sendJson(res,200,{ok:true,record:await prepareTeacherMessage(db,actor,body)});}
        if(body.action==='send-message'){failureStage='message-send';const v=z.object({action:z.literal('send-message'),id:z.string().uuid(),confirmed:z.literal(true)}).strict().parse(body);return sendJson(res,200,{ok:true,record:await sendTeacherMessage(db,actor,v.id,v.confirmed)});}
        // Body dispatch also works when a deployment rewrite drops URL parameters.
        if(body.action!=='report-review'&&body.action!=='previous-lesson'){mutation=body.action;invalidateTeacherMutation(body.action);}
        if(body.action==='convert-registration-resident'){const v=z.object({action:z.literal('convert-registration-resident'),id:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().positive()}).strict().parse(body);return sendJson(res,200,{ok:true,...await convertRegistrationToResident(db,actor,v.id,v.revision,key=>readStudentEnrollment(db,actor,key))});}
        if (body.action === 'sync-student-registration') {
            failureStage = 'student-registration-sync';
            const value=z.object({action:z.literal('sync-student-registration'),id:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().positive()}).strict().parse(body);
            return sendJson(res,200,{ok:true,...await (await coreActive(db,actor)?commitAppStudentRegistration(db,actor,value.id,value.revision):syncStudentRegistration(db,actor,value.id,value.revision))});
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
            const result=await saveStudentProfile(db,actor,v.studentKey,v.operationId,v.expectedEditedAt,v.data);
            let directoryWarning:string|undefined;
            try{await applyDirectoryStudentSummary(db,actor,v.studentKey,result);}catch{directoryWarning='학생 정보 수정은 완료됐지만 앱 목록 저장본 갱신을 확인해야 합니다.';}
            return sendJson(res,200,{ok:true,...result,...(directoryWarning?{directoryWarning}:{})});
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
            const saved = await saveStudentRegistration(db,actor,value.data,value.requestId,value.revision,value.writeId,await coreActive(db,actor)?'firestore':undefined);
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
                    if(!canAccessOwned(actor,doc.data().ownerUid,doc.data().academyId))continue;
                    try{await syncManagedRecord(db,collection,doc.id);migrated++;}catch(e:any){failures.push({id:doc.id,error:e.message});}
                }
            }
            return sendJson(res,200,{ok:true,migrated,failures});
        }
        if(body.action==='retry-teacher-assignment'&&await coreActive(db,actor)){
            // After the core cutover assignments live in the app only; clear a stale Notion sync failure without calling Notion.
            const uid=z.string().min(1).parse(body.uid),ref=db.collection('teacherWorkspaceAccess').doc(uid);
            await db.runTransaction(async(t:any)=>{const old=(await t.get(ref)).data();if(!old||old.disabled||!actor.admin&&(!actor.principal||old.academyId!==actor.academyId))throw new Error('FORBIDDEN');if(old.notionAssignmentLeaseUntil>Date.now())throw new Error('PUBLISH_IN_PROGRESS');t.set(ref,{...old,notionAssignmentStage:'not-needed',notionAssignmentError:null,previousNotionAssignment:null,notionAssignmentTouched:false,notionAssignmentLease:null,notionAssignmentLeaseUntil:0,notionAssignmentUpdatedAt:Date.now()});});
            return sendJson(res,200,{ok:true,appOnly:true});
        }
        if(body.action==='retry-teacher-assignment') {
            return sendJson(res,200,await retryTeacherAssignment(db,actor,z.string().min(1).parse(body.uid)));
        }
        if (body.action === 'enable-shared-notion') return sendJson(res,200,{ok:true,...await enableSharedWorkspace(db,actor)});
        if (body.action === 'grant') {
            if (!actor.admin && !actor.principal)
                throw new Error('FORBIDDEN');
            const dbId=z.preprocess(v=>typeof v==='string'&&/^[a-f0-9-]{32,36}$/i.test(v)?normalizeNotionPageId(v):v,z.string().uuid());
            const value = z.object({ uid: z.string().min(1), workspaceLabel:z.string().trim().max(100).optional(), notionTeacherPageId: z.preprocess(v=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v)?v.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5'):v,z.string().uuid().nullable().optional()), academyId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), workspaceRole: z.enum(['teacher','principal']).default('teacher'), academyStudents: z.array(z.string().uuid()).max(400).default([]), notionSources:z.array(z.object({subject:z.enum(['영어','수학','국어','과학','한국사']),classDatabaseId:dbId,curriculumDatabaseId:dbId,timetableDatabaseId:dbId,lessonDatabaseId:z.preprocess(v=>v===''?undefined:typeof v==='string'&&/^[a-f0-9-]{32,36}$/i.test(v)?normalizeNotionPageId(v):v,z.string().uuid().optional())})).max(5).optional(), scopes: z.array(z.object({ studentKey: z.string().uuid(), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']) })).max(1000) }).parse(body);
            if(value.notionSources&&new Set(value.notionSources.map(s=>s.subject)).size!==value.notionSources.length)throw new Error('NOTION_DUPLICATE_SOURCE');
            if(await coreActive(db,actor))return sendJson(res,200,{ok:true,...await saveCoreGrant(db,actor,value,body.assignmentRevision??0,assertTeacherSettingsAccess)});
            let previousProfile:any;const assignmentLease=randomUUID();
            await db.runTransaction(async t=>{
                const targetRef=db.collection('teacherWorkspaceAccess').doc(value.uid),userRef=db.collection('users').doc(value.uid);
                const user=(await t.get(userRef)).data(),target=(await t.get(targetRef)).data();
                if(value.uid!==process.env.ADMIN_UID&&!['teacher','principal'].includes(user?.role))throw new Error('INVALID_TEACHER');
                if(target?.notionAssignmentLeaseUntil>Date.now())throw new Error('PUBLISH_IN_PROGRESS');
                if((body.assignmentRevision??0)!==(target?.assignmentRevision||0))throw new Error('DRAFT_CONFLICT');
                const pending=['pending','failed'].includes(target?.notionAssignmentStage);
                const identity=(v:any)=>JSON.stringify([v?.notionTeacherPageId||null,(v?.scopes||[]).map((x:any)=>x.studentKey+':'+x.subject).sort()]);
                if(assignmentNeedsRecovery(target)&&identity(value)!==identity(target))throw new Error('ASSIGNMENT_RETRY_REQUIRED');
                const baseline=pending?target.previousNotionAssignment||target:target;
                const keys=[...new Set([...value.academyStudents,...value.scopes.map(s=>s.studentKey),...(baseline?.scopes||[]).map((s:any)=>s.studentKey)])];
                z.array(z.string().uuid()).max(400).parse(keys);
                const membershipRefs=keys.map(key=>db.collection('academyStudentMemberships').doc(key));
                const memberships=await Promise.all(membershipRefs.map(async ref=>(await t.get(ref)).data()));
                if(value.notionTeacherPageId){const linked=await t.get(db.collection('teacherWorkspaceAccess').where('notionTeacherPageId','==',value.notionTeacherPageId));if(linked.docs.some((d:any)=>d.id!==value.uid&&!d.data().disabled))throw Error('NOTION_TEACHER_ID_CONFLICT');}
                assertTeacherSettingsAccess(actor,value,target,user,memberships);
                previousProfile=pending?target.previousNotionAssignment||target:target;
                if(!actor.admin && value.notionSources && JSON.stringify(value.notionSources)!==JSON.stringify(target.notionSources||[]))throw new Error('FORBIDDEN');
                // Changing an existing academy requires a separate migration of historical records.
                if(target?.academyId&&target.academyId!==value.academyId)throw new Error('ACADEMY_MIGRATION_REQUIRED');
                if(memberships.some(m=>m?.academyId&&m.academyId!==value.academyId))throw new Error('ACADEMY_MEMBERSHIP_CONFLICT');
                t.set(targetRef,{...target,scopes:value.scopes,workspaceLabel:value.workspaceLabel||target?.workspaceLabel||'',academyId:value.academyId,workspaceRole:value.workspaceRole,disabled:false,notionTeacherPageId:value.notionTeacherPageId||null,...(actor.admin&&value.notionSources?{notionSources:value.notionSources}:{}),notionAssignmentStage:'pending',notionAssignmentError:null,assignmentRevision:(target?.assignmentRevision||0)+1,notionAssignmentLease:assignmentLease,notionAssignmentLeaseUntil:Date.now()+180000,notionAssignmentTouched:assignmentNeedsRecovery(target),previousNotionAssignment:{scopes:previousProfile?.scopes||[],notionTeacherPageId:previousProfile?.notionTeacherPageId||null}});
                if(actor.admin&&value.uid!==process.env.ADMIN_UID)t.update(userRef,{role:value.workspaceRole==='principal'?'principal':'teacher'});
                for(const ref of membershipRefs)if(value.academyStudents.includes(ref.id)||value.scopes.some(x=>x.studentKey===ref.id))t.set(ref,{academyId:value.academyId,disabled:false});
            });
            const profileRef=db.collection('teacherWorkspaceAccess').doc(value.uid);
            let syncError:string|undefined;
            try{
                for (const collection of ['teacherLessonDrafts','teacherAcademicDrafts','teacherSchedules','teacherClasses','teacherCurricula']) {
                    const historical = await db.collection(collection).where('ownerUid','==',value.uid).get();
                    for (const record of historical.docs) if(!record.data().academyId) await record.ref.update({academyId:value.academyId});
                }
                await syncTeacherAssignments(value,previousProfile,undefined,async()=>{await assignmentCheckpoint(db,value.uid,assignmentLease,{notionAssignmentTouched:true,notionAssignmentLeaseUntil:Date.now()+180000});});
                await assignmentCheckpoint(db,value.uid,assignmentLease,{notionAssignmentStage:'synced',notionAssignmentError:null,previousNotionAssignment:null,notionAssignmentTouched:false,notionAssignmentLease:null,notionAssignmentLeaseUntil:0,notionAssignmentUpdatedAt:Date.now()});
            }catch(e:any){syncError=e.message;await assignmentCheckpoint(db,value.uid,assignmentLease,{notionAssignmentStage:'failed',notionAssignmentError:syncError,notionAssignmentLease:null,notionAssignmentLeaseUntil:0,notionAssignmentUpdatedAt:Date.now()});}
            return sendJson(res,200,{ok:true,...(syncError?{syncError}:{} )});
        }
        if(body.action==='import-source-record'){
            const id=z.string().uuid().parse(body.id),kind=z.enum(['lesson','schedule']).parse(body.kind),collection=kind==='lesson'?'teacherLessonDrafts':'teacherSchedules';
            failureStage=kind+'-source-import';
            if(kind==='lesson'&&await lessonAppActive(db,actor))return sendJson(res,200,{ok:true,record:await ensureAppLessonDraft(db,actor,id)});
            if(kind==='schedule'&&await appSchedulesActive(db,actor)){
                // App-only schedules were all imported and verified at the switch; open the app record, never Notion.
                const own=(await db.collection('teacherSchedules').doc(id).get()),linked=own.exists?null:await db.collection('teacherSchedules').where('notionPageId','==',id).limit(2).get();
                if(linked&&linked.docs.length>1)throw new Error('DUPLICATE_NOTION_RECORD');
                const doc=own.exists?own:linked?.docs[0];const value=doc?.data();
                if(!doc||!value||value.archived||!canAccessOwned(actor,value.ownerUid,value.academyId))throw new Error('FORBIDDEN');
                return sendJson(res,200,{ok:true,record:{id:doc.id,...value}});
            }
            const source=(await (kind==='lesson'?readSourceLessons(db,actor,true):readSourceSchedules(db,actor,undefined,true))).find(r=>r.id===id);
            if(!source)throw new Error(kind==='schedule'&&actor.admin?'NOTION_SCHEDULE_SOURCE_UNAVAILABLE':'FORBIDDEN');
            if(!canAccessOwned(actor,source.ownerUid,source.academyId))throw new Error('FORBIDDEN');
            const matching=await db.collection(collection).where('notionPageId','==',id).get();
            if(matching.docs.length>1)throw new Error('DUPLICATE_NOTION_RECORD');
            // Recover the exact app marker before importing; never create a second local identity.
            const marked=kind==='lesson'&&source.appRecordId?(await db.collection(collection).doc(source.appRecordId).get()):null;
            const markerData=marked?.data();
            const markerMatches=markerData&&!markerData.archived&&!markerData.deleteRequested&&canAccessOwned(actor,markerData.ownerUid,markerData.academyId)&&markerData.data?.studentKey===source.data.studentKey&&markerData.data?.subject===source.data.subject;
            const localId=matching.docs[0]?.id||(markerMatches?marked!.id:id),ref=db.collection(collection).doc(localId);
            const record=await db.runTransaction(async t=>{const old=(await t.get(ref)).data();if(old&&!canAccessOwned(actor,old.ownerUid,old.academyId))throw new Error('FORBIDDEN');
                if(old?.archived||old?.deleteRequested)throw new Error('FORBIDDEN');
                if(kind==='lesson'&&old?.notionWrite&&(!old.notionWrite.done||old.lastSubmittedRevision!==old.revision))return {id:localId,...old};
                if(old&&['processing','publishing','notion_saved'].includes(old.stage))throw new Error('PUBLISH_IN_PROGRESS');
                if(old?.notionWrite&&(!old.notionWrite.done||old.lastSubmittedRevision!==old.revision))throw new Error('NOTION_WRITE_PENDING');
                if(old?.stage==='draft'&&old.revision>0)return {id:localId,...old};
                const value={...old,...source,id:localId,ownerUid:old?.ownerUid||source.ownerUid,source:'notion',revision:(old?.revision||0)+1,...(kind==='schedule'?{stage:'draft',notionWrite:null}:lessonImportPublicationPatch(old,source) )};t.set(ref,value);return value;});
            return sendJson(res,200,{ok:true,record});
        }
        if(body.action==='sync-notion-record'){
            const id=z.string().uuid().parse(body.id),collection=z.enum(['teacherClasses','teacherCurricula']).parse(body.collection),record=(await db.collection(collection).doc(id).get()).data();
            if(!record||!canAccessOwned(actor,record.ownerUid,record.academyId))throw new Error('FORBIDDEN');
            try{await syncManagedRecord(db,collection,id);}catch(e:any){await db.collection(collection).doc(id).update({notionSyncStage:'failed',notionSyncError:e.message});throw e;}return sendJson(res,200,{ok:true});
        }
        if (body.action === 'prepare-notion') {
            if (!actor.admin)
                throw new Error('FORBIDDEN');
            return sendJson(res, 200, { ok: true, ...await prepareNotionWorkspace(db) });
        }
        if(body.action==='academic-migration-reset')return sendJson(res,200,{ok:true,...await resetAcademicMigration(db,actor,body.confirmed)});
        if(body.action==='academic-migration-next')return sendJson(res,200,{ok:true,...await importAcademicMigrationStep(db,actor,body.confirmed,body.reviewToken)});
        if(body.action==='lesson-migration-start'){failureStage='lesson-migration';return sendJson(res,200,{ok:true,job:await startLessonMigration(db,actor,{confirmed:body.confirmed,mode:body.mode})});}
        if(body.action==='lesson-migration-hold-group'){failureStage='lesson-migration';return sendJson(res,200,{ok:true,...await acknowledgeLessonMigrationHoldGroup(db,actor,{code:body.code,confirmed:body.confirmed})});}
        if(body.action==='restore-lesson'){
            failureStage='lesson-restore';
            if(!await lessonAppActive(db,actor))throw Error('LESSON_APP_REQUIRED');
            return sendJson(res,200,{ok:true,...await restoreAppLesson(db,actor,{id:body.id,revision:body.revision,confirmed:body.confirmed})});
        }
        if(body.action==='lesson-cutover'){failureStage='lesson-cutover';return sendJson(res,200,{ok:true,...await requestLessonCutover(db,actor,{confirmed:body.confirmed})});}
        if(body.action==='lesson-cutover-deactivate'){failureStage='lesson-cutover';return sendJson(res,200,{ok:true,...await deactivateLessonApp(db,actor,{confirmed:body.confirmed})});}
        if(body.action==='lesson-migration-step'){failureStage='lesson-migration';return sendJson(res,200,{ok:true,job:await runLessonMigration(db,actor)});}
        if(body.action==='lesson-migration-pause'){failureStage='lesson-migration';return sendJson(res,200,{ok:true,job:await pauseLessonMigration(db,actor)});}
        if(body.action==='lesson-migration-hold'){failureStage='lesson-migration';return sendJson(res,200,{ok:true,...await decideLessonMigrationHold(db,actor,{sourceKey:body.sourceKey,decision:body.decision,confirmed:body.confirmed})});}
        if(body.action==='academic-batch'){
            failureStage='academic-batch';
            const batch=z.object({action:z.literal('academic-batch'),reflect:z.boolean(),rows:z.array(z.object({id:z.string().uuid(),revision:z.number().int().positive().optional(),saveFirst:z.boolean(),data:academicDraftSchema}).strict()).min(1).max(20)}).strict().parse(body);
            if(new Set(batch.rows.map(row=>row.id)).size!==batch.rows.length||batch.rows.some(row=>!row.saveFirst&&(!batch.reflect||!row.revision)))throw Error('INVALID_INPUT');
            const rows=[];for(const row of batch.rows){let record:any;let stored=!row.saveFirst;try{if(row.saveFirst){record=(await saveAppAcademic(db,actor,row,true)).record;stored=true;}if(batch.reflect)record=(await publishAppAcademic(db,actor,row.id,record?.revision??row.revision)).record;rows.push({id:row.id,ok:true,record,phase:batch.reflect?'published':'saved'});}catch(error){const problem=workspaceError(error,'academic-batch');rows.push({id:row.id,ok:false,revision:record?.revision,phase:batch.reflect&&stored?'failed-publish':'failed-save',message:problem.body.message});}}
            return sendJson(res,200,{ok:true,rows});
        }
        if(body.action==='save-academic'){failureStage='academic-save';return sendJson(res,200,{ok:true,...await saveAppAcademic(db,actor,body)});}
        if(body.action==='publish-academic'){failureStage='academic-reflection';return sendJson(res,200,{ok:true,...await publishAppAcademic(db,actor,body.id,body.revision)});}
        if(body.action==='archive-academic'){failureStage='academic-archive';return sendJson(res,200,{ok:true,...await archiveAppAcademic(db,actor,body.id,body.revision,body)});}
        if(body.action==='cancel-academic-delete'){failureStage='academic-archive-cancel';return sendJson(res,200,{ok:true,...await cancelAcademicArchive(db,actor,body.id,body.revision)});}
        if (body.action === 'save-curriculum') {
            const value = z.object({ title: z.string().min(1).max(200), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']), content: z.string().max(30000), classId: z.string().uuid().nullable().optional() }).parse(body.data);
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            const saved=(await db.collection('teacherCurricula').doc(id).get()).data();
            const imported=!saved&&body.id?(await readNotionWorkspace(db,actor)).curricula.find((r:any)=>r.id===id):undefined;
            if(imported&&!canAccessOwned(actor,imported.ownerUid,imported.academyId))throw new Error('FORBIDDEN');
            if(imported&&body.notionEditedAt&&imported.notionEditedAt!==body.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
            const sourceClass=value.classId?(await readNotionWorkspace(db,actor)).classes.find((c:any)=>c.id===value.classId):undefined;
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherCurricula').doc(id);
                if((await t.get(db.collection('academyClassAuthority').doc('main'))).data()?.active)throw Error('CORE_FROZEN');
                const previous = (await t.get(ref)).data()||imported;
                if(value.classId){const linked=(await t.get(db.collection('teacherClasses').doc(value.classId))).data()||sourceClass;if(!linked||linked.archived||!canAccessOwned(actor,linked.ownerUid,linked.academyId)||linked.subject!==value.subject)throw new Error('FORBIDDEN');}
                if (previous?.archived||previous?.deleteRequested||previous?.notionSyncStage==='syncing')throw new Error('FORBIDDEN');
                if(previous?.notionPageId && previous.subject!==value.subject)throw new Error('SOURCE_IDENTITY_LOCKED');
                if(previous && (body.revision??0)!==(previous.revision??0))throw new Error('DRAFT_CONFLICT');
                if (previous && !canAccessOwned(actor, previous.ownerUid, previous.academyId))
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
            if(imported&&!canAccessOwned(actor,imported.ownerUid,imported.academyId))throw new Error('FORBIDDEN');
            if(imported&&body.notionEditedAt&&imported.notionEditedAt!==body.notionEditedAt)throw new Error('NOTION_EDIT_CONFLICT');
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherClasses').doc(id);
                if((await t.get(db.collection('academyClassAuthority').doc('main'))).data()?.active)throw Error('CORE_FROZEN');
                const old = (await t.get(ref)).data()||imported;
                if(old?.archived||old?.deleteRequested||old?.notionSyncStage==='syncing')throw new Error('FORBIDDEN');
                if (old && !canAccessOwned(actor, old.ownerUid, old.academyId))
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
        if(body.action==='prepare-app-schedules')return sendJson(res,200,{ok:true,...await prepareScheduleRecords(db,actor,body.confirmed)});
        if(body.action==='activate-app-schedules'){const result=await activateAppSchedules(db,actor,body.confirmed);teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='archive-schedule'&&await appSchedulesActive(db,actor)){failureStage='schedule-archive';return sendJson(res,200,{ok:true,...await archiveAppSchedule(db,actor,body.id,body.revision)});}
        if (['archive-class','archive-curriculum','archive-schedule'].includes(body.action)) {
            const id=z.string().uuid().parse(body.id), collection=body.action==='archive-class'?'teacherClasses':body.action==='archive-curriculum'?'teacherCurricula':'teacherSchedules',ref=db.collection(collection).doc(id);
            const imported=collection==='teacherSchedules'?(await readSourceSchedules(db,actor)).find(r=>r.id===id):(await readNotionWorkspace(db,actor))[collection==='teacherClasses'?'classes':'curricula'].find((r:any)=>r.id===id);
            const old=await db.runTransaction(async t=>{
                if(collection!=='teacherSchedules'&&(await t.get(db.collection('academyClassAuthority').doc('main'))).data()?.active)throw Error('CORE_FROZEN');
                const r=(await t.get(ref)).data()||imported;if(!r||!canAccessOwned(actor,r.ownerUid,r.academyId))throw new Error('FORBIDDEN');
                if(collection==='teacherSchedules'&&r.data.students.some((key:string)=>!canTeach(actor,key,r.data.subject)))throw Error('FORBIDDEN');
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
                catch(e:any){await updatePublicationRevision(db,'teacherSchedules',id,old.revision,{stage:'failed',failureCode:e.message}).catch(()=>{});throw e;}
            }
            if(collection!=='teacherSchedules')await syncManagedRecord(db,collection,id);
            return sendJson(res,200,{ok:true});
        }
        if(body.action==='save-schedule'&&await appSchedulesActive(db,actor)){failureStage='schedule-save';return sendJson(res,200,{ok:true,...await saveAppSchedule(db,actor,body)});}
        if (body.action === 'save-schedule') {
            const value = teacherScheduleSchema.parse(body.data);
            if (value.students.some(key => !canTeach(actor, key, value.subject)))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            const saved=(await db.collection('teacherSchedules').doc(id).get()).data();
            const imported=!saved&&body.id?(await readSourceSchedules(db,actor)).find(r=>r.id===id):undefined;
            const existing=saved||imported;
            if(existing&&!canAccessOwned(actor,existing.ownerUid,existing.academyId))throw Error('FORBIDDEN');
            const places=await readSchedulePlaceOptions();
            if(value.place!==''&&!places.includes(value.place))throw Error('NOTION_SCHEDULE_PLACE_REQUIRED');
            const record=await db.runTransaction(async (t) => {
                const ref = db.collection('teacherSchedules').doc(id);
                const old = (await t.get(ref)).data()||imported;
                if(old?.archived || old?.deleteRequested)throw new Error('FORBIDDEN');
                if (old && !canAccessOwned(actor, old.ownerUid, old.academyId))
                    throw new Error('FORBIDDEN');
                if(old?.notionWrite && (!old.notionWrite.done || old.lastSubmittedRevision!==old.revision))throw new Error('NOTION_WRITE_PENDING');
                if (old && ['processing', 'publishing', 'notion_saved'].includes(old.stage))
                    throw new Error('PUBLISH_IN_PROGRESS');
                if (old && body.revision !== old.revision)
                    throw new Error('DRAFT_CONFLICT');
                const next={ ...old, data: value, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', updatedAt: Date.now() }; t.set(ref,next);return {id,...next};
            });
            return sendJson(res, 200, { ok: true, id, record });
        }
        if(body.action==='publish-schedule'&&await appSchedulesActive(db,actor)){failureStage='schedule-reflection';return sendJson(res,200,{ok:true,...await publishAppSchedule(db,actor,body.id,body.revision)});}
        if (body.action === 'publish-schedule') {
            failureStage='schedule-reflection';
            const id = z.string().uuid().parse(body.id), ref = db.collection('teacherSchedules').doc(id);
            const record = await db.runTransaction(async (t) => {
                const old = (await t.get(ref)).data();
                if (!old || (old.archived||old.deleteRequested) || !canAccessOwned(actor, old.ownerUid, old.academyId) || old.data.students.some((key: string) => !canTeach(actor, key, old.data.subject)))
                    throw new Error('FORBIDDEN');
                if (publishDecision(old) === 'already-published')
                    return { ...old, alreadyPublished: true };
                t.update(ref, { stage: 'publishing', publishStartedAt: Date.now() });
                return old;
            });
            if (record.alreadyPublished)
                return sendJson(res, 200, { ok: true, stage: 'published',record:{id,...record} });
            try {
                return sendJson(res, 200, { ok: true, pageId: await publishTeacherSchedule(db, id, record),record:{id,...(await ref.get()).data()} });
            }
            catch (error: any) {
                await updatePublicationRevision(db,'teacherSchedules',id,record.revision,{ stage: 'failed', failureCode: error.message }).catch(()=>{});
                throw error;
            }
        }
        if (body.action === 'save-draft' && await lessonAppActive(db,actor)) {
            // App-only: private draft + history in one transaction; the public report changes only on publish.
            failureStage='lesson-app-save';
            if(body.id)await settleUncertainLessonWrite(db,z.string().uuid().parse(body.id));
            const saved=await saveAppLesson(db,actor,{id:body.id,revision:body.revision,data:body.data});
            return sendJson(res,200,{ok:true,id:saved.id,record:saved.record});
        }
        if (body.action === 'save-draft') {
            failureStage='lesson-draft-validation';
            const value = lessonDraftSchema.parse(body.data);
            if (!canTeach(actor, value.studentKey, value.subject))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            const record=await db.runTransaction(async (t) => {
                const ref = db.collection('teacherLessonDrafts').doc(id);
                const old = (await t.get(ref)).data();
                if(old?.archived||old?.deleteRequested)throw new Error('FORBIDDEN');
                if (old && !canAccessOwned(actor, old.ownerUid, old.academyId))
                    throw new Error('FORBIDDEN');
                assertDraftEditable(old, body.revision, value);
                const next={ ...old, data: value, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', percentage: percentage(value.correct, value.total), updatedAt: Date.now() }; t.set(ref,next);return {id,...next};
            });
            return sendJson(res, 200, { ok: true, id, record });
        }
        if(body.action==='resolve-schedule-conflict'&&await appSchedulesActive(db,actor))throw Error('SCHEDULE_APP_ACTIVE');
        if(body.action==='resolve-academic-conflict'&&await academicAppActive(db))throw Error('ACADEMIC_APP_ACTIVE');
        if(body.action==='academic-cutover'){failureStage='academic-cutover';return sendJson(res,200,{ok:true,...await activateAcademicApp(db,actor,{confirmed:body.confirmed})});}
        if(body.action==='academic-cutover-deactivate'){failureStage='academic-cutover';return sendJson(res,200,{ok:true,...await deactivateAcademicApp(db,actor,{confirmed:body.confirmed})});}
        if(body.action==='resolve-academic-conflict'||body.action==='resolve-schedule-conflict'){const {action,...input}=body;return sendJson(res,200,{ok:true,...await resolveRecordConflict(db,actor,action==='resolve-academic-conflict'?'academic':'schedule',input)});}
        if((body.action==='resolve-lesson-conflict')&&await lessonAppActive(db,actor))throw Error('LESSON_APP_ACTIVE');
        if(body.action==='resolve-lesson-conflict'){failureStage='lesson-conflict-resolution';const {action,...input}=body;return sendJson(res,200,{ok:true,...await resolveLessonConflict(db,actor,input)});}
        if(body.action==='today-lesson-visibility'){const {action,...input}=body;return sendJson(res,200,{ok:true,hiddenTodayLessons:await changeTodayVisibility(db,actor.uid,input)});}
        if(body.action==='archive-lesson'&&await lessonAppActive(db,actor)){
            // App-only: removes only the selected public report; the draft and prior public content go to history.
            failureStage='lesson-app-archive';
            const draft=await ensureAppLessonDraft(db,actor,body.id);await settleUncertainLessonWrite(db,draft.id);
            const current=(await db.collection('teacherLessonDrafts').doc(draft.id).get()).data();
            const revision=draft.id===body.id&&body.revision!==undefined&&body.revision!==0?body.revision:current?.revision;
            const result=await archiveAppLesson(db,actor,draft.id,revision);
            return sendJson(res,200,{ok:true,archived:true,record:result.record||null});
        }
        if(body.action==='archive-lesson'){failureStage='lesson-archive';return sendJson(res,200,{ok:true,...await archiveTeacherLesson(db,actor,body.id,body.revision)});}
        if (body.action === 'publish' && await lessonAppActive(db,actor)) {
            // App-only: visibility to students/parents is the publish transaction itself; no Notion copy.
            failureStage='lesson-app-publish';
            const id=z.string().uuid().parse(body.id);await settleUncertainLessonWrite(db,id);
            const current=(await db.collection('teacherLessonDrafts').doc(id).get()).data();
            if(!current||!canAccessOwned(actor,current.ownerUid,current.academyId))throw new Error('FORBIDDEN');
            assertLessonComplete(current.data);
            const result=await publishAppLesson(db,actor,id,body.revision??current.revision);
            return sendJson(res,200,{ok:true,stage:result.stage,pageId:result.record?.notionPageId||null,record:result.record});
        }
        if (body.action === 'publish') {
            failureStage='lesson-reflection';
            const id = z.string().uuid().parse(body.id);
            const ref = db.collection('teacherLessonDrafts').doc(id);
            const draft = await db.runTransaction(async (t) => {
                const old = (await t.get(ref)).data();
                if (!old || (old.archived||old.deleteRequested) || !canAccessOwned(actor, old.ownerUid, old.academyId) || !canTeach(actor, old.data.studentKey, old.data.subject))
                    throw new Error('FORBIDDEN');
                if (publishDecision(old) === 'already-published')
                    return { ...old, alreadyPublished: true };
                assertLessonComplete(old.data);
                t.update(ref, { stage: 'publishing', publishStartedAt: Date.now() });
                return old;
            });
            if (draft.alreadyPublished)
                return sendJson(res, 200, { ok: true, stage: 'published', pageId: draft.notionPageId,record:{id,...draft} });
            try {
                // Publish to the app first. Notion is an additional copy, never a Make trigger.
                await writeDirectLessonReport(db,id,draft);
                const pageId = await publishTeacherDraft(db, id, draft);
                await writeDirectLessonReport(db,id,{...draft,notionPageId:pageId});
                await updatePublicationRevision(db,'teacherLessonDrafts',id,draft.revision,{stage:'published',lastSubmittedRevision:draft.revision,failureCode:null});
                return sendJson(res, 200, { ok: true, stage: 'published', pageId,record:{id,...(await ref.get()).data()} });
            }
            catch (error: any) {
                const saved=(await ref.get()).data();
                if(saved?.directReportRevision===draft.revision) {
                    await updatePublicationRevision(db,'teacherLessonDrafts',id,draft.revision,{stage:'report_published_notion_pending',failureCode:error.message});
                    const failure=workspaceError(error,failureStage);
                    console.warn('TEACHER_LESSON_NOTION_PENDING',{error:failure.body.error,diagnosticId:failure.body.diagnosticId,failureStage,draftId:id,revision:draft.revision});
                    return sendJson(res,200,{ok:true,stage:'report_published_notion_pending',failureCode:failure.body.error,warning:lessonSyncWarning(failure),diagnosticId:failure.body.diagnosticId,record:{id,...(await ref.get()).data()}});
                }
                await updatePublicationRevision(db,'teacherLessonDrafts',id,draft.revision,{ stage: 'failed', failureCode: error.message }).catch(()=>{});
                throw error;
            }
        }
        if (body.action === 'previous-lesson') {
            const key = z.string().uuid().parse(body.studentKey);
            const subject = z.enum(['영어', '수학', '국어', '과학', '한국사']).parse(body.subject);
            if (!canTeach(actor, key, subject))
                throw new Error('FORBIDDEN');
            const date=body.date===undefined?undefined:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(body.date);
            const records=await teacherReadCache.get(teacherReadKey(actor,'previous-lessons-local'),async()=>(await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).get()).docs.map(d=>({id:d.id,...d.data()})));
            const local=latestPreviousLesson(records,key,subject,date);
            const localRecords=records.filter((r:any)=>!r.archived&&!r.deleteRequested&&r.data?.studentKey===key&&r.data.subject===subject);
            const context={studentKey:key,subject,date};
            const needLesson=Boolean(date)&&!sessionBase(localRecords,context,'lesson');
            const needStudy=Boolean(date)&&!sessionBase(localRecords,context,'study');
            const remote=!local||needLesson||needStudy?(await lessonAppActive(db,actor)?await previousAppSourceLesson(db,actor,key,subject,date):await previousNotionLesson(key,{db,actor,subject,date,includeSessionHistory:true})):undefined;
            const previous=local||remote||{};
            // Existing app history is authoritative per counter; fill only missing counters from Notion.
            const remoteRecords=(remote?.sessionRecords||[]).filter((r:any)=>!records.some((saved:any)=>(saved.archived||saved.deleteRequested)&&saved.notionPageId&&normalizeNotionPageId(saved.notionPageId)===normalizeNotionPageId(r.id))).map((r:any)=>({...r,data:{...r.data,...(!needLesson&&local?{classSession:'없음',round:null}:{}),...(!needStudy&&local?{selfStudy:'없음',selfStudyRound:null}:{})}}));
            const sessionRecords=[...localRecords,...remoteRecords];
            return sendJson(res, 200, { ok: true, data: {...previousLessonValues(previous),sessionRecords:sessionRecordSummaries(sessionRecords),sessionContext:{studentKey:key,subject,date}} });
        }
        if (body.action === 'continue') {
            const id = z.string().uuid().parse(body.id);
            const old = (await db.collection('teacherLessonDrafts').doc(id).get()).data();
            if (!old || (old.archived||old.deleteRequested) || !canAccessOwned(actor, old.ownerUid, old.academyId))
                throw new Error('FORBIDDEN');
            return sendJson(res, 200, { ok: true, data: continuation(old.data) });
        }
        return sendJson(res, 400, { ok: false, error: 'UNKNOWN_ACTION' });
    }
    catch (error: any) {
        failureStage=error?.workspaceStage||failureStage;
        const result = workspaceError(error, failureStage);
        if(result.body.error==='FIRESTORE_RESOURCE_EXHAUSTED')res.setHeader('Retry-After','30');
        if (result.status >= 500 || result.body.error==='FIRESTORE_RESOURCE_EXHAUSTED' || failureStage.startsWith('lesson-') || failureStage.endsWith('-source-import')) console.warn('TEACHER_WORKSPACE_FAILED', {error: result.body.error, diagnosticId: result.body.diagnosticId, failureStage,...workspaceFailureDiagnostic(error)});
        return sendJson(res, result.status, result.body);
    } finally { if(mutation)invalidateTeacherMutation(mutation); }
}








