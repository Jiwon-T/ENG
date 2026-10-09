import { createHash, randomUUID } from 'node:crypto';
import { gradeNotion } from './teacherAcademicNotion.js';
import { sourcesFor, sourceLessonData, text, DEFAULT_SOURCE } from './teacherNotionWorkspace.js';
import { sharedRecordOwner } from './sharedNotionPolicy.js';
import { hashStudentKey } from './security.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { subjects, lessonFeedback } from './teacherWorkspacePolicy.js';

/*
 * Server-driven past lesson migration (C2). Notion rows are staged in lessonSourceRecords
 * (doc ID = the real Notion page ID). Nothing here writes teacherLessonDrafts or lessonReports,
 * so normal screens and public reports are unchanged until a separate, verified cutover.
 * Rows needing a decision become holds; independent rows keep moving.
 */
const hash = (v: any) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const jobRef = (db: any) => db.collection('lessonMigrationJobs').doc('main');
const ADMIN_TEACHER_PAGE = '3ec0d0f1-c79a-8108-b714-c1d6fc390ba2';
const PAGE_SIZE = 20, MAX_ATTEMPTS = 6, MAX_ROWS = 50000, STAGED_LIMIT = 100;
const budget = () => Math.max(3000, Number(process.env.LESSON_MIGRATION_BUDGET_MS) || 8000);
const RUNNABLE = ['running', 'waiting'];
const PENDING_STAGES = ['publishing', 'processing', 'notion_saved', 'report_published_notion_pending'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A request is in flight while its lease or 3-minute publish window is open; only then must cutover wait. */
export function lessonWriteInFlight(d: any, now = Date.now()) {
    return d?.notionWrite?.leaseUntil > now || d?.deleteLeaseUntil > now || ['publishing', 'processing', 'notion_saved'].includes(d?.stage) && now - (d.publishStartedAt || d.updatedAt || 0) < 180000;
}
/** Codes an admin may accept as-is. Everything else must be fixed at the source and rechecked. */
export const ACKNOWLEDGEABLE: Record<string, string> = {
    STUDENT_LINK_MISSING: 'exclude', MULTIPLE_STUDENTS: 'exclude', SUBJECT_INVALID: 'exclude',
    AUTHOR_UNKNOWN: 'stage-unlinked', MARKER_ORPHAN: 'stage', PUBLIC_REPORT_MISSING: 'stage',
    PUBLIC_VALUES_DIFFER: 'stage', SOURCE_REMOVED: 'mark-removed',
};
const choice = (p: any) => p?.status?.name || p?.select?.name || '';
const norm = (v: any) => String(v ?? '').replace(/\s+/g, ' ').trim();
const kstDate = (iso: string) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(t)) : ''; };
const holdError = (code: string) => Object.assign(new Error(code), { hold: code });

export function transientMigrationError(error: any) {
    const text = String(error?.message || error?.code || error?.name || '');
    return /^NOTION_(429|5\d\d)$/.test(text) || /FIRESTORE_UNAVAILABLE|UNAVAILABLE|ABORTED|DEADLINE_EXCEEDED|RESOURCE_EXHAUSTED|TimeoutError|AbortError|ETIMEDOUT|ECONNRESET|fetch failed/i.test(text) || [4, 8, 10, 14].includes(error?.code);
}
export function migrationBackoff(attempt: number) { return Math.min(1800000, 30000 * 2 ** Math.max(0, attempt - 1)); }

function assertAdmin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }

async function relationIds(notion: any, page: any, key: string) {
    const p = page.properties?.[key];
    if (!p) return [];
    if (!p.has_more) return (p.relation || []).map((r: any) => uuid(r.id));
    const out: string[] = []; let cursor: string | null = null, guard = 0;
    do {
        if (++guard > 50) throw Error('LESSON_MIGRATION_LIMIT');
        const r = await notion(`pages/${page.id}/properties/${encodeURIComponent(p.id)}` + (cursor ? `?start_cursor=${cursor}` : ''));
        out.push(...(r.results || []).map((v: any) => uuid(v.relation.id)));
        cursor = r.has_more ? r.next_cursor : null;
    } while (cursor);
    return out;
}

/** Source layout at job start: which lesson databases exist and who may own their rows. */
async function migrationContext(db: any, job: any) {
    const sources = await sourcesFor(db, { uid: job.startedBy, admin: true, principal: false, academyId: 'main' });
    const shared = sources.some((s: any) => s.shared);
    const byDb = new Map<string, any[]>();
    for (const s of sources) if (s.lessonDatabaseId && (s.academyId || 'main') === 'main') {
        const id = uuid(s.lessonDatabaseId); byDb.set(id, [...(byDb.get(id) || []), s]);
    }
    const profileMap = new Map<string, string>();
    for (const p of (sources.find((s: any) => s.shared)?.profiles || [])) if (p.notionTeacherPageId && !p.disabled) profileMap.set(uuid(p.notionTeacherPageId), p.uid);
    // Any change to ownership or source layout changes every row version, so no stale owner is reused.
    const contextHash = hash([shared, [...byDb].map(([k, v]) => [k, v.map((s: any) => [s.ownerUid, s.teacherPageId, s.subject])]), [...profileMap].sort()]);
    return { shared, byDb, profileMap, contextHash, students: new Map<string, any>() };
}

