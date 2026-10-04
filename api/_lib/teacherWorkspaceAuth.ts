import {notionTeachingScopes} from './teacherNotionWorkspace.js';
import type { IncomingMessage } from 'http';
import { getFirebaseAdmin } from './firebaseAdmin.js';
import { subjects } from './teacherWorkspacePolicy.js';
export async function teacherActor(req: IncomingMessage, initialize = getFirebaseAdmin) {
    const { db, auth } = initialize();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !header.slice(7).trim() || header.slice(7) === 'undefined') throw new Error('UNAUTHORIZED');
    let uid: string;
    // Use the same signed-token verification as existing app endpoints.
    // Access approval and disabling are checked server-side on every request.
    try { uid = (await auth.verifyIdToken(header.slice(7).trim())).uid; }
    catch (e: any) {
        const code = String(e?.code || '');
        if (code === 'auth/insufficient-permission' || code === 'auth/internal-error' || code === 'app/invalid-credential') throw new Error('AUTH_SERVER_CONFIG_ERROR');
        if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') throw new Error('SESSION_REVOKED');
        throw new Error('UNAUTHORIZED');
    }
    if (!process.env.ADMIN_UID) throw new Error('CONFIG_ERROR');
    const admin = uid === process.env.ADMIN_UID;
    const user = (await db.collection('users').doc(uid).get()).data();
    if (!admin && !['teacher', 'principal'].includes(user?.role)) throw new Error('FORBIDDEN');
    const profile = (await db.collection('teacherWorkspaceAccess').doc(uid).get()).data();
    if (!admin && (!profile || profile.disabled)) throw new Error('TEACHER_NOT_CONFIGURED');
    const principal = !admin && profile?.workspaceRole === 'principal' && Boolean(profile.academyId);
    // A client-side role alone never grants access to an academy.
    if (!admin && user?.role === 'principal' && !principal) throw new Error('TEACHER_NOT_CONFIGURED');
    const academyId = profile?.academyId || (admin ? 'main' : null);
    const teachingScopes = profile?.notionTeacherPageId ? await notionTeachingScopes(db,profile) : profile?.scopes || [];
    let scopes = teachingScopes;
    if (principal) {
        const members = await db.collection('academyStudentMemberships').where('academyId', '==', academyId).get();
        scopes = members.docs.filter(d => !d.data().disabled).flatMap(d => subjects.map(subject => ({studentKey: d.id, subject})));
    }
    return { uid, admin, principal, academyId, scopes, teachingScopes, db, readAccessKey:JSON.stringify([profile?.notionTeacherPageId,profile?.notionSources,profile?.workspaceRole]) };
}
