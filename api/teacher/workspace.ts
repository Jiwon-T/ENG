import { startServerTiming } from '../_lib/serverTiming.js';
import {loadLessonDayStudy,loadTeacherOnlineLearning} from '../_lib/teacherOnlineLearning.js';
import {workspaceFailureDiagnostic} from '../_lib/workspaceFailureDiagnostic.js';
import { loadTeacherReportReview, lessonReportPage } from '../_lib/teacherReportReview.js';
import { academicAppActive } from '../_lib/academicAuthority.js';
import {saveAppSchedule,publishAppSchedule,archiveAppSchedule,readAppSchedulePlaces,appSchedulesActive} from '../_lib/appSchedule.js';
import { lessonAppActive } from '../_lib/lessonAuthority.js';
import {readAppSourceLessons,previousAppSourceLesson,ensureAppLessonDraft,settleUncertainLessonWrite} from '../_lib/appLessonSource.js';
import { validLessonSliceFilter, lessonDraftSlice, narrowsLessonSlice } from '../_lib/lessonReviewSlice.js';
import {getFirebaseAdmin} from '../_lib/firebaseAdmin.js';
import {timingSafeCompare} from '../_lib/security.js';
import {saveAppAcademic,publishAppAcademic,archiveAppAcademic,listAppAcademicSources,appAcademicStudents} from '../_lib/appAcademic.js';
import { directoryStudentReads, readDirectoryStudents, applyDirectoryStudentSummary } from '../_lib/academyDirectorySource.js';
import {coreActive,readCoreScopes,saveCoreGrant,restoreCoreProfile,readCoreEnrollmentSummaries,readCoreAdmission,saveCoreAdmission} from '../_lib/academyCore.js';
import {studentProfileSchema,profileFromPage,profileProperties} from '../_lib/teacherStudentProfile.js';
import { classesActive, saveManaged, archiveManaged } from '../_lib/managedAcademy.js';
import {readTodayVisibility,changeTodayVisibility} from '../_lib/teacherTodayVisibility.js';
import {compareLessonReview,validLessonDay} from '../../src/lib/lessonReview.js';
import {readStudentEnrollment,saveStudentEnrollment,discardStudentEnrollment} from '../_lib/teacherStudentEnrollment.js';
import {readStudentProfile,saveStudentProfile,discardStudentProfile} from '../_lib/teacherStudentProfile.js';
import { convertRegistrationToResident, studentRegistrationSchema, saveStudentRegistration, listStudentRegistrations, readStudentRegistration } from '../_lib/teacherStudentRegistration.js';
import {scheduleRange,readReflectedRange,readManagedScheduleRange} from '../_lib/teacherScheduleRange.js';
import { latestPreviousLesson, previousLessonValues } from '../../src/lib/teacherTodayLessons.js';
import {sessionBase,sessionRecordSummaries} from '../../src/lib/sessionNumbers.js';
import { teacherReadCache, teacherReadKey, pageRows, pageNumber, invalidateTeacherMutation } from '../_lib/teacherReadCache.js';
import { lessonStatus, lessonStatusCounts, validLessonStatus, academicStats, withPreviousScores } from '../_lib/reviewSummary.js';
import { normalizeNotionPageId } from '../_lib/notionPageId.js';
import { mergeNotionRows } from '../_lib/mergeSourceRows.js';
import { teacherReflectedSchedules } from '../_lib/teacherReflectedSchedules.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { academicDraftSchema, canViewAcademyRecord } from '../_lib/teacherAcademicPolicy.js';
import { workspaceError } from '../_lib/teacherWorkspaceError.js';
import { teacherActor } from '../_lib/teacherWorkspaceAuth.js';
import { canAccessOwned, canTeach, assertLessonComplete, continuation } from '../_lib/teacherWorkspacePolicy.js';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { readStudentDirectoryMappings } from '../_lib/studentDirectoryMappings.js';
import { offlinePhone, offlineSubjects } from '../_lib/offlineTeacher.js';
// App-only lessons are confirmed in the same transaction that publishes them; nothing waits on Notion.
async function confirmLessonRecords(_db:any,_records:any[]) {}
async function workspaceStudents(db:any,actor:any,force:boolean,saveSnapshot=false){
    // Students come from the app directory (cached briefly; "새로고침" passes force). An academy that has not switched gets a clear error instead of Notion.
    return teacherReadCache.get(teacherReadKey(actor,'students'),async()=>{if(!directoryStudentReads(actor))throw new Error('CORE_NOT_READY');return readDirectoryStudents(db,actor);},force);
}
// The enrollment collection read by most bootstrap sections, cached briefly per actor like the other teacherReadCache
// entries ("새로고침" and the reloads after saves pass force; any workspace change clears it). Student links are NOT cached:
// they change through other endpoints and devices (link, unlink, 탈퇴, link codes) and must show right away.
function cachedEnrollmentDocs(db:any,actor:any,force:boolean){return teacherReadCache.get(teacherReadKey(actor,'enrollment-docs'),async()=>(await db.collection('studentEnrollments').get()).docs.map((d:any)=>d.data()),force);}
/** Own lessons of one day, summary fields only (what 오늘 수업 progress compares: student, subject, start, stage). */
async function readDayLessons(db:any,actor:any,day:string){
    const snap=await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).where('data.date','==',day).select('stage','archived','deleteRequested','updatedAt','revision','data.studentKey','data.date','data.subject','data.start','data.end','data.classSession','data.selfStudyStart','data.selfStudyEnd').get();
    return snap.docs.map((d:any)=>{const r=d.data();return {id:d.id,stage:r.stage,archived:Boolean(r.archived),deleteRequested:Boolean(r.deleteRequested),updatedAt:r.updatedAt,revision:r.revision,data:{studentKey:r.data?.studentKey,date:r.data?.date,subject:r.data?.subject,start:r.data?.start,end:r.data?.end,classSession:r.data?.classSession,selfStudyStart:r.data?.selfStudyStart,selfStudyEnd:r.data?.selfStudyEnd}};});
}
async function reportReview(db:any,actor:any,studentKey:string,audience:'parent'|'student',values:any) {
    if(values.section==='online'){if(audience!=='student')throw Error('FORBIDDEN');return loadTeacherOnlineLearning(db,actor,studentKey,values.subject,values.cursor);}
    if(!values.section)return loadTeacherReportReview(db,actor,studentKey,audience);
    const section=z.enum(['schedule','lessons','grades']).parse(values.section);
    const subject=z.string().max(100).parse(values.subject||'');const page=pageNumber(values.page);
    const snapshot=await teacherReadCache.get(teacherReadKey(actor,`report:${studentKey}:${audience}:${section}`),()=>loadTeacherReportReview(db,actor,studentKey,audience,undefined,{section,page:1,subject:'',snapshot:true}),values.force==='1');
    // 수업 기록: the cached snapshot holds a small index; each page reads only its 5 reports (and their completions).
    if(section==='lessons')return {...snapshot,...await lessonReportPage(db,snapshot,audience,subject,page)};
    const filtered=snapshot.reports.filter((r:any)=>!subject||r.subject===subject);
    const paged=pageRows(filtered,page,5);
    return {...snapshot,reports:paged.records,reportTotal:paged.total,reportPage:paged.page,reportPages:paged.pages};
}
/** Only the picked emoji icon and pet name/level leave the user document; photo URLs and anything else stay private. */
function studentLook(u:any){if(!u)return null;const icon=typeof u.photoURL==='string'&&u.photoURL.length<=8&&!/^https?:/i.test(u.photoURL)?u.photoURL:null;const p=u.petStats,pet=p&&typeof p.petName==='string'&&p.petName&&p.petName!=='친구가 필요해요'?{name:String(p.petName).slice(0,20),level:Number.isFinite(p.highestLevel)?Number(p.highestLevel):null,character:typeof p.character==='string'?p.character.slice(0,30):null,count:Number.isFinite(p.petCount)?Math.max(1,Math.min(6,Math.floor(p.petCount))):1}:null;
    // 장학 쿠폰 this month (from the pet summary): another month = nothing earned yet this month; a summary saved before it
    // carried the month (no couponMonth) = not known yet, so no % is shown rather than a wrong 0%
    const month=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()).slice(0,7),known=pet&&typeof p.couponMonth==='string';
    const coupon=!known?null:p.couponMonth===month&&Number.isFinite(p.couponEarned)?Math.max(0,Math.floor(p.couponEarned)):0;
    return icon||pet?{icon,pet:pet&&{...pet,coupon}}:null;}