async function studentIdentity(db: any, ctx: any, key: string) {
    if (!ctx.students.has(key)) {
        const [mapping, member] = await Promise.all([db.collection('notionStudentMappings').doc(hashStudentKey(key)).get(), db.collection('academyStudentMemberships').doc(key).get()]);
        ctx.students.set(key, { mapping: mapping.data(), member: member.data() });
    }
    const { mapping, member } = ctx.students.get(key);
    if (!mapping?.internalStudentId || !member || member.disabled || member.academyId !== 'main' || member.internalStudentId && member.internalStudentId !== mapping.internalStudentId) return null;
    return mapping;
}

function publicDiffers(pub: any, data: any) {
    if (kstDate(pub.lessonDateStart) !== data.date || (pub.subject || '영어') !== data.subject) return true;
    if ((pub.attendance || '미확인') !== data.attendance) return true;
    const content = norm(data.content);
    return Boolean(content) && !norm(pub.feedback).includes(content);
}

/** Classify one Notion row. Throws holdError for rows that need a decision. Reads only. */
async function classifyPage(db: any, notion: any, ctx: any, databaseId: string, page: any, hold: any) {
    const pageId = uuid(page.id), sourceKey = hash(['main', databaseId, pageId]);
    const ack = (code: string, version: string) => hold?.acknowledged?.[code] === version;
    const base = { sourceKey, pageId, databaseId, editedAt: page.last_edited_time };
    if (uuid(page.parent?.database_id || '') !== databaseId) throw holdError('SOURCE_IDENTITY');
    const p = page.properties || {}, sources = ctx.byDb.get(databaseId) || [];
    const students = await relationIds(notion, page, '학생');
    const factsVersion = hash([page.last_edited_time, students]);
    const academyText = text(p['학원']), rawSubject = choice(p['과목']);
    const legacy = ctx.shared && databaseId === uuid(DEFAULT_SOURCE.lessonDatabaseId) && !academyText && (!rawSubject || rawSubject === '영어');
    const academy = ctx.shared ? academyText || (legacy ? 'main' : '') : sources[0]?.academyId || 'main';
    if (academy !== 'main') return { ...base, outcome: 'other-academy' };
    if (!students.length) { if (ack('STUDENT_LINK_MISSING', factsVersion)) return { ...base, outcome: 'excluded' }; throw Object.assign(holdError('STUDENT_LINK_MISSING'), { version: factsVersion }); }
    if (students.length > 1) { if (ack('MULTIPLE_STUDENTS', factsVersion)) return { ...base, outcome: 'excluded' }; throw Object.assign(holdError('MULTIPLE_STUDENTS'), { version: factsVersion }); }
    const studentKey = students[0];
    const subject = rawSubject || (legacy ? '영어' : ctx.shared ? '' : sources[0]?.subject || '');
    if (!subjects.includes(subject as any)) { if (ack('SUBJECT_INVALID', factsVersion)) return { ...base, outcome: 'excluded' }; throw Object.assign(holdError('SUBJECT_INVALID'), { version: factsVersion, studentKey }); }
    // Ownership follows the existing reader exactly; unresolved authors are never assigned to a user.
    let ownerUid: string | null = null, assignedUids: string[] = [];
    if (ctx.shared) {
        let assigned = await relationIds(notion, page, '담당 선생님'); const authors = await relationIds(notion, page, '작성자 선생님');
        if (legacy && !assigned.length) assigned = [ADMIN_TEACHER_PAGE];
        const owner = sharedRecordOwner(authors, assigned, ctx.profileMap);
        ownerUid = owner === '__unlinked_author__' ? null : owner;
        // Assigned teachers keep read access exactly as the Notion reader grants it today.
        assignedUids = [...new Set(assigned.map((id: string) => ctx.profileMap.get(id)).filter(Boolean))].sort() as string[];
    } else {
        const assigned = p['담당 선생님'] ? await relationIds(notion, page, '담당 선생님') : null;
        const owners = [...new Set(sources.filter((s: any) => !assigned || s.teacherPageId && assigned.includes(uuid(s.teacherPageId))).map((s: any) => s.ownerUid))];
        ownerUid = owners.length === 1 ? owners[0] as string : null;
        assignedUids = ownerUid ? [ownerUid] : [];
    }
    const mapping = await studentIdentity(db, ctx, studentKey);
    if (!mapping) throw Object.assign(holdError('STUDENT_MAPPING'), { studentKey });
    const data = sourceLessonData(page, studentKey, subject);
    const stage = choice(p['전송 완료']) === '완료' ? 'published' : 'draft';
    const marker = text(p['앱 기록 ID']).trim();
    const info = { studentKey, date: data.date, ownerUid };
    const version = hash([page.last_edited_time, data, stage, marker, ownerUid, assignedUids, mapping.internalStudentId, ctx.contextHash]);
    if (!ownerUid && !ack('AUTHOR_UNKNOWN', version)) throw Object.assign(holdError('AUTHOR_UNKNOWN'), { version, ...info });
    // App identity: one draft per Notion page; the app marker must agree with the stored link.
    const linked = await db.collection('teacherLessonDrafts').where('notionPageId', '==', pageId).limit(3).get();
    if (linked.docs.length > 1) throw Object.assign(holdError('DUPLICATE_APP_RECORD'), info);
    let draft = linked.docs[0] ? { id: linked.docs[0].id, ...linked.docs[0].data() } : null;
    const validMarker = UUID.test(marker);
    if (validMarker && draft && uuid(marker) !== draft.id) throw Object.assign(holdError('DUPLICATE_APP_RECORD'), info);
    if (validMarker && !draft) {
        const marked = await db.collection('teacherLessonDrafts').doc(uuid(marker)).get();
        if (marked.exists) draft = { id: marked.id, ...marked.data() };
        else if (!ack('MARKER_ORPHAN', version)) throw Object.assign(holdError('MARKER_ORPHAN'), { version, ...info });
    }
    if (draft) {
        const d = draft as any;
        if (d.data?.studentKey !== studentKey || d.data?.subject !== subject || d.academyId && d.academyId !== 'main') throw Object.assign(holdError('SOURCE_IDENTITY'), info);
    }
    // Public report: never merge two public identities, never move one to another student.
    const keys = [...new Set([pageId, pageId.replace(/-/g, ''), ...(draft ? ['app-' + draft.id, draft.id, (draft as any).appProjectionId].filter(Boolean) : [])])];
    const [direct, owned] = await Promise.all([Promise.all(keys.map(k => db.collection('lessonReports').doc(k).get())), draft ? db.collection('lessonReports').where('teacherDraftId', '==', draft.id).limit(3).get() : Promise.resolve({ docs: [] })]);
    const found = new Map<string, any>();
    for (const s of [...direct, ...owned.docs]) if (s.exists) found.set(s.id, s);
    if (found.size > 1) throw Object.assign(holdError('DUPLICATE_PUBLIC'), info);
    const pub = [...found.values()][0], pubData = pub?.data();
    if (pubData && (pubData.internalStudentId && pubData.internalStudentId !== mapping.internalStudentId || pubData.teacherDraftId && pubData.teacherDraftId !== draft?.id)) throw Object.assign(holdError('SOURCE_IDENTITY'), info);
    if (!draft && stage === 'published' && !pubData && !ack('PUBLIC_REPORT_MISSING', version)) throw Object.assign(holdError('PUBLIC_REPORT_MISSING'), { version, ...info });
    if (!draft && pubData && (stage !== 'published' || publicDiffers(pubData, data)) && !ack('PUBLIC_VALUES_DIFFER', version)) throw Object.assign(holdError('PUBLIC_VALUES_DIFFER'), { version, ...info });
    const appDiffers = Boolean(draft && norm(lessonFeedback({ ...(draft as any).data, note: (draft as any).data?.note || '' })) !== norm(text(p['수업 내용'])));
    const record = {
        sourceKey, sourceId: pageId, sourceDatabaseId: databaseId, academyId: 'main', ownerUid: ownerUid || '__unlinked_author__', assignedUids,
        studentKey, internalStudentId: mapping.internalStudentId, subject, data, stage, appRecordId: validMarker ? uuid(marker) : null,
        linkedDraftId: draft?.id || null, publicReportId: pub?.id || null, notionEditedAt: page.last_edited_time, sourceVersion: version, contextHash: ctx.contextHash, removed: false,
    };
    return { ...base, outcome: 'stage', record, version, info, appOwned: Boolean(draft), appDiffers };
}

