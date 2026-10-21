import {useState} from 'react';
import {askConfirm} from './ConfirmDialog';
import {lessonPushChoice,type LessonPushKind} from '../../lib/lessonPush';

/** '학생에게 알림 보내기' under the preview: only when the lesson has a 과제 (see lessonPushChoice). */
function PushChoice({hint,on,onChange}:{hint:string;on:boolean;onChange:(on:boolean)=>void}){
 const [checked,setChecked]=useState(on);
 return <label className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" className="mt-1" checked={checked} onChange={e=>{setChecked(e.target.checked);onChange(e.target.checked);}}/>
  <span><b className="font-bold">학생에게 알림 보내기</b><small className="block text-xs text-slate-500">{hint}</small></span></label>;
}
/** 반영 확인 창 with the 학부모·학생 report preview inside. The preview code loads on the first 반영; if it can't load, the
 *  plain question is asked. `record` (the saved draft) tells whether the 과제 changed since the last 반영.
 *  false when cancelled; otherwise the alert to send with the 반영 (none when unchecked or no 과제). */
export async function confirmLessonPublish(lesson:any,studentName:string,record?:any):Promise<false|{notify?:LessonPushKind}>{
 const preview=await import('./LessonParentPreview').then(({LessonReportPreview})=><LessonReportPreview lesson={lesson}/>).catch(()=>null);
 const choice=lessonPushChoice(lesson,record);let send=Boolean(choice?.on);
 const ok=await askConfirm({title:'리포트에 반영할까요?',message:'현재 입력 내용을 저장하고 학생·학부모 리포트에 반영해요.',details:[[studentName,lesson.subject,lesson.date].filter(Boolean).join(' · ')],confirmText:'반영하기',icon:'send',content:preview||choice?<>{preview}{choice&&<PushChoice hint={choice.hint} on={choice.on} onChange={on=>{send=on;}}/>}</>:undefined});
 if(!ok)return false;
 return choice&&send?{notify:choice.kind}:{};
}
