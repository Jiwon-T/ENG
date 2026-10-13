import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { listAppUsers, setAppUserRole, removeAppUser, listRemovedUsers, setRemovedSignIn, setAppUserName } from '../api/_lib/appUsers.js';
import { readAdminHistory } from '../api/_lib/adminHistory.js';
import { hashStudentKey } from '../api/_lib/security.js';

const admin = { uid: 'admin', admin: true, academyId: 'main' };
function seed() {
    process.env.ADMIN_UID = 'admin';
    const f = templateFirestore();
    f.rows.set('users/admin', { name: '관리자', email: 'a@x.kr', role: 'teacher' });
    f.rows.set('users/new', { name: '새선생', email: 'n@x.kr', role: 'student' });
    f.rows.set('users/kid', { name: '학생', email: 'k@x.kr', role: 'student', notionStudentKey: 'sk' });
    return f;
}

test('app users: admin lists accounts, newest sign-up first', async () => {
    const f = seed();
    f.rows.get('users/admin').createdAt = { seconds: Date.parse('2026-01-01T00:00:00Z') / 1000, nanoseconds: 0 };
    f.rows.get('users/new').createdAt = { seconds: Date.parse('2026-10-10T00:00:00Z') / 1000, nanoseconds: 0 };
    f.rows.get('users/kid').createdAt = '2026-05-01T00:00:00.000Z';
    const r = await listAppUsers(f.db, admin);
    assert.equal(r.users.length, 3);
    assert.deepEqual(r.users.map((u: any) => u.uid), ['new', 'kid', 'admin']);
    assert.equal(r.users[0].joinedAt, '2026-10-10T00:00:00.000Z');
    assert.equal(r.users.find((u: any) => u.uid === 'admin').isAdmin, true);
    assert.equal(r.users.find((u: any) => u.uid === 'kid').linkedStudent, true);
    await assert.rejects(listAppUsers(f.db, { uid: 'admin', admin: false, academyId: 'main' }), /FORBIDDEN/);
});

test('app users: granting teacher creates an empty workspace; reverting disconnects but keeps scopes', async () => {
    const f = seed();
    await setAppUserRole(f.db, admin, { uid: 'new', role: 'teacher' });
    assert.equal(f.rows.get('users/new').role, 'teacher');
    const access = f.rows.get('teacherWorkspaceAccess/new');
    assert.deepEqual([access.academyId, access.scopes, access.workspaceRole, access.disabled, access.appTeacherRow], ['main', [], 'teacher', undefined, true]);
    const row = [...f.rows.entries()].find(([, r]) => r?.kind === 'teachers' && r?.pointer?.teacherUid === 'new')?.[1];
    assert.ok(row && row.entityId === access.notionTeacherPageId && row.autoCreated, '명부 줄 is made with 선생님 권한');
    f.rows.set('teacherWorkspaceAccess/new', { ...access, scopes: [{ studentKey: 's1' }] });
    await setAppUserRole(f.db, admin, { uid: 'new', role: 'student' });
    assert.equal(f.rows.get('users/new').role, 'student');
    assert.equal(f.rows.get('teacherWorkspaceAccess/new').disabled, true);
    assert.equal(f.rows.get('teacherWorkspaceAccess/new').scopes.length, 1);
    await setAppUserRole(f.db, admin, { uid: 'new', role: 'teacher' });
    assert.equal(f.rows.get('teacherWorkspaceAccess/new').disabled, false);
    assert.equal(f.rows.get('teacherWorkspaceAccess/new').scopes.length, 1);
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('appUserRoleHistory/')).length >= 2, true);
});

test('app users: refuses linked students, the admin, self, and unknown accounts', async () => {
    const f = seed();
    await assert.rejects(setAppUserRole(f.db, admin, { uid: 'kid', role: 'teacher' }), /APP_USER_LINKED_STUDENT/);
    assert.equal(f.rows.get('users/kid').role, 'student');
    assert.equal(f.rows.has('teacherWorkspaceAccess/kid'), false);
    await assert.rejects(setAppUserRole(f.db, admin, { uid: 'admin', role: 'student' }), /FORBIDDEN/);
    await assert.rejects(setAppUserRole(f.db, { uid: 'other', admin: true, academyId: 'main' }, { uid: 'other', role: 'student' }), /FORBIDDEN/);
    await assert.rejects(setAppUserRole(f.db, admin, { uid: 'ghost', role: 'teacher' }), /APP_USER_NOT_FOUND/);
});

test('app users: 탈퇴 removes a student account record (copy kept); teachers, admin and self are refused', async () => {
    const f = seed();
    f.rows.set('evaluations/new', { note: 'x' });
    await setAppUserRole(f.db, admin, { uid: 'new', role: 'teacher' });
    await assert.rejects(removeAppUser(f.db, admin, { uid: 'new' }), /APP_USER_TEACHER_REMOVE/);
    await setAppUserRole(f.db, admin, { uid: 'new', role: 'student' });
    await removeAppUser(f.db, admin, { uid: 'new' });
    assert.equal(f.rows.has('users/new'), false); assert.equal(f.rows.has('evaluations/new'), false);
    const copy = [...f.rows.entries()].find(([k]) => k.startsWith('appUserRemovals/new:'))?.[1];
    assert.equal(copy.user.email, 'n@x.kr'); assert.deepEqual(copy.evaluation, { note: 'x' });
    await assert.rejects(removeAppUser(f.db, admin, { uid: 'admin' }), /FORBIDDEN/);
    await assert.rejects(removeAppUser(f.db, { uid: 'p', admin: false, academyId: 'main' }, { uid: 'kid' }), /FORBIDDEN/);
    await assert.rejects(removeAppUser(f.db, admin, { uid: 'ghost' }), /APP_USER_NOT_FOUND/);
});