async function saveHold(tx: any, db: any, job: any, old: any, sourceKey: string, patch: any, now: number) {
    const ref = db.collection('lessonMigrationHolds').doc(sourceKey);
    if (old && !old.recheckRequested && old.runId === job.runId && old.status === patch.status && old.code === patch.code && old.version === (patch.version ?? null)) return false;
    tx.set(ref, { ...old, ...patch, sourceKey, version: patch.version ?? null, runId: job.runId, mode: job.mode, firstSeenAt: old?.firstSeenAt || now, updatedAt: now, recheckRequested: false });
    return true;
}

/** Apply one classification inside a lease-checked transaction. Unchanged rows cause no writes. */
async function applyRow(db: any, job: any, lease: string, page: any, result: any, now: number) {
    const holdRef = db.collection('lessonMigrationHolds').doc(result.sourceKey);
    return db.runTransaction(async (tx: any) => {
        const current = (await tx.get(jobRef(db))).data();
        if (current?.leaseOwner !== lease || current.runId !== job.runId) throw Error('PUBLISH_IN_PROGRESS');
        const hold = (await tx.get(holdRef)).data();
        const stagedRef = db.collection('lessonSourceRecords').doc(result.pageId), staged = (await tx.get(stagedRef)).data();
        if (result.outcome === 'hold') {
            await saveHold(tx, db, job, hold, result.sourceKey, { kind: 'source', status: 'open', code: result.code, version: result.version, sourceId: result.pageId, databaseId: result.databaseId, studentKey: result.studentKey || null, date: result.date || null, ownerUid: result.ownerUid || null, stagedExists: Boolean(staged) }, now);
            return 'held';
        }
        const acknowledged = hold && hold.status !== 'resolved' && Object.keys(hold.acknowledged || {}).length;
        const settle = () => hold && (hold.status === 'open' || hold.recheckRequested) && saveHold(tx, db, job, hold, result.sourceKey, { status: acknowledged ? 'acknowledged' : 'resolved', code: hold.code, version: hold.version }, now);
        if (result.outcome === 'excluded' || result.outcome === 'other-academy') { await settle(); return result.outcome; }
        if (result.outcome === 'mark-removed') {
            if (job.mode === 'full' && staged && !staged.removed) {
                tx.set(stagedRef, { ...staged, removed: true, removedAt: now, removedRunId: job.runId, updatedAt: now });
                tx.set(db.collection('lessonMigrationHistory').doc(result.pageId + ':' + now + ':remove'), { before: staged, by: job.startedBy, at: now, reason: 'source-removed-acknowledged' });
            }
            await settle(); return 'removed';
        }
        if (staged && Date.parse(staged.notionEditedAt) > Date.parse(result.record.notionEditedAt)) { await settle(); return 'unchanged'; }
        if (staged?.sourceVersion === result.version && !staged.removed) { await settle(); return 'unchanged'; }
        if (job.mode !== 'full') { await settle(); return 'would-stage'; }
        const raw = JSON.stringify(page);
        if (Buffer.byteLength(raw) > 800000) throw holdError('SOURCE_TOO_LARGE');
        const record = { ...result.record, importRunId: job.runId, importedAt: staged?.importedAt || now, updatedAt: now };
        tx.set(stagedRef, record);
        tx.set(db.collection('lessonImportVersions').doc(result.pageId + ':' + result.version.slice(0, 32)), { raw, sourceId: result.pageId, databaseId: result.databaseId, runId: job.runId, at: now });
        tx.set(db.collection('lessonMigrationHistory').doc(result.pageId + ':' + now + ':stage'), { before: staged || null, after: record, by: job.startedBy, at: now, reason: staged ? 'source-update' : 'source-import' });
        await settle();
        return 'staged';
    });
}

