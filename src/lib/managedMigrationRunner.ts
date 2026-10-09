export type ManagedSource = {key:string;kind:'curricula'|'classes';subject:string;ready:boolean;final?:boolean;hasCursor?:boolean};
export type ManagedProgress = {phase:'import'|'compare';source:ManagedSource;checked:number};
/** Sequential requests reuse server checkpoints; activation is deliberately separate. */
export async function runManagedMigration(request:(action:string,body?:any)=>Promise<any>,stopped:()=>boolean,onProgress:(p:ManagedProgress)=>void){
 let checked=0;
 const plan=await request('managed-migration-plan');
 if(plan.active)return {active:true,stopped:false,checked};
 const sources:ManagedSource[]=[...plan.sources].sort((a,b)=>Number(a.kind==='classes')-Number(b.kind==='classes'));
 if(!sources.length)throw Error('이전할 원본 연결이 없습니다.');
 async function drain(source:ManagedSource,final:boolean){
  const cursors=new Set<string>();
  do{
   if(stopped())return false;
   const r=await request('managed-import-step',{key:source.key,kind:source.kind,final,confirmed:true});
   checked++;onProgress({phase:final?'compare':'import',source,checked});
   if(!r.continue)return true;
   if(!r.cursor||cursors.has(r.cursor))throw Error('이전 진행 위치가 반복되어 멈췄습니다.');
   cursors.add(r.cursor);
  }while(true);
 }
 for(const source of sources){
  if(!source.ready&&!await drain(source,Boolean(source.final&&source.hasCursor)))return {stopped:true,checked};
 }
 // A fresh complete final pass after importing every dependency, without activation.
 for(const source of sources)if(!await drain(source,true))return {stopped:true,checked};
 if(stopped())return {stopped:true,checked};
 const result=await request('managed-migration-plan');
 if(result.sources.some((s:any)=>!s.ready||!s.verifiedAt||s.error))throw Error('최종 대조가 완료되지 않았습니다.');
 return {stopped:false,checked,plan:result};
}
