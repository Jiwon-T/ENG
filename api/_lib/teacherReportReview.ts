import {pageRows} from './teacherReadCache.js';
import type { Firestore } from 'firebase-admin/firestore';
import { readStudentMapping } from './studentIdentity.js';
import { loadAcademicData } from './academic.js';
import { studentLessonDTO, parentLessonDTO, reportScheduleDTO, lessonReportId } from './reportAudienceDTO.js';
import type { StoredLessonReport, StoredStudentSchedule } from './reportSchemas.js';
export function reviewSubjects(actor: {
    admin: boolean;
    scopes: {
        studentKey: string;
        subject: string;
    }[];
}, studentKey: string) {
    if (actor.admin)
        return null;
    const allowed = new Set(actor.scopes.filter(s => s.studentKey === studentKey).map(s => s.subject));
    if (!allowed.size)
        throw new Error('FORBIDDEN');
    return allowed;
}
export async function loadTeacherReportReview(db: Firestore, actor: any, studentKey: string, audience: 'parent' | 'student', deps = { readStudentMapping, loadAcademicData }, options?:{section:'schedule'|'lessons'|'grades';page:number;subject:string;snapshot?:boolean}) {
    const allowed = reviewSubjects(actor, studentKey);
    const section=options?.section;
    const mapping = await deps.readStudentMapping(db, studentKey);
    if (!mapping?.internalStudentId)
        return { reports: [], schedules: [], academic: { records: [], subjects: [], academyScores: [] }, studentLinked: false, parentUrl: null, linked: false };
    const internalStudentId = mapping.internalStudentId;
    // Paged 수업 기록: only the fields needed to filter, sort and count are read for every report; full reports are read for the page shown.
    const indexOnly = section === 'lessons';
    const [lessons, schedules, academic, completion, slugs] = await Promise.all([
        !section||section==='lessons'?(indexOnly?db.collection('lessonReports').where('internalStudentId', '==', internalStudentId).select('subject','lessonDateStart'):db.collection('lessonReports').where('internalStudentId', '==', internalStudentId)).get():Promise.resolve({docs:[]}),
        !section||section==='schedule'?db.collection('studentSchedules').where('internalStudentId', '==', internalStudentId).get():Promise.resolve({docs:[]}),
        !section||section==='grades'?deps.loadAcademicData(db, internalStudentId):Promise.resolve({records:[],subjects:[],academyScores:[]}),
        // Completions for the paged view are read per page (lessonReportPage); the full view keeps reading them all.
        mapping.firebaseUid&&!section&&audience==='student' ? db.collection('users').doc(mapping.firebaseUid).collection('assignmentCompletions').get() : Promise.resolve(null),
        // One equality query uses Firestore's automatic index. Filtering active
        // aliases here avoids requiring a separately deployed composite index.
        actor.admin ? db.collection('reportSlugs').where('internalStudentId', '==', internalStudentId).get() : Promise.resolve(null),
    ]);
    const visible = (r: {
        subject?: string;
    }) => !allowed || allowed.has(r.subject || '영어');
    const completionHashes = new Map<string, string>((completion?.docs || []).map(d => [d.id, d.data().contentHash]));
    const raw = indexOnly ? [] : lessons.docs.map(d => ({ ...d.data(), notionPageId:d.data().notionPageId || d.id }) as StoredLessonReport).filter(visible).sort((a, b) => Date.parse(b.lessonDateStart) - Date.parse(a.lessonDateStart));
    // Same visibility filter and the same newest-first order as the full read, so totals, pages and subjects do not change.
    const lessonIndex: LessonIndexRow[] = indexOnly ? lessons.docs.map(d => ({ id: d.id, subject: d.data().subject, lessonDateStart: d.data().lessonDateStart })).filter(visible).sort((a, b) => Date.parse(b.lessonDateStart) - Date.parse(a.lessonDateStart)) : [];
    const activeSlug = slugs?.docs.find(d => d.data().active === true)?.data().reportSlug;
    const parentUrl = actor.admin && activeSlug ? `/${encodeURIComponent(activeSlug)}` : null;
    const result={ subjectOptions:[...new Set([...raw,...lessonIndex,...schedules.docs.map(d=>d.data()).filter(visible),...academic.subjects.filter(visible)].map(r=>r.subject||'영어'))],linked: true, studentLinked: Boolean(mapping.firebaseUid), parentUrl,
        reports: raw.map(r => audience === 'parent' ? parentLessonDTO(r) : studentLessonDTO(r, completionHashes)),
        schedules: schedules.docs.map(d => ({ ...d.data(), scheduleDocId:d.data().scheduleDocId || d.id }) as StoredStudentSchedule).filter(visible).map(reportScheduleDTO),
        academic: { records: academic.records.filter(visible), subjects: academic.subjects.filter(visible), academyScores: academic.academyScores.filter(visible) },
    };
    if(indexOnly){
        // Kept for paging only; stripped before the response (see lessonReportPage / publicReport).
        Object.defineProperty(result as any,'lessonIndex',{value:lessonIndex,enumerable:false});
        Object.defineProperty(result as any,'completionUid',{value:audience==='student'?mapping.firebaseUid||null:null,enumerable:false});
        // Who and which subjects the index was built for: each page re-checks the freshly read reports against it.
        Object.defineProperty(result as any,'lessonScope',{value:{internalStudentId,subjects:allowed?[...allowed]:null},enumerable:false});
    }
    if(options&&!options.snapshot){
        if(indexOnly)return {...result,...await lessonReportPage(db,result,audience,options.subject,options.page)};
        const rows=result.reports.filter((r:any)=>!options.subject||r.subject===options.subject);
        const paged=pageRows(rows,options.page,5);
        return {...result,reports:paged.records,reportTotal:paged.total,reportPage:paged.page,reportPages:paged.pages};
    }
    return result;
}