async function processPage(db: any, notion: any, ctx: any, job: any, lease: string, databaseId: string, page: any, now: number) {
    const sourceKey = hash(['main', databaseId, uuid(page.id)]);
    const hold = (await db.collection('lessonMigrationHolds').doc(sourceKey).get()).data();
    let result: any;
    if (page.archived || page.in_trash) {
        const staged = (await db.collection('lessonSourceRecords').doc(uuid(page.id)).get()).data();
        const version = hash(['removed', page.last_edited_time]);
        result = !staged || staged.removed ? { sourceKey, pageId: uuid(page.id), databaseId, outcome: 'excluded' } :
            hold?.acknowledged?.SOURCE_REMOVED === version ? { sourceKey, pageId: uuid(page.id), databaseId, outcome: 'mark-removed' } :
                { sourceKey, pageId: uuid(page.id), databaseId, outcome: 'hold', code: 'SOURCE_REMOVED', version, studentKey: staged.studentKey, date: staged.data?.date, ownerUid: staged.ownerUid };
    } else {
        // Fast path: same Notion edit time, read at least 2 minutes after that edit (edit times are
        // minute-rounded), same ownership layout and same student link => provably unchanged.
        const staged = !hold || hold.status !== 'open' ? (await db.collection('lessonSourceRecords').doc(uuid(page.id)).get()).data() : null;
        if (staged && !staged.removed && staged.notionEditedAt === page.last_edited_time && staged.contextHash === ctx.contextHash &&
            staged.updatedAt - Date.parse(page.last_edited_time) > 120000 && (await studentIdentity(db, ctx, staged.studentKey))?.internalStudentId === staged.internalStudentId)
            return { outcome: 'unchanged', result: { sourceKey, pageId: uuid(page.id), appOwned: Boolean(staged.linkedDraftId), marker: staged.appRecordId } };
        try { result = await classifyPage(db, notion, ctx, databaseId, page, hold); }
        catch (error: any) {
            if (!error?.hold) throw error;
            result = { sourceKey, pageId: uuid(page.id), databaseId, outcome: 'hold', code: error.hold, version: error.version || null, studentKey: error.studentKey, date: error.date, ownerUid: error.ownerUid };
        }
    }
    try { return { outcome: await applyRow(db, job, lease, page, result, now), result }; }
    catch (error: any) {
        if (error?.hold !== 'SOURCE_TOO_LARGE') throw error;
        return { outcome: await applyRow(db, job, lease, page, { ...result, outcome: 'hold', code: 'SOURCE_TOO_LARGE' }, now), result };
    }
}

const COUNT_KEYS: Record<string, string> = { 'other-academy': 'otherAcademy', 'would-stage': 'wouldStage' };
function tally(counts: any, outcome: string, result: any, revisit = false) {
    const next = { ...counts };
    const bump = (k: string) => next[k] = (next[k] || 0) + 1;
    bump(revisit ? 'revisited' : 'seen'); bump(COUNT_KEYS[outcome] || outcome);
    if (result?.appOwned) bump('appLinked');
    if (result?.appDiffers) bump('appDiffers');
    return next;
}

async function querySource(notion: any, databaseId: string, cursor: string | null, since?: string) {
    const page = await notion(`databases/${databaseId}/query`, 'POST', { page_size: PAGE_SIZE, sorts: [{ timestamp: 'last_edited_time', direction: 'ascending' }], ...(since ? { filter: { timestamp: 'last_edited_time', last_edited_time: { on_or_after: since } } } : {}), ...(cursor ? { start_cursor: cursor } : {}) });
    if (!Array.isArray(page.results) || page.has_more && (!page.next_cursor || page.next_cursor === cursor)) throw Error('LESSON_MIGRATION_PAGINATION');
    return page;
}

async function persist(db: any, lease: string, update: (job: any) => any) {
    return db.runTransaction(async (tx: any) => {
        const current = (await tx.get(jobRef(db))).data();
        if (current?.leaseOwner !== lease) throw Error('PUBLISH_IN_PROGRESS');
        const next = { ...current, ...update(current), updatedAt: Date.now() };
        tx.set(jobRef(db), next); return next;
    });
}

