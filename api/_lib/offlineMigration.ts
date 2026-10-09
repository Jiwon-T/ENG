import { randomUUID } from 'node:crypto';
import { dryRunTemplates,importTemplateStep,reconcileTemplateStep } from './messageTemplateStore.js';
import { directoryKinds,dryRunDirectory,importDirectoryStep,reconcileDirectoryStep } from './academyDirectorySource.js';
import { managedPlan,importManagedStep } from './managedAcademy.js';
import { previewAcademicMigration,importAcademicMigrationStep,dryRunAcademicPage } from './academicMigration.js';
import { dryRunLessonPage,startLessonMigration,runLessonMigration,lessonMigrationStatus,transientMigrationError,LESSON_MIGRATION_SINCE } from './lessonMigration.js';
import { templateAppActive } from './messageTemplateAuthority.js';
import { academicAppActive } from './academicAuthority.js';
import { lessonAppActive } from './lessonAuthority.js';
import {auditScheduleReadiness,prepareScheduleRecords} from './scheduleReadiness.js';
import {appSchedulesActive} from './appSchedule.js';
export const offlineKinds=['templates','directory','managed','academic','schedules','lessons'] as const;
export type OfflineKind=typeof offlineKinds[number];
const activeCodes=new Set(['CORE_FROZEN','TEMPLATE_APP_ACTIVE','ACADEMIC_APP_ACTIVE','LESSON_APP_ACTIVE']);
export function safeMigrationCode(e:any){return /^[A-Z][A-Z0-9_]{1,100}$/.test(e?.message||'')?e.message:'MIGRATION_FAILED';}
/** No screen requests, no authority activation, no Notion writes, and no personal data in output. */
export async function runOfflineMigration(db:any,actor:any,options:{apply:boolean,kinds:OfflineKind[],notion:any,stopped?:()=>boolean,emit?:(v:any)=>void,wait?:(ms:number)=>Promise<void>}){
 if(!actor.admin||actor.academyId!=='main')throw Error('FORBIDDEN');
 const stop=options.stopped||(()=>false),emit=options.emit||(()=>{}),wait=options.wait||((ms:number)=>new Promise(r=>setTimeout(r,ms)));
 const results:any[]=[];let steps=0;const lease=randomUUID(),ref=db.collection('offlineMigrationRuns').doc('main');
 // The tool lease lasts 5 minutes; renewing once a minute keeps it without a write on every step.
 let renewedAt=0;
 async function renew(force=false){if(!options.apply||!force&&Date.now()-renewedAt<60000)return;await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data()||{};
  if(old.leaseOwner&&old.leaseOwner!==lease&&old.leaseUntil>Date.now())throw Error('MIGRATION_RUNNING');
  tx.set(ref,{...old,leaseOwner:lease,leaseUntil:Date.now()+300000,by:actor.uid,updatedAt:Date.now(),since:LESSON_MIGRATION_SINCE});});renewedAt=Date.now();}
 async function step(fn:()=>Promise<any>){if(stop())throw Error('MIGRATION_STOPPED');if(++steps>50000)throw Error('MIGRATION_STEP_LIMIT');await renew();for(let attempt=0;;attempt++){try{return await fn();}catch(e){if(stop()||attempt>=3||!transientMigrationError(e))throw e;emit({status:'retrying',attempt:attempt+1,code:safeMigrationCode(e)});await wait([1000,3000,10000][attempt]);await renew();}}}
 async function pages(fn:(cursor?:string)=>Promise<any>,review:(r:any)=>number){let cursor:string|undefined;const seen=new Set<string>();let count=0,holds=0;
  do{const r=await step(()=>fn(cursor));count+=r.items?.length??r.count??Object.values(r.counts||{}).reduce((a:number,b:any)=>a+Number(b),0);holds+=review(r);cursor=r.cursor||undefined;
   if(cursor&&seen.has(cursor))throw Error('MIGRATION_CURSOR_REPEATED');if(cursor)seen.add(cursor);
  }while(cursor);return {count,holds};}
 async function drain(fn:()=>Promise<any>,review:(r:any)=>number){let holds=0;do{const r=await step(fn);holds+=review(r);if(holds)return {holds};if(!r.continue)return {holds};}while(true);}
 await renew(true);
 try{for(const kind of options.kinds){if(stop())break;emit({kind,status:'started',mode:options.apply?'apply':'dry-run'});
  try{let result:any={};
   if(kind==='templates'){
    if(await templateAppActive(db)){results.push({kind,status:'app-active-skipped'});continue;}
    result=options.apply?await drain(()=>importTemplateStep(db,actor,options.notion),r=>r.counts?.conflict||0):await pages(c=>dryRunTemplates(db,actor,c,options.notion),r=>r.counts?.review||0);
    if(options.apply&&!result.holds)result=await drain(()=>reconcileTemplateStep(db,actor,options.notion),r=>r.counts?.unknown||0);
   }else if(kind==='directory'){
    let holds=0;for(const type of directoryKinds){const r=options.apply?await drain(()=>importDirectoryStep(db,actor,type,options.notion),r=>r.counts?.review||0):await pages(c=>dryRunDirectory(db,actor,type,c,options.notion),r=>r.items.filter((i:any)=>i.issue).length);holds+=r.holds;
     if(options.apply&&!r.holds){const check=await drain(()=>reconcileDirectoryStep(db,actor,type,options.notion),r=>r.counts?.review||0);holds+=check.holds;}}
    result={holds};
   }else if(kind==='managed'){
    const plan=await managedPlan(db,actor);if(plan.active){results.push({kind,status:'app-active-skipped'});continue;}
    let holds=0;for(const source of [...plan.sources].sort((a:any,b:any)=>Number(a.kind==='classes')-Number(b.kind==='classes'))){
     try{if(options.apply){if(!source.ready)await drain(()=>importManagedStep(db,actor,{key:source.key,kind:source.kind,final:Boolean(source.final&&source.hasCursor),confirmed:true},options.notion),()=>0);
      await drain(()=>importManagedStep(db,actor,{key:source.key,kind:source.kind,final:true,confirmed:true},options.notion),()=>0);
     }else await pages(c=>importManagedStep(db,actor,{key:source.key,kind:source.kind,dryRun:true,...(c?{cursor:c}:{})},options.notion),()=>0);
     }catch(e){if(safeMigrationCode(e)==='MIGRATION_STOPPED')throw e;holds++;emit({kind,status:'source-held',code:safeMigrationCode(e)});}}
    result={holds};
   }else if(kind==='academic'){
    if(await academicAppActive(db)){results.push({kind,status:'app-active-skipped'});continue;}
    if(!options.apply)result=await pages(c=>dryRunAcademicPage(db,actor,c,options.notion),r=>r.unknownAuthors);
    else{let done=false;while(!done){const p=await step(()=>previewAcademicMigration(db,actor,options.notion));if(p.done)break;if(p.unknownAuthors){result={holds:p.unknownAuthors};break;}
      const r=await step(()=>importAcademicMigrationStep(db,actor,true,p.reviewToken,options.notion));done=r.done;}}
   }else if(kind==='schedules'){
    if(await appSchedulesActive(db,actor)){results.push({kind,status:'app-active-skipped'});continue;}
    if(options.apply)await step(()=>prepareScheduleRecords(db,actor,true));
    const r=await step(()=>auditScheduleReadiness(db,actor,options.notion));result={holds:r.ready?0:1};
   }else{
    if(await lessonAppActive(db,actor)){results.push({kind,status:'app-active-skipped'});continue;}
    if(!options.apply){const first=await step(()=>dryRunLessonPage(db,actor,{},options.notion));let count=0,holds=0;
     for(const databaseId of first.databases){const r=await pages(c=>dryRunLessonPage(db,actor,{databaseId,...(c?{cursor:c}:{})},options.notion),r=>Object.entries(r.counts).filter(([k])=>!['stage','excluded','other-academy'].includes(k)).reduce((a,[,n])=>a+Number(n),0));count+=r.count;holds+=r.holds;}result={count,holds};
    }else{
     // Metadata-only dry-run jobs are never mistaken for a completed import. No automatic activation.
     const started=await step(()=>startLessonMigration(db,actor,{confirmed:true,mode:'full',activate:false}));
     if(started.activateOnReady)throw Error('MIGRATION_ACTIVATION_ALREADY_REQUESTED');
     while(!stop()){const r=await step(()=>runLessonMigration(db,actor,{notion:options.notion,budgetMs:30000}));
      if(r.phase==='done'||['blocked','paused','completed','none'].includes(r.status))break;
      // Any idle answer (another runner holds the job, or it is scheduled later) waits instead of spinning.
      if(r.idle||r.busy||r.status==='waiting'){await wait(Math.min(30000,Math.max(1000,(r.nextRunAt||Date.now()+5000)-Date.now())));}}
     const status=await lessonMigrationStatus(db,actor);result={holds:status.openHolds,stagedOnly:true,status:status.job.status};
    }
   }
   const report={kind,status:result.holds?'review-required':'checked',...result};results.push(report);emit(report);
  }catch(e){const code=safeMigrationCode(e);if(code==='MIGRATION_STOPPED')break;const report={kind,status:activeCodes.has(code)?'app-active-skipped':'blocked',code};results.push(report);emit(report);}
 }
 return {mode:options.apply?'apply':'dry-run',since:LESSON_MIGRATION_SINCE,stopped:stop(),results,steps,activation:false};
 }finally{if(options.apply)await db.runTransaction(async(tx:any)=>{const old=(await tx.get(ref)).data();if(old?.leaseOwner===lease)tx.set(ref,{...old,leaseOwner:null,leaseUntil:0,results,updatedAt:Date.now()});});}
}