/** One page of this teacher's saved lessons (newest first). Shared by drafts-page and the lesson bootstrap. */
async function readDraftsPage(db:any,actor:any,pageNo:number,sizeInput:number,force:boolean){
    const summaries=await teacherReadCache.get(teacherReadKey(actor,'draft-summaries'),async()=>{
        const rows=await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).select('updatedAt','archived').get();
        return rows.docs.filter((d:any)=>!d.data().archived).map((d:any)=>({id:d.id,updatedAt:d.data().updatedAt||0})).sort((a:any,b:any)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
    },force);
    const size=Math.min(Math.max(sizeInput||10,5),20),page=pageRows(summaries,pageNo,size);
    const docs=page.records.length?await db.getAll(...page.records.map((r:any)=>db.collection('teacherLessonDrafts').doc(r.id))):[];
    const records=docs.filter((d:any)=>d.exists&&d.data()?.ownerUid===actor.uid).map((d:any)=>({id:d.id,...d.data()}));if(force)await confirmLessonRecords(db,records);
    return {...page,records};
}
export default async function handler(req: IncomingMessage,res:ServerResponse){
    const params=new URL(req.url||'','http://localhost').searchParams;
    if(params.get('__cron')==='lesson-migration')return handleLessonMigrationCron(req,res);
    if(params.get('__cron')==='makeup-push')return handleMakeupPushCron(req,res);
    if(params.get('__hook')==='new-signups')return handleSignupHook(req,res);
    return handleWorkspace(req,res);
}
/** 08:00 KST (Vercel Cron, Authorization: Bearer CRON_SECRET): today's 보강 alerts to students who turned 알림 on. */
export async function handleMakeupPushCron(req: IncomingMessage,res:ServerResponse,initialize=getFirebaseAdmin,now=Date.now()){
    const secret=process.env.CRON_SECRET||'',header=req.headers.authorization||'';
    if(secret.length<16||!timingSafeCompare(header,'Bearer '+secret))return sendJson(res,401,{ok:false,error:'UNAUTHORIZED'});
    try{const {db}=initialize();const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(now));
        const r=await (await import('../_lib/pushSend.js')).sendMakeupMorning(db,today);return sendJson(res,200,{ok:true,...r});}
    catch(error:any){console.warn('MAKEUP_PUSH_CRON_FAILED',{error:String(error?.message||'').slice(0,80)});return sendJson(res,500,{ok:false,error:'MAKEUP_PUSH_FAILED',retry:'next-daily-run'});}
}
/** Daily scheduler entry (Vercel Cron sends Authorization: Bearer CRON_SECRET). The path keeps its old name so the cron setting needs no change. */
export async function handleLessonMigrationCron(req: IncomingMessage,res:ServerResponse,initialize=getFirebaseAdmin){
    const secret=process.env.CRON_SECRET||'',header=req.headers.authorization||'';
    if(secret.length<16||!timingSafeCompare(header,'Bearer '+secret))return sendJson(res,401,{ok:false,error:'UNAUTHORIZED'});
    try{const {db}=initialize();
        // Daily: empty lessons that have been in the trash for more than 7 days. (The Notion lesson migration this job used to run is finished.)
        // A failed purge is reported (HTTP 500 + code) so the scheduler shows it; it is retried on the next daily run.
        const {purgeExpiredLessonTrash}=await import('../_lib/appLessonRestore.js');let trash:{purged:number;more:boolean};
        try{trash=await purgeExpiredLessonTrash(db);}catch(e:any){console.warn('LESSON_TRASH_PURGE_FAILED',{error:String(e?.message||'').slice(0,80)});return sendJson(res,500,{ok:false,error:'LESSON_TRASH_PURGE_FAILED',retry:'next-daily-run'});}
        return sendJson(res,200,{ok:true,trashPurged:trash.purged,more:Boolean(trash.more)});}
    catch(error:any){const result=workspaceError(error,'lesson-migration-cron');console.warn('LESSON_MIGRATION_CRON_FAILED',{error:result.body.error,diagnosticId:result.body.diagnosticId});return sendJson(res,result.status,result.body);}
}
/** 새 가입자 알림 for Make (Authorization: Bearer MAKE_HOOK_SECRET, at least 16 characters; unset = off). */
export async function handleSignupHook(req: IncomingMessage,res:ServerResponse,initialize=getFirebaseAdmin){
    const secret=process.env.MAKE_HOOK_SECRET||'',header=req.headers.authorization||'';
    if(req.method!=='GET')return sendJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
    if(secret.length<16||!timingSafeCompare(header,'Bearer '+secret))return sendJson(res,401,{ok:false,error:'UNAUTHORIZED'});
    try{const {db}=initialize();const {newSignups}=await import('../_lib/signupHook.js');return sendJson(res,200,{ok:true,...await newSignups(db)});}
    catch(error:any){console.warn('SIGNUP_HOOK_FAILED',{code:typeof error?.code==='string'||typeof error?.code==='number'?String(error.code).slice(0,40):'unknown'});return sendJson(res,500,{ok:false,error:'SIGNUP_HOOK_FAILED'});} // the code only: messages may carry personal data
}
export async function handleWorkspace(req: IncomingMessage, res: ServerResponse, actorProvider=teacherActor) {
    let failureStage = 'authentication';
    let mutation:string|null=null;
    const timing=startServerTiming(res);
    try {
        const actor = await actorProvider(req);
        timing.mark('auth');for(const [name,ms] of Object.entries((actor as any).stageTimes||{}))timing.add('auth-'+name,ms as number);
        const { db } = actor;
        failureStage = 'workspace-data';
        if (req.method === 'GET') {
            const params = new URL(req.url || '', 'http://localhost').searchParams;
            const action = params.get('action') || 'bootstrap';
            const force = params.get('force') === '1';
            if(action==='schedule-options'){failureStage='schedule-place-options';return sendJson(res,200,{ok:true,places:await readAppSchedulePlaces(db,actor)});}
            if(action==='teacher-assignment'){
                if(!actor.admin&&!actor.principal)throw Error('FORBIDDEN');
                const uid=z.string().min(1).parse(params.get('uid')),profile=(await db.collection('teacherWorkspaceAccess').doc(uid).get()).data();
                if(!profile||profile.disabled||!actor.admin&&profile.academyId!==actor.academyId)throw Error('FORBIDDEN');
                return sendJson(res,200,{ok:true,scopes:await readCoreScopes(db,{...profile,uid})});
            }
            // Notion↔app conflict reviews cannot arise once records live only in the app.
            if(action==='schedule-conflict')throw Error('SCHEDULE_APP_ACTIVE');
            if(action==='academic-conflict')throw Error('ACADEMIC_APP_ACTIVE');
            if(action==='lesson-conflict')throw Error('LESSON_APP_ACTIVE');
            if(action==='messages'){failureStage='message-read';return sendJson(res,200,{ok:true,...await (await import('../_lib/teacherMessages.js')).readTeacherMessages(db,actor,params.get('studentKey'),params.get('subject'))});}
            if(action==='student-enrollment'){failureStage='student-enrollment-read';return sendJson(res,200,{ok:true,record:await readStudentEnrollment(db,actor,params.get('studentKey'))});}
            if(action==='student-pet'){failureStage='pet-party';const {readStudentPet}=await import('../_lib/teacherPetParty.js');return sendJson(res,200,{ok:true,...await readStudentPet(db,actor,params.get('studentKey'))});}
            if(action==='student-party'){failureStage='pet-party';const {readStudentParty}=await import('../_lib/teacherPetParty.js');return sendJson(res,200,{ok:true,...await readStudentParty(db,actor,params.get('studentKey'))});}
            // 선생님 인증 (학습 리포트 › 인증 요청): the student's requests, and a waiting one's photo
            if(action==='study-certs'||action==='study-cert-photo'||action==='study-cert-inbox'){failureStage='study-certs';const c=await import('../_lib/studyCerts.js'),{CERT_MESSAGES}=await import('../_lib/student/study-cert.js');try{return sendJson(res,200,{ok:true,...(action==='study-cert-inbox'?await c.loadCertInbox(db,actor,params.get('after')):action==='study-certs'?await c.loadStudentCerts(db,actor,params.get('studentKey')):await c.studyCertPhoto(db,actor,params.get('studentKey'),params.get('id')))});}catch(error:any){const known=CERT_MESSAGES[String(error?.message)];if(known)return sendJson(res,known[0],{ok:false,error:error.message,message:known[1]});throw error;}}
            if(action==='question-attempts'){failureStage='question-attempts';const {loadStudentQuestionAttempts}=await import('../_lib/teacherQuestionAttempts.js');return sendJson(res,200,{ok:true,...await loadStudentQuestionAttempts(db,actor,params.get('studentKey'))});}
            if(action==='workbook-history'){failureStage='workbook';const {readWorkbookHistory}=await import('../_lib/teacherWorkbook.js');return sendJson(res,200,{ok:true,...await readWorkbookHistory(db,actor,params.get('key'))});}
            if(action==='pet-expedition-settings'){failureStage='pet-expedition';const {readExpeditionSettings}=await import('../_lib/petSentences.js');return sendJson(res,200,{ok:true,...await readExpeditionSettings(db,actor)});}
            if(action==='pet-tower-settings'){failureStage='pet-tower';const {readTowerSettings}=await import('../_lib/petTower.js');return sendJson(res,200,{ok:true,...await readTowerSettings(db,actor)});}
            if(action==='ai-passes'){failureStage='ai-usage';const {readAiPasses}=await import('../_lib/aiModel.js');return sendJson(res,200,{ok:true,...await readAiPasses(db,actor)});}
            if(action==='ai-monthly'){failureStage='ai-usage';const {readAiMonthly}=await import('../_lib/aiModel.js');return sendJson(res,200,{ok:true,...await readAiMonthly(db,actor)});}
            if(action==='ai-usage'){failureStage='ai-usage';const {readAiUsage}=await import('../_lib/aiModel.js');return sendJson(res,200,{ok:true,...await readAiUsage(db,actor)});}
            if(action==='student-coupon'){failureStage='pet-coupon';const {teacherStudentCoupon}=await import('../_lib/petCoupon.js');return sendJson(res,200,{ok:true,...await teacherStudentCoupon(db,actor,params.get('studentKey'))});}
            if(action==='rank-names'){failureStage='pet-coupon';const {listRankNames}=await import('../_lib/petMonthRanking.js');return sendJson(res,200,{ok:true,...await listRankNames(db,actor)});}
            if(action==='pet-points'){failureStage='pet-coupon';const {listPetPoints}=await import('../_lib/petCoupon.js');return sendJson(res,200,{ok:true,...await listPetPoints(db,actor)});}
            if(action==='pet-coupons'){failureStage='pet-coupon';const {listCoupons}=await import('../_lib/petCoupon.js');return sendJson(res,200,{ok:true,...await listCoupons(db,actor)});}
            if(action==='guild-nicknames'){failureStage='pet-party';const {listGuildNicknames}=await import('../_lib/teacherPetParty.js');return sendJson(res,200,{ok:true,...await listGuildNicknames(db,actor)});}
            if(action==='student-school'){failureStage='student-school';const {readStudentSchool}=await import('../_lib/studentSchool.js');return sendJson(res,200,{ok:true,...await readStudentSchool(db,actor,params.get('studentKey'))});}
            if(action==='student-admission'){failureStage='student-admission-read';if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');return sendJson(res,200,{ok:true,record:await readCoreAdmission(db,actor,params.get('studentKey'))});}
            if(action==='student-profile'){failureStage='student-profile-read';return sendJson(res,200,{ok:true,record:await readStudentProfile(db,actor,params.get('studentKey'))});}
            if (action === 'registration-options') {
                failureStage='student-registration-options';
                return sendJson(res,200,{ok:true,...await (await import('../_lib/teacherRegistrationAssignments.js')).registrationAssignmentOptions(db,actor)});
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
            if(action==='student-tuition'){failureStage='student-tuition';const {readStudentTuition}=await import('../_lib/studentTuition.js');return sendJson(res,200,{ok:true,...await readStudentTuition(db,actor,params.get('studentKey'))});}
            if(action==='teacher-payroll'){failureStage='teacher-payroll';const {readTeacherPayroll}=await import('../_lib/teacherPayroll.js');return sendJson(res,200,{ok:true,...await readTeacherPayroll(db,actor,params.get('month'))});}
            if(action==='tuition-month'){failureStage='tuition-month';const {readTuitionMonth}=await import('../_lib/tuitionMonth.js');return sendJson(res,200,{ok:true,...await readTuitionMonth(db,actor,params.get('month'))});}
            if(action==='admin-history'){failureStage='admin-history';const {readAdminHistory}=await import('../_lib/adminHistory.js');return sendJson(res,200,{ok:true,...await readAdminHistory(db,actor,params.get('group'))});}
            if(action==='teacher-transfers'){failureStage='teacher-transfers';const {readTeacherTransfers}=await import('../_lib/teacherTransfers.js');return sendJson(res,200,{ok:true,...await readTeacherTransfers(db,actor)});}
            if(action==='removed-users'){failureStage='app-users';const {listRemovedUsers}=await import('../_lib/appUsers.js');return sendJson(res,200,{ok:true,...await listRemovedUsers(db,actor)});}
            if(action==='link-suggestions'){failureStage='link-suggestions';const {readLinkSuggestions}=await import('../_lib/linkSuggestions.js');return sendJson(res,200,{ok:true,...await readLinkSuggestions(db,actor)});}
            if(action==='app-users'){failureStage='app-users';const {listAppUsers}=await import('../_lib/appUsers.js');return sendJson(res,200,{ok:true,...await listAppUsers(db,actor)});}
            if(action==='archived-lessons'){failureStage='lesson-restore';return sendJson(res,200,{ok:true,appMode:await lessonAppActive(db,actor),...(await lessonAppActive(db,actor)?await (await import('../_lib/appLessonRestore.js')).listArchivedAppLessons(db,actor):{records:[]})});}
            if (action === 'academic-records'||action==='academic-records-fast') {
                // The visible students are needed for names and by the full source read: start once, share, in parallel.
                const studentsPromise=params.has('page')||action==='academic-records'?teacherReadCache.get(teacherReadKey(actor,'academic-firestore-students'),()=>appAcademicStudents(db,actor),force):null;studentsPromise?.catch(()=>{});
                const localPromise=teacherReadCache.get(teacherReadKey(actor,'academic-local'),async()=>{const saved=actor.admin ? await db.collection('teacherAcademicDrafts').get() : actor.principal ? await db.collection('teacherAcademicDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherAcademicDrafts').where('ownerUid','==',actor.uid).get();return saved.docs.map(d=>({id:d.id,...d.data()})).filter((r:any)=>canViewAcademyRecord(actor,r));},force);
                const sourcePromise=action==='academic-records-fast'?Promise.resolve([]):teacherReadCache.get(teacherReadKey(actor,'academic-firestore-source:'+JSON.stringify([params.get('student'),params.get('subject')])),()=>listAppAcademicSources(db,actor,{studentKey:params.get('student')||undefined,subject:params.get('subject')||undefined,students:studentsPromise||undefined}),force);
                const [appRecords,source]=await Promise.all([localPromise,sourcePromise]);
                const records=(action==='academic-records-fast'?appRecords:mergeNotionRows(appRecords,source)).filter((r:any)=>!r.archived);
                if (!params.has('page')) return sendJson(res,200,{ok:true,records});
                const {examPeriod}=await import('../../src/lib/academicExamPeriod.js');
                const students=await studentsPromise!;const names=new Map(students.map(s=>[s.studentKey,s.studentDisplayName]));
                const filtered=records.filter((r:any)=>(!params.get('teacher')||r.ownerUid===params.get('teacher')||r.teacherUids?.includes(params.get('teacher')))&&(!params.get('student')||r.data.studentKey===params.get('student'))&&(!params.get('kind')||r.data.examType===params.get('kind'))&&(!params.get('subject')||r.data.subject===params.get('subject'))&&(!params.get('period')||examPeriod(r.data)?.key===params.get('period'))&&(!params.get('search')||[names.get(r.data.studentKey),r.data.title,r.data.subject,r.data.note].join(' ').toLowerCase().includes(params.get('search')!.toLowerCase()))).sort((a:any,b:any)=>b.data.examDate.localeCompare(a.data.examDate)||a.id.localeCompare(b.id));
                // Stats cover every filter except the 미제출 shortcut, so its count stays visible while it is selected.
                const shown=params.get('submission')==='미제출'?filtered.filter((r:any)=>r.data.submissionStatus==='미제출'):filtered;
                const paged=pageRows(shown,pageNumber(params.get('page')),60); // grouped views need a fuller page
                return sendJson(res,200,{ok:true,...paged,records:withPreviousScores(paged.records,records),stats:academicStats(filtered),teachers:[...new Set(records.flatMap((r:any)=>r.teacherUids?.length?r.teacherUids:[r.ownerUid]).filter(Boolean))],periods:[...new Map(records.map((r:any)=>examPeriod(r.data)).filter(Boolean).map((p:any)=>[p.key,p])).values()]});
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
                    // The source read and the day queries run together; only the link lookup waits for the source rows.
                    const sourcePromise=action==='academy-lessons-fast'?Promise.resolve([] as any[]):readAppSourceLessons(db,actor,slice);sourcePromise.catch(()=>{});
                    records=await lessonDraftSlice(db,actor,slice,sourcePromise);source=await sourcePromise;
                }else{
                const recordsPromise=teacherReadCache.get(teacherReadKey(actor,'academy-local'),async()=>{const saved=actor.admin ? await db.collection('teacherLessonDrafts').get() : actor.principal ? await db.collection('teacherLessonDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherLessonDrafts').where('ownerUid','==',actor.uid).get();return saved.docs.map(d=>({id:d.id,...d.data()}));},force);
                [records,source]=await Promise.all([recordsPromise,action==='academy-lessons-fast'?Promise.resolve([]):teacherReadCache.get(teacherReadKey(actor,'academy-app-source'),()=>readAppSourceLessons(db,actor),force)]);
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
                // Teachers review only their own lessons; admins and principals see the academy.
                const filtered=named.filter((r:any)=>(actor.admin||actor.principal||r.ownerUid===actor.uid)&&(!params.get('teacher')||r.ownerUid===params.get('teacher'))&&(!params.get('day')||r.data.date===params.get('day'))&&(!periodDays||periodDays.has(r.data.date))&&(!params.get('student')||r.data.studentKey===params.get('student'))).sort(compareLessonReview);
                const status=validLessonStatus(params.get('status'));
                if(narrowsLessonSlice(slice)&&(actor.admin||actor.principal)){
                    // The teacher filter keeps listing every teacher even when only one day is loaded.
                    const access=(await teacherReadCache.get(teacherReadKey(actor,'review-teachers'),async()=>(await (actor.admin?db.collection('teacherWorkspaceAccess').get():db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get())).docs.filter((d:any)=>!d.data().disabled).map((d:any)=>d.id),force)) as string[];
                    await Promise.all(access.filter(uid=>!names.has(uid)).map(async uid=>names.set(uid,await teacherReadCache.get(teacherReadKey(actor,'staff:'+uid),async()=>{const user=(await db.collection('users').doc(uid).get()).data();return user?.alias||user?.name||'선생님';},force))));
                }
                return sendJson(res,200,{ok:true,...pageRows(status?filtered.filter((r:any)=>lessonStatus(r.stage)===status):filtered,pageNumber(params.get('page')),10),statusCounts:lessonStatusCounts(filtered),teachers:[...names].map(([uid,name])=>({uid,name})),range:slice.days?{from:slice.days.at(-1),to:slice.days[0]}:null});
            }
            if(action==='schedule-records') {
                const range=scheduleRange({day:params.get('day'),from:params.get('from'),to:params.get('to')});
                const day=params.get('day');if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('INVALID_INPUT');
                const mappingsPromise=readStudentDirectoryMappings(db); // links are never cached (see cachedEnrollmentDocs)
                // 오늘 수업 progress needs every own lesson of that day, not just the first page of saved lessons (read together).
                const [local,remote,reflected,mappings,hiddenTodayLessons,dayLessons]=await Promise.all([
                    readManagedScheduleRange(db,actor,range),
                    Promise.resolve([] as any[]),
                    mappingsPromise.then(m=>readReflectedRange(db,actor,m,range)),mappingsPromise,
                    day?readTodayVisibility(db,actor.uid,day):Promise.resolve([]),day?readDayLessons(db,actor,day):Promise.resolve(undefined),
                ]);
                const records=local.docs.map(d=>({id:d.id,...d.data()}));
                return sendJson(res,200,{ok:true,hiddenTodayLessons,...(dayLessons?{dayLessons}:{}),schedules:mergeNotionRows(records,remote).filter((r:any)=>!r.archived&&(!day||r.data?.date===day)),reflectedSchedules:teacherReflectedSchedules(reflected.map(d=>d.data()),mappings,actor).filter((r:any)=>!day||r.date===day)});
            }
            if(action==='managed-record') {
                const kind=z.enum(['lesson','academic','schedule','class','curriculum']).parse(params.get('kind'));
                const collections={lesson:'teacherLessonDrafts',academic:'teacherAcademicDrafts',schedule:'teacherSchedules',class:'teacherClasses',curriculum:'teacherCurricula'};
                const id=z.string().uuid().parse(params.get('id'));
                const doc=await db.collection(collections[kind]).doc(id).get();
                if(!doc.exists||!canAccessOwned(actor,doc.data()!.ownerUid,doc.data()!.academyId))throw new Error('FORBIDDEN');
                return sendJson(res,200,{ok:true,record:{id:doc.id,...doc.data()}});
            }
            if(action==='drafts-page') return sendJson(res,200,{ok:true,...await readDraftsPage(db,actor,pageNumber(params.get('page')),Number(params.get('size')),force)});
            if(action==='draft-records') {
                const ids=z.array(z.string().uuid()).max(100).parse((params.get('ids')||'').split(',').filter(Boolean));
                const docs=ids.length?await db.getAll(...ids.map(id=>db.collection('teacherLessonDrafts').doc(id))):[];
                const records=docs.filter(d=>d.exists&&canAccessOwned(actor,d.data()!.ownerUid,d.data()!.academyId)).map(d=>({id:d.id,...d.data()}));
                if(force)await confirmLessonRecords(db,records);return sendJson(res,200,{ok:true,records});
            }
            // 수업 일지 › 이날 앱 학습 (the chip next to 학생): one student's app sessions of the lesson day.
            if(action==='lesson-day-study'){failureStage='lesson-day-study';return sendJson(res,200,{ok:true,...await loadLessonDayStudy(db,actor,params.get('studentKey'),params.get('date'))});}
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
                const early=<T,>(p:Promise<T>|null)=>{p?.catch(()=>{});return p;};
                const mappingsPromise=resourcesOnly?Promise.resolve(new Map()):readStudentDirectoryMappings(db);
                // Classes/curricula from the app store, only for the sections that show them (the class switch is read in parallel, not first).
                const managedPromise=early(needs('lesson','schedule','curriculum','settings')?classesActive(db,actor).then(on=>on?import('../_lib/managedAcademy.js').then(m=>m.readManaged(db,actor)):null):null);
                // Mode flags are independent of the batch below; start them now so they add no extra round trip at the end.
                // The lesson tab's saved-lesson list rides along with its bootstrap instead of a second request.
                const draftsEarly=early(section==='lesson'&&params.get('draftsSize')?readDraftsPage(db,actor,1,Number(params.get('draftsSize')),force):null);
                const lessonModeEarly=early(needs('lesson')?lessonAppActive(db,actor):null),scheduleOnlyEarly=early(actor.admin&&actor.academyId==='main'&&needs('schedule')?appSchedulesActive(db,actor):null),academicOnlyEarly=early(actor.admin&&actor.academyId==='main'&&(section==='base'||needs('settings'))?academicAppActive(db):null);
                timing.mark('prepare');
                const [notion, mappings, enrollments, curricula, drafts, classes, schedules, reflected, sourceWorkspace, sourceEnrollments, sourceSchedules] = await Promise.all([
                    resourcesOnly?Promise.resolve([]):workspaceStudents(db,actor,force),mappingsPromise, !resourcesOnly&&needs('lesson','students','schedule','curriculum')?cachedEnrollmentDocs(db,actor,force):Promise.resolve([] as any[]),
                    !needs('schedule','curriculum','settings')?Promise.resolve(empty):actor.admin ? db.collection('teacherCurricula').get() : actor.principal ? db.collection('teacherCurricula').where('academyId','==',actor.academyId).get() : db.collection('teacherCurricula').where('ownerUid', '==', actor.uid).get(),
                    section==='all'?(actor.admin ? db.collection('teacherLessonDrafts').get() : db.collection('teacherLessonDrafts').where('ownerUid', '==', actor.uid).get()):Promise.resolve(empty),
                    !needs('lesson','schedule','curriculum','settings')?Promise.resolve(empty):actor.admin ? db.collection('teacherClasses').get() : actor.principal ? db.collection('teacherClasses').where('academyId','==',actor.academyId).get() : db.collection('teacherClasses').where('ownerUid', '==', actor.uid).get(),
                    !needs('schedule')?Promise.resolve(empty):readManagedScheduleRange(db,actor,range),
                    needs('schedule')?mappingsPromise.then(m=>readReflectedRange(db,actor,m,range)):Promise.resolve([]),// Classes/curricula, enrollments and schedules come from the app; there is no Notion source to merge any more.
                    (managedPromise||Promise.resolve(null)).then(m=>m||{classes:[],curricula:[],issues:[],sources:[]}),fast||!needs('students')?Promise.resolve(new Map()):teacherReadCache.get(teacherReadKey(actor,'enrollments'),()=>readCoreEnrollmentSummaries(db,actor),force),Promise.resolve([] as any[]),
                ]);
                timing.mark('read');
                const localClasses=classes.docs.map(d=>({id:d.id,...d.data()}));const mergedClasses=fast?localClasses:mergeNotionRows(localClasses,sourceWorkspace.classes);
                const localCurricula=curricula.docs.map(d=>({id:d.id,...d.data()}));const mergedCurricula=(fast?localCurricula:mergeNotionRows(localCurricula,sourceWorkspace.curricula)).map((r:any)=>({...r,classId:mergedClasses.find((c:any)=>c.notionPageId===r.classId)?.id||r.classId}));
                const directory=notion??[...mappings.entries()].map(([studentKey,mapping])=>({studentKey,studentDisplayName:mapping.studentDisplayName||'학생',hasGuardianContact:false,enrollmentStatus:''}));
                const students = directory.filter(s => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey)).map(s => {
                    const mapping = mappings.get(s.studentKey);
                    if(!needs('lesson','students','schedule','curriculum'))return {...s,linkedFirebaseUid:mapping?.firebaseUid||null};
                    const cachedSubjects = enrollments.filter((e:any) => !e.removed && e.internalStudentId === mapping?.internalStudentId).flatMap((e:any) => e.subjects || []).filter(subject => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey && scope.subject === subject.subject));
                    const subjects=(sourceEnrollments.get(s.studentKey)||cachedSubjects).filter((entry:any)=>actor.admin||actor.scopes.some((scope:any)=>scope.studentKey===s.studentKey&&scope.subject===entry.subject));
                    return { ...s, linkedFirebaseUid: mapping?.firebaseUid || null, subjects };
                });
                // Student list look: the icon the student picked and a short pet summary from their linked app account.
                if(needs('students')){const uids=[...new Set(students.map((s:any)=>s.linkedFirebaseUid).filter(Boolean))] as string[];
                    const refs=uids.map(uid=>db.collection('users').doc(uid)),docs:any[]=!refs.length?[]:typeof (db as any).getAll==='function'?await (db as any).getAll(...refs).catch(()=>[]):await Promise.all(refs.map(r=>r.get().catch(()=>null)));
                    const looks=new Map(docs.filter(Boolean).map((d:any)=>[d.id,studentLook(d.data())] as const));
                    for(const s of students as any[])if(s.linkedFirebaseUid&&looks.get(s.linkedFirebaseUid))s.look=looks.get(s.linkedFirebaseUid);}
                // 이달 장학 쿠폰 points: the pet summary of a linked student with a pet; anyone else (no app account, no pet yet) from
                // the 이달 포인트 snapshot, which counts their 수업 일지 the same way (read as it is; made when missing, last month's or saved before it kept the keys)
                if(needs('students')){const {monthRankingSnapshot,listSnapshotFresh}=await import('../_lib/petMonthRanking.js');const {normalizeNotionPageId}=await import('../_lib/notionPageId.js');const plain=await db.collection('petRankings').doc('month').get().then((d:any)=>d.data()).catch(()=>null),now=Date.now();const snap=listSnapshotFresh(plain,now)?plain:await monthRankingSnapshot(db,now).catch(()=>null);const norm=(k:string)=>{try{return normalizeNotionPageId(k);}catch{return k;}},byKey=new Map<string,number>((snap?.rows||[]).filter((r:any)=>r.key).map((r:any)=>[norm(r.key),Number(r.earned)||0]));for(const s of students as any[]){const own=s.look?.pet?.coupon,key=norm(s.studentKey);const p=byKey.has(key)?byKey.get(key):typeof own==='number'?own:undefined;if(typeof p==='number')s.couponPoints=p;}}
                // A student's account UID is for the admin and principal only; teachers just see whether one is linked.
                for(const s of students as any[]){s.accountLinked=Boolean(s.linkedFirebaseUid);if(!actor.admin&&!actor.principal)s.linkedFirebaseUid=null;}
                // 담당 시작일 of the signed-in teacher's own students (학생 관리 summary).
                if(needs('students')&&(actor.scopes||[]).length){const {myAssignmentStarts}=await import('../_lib/assignmentStarts.js');const own=(students as any[]).map(s=>({...s,subjects:(s.subjects||[]).filter((x:any)=>actor.scopes.some((sc:any)=>sc.studentKey===s.studentKey&&sc.subject===x.subject))}));const mine=await myAssignmentStarts(db,actor.uid,own).catch(()=>new Map());for(const s of students as any[])if(mine.get(s.studentKey))s.mySince=mine.get(s.studentKey);}
                const records = drafts.docs.map(d => ({ id: d.id, ...d.data() }));
                // App-only records are published in the same transaction; nothing waits on a Notion reflection.
                const scheduleRecords = schedules.docs.map(d => ({ id: d.id, ...d.data() }));
                const access = !needs('settings')?[]:actor.admin ? (await db.collection('teacherWorkspaceAccess').get()).docs.map(d=>({uid:d.id,...d.data()})) : actor.principal ? (await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).get()).docs.filter(d=>!d.data().disabled).map(d=>({uid:d.id,...d.data()})) : [];
                const staffAccess=!resourcesOnly&&actor.principal&&!needs('settings')&&needs('schedule','curriculum')?(await db.collection('teacherWorkspaceAccess').where('academyId','==',actor.academyId).select('disabled').get()).docs.filter(d=>!d.data().disabled).map(d=>({uid:d.id})):access;
                const staff = resourcesOnly||!needs('settings','schedule','curriculum')?[]:actor.admin ? (await db.collection('users').where('role','in',['teacher','principal']).get()).docs.map(d=>({uid:d.id,name:d.data().alias||d.data().name||'선생님'})) : await Promise.all(staffAccess.map(async (a:any)=>{const u=(await db.collection('users').doc(a.uid).get()).data();return {uid:a.uid,name:u?.alias||u?.name||'선생님'};}));
                if(actor.admin)for(const a of access as any[])if(a.offline&&!a.linkedUid&&!staff.some((s:any)=>s.uid===a.uid))staff.push({uid:a.uid,name:a.workspaceLabel||'선생님'}); // added without an app account
                if(actor.admin&&needs('settings')&&process.env.ADMIN_UID&&!staff.some((s:any)=>s.uid===process.env.ADMIN_UID)){const adminUser=(await db.collection('users').doc(process.env.ADMIN_UID).get()).data();staff.push({uid:process.env.ADMIN_UID,name:adminUser?.alias||adminUser?.name||'관리자 선생님'});}
                const result:any = { ok: true, admin: actor.admin, principal: actor.principal, academyId: actor.academyId, teachingScopes: actor.teachingScopes, uid: actor.uid, scopes: actor.scopes, students, curricula: mergedCurricula.filter((r:any)=>!r.archived), drafts: records.filter((r:any)=>!r.archived), schedules: (fast?scheduleRecords:mergeNotionRows(scheduleRecords,sourceSchedules)).filter((r:any)=>!r.archived), reflectedSchedules: teacherReflectedSchedules(reflected.map(d => d.data()), mappings, actor), classes: mergedClasses.filter((r:any)=>!r.archived), notionIssues:sourceWorkspace.issues, notionSources:sourceWorkspace.sources, staff, access };
                result.coreMode=Boolean(actor.coreMode);
                if(needs('lesson'))result.lessonAppMode=await lessonModeEarly;
                if(draftsEarly)result.draftsPage=await draftsEarly;
                // Admin-only migration panels hide once their area is app-only.
                if(actor.admin&&actor.academyId==='main'&&needs('schedule'))result.scheduleAppOnly=await scheduleOnlyEarly;
                if(actor.admin&&actor.academyId==='main'&&(section==='base'||needs('settings')))result.academicAppOnly=await academicOnlyEarly;
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
        if(['save-class','save-curriculum'].includes(body.action)&&await classesActive(db,actor)){const result=await saveManaged(db,actor,body.action==='save-class'?'classes':'curricula',body);invalidateTeacherMutation(body.action);return sendJson(res,200,{ok:true,...result});}
        if(['archive-class','archive-curriculum'].includes(body.action)&&await classesActive(db,actor))return sendJson(res,200,{ok:true,...await archiveManaged(db,actor,body.action==='archive-class'?'classes':'curricula',body.id,z.number().int().nonnegative().parse(body.revision))});
        if(body.action==='directory-restore-student'){
            const {action,...input}=body;const result=await restoreCoreProfile(db,actor,input,v=>studentProfileSchema.parse(v),profileFromPage,profileProperties);invalidateTeacherMutation('save-student-profile');return sendJson(res,200,{ok:true,...result});
        }
        if(typeof body.action==='string'&&body.action.startsWith('template-')){
            failureStage='message-template';return sendJson(res,200,{ok:true,...await (await import('../_lib/messageTemplateActions.js')).templateAction(db,actor,body)});
        }
        if(body.action==='prepare-message'){failureStage='message-prepare';return sendJson(res,200,{ok:true,record:await (await import('../_lib/teacherMessages.js')).prepareTeacherMessage(db,actor,body)});}
        if(body.action==='send-message'){failureStage='message-send';const v=z.object({action:z.literal('send-message'),id:z.string().uuid(),confirmed:z.literal(true)}).strict().parse(body);return sendJson(res,200,{ok:true,record:await (await import('../_lib/teacherMessages.js')).sendTeacherMessage(db,actor,v.id,v.confirmed)});}
        // Body dispatch also works when a deployment rewrite drops URL parameters.
        if(body.action!=='report-review'&&body.action!=='previous-lesson'){mutation=body.action;invalidateTeacherMutation(body.action);}
        if(body.action==='convert-registration-resident'){const v=z.object({action:z.literal('convert-registration-resident'),id:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().positive()}).strict().parse(body);return sendJson(res,200,{ok:true,...await convertRegistrationToResident(db,actor,v.id,v.revision,key=>readStudentEnrollment(db,actor,key))});}
        if (body.action === 'sync-student-registration') {
            failureStage = 'student-registration-sync';
            const value=z.object({action:z.literal('sync-student-registration'),id:z.string().regex(/^[a-f0-9]{64}$/),revision:z.number().int().positive()}).strict().parse(body);
            if(!await coreActive(db,actor))throw new Error('CORE_NOT_READY');
            return sendJson(res,200,{ok:true,...await (await import('../_lib/appStudentRegistration.js')).commitAppStudentRegistration(db,actor,value.id,value.revision)});
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
        if(body.action==='save-student-admission') {
            const v=z.object({action:z.literal('save-student-admission'),studentKey:z.string().uuid(),operationId:z.string().uuid(),expectedEditedAt:z.string().datetime(),data:z.unknown()}).strict().parse(body);
            if(!await coreActive(db,actor))throw Error('CORE_NOT_READY');
            return sendJson(res,200,{ok:true,...await saveCoreAdmission(db,actor,v.studentKey,v.operationId,v.expectedEditedAt,v.data)});
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
            await (await import('../_lib/teacherRegistrationAssignments.js')).resolveRegistrationAssignments(db,actor,studentRegistrationSchema.parse(value.data));
            const saved = await saveStudentRegistration(db,actor,value.data,value.requestId,value.revision,value.writeId,await coreActive(db,actor)?'firestore':undefined);
            return sendJson(res,200,{ok:true,...saved});
        }
        if (body.action === 'report-review') {
            failureStage = 'report-review';
            const studentKey = z.string().uuid().parse(body.studentKey);
            const audience = z.enum(['parent', 'student']).parse(body.audience);
            return sendJson(res, 200, { ok: true, ...await reportReview(db,actor,studentKey,audience,body) });
        }
        if(body.action==='retry-teacher-assignment'&&await coreActive(db,actor)){
            // After the core cutover assignments live in the app only; clear a stale Notion sync failure without calling Notion.
            const uid=z.string().min(1).parse(body.uid),ref=db.collection('teacherWorkspaceAccess').doc(uid);
            await db.runTransaction(async(t:any)=>{const old=(await t.get(ref)).data();if(!old||old.disabled||!actor.admin&&(!actor.principal||old.academyId!==actor.academyId))throw new Error('FORBIDDEN');if(old.notionAssignmentLeaseUntil>Date.now())throw new Error('PUBLISH_IN_PROGRESS');t.set(ref,{...old,notionAssignmentStage:'not-needed',notionAssignmentError:null,previousNotionAssignment:null,notionAssignmentTouched:false,notionAssignmentLease:null,notionAssignmentLeaseUntil:0,notionAssignmentUpdatedAt:Date.now()});});
            return sendJson(res,200,{ok:true,appOnly:true});
        }
        if(body.action==='save-student-tuition'){failureStage='student-tuition';const {saveStudentTuition}=await import('../_lib/studentTuition.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await saveStudentTuition(db,actor,input)});}
        if(body.action==='save-teacher-shares'||body.action==='save-payroll-adjust'){failureStage='teacher-payroll';const m=await import('../_lib/teacherPayroll.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await (action==='save-teacher-shares'?m.saveTeacherShares(db,actor,input):m.savePayrollAdjust(db,actor,input))});}
        if(body.action==='save-tuition-month'){failureStage='tuition-month';const {saveTuitionMonth}=await import('../_lib/tuitionMonth.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await saveTuitionMonth(db,actor,input)});}
        if(body.action==='remove-app-user'){failureStage='app-user-remove';const {removeAppUser}=await import('../_lib/appUsers.js');const {action,...input}=body;const result=await removeAppUser(db,actor,input,getFirebaseAdmin().auth);teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='create-link-code'){failureStage='student-link-code';const {createLinkCode}=await import('../_lib/studentLinkCodes.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await createLinkCode(db,actor,input)});}
        if(body.action==='removed-user-signin'){failureStage='app-user-remove';const {setRemovedSignIn}=await import('../_lib/appUsers.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await setRemovedSignIn(db,actor,input,getFirebaseAdmin().auth)});}
        // 변형 문제 내주기: who can be chosen, give a set, my given sets, cancel (their own messages, not the workspace list).
        if(typeof body.action==='string'&&body.action.startsWith('qset-')){failureStage='question-assign';const m=await import('../_lib/questionAssignments.js');
            try{const out=body.action==='qset-targets'?await m.questionTargets(db,actor):body.action==='qset-assign'?await m.assignQuestionSet(db,actor,body):body.action==='qset-assignments'?await m.myQuestionAssignments(db,actor):body.action==='qset-cancel'?await m.cancelQuestionAssignment(db,actor,body.id):null;
                if(!out)return sendJson(res,400,{ok:false,error:'INVALID_INPUT'});return sendJson(res,200,{ok:true,...out});}
            catch(error:any){const code=error?.name==='ZodError'?'INVALID_INPUT':String(error?.message||'');if(m.ASSIGN_MESSAGES[code]||code==='INVALID_INPUT')return sendJson(res,code==='FORBIDDEN'?403:400,{ok:false,error:code,message:m.ASSIGN_MESSAGES[code]||'잘못된 요청이에요.'});throw error;}}
        if(body.action==='save-online-evaluation'){failureStage='online-evaluation';const {saveOnlineEvaluation}=await import('../_lib/teacherOnlineLearning.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await saveOnlineEvaluation(db,actor,input)});}
        if(body.action==='workbook-save'){failureStage='workbook';const {saveWorkbookVersion}=await import('../_lib/teacherWorkbook.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await saveWorkbookVersion(db,actor,input)});}
        if(body.action==='save-pet-expedition-settings'){failureStage='pet-expedition';const {saveExpeditionSettings}=await import('../_lib/petSentences.js');return sendJson(res,200,{ok:true,...await saveExpeditionSettings(db,actor,body)});}
        if(body.action==='save-pet-tower-settings'){failureStage='pet-tower';const {saveTowerSettings}=await import('../_lib/petTower.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await saveTowerSettings(db,actor,input)});}
        if(body.action==='study-cert-decide'){failureStage='study-certs';const {decideStudyCert}=await import('../_lib/studyCerts.js'),{CERT_MESSAGES}=await import('../_lib/student/study-cert.js');try{const {action,...input}=body;return sendJson(res,200,{ok:true,...await decideStudyCert(db,actor,input)});}catch(error:any){const known=CERT_MESSAGES[String(error?.message)];if(known)return sendJson(res,known[0],{ok:false,error:error.message,message:known[1]});throw error;}}
        if(body.action==='question-attempt-judge'){failureStage='question-attempts';const {judgeQuestionAttempt}=await import('../_lib/teacherQuestionAttempts.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await judgeQuestionAttempt(db,actor,input)});}
        if(body.action==='ai-pass-set'){failureStage='ai-usage';const {setAiPass}=await import('../_lib/aiModel.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await setAiPass(db,actor,input)});}
        if(body.action==='ai-monthly-reset'){failureStage='ai-usage';const {resetAiMonthly}=await import('../_lib/aiModel.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await resetAiMonthly(db,actor,input)});}
        if(body.action==='coupon-offline'){failureStage='pet-coupon';const {requestCouponOffline}=await import('../_lib/petCoupon.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await requestCouponOffline(db,actor,input)});}
        if(body.action==='rank-nickname'){failureStage='pet-coupon';const {setRankNickname}=await import('../_lib/petMonthRanking.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await setRankNickname(db,actor,input)});}
        if(body.action==='coupon-paid'){failureStage='pet-coupon';const {markCouponPaid}=await import('../_lib/petCoupon.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await markCouponPaid(db,actor,input)});}
        if(body.action==='guild-warn'){failureStage='pet-party';const {warnGuildNickname}=await import('../_lib/teacherPetParty.js');const {action,...input}=body;return sendJson(res,200,{ok:true,...await warnGuildNickname(db,actor,input)});}
        if(body.action==='set-user-name'){failureStage='app-user-name';const {setAppUserName}=await import('../_lib/appUsers.js');const {action,...input}=body;const result=await setAppUserName(db,actor,input);teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='set-user-role'){failureStage='app-user-role';const {setAppUserRole}=await import('../_lib/appUsers.js');const {action,...input}=body;const result=await setAppUserRole(db,actor,input);invalidateTeacherMutation('grant');teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='teacher-access'){failureStage='teacher-access';const {setCoreTeacherAccess}=await import('../_lib/academyCore.js');const {action,...input}=body;const result=await setCoreTeacherAccess(db,actor,input);invalidateTeacherMutation('grant');teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='set-assignment-start'){failureStage='assignment-start';const {setAssignmentStart}=await import('../_lib/assignmentStarts.js');const {action,...input}=body;const result=await setAssignmentStart(db,actor,input);invalidateTeacherMutation('grant');teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='accept-link-suggestion'||body.action==='dismiss-link-suggestion'){failureStage='link-suggestions';const {acceptLinkSuggestion,dismissLinkSuggestion}=await import('../_lib/linkSuggestions.js');const {action,...input}=body;const result=action==='accept-link-suggestion'?await acceptLinkSuggestion(db,actor,input):await dismissLinkSuggestion(db,actor,input);invalidateTeacherMutation('grant');teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='link-offline-teacher'){failureStage='offline-teacher-link';const {linkOfflineTeacher}=await import('../_lib/academyCore.js');const {action,...input}=body;const result=await linkOfflineTeacher(db,actor,input);invalidateTeacherMutation('grant');teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if(body.action==='create-offline-teacher'){failureStage='offline-teacher';const {createOfflineTeacher}=await import('../_lib/offlineTeacher.js');const {action,...input}=body;const result=await createOfflineTeacher(db,actor,input);invalidateTeacherMutation('grant');teacherReadCache.clear();return sendJson(res,200,{ok:true,...result});}
        if (body.action === 'grant') {
            if (!actor.admin && !actor.principal)
                throw new Error('FORBIDDEN');
            const dbId=z.preprocess(v=>typeof v==='string'&&/^[a-f0-9-]{32,36}$/i.test(v)?normalizeNotionPageId(v):v,z.string().uuid());
            const value = z.object({ uid: z.string().min(1), workspaceLabel:z.string().trim().max(100).optional(), notionTeacherPageId: z.preprocess(v=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v)?v.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5'):v,z.string().uuid().nullable().optional()), academyId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), workspaceRole: z.enum(['teacher','principal']).default('teacher'), academyStudents: z.array(z.string().uuid()).max(400).default([]), notionSources:z.array(z.object({subject:z.enum(['영어','수학','국어','과학','한국사']),classDatabaseId:dbId,curriculumDatabaseId:dbId,timetableDatabaseId:dbId,lessonDatabaseId:z.preprocess(v=>v===''?undefined:typeof v==='string'&&/^[a-f0-9-]{32,36}$/i.test(v)?normalizeNotionPageId(v):v,z.string().uuid().optional())})).max(5).optional(), scopes: z.array(z.object({ studentKey: z.string().uuid(), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']) })).max(1000), transferReason: z.enum(['이사·캠퍼스 이동', '시간 변경', '학생·학부모 요청', '학원 사정', '기타']).nullable().optional(), transferNote: z.string().trim().max(200).optional(), offlinePhone: offlinePhone.optional(), offlineMemo: z.string().trim().max(200).optional(), offlineSubjects: offlineSubjects.optional(), teacherSubjects: z.array(z.enum(['영어','수학','국어','과학','한국사'])).max(5).refine(v=>new Set(v).size===v.length).optional() }).parse(body);
            if(value.notionSources&&new Set(value.notionSources.map(s=>s.subject)).size!==value.notionSources.length)throw new Error('NOTION_DUPLICATE_SOURCE');
            if(await coreActive(db,actor))return sendJson(res,200,{ok:true,...await saveCoreGrant(db,actor,value,body.assignmentRevision??0,(await import('../_lib/teacherSettingsPolicy.js')).assertTeacherSettingsAccess)});
            throw new Error('CORE_NOT_READY');
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
            throw new Error(kind==='lesson'?'LESSON_APP_REQUIRED':'CORE_NOT_READY');
        }
        if(body.action==='restore-lesson'){
            failureStage='lesson-restore';
            if(!await lessonAppActive(db,actor))throw Error('LESSON_APP_REQUIRED');
            return sendJson(res,200,{ok:true,...await (await import('../_lib/appLessonRestore.js')).restoreAppLesson(db,actor,{id:body.id,revision:body.revision,confirmed:body.confirmed})});
        }
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
        if(body.action==='cancel-academic-delete'){failureStage='academic-archive-cancel';return sendJson(res,200,{ok:true,...await (await import('../_lib/teacherAcademicArchive.js')).cancelAcademicArchive(db,actor,body.id,body.revision)});}
        // Classes and curricula are saved in the app store above; there is no Notion path any more.
        if(['save-curriculum','save-class'].includes(body.action))throw new Error('CORE_NOT_READY');
        if(body.action==='archive-schedule'&&await appSchedulesActive(db,actor)){failureStage='schedule-archive';return sendJson(res,200,{ok:true,...await archiveAppSchedule(db,actor,body.id,body.revision)});}
        if(['archive-class','archive-curriculum','archive-schedule'].includes(body.action))throw new Error('CORE_NOT_READY');
        if(body.action==='save-schedule'&&await appSchedulesActive(db,actor)){failureStage='schedule-save';return sendJson(res,200,{ok:true,...await saveAppSchedule(db,actor,body)});}
        if(body.action==='save-schedule')throw new Error('CORE_NOT_READY');
        if(body.action==='publish-schedule'&&await appSchedulesActive(db,actor)){failureStage='schedule-reflection';return sendJson(res,200,{ok:true,...await publishAppSchedule(db,actor,body.id,body.revision)});}
        if(body.action==='publish-schedule')throw new Error('CORE_NOT_READY');
        if (body.action === 'save-draft' && await lessonAppActive(db,actor)) {
            // App-only: private draft + history in one transaction; the public report changes only on publish.
            failureStage='lesson-app-save';
            if(body.id)await settleUncertainLessonWrite(db,z.string().uuid().parse(body.id));
            const saved=await (await import('../_lib/appLesson.js')).saveAppLesson(db,actor,{id:body.id,revision:body.revision,data:body.data});
            return sendJson(res,200,{ok:true,id:saved.id,record:saved.record});
        }
        if(body.action==='save-draft')throw new Error('LESSON_APP_REQUIRED');
        if(body.action==='resolve-schedule-conflict')throw Error('SCHEDULE_APP_ACTIVE');
        if(body.action==='resolve-academic-conflict')throw Error('ACADEMIC_APP_ACTIVE');
        if(body.action==='resolve-lesson-conflict')throw Error('LESSON_APP_ACTIVE');
        if(body.action==='today-lesson-visibility'){const {action,...input}=body;return sendJson(res,200,{ok:true,hiddenTodayLessons:await changeTodayVisibility(db,actor.uid,input)});}
        if(body.action==='archive-lesson'&&await lessonAppActive(db,actor)){
            // App-only: removes only the selected public report; the draft and prior public content go to history.
            failureStage='lesson-app-archive';
            const draft=await ensureAppLessonDraft(db,actor,body.id);await settleUncertainLessonWrite(db,draft.id);
            const current=(await db.collection('teacherLessonDrafts').doc(draft.id).get()).data();
            const revision=draft.id===body.id&&body.revision!==undefined&&body.revision!==0?body.revision:current?.revision;
            const result=await (await import('../_lib/appLesson.js')).archiveAppLesson(db,actor,draft.id,revision);
            return sendJson(res,200,{ok:true,archived:true,record:result.record||null});
        }
        if(body.action==='archive-lesson')throw new Error('LESSON_APP_REQUIRED');
        if (body.action === 'publish' && await lessonAppActive(db,actor)) {
            // App-only: visibility to students/parents is the publish transaction itself; no Notion copy.
            failureStage='lesson-app-publish';
            const id=z.string().uuid().parse(body.id);await settleUncertainLessonWrite(db,id);
            const current=(await db.collection('teacherLessonDrafts').doc(id).get()).data();
            if(!current||!canAccessOwned(actor,current.ownerUid,current.academyId))throw new Error('FORBIDDEN');
            assertLessonComplete(current.data);
            const result=await (await import('../_lib/appLesson.js')).publishAppLesson(db,actor,id,body.revision??current.revision);
            // '학생에게 알림 보내기' in the 반영 확인 창: sent now; a failed send never fails the 반영.
            const {isLessonPushKind}=await import('../../src/lib/lessonPush.js');
            const pushed=isLessonPushKind(body.notify)&&!result.alreadyPublished?await (await import('../_lib/pushSend.js')).sendLessonPush(db,current.data,id,body.notify).catch(()=>0):0;
            return sendJson(res,200,{ok:true,stage:result.stage,pageId:result.record?.notionPageId||null,record:result.record,pushed});
        }
        if(body.action==='publish')throw new Error('LESSON_APP_REQUIRED');
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
            const remote=!local||needLesson||needStudy?await previousAppSourceLesson(db,actor,key,subject,date):undefined;
            const previous=local||remote||{};
            // Existing app history is authoritative per counter; fill only missing counters from the app source.
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








