import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from './_lib/http.js';
import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';
import { verifyFirebaseSession } from './_lib/firebaseSession.js';
import { WORKBOOK_AI_MESSAGES, translateWorkbook } from './_lib/teacherWorkbook.js';
import { handlePet } from './_lib/student/pet.js';
import { AI_DAILY_LIMIT, AI_MODEL, generateAi, takeAiQuota } from './_lib/aiModel.js';
export { AI_DAILY_LIMIT, AI_MODEL, generateAi, takeAiQuota };

// Gemini proxy: signed-in accounts only, a daily limit per account (the admin is not limited), and the model and
// output length fixed here rather than chosen by the browser. Only plain generation settings are passed through.
const MAX_OUTPUT = 8192, MAX_TEXT = 20000, MAX_TURNS = 20;

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

/** 워크북 AI 해석 (/api/gemini?task=workbook): the admin only, one Korean sentence per English sentence. */
export async function handleWorkbookAi(req: IncomingMessage, res: ServerResponse, deps: Deps = defaultDeps()) {
    if (req.method !== 'POST') return sendJson(res, 405, {ok: false, error: 'Method not allowed'});
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return sendJson(res, 401, {ok: false, error: 'UNAUTHORIZED'});
    let uid: string;
    try { uid = (await deps.verify(header.slice(7).trim())).uid; } catch { return sendJson(res, 401, {ok: false, error: 'INVALID_TOKEN'}); }
    if (!deps.adminUid || uid !== deps.adminUid) return sendJson(res, 403, {ok: false, error: 'FORBIDDEN', message: WORKBOOK_AI_MESSAGES.FORBIDDEN});
    try {
        return sendJson(res, 200, {ok: true, ...await translateWorkbook({uid, admin: true}, await parseJsonBody(req).catch(() => null), deps.generate)});
    } catch (error: any) {
        const code = error?.name === 'ZodError' ? 'INVALID_INPUT' : WORKBOOK_AI_MESSAGES[error?.message] ? error.message : 'WORKBOOK_TRANSLATE_FAILED';
        console.warn('WORKBOOK_AI_FAILED', {code}); // never the sentences or the reply
        return sendJson(res, code === 'INVALID_INPUT' ? 400 : code === 'AI_BUSY' ? 503 : code === 'AI_QUOTA' ? 429 : 502, {ok: false, error: code, message: WORKBOOK_AI_MESSAGES[code]});
    }
}

/** This function runs in Seoul (vercel.json), where Gemini is served; the other functions stay next to Firestore in
 *  Hong Kong. So every model call comes here: ?task=workbook (워크북 해석), ?task=pet (펫 말 가르치기·대화·혼잣말,
 *  the same pet handler and checks as /api/student/pet), and the plain proxy (지문 분석기·문제 생성기). */
export default function handler(req: IncomingMessage, res: ServerResponse) {
    const task = new URL(req.url || '', 'http://localhost').searchParams.get('task');
    if (task === 'workbook') return handleWorkbookAi(req, res);
    if (task === 'pet') return handlePet(req, res);
    return handleGemini(req, res);
}