test('app users: 탈퇴 blocks sign-in by default; the admin can allow it again from 탈퇴한 계정', async () => {
    const f = seed(), calls: string[] = [];
    const auth = { updateUser: async (uid: string, v: any) => { calls.push(`${uid}:${v.disabled ? 'off' : 'on'}`); }, revokeRefreshTokens: async (uid: string) => { calls.push(`${uid}:revoke`); } };
    const r = await removeAppUser(f.db, admin, { uid: 'new' }, auth);
    assert.deepEqual([r.removed, r.signInBlocked], [true, true]);
    assert.deepEqual(calls, ['new:off', 'new:revoke']);
    let list = (await listRemovedUsers(f.db, admin)).removed;
    assert.deepEqual(list.map((x: any) => [x.uid, x.email, x.signInBlocked]), [['new', 'n@x.kr', true]]);
    await setRemovedSignIn(f.db, admin, { id: list[0].id, block: false }, auth);
    assert.equal(calls.at(-1), 'new:on');
    list = (await listRemovedUsers(f.db, admin)).removed;
    assert.equal(list[0].signInBlocked, false);
    await assert.rejects(setRemovedSignIn(f.db, { uid: 'p', admin: false, academyId: 'main' }, { id: list[0].id, block: true }, auth), /FORBIDDEN/);
});

test('app users: if blocking sign-in fails, the record is still removed and the admin is told', async () => {
    const f = seed();
    const auth = { updateUser: async () => { throw Object.assign(Error('no'), { code: 'auth/insufficient-permission' }); }, revokeRefreshTokens: async () => {} };
    const r = await removeAppUser(f.db, admin, { uid: 'new' }, auth);
    assert.deepEqual([r.removed, r.signInBlocked, r.blockFailed], [true, false, true]);
    assert.equal(f.rows.has('users/new'), false);
    assert.equal((await listRemovedUsers(f.db, admin)).removed[0].signInBlocked, false);
});
test('app users: the admin corrects an app name (trimmed, recorded in 관리 기록); others, blanks and unknown accounts are refused', async () => {
    const f = seed();
    const uid = [...f.rows.keys()].find(k => k.startsWith('users/') && f.rows.get(k).role === 'student')!.slice(6);
    const before = f.rows.get('users/' + uid);
    await assert.rejects(setAppUserName(f.db, { ...admin, admin: false }, { uid, name: '새 이름' }), /FORBIDDEN/);
    await assert.rejects(setAppUserName(f.db, admin, { uid, name: '   ' }));
    await assert.rejects(setAppUserName(f.db, admin, { uid: 'nobody', name: '새 이름' }), /APP_USER_NOT_FOUND/);
    assert.deepEqual(f.rows.get('users/' + uid), before);
    const r = await setAppUserName(f.db, admin, { uid, name: '  새 이름 ' });
    assert.equal(r.name, '새 이름'); assert.equal(f.rows.get('users/' + uid).alias, '새 이름'); assert.equal(f.rows.get('users/' + uid).isNameSet, true);
    assert.equal(f.rows.get('users/' + uid).role, before.role, 'only the name changes');
    assert.equal((await setAppUserName(f.db, admin, { uid, name: '새 이름' })).unchanged, true);
    assert.equal([...f.rows.keys()].filter(k => k.startsWith('appUserNameHistory/')).length, 1);
    const history = await readAdminHistory(f.db, admin, 'account');
    assert.ok(history.entries.some((e: any) => e.area === '회원' && e.text.endsWith('→ 새 이름 · 앱 이름 바꾸기')));
});
test('app users: a graduated student linked account can be removed; the link goes, the student record and reports stay', async () => {
    const f = seed();
    f.rows.set('notionStudentMappings/' + hashStudentKey('sk'), { studentKey: 'sk', internalStudentId: 'internal', firebaseUid: 'kid' });
    f.rows.set('reportSlugs/kid-url', { internalStudentId: 'internal', parentPhonePinHash: 'pin', authVersion: 3 });
    const slug = JSON.stringify(f.rows.get('reportSlugs/kid-url'));
    const r = await removeAppUser(f.db, admin, { uid: 'kid', blockSignIn: false });
    assert.equal(r.removed, true);
    assert.equal(f.rows.has('users/kid'), false, 'the account record is removed');
    const mapping = f.rows.get('notionStudentMappings/' + hashStudentKey('sk'));
    assert.equal(mapping.firebaseUid, null, 'only the link to this account is cleared');
    assert.equal(mapping.internalStudentId, 'internal'); assert.equal(mapping.studentKey, 'sk');
    assert.equal(JSON.stringify(f.rows.get('reportSlugs/kid-url')), slug, 'parent address and PIN unchanged');
    const copy = [...f.rows.entries()].find(([k]) => k.startsWith('appUserRemovals/kid:'))![1];
    assert.equal(copy.unlinkedStudentKey, 'sk'); assert.equal(copy.user.notionStudentKey, 'sk');
    // A link that already points to another account is left alone.
    const g = seed();
    g.rows.set('notionStudentMappings/' + hashStudentKey('sk'), { studentKey: 'sk', internalStudentId: 'internal', firebaseUid: 'someone-else' });
    await removeAppUser(g.db, admin, { uid: 'kid', blockSignIn: false });
    assert.equal(g.rows.get('notionStudentMappings/' + hashStudentKey('sk')).firebaseUid, 'someone-else');
});
