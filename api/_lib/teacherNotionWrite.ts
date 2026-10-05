import { randomUUID } from 'node:crypto';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import type { RegistrationNotion } from './teacherStudentRegistrationNotion.js';
const text = (p: any) => (p?.rich_text || p?.title || []).map((r: any) => r.plain_text ?? r.text?.content ?? '').join('');
function comparable(p: any): any {
    if (!p)
        return undefined;
    if ('rich_text' in p)
        return { rich_text: text(p) };
    if ('title' in p)
        return { title: text(p) };
    if ('relation' in p) {
        if (p.has_more)
            return undefined;
        return { relation: p.relation.map((r: any) => uuid(r.id)).sort() };
    }
    if ('multi_select' in p)
        return { multi_select: p.multi_select.map((r: any) => r.name).sort() };
    if ('date' in p)
        return { date: p.date ? { start: Date.parse(p.date.start) || p.date.start, end: p.date.end ? (Date.parse(p.date.end) || p.date.end) : null } : null };
    if ('select' in p)
        return { select: p.select?.name || null };
    if ('status' in p)
        return { status: p.status?.name || null };
    if ('number' in p)
        return { number: p.number ?? null };
    if ('checkbox' in p)
        return { checkbox: p.checkbox };
    return undefined;
}
export function notionPropertiesMatch(page: any, properties: any) { return Object.entries(properties).every(([k, v]) => JSON.stringify(comparable(page.properties?.[k])) === JSON.stringify(comparable(v))); }
function assertPage(page: any, database: string, id?: string) { if (!page || page.archived || page.in_trash || uuid(page.parent?.database_id || '') !== uuid(database) || id && uuid(page.id) !== uuid(id))
    throw Error('NOTION_SOURCE_MISMATCH'); }
// Durable immutable write intent. Creation is never blindly repeated after a timeout.
export async function writeTeacherNotionRecord(db: any, collection: string, id: string, record: any, database: string, properties: any, notion: RegistrationNotion) {
    const ref = db.collection(collection).doc(id), lease = randomUUID();
    const intent = await db.runTransaction(async (tx: any) => {
        const saved = (await tx.get(ref)).data();
        if (saved?.archived||collection==='teacherLessonDrafts'&&saved?.deleteRequested)throw Error('FORBIDDEN');
        if (!saved || saved.revision !== record.revision)
            throw Error('DRAFT_CONFLICT');
        const old = saved.notionWrite;
        if (old && old.revision === record.revision) {
            if (old.database !== uuid(database) || JSON.stringify(old.properties) !== JSON.stringify(properties))
                throw Error('NOTION_WRITE_REQUEST_CONFLICT');
            if (old.leaseUntil > Date.now())
                throw Error('PUBLISH_IN_PROGRESS');
        }
        else if (old && !old.done)
            throw Error('NOTION_WRITE_PENDING');
        const next = { ...(old?.revision === record.revision ? old : { revision: record.revision, database: uuid(database), properties, pageId: record.notionPageId ? uuid(record.notionPageId) : null, expectedEditedAt: record.notionEditedAt || null, attempted: false, done: false }), lease, leaseUntil: Date.now() + 180000 };
        tx.update(ref, { notionWrite: next });
        return next;
    });
    let state = intent;
    async function checkpoint(patch: any) { state = await db.runTransaction(async (tx: any) => { const current = (await tx.get(ref)).data(); if(current?.archived||collection==='teacherLessonDrafts'&&current?.deleteRequested)throw Error('FORBIDDEN'); if (current?.revision !== record.revision || current.notionWrite?.lease !== lease)
        throw Error('PUBLISH_IN_PROGRESS'); const next = { ...current.notionWrite, ...patch, leaseUntil: patch.lease === null ? 0 : Date.now() + 180000 }; tx.update(ref, { notionWrite: next, ...(patch.done ? { notionPageId: next.pageId, notionEditedAt: next.remoteEditedAt, stage: 'notion_saved', notionSavedRevision: record.revision, updatedAt: Date.now() } : {}) }); return next; }); }
    try {
        let page: any;
        if (state.pageId) {
            page = await notion(`pages/${state.pageId}`);
            assertPage(page, database, state.pageId);
        }
        else {
            const matches = await notion(`databases/${database}/query`, 'POST', { filter: { property: '앱 기록 ID', rich_text: { equals: id } }, page_size: 2 });
            if (matches.has_more || !Array.isArray(matches.results) || matches.results.length > 1)
                throw Error('DUPLICATE_NOTION_RECORD');
            if (matches.results[0]) {
                page = await notion(`pages/${uuid(matches.results[0].id)}`);
                assertPage(page, database);
                if (text(page.properties?.['앱 기록 ID']) !== id)
                    throw Error('NOTION_SOURCE_MISMATCH');
                await checkpoint({ pageId: uuid(page.id) });
            }
        }
        if (state.done) {
            if (!page)
                throw Error('NOTION_SOURCE_MISMATCH');
            const { ['반영 상태']: marker, ...expected } = properties;
            if (!notionPropertiesMatch(page, expected))
                throw Error('NOTION_EDIT_CONFLICT');
            await checkpoint({ lease: null });
            return page;
        }
        if (page && !state.attempted && !state.expectedEditedAt) {
            // An unclaimed existing marker is not permission to overwrite someone else's row.
            if (!notionPropertiesMatch(page, properties))
                throw Error('NOTION_EDIT_CONFLICT');
        }
        if (!page || !notionPropertiesMatch(page, properties)) {
            if (state.attempted)
                throw Error('NOTION_WRITE_RESULT_UNCERTAIN');
            if (page && (!state.expectedEditedAt || page.last_edited_time !== state.expectedEditedAt))
                throw Error('NOTION_EDIT_CONFLICT');
            if (page) {
                const latest = await notion(`pages/${state.pageId}`);
                assertPage(latest, database, state.pageId);
                if (latest.last_edited_time !== state.expectedEditedAt)
                    throw Error('NOTION_EDIT_CONFLICT');
            }
            // Store the attempt before the request; a killed process must still reconcile it.
            await checkpoint({ attempted: true });
            try {
                page = page ? await notion(`pages/${state.pageId}`, 'PATCH', { properties }) : await notion('pages', 'POST', { parent: { database_id: database }, properties });
            }
            catch (e) {
                if (/^NOTION_4\d\d$/.test(e instanceof Error ? e.message : ''))
                    await checkpoint({ attempted: false });
                throw e;
            }
            assertPage(page, database, state.pageId || undefined);
            await checkpoint({ pageId: uuid(page.id) });
            page = await notion(`pages/${state.pageId}`);
            assertPage(page, database, state.pageId);
            if (!notionPropertiesMatch(page, properties))
                throw Error('NOTION_WRITE_RESULT_UNCERTAIN');
        }
        if (!page)
            throw Error('NOTION_WRITE_RESULT_UNCERTAIN');
        await checkpoint({ pageId: uuid(page.id), remoteEditedAt: page.last_edited_time, done: true, lease: null });
        return page;
    }
    catch (e) {
        await checkpoint({ lease: null }).catch(() => { });
        throw e;
    }
}
