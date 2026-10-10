/*
 * Lesson app-only switch. It was turned on once after a verified full migration from Notion; the
 * migration and the on/off controls are gone, and the switch is read only to confirm app mode.
 */
const authorityRef = (db: any) => db.collection('lessonAppAuthority').doc('main');

/** True only with an active switch backed by its matching verification record. */
export async function lessonAppActive(db: any, actor: any) {
    if ((actor?.academyId || 'main') !== 'main') return false;
    const mode = (await authorityRef(db).get()).data();
    if (!mode?.active || !mode.verifiedRunId || mode.schemaVersion !== 1) return false;
    const proof = (await db.collection('lessonVerificationRuns').doc(mode.verifiedRunId).get()).data();
    return Boolean(proof?.verified && proof.academyId === 'main' && proof.hash === mode.verificationHash);
}
