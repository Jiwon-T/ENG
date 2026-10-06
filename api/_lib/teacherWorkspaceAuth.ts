import {verifyFirebaseSession} from './firebaseSession.js';
import {notionTeachingScopes} from './teacherNotionWorkspace.js';
import type { IncomingMessage } from 'http';
import { getFirebaseAdmin } from './firebaseAdmin.js';
import { subjects } from './teacherWorkspacePolicy.js';
export async function teacherActor(req: IncomingMessage, initialize = getFirebaseAdmin) {
    let workspaceStage='firebase-initialize';
    try{
    const { db, auth } = initialize();
    workspaceStage='token-verification';
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ') || !header.slice(7).trim() || header.slice(7) === 'undefined') throw new Error('UNAUTHORIZED');
    let uid: string;
    // Use the same signed-token verification as existing app endpoints.
    // Access approval and disabling are checked server-side on every request.
    try { uid = (await verifyFirebaseSession(auth,header.slice(7).trim())).uid; }
    catch (e: any) {
        const code = String(e?.code || '');
        console.warn('TEACHER_AUTH_CHECK_FAILED',{code:/^(auth|app)\/[a-z-]+$/.test(code)?code:e?.message==='AUTH_SERVER_CONFIG_ERROR'?'AUTH_SERVER_CONFIG_ERROR':'unknown'});
        if(e?.message==='AUTH_SERVER_CONFIG_ERROR')throw new Error('AUTH_SERVER_CONFIG_ERROR');
        if (code === 'auth/insufficient-permission' || code === 'auth/internal-error' || code === 'app/invalid-credential') throw new Error('AUTH_SERVER_CONFIG_ERROR');
        if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') throw new Error('SESSION_REVOKED');
        throw new Error('UNAUTHORIZED');
    }
    workspaceStage='workspace-account';
    if (!process.env.ADMIN_UID) throw new Error('CONFIG_ERROR');
    const admin = uid === process.env.ADMIN_UID;
    const [userDoc,profileDoc]=await Promise.all([db.collection('users').doc(uid).get(),db.collection('teacherWorkspaceAccess').doc(uid).get()]);
    const user = userDoc.data();
    if (!admin && !['teacher', 'principal'].includes(user?.role)) throw new Error('FORBIDDEN');
    const profile = profileDoc.data();
    if (profile?.disabled) throw new Error('TEACHER_NOT_CONFIGURED');
    if (!admin && (!profile || profile.disabled)) throw new Error('TEACHER_NOT_CONFIGURED');
    const principal = !admin && profile?.workspaceRole === 'principal' && Boolean(profile.academyId);
    // A client-side role alone never grants access to an academy.
    if (!admin && user?.role === 'principal' && !principal) throw new Error('TEACHER_NOT_CONFIGURED');
    const academyId = profile?.academyId || (admin ? 'main' : null);
    if(!academyId)throw new Error('TEACHER_NOT_CONFIGURED');
    workspaceStage='workspace-scope';
    let teachingScopes = profile?.notionTeacherPageId ? await notionTeachingScopes(db,profile) : profile?.scopes || [];
    if(!profile?.notionTeacherPageId&&teachingScopes.length){
        const checked=await Promise.all(teachingScopes.map(async(s:any)=>{const m=(await db.collection('academyStudentMemberships').doc(s.studentKey).get()).data();return m&&!m.disabled&&m.academyId===academyId?s:null;}));
        teachingScopes=checked.filter(Boolean);
    }
    let scopes = teachingScopes;
    if (principal) {
        const members = await db.collection('academyStudentMemberships').where('academyId', '==', academyId).get();
        scopes = members.docs.filter(d => !d.data().disabled).flatMap(d => subjects.map(subject => ({studentKey: d.id, subject})));
    }
    return { uid, admin, principal, academyId, scopes, teachingScopes, db, workspaceProfile:profile, readAccessKey:JSON.stringify([profile?.notionTeacherPageId,profile?.notionSources,profile?.workspaceRole]) };
    }catch(error:any){const failure=error instanceof Error?error:new Error('WORKSPACE_ERROR');Object.assign(failure,{workspaceStage});throw failure;}
}


