import { createHash } from 'node:crypto';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { readStudentMapping, migrateStudentMapping, lookupStudentIdentity } from './studentIdentity.js';
import type { NotionScheduleWebhookPayload } from './reportSchemas.js';
export const scheduleSourceKey = (id: string) => createHash('sha256').update(uuid(id)).digest('hex');
export function generateScheduleDocId(id: string, student: string) { return createHash('sha256').update(`${uuid(id)}:${student}`).digest('hex').slice(0, 32); }
export function schedulePayloadFromPage(page: any) {
    const p = page.properties || {}, students = p['대상 학생'];
    if (students?.has_more || !Array.isArray(students?.relation))
        throw Error('NOTION_SCHEMA_SETUP_REQUIRED');
    const choice = (v: any) => v?.select?.name || v?.status?.name || '';
    const text = (v: any) => (v?.title || v?.rich_text || []).map((r: any) => r.plain_text ?? r.text?.content ?? '').join('');
    const status = choice(p['일정 상태']);
    if (!['예정', '변경', '완료', '취소'].includes(status))
        throw Error('INVALID_INPUT');
    return { notionScheduleId: uuid(page.id), notionStudentPageIds: page.archived || page.in_trash ? [] : students.relation.map((r: any) => uuid(r.id)), title: text(p['일정명']), startAt: p['날짜 및 시간']?.date?.start, endAt: p['날짜 및 시간']?.date?.end || null, subject: choice(p['과목']) || '영어', scheduleType: choice(p['일정 종류']) || '정규 수업', status: page.archived || page.in_trash ? '취소' : status === '변경' ? '예정' : status, notice: text(p['안내 내용']), sourceUpdatedAt: page.last_edited_time } as NotionScheduleWebhookPayload;
}
export async function projectSchedule(db: any, data: NotionScheduleWebhookPayload, app?: {
    draftId: string;
    revision: number;
    academyId: string;
    guard?: () => Promise<void>;
}) {
    const id = uuid(data.notionScheduleId), stateRef = db.collection('scheduleSyncStates').doc(scheduleSourceKey(id));
    // Legacy deliveries for app-owned records are acknowledgements only, regardless of timestamps.
    const preliminary = (await stateRef.get()).data();
    if (!app && preliminary?.teacherDraftId)
        return { applied: false, reason: 'APP_OWNED' };
    const now = new Date().toISOString(), sourceUpdatedAt = data.sourceUpdatedAt;
    if (sourceUpdatedAt && !Number.isFinite(Date.parse(sourceUpdatedAt)))
        throw Error('INVALID_INPUT');
    if (!data.title || !Number.isFinite(Date.parse(data.startAt)) || data.endAt && (!Number.isFinite(Date.parse(data.endAt)) || Date.parse(data.endAt) < Date.parse(data.startAt)))
        throw Error('INVALID_INPUT');
    const keys = [...new Set((data.notionStudentPageIds ?? data.studentKeys ?? []).map(k => k.trim()))];
    if (keys.length > 100)
        throw Error('INVALID_INPUT');
    const students = await Promise.all(keys.map(async (key) => {
        let mapping = await readStudentMapping(db, key);
        if (!mapping) {
            const student = await lookupStudentIdentity(db, key, false);
            mapping = await migrateStudentMapping(db, student.notionStudentPageId, student.studentDisplayName);
        }
        if (app) {
            const m = (await db.collection('academyStudentMemberships').doc(mapping.studentKey).get()).data();
            if (!m || m.disabled || m.academyId !== app.academyId)
                throw Error('ACADEMY_MEMBERSHIP_CONFLICT');
        }
        return { studentKey: mapping.studentKey, internalStudentId: mapping.internalStudentId };
    }));
    if (new Set(students.map(s => s.internalStudentId)).size !== students.length)
        throw Error('STUDENT_MAPPING_CONFLICT');
    return db.runTransaction(async (tx: any) => {
        const state = (await tx.get(stateRef)).data();
        if (!app && state?.teacherDraftId)
            return { applied: false, reason: 'APP_OWNED' };
        if (app && state?.teacherDraftId && state.teacherDraftId !== app.draftId)
            throw Error('SOURCE_IDENTITY_LOCKED');
        if (app && state?.teacherAppRevision > app.revision)
            return { applied: false, reason: 'OLDER_REVISION' };
        const existing = await tx.get(db.collection('studentSchedules').where('notionScheduleId', 'in', [id, id.replace(/-/g, '')]));
        // Managed ownership can also be present on legacy rows if the state is missing.
        if (!app && existing.docs.some((d: any) => d.data().teacherDraftId))
            return { applied: false, reason: 'APP_OWNED' };
        const dates = [state?.sourceUpdatedAt, ...existing.docs.map((d: any) => d.data().sourceUpdatedAt)].filter(Boolean);
        if (!app && dates.length && (!sourceUpdatedAt || dates.some(d => Date.parse(d) >= Date.parse(sourceUpdatedAt))))
            return { applied: false, reason: 'OLDER_SOURCE' };
        if (app && existing.docs.some((d: any) => d.data().teacherDraftId && d.data().teacherDraftId !== app.draftId))
            throw Error('SOURCE_IDENTITY_LOCKED');
        const draftRef = app ? db.collection('teacherSchedules').doc(app.draftId) : null;
        const draft = app ? (await tx.get(draftRef)).data() : null;
        if(app&&draft?.sourceMode==='firestore')return {applied:false,reason:'APP_OWNED'};
        if (app && (!draft || (draft.archived||draft.deleteRequested)&&data.status!=='취소' || draft.revision !== app.revision))
            throw Error('DRAFT_CONFLICT');
        const memberships = app ? await Promise.all(students.map(s => tx.get(db.collection('academyStudentMemberships').doc(s.studentKey)))) : [];
        if (app && memberships.some((m: any) => !m.data() || m.data().disabled || m.data().academyId !== app.academyId))
            throw Error('ACADEMY_MEMBERSHIP_CONFLICT');
        if (app && draft?.scheduleProjectionDoneRevision === app.revision)
            return { applied: false, reason: 'ALREADY_APPLIED' };
        const current = new Map(students.map(s => [s.internalStudentId, s])), previous = new Map<string, any>();
        for (const doc of existing.docs)
            previous.set(doc.data().internalStudentId, doc);
        const all = new Set([...previous.keys(), ...current.keys()]);
        if (all.size + existing.docs.length > 450)
            throw Error('SCHEDULE_PROJECTION_LIMIT');
        for (const internal of all) {
            const prior = previous.get(internal), old = prior?.data(), student = current.get(internal);
            if (!student) {
                if (old)
                    tx.update(prior.ref, { status: '취소', completedAt: null, sourceUpdatedAt: sourceUpdatedAt || now, serverUpdatedAt: now, ...(app ? { teacherDraftId: app.draftId, teacherAppRevision: app.revision } : {}), notice: old.status === '취소' ? old.notice : old.notice ? `${old.notice} (대상에서 제외됨)` : '(일정 대상에서 제외됨)' });
                continue;
            }
            const docId = old?.scheduleDocId || generateScheduleDocId(id, internal), target = db.collection('studentSchedules').doc(prior?.id || docId);
            tx.set(target, { scheduleDocId: docId, notionScheduleId: id, internalStudentId: internal, studentKey: student.studentKey, title: data.title, startAt: data.startAt, endAt: data.endAt || null, subject: data.subject || '영어', scheduleType: data.scheduleType || '정규 수업', status: data.status, notice: data.notice || null, completedAt: data.status === '완료' ? (old?.status === '완료' ? (old.completedAt || old.serverUpdatedAt || now) : now) : null, sourceUpdatedAt: sourceUpdatedAt || now, serverReceivedAt: old?.serverReceivedAt || now, serverUpdatedAt: now, ...(app ? { teacherDraftId: app.draftId, teacherAppRevision: app.revision } : {}) }, { merge: true });
        }
        // Collapse accidental compact/dashed duplicate copies without changing the retained public ID.
        for (const doc of existing.docs)
            if (previous.get(doc.data().internalStudentId)?.id !== doc.id)
                tx.delete(doc.ref);
        tx.set(stateRef, { notionScheduleId: id, sourceUpdatedAt: sourceUpdatedAt || now, ...(app ? { teacherDraftId: app.draftId, teacherAppRevision: app.revision } : {}), updatedAt: now }, { merge: true });
        if (app)
            tx.update(draftRef, { scheduleProjectionDoneRevision: app.revision, updatedAt: Date.now() });
        return { applied: true, syncedStudentsCount: students.length };
    });
}
