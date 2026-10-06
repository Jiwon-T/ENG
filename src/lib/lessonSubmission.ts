/** One frozen input snapshot; a later editor selection is owned by the caller. */
export async function submitLesson({mode,id,revision,data,record,request,onSaved}:{mode:'save'|'publish';id:string;revision?:number;data:any;record?:any;request:(action:string,body:any)=>Promise<any>;onSaved:(record:any)=>void}){
 const snapshot=structuredClone(data);let result:any;
 if(mode==='save'||!record||JSON.stringify(record.data)!==JSON.stringify(snapshot)){
  result=await request('save-draft',{id,revision,data:snapshot});id=result.id;onSaved(result);
 }
 if(mode==='publish')result=await request('publish',{id});
 return result;
}
