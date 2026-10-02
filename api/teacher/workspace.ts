import { teacherReflectedSchedules } from '../_lib/teacherReflectedSchedules.js';
import { loadTeacherReportReview } from '../_lib/teacherReportReview.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { teacherActor } from '../_lib/teacherWorkspaceAuth.js';
import { canAccessOwned, canTeach, lessonDraftSchema, percentage, continuation, timetableSlotSchema, assertDraftEditable, publishDecision, teacherScheduleSchema } from '../_lib/teacherWorkspacePolicy.js';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { listNotionStudents } from '../_lib/notion.js';
import { readStudentDirectoryMappings } from '../_lib/studentDirectoryMappings.js';
import { publishTeacherDraft, prepareNotionWorkspace, previousNotionLesson, publishTeacherSchedule, confirmTeacherReflection } from '../_lib/teacherNotionPublish.js';
export default async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
        const actor = await teacherActor(req);
        const { db } = actor;
        if (req.method === 'GET') {
            const action = new URL(req.url || '', 'http://localhost').searchParams.get('action') || 'bootstrap';
            if (action === 'report-review') {
                const url = new URL(req.url || '', 'http://localhost');
                const studentKey = z.string().uuid().parse(url.searchParams.get('studentKey'));
                const audience = z.enum(['parent', 'student']).parse(url.searchParams.get('audience'));
                return sendJson(res, 200, { ok: true, ...await loadTeacherReportReview(db, actor, studentKey, audience) });
            }
            if (action === 'bootstrap') {
                const [notion, mappings, enrollments, curricula, drafts, classes, schedules, reflected] = await Promise.all([
                    listNotionStudents(), readStudentDirectoryMappings(db), db.collection('studentEnrollments').get(),
                    actor.admin ? db.collection('teacherCurricula').get() : db.collection('teacherCurricula').where('ownerUid', '==', actor.uid).get(),
                    actor.admin ? db.collection('teacherLessonDrafts').get() : db.collection('teacherLessonDrafts').where('ownerUid', '==', actor.uid).get(),
                    actor.admin ? db.collection('teacherClasses').get() : db.collection('teacherClasses').where('ownerUid', '==', actor.uid).get(),
                    actor.admin ? db.collection('teacherSchedules').get() : db.collection('teacherSchedules').where('ownerUid', '==', actor.uid).get(),
                    db.collection('studentSchedules').get(),
                ]);
                const students = notion.filter(s => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey)).map(s => {
                    const mapping = mappings.get(s.studentKey);
                    const subjects = enrollments.docs.filter(d => !d.data().removed && d.data().internalStudentId === mapping?.internalStudentId).flatMap(d => d.data().subjects || []).filter(subject => actor.admin || actor.scopes.some((scope: any) => scope.studentKey === s.studentKey && scope.subject === subject.subject));
                    return { ...s, linkedFirebaseUid: mapping?.firebaseUid || null, subjects };
                });
                const records = drafts.docs.map(d => ({ id: d.id, ...d.data() }));
                // Show only confirmed downstream reflection as published.
                await Promise.all(records.map(async (r: any) => {
                    if (r.stage === 'processing' && r.notionPageId) {
                        const reflected = await db.collection('lessonReports').doc(r.notionPageId.replace(/-/g, '')).get();
                        const fallback = reflected.exists ? reflected : await db.collection('lessonReports').doc(r.notionPageId).get();
                        if (fallback.exists && fallback.data()?.serverUpdatedAt && Date.parse(fallback.data()!.serverUpdatedAt) >= r.publishStartedAt && await confirmTeacherReflection(r.notionPageId, 'lesson').catch(() => false)) {
                            r.stage = 'published';
                            await db.collection('teacherLessonDrafts').doc(r.id).update({ stage: 'published' });
                        }
                    }
                }));
                const scheduleRecords = schedules.docs.map(d => ({ id: d.id, ...d.data() }));
                await Promise.all(scheduleRecords.map(async (r: any) => {
                    if (r.stage === 'processing' && r.notionPageId && await confirmTeacherReflection(r.notionPageId, 'schedule').catch(() => false)) {
                        r.stage = 'published';
                        await db.collection('teacherSchedules').doc(r.id).update({ stage: 'published' });
                    }
                }));
                const staff = actor.admin ? (await db.collection('users').where('role', '==', 'teacher').get()).docs.map(d => ({ uid: d.id, name: d.data().alias || d.data().name })) : [];
                const access = actor.admin ? (await db.collection('teacherWorkspaceAccess').get()).docs.map(d => ({ uid: d.id, ...d.data() })) : [];
                return sendJson(res, 200, { ok: true, admin: actor.admin, uid: actor.uid, scopes: actor.scopes, students, curricula: curricula.docs.map(d => ({ id: d.id, ...d.data() })), drafts: records, schedules: scheduleRecords, reflectedSchedules: teacherReflectedSchedules(reflected.docs.map(d => d.data()), mappings, actor), classes: classes.docs.map(d => ({ id: d.id, ...d.data() })), staff, access });
            }
            return sendJson(res, 404, { ok: false });
        }
        if (req.method !== 'POST')
            return sendJson(res, 405, { ok: false });
        const body = await parseJsonBody(req);
        if (body.action === 'grant') {
            if (!actor.admin)
                throw new Error('FORBIDDEN');
            const value = z.object({ uid: z.string().min(1), notionTeacherPageId: z.string().uuid().nullable().optional(), scopes: z.array(z.object({ studentKey: z.string().uuid(), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']) })).max(1000) }).parse(body);
            const user = (await db.collection('users').doc(value.uid).get()).data();
            if (user?.role !== 'teacher')
                throw new Error('INVALID_TEACHER');
            await db.collection('teacherWorkspaceAccess').doc(value.uid).set({ scopes: value.scopes, disabled: false, notionTeacherPageId: value.notionTeacherPageId || null });
            return sendJson(res, 200, { ok: true });
        }
        if (body.action === 'prepare-notion') {
            if (!actor.admin)
                throw new Error('FORBIDDEN');
            return sendJson(res, 200, { ok: true, ...await prepareNotionWorkspace(db) });
        }
        if (body.action === 'save-curriculum') {
            const value = z.object({ title: z.string().min(1).max(200), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']), content: z.string().max(30000) }).parse(body.data);
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherCurricula').doc(id);
                const previous = (await t.get(ref)).data();
                if (previous && !canAccessOwned(actor, previous.ownerUid))
                    throw new Error('FORBIDDEN');
                t.set(ref, { ...value, ownerUid: previous?.ownerUid || actor.uid, updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'save-class') {
            const value = z.object({ name: z.string().min(1).max(200), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']), students: z.array(z.string().uuid()).max(100), slots: z.array(timetableSlotSchema).min(1).max(14) }).parse(body.data);
            if (value.students.some(key => !canTeach(actor, key, value.subject)))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherClasses').doc(id);
                const old = (await t.get(ref)).data();
                if (old && !canAccessOwned(actor, old.ownerUid))
                    throw new Error('FORBIDDEN');
                t.set(ref, { ...value, ownerUid: old?.ownerUid || actor.uid, updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'save-schedule') {
            const value = teacherScheduleSchema.parse(body.data);
            if (value.students.some(key => !canTeach(actor, key, value.subject)))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherSchedules').doc(id);
                const old = (await t.get(ref)).data();
                if (old && !canAccessOwned(actor, old.ownerUid))
                    throw new Error('FORBIDDEN');
                if (old && ['processing', 'publishing', 'notion_saved'].includes(old.stage))
                    throw new Error('PUBLISH_IN_PROGRESS');
                if (old && body.revision !== old.revision)
                    throw new Error('DRAFT_CONFLICT');
                t.set(ref, { ...old, data: value, ownerUid: old?.ownerUid || actor.uid, revision: (old?.revision || 0) + 1, stage: 'draft', updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'publish-schedule') {
            const id = z.string().uuid().parse(body.id), ref = db.collection('teacherSchedules').doc(id);
            const record = await db.runTransaction(async (t) => {
                const old = (await t.get(ref)).data();
                if (!old || !canAccessOwned(actor, old.ownerUid) || old.data.students.some((key: string) => !canTeach(actor, key, old.data.subject)))
                    throw new Error('FORBIDDEN');
                if (publishDecision(old) === 'already-published')
                    return { ...old, alreadyPublished: true };
                t.update(ref, { stage: 'publishing', publishStartedAt: Date.now() });
                return old;
            });
            if (record.alreadyPublished)
                return sendJson(res, 200, { ok: true, stage: 'published' });
            try {
                return sendJson(res, 200, { ok: true, pageId: await publishTeacherSchedule(db, id, record) });
            }
            catch (error: any) {
                await ref.update({ stage: 'failed', failureCode: error.message });
                throw error;
            }
        }
        if (body.action === 'save-draft') {
            const value = lessonDraftSchema.parse(body.data);
            if (!canTeach(actor, value.studentKey, value.subject))
                throw new Error('FORBIDDEN');
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherLessonDrafts').doc(id);
                const old = (await t.get(ref)).data();
                if (old && !canAccessOwned(actor, old.ownerUid))
                    throw new Error('FORBIDDEN');
                assertDraftEditable(old, body.revision, value);
                t.set(ref, { ...old, data: value, ownerUid: old?.ownerUid || actor.uid, revision: (old?.revision || 0) + 1, stage: 'draft', percentage: percentage(value.correct, value.total), updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'publish') {
            const id = z.string().uuid().parse(body.id);
            const ref = db.collection('teacherLessonDrafts').doc(id);
            const draft = await db.runTransaction(async (t) => {
                const old = (await t.get(ref)).data();
                if (!old || !canAccessOwned(actor, old.ownerUid) || !canTeach(actor, old.data.studentKey, old.data.subject))
                    throw new Error('FORBIDDEN');
                if (publishDecision(old) === 'already-published')
                    return { ...old, alreadyPublished: true };
                t.update(ref, { stage: 'publishing', publishStartedAt: Date.now() });
                return old;
            });
            if (draft.alreadyPublished)
                return sendJson(res, 200, { ok: true, stage: 'published', pageId: draft.notionPageId });
            try {
                const pageId = await publishTeacherDraft(db, id, draft);
                return sendJson(res, 200, { ok: true, stage: 'processing', pageId });
            }
            catch (error: any) {
                await ref.update({ stage: 'failed', failureCode: error.message });
                throw error;
            }
        }
        if (body.action === 'previous-lesson') {
            const key = z.string().uuid().parse(body.studentKey);
            const subject = z.enum(['영어', '수학', '국어', '과학', '한국사']).parse(body.subject);
            if (!canTeach(actor, key, subject))
                throw new Error('FORBIDDEN');
            const records = (await db.collection('teacherLessonDrafts').where('ownerUid', '==', actor.uid).get()).docs.map(d => d.data()).filter(d => d.data.studentKey === key && d.data.subject === subject).sort((a, b) => b.updatedAt - a.updatedAt);
            const previous = records[0]?.data || (subject === '영어' ? await previousNotionLesson(key) : {});
            return sendJson(res, 200, { ok: true, data: continuation(previous) });
        }
        if (body.action === 'continue') {
            const id = z.string().uuid().parse(body.id);
            const old = (await db.collection('teacherLessonDrafts').doc(id).get()).data();
            if (!old || !canAccessOwned(actor, old.ownerUid))
                throw new Error('FORBIDDEN');
            return sendJson(res, 200, { ok: true, data: continuation(old.data) });
        }
        return sendJson(res, 400, { ok: false, error: 'UNKNOWN_ACTION' });
    }
    catch (error: any) {
        const code = error instanceof z.ZodError ? 'INVALID_INPUT' : error.message;
        const allowed = ['UNAUTHORIZED', 'FORBIDDEN', 'TEACHER_NOT_CONFIGURED', 'DRAFT_CONFLICT', 'SOURCE_IDENTITY_LOCKED', 'PUBLISH_IN_PROGRESS', 'NOTION_SCHEMA_SETUP_REQUIRED', 'MAKE_TRIGGER_NOT_CONFIGURED', 'MAKE_TRIGGER_FAILED', 'MAKE_SUBJECT_NOT_CONFIGURED', 'TEACHER_NOTION_LINK_REQUIRED'];
        return sendJson(res, code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'INVALID_INPUT' ? 400 : 409, { ok: false, error: allowed.includes(code) || code === 'INVALID_INPUT' ? code : 'WORKSPACE_ERROR' });
    }
}
