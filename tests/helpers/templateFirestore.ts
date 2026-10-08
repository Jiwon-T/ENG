// Independent pilot double: ordered/limited queries, atomic serialized transactions,
// and counters for calls/documents (not Firestore Enterprise billed units).
export function templateFirestore(){
 const rows=new Map<string,any>(),metrics={gets:0,queries:0,readDocuments:0,writes:0};let tail=Promise.resolve(),fail=false;
 const snap=(path:string):any=>({id:path.split('/').at(-1),ref:doc(path),exists:rows.has(path),data:()=>rows.has(path)?structuredClone(rows.get(path)):undefined});
 const doc=(path:string):any=>({path,id:path.split('/').at(-1),get:async()=>{metrics.gets++;metrics.readDocuments++;return snap(path);}});
 const query=(name:string,filters:any[]=[],order?:any,cursor?:any,limit=Infinity):any=>({
  doc:(id:string)=>doc(name+'/'+id),where:(...v:any[])=>query(name,[...filters,v],order,cursor,limit),orderBy:(key:string,direction='asc')=>query(name,filters,[key,direction],cursor,limit),startAfter:(v:any)=>query(name,filters,order,v,limit),limit:(v:number)=>query(name,filters,order,cursor,v),
  get:async()=>{metrics.queries++;let keys=[...rows.keys()].filter(k=>k.startsWith(name+'/')&&!k.slice(name.length+1).includes('/')&&filters.every(([field,op,value])=>{const v=rows.get(k)[field];return op==='=='?v===value:op==='in'?value.includes(v):op==='<='?v<=value:false;}));
   if(order){keys.sort((a,b)=>{const av=rows.get(a)[order[0]],bv=rows.get(b)[order[0]],sign=av===bv?0:av<bv?-1:1;return order[1]==='desc'?-sign:sign;});if(cursor!==undefined)keys=keys.filter(k=>order[1]==='desc'?rows.get(k)[order[0]]<cursor:rows.get(k)[order[0]]>cursor);}
   keys=keys.slice(0,limit);metrics.readDocuments+=keys.length;return {docs:keys.map(snap)};
  },
 });
 const db={collection:(name:string)=>query(name),runTransaction:(fn:any)=>{
  const promise=tail.then(async()=>{const writes=new Map<string,any>();const result=await fn({get:async(ref:any)=>{if(writes.size)throw Error('READ_AFTER_WRITE');return ref.get();},set:(ref:any,data:any)=>writes.set(ref.path,structuredClone(data))});
   if(fail){fail=false;throw Error('FIRESTORE_UNAVAILABLE');}for(const [path,data] of writes){rows.set(path,data);metrics.writes++;}return result;
  });tail=promise.then(()=>undefined,()=>undefined);return promise;
 }};
 return {db,rows,metrics,failNextCommit:()=>{fail=true;},resetMetrics:()=>{for(const k of Object.keys(metrics))metrics[k]=0;}};
}