/** One bounded batch of the current phase. Returns the persisted job. */
async function runBatch(db: any, notion: any, ctx: any, job: any, lease: string, seen: Set<string>) {
    const now = Date.now();
    if (job.phase === 'scan' || job.phase === 'catchup') {
        const list = job.databases || [];
        const index = job.phase === 'scan' ? job.dbIndex || 0 : job.catchupIndex || 0;
        if (index >= list.length) return persist(db, lease, j => j.phase === 'scan' ? { phase: 'catchup', scanCompleted: true, catchupIndex: 0, catchupCursor: null, catchupFrom: new Date(j.scanStartedAt - 120000).toISOString() } : { phase: 'app-check', appCursor: null });
        const databaseId = list[index], cursor = job.phase === 'scan' ? job.cursor || null : job.catchupCursor || null;
        const page = await querySource(notion, databaseId, cursor, job.phase === 'catchup' ? job.catchupFrom : undefined);
        let counts = job.counts || {};
        for (const row of page.results) {
            if ((counts.seen || 0) >= MAX_ROWS) throw Error('LESSON_MIGRATION_LIMIT');
            const { outcome, result } = await processPage(db, notion, ctx, job, lease, databaseId, row, now);
            counts = tally(counts, outcome, result); seen.add(uuid(row.id));
        }
        if (page.results.length) await db.runTransaction(async (tx: any) => {
            if ((await tx.get(jobRef(db))).data()?.leaseOwner !== lease) throw Error('PUBLISH_IN_PROGRESS');
            tx.set(db.collection('lessonMigrationSeen').doc(job.runId + ':' + randomUUID()), { runId: job.runId, ids: page.results.map((r: any) => uuid(r.id)), markers: page.results.map((r: any) => text(r.properties?.['앱 기록 ID']).trim()).filter((m: string) => UUID.test(m)).map((m: string) => uuid(m)), at: now });
        });
        const next = page.has_more ? page.next_cursor : null;
        return persist(db, lease, j => job.phase === 'scan'
            ? { counts, cursor: next, dbIndex: next ? index : index + 1, steps: (j.steps || 0) + 1 }
            : { counts, catchupCursor: next, catchupIndex: next ? index : index + 1, steps: (j.steps || 0) + 1 });
    }
    if (job.phase === 'app-check') {
        // Staged rows not seen in this run's source pass: confirm removal or re-scope individually.
        // Single-field ordering only (no composite index needed); academy is checked per row.
        let query = db.collection('lessonSourceRecords').orderBy('sourceKey');
        if (job.appCursor) query = query.startAfter(job.appCursor);
        const batch = await query.limit(STAGED_LIMIT).get();
        let counts = job.counts || {};
        for (const doc of batch.docs) {
            const staged = doc.data();
            if (staged.academyId !== 'main' || staged.removed || seen.has(staged.sourceId)) continue;
            let page: any;
            try { page = await notion(`pages/${staged.sourceId}`); }
            catch (error: any) { if (error?.message !== 'NOTION_404') throw error; page = { id: staged.sourceId, archived: true, last_edited_time: staged.notionEditedAt, parent: { database_id: staged.sourceDatabaseId } }; }
            const { outcome, result } = await processPage(db, notion, ctx, job, lease, staged.sourceDatabaseId, page, now);
            counts = tally(counts, outcome, result, true);
        }
        const last = batch.docs.at(-1)?.data().sourceKey;
        if (batch.docs.length < STAGED_LIMIT) {
            // In-flight app writes whose Notion result is not confirmed must be resolved before cutover.
            const pending = await db.collection('teacherLessonDrafts').where('stage', 'in', PENDING_STAGES).limit(501).get();
            if (pending.docs.length > 500) throw Error('LESSON_MIGRATION_LIMIT');
            // Only requests still in flight hold the run. An unconfirmed Notion creation is settled by
            // evidence: this run read every source page (scan + catch-up) and recorded app markers.
            let inFlight = 0, foundInSource = 0, absentFromSource = 0;
            for (const doc of pending.docs) {
                const d = doc.data(); if (d.archived || d.academyId && d.academyId !== 'main') continue;
                const key = hash(['main', 'draft', doc.id]), flying = lessonWriteInFlight(d, now);
                const uncertain = d.notionWrite?.attempted && !d.notionWrite?.done && !d.notionPageId;
                if (flying) inFlight++; else if (uncertain && seen.has('marker:' + doc.id)) foundInSource++; else if (uncertain) absentFromSource++;
                await db.runTransaction(async (tx: any) => {
                    if ((await tx.get(jobRef(db))).data()?.leaseOwner !== lease) throw Error('PUBLISH_IN_PROGRESS');
                    const old = (await tx.get(db.collection('lessonMigrationHolds').doc(key))).data();
                    if (flying) await saveHold(tx, db, job, old, key, { kind: 'draft', status: 'open', code: 'APP_WRITE_PENDING', version: hash([d.revision, d.stage]), recordId: doc.id, studentKey: d.data?.studentKey || null, date: d.data?.date || null, ownerUid: d.ownerUid || null }, now);
                    if (!flying && uncertain) tx.set(db.collection('lessonWriteEvidence').doc(doc.id), { draftId: doc.id, revision: d.revision, result: seen.has('marker:' + doc.id) ? 'source-page-found' : 'no-source-page', runId: job.runId, at: now });
                    if (!flying && old?.status === 'open') await saveHold(tx, db, job, old, key, { status: 'resolved', code: old.code, version: old.version, evidence: uncertain ? (seen.has('marker:' + doc.id) ? 'source-page-found' : 'no-source-page') : 'not-in-flight' }, now);
                });
            }
            counts = { ...counts, appInFlight: inFlight, uncertainFound: foundInSource, uncertainAbsent: absentFromSource };
            return persist(db, lease, j => ({ counts, phase: 'recheck', recheckCursor: null, steps: (j.steps || 0) + 1 }));
        }
        return persist(db, lease, j => ({ counts, appCursor: last, steps: (j.steps || 0) + 1 }));
    }
    if (job.phase === 'recheck') {
        // Every open hold is re-evaluated once per run against the current source.
        let query = db.collection('lessonMigrationHolds').orderBy('sourceKey');
        if (job.recheckCursor) query = query.startAfter(job.recheckCursor);
        const batch = await query.limit(PAGE_SIZE).get();
        let counts = job.counts || {};
        for (const doc of batch.docs) {
            const hold = doc.data();
            if (hold.status !== 'open' || hold.runId === job.runId && !hold.recheckRequested && hold.updatedAt >= job.startedAt) continue;
            if (hold.kind === 'draft') {
                const d = (await db.collection('teacherLessonDrafts').doc(hold.recordId).get()).data();
                if (!d || !lessonWriteInFlight(d) || d.archived) await db.runTransaction(async (tx: any) => {
                    if ((await tx.get(jobRef(db))).data()?.leaseOwner !== lease) throw Error('PUBLISH_IN_PROGRESS');
                    const old = (await tx.get(doc.ref)).data(); await saveHold(tx, db, job, old, hold.sourceKey, { status: 'resolved', code: old.code, version: old.version }, now);
                });
                continue;
            }
            let page: any;
            try { page = await notion(`pages/${hold.sourceId}`); }
            catch (error: any) { if (error?.message !== 'NOTION_404') throw error; page = { id: hold.sourceId, archived: true, last_edited_time: hold.updatedAt ? new Date(hold.updatedAt).toISOString() : '', parent: { database_id: hold.databaseId } }; }
            const { outcome } = await processPage(db, notion, ctx, job, lease, hold.databaseId, page, now);
            counts = { ...counts, rechecked: (counts.rechecked || 0) + 1, ...(outcome === 'staged' ? { staged: (counts.staged || 0) + 1 } : {}) };
        }
        const last = batch.docs.at(-1)?.data().sourceKey;
        return persist(db, lease, j => batch.docs.length < PAGE_SIZE ? { counts, phase: 'report', steps: (j.steps || 0) + 1 } : { counts, recheckCursor: last, steps: (j.steps || 0) + 1 });
    }
    if (job.phase === 'report') {
        const open = await db.collection('lessonMigrationHolds').where('status', '==', 'open').limit(5001).get();
        const holdCounts: Record<string, number> = {};
        for (const d of open.docs) holdCounts[d.data().code] = (holdCounts[d.data().code] || 0) + 1;
        if (open.docs.length > 5000) throw Error('LESSON_MIGRATION_LIMIT');
        const c = job.counts || {}, openHolds = open.docs.length;
        // Counts come from this run's tallies; no full re-read of staged rows.
        // Readiness needs a complete source pass in this run; a recheck-only run never qualifies.
        const ready = job.mode === 'full' && openHolds === 0 && job.scanCompleted === true;
        const result = { openHolds, holdCounts, sourceRows: c.seen || 0, stagedThisRun: c.staged || 0, unchanged: c.unchanged || 0, excluded: (c.excluded || 0) + (c.otherAcademy || 0), removed: c.removed || 0,
            ready, evidence: ready ? hash([job.runId, c, job.scanStartedAt]) : null };
        return persist(db, lease, () => ({ phase: 'done', status: 'completed', completedAt: Date.now(), result }));
    }
    return job;
}