export type LessonIndexRow = { id: string; subject?: string; lessonDateStart: string };
const PAGE_SIZE = 5;
/** One page of 수업 기록 from an index snapshot: the same subject filter and 5-per-page split as before, then only those
 *  reports (and, for the student view, only their assignment completions) are read in full. */
export async function lessonReportPage(db: any, snapshot: any, audience: 'parent' | 'student', subject: string, page: number) {
    const index: LessonIndexRow[] = snapshot.lessonIndex || [];
    const rows = index.filter(r => !subject || (r.subject || '영어') === subject);
    const paged = pageRows(rows, page, PAGE_SIZE);
    const getAll = async (refs: any[]) => !refs.length ? [] : typeof db.getAll === 'function' ? db.getAll(...refs) : Promise.all(refs.map(r => r.get()));
    const docs = await getAll(paged.records.map(r => db.collection('lessonReports').doc(r.id)));
    // A report deleted between the index and this read is skipped rather than shown empty. A report that now belongs to
    // another student or a subject outside the actor's (or the chosen) subjects is skipped too: the index can be older than the report.
    const scope = snapshot.lessonScope;
    const belongs = (r: any) => Boolean(scope?.internalStudentId) && r.internalStudentId === scope.internalStudentId
        && (!scope.subjects || scope.subjects.includes(r.subject || '영어')) && (!subject || (r.subject || '영어') === subject);
    const reports = docs.filter((d: any) => d.exists && belongs(d.data())).map((d: any) => ({ ...d.data(), notionPageId: d.data().notionPageId || d.id }) as StoredLessonReport);
    let completions = new Map<string, string>();
    if (audience === 'student' && snapshot.completionUid && reports.length) {
        const ids = reports.map(r => lessonReportId(r));
        const done = await getAll(ids.map(id => db.collection('users').doc(snapshot.completionUid).collection('assignmentCompletions').doc(id)));
        completions = new Map(done.filter((d: any) => d.exists).map((d: any) => [d.id, d.data().contentHash]));
    }
    return { reports: reports.map(r => audience === 'parent' ? parentLessonDTO(r) : studentLessonDTO(r, completions)), reportTotal: paged.total, reportPage: paged.page, reportPages: paged.pages };
}
