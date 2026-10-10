import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { academicAppActive } from '../api/_lib/academicAuthority.js';

function active() {
    const f = templateFirestore();
    f.rows.set('academyCoreAuthority/main', { active: true });
    f.rows.set('academicVerificationRuns/run-1', { verified: true, hash: 'verified' });
    f.rows.set('academicAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'run-1', verificationHash: 'verified' });
    return f;
}

test('the grade switch counts only with its verification record', async () => {
    const f = active();
    assert.equal(await academicAppActive(f.db), true);
    f.rows.set('academicAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'forged', verificationHash: 'x' });
    assert.equal(await academicAppActive(f.db), false);
});