/** Source page IDs and app markers seen by this run's scan and catch-up. Markers are stored as 'marker:<id>'. */
async function loadSeen(db: any, runId: string, seen: Set<string>) {
    for (const d of (await db.collection('lessonMigrationSeen').where('runId', '==', runId).get()).docs) {
        for (const id of d.data().ids || []) seen.add(id);
        for (const m of d.data().markers || []) seen.add('marker:' + m);
    }
}

/**
 * Run bounded batches until the time budget or a stop condition. Safe to call from the admin page,
 * a cron request, or both: a transactional lease admits one runner; others return immediately.
 */
export async function runLessonMigration(db: any, actor: any, deps: { notion?: any, budgetMs?: number, pathsReady?: boolean } = {}) {
    if (!actor?.system) assertAdmin(actor);
    const notion = deps.notion || gradeNotion, limit = deps.budgetMs ?? budget(), started = Date.now(), lease = randomUUID();
    const job = await db.runTransaction(async (tx: any) => {
        const old = (await tx.get(jobRef(db))).data();
        if (!old || !RUNNABLE.includes(old.status) || (old.nextRunAt || 0) > Date.now() || old.leaseUntil > Date.now()) return { idle: true, ...old };
        const next = { ...old, status: 'running', leaseOwner: lease, leaseUntil: Date.now() + limit + 60000, lastRunAt: Date.now() };
        tx.set(jobRef(db), next); return next;
    });
    if (job.idle) return publicJob(job, true);
    let current = job;
    try {
        const ctx = await migrationContext(db, current);
        const seen = new Set<string>();
        if (current.phase === 'app-check') await loadSeen(db, current.runId, seen);
        // At least one batch per invocation so a short platform time limit still makes progress.
        while (current.phase !== 'done') {
            const before = current.phase;
            current = await runBatch(db, notion, ctx, current, lease, seen);
            if (current.status === 'paused') break;
            if (before === 'catchup' && current.phase === 'app-check') await loadSeen(db, current.runId, seen);
            current = await persist(db, lease, () => ({ leaseUntil: Date.now() + limit + 60000, attempts: 0, lastError: null }));
            if (current.status === 'paused' || Date.now() - started >= limit) break;
        }
        current = await persist(db, lease, () => ({ leaseOwner: null, leaseUntil: 0 }));
        if (current.phase === 'done' && current.activateOnReady && current.result?.ready) current = await activateAfterRun(db, current, deps.pathsReady);
        return publicJob(current);
    } catch (error: any) {
        const code = error?.message || 'LESSON_MIGRATION_FAILED', transient = transientMigrationError(error);
        const saved = await db.runTransaction(async (tx: any) => {
            const old = (await tx.get(jobRef(db))).data();
            if (old?.leaseOwner !== lease) return old;
            const attempts = (old.attempts || 0) + 1;
            const next = { ...old, leaseOwner: null, leaseUntil: 0, attempts, lastError: code, updatedAt: Date.now(),
                status: old.status === 'paused' ? 'paused' : transient && attempts < MAX_ATTEMPTS ? 'waiting' : 'blocked',
                nextRunAt: transient ? Date.now() + migrationBackoff(attempts) : 0 };
            tx.set(jobRef(db), next); return next;
        }).catch(() => null);
        return publicJob(saved || current);
    }
}

