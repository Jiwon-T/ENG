import {canRetryPublication} from './teacherPublicationRecovery';
export const newGridLesson = (studentKey: string, subject: string, date: string, start: string, end: string) => ({ studentKey, subject, date, start, end, attendance: '미확인', attitude: '미확인', homework: '미확인', test: '미확인', content: '', assignment: '', note: '', nextPlan: '', wrong:null as number | null,examWrong:null as number | null,correct: null as number | null, total: null as number | null, examCorrect: null as number | null, examTotal: null as number | null, round: null as number | null, classSession: '있음', selfStudy: '없음', selfStudyStart: '', selfStudyEnd: '', selfStudyRound: null as number | null, attendanceNote: '', specialNote: '',examScope:'' });
export function applyCommonLesson<T extends ReturnType<typeof newGridLesson>>(lesson: T, common: {
    content: string;
    assignment: string;
    nextPlan?: string;
    specialNote?: string;
    examScope?:string;
}) { return { ...lesson, ...common }; }
export function gridScore(correct: number | null, total: number | null) { return correct === null || total === null || total <= 0 || correct < 0 || correct > total ? null : Math.round(correct / total * 10000) / 100; }
/** Reopen an exact saved lesson, never another teacher's or another time slot. */
export function matchingSavedLesson(records:readonly any[],input:any,ownerUid:string,matchEnd=true) {
 return records.filter(r=>r.ownerUid===ownerUid&&!r.archived&&!r.deleteRequested&&r.stage!=='new'&&r.data&&['studentKey','subject','date','start',...(matchEnd?['end']:[]),...(input.classSession==='없음'?['classSession','selfStudyStart']:[])].every(key=>r.data[key]===input[key]))
 .sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)||Number(b.revision||0)-Number(a.revision||0))[0];
}
export function gridCanPublish(row: {
    revision?: number;
    stage?: string;
    data: any;
    savedData?: any;
}) { return Boolean(row.revision) && !['published', 'publishing', 'processing', 'notion_saved'].includes(row.stage || '') && JSON.stringify(row.data) === JSON.stringify(row.savedData); }
export function gridCanSubmit(row: {stage?:string;data:any;savedData?:any;loading?:boolean}) {
 return Boolean(row.data?.content?.trim()) && !row.loading && !['publishing','processing','notion_saved'].includes(row.stage||'') && (row.stage!=='published'||JSON.stringify(row.data)!==JSON.stringify(row.savedData));
}
export function isCurrentStudent(student: {
    subjects?: {
        status: string;
    }[];
    enrollmentStatus?: string;
}) { return student.subjects?.length ? student.subjects.some(s => s.status === '등록') : student.enrollmentStatus === '등록'; }
export async function processLessonRows<R extends {
    id: string;
    revision?: number;
    stage: string;
    data: any;
    savedData?: any;
}>(rows: R[], mode: 'save' | 'publish', request: (action: string, body: any) => Promise<any>, update: (id: string, patch: any) => void) {
    let succeeded = 0, failed = 0;
    for (const row of rows) {
        try {
            if (mode === 'publish' && !row.data?.content?.trim()) throw new Error('수업 내용을 입력해 주세요.');
            if (mode === 'publish' && !gridCanSubmit(row)) throw new Error('반영 중이거나 이미 반영된 기록입니다.');
            const retry=mode==='publish'&&canRetryPublication(row)&&JSON.stringify(row.data)===JSON.stringify(row.savedData);
            if (mode === 'save' || !retry&&!gridCanPublish(row)) {
                const saved = await request('save-draft', { id: row.id, revision: row.revision, data: row.data });
                update(row.id, { revision: saved.record?.revision ?? (row.revision || 0) + 1, stage: 'draft', savedData: structuredClone(saved.record?.data ?? row.data), data:saved.record?.data ?? row.data, error: undefined });
            }
            if (mode === 'publish') {
                const result = await request('publish', { id: row.id });
                update(row.id, { stage: result.stage || 'processing', error: result.warning });
            }
            succeeded++;
        }
        catch (error) {
            failed++;
            update(row.id, { error: error instanceof Error ? error.message : '처리 실패' });
        }
    }
    return { succeeded, failed };
}
const openable=(r:any,ownerUid:string)=>Boolean(r&&r.ownerUid===ownerUid&&!r.archived&&!r.deleteRequested&&r.stage!=='new'&&r.data);
/** The saved lesson a today-list card is matched to, by its id: the loaded copy, otherwise read by id (a lesson outside
 *  the first page). The id always wins over a lesson at the same time. Null when it is gone or not the teacher's. */
export async function resolveSavedLesson(records:readonly any[],ownerUid:string,savedId:string,read:(id:string)=>Promise<any[]>){
 const loaded=records.find(r=>r.id===savedId);
 if(loaded)return openable(loaded,ownerUid)?loaded:null;
 const found=(await read(savedId)).find(r=>r?.id===savedId);
 return openable(found,ownerUid)?found:null;
}
/** What a card or a student choice opens. With the card's lesson id: that lesson only (loaded, or read by id and then
 *  added to the loaded list); 'failed' when the read fails, so the caller stops with a retry instead of starting a new
 *  lesson; 'new' only when that lesson is gone. Without an id: the loaded lesson at the same time, else 'new'. */
export async function openTodayLesson(records:readonly any[],input:any,ownerUid:string,matchEnd:boolean,savedId:string|undefined,read:(id:string)=>Promise<any[]>):Promise<{kind:'saved';record:any;add:boolean}|{kind:'new'}|{kind:'failed'}>{
 if(!savedId){const loaded=matchingSavedLesson(records,input,ownerUid,matchEnd);return loaded?{kind:'saved',record:loaded,add:false}:{kind:'new'};}
 let found:any;try{found=await resolveSavedLesson(records,ownerUid,savedId,read);}catch{return {kind:'failed'};}
 if(!found)return {kind:'new'};
 return {kind:'saved',record:found,add:!records.some(r=>r.id===found.id)};
}
