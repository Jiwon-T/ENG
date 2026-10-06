import {useCallback,useEffect,useRef,useState} from 'react';
export function useWorkspaceNotice(context:string){
 const current=useRef(context);current.current=context;
 const [notice,setNotice]=useState<{id:number;text:string;context:string}|null>(null),sequence=useRef(0);
 useEffect(()=>setNotice(null),[context]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(old=>old?.id===notice.id?null:old),/실패|오류|불명확|확인해|대기/.test(notice.text)?9000:4500);return()=>clearTimeout(timer);},[notice]);
 const dismiss=useCallback(()=>setNotice(null),[]);
 const show=useCallback((text:string)=>{if(current.current!==context)return;setNotice(text?{id:++sequence.current,text,context}:null);},[context]);
 return {message:notice?.context===context?notice.text:'',dismiss,show};
}
