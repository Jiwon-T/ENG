// Serialized transactions with atomic staged writes and read-before-write checks.
export function registrationFirestore() {
    const rows=new Map<string,any>();let queue=Promise.resolve();let failure=false;
    const document=(path:string):any=>({id:path.slice(path.lastIndexOf('/')+1),path,get:async()=>snapshot(path),set:async(value:any)=>rows.set(path,structuredClone(value)),update:async(patch:any)=>rows.set(path,{...rows.get(path),...structuredClone(patch)})});
    const snapshot=(path:string):any=>({id:path.slice(path.lastIndexOf('/')+1),ref:document(path),exists:rows.has(path),data:()=>rows.has(path)?structuredClone(rows.get(path)):undefined});
    const collection=(name:string):any=>{
        const list=(filters:any[]):any=>({where:(...filter:any[])=>list([...filters,filter]),get:async()=>({docs:[...rows.keys()].filter(path=>path.startsWith(name+'/') && !path.slice(name.length+1).includes('/') && filters.every(([key,operator,value])=>operator==='==' ? rows.get(path)[key]===value : operator==='in' ? value.includes(rows.get(path)[key]) : false)).map(snapshot)})});
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
