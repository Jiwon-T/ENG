// Serialized transactions with atomic staged writes and read-before-write checks.
export function registrationFirestore() {
    const rows=new Map<string,any>();let queue=Promise.resolve();let failure=false;
    const document=(path:string):any=>({id:path.slice(path.lastIndexOf('/')+1),path,get:async()=>snapshot(path),set:async(value:any)=>rows.set(path,structuredClone(value)),update:async(patch:any)=>rows.set(path,{...rows.get(path),...structuredClone(patch)})});
    const snapshot=(path:string):any=>({id:path.slice(path.lastIndexOf('/')+1),ref:document(path),exists:rows.has(path),data:()=>rows.has(path)?structuredClone(rows.get(path)):undefined});
    // Ordering for the fake queries: fields in order (the id as '__name__'), ties broken by the path.
    const val=(path:string,f:string)=>f==='__name__'?path.slice(path.lastIndexOf('/')+1):(rows.get(path)?.[f]??0);
    const one=(a:any,b:any,dir:string)=>{const d=a<b?-1:a>b?1:0;return dir==='desc'?-d:d;};
    const cmp=(x:string,y:string,order:[string,string][])=>{for(const [f,dir] of order){const d=one(val(x,f),val(y,f),dir);if(d)return d;}return order.length?one(x,y,order[order.length-1][1]):0;};
    const cmpValues=(path:string,values:any[],order:[string,string][])=>{for(let i=0;i<order.length&&i<values.length;i++){const d=one(val(path,order[i][0]),values[i],order[i][1]);if(d)return d;}return 0;};
    const collection=(name:string):any=>{
        const list=(filters:any[],order:[string,string][]=[],max?:number,after?:any):any=>({where:(...filter:any[])=>list([...filters,filter],order,max,after),orderBy:(field:any,dir='asc')=>list(filters,[...order,[typeof field==='string'?field:'__name__',dir]],max,after),limit:(n:number)=>list(filters,order,n,after),startAfter:(...values:any[])=>list(filters,order,max,values[0]?.ref?{path:values[0].ref.path}:{values}),get:async()=>({docs:[...rows.keys()].filter(path=>path.startsWith(name+'/') && !path.slice(name.length+1).includes('/') && filters.every(([key,operator,value])=>{const field=String(key).split('.').reduce((o:any,p:string)=>o?.[p],rows.get(path));return operator==='==' ? field===value : operator==='in' ? value.includes(field) : operator==='<' ? field<value : operator==='array-contains' ? Array.isArray(field)&&field.includes(value) : false;})).sort((x,y)=>cmp(x,y,order)).filter((path,i,all)=>!after?true:after.path?i>all.indexOf(after.path):cmpValues(path,after.values,order)>0).slice(0,max??Infinity).map(snapshot)})});
        return {...list([]),doc:(id:string)=>document(name+'/'+id)};
    };
    const db={collection,runTransaction:(fn:any)=>{
        const result=queue.then(async()=>{
            const writes=new Map<string,any>();
            const value=await fn({get:async(ref:any)=>{if(writes.size)throw Error('READ_AFTER_WRITE');return ref.get();},set:(ref:any,data:any,options?:any)=>writes.set(ref.path,structuredClone(options?.merge?{...rows.get(ref.path),...data}:data)),delete:(ref:any)=>writes.set(ref.path,null),update:(ref:any,patch:any)=>writes.set(ref.path,{...(writes.get(ref.path) || rows.get(ref.path)),...structuredClone(patch)})});
            if(failure){failure=false;throw Error('FIRESTORE_UNAVAILABLE');}
            for(const [key,data] of writes)data===null?rows.delete(key):rows.set(key,data);
            return value;
        });queue=result.then(()=>undefined,()=>undefined);return result;
    }};
    return {db,rows,failNextCommit:()=>{failure=true;}};
}
