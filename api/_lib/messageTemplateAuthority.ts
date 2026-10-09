import { createHash, randomUUID } from 'node:crypto';

/*
 * Message template app-only switch (replaces the MESSAGE_TEMPLATE_READ_MODE env switch as the normal path).
 * Activation needs a fresh complete import + catch-up and a fresh full source check, zero conflicts and
 * zero undetermined source access, verified in one transaction with an evidence record.
 */
const SOURCE_COLLECTION = 'messageTemplateSources', STATE = 'messageTemplateSync', JOBS = 'messageTemplateJobs';
export const TEMPLATE_FINAL_FRESH_MS = 15 * 60 * 1000;
const authorityRef = (db: any) => db.collection('messageTemplateAuthority').doc('main');
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function assertAdmin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }

export async function templateAppActive(db: any) {
    const mode = (await authorityRef(db).get()).data();
    if (!mode?.active || !mode.verifiedRunId || mode.schemaVersion !== 1) return false;
    const proof = (await db.collection('messageTemplateVerificationRuns').doc(mode.verifiedRunId).get()).data();
    return Boolean(proof?.verified && proof.hash === mode.verificationHash);
}

function evaluate(state: any, rows: any[], sourceKey: string, now: number) {
    const own = rows.filter(r => r.sourceKey === sourceKey);
    const items = [
        { key: 'imported', ok: Boolean(state?.ready) },
        { key: 'freshPull', ok: Boolean(state?.ready && state.lastSuccessAt && now - state.lastSuccessAt <= TEMPLATE_FINAL_FRESH_MS && !state.cursor) },
        { key: 'freshCheck', ok: Boolean(state?.lastReconcileAt && now - state.lastReconcileAt <= TEMPLATE_FINAL_FRESH_MS && !state.reconcileCursor) },
        { key: 'conflicts', ok: !own.some(r => r.status === 'conflict'), count: own.filter(r => r.status === 'conflict').length },
        { key: 'sourceAccess', ok: !own.some(r => r.sourceWarning), count: own.filter(r => r.sourceWarning).length },
        { key: 'idle', ok: !(state?.pullOwnerUntil > now || state?.reconcileOwnerUntil > now) },
    ];
    return { items, ready: items.every(i => i.ok), own };
}

async function sourceKey() { const { TEMPLATE_SOURCE } = await import('./messageTemplateStore.js'); return TEMPLATE_SOURCE; }

/** Checklist for the template screen (Firestore only, bounded by the existing 500-template ceiling). */
export async function templateCutoverStatus(db: any, actor: any) {
    assertAdmin(actor);
    const key = await sourceKey();
    const [state, rows] = await Promise.all([db.collection(STATE).doc(key).get(), db.collection(SOURCE_COLLECTION).where('sourceKey', '==', key).limit(501).get()]);
    if (rows.docs.length > 500) throw Error('TEMPLATE_PAGE_LIMIT');
    const result = evaluate(state.data(), rows.docs.map((d: any) => d.data()), key, Date.now());
    const a = (await authorityRef(db).get()).data();
    return { active: await templateAppActive(db), activatedAt: a?.active ? a.activatedAt : null, items: result.items, ready: result.ready };
}

/**
 * Re-verifies everything in one transaction. Edits still waiting for a Notion copy become app-saved
 * (the app value is already authoritative) and their queued Notion jobs are retired.
 */
export async function activateTemplateApp(db: any, actor: any, input: { confirmed?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    const key = await sourceKey();
    return db.runTransaction(async (tx: any) => {
        const now = Date.now(), authority = (await tx.get(authorityRef(db))).data();
        const state = (await tx.get(db.collection(STATE).doc(key))).data();
        const snap = await tx.get(db.collection(SOURCE_COLLECTION).where('sourceKey', '==', key).limit(501));
        if (authority?.active) return { active: true, alreadyActive: true };
        if (snap.docs.length > 500) throw Error('TEMPLATE_PAGE_LIMIT');
        const rows = snap.docs.map((d: any) => ({ ref: d.ref, data: d.data() }));
        const check = evaluate(state, rows.map((r: any) => r.data), key, now);
        if (!check.ready) {
            const failed = check.items.find(i => !i.ok)!.key;
            throw Error(failed === 'imported' ? 'TEMPLATE_STORE_NOT_READY' : failed === 'conflicts' ? 'TEMPLATE_CONFLICTS_REMAIN' : failed === 'sourceAccess' ? 'TEMPLATE_SOURCE_UNKNOWN' : failed === 'idle' ? 'TEMPLATE_BUSY' : 'TEMPLATE_FINAL_CHECK_REQUIRED');
        }
        const waiting = rows.filter((r: any) => ['pending', 'failed'].includes(r.data.status));
        if (waiting.length > 200) throw Error('TEMPLATE_CUTOVER_LIMIT');
        const jobs = await Promise.all(waiting.map((r: any) => r.data.pendingJobId ? tx.get(db.collection(JOBS).doc(r.data.pendingJobId)) : Promise.resolve(null)));
        if (jobs.some((j: any) => j?.exists && j.data().leaseUntil > now)) throw Error('TEMPLATE_BUSY');
        const runId = randomUUID(), evidence = hash([runId, state.lastSuccessAt, state.lastReconcileAt, rows.map((r: any) => [r.data.notionPageId, r.data.revision, r.data.dataHash]).sort()]);
        waiting.forEach((r: any, i: number) => {
            tx.set(r.ref, { ...r.data, status: 'app', pendingJobId: null, error: null, updatedAt: now });
            const job = jobs[i];
            if (job?.exists) tx.set(job.ref, { ...job.data(), status: 'not-needed', leaseOwner: null, leaseUntil: 0, finishedAt: now });
        });
        tx.set(db.collection('messageTemplateVerificationRuns').doc(runId), { verified: true, hash: evidence, templates: rows.length, convertedWaiting: waiting.length, lastSuccessAt: state.lastSuccessAt, lastReconcileAt: state.lastReconcileAt, at: now, by: actor.uid });
        const next = { active: true, schemaVersion: 1, verifiedRunId: runId, verificationHash: evidence, activatedAt: now, activatedBy: actor.uid };
        tx.set(authorityRef(db), next);
        tx.set(db.collection('messageTemplateAuthorityHistory').doc(now + ':' + runId), { before: authority || null, after: next, by: actor.uid, at: now, reason: 'activate' });
        return { active: true, activatedAt: now, convertedWaiting: waiting.length };
    });
}

/** Back to the previous mode (env-controlled reads, Notion sync). App template values are kept. */
export async function deactivateTemplateApp(db: any, actor: any, input: { confirmed?: unknown }) {
    assertAdmin(actor);
    if (input.confirmed !== true) throw Error('INVALID_INPUT');
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(authorityRef(db))).data(), now = Date.now();
        if (!old?.active) return { active: false, alreadyInactive: true };
        const next = { ...old, active: false, deactivatedAt: now, deactivatedBy: actor.uid };
        tx.set(authorityRef(db), next);
        tx.set(db.collection('messageTemplateAuthorityHistory').doc(now + ':' + randomUUID()), { before: old, after: next, by: actor.uid, at: now, reason: 'deactivate' });
        return { active: false, deactivatedAt: now };
    });
}
