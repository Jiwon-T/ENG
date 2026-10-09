import { randomUUID } from 'node:crypto';

/*
 * Grade app-only switch. Grades are already written in the app; this stops Notion grade edits (Make webhook,
 * migration/conflict tools) from flowing into the app. Activation needs the core switch, a fresh completed
 * full pass of the past-grade migration and no in-flight grade write, verified in one transaction.
 */
export const ACADEMIC_FINAL_CHECK_FRESH_MS = 15 * 60 * 1000;
const authorityRef = (db: any) => db.collection('academicAppAuthority').doc('main');
const IN_FLIGHT_STAGES = ['publishing', 'processing', 'notion_saved'];
function assertAdmin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
function inFlight(d: any, now: number) {
    return !d.archived && (d.notionWrite?.leaseUntil > now || d.deleteLeaseUntil > now || IN_FLIGHT_STAGES.includes(d.stage) && now - (d.publishStartedAt || d.updatedAt || 0) < 180000 || d.notionWrite?.attempted && !d.notionWrite?.done && !d.notionPageId && !d.notionWrite?.pageId);
}

export async function academicAppActive(db: any) {
    const mode = (await authorityRef(db).get()).data();
    if (!mode?.active || !mode.verifiedRunId || mode.schemaVersion !== 1) return false;
    const proof = (await db.collection('academicVerificationRuns').doc(mode.verifiedRunId).get()).data();
    return Boolean(proof?.verified && proof.hash === mode.verificationHash);
}

function evaluate(core: any, progress: any, drafts: any[], now: number) {
    const flying = drafts.filter(d => inFlight(d, now)).length;
    const items = [
        { key: 'core', ok: Boolean(core?.active) },
        { key: 'migration', ok: Boolean(progress?.done && !progress.error) },
        { key: 'fresh', ok: Boolean(progress?.done && progress.lastSuccessAt && now - progress.lastSuccessAt <= ACADEMIC_FINAL_CHECK_FRESH_MS) },
        { key: 'inFlight', ok: flying === 0, count: flying },
        { key: 'idle', ok: !(progress?.leaseUntil > now) },
    ];
    return { items, ready: items.every(i => i.ok) };
}

export async function academicCutoverStatus(db: any, actor: any) {
    assertAdmin(actor);
    const { academicProgressRef } = await import('./academicMigration.js');
    const [core, progress, drafts] = await Promise.all([db.collection('academyCoreAuthority').doc('main').get(), academicProgressRef(db).get(), db.collection('teacherAcademicDrafts').where('stage', 'in', [...IN_FLIGHT_STAGES, 'failed']).limit(501).get()]);
    const result = evaluate(core.data(), progress.data(), drafts.docs.map((d: any) => d.data()), Date.now());
    const a = (await authorityRef(db).get()).data();
    return { active: await academicAppActive(db), activatedAt: a?.active ? a.activatedAt : null, ...result };
}

export async function activateAcademicApp(db: any, actor: any, input: { confirmed?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    const { academicProgressRef } = await import('./academicMigration.js');
    return db.runTransaction(async (tx: any) => {
        const now = Date.now(), authority = (await tx.get(authorityRef(db))).data();
        const core = (await tx.get(db.collection('academyCoreAuthority').doc('main'))).data(), progress = (await tx.get(academicProgressRef(db))).data();
        const drafts = await tx.get(db.collection('teacherAcademicDrafts').where('stage', 'in', [...IN_FLIGHT_STAGES, 'failed']).limit(501));
        if (authority?.active) return { active: true, alreadyActive: true };
        const check = evaluate(core, progress, drafts.docs.map((d: any) => d.data()), now);
        if (!check.ready) {
            const failed = check.items.find(i => !i.ok)!.key;
            throw Error(failed === 'core' ? 'CORE_NOT_READY' : failed === 'inFlight' || failed === 'idle' ? 'PUBLISH_IN_PROGRESS' : 'ACADEMIC_FINAL_CHECK_REQUIRED');
        }
        const runId = randomUUID(), hash = `${progress.startedAt}:${progress.lastSuccessAt}:${progress.total}`;
        tx.set(db.collection('academicVerificationRuns').doc(runId), { verified: true, hash, total: progress.total || 0, startedAt: progress.startedAt, lastSuccessAt: progress.lastSuccessAt, at: now, by: actor.uid });
        const next = { active: true, schemaVersion: 1, verifiedRunId: runId, verificationHash: hash, activatedAt: now, activatedBy: actor.uid };
        tx.set(authorityRef(db), next);
        tx.set(db.collection('academicAuthorityHistory').doc(now + ':' + runId), { before: authority || null, after: next, by: actor.uid, at: now, reason: 'activate' });
        return { active: true, activatedAt: now };
    });
}

/** Back to the previous mode; app grades and public grade records stay as they are. */
export async function deactivateAcademicApp(db: any, actor: any, input: { confirmed?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(authorityRef(db))).data(), now = Date.now();
        if (!old?.active) return { active: false, alreadyInactive: true };
        const next = { ...old, active: false, deactivatedAt: now, deactivatedBy: actor.uid };
        tx.set(authorityRef(db), next);
        tx.set(db.collection('academicAuthorityHistory').doc(now + ':' + randomUUID()), { before: old, after: next, by: actor.uid, at: now, reason: 'deactivate' });
        return { active: false, deactivatedAt: now };
    });
}
