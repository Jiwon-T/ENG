import { teacherReflectedSchedules } from '../_lib/teacherReflectedSchedules.js';
import { loadTeacherReportReview } from '../_lib/teacherReportReview.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { academicDraftSchema, canViewAcademyRecord } from '../_lib/teacherAcademicPolicy.js';
import { listTeacherNotionGrades, publishTeacherGrade, gradeNotion, canReadNotionGrade } from '../_lib/teacherAcademicNotion.js';
import { workspaceError } from '../_lib/teacherWorkspaceError.js';
import { teacherActor } from '../_lib/teacherWorkspaceAuth.js';
import { canAccessOwned, canTeach, assertLessonComplete, lessonDraftSchema, percentage, continuation, timetableSlotSchema, assertDraftEditable, publishDecision, teacherScheduleSchema } from '../_lib/teacherWorkspacePolicy.js';
import { parseJsonBody, sendJson } from '../_lib/http.js';
import { listNotionStudents } from '../_lib/notion.js';
import { readStudentDirectoryMappings } from '../_lib/studentDirectoryMappings.js';
import { publishTeacherDraft, prepareNotionWorkspace, previousNotionLesson, publishTeacherSchedule, confirmTeacherReflection } from '../_lib/teacherNotionPublish.js';
export default async function handler(req: IncomingMessage, res: ServerResponse) {
    let failureStage = 'authentication';
    try {
        const actor = await teacherActor(req);
        const { db } = actor;
        failureStage = 'workspace-data';
        if (req.method === 'GET') {
            const action = new URL(req.url || '', 'http://localhost').searchParams.get('action') || 'bootstrap';
            if (action === 'academic-records') {
                const saved = actor.admin ? await db.collection('teacherAcademicDrafts').get() : actor.principal ? await db.collection('teacherAcademicDrafts').where('academyId','==',actor.academyId).get() : await db.collection('teacherAcademicDrafts').where('ownerUid','==',actor.uid).get();
                const appRecords = saved.docs.map(d => ({id:d.id,...d.data()})).filter((r:any)=>canViewAcademyRecord(actor,r));
                const source = await listTeacherNotionGrades(db,actor);
                const sourceIds = new Set(appRecords.map((r:any)=>r.notionPageId));
                return sendJson(res,200,{ok:true,records:[...appRecords,...source.filter(r=>!sourceIds.has(r.notionPageId))]});
            }
            if (action === 'academy-lessons') {
                if(!actor.admin && !actor.principal) throw new Error('FORBIDDEN');
                const records = actor.admin ? await db.collection('teacherLessonDrafts').get() : await db.collection('teacherLessonDrafts').where('academyId','==',actor.academyId).get();
                const rows=records.docs.map(d=>({id:d.id,...d.data()})).filter((r:any)=>canViewAcademyRecord(actor,r));
                const names=new Map<string,string>();
                await Promise.all([...new Set(rows.map((r:any)=>r.ownerUid))].map(async uid=>{if(!uid)return;const user=(await db.collection('users').doc(uid as string).get()).data();names.set(uid as string,user?.alias||user?.name||'선생님');}));
                return sendJson(res,200,{ok:true,records:rows.map((r:any)=>({...r,teacherName:names.get(r.ownerUid)||'선생님'}))});
            }
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
                    actor.admin ? db.collection('teacherClasses').get() : actor.principal ? db.collection('teacherClasses').where('academyId','==',actor.academyId).get() : db.collection('teacherClasses').where('ownerUid', '==', actor.uid).get(),
                    actor.admin ? db.collection('teacherSchedules').get() : actor.principal ? db.collection('teacherSchedules').where('academyId','==',actor.academyId).get() : db.collection('teacherSchedules').where('ownerUid', '==', actor.uid).get(),
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
                const staff = actor.admin ? (await db.collection('users').where('role', 'in', ['teacher','principal']).get()).docs.map(d => ({ uid: d.id, name: d.data().alias || d.data().name })) : [];
                const access = actor.admin ? (await db.collection('teacherWorkspaceAccess').get()).docs.map(d => ({ uid: d.id, ...d.data() })) : [];
                return sendJson(res, 200, { ok: true, admin: actor.admin, principal: actor.principal, academyId: actor.academyId, teachingScopes: actor.teachingScopes, uid: actor.uid, scopes: actor.scopes, students, curricula: curricula.docs.map(d => ({ id: d.id, ...d.data() })), drafts: records, schedules: scheduleRecords, reflectedSchedules: teacherReflectedSchedules(reflected.docs.map(d => d.data()), mappings, actor), classes: classes.docs.map(d => ({ id: d.id, ...d.data() })), staff, access });
            }
            return sendJson(res, 404, { ok: false });
        }
        if (req.method !== 'POST')
            return sendJson(res, 405, { ok: false });
        const body = await parseJsonBody(req);
        if (body.action === 'grant') {
            if (!actor.admin)
                throw new Error('FORBIDDEN');
            const value = z.object({ uid: z.string().min(1), notionTeacherPageId: z.string().uuid().nullable().optional(), academyId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), workspaceRole: z.enum(['teacher','principal']).default('teacher'), academyStudents: z.array(z.string().uuid()).max(400).default([]), scopes: z.array(z.object({ studentKey: z.string().uuid(), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']) })).max(1000) }).parse(body);
            const user = (await db.collection('users').doc(value.uid).get()).data();
            if (!['teacher','principal'].includes(user?.role))
                throw new Error('INVALID_TEACHER');
            const batch = db.batch();
            batch.set(db.collection('teacherWorkspaceAccess').doc(value.uid), { scopes:value.scopes, academyId:value.academyId, workspaceRole:value.workspaceRole, disabled:false, notionTeacherPageId:value.notionTeacherPageId||null });
            batch.update(db.collection('users').doc(value.uid), {role:value.workspaceRole === 'principal' ? 'principal' : 'teacher'});
            for(const studentKey of value.academyStudents) batch.set(db.collection('academyStudentMemberships').doc(studentKey),{academyId:value.academyId,disabled:false});
            await batch.commit();
            for (const collection of ['teacherLessonDrafts','teacherAcademicDrafts','teacherSchedules','teacherClasses']) {
                const historical = await db.collection(collection).where('ownerUid','==',value.uid).get();
                for (const record of historical.docs) if(!record.data().academyId) await record.ref.update({academyId:value.academyId});
            }
            return sendJson(res, 200, { ok: true });
        }
        if (body.action === 'prepare-notion') {
            if (!actor.admin)
                throw new Error('FORBIDDEN');
            return sendJson(res, 200, { ok: true, ...await prepareNotionWorkspace(db) });
        }
        if (body.action === 'save-academic') {
            const value = academicDraftSchema.parse(body.data);
            if(!canTeach(actor,value.studentKey,value.subject)) throw new Error('FORBIDDEN');
            if(!actor.academyId) throw new Error('ACADEMY_REQUIRED');
            const id=body.id ? z.string().uuid().parse(body.id) : randomUUID();
            let importedPageId: string | undefined;
            if(body.notionPageId) {
                importedPageId=z.string().uuid().parse(body.notionPageId);
                const page=await gradeNotion(`pages/${importedPageId}`);
                const profile=(await db.collection('teacherWorkspaceAccess').doc(actor.uid).get()).data();
                if(actor.principal || !canReadNotionGrade(actor,profile,page)) throw new Error('FORBIDDEN');
                if(page.properties['학생']?.relation?.[0]?.id.replace(/-/g,'') !== value.studentKey.replace(/-/g,'')) throw new Error('SOURCE_IDENTITY_LOCKED');
                if(id !== importedPageId || page.properties['과목']?.select?.name !== value.subject) throw new Error('SOURCE_IDENTITY_LOCKED');
            }
            await db.runTransaction(async t=>{
                const ref=db.collection('teacherAcademicDrafts').doc(id), old=(await t.get(ref)).data();
                if(old && !canAccessOwned(actor,old.ownerUid)) throw new Error('FORBIDDEN');
                assertDraftEditable(old,body.revision,value);
                t.set(ref,{...old,data:value,ownerUid:old?.ownerUid||actor.uid,academyId:old?.academyId||actor.academyId,revision:(old?.revision||0)+1,stage:'draft',updatedAt:Date.now(),...(importedPageId?{notionPageId:importedPageId}:{})});
            });
            return sendJson(res,200,{ok:true,id});
        }
        if(body.action === 'publish-academic') {
            failureStage='academic-reflection';
            const id=z.string().uuid().parse(body.id),ref=db.collection('teacherAcademicDrafts').doc(id);
            const record=await db.runTransaction(async t=>{
                const old=(await t.get(ref)).data();
                if(!old || !canAccessOwned(actor,old.ownerUid) || !canTeach(actor,old.data.studentKey,old.data.subject)) throw new Error('FORBIDDEN');
                if(publishDecision(old)==='already-published') return {...old,alreadyPublished:true};
                academicDraftSchema.parse(old.data);
                t.update(ref,{stage:'publishing',publishStartedAt:Date.now()});return old;
            });
            if(record.alreadyPublished) return sendJson(res,200,{ok:true,stage:'published'});
            try {return sendJson(res,200,{ok:true,stage:'published',pageId:await publishTeacherGrade(db,id,record)});}
            catch(e:any) {await ref.update({stage:'failed'});throw e;}
        }
        if (body.action === 'save-curriculum') {
            const value = z.object({ title: z.string().min(1).max(200), subject: z.enum(['영어', '수학', '국어', '과학', '한국사']), content: z.string().max(30000) }).parse(body.data);
            const id = body.id ? z.string().uuid().parse(body.id) : randomUUID();
            await db.runTransaction(async (t) => {
                const ref = db.collection('teacherCurricula').doc(id);
                const previous = (await t.get(ref)).data();
                if (previous && !canAccessOwned(actor, previous.ownerUid))
                    throw new Error('FORBIDDEN');
                t.set(ref, { ...value, ownerUid: previous?.ownerUid || actor.uid, academyId: previous?.academyId || actor.academyId, updatedAt: Date.now() });
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
                t.set(ref, { ...value, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, updatedAt: Date.now() });
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
                t.set(ref, { ...old, data: value, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'publish-schedule') {
            failureStage='schedule-reflection';
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
                t.set(ref, { ...old, data: value, ownerUid: old?.ownerUid || actor.uid, academyId: old?.academyId || actor.academyId, revision: (old?.revision || 0) + 1, stage: 'draft', percentage: percentage(value.correct, value.total), updatedAt: Date.now() });
            });
            return sendJson(res, 200, { ok: true, id });
        }
        if (body.action === 'publish') {
            failureStage='lesson-reflection';
            const id = z.string().uuid().parse(body.id);
            const ref = db.collection('teacherLessonDrafts').doc(id);
            const draft = await db.runTransaction(async (t) => {
                const old = (await t.get(ref)).data();
                if (!old || !canAccessOwned(actor, old.ownerUid) || !canTeach(actor, old.data.studentKey, old.data.subject))
                    throw new Error('FORBIDDEN');
                if (publishDecision(old) === 'already-published')
                    return { ...old, alreadyPublished: true };
                assertLessonComplete(old.data);
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
        const result = workspaceError(error, failureStage);
        if (result.status >= 500) console.warn('TEACHER_WORKSPACE_FAILED', {error: result.body.error, diagnosticId: result.body.diagnosticId, failureStage});
        return sendJson(res, result.status, result.body);
    }
}
