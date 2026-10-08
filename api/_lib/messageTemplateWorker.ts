import {timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {importTemplateStep,processDueTemplates,reconcileTemplateStep,TEMPLATE_STATE,TEMPLATE_SOURCE} from './messageTemplateStore.js';
import {registrationNotion,type RegistrationNotion} from './teacherStudentRegistrationNotion.js';

export function authorizeTemplateWorker(secret:unknown){
 const expected=process.env.MESSAGE_TEMPLATE_WORKER_SECRET;
 if(process.env.MESSAGE_TEMPLATE_SYNC_ENABLED!=='true'||!expected||expected.length<32)throw Error('TEMPLATE_WORKER_DISABLED');
 if(typeof secret!=='string'||secret.length>256||expected.length>256)throw Error('FORBIDDEN');
 const a=Buffer.from(secret),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw Error('FORBIDDEN');
}
// Separate worker only; never imported by browser, never calls a messaging transport.
export async function runTemplateWorker(db:any,input:unknown,notion:RegistrationNotion=registrationNotion,clock=Date.now){
 const v=z.object({mode:z.enum(['pull','push','reconcile'])}).strict().parse(input);
 const actor={admin:true,academyId:'main',uid:'template-sync-worker'};
 if(v.mode==='reconcile')return {pushes:null,pull:null,reconcile:await reconcileTemplateStep(db,actor,notion,clock)};
 const pushes=v.mode==='push'?await processDueTemplates(db,notion,clock):null;
 const state=v.mode==='push'?(await db.collection(TEMPLATE_STATE).doc(TEMPLATE_SOURCE).get()).data():null;
 // Minute recovery drains only an already-started pull/reconciliation. It never
 // starts a fresh Notion scan; the daily scheduler/manual action does that.
 let pull:any=null;
 if(v.mode==='pull'||['initial','catchup','delta'].includes(state?.phase)){
  for(let step=0;step<5;step++){pull=await importTemplateStep(db,actor,notion,clock);if(!pull.continue)break;}
 }
 let reconcile:any=null;
 if(v.mode==='push'&&state?.reconcileCursor)reconcile=await reconcileTemplateStep(db,actor,notion,clock);
 return {pushes,pull,reconcile};
}
