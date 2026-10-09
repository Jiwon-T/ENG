export type ManagedSource = {key:string;kind:'curricula'|'classes';subject:string;ready:boolean;final?:boolean;hasCursor?:boolean;verifiedAt?:number;error?:string|null};
export type ManagedProgress = {phase:'import'|'compare';source:ManagedSource;checked:number;preserved:number;retrying?:string};
type Request=(action:string,body?:any)=>Promise<any>;
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
// Temporary failures the server step can safely repeat: the saved position only moves after a successful step.
const TRANSIENT=new Set(['NOTION_CONNECTION_ERROR','NOTION_429','NOTION_502','FIRESTORE_RESOURCE_EXHAUSTED','DIRECTORY_BUSY','MANAGED_IMPORT_FAILED','WORKSPACE_ERROR']);
export function managedRetryable(error:any){return !error?.code||TRANSIENT.has(error.code)||error.code==='MANAGED_PENDING_WRITE'&&error.blocker?.reason==='running';}
/** Sequential requests reuse server checkpoints; activation is deliberately separate. */
export async function runManagedMigration(request:Request,stopped:()=>boolean,onProgress:(p:ManagedProgress)=>void,wait:(ms:number)=>Promise<void>=sleep,delays=[3000,10000,30000]){
 let checked=0,preserved=0;
 const plan=await request('managed-migration-plan');
 if(plan.active)return {active:true,stopped:false,checked,preserved};
 const sources:ManagedSource[]=[...plan.sources].sort((a,b)=>Number(a.kind==='classes')-Number(b.kind==='classes'));
 if(!sources.length)throw Error('이전할 원본 연결이 없습니다.');
 async function step(source:ManagedSource,final:boolean){
  for(let attempt=0;;attempt++){
   try{return await request('managed-import-step',{key:source.key,kind:source.kind,final,confirmed:true});}
   catch(error:any){
    if(attempt>=delays.length||!managedRetryable(error)||stopped())throw error;
    onProgress({phase:final?'compare':'import',source,checked,preserved,retrying:`${error.blocker?.reason==='running'?'Notion 반영이 끝나길 기다리는 중':'잠시 연결이 불안정해 다시 시도하는 중'} (${attempt+1}/${delays.length})`});
    await wait(delays[attempt]);
   }
  }
 }
 async function drain(source:ManagedSource,final:boolean){
  const cursors=new Set<string>();
  do{
   if(stopped())return false;
   const r=await step(source,final);
   checked++;if(r.decision==='app-preserved')preserved++;
   onProgress({phase:final?'compare':'import',source,checked,preserved});
   if(!r.continue)return true;
   if(!r.cursor||cursors.has(r.cursor))throw Error('이전 진행 위치가 반복되어 멈췄습니다.');
   cursors.add(r.cursor);
  }while(true);
 }
 for(const source of sources){
  if(!source.ready&&!await drain(source,Boolean(source.final&&source.hasCursor)))return {stopped:true,checked,preserved};
 }
 // A fresh complete final pass after importing every dependency, without activation.
 for(const source of sources)if(!await drain(source,true))return {stopped:true,checked,preserved};
 if(stopped())return {stopped:true,checked,preserved};
 const result=await request('managed-migration-plan');
 if(result.sources.some((s:any)=>!s.ready||!s.verifiedAt||s.error))throw Error('최종 대조가 완료되지 않았습니다.');
 return {stopped:false,checked,preserved,plan:result};
}
/** One button: a fresh final comparison (the server requires one from the last 15 minutes), then activation. */
export async function confirmManagedMigration(request:Request,stopped:()=>boolean,onProgress:(p:ManagedProgress)=>void,wait?:(ms:number)=>Promise<void>){
 const r=await runManagedMigration(request,stopped,onProgress,wait);
 if(r.active||r.stopped)return r;
 await request('managed-activate',{confirmed:true});
 return {...r,activated:true};
}
