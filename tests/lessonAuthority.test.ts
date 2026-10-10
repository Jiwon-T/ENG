import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonAppActive } from '../api/_lib/lessonAuthority.js';
import { admin, fixture } from './helpers/lessonAppFixture.js';

test('the switch counts only with its verification record, and only for the main academy', async () => {
    const f = fixture([]);
    assert.equal(await lessonAppActive(f.db, admin), true);
    f.rows.set('lessonAppAuthority/main', { active: true, schemaVersion: 1, verifiedRunId: 'forged', verificationHash: 'x' });
    assert.equal(await lessonAppActive(f.db, admin), false);
    f.rows.set('lessonVerificationRuns/forged', { verified: true, academyId: 'main', hash: 'other' });
    assert.equal(await lessonAppActive(f.db, admin), false);
    assert.equal(await lessonAppActive(f.db, { ...admin, academyId: 'other' }), false);
});
