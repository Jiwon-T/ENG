type PendingReads=WeakMap<object,Map<string,Promise<any>>>;
const registry=Symbol.for('jiwont.workspace.inflightReads.v1');
const host=globalThis as typeof globalThis&{[registry]?:PendingReads};
const reads=host[registry]??(host[registry]=new WeakMap());
/** Share concurrent reads only; completed permissions and account states are not cached. */
export function workspaceInflightRead<T>(db:object,key:string,load:()=>Promise<T>):Promise<T>{
 let pending=reads.get(db);if(!pending){pending=new Map();reads.set(db,pending);}
 const current=pending.get(key);if(current)return current;
 const request=Promise.resolve().then(load);pending.set(key,request);
 const cleanup=()=>{if(pending!.get(key)===request)pending!.delete(key);};request.then(cleanup,cleanup);
 return request;
}
