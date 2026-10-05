// Start both reads together; a late fast response never replaces fresh data.
export async function loadTeacherSection<T>(options:{
    fast?:()=>Promise<T>; fresh:()=>Promise<T>;
    apply:(value:T,fresh:boolean)=>void;
}) {
    let freshApplied=false;
    const fast=options.fast?.().then(value=>{
        if(!freshApplied)options.apply(value,false);
    });
    const fresh=options.fresh().then(value=>{
        freshApplied=true;options.apply(value,true);
    });
    const results=await Promise.allSettled([fast,fresh]);
    if(results[1].status==='rejected')throw results[1].reason;
}
