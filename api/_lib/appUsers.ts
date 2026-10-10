import { z } from 'zod';
// App accounts for the admin: everyone signs up as a student; the admin grants teacher access here.
function admin(actor: any) { if (!actor.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }

export async function listAppUsers(db: any, actor: any) {
    admin(actor);
    const [users, access] = await Promise.all([db.collection('users').limit(1001).get(), db.collection('teacherWorkspaceAccess').get()]);
    if (users.docs.length > 1000) throw Error('APP_USER_LIMIT');
    const profiles = new Map(access.docs.map((d: any) => [d.id, d.data()]));
    return {
        users: users.docs.map((d: any) => {
            const u = d.data() || {}, p: any = profiles.get(d.id);
            return { uid: d.id, name: String(u.alias || u.name || '').slice(0, 80), email: String(u.email || '').slice(0, 120), role: u.role || 'student', linkedStudent: Boolean(u.notionStudentKey), isAdmin: d.id === process.env.ADMIN_UID, workspace: p ? { disabled: Boolean(p.disabled), role: p.workspaceRole || 'teacher' } : null };
        }).sort((a: any, b: any) => Number(b.role !== 'student') - Number(a.role !== 'student') || a.name.localeCompare(b.name, 'ko')),
    };
}

/** Teacher access on/off. A teacher gets a workspace record (no students yet); going back to student disconnects it but keeps assignments. */
export async function setAppUserRole(db: any, actor: any, input: unknown) {
    admin(actor);
    const v = z.object({ uid: z.string().min(1).max(200), role: z.enum(['teacher', 'student']) }).strict().parse(input);
    if (v.uid === process.env.ADMIN_UID || v.uid === actor.uid) throw Error('FORBIDDEN');
    const userRef = db.collection('users').doc(v.uid), accessRef = db.collection('teacherWorkspaceAccess').doc(v.uid);
    return db.runTransaction(async (tx: any) => {
        const [user, profile] = [(await tx.get(userRef)).data(), (await tx.get(accessRef)).data()];
        if (!user) throw Error('APP_USER_NOT_FOUND');
        const at = Date.now();
        if (v.role === 'teacher') {
            // An account linked to a real student keeps being that student; give the teacher their own account instead.
            if (user.notionStudentKey) throw Error('APP_USER_LINKED_STUDENT');
            tx.set(userRef, { ...user, role: user.role === 'principal' ? 'principal' : 'teacher' });
            tx.set(accessRef, profile ? { ...profile, disabled: false, accessChangedAt: at, accessChangedBy: actor.uid } : { academyId: 'main', scopes: [], workspaceRole: 'teacher', workspaceLabel: '', assignmentRevision: 0, notionTeacherPageId: null, assignmentSource: 'firestore', createdAt: at, createdBy: actor.uid });
        } else {
            tx.set(userRef, { ...user, role: 'student' });
            if (profile) tx.set(accessRef, { ...profile, disabled: true, accessChangedAt: at, accessChangedBy: actor.uid });
        }
        tx.set(db.collection('appUserRoleHistory').doc(`${v.uid}:${at}`), { uid: v.uid, from: user.role || 'student', to: v.role, by: actor.uid, at });
        return { uid: v.uid, role: v.role };
    });
}

/** The app name (users.alias) the person chose at first sign-in; the admin can correct it here. Recorded for 관리 기록. */
export async function setAppUserName(db: any, actor: any, input: unknown) {
    admin(actor);
    const v = z.object({ uid: z.string().min(1).max(200), name: z.string().trim().min(1).max(100) }).strict().parse(input);
    const userRef = db.collection('users').doc(v.uid);
    return db.runTransaction(async (tx: any) => {
        const user = (await tx.get(userRef)).data();
        if (!user) throw Error('APP_USER_NOT_FOUND');
        const from = String(user.alias || user.name || '');
        if (from === v.name) return { uid: v.uid, name: v.name, unchanged: true };
        const at = Date.now();
        tx.set(userRef, { ...user, alias: v.name, isNameSet: true });
        tx.set(db.collection('appUserNameHistory').doc(`${v.uid}:${at}`), { uid: v.uid, from, to: v.name, by: actor.uid, at });
        return { uid: v.uid, name: v.name };
    });
}

/** 탈퇴: remove a student account's app record (as the old teacher room did) and, by default, block sign-in for that
 *  account (Firebase "disabled" + sessions revoked), so it cannot come back as a new student. Blocking is reversible
 *  (allowSignIn). A copy of the record is kept in appUserRemovals so a mistake can be undone.
 *  Teachers go back to student first, and an account linked to a registered student is unlinked first. */
export async function removeAppUser(db: any, actor: any, input: unknown, auth?: any) {
    admin(actor);
    const v = z.object({ uid: z.string().min(1).max(200), blockSignIn: z.boolean().default(true) }).strict().parse(input);
    if (v.uid === process.env.ADMIN_UID || v.uid === actor.uid) throw Error('FORBIDDEN');
    const userRef = db.collection('users').doc(v.uid), evaluationRef = db.collection('evaluations').doc(v.uid), accessRef = db.collection('teacherWorkspaceAccess').doc(v.uid);
    const at = Date.now(), copyRef = db.collection('appUserRemovals').doc(`${v.uid}:${at}`);
    await db.runTransaction(async (tx: any) => {
        const [user, evaluation, access] = [(await tx.get(userRef)).data(), (await tx.get(evaluationRef)).data(), (await tx.get(accessRef)).data()];
        if (!user) throw Error('APP_USER_NOT_FOUND');
        if (user.role === 'teacher' || user.role === 'principal' || access && !access.disabled) throw Error('APP_USER_TEACHER_REMOVE');
        if (user.notionStudentKey) throw Error('APP_USER_LINKED_REMOVE');
        tx.set(copyRef, { uid: v.uid, user, evaluation: evaluation || null, by: actor.uid, at, signInBlocked: false });
        tx.delete(userRef);
        if (evaluation) tx.delete(evaluationRef);
    });
    if (!v.blockSignIn || !auth) return { uid: v.uid, removed: true, signInBlocked: false };
    // The record is already gone; if blocking fails the admin is told and can retry from 탈퇴한 계정.
    try { await auth.updateUser(v.uid, { disabled: true }); await auth.revokeRefreshTokens(v.uid); }
    catch (e: any) { return { uid: v.uid, removed: true, signInBlocked: false, blockFailed: true }; }
    await mergeRemoval(db, copyRef, { signInBlocked: true, signInBlockedAt: Date.now() });
    return { uid: v.uid, removed: true, signInBlocked: true };
}

/** Accounts removed from the app (latest first) with whether their sign-in is blocked. */
export async function listRemovedUsers(db: any, actor: any) {
    admin(actor);
    const q = await db.collection('appUserRemovals').orderBy('at', 'desc').limit(100).get();
    const seen = new Set<string>();
    return { removed: q.docs.map((d: any) => ({ id: d.id, ...d.data() })).filter((r: any) => !seen.has(r.uid) && seen.add(r.uid)).map((r: any) => ({ id: r.id, uid: r.uid, name: String(r.user?.alias || r.user?.name || '').slice(0, 80), email: String(r.user?.email || '').slice(0, 120), at: r.at, signInBlocked: Boolean(r.signInBlocked) })) };
}

/** Block or allow sign-in again for a removed account (the app record is not brought back; they start as a new student). */
export async function setRemovedSignIn(db: any, actor: any, input: unknown, auth: any) {
    admin(actor);
    const v = z.object({ id: z.string().min(1).max(300), block: z.boolean() }).strict().parse(input);
    const ref = db.collection('appUserRemovals').doc(v.id), row = (await ref.get()).data();
    if (!row) throw Error('APP_USER_NOT_FOUND');
    if (row.uid === process.env.ADMIN_UID || row.uid === actor.uid) throw Error('FORBIDDEN');
    try { await auth.updateUser(row.uid, { disabled: v.block }); if (v.block) await auth.revokeRefreshTokens(row.uid); }
    catch (e: any) { if (String(e?.code) === 'auth/user-not-found') throw Error('APP_USER_NOT_FOUND'); throw Error('APP_USER_SIGNIN_UPDATE_FAILED'); }
    await mergeRemoval(db, ref, { signInBlocked: v.block, signInChangedAt: Date.now(), signInChangedBy: actor.uid });
    return { id: v.id, signInBlocked: v.block };
}

async function mergeRemoval(db: any, ref: any, patch: any) { await db.runTransaction(async (tx: any) => { const old = (await tx.get(ref)).data(); if (old) tx.set(ref, { ...old, ...patch }); }); }