/** The admin confirmed cutover before the final run; the switch is set only if it ended ready. */
async function activateAfterRun(db: any, job: any, pathsReady?: boolean) {
    const { activateLessonApp } = await import('./lessonAuthority.js');
    let activation: any;
    try { activation = { active: true, ...(await activateLessonApp(db, { system: true }, { confirmed: true }, pathsReady)) }; }
    catch (error: any) { activation = { active: false, error: error?.message || 'LESSON_ACTIVATION_FAILED' }; }
    return db.runTransaction(async (tx: any) => {
        const current = (await tx.get(jobRef(db))).data();
        if (current?.runId !== job.runId) return current;
        const next = { ...current, activateOnReady: false, result: { ...current.result, activation } };
        tx.set(jobRef(db), next); return next;
    });
}

function publicJob(job: any, idle = false) {
    if (!job) return { status: 'none' };
    const { leaseOwner, ...rest } = job;
    return { ...rest, busy: Boolean(job.leaseUntil > Date.now()), ...(idle ? { idle: true } : {}) };
}

export async function startLessonMigration(db: any, actor: any, input: { confirmed?: unknown, mode?: unknown, activate?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true || !['dry-run', 'full', 'recheck', 'final'].includes(input.mode as string)) throw Error('INVALID_INPUT');
    // After cutover the app is authoritative: re-importing Notion would overwrite newer app history.
    const { lessonAppActive } = await import('./lessonAuthority.js');
    if (await lessonAppActive(db, actor)) throw Error('LESSON_APP_ACTIVE');
    // 'final' is a full run whose result may switch the app on by itself (when requested).
    const final = input.mode === 'final', mode = final ? 'full' : input.mode as string;
    const finalFlags = final ? { final: true, activateOnReady: input.activate === true, activationRequestedBy: input.activate === true ? actor.uid : null } : {};
    const ctx = await migrationContext(db, { startedBy: actor.uid });
    const databases = [...ctx.byDb.keys()];
    if (!databases.length) throw Error('NOTION_SOURCE_NOT_CONFIGURED');
    return publicJob(await db.runTransaction(async (tx: any) => {
        const old = (await tx.get(jobRef(db))).data(), now = Date.now();
        if (old?.leaseUntil > now) throw Error('PUBLISH_IN_PROGRESS');
        // An unfinished run resumes from its saved position; a different mode never silently replaces a live run.
        const unfinished = old && ['running', 'waiting', 'paused', 'blocked'].includes(old.status);
        if (unfinished && (old.mode === mode || mode === 'recheck' && old.mode === 'full')) {
            const next = { ...old, ...finalFlags, status: 'running', attempts: 0, nextRunAt: 0, lastError: null, resumedAt: now, resumedBy: actor.uid };
            tx.set(jobRef(db), next); return next;
        }
        if (unfinished && RUNNABLE.includes(old.status)) throw Error('LESSON_MIGRATION_RUNNING');
        if (mode === 'recheck' && old?.mode !== 'full') throw Error('LESSON_MIGRATION_REQUIRED');
        if (old) tx.set(db.collection('lessonMigrationRuns').doc(old.runId), { ...old, archivedAt: now });
        const runId = randomUUID();
        const next = { runId, mode: mode === 'recheck' ? 'full' : mode, status: 'running', phase: mode === 'recheck' ? 'recheck' : 'scan', databases,
            dbIndex: 0, cursor: null, scanCompleted: false, catchupIndex: 0, catchupCursor: null, appCursor: null, recheckCursor: null, counts: {}, steps: 0,
            scanStartedAt: now, startedAt: now, startedBy: actor.uid, attempts: 0, nextRunAt: 0, leaseOwner: null, leaseUntil: 0, lastError: null, result: null, final: false, activateOnReady: false, ...finalFlags };
        tx.set(jobRef(db), next); return next;
    }));
}

