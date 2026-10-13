import {useEffect,useState} from 'react';
import {AlertCircle,Check,CircleDot,Clock3,Hourglass,LoaderCircle} from 'lucide-react';
import {lessonSaveState} from '../../lib/lessonPresentation';

const icons={busy:LoaderCircle,failed:AlertCircle,unsaved:CircleDot,published:Check,pending:Hourglass,saved:Clock3};

/** Save state next to the single editor's title: 저장 안 됨 / 방금·N분 전 저장됨 / 반영 완료 …; the time refreshes every 30s. */
export default function LessonSaveStatus({record,dirty,busy,savedAt}:{record?:any;dirty:boolean;busy:boolean;savedAt?:number}){
 const [now,setNow]=useState(()=>Date.now());
 const state=lessonSaveState({record,dirty,busy,savedAt,now});
 useEffect(()=>{setNow(Date.now());if(state?.kind!=='saved')return;const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[state?.kind,savedAt,record?.id,record?.updatedAt]);
 if(!state)return null;
 const Icon=icons[state.kind];
 return <span className={`lesson-save-pill is-${state.kind}`} role="status"><Icon size={12} aria-hidden="true" className={state.kind==='busy'?'lesson-button-spinner':undefined}/>{state.text}</span>;
}
