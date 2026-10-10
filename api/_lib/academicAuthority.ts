/*
 * Grade app-only switch. It was turned on once after the past-grade migration from Notion; the migration
 * and the on/off controls are gone, and the switch is read only to confirm app mode.
 */
const authorityRef = (db: any) => db.collection('academicAppAuthority').doc('main');

export async function academicAppActive(db: any) {
    const mode = (await authorityRef(db).get()).data();
    if (!mode?.active || !mode.verifiedRunId || mode.schemaVersion !== 1) return false;
    const proof = (await db.collection('academicVerificationRuns').doc(mode.verifiedRunId).get()).data();
    return Boolean(proof?.verified && proof.hash === mode.verificationHash);
}
