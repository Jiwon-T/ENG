export type WorkspaceActionOptions={keys?:string[];label?:string};
export type WorkspaceAction=(callback:()=>Promise<any>,options?:WorkspaceActionOptions)=>Promise<void>;
export type WorkspaceOperation={id:number;keys:string[];label:string;status:'running'|'done'|'failed';error?:string;note?:string};
/** Locks records, never the entire workspace. Active callbacks remain awaited. */
export function createWorkspaceOperations(changed:(tasks:WorkspaceOperation[])=>void){
 let serial=0,generation=0;const locks=new Map<string,{id:number;promise:Promise<void>}>(),history=new Map<number,WorkspaceOperation>();
 const emit=()=>changed([...history.values()].slice(-20));
 return {
  busy:(key:string)=>locks.has(key),
  alias(primary:string,key:string){const owner=locks.get(primary);if(!owner||locks.has(key)&&locks.get(key)?.id!==owner.id)return;locks.set(key,owner);const task=history.get(owner.id);if(task&&!task.keys.includes(key))task.keys.push(key);},
  reset(){generation++;locks.clear();history.clear();emit();},
  async run(keys:string[],label:string,callback:()=>Promise<any>){
   const unique=[...new Set(keys)],existing=unique.map(key=>locks.get(key)).find(Boolean);if(existing){await existing.promise;return;}
   const id=++serial,version=generation,task:WorkspaceOperation={id,keys:unique,label,status:'running'};history.set(id,task);
   const promise=Promise.resolve().then(()=>version===generation?callback():undefined).then(value=>{if(version===generation){task.status=value?.failed?'failed':'done';if(value?.failed)task.error=`일부 요청 실패 ${value.failed}건`;if(typeof value?.warning==='string')task.note=value.warning;}},error=>{if(version===generation){task.status='failed';task.error=error instanceof Error?error.message:'처리 오류';}}).finally(()=>{if(version!==generation)return;for(const [key,owner]of locks)if(owner.id===id)locks.delete(key);emit();});
   for(const key of unique)locks.set(key,{id,promise});emit();await promise;
   return version===generation?task:undefined;
  },
 };
}
