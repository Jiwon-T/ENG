// The model call and the daily AI count, shared by api/gemini and the pet handler it serves.
import { GoogleGenAI } from '@google/genai';
import { PET_AI_LIMITS } from '../../src/lib/petCatalog.js';

export const AI_MODEL = 'gemini-3-flash-preview';
export const AI_DAILY_LIMIT = 60;
const seoulDay = (at = Date.now()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date(at));

/** Count one call for today (Seoul); false when the account has used up today's calls. */
export async function takeAiQuota(db: any, uid: string, now = Date.now(), limit = AI_DAILY_LIMIT) {
    const ref = db.collection('aiUsage').doc(`${uid}:${seoulDay(now)}`);
    return db.runTransaction(async (tx: any) => {
        const used = Number((await tx.get(ref)).data()?.count || 0);
        if (used >= limit) return false;
        // merge: the pet's own counts (pet.teach …) in the same document stay as they are.
        tx.set(ref, {uid, day: seoulDay(now), count: used + 1, updatedAt: now}, {merge: true});
        return true;
    });
}

export {PET_AI_LIMITS};
/** Count one pet AI call for today (Seoul): 'ok', or which limit is used up ('kind' = this action, 'daily' = all AI). */
export async function takePetAiQuota(db: any, uid: string, kind: keyof typeof PET_AI_LIMITS, now = Date.now()): Promise<'ok' | 'kind' | 'daily'> {
    const ref = db.collection('aiUsage').doc(`${uid}:${seoulDay(now)}`);
    return db.runTransaction(async (tx: any) => {
        const data = (await tx.get(ref)).data() || {}, used = Number(data.count || 0), kinds = data.pet || {}, mine = Number(kinds[kind] || 0);
        if (used >= AI_DAILY_LIMIT) return 'daily';
        if (mine >= PET_AI_LIMITS[kind]) return 'kind';
        tx.set(ref, {uid, day: seoulDay(now), count: used + 1, pet: {...kinds, [kind]: mine + 1}, updatedAt: now}, {merge: true});
        return 'ok';
    });
}
/** No answer came back (AI error, empty reply): the action's own count is given back. The 60 AI calls a day stay
 *  counted by attempt, so the bill stays bounded. */
export async function refundPetAiQuota(db: any, uid: string, kind: keyof typeof PET_AI_LIMITS, now = Date.now()) {
    const ref = db.collection('aiUsage').doc(`${uid}:${seoulDay(now)}`);
    return db.runTransaction(async (tx: any) => {
        const data = (await tx.get(ref)).data(); if (!data) return;
        const kinds = data.pet || {};
        tx.set(ref, {pet: {...kinds, [kind]: Math.max(0, Number(kinds[kind] || 0) - 1)}, updatedAt: now}, {merge: true});
    });
}

/** Which kind of model failure (the code only: messages can carry the request). */
export function aiErrorCode(error: any, fallback = 'AI_FAILED') {
    const text = String(error?.message || error || '');
    if (text === 'AI_NOT_CONFIGURED' || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(text)) return 'AI_NOT_CONFIGURED';
    if (/location is not supported|FAILED_PRECONDITION/i.test(text)) return 'AI_REGION_UNSUPPORTED';
    if (/503|high demand|overloaded|UNAVAILABLE/i.test(text)) return 'AI_BUSY';
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(text)) return 'AI_QUOTA';
    if (/404|NOT_FOUND|was not found/i.test(text)) return 'AI_MODEL_NOT_FOUND';
    return fallback;
}

/**
 * Gemini through Vertex AI (Google Cloud), signed in with the Firebase project's service account. Vertex serves any
 * Vercel region, so every function (AI included) stays in Hong Kong next to Firestore. The service account needs the
 * "Vertex AI 사용자" (roles/aiplatform.user) role and the project needs the Vertex AI API turned on. `AI_VERTEX_LOCATION`
 * defaults to global (where preview models are served). Without the service account, a Gemini API key is used instead.
 */
let vertex: GoogleGenAI | null = null;
function aiClient() {
    const project = process.env.FIREBASE_PROJECT_ID, clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (project && clientEmail && privateKey) {
        if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
        return vertex ||= new GoogleGenAI({vertexai: true, project, location: process.env.AI_VERTEX_LOCATION || 'global', googleAuthOptions: {credentials: {client_email: clientEmail, private_key: privateKey}}});
    }
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw Error('AI_NOT_CONFIGURED');
    return new GoogleGenAI({apiKey});
}

/** One model call (the pet talk and the workbook use it too). */
export async function generateAi(request: any) {
    const response = await aiClient().models.generateContent({model: AI_MODEL, ...request});
    return response.text || '';
}

