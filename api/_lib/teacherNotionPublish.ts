import { recordNotionCall } from './notionUsage.js';
import { SCHEDULE_DATABASE, assertSchedulePlace } from './teacherSchedulePlaces.js';
import {lessonExamScopeProperties} from './lessonExamScope.js';
import {assertLessonNotionFields} from './teacherLessonDiagnostics.js';
import { notionPropertiesMatch, writeTeacherNotionRecord,updatePublicationRevision } from './teacherNotionWrite.js';
import { projectSchedule, schedulePayloadFromPage } from './scheduleProjection.js';
import { lessonSpecialNoteProperties } from './lessonSpecialNote.js';
import { lessonSource } from './teacherNotionWorkspace.js';
import { teacherTestProperties,teacherTestValues } from './teacherTestProperties.js';
import { extractAssignmentFromFeedback } from './assignmentExtractor.js';
import { lookupStudentByPageId } from './notion.js';
import type { Firestore } from 'firebase-admin/firestore';
import { LESSON_DATABASE } from './academyBackfill.js';
import { assertLessonComplete, lessonFeedback } from './teacherWorkspacePolicy.js';
async function notion(path: string, method = 'GET', body?: any) {
    const token = process.env.NOTION_INTEGRATION_TOKEN;
    if (!token)
        throw new Error('CONFIG_ERROR');
    recordNotionCall(path);
    const response = await fetch(`https://api.notion.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok)
        throw new Error(`NOTION_${response.status}`);
    return response.json();
}
const rich = (value: string) => ({ rich_text: value.match(/[\s\S]{1,1900}/g)?.map(content => ({ type: 'text', text: { content } })) || [] });
export async function publishTeacherDraft(db: Firestore, draftId: string, draft: any) {
    const config = (await db.collection('teacherWorkspaceConfig').doc('notion').get()).data();
    const source = await lessonSource(db, draft.ownerUid, draft.data.subject);
    const databaseId = source?.lessonDatabaseId || config?.lessonDatabaseId || LESSON_DATABASE;
    const schema = await notion(`databases/${databaseId}`);
    assertLessonNotionFields(schema,{'앱 기록 ID':{},'과목':{}});
    const d = assertLessonComplete(draft.data);
    const dateProperty = schema.properties['타임 슬롯'] ? '타임 슬롯' : '수업 날짜';
    const titleProperty = schema.properties['배정 시간'] ? '배정 시간' : '수업';
    const student = await lookupStudentByPageId(d.studentKey, '', false);
    const properties: any = {
        '구분': { select: { name: student.studentDisplayName } },
        '출결': { checkbox: d.attendance === '출석' || d.attendance === '보강 출석' },
        [titleProperty]: { title: d.classSession === '없음' ? [] : [{ text: { content: `${d.start} ~ ${d.end}` } }] },
        ...(schema.properties['학원'] ? { '학원': rich(draft.academyId) } : {}),
        ...(schema.properties['작성자 선생님'] && source?.teacherPageId ? { '작성자 선생님': { relation: [{ id: source.teacherPageId }] } } : {}),
        '앱 기록 ID': rich(draftId), '과목': { select: { name: d.subject } },
        '학생': { relation: [{ id: d.studentKey }] },
        [dateProperty]: { date: { start: `${d.date}T${d.classSession === '없음' ? d.selfStudyStart : d.start}:00+09:00`, end: `${d.date}T${d.classSession === '없음' ? d.selfStudyEnd : d.end}:00+09:00` } },
        ...lessonExamScopeProperties(schema,draft.data,d.examScope),
        '수업 내용': rich(lessonFeedback(d)), ...(schema.properties['메모'] ? { '메모': rich(d.nextPlan) } : {}),
        '출석': { select: d.attendance === '미확인' ? null : { name: d.attendance } },
        '태도': { status: { name: d.attitude } }, '숙제': { status: { name: d.homework } }, '테스트': { status: { name: d.test } },
        ...teacherTestProperties(d), '회차': { number: d.round },
        '자습': { checkbox: d.selfStudy === '있음' }, '자습시간': rich(d.selfStudy === '있음' ? `${d.selfStudyStart} ~ ${d.selfStudyEnd}` : ''), [schema.properties['자습회차'] ? '자습회차' : '자습 회차']: { number: d.selfStudyRound },
        '앱 출결 메모': rich(d.attendanceNote || ''), ...lessonSpecialNoteProperties(schema.properties, d.specialNote || ''),
        '범주': { select: { name: '수업' } }, '전송 완료': { select: { name: '완료' } },
    };
    // Validate the existing source layout before writing any record.
    assertLessonNotionFields(schema,properties);
    const page = await writeTeacherNotionRecord(db, 'teacherLessonDrafts', draftId, draft, databaseId, properties, notion);
    return page.id;
}
export async function prepareNotionWorkspace(db: Firestore) {
    const config = (await db.collection('teacherWorkspaceConfig').doc('notion').get()).data();
    const databaseId = config?.lessonDatabaseId || LESSON_DATABASE;
    const schema = await notion(`databases/${databaseId}`);
    await notion(`databases/${databaseId}`, 'PATCH', { properties: {
            ...(!schema.properties?.['특이사항'] ? { '특이사항': { rich_text: {} } } : {}),
            ...(!schema.properties?.['앱 출결 메모'] ? { '앱 출결 메모': { rich_text: {} } } : {}),
            ...(!schema.properties?.['앱 특이사항'] ? { '앱 특이사항': { rich_text: {} } } : {}),
            ...(!schema.properties?.['앱 기록 ID'] ? { '앱 기록 ID': { rich_text: {} } } : {}),
            ...(!schema.properties?.['과목'] ? { '과목': { select: { options: ['영어', '수학', '국어', '과학', '한국사'].map(name => ({ name })) } } } : {}),
        } });
    const schedule = await notion(`databases/${SCHEDULE_DATABASE}`);
    if (!schedule.properties?.['앱 기록 ID'])
        await notion(`databases/${SCHEDULE_DATABASE}`, 'PATCH', { properties: { '앱 기록 ID': { rich_text: {} } } });
    const grades = await notion('databases/fa6ce5a8-9572-4f4d-80d9-4d1485d44e6f');
    if (!grades.properties?.['앱 기록 ID'])
        await notion('databases/fa6ce5a8-9572-4f4d-80d9-4d1485d44e6f', 'PATCH', { properties: { '앱 기록 ID': { rich_text: {} } } });
    return { ready: true };
}
export async function previousNotionLesson(studentKey: string, options?: {
    db: any;
    actor: any;
    subject: string;
    date?: string;
    includeSessionHistory?: boolean;
}):Promise<any> {
    const source = options ? await lessonSource(options.db, options.actor.uid, options.subject) : undefined;
    if (options && options.subject !== '영어' && !source?.lessonDatabaseId)
        return {};
    const filters: any[] = [{ property: '학생', relation: { contains: studentKey } }];
    if (options?.date&&!options.includeSessionHistory)
        filters.push({ property: '수업 날짜', date: { on_or_before: options.date } });
    if (source?.shared)
        filters.push(options?.subject === '영어' ? { or: [{ property: '과목', select: { equals: '영어' } }, { property: '과목', select: { is_empty: true } }] } : { property: '과목', select: { equals: options!.subject } });
    // History reads all pages and sorts actual date fields locally: layouts may use 타임 슬롯 instead.
    const query={filter: filters.length === 1 ? filters[0] : { and: filters },...(!options?.includeSessionHistory?{sorts:[{property:'수업 날짜',direction:'descending'}]}:{}),page_size: options?.includeSessionHistory?100:1};
    const pages = await notion(`databases/${source?.lessonDatabaseId || LESSON_DATABASE}/query`, 'POST',query);
    if(options?.includeSessionHistory){
        const results=[...pages.results];let page=pages;
        const cursors=new Set<string>();
        while(page.has_more&&page.next_cursor){if(cursors.has(page.next_cursor))throw Error('NOTION_PAGINATION_FAILED');cursors.add(page.next_cursor);page=await notion(`databases/${source?.lessonDatabaseId || LESSON_DATABASE}/query`,'POST',{...query,start_cursor:page.next_cursor});results.push(...page.results);}
        pages.results=results.sort((a:any,b:any)=>String((b.properties?.['타임 슬롯']||b.properties?.['수업 날짜'])?.date?.start||'').localeCompare(String((a.properties?.['타임 슬롯']||a.properties?.['수업 날짜'])?.date?.start||'')));
    }
    const legacyPage=options?.includeSessionHistory&&options.date?pages.results.find((page:any)=>((page.properties?.['타임 슬롯']||page.properties?.['수업 날짜'])?.date?.start||'').slice(0,10)<=options.date!):pages.results[0];
    const properties = legacyPage?.properties;
    const text = (p: any) => (p?.rich_text || p?.title || []).map((t: any) => t.plain_text || t.text?.content || '').join('');
    const feedback = properties ? text(properties['수업 내용']) : '';
    const markers = [...feedback.matchAll(/(?:^|\n)[ \t]*과제[ \t]*[:：][ \t]*/g)];
    const last = markers.at(-1);
    const sessionRecords=options?.includeSessionHistory?pages.results.map((page:any)=>{
        const p=page.properties||{},range=text(p['배정 시간']||p['수업']).match(/(\d{1,2}:\d{2})\s*[~–-]\s*(\d{1,2}:\d{2})/),study=text(p['자습시간']).match(/(\d{1,2}:\d{2})\s*[~–-]\s*(\d{1,2}:\d{2})/);
        const slot=(p['타임 슬롯']||p['수업 날짜'])?.date;
        return {id:page.id,archived:page.archived,updatedAt:Date.parse(page.last_edited_time)||0,data:{studentKey,subject:options.subject,date:slot?.start?.slice(0,10)||'',classSession:range?'있음':'없음',start:range?.[1]?.padStart(5,'0')||'',end:range?.[2]?.padStart(5,'0')||'',round:p['회차']?.number??null,attendance:p['출석']?.select?.name||'미확인',selfStudy:p['자습']?.checkbox||study?'있음':'없음',selfStudyStart:study?.[1]?.padStart(5,'0')||'',selfStudyEnd:study?.[2]?.padStart(5,'0')||'',selfStudyRound:(p['자습회차']||p['자습 회차'])?.number??null}};
    }):undefined;
    const selection=(name:string)=>properties?.[name]?.status?.name||properties?.[name]?.select?.name||'미확인';
    return { round: properties?.['회차']?.number ?? null, selfStudyRound: properties?.['자습회차']?.number ?? properties?.['자습 회차']?.number ?? null, content: last ? feedback.slice(0, last.index).trimEnd() : feedback, nextPlan: properties ? text(properties['메모']) : '', examScope:properties?text(properties['시험범위']):'', assignment: extractAssignmentFromFeedback(feedback) || '',attendance:selection('출석'),attitude:selection('태도'),homework:selection('숙제'),test:selection('테스트'),...teacherTestValues(properties),...(sessionRecords?{sessionRecords}:{}) };
}
export async function publishTeacherSchedule(db: Firestore, id: string, record: any) {
    const profile = (await db.collection('teacherWorkspaceAccess').doc(record.ownerUid).get()).data();
    const teacherId = profile?.notionTeacherPageId || (record.ownerUid === process.env.ADMIN_UID ? '3ec0d0f1-c79a-8108-b714-c1d6fc390ba2' : null);
    if (!teacherId)
        throw new Error('TEACHER_NOTION_LINK_REQUIRED');
    const schema = await notion(`databases/${SCHEDULE_DATABASE}`);
    if (!schema.properties?.['앱 기록 ID'])
        throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
    const d = record.data;
    // Preserve recovery of an immutable write that may already have committed.
    // The write journal verifies the same properties and never blindly replays an uncertain write.
    if (!(record.notionWrite?.revision === record.revision && record.notionWrite?.attempted))
        assertSchedulePlace(schema, d.place);
    const properties = {
        '앱 기록 ID': rich(id), '일정명': { title: [{ text: { content: d.title } }] },
        '과목': { select: { name: d.subject } }, '대상 학생': { relation: d.students.map((id: string) => ({ id })) },
        '담당 선생님': { relation: [{ id: teacherId }] },
        '날짜 및 시간': { date: { start: `${d.date}T${d.start}:00+09:00`, end: `${d.date}T${d.end}:00+09:00` } },
        '일정 종류': { select: { name: d.kind } }, '일정 상태': { select: { name: d.status } },
        '장소': { select: d.place ? { name: d.place } : null }, '안내 내용': rich(d.note),
        '요일': { multi_select: [{ name: ['일', '월', '화', '수', '목', '금', '토'][new Date(`${d.date}T12:00:00+09:00`).getUTCDay()] }] },
        '반영 상태': { select: { name: '반영 대기' } },
    };
    for (const key of Object.keys(properties))
        if (!schema.properties?.[key])
            throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
    const page = await writeTeacherNotionRecord(db, 'teacherSchedules', id, record, SCHEDULE_DATABASE, properties, notion);
    const fresh = await notion(`pages/${page.id}`);
    const { ['반영 상태']: marker, ...expected } = properties;
    if (!notionPropertiesMatch(fresh, expected))
        throw new Error('NOTION_EDIT_CONFLICT');
    await projectSchedule(db, schedulePayloadFromPage(fresh), { draftId: id, revision: record.revision, academyId: record.academyId });
    // Completion marker is informational; reports are already atomically projected.
    await notion(`pages/${page.id}`, 'PATCH', { properties: { '반영 상태': { select: { name: '반영 완료' } } } });
    const confirmed = await notion(`pages/${page.id}`);
    await updatePublicationRevision(db,'teacherSchedules',id,record.revision,{ notionPageId: confirmed.id, notionEditedAt: confirmed.last_edited_time, stage: 'published', lastSubmittedRevision: record.revision, failureCode: null, ...(record.deleteRequested ? { archived: true } : {}), updatedAt: Date.now() });
    return page.id;
}
export async function confirmTeacherReflection(pageId: string, kind: 'lesson' | 'schedule') {
    const page = await notion(`pages/${pageId}`);
    return kind === 'lesson' ? page.properties?.['전송 완료']?.select?.name === '완료' : page.properties?.['반영 상태']?.select?.name === '반영 완료';
}
