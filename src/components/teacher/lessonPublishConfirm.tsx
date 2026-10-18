import {askConfirm} from './ConfirmDialog';

/** 반영 확인 창 with the 학부모·학생 report preview inside. The preview code loads on the first 반영; if it can't load, the
 *  plain question is asked. */
export async function confirmLessonPublish(lesson:any,studentName:string):Promise<boolean>{
 const preview=await import('./LessonParentPreview').then(({LessonReportPreview})=><LessonReportPreview lesson={lesson}/>).catch(()=>null);
 return askConfirm({title:'리포트에 반영할까요?',message:'현재 입력 내용을 저장하고 학생·학부모 리포트에 반영해요.',details:[[studentName,lesson.subject,lesson.date].filter(Boolean).join(' · ')],confirmText:'반영하기',icon:'send',content:preview});
}
