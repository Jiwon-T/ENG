import type { IncomingMessage, ServerResponse } from 'http';
import { GoogleGenAI } from '@google/genai';
import { parseJsonBody, sendJson } from './_lib/http.js';
import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';
import { verifyFirebaseSession } from './_lib/firebaseSession.js';

// Gemini proxy: signed-in accounts only, a daily limit per account (the admin is not limited), and the model and
// output length fixed here rather than chosen by the browser. Only plain generation settings are passed through.
export const AI_MODEL = 'gemini-3-flash-preview';
export const AI_DAILY_LIMIT = 60;
const MAX_OUTPUT = 8192, MAX_TEXT = 20000, MAX_TURNS = 20;
const seoulDay = (at = Date.now()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date(at));

/** Keep only text turns and plain generation settings; anything else (tools, other models, huge outputs) is dropped. */
export function cleanAiRequest(body: any) {
    const contents = Array.isArray(body?.contents) ? body.contents.slice(-MAX_TURNS) : [];
    let size = 0;
    const turns = contents.map((turn: any) => {
        const role = turn?.role === 'model' ? 'model' : 'user';
        const parts = (Array.isArray(turn?.parts) ? turn.parts : []).filter((p: any) => typeof p?.text === 'string').map((p: any) => { size += p.text.length; return {text: p.text}; });
        return {role, parts};
    }).filter((turn: any) => turn.parts.length);
    if (!turns.length || size > MAX_TEXT) return null;
    const c = body?.config || {}, config: any = {maxOutputTokens: Math.min(MAX_OUTPUT, Number(c.maxOutputTokens) > 0 ? Number(c.maxOutputTokens) : MAX_OUTPUT)};
    if (typeof c.systemInstruction === 'string' && c.systemInstruction.length <= 6000) config.systemInstruction = c.systemInstruction;
    if (c.responseMimeType === 'application/json' || c.responseMimeType === 'text/plain') config.responseMimeType = c.responseMimeType;
    if (c.responseSchema && typeof c.responseSchema === 'object' && JSON.stringify(c.responseSchema).length <= 8000) config.responseSchema = c.responseSchema;
    if (typeof c.temperature === 'number' && c.temperature >= 0 && c.temperature <= 2) config.temperature = c.temperature;
    return {contents: turns, config};
}

/** Count one call for today (Seoul); false when the account has used up today's calls. */
export async function takeAiQuota(db: any, uid: string, now = Date.now(), limit = AI_DAILY_LIMIT) {
    const ref = db.collection('aiUsage').doc(`${uid}:${seoulDay(now)}`);
    return db.runTransaction(async (tx: any) => {
        const used = Number((await tx.get(ref)).data()?.count || 0);
        if (used >= limit) return false;
        tx.set(ref, {uid, day: seoulDay(now), count: used + 1, updatedAt: now});
        return true;
    });
}

/** One model call with the server key (the pet talk uses it too). */
export async function generateAi(request: any) {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw Error('AI_NOT_CONFIGURED');
    const response = await new GoogleGenAI({apiKey}).models.generateContent({model: AI_MODEL, ...request});
    return response.text || '';
}

type Deps = {verify: (token: string) => Promise<{uid: string}>; db: () => any; generate: (request: any) => Promise<string>; adminUid?: string};
const defaultDeps = (): Deps => ({
    verify: token => { const {auth} = getFirebaseAdmin(); return verifyFirebaseSession(auth, token) as any; },
    db: () => getFirebaseAdmin().db,
    generate: generateAi,
    adminUid: process.env.ADMIN_UID,
});

export async function handleGemini(req: IncomingMessage, res: ServerResponse, deps: Deps = defaultDeps()) {
    if (req.method !== 'POST') return sendJson(res, 405, {error: 'Method not allowed'});
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return sendJson(res, 401, {error: 'UNAUTHORIZED'});
    let uid: string;
    try { uid = (await deps.verify(header.slice(7).trim())).uid; } catch { return sendJson(res, 401, {error: 'INVALID_TOKEN'}); }
    const request = cleanAiRequest(await parseJsonBody(req).catch(() => null));
    if (!request) return sendJson(res, 400, {error: 'INVALID_REQUEST'});
    try {
        if (uid !== deps.adminUid && !await takeAiQuota(deps.db(), uid)) return sendJson(res, 429, {error: 'AI_DAILY_LIMIT', message: '오늘 쓸 수 있는 AI 횟수를 다 썼어요. 내일 다시 해 주세요.'});
        return sendJson(res, 200, {text: await deps.generate(request)});
    } catch (error: any) {
        const busy = /503|high demand|overloaded/i.test(String(error?.message || ''));
        console.warn('GEMINI_FAILED', {busy}); // never the prompt or the reply
        return sendJson(res, busy ? 503 : 500, {error: busy ? 'AI_BUSY' : 'AI_FAILED'});
    }
}

export default function handler(req: IncomingMessage, res: ServerResponse) { return handleGemini(req, res); }
