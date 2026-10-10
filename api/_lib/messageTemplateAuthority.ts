/*
 * Message template app-only switch. It was turned on once after the template import from Notion; the import
 * and the on/off controls are gone, and the switch is read only to confirm app mode.
 */
const authorityRef = (db: any) => db.collection('messageTemplateAuthority').doc('main');

export async function templateAppActive(db: any) {
    const mode = (await authorityRef(db).get()).data();
    if (!mode?.active || !mode.verifiedRunId || mode.schemaVersion !== 1) return false;
    const proof = (await db.collection('messageTemplateVerificationRuns').doc(mode.verifiedRunId).get()).data();
    return Boolean(proof?.verified && proof.hash === mode.verificationHash);
}
