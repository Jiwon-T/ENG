import {useEffect,useRef,useState} from 'react';
import {teacherCachedRead,teacherCacheRead,teacherReadGeneration} from './teacherReadCache';
import {loadTeacherSection} from './loadTeacherSection';
export function useTeacherPage(uid:string,action:string,filters:Record<string,string|number>,request:(action?:string,body?:any)=>Promise<any>) {
    const key=action+':'+JSON.stringify(filters);
    const [result,setResult]=useState<any>(()=>teacherCachedRead(uid,key)||{records:[],total:0,page:1,pages:1,teachers:[],periods:[]});
    const [loading,setLoading]=useState(true),[error,setError]=useState('');
    const latest=useRef({request,filters,key,uid});latest.current={request,filters,key,uid};
    const version=useRef(0);
    async function load(force=false){
        const current=latest.current,sequence=++version.current;setLoading(true);setError('');
        const cached=teacherCachedRead(current.uid,current.key),generation=teacherReadGeneration();
        // Never display a previous filter's rows while a different page loads.
        setResult((old:any)=>cached||{records:[],total:0,page:Number(current.filters.page)||1,pages:1,teachers:old.teachers||[],periods:old.periods||[]});
        try{
            let records:any[]=[];
            await loadTeacherSection<any>({
                fast:!cached&&!force?()=>current.request('read:'+action+'-fast',current.filters):undefined,
                fresh:()=>current.request('read:'+action,{...current.filters,force:force?'1':undefined}),
                apply:(value,fresh)=>{if(sequence!==version.current)return;setResult(value);if(fresh){records=value.records;teacherCacheRead(current.uid,current.key,value,generation);}},
            });
            return records;
        }catch(e){if(sequence===version.current)setError(e instanceof Error?e.message:'자료를 불러오지 못했습니다.');throw e;}
        finally{if(sequence===version.current)setLoading(false);}
    }
    useEffect(()=>{const cached=teacherCachedRead(uid,key);setResult((old:any)=>cached||{records:[],total:0,page:Number(filters.page)||1,pages:1,teachers:old.teachers||[],periods:old.periods||[]});setLoading(true);const timer=setTimeout(()=>{void load().catch(()=>{});},filters.search?250:0);return()=>{clearTimeout(timer);version.current++;};},[uid,key,action]);
    return {result,loading,error,load};
}
