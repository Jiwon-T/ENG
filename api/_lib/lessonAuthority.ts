import { randomUUID } from 'node:crypto';
import { lessonWriteInFlight } from './lessonMigration.js';

/*
 * Lesson app-only switch. Activation requires a fresh, complete full migration run with zero open
 * holds and no in-flight app writes, verified inside one transaction. Deactivation keeps all app data.
 */
// App read/write paths for lessons are wired in workspace.ts (appLessonSource + appLesson). Set false to lock cutover again.
export const LESSON_APP_PATHS_READY = true;
export const LESSON_FINAL_CHECK_FRESH_MS = 15 * 60 * 1000;
const PENDING_STAGES = ['publishing', 'processing', 'notion_saved', 'report_published_notion_pending'];
const authorityRef = (db: any) => db.collection('lessonAppAuthority').doc('main');
const jobRef = (db: any) => db.collection('lessonMigrationJobs').doc('main');
function assertAdmin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }

/** True only with an active switch backed by its matching verification record. */
export async function lessonAppActive(db: any, actor: any) {
    if ((actor?.academyId || 'main') !== 'main') return false;
    const mode = (await authorityRef(db).get()).data();
    if (!mode?.active || !mode.verifiedRunId || mode.schemaVersion !== 1) return false;
    const proof = (await db.collection('lessonVerificationRuns').doc(mode.verifiedRunId).get()).data();
    return Boolean(proof?.verified && proof.academyId === 'main' && proof.hash === mode.verificationHash);
}

function finalCheck(job: any, now: number) {
    const r = job?.result;
    if (job?.status !== 'completed' || job.mode !== 'full' || !job.scanCompleted || !r?.ready || !r.evidence) return 'LESSON_FINAL_CHECK_REQUIRED';
    if (now - (job.completedAt || 0) > LESSON_FINAL_CHECK_FRESH_MS) return 'LESSON_FINAL_CHECK_REQUIRED';
    return null;
}

/** Checklist for the admin screen. Firestore reads only; never calls Notion. */
export async function lessonCutoverStatus(db: any, actor: any, pathsReady = LESSON_APP_PATHS_READY) {
    assertAdmin(actor);
    const now = Date.now();
    const [authority, job, core, open, pending] = await Promise.all([authorityRef(db).get(), jobRef(db).get(), db.collection('academyCoreAuthority').doc('main').get(),
        db.collection('lessonMigrationHolds').where('status', '==', 'open').limit(1).get(), db.collection('teacherLessonDrafts').where('stage', 'in', PENDING_STAGES).limit(200).get()]);
    const j = job.data(), r = j?.result;
    const inFlight = pending.docs.filter((d: any) => !d.data().archived && lessonWriteInFlight(d.data(), now)).length;
    const migrated = j?.mode === 'full' && j.status === 'completed' && Boolean(r?.ready);
    const items = [
        { key: 'core', ok: Boolean(core.data()?.active) },
        { key: 'migration', ok: migrated, completedAt: migrated ? j.completedAt : null, fresh: migrated && now - j.completedAt <= LESSON_FINAL_CHECK_FRESH_MS },
        { key: 'holds', ok: open.docs.length === 0 },
        { key: 'inFlight', ok: inFlight === 0, count: inFlight },
        { key: 'paths', ok: pathsReady },
    ];
    const a = authority.data();
    return { active: await lessonAppActive(db, actor), activatedAt: a?.active ? a.activatedAt : null, deactivatedAt: a?.deactivatedAt || null, items,
        canActivate: items.every(i => i.ok) && !a?.active, pathsReady };
}

/** One transaction re-verifies every condition, then writes the switch with its evidence record. */
export async function activateLessonApp(db: any, actor: any, input: { confirmed?: unknown }, pathsReady = LESSON_APP_PATHS_READY) {
    if (!actor?.system) assertAdmin(actor);
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    if (!pathsReady) throw Error('LESSON_APP_PATHS_NOT_READY');
    return db.runTransaction(async (tx: any) => {
        const now = Date.now();
        const authority = (await tx.get(authorityRef(db))).data(), job = (await tx.get(jobRef(db))).data();
        const core = (await tx.get(db.collection('academyCoreAuthority').doc('main'))).data();
        const open = await tx.get(db.collection('lessonMigrationHolds').where('status', '==', 'open').limit(1));
        const pending = await tx.get(db.collection('teacherLessonDrafts').where('stage', 'in', PENDING_STAGES).limit(200));
        if (authority?.active) return { active: true, alreadyActive: true };
        const stale = finalCheck(job, now); if (stale) throw Error(stale);
        if (!core?.active) throw Error('CORE_NOT_READY');
        if (open.docs.length) throw Error('LESSON_MIGRATION_NOT_READY');
        if (pending.docs.some((d: any) => !d.data().archived && lessonWriteInFlight(d.data(), now))) throw Error('PUBLISH_IN_PROGRESS');
        const by = actor.system ? job.activationRequestedBy : actor.uid;
        tx.set(db.collection('lessonVerificationRuns').doc(job.runId), { verified: true, academyId: 'main', hash: job.result.evidence, counts: job.counts || {}, result: job.result, completedAt: job.completedAt, at: now, by });
        const next = { active: true, schemaVersion: 1, verifiedRunId: job.runId, verificationHash: job.result.evidence, activatedAt: now, activatedBy: by, deactivatedAt: null };
        tx.set(authorityRef(db), next);
        tx.set(db.collection('lessonAuthorityHistory').doc(now + ':' + randomUUID()), { before: authority || null, after: next, by, at: now, reason: 'activate' });
        return { active: true, activatedAt: now };
    });
}

/** Return to the previous read/write paths. App lessons, staged history and public reports stay as they are. */
export async function deactivateLessonApp(db: any, actor: any, input: { confirmed?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(authorityRef(db))).data(), now = Date.now();
        if (!old?.active) return { active: false, alreadyInactive: true };
        const next = { ...old, active: false, deactivatedAt: now, deactivatedBy: actor.uid };
        tx.set(authorityRef(db), next);
        tx.set(db.collection('lessonAuthorityHistory').doc(now + ':' + randomUUID()), { before: old, after: next, by: actor.uid, at: now, reason: 'deactivate' });
        return { active: false, deactivatedAt: now };
    });
}

/**
 * The single cutover button: activate at once when a fresh verified run exists; otherwise start the
 * final verification run, which activates by itself when it ends ready.
 */
export async function requestLessonCutover(db: any, actor: any, input: { confirmed?: unknown }, pathsReady = LESSON_APP_PATHS_READY) {
    assertAdmin(actor);
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    if (!pathsReady) throw Error('LESSON_APP_PATHS_NOT_READY');
    try { return { ...(await activateLessonApp(db, actor, input, pathsReady)), started: false }; }
    catch (error: any) {
        if (error?.message !== 'LESSON_FINAL_CHECK_REQUIRED') throw error;
        const { startLessonMigration } = await import('./lessonMigration.js');
        return { active: false, started: true, job: await startLessonMigration(db, actor, { confirmed: true, mode: 'final', activate: true }) };
    }
}
