import { extractAssignmentFromFeedback } from './assignmentExtractor.js';
import { lookupStudentByPageId } from './notion.js';
import type { Firestore } from 'firebase-admin/firestore';
import { LESSON_DATABASE } from './academyBackfill.js';
import { lessonFeedback } from './teacherWorkspacePolicy.js';
async function notion(path: string, method = 'GET', body?: any) {
    const token = process.env.NOTION_INTEGRATION_TOKEN;
    if (!token)
        throw new Error('CONFIG_ERROR');
    const response = await fetch(`https://api.notion.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok)
        throw new Error(`NOTION_${response.status}`);
    return response.json();
}
const rich = (value: string) => ({ rich_text: value.match(/[\s\S]{1,1900}/g)?.map(content => ({ type: 'text', text: { content } })) || [] });
export async function publishTeacherDraft(db: Firestore, draftId: string, draft: any) {
    const config = (await db.collection('teacherWorkspaceConfig').doc('notion').get()).data();
    const databaseId = config?.lessonDatabaseId || LESSON_DATABASE;
    if (!(config?.supportedSubjects || ['영어']).includes(draft.data.subject))
        throw new Error('MAKE_SUBJECT_NOT_CONFIGURED');
    const schema = await notion(`databases/${databaseId}`);
    if (!schema.properties?.['앱 기록 ID'] || !schema.properties?.['과목'])
        throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
    let pageId = draft.notionPageId;
    if (!pageId) {
        const matches = await notion(`databases/${databaseId}/query`, 'POST', { filter: { property: '앱 기록 ID', rich_text: { equals: draftId } }, page_size: 2 });
        if (matches.results.length > 1)
            throw new Error('DUPLICATE_NOTION_RECORD');
        pageId = matches.results[0]?.id;
    }
    const d = draft.data;
    const student = await lookupStudentByPageId(d.studentKey, '', false);
    const properties: any = {
        '구분': { select: { name: student.studentDisplayName } },
        '출결': { checkbox: d.attendance === '출석' || d.attendance === '보강 출석' },
        '수업': { title: [{ text: { content: `${d.start} ~ ${d.end}` } }] },
        '앱 기록 ID': rich(draftId), '과목': { select: { name: d.subject } },
        '학생': { relation: [{ id: d.studentKey }] },
        '수업 날짜': { date: { start: `${d.date}T${d.start}:00+09:00`, end: `${d.date}T${d.end}:00+09:00` } },
        '수업 내용': rich(lessonFeedback(d)), '메모': rich(d.nextPlan),
        '출석': { select: d.attendance === '미확인' ? null : { name: d.attendance } },
        '태도': { status: { name: d.attitude } }, '숙제': { status: { name: d.homework } }, '테스트': { status: { name: d.test } },
        '단어': { number: d.total }, '틀린 단어': { number: d.total === null ? null : d.total - d.correct }, '회차': { number: d.round },
        '범주': { select: { name: '수업' } }, '전송 완료': { select: { name: '미완' } },
    };
    // Validate the existing source layout before writing any record.
    for (const key of Object.keys(properties))
        if (!schema.properties?.[key])
            throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
    const page = pageId ? await notion(`pages/${pageId}`, 'PATCH', { properties }) : await notion('pages', 'POST', { parent: { database_id: databaseId }, properties });
    const ref = db.collection('teacherLessonDrafts').doc(draftId);
    await ref.update({ notionPageId: page.id, stage: 'notion_saved', updatedAt: Date.now() });
    // Use the trusted source's existing on-demand button URL; never accept a client URL.
    const fresh = await notion(`pages/${page.id}`);
    const formula = fresh.properties?.['전송하기']?.formula?.string || '';
    const match = formula.match(/https:\/\/hook\.eu1\.make\.com\/[a-zA-Z0-9]+(?:\?[^\s"<>]*)?/);
    if (!match)
        throw new Error('MAKE_TRIGGER_NOT_CONFIGURED');
    const response = await fetch(match[0], { signal: AbortSignal.timeout(15000) });
    if (!response.ok)
        throw new Error('MAKE_TRIGGER_FAILED');
    await ref.update({ stage: 'processing', lastSubmittedRevision: draft.revision, updatedAt: Date.now() });
    return page.id;
}
export async function prepareNotionWorkspace(db: Firestore) {
    const config = (await db.collection('teacherWorkspaceConfig').doc('notion').get()).data();
    const databaseId = config?.lessonDatabaseId || LESSON_DATABASE;
    const schema = await notion(`databases/${databaseId}`);
    await notion(`databases/${databaseId}`, 'PATCH', { properties: {
            ...(!schema.properties?.['앱 기록 ID'] ? { '앱 기록 ID': { rich_text: {} } } : {}),
            ...(!schema.properties?.['과목'] ? { '과목': { select: { options: ['영어', '수학', '국어', '과학', '한국사'].map(name => ({ name })) } } } : {}),
        } });
    const schedule = await notion(`databases/${SCHEDULE_DATABASE}`);
    if (!schedule.properties?.['앱 기록 ID'])
        await notion(`databases/${SCHEDULE_DATABASE}`, 'PATCH', { properties: { '앱 기록 ID': { rich_text: {} } } });
    return { ready: true };
}
export async function previousNotionLesson(studentKey: string) {
    const pages = await notion(`databases/${LESSON_DATABASE}/query`, 'POST', { filter: { property: '학생', relation: { contains: studentKey } }, sorts: [{ property: '수업 날짜', direction: 'descending' }], page_size: 1 });
    const properties = pages.results[0]?.properties;
    const text = (p: any) => (p?.rich_text || []).map((t: any) => t.plain_text || t.text?.content || '').join('');
    const feedback = properties ? text(properties['수업 내용']) : '';
    const markers = [...feedback.matchAll(/(?:^|\n)[ \t]*과제[ \t]*[:：][ \t]*/g)];
    const last = markers.at(-1);
    return { content: last ? feedback.slice(0, last.index).trimEnd() : feedback, nextPlan: properties ? text(properties['메모']) : '', assignment: extractAssignmentFromFeedback(feedback) || '' };
}
const SCHEDULE_DATABASE = '3430f1a4-9dde-4b4c-a5cf-0d11b913b38c';
export async function publishTeacherSchedule(db: Firestore, id: string, record: any) {
    const profile = (await db.collection('teacherWorkspaceAccess').doc(record.ownerUid).get()).data();
    const teacherId = profile?.notionTeacherPageId || (record.ownerUid === process.env.ADMIN_UID ? '3ec0d0f1-c79a-8108-b714-c1d6fc390ba2' : null);
    if (!teacherId)
        throw new Error('TEACHER_NOTION_LINK_REQUIRED');
    const schema = await notion(`databases/${SCHEDULE_DATABASE}`);
    if (!schema.properties?.['앱 기록 ID'])
        throw new Error('NOTION_SCHEMA_SETUP_REQUIRED');
    let pageId = record.notionPageId;
    if (!pageId) {
        const matches = await notion(`databases/${SCHEDULE_DATABASE}/query`, 'POST', { filter: { property: '앱 기록 ID', rich_text: { equals: id } }, page_size: 2 });
        if (matches.results.length > 1)
            throw new Error('DUPLICATE_NOTION_RECORD');
        pageId = matches.results[0]?.id;
    }
    const d = record.data;
    const properties = {
        '앱 기록 ID': rich(id), '일정명': { title: [{ text: { content: d.title } }] },
        '과목': { select: { name: d.subject } }, '대상 학생': { relation: d.students.map((id: string) => ({ id })) },
        '담당 선생님': { relation: [{ id: teacherId }] },
        '날짜 및 시간': { date: { start: `${d.date}T${d.start}:00+09:00`, end: `${d.date}T${d.end}:00+09:00` } },
        '일정 종류': { select: { name: d.kind } }, '일정 상태': { select: { name: d.status } },
        '장소': { select: { name: d.place } }, '안내 내용': rich(d.note),
        '요일': { multi_select: [{ name: ['일', '월', '화', '수', '목', '금', '토'][new Date(`${d.date}T12:00:00+09:00`).getUTCDay()] }] },
        '반영 상태': { select: { name: '반영 대기' } },
    };
    const page = pageId ? await notion(`pages/${pageId}`, 'PATCH', { properties }) : await notion('pages', 'POST', { parent: { database_id: SCHEDULE_DATABASE }, properties });
    const ref = db.collection('teacherSchedules').doc(id);
    await ref.update({ notionPageId: page.id, stage: 'notion_saved', updatedAt: Date.now() });
    const fresh = await notion(`pages/${page.id}`);
    const url = fresh.properties?.['반영 요청']?.formula?.string?.match(/https:\/\/hook\.eu1\.make\.com\/[a-zA-Z0-9]+(?:\?[^\s"<>]*)?/)?.[0];
    if (!url)
        throw new Error('MAKE_TRIGGER_NOT_CONFIGURED');
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok)
        throw new Error('MAKE_TRIGGER_FAILED');
    await ref.update({ stage: 'processing', lastSubmittedRevision: record.revision, updatedAt: Date.now() });
    return page.id;
}
export async function confirmTeacherReflection(pageId: string, kind: 'lesson' | 'schedule') {
    const page = await notion(`pages/${pageId}`);
    return kind === 'lesson' ? page.properties?.['전송 완료']?.select?.name === '완료' : page.properties?.['반영 상태']?.select?.name === '반영 완료';
}
