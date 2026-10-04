import { z } from 'zod';
import { subjects } from './teacherWorkspacePolicy.js';
export const academicDraftSchema = z.object({
 studentKey:z.string().uuid(), subject:z.enum(subjects), examType:z.enum(['학교 내신','학력평가']),
 examYear:z.number().int().min(1900).max(2200).nullable().optional(), semester:z.union([z.literal(1),z.literal(2)]).nullable().optional(), examPeriod:z.enum(['중간고사','기말고사']).nullable().optional(),
 title:z.string().trim().min(1).max(200), examDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
 score:z.number().nonnegative().nullable(), maxScore:z.number().positive().nullable(),
 grade:z.string().max(50).default(''), submissionStatus:z.enum(['미제출','제출 완료','제출 대상 아님']), note:z.string().max(5000).default('')
}).superRefine((v,c)=>{
 for(const date of [v.examDate,v.deadline].filter(Boolean) as string[]) if(!Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date) c.addIssue({code:'custom',message:'시험일과 제출 기한을 확인해 주세요.'});
 if(v.score !== null && v.maxScore !== null && v.score>v.maxScore) c.addIssue({code:'custom',message:'점수가 만점을 넘을 수 없습니다.'});
 if(v.submissionStatus !== '제출 완료' && v.score !== null) c.addIssue({code:'custom',message:'미제출 기록의 점수는 비워 주세요.'});
 if(v.submissionStatus === '제출 완료' && (v.score === null || v.maxScore === null)) c.addIssue({code:'custom',message:'제출 완료 점수와 만점을 입력해 주세요.'});
});
export function canViewAcademyRecord(actor:{uid:string;admin:boolean;principal?:boolean;academyId?:string|null}, record:{ownerUid?:string;academyId?:string}) {
 return actor.admin || record.ownerUid === actor.uid || Boolean(actor.principal && actor.academyId && record.academyId === actor.academyId);
}
