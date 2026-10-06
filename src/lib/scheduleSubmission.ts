/** Keep a single immutable submission alive independently of the editor's modal. */
export async function submitSchedule({id,revision,data,record,request,onSaved}:{id:string;revision?:number;data:any;record?:any;request:(action:string,body:any)=>Promise<any>;onSaved:(result:any)=>void}) {
 const snapshot=structuredClone(data);
 let publishId=id;
 if(!record?.revision||JSON.stringify(snapshot)!==JSON.stringify(record.data)){
  const saved=await request('save-schedule',{id,revision,data:snapshot});
  publishId=saved.id;onSaved(saved);
 }
 return request('publish-schedule',{id:publishId});
}
