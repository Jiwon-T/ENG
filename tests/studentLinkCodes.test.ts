import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { createLinkCode, redeemLinkCode, normalizeCode } from '../api/_lib/studentLinkCodes.js';
const K = '11111111-1111-4111-8111-111111111111';
const admin = { uid: 'admin', admin: true, academyId: 'main' };
function seed() {
    const f = templateFirestore();
    f.rows.set(`academyStudentMemberships/${K}`, { academyId: 'main', disabled: false });
    f.rows.set('users/kid', { role: 'student' }); f.rows.set('users/teach', { role: 'teacher' }); f.rows.set('users/linked', { role: 'student', notionStudentKey: K });
    return f;
}
test('link codes: admin makes a one-time code; a new code replaces the old one; only a hash is stored', async () => {
    const f = seed();
    const first = await createLinkCode(f.db, admin, { studentKey: K }, 1000);
    assert.match(first.code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('studentLinkCodes/')).length, 1);
    assert.equal(JSON.stringify([...f.rows.values()]).includes(normalizeCode(first.code)), false, 'plain code never stored');
    await createLinkCode(f.db, admin, { studentKey: K }, 2000);
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('studentLinkCodes/')).length, 1, 'old code removed');
    await assert.rejects(redeemLinkCode(f.db, 'kid', { code: first.code }, 3000), /LINK_CODE_INVALID/);
    await assert.rejects(createLinkCode(f.db, { uid: 'p', principal: true, admin: false, academyId: 'main' }, { studentKey: K }), /FORBIDDEN/);
    await assert.rejects(createLinkCode(f.db, admin, { studentKey: '22222222-2222-4222-8222-222222222222' }), /STUDENT_NOT_FOUND/);
});
test('link codes: teachers, linked accounts, expired codes and guessing are refused', async () => {
    const f = seed();
    const { code } = await createLinkCode(f.db, admin, { studentKey: K }, 1000);
    await assert.rejects(redeemLinkCode(f.db, 'teach', { code }, 2000), /LINK_CODE_NOT_STUDENT/);
    await assert.rejects(redeemLinkCode(f.db, 'linked', { code }, 2000), /LINK_CODE_ALREADY_LINKED/);
    await assert.rejects(redeemLinkCode(f.db, 'kid', { code }, 1000 + 15 * 86_400_000), /LINK_CODE_EXPIRED/);
    const g = seed();
    for (let i = 0; i < 8; i++) await assert.rejects(redeemLinkCode(g.db, 'kid', { code: 'AAAA-AAAA' }, 5000), /LINK_CODE_INVALID/);
    await assert.rejects(redeemLinkCode(g.db, 'kid', { code: 'AAAA-AAAA' }, 5000), /LINK_CODE_TOO_MANY/);
    await assert.rejects(redeemLinkCode(g.db, 'kid', { code: 'AAAA-AAAA' }, 5000 + 3_700_000), /LINK_CODE_INVALID/, 'window resets after an hour');
});
