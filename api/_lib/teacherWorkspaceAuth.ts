import type { IncomingMessage } from 'http';
import { getFirebaseAdmin } from './firebaseAdmin.js';
export async function teacherActor(req: IncomingMessage, initialize = getFirebaseAdmin) {
    const { db, auth } = initialize();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        throw new Error('UNAUTHORIZED');
    let uid: string;
    try {
        uid = (await auth.verifyIdToken(header.slice(7), true)).uid;
    }
    catch {
        throw new Error('UNAUTHORIZED');
    }
    if (!process.env.ADMIN_UID)
        throw new Error('CONFIG_ERROR');
    const admin = uid === process.env.ADMIN_UID;
    const user = (await db.collection('users').doc(uid).get()).data();
    if (!admin && user?.role !== 'teacher')
        throw new Error('FORBIDDEN');
    const profile = (await db.collection('teacherWorkspaceAccess').doc(uid).get()).data();
    if (!admin && (!profile || profile.disabled))
        throw new Error('TEACHER_NOT_CONFIGURED');
    return { uid, admin, scopes: profile?.scopes || [], db };
}