export async function pauseLessonMigration(db: any, actor: any) {
    assertAdmin(actor);
    return publicJob(await db.runTransaction(async (tx: any) => {
        const old = (await tx.get(jobRef(db))).data();
        if (!old || !RUNNABLE.includes(old.status) && old.status !== 'blocked') return old;
        const next = { ...old, status: 'paused', pausedAt: Date.now(), pausedBy: actor.uid }; tx.set(jobRef(db), next); return next;
    }));
}

export async function lessonMigrationStatus(db: any, actor: any) {
    assertAdmin(actor);
    const [job, open] = await Promise.all([jobRef(db).get(), db.collection('lessonMigrationHolds').where('status', '==', 'open').limit(501).get()]);
    const groups: Record<string, { count: number, acknowledgeable: boolean, decided: number }> = {};
    for (const d of open.docs) {
        const h = d.data(), g = groups[h.code] ||= { count: 0, acknowledgeable: Boolean(ACKNOWLEDGEABLE[h.code]), decided: 0 };
        g.count++; if (h.recheckRequested) g.decided++;
    }
    const holds = open.docs.slice(0, 50).map((d: any) => { const h = d.data(); return { sourceKey: h.sourceKey, kind: h.kind, code: h.code, sourceId: h.sourceId || null, recordId: h.recordId || null, studentKey: h.studentKey, date: h.date, ownerUid: h.ownerUid, acknowledgeable: Boolean(ACKNOWLEDGEABLE[h.code] && h.version), decided: Boolean(h.recheckRequested), updatedAt: h.updatedAt }; });
    return { job: publicJob(job.data()), holds, holdGroups: groups, openHolds: Math.min(open.docs.length, 500), moreHolds: open.docs.length > 50, cronConfigured: Boolean(process.env.CRON_SECRET) };
}

/** Record an admin decision. Acknowledgement is bound to the exact source version that was reviewed. */
export async function decideLessonMigrationHold(db: any, actor: any, input: { sourceKey?: unknown, decision?: unknown, confirmed?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true || typeof input.sourceKey !== 'string' || !/^[a-f0-9]{64}$/.test(input.sourceKey) || !['acknowledge', 'recheck'].includes(input.decision as string)) throw Error('INVALID_INPUT');
    const ref = db.collection('lessonMigrationHolds').doc(input.sourceKey);
    return db.runTransaction(async (tx: any) => {
        const hold = (await tx.get(ref)).data();
        if (!hold || hold.status !== 'open') throw Error('DRAFT_CONFLICT');
        const now = Date.now();
        if (input.decision === 'acknowledge') {
            if (!ACKNOWLEDGEABLE[hold.code] || !hold.version) throw Error('FORBIDDEN');
            tx.set(ref, { ...hold, acknowledged: { ...hold.acknowledged, [hold.code]: hold.version }, recheckRequested: true, decisions: [...(hold.decisions || []), { code: hold.code, version: hold.version, decision: 'acknowledge', by: actor.uid, at: now }], updatedAt: now });
        } else tx.set(ref, { ...hold, recheckRequested: true, updatedAt: now });
        return { sourceKey: input.sourceKey, decision: input.decision, effect: input.decision === 'acknowledge' ? ACKNOWLEDGEABLE[hold.code] : 'recheck' };
    });
}

/** Accept every open hold of one acceptable type at once (each bound to the version that was shown). */
export async function acknowledgeLessonMigrationHoldGroup(db: any, actor: any, input: { code?: unknown, confirmed?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true || typeof input.code !== 'string' || !ACKNOWLEDGEABLE[input.code]) throw Error('INVALID_INPUT');
    const open = await db.collection('lessonMigrationHolds').where('status', '==', 'open').limit(5001).get();
    if (open.docs.length > 5000) throw Error('LESSON_MIGRATION_LIMIT');
    const targets = open.docs.filter((d: any) => d.data().code === input.code && d.data().version);
    let acknowledged = 0;
    for (let i = 0; i < targets.length; i += 100) acknowledged += await db.runTransaction(async (tx: any) => {
        let n = 0; const now = Date.now();
        const rows = await Promise.all(targets.slice(i, i + 100).map((d: any) => tx.get(d.ref)));
        for (const row of rows) {
            const hold = row.data();
            // Skip anything that changed since it was listed.
            if (!hold || hold.status !== 'open' || hold.code !== input.code || !hold.version) continue;
            tx.set(row.ref, { ...hold, acknowledged: { ...hold.acknowledged, [hold.code]: hold.version }, recheckRequested: true, decisions: [...(hold.decisions || []), { code: hold.code, version: hold.version, decision: 'acknowledge', by: actor.uid, at: now, group: true }], updatedAt: now });
            n++;
        }
        return n;
    });
    return { code: input.code, acknowledged, effect: ACKNOWLEDGEABLE[input.code] };
}

/** Cron entry: one Firestore read when idle; otherwise a normal bounded run. */
export async function runLessonMigrationCron(db: any, deps: { notion?: any, budgetMs?: number, pathsReady?: boolean } = {}) {
    const job = (await jobRef(db).get()).data();
    if (!job || !RUNNABLE.includes(job.status) || (job.nextRunAt || 0) > Date.now()) return { idle: true, status: job?.status || 'none' };
    return runLessonMigration(db, { system: true, uid: job.startedBy, academyId: 'main' }, deps);
}
