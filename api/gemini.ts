import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from './_lib/http.js';
import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';
import { verifyFirebaseSession } from './_lib/firebaseSession.js';
import { WORKBOOK_AI_MESSAGES, translateWorkbook } from './_lib/teacherWorkbook.js';
import { handlePet } from './_lib/student/pet.js';
import { AI_MODEL, AI_TOO_FAST_MESSAGE, aiErrorCode, generateAi, generateAiStream, planOf, refundMonthlyQuota, takeAiBurst, takeMonthlyQuota, type AiFeature } from './_lib/aiModel.js';
import { AI_PLANS, PASS_NOTE } from '../src/lib/aiPlans.js';
import { listQuestionSets, makeQuestionSet, readQuestionSet } from './_lib/questionSets.js';
import { myAssignedSets, openAttempt, saveAttempt, submitAttempt } from './_lib/questionAttempts.js';
import { PASSAGE_MESSAGES, askPassagePart, editPassagePart, listPassages, openPassage, passageActor, passageWordsPart, readPassage, setPassageInfo } from './_lib/passage.js';
export { AI_MODEL, generateAi };

// Gemini proxy: signed-in accounts only, a daily limit per account (the admin is not limited), and the model and
// output length fixed here rather than chosen by the browser. Only plain generation settings are passed through.
const MAX_OUTPUT = 16384, MAX_TEXT = 20000, MAX_TURNS = 20;

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
    // Gemini 3 thinks first and that counts toward the output limit. Light thinking by default (지문 분석기: quick and
    // complete); 변형문제 생성 may ask for MEDIUM (more careful questions). HIGH is never used (time and cost).
    config.thinkingConfig = {thinkingLevel: c.thinkingLevel === 'MEDIUM' ? 'MEDIUM' : 'LOW'};
    return {contents: turns, config};
}

/** The short-time guard's answer: 429 with Retry-After (no automatic retry on the client; the message says to wait). */
function tooFast(res: ServerResponse, retryAfter: number, okField = false) {
    res.setHeader('Retry-After', String(retryAfter));
    return sendJson(res, 429, {...(okField ? {ok: false} : {}), error: 'AI_TOO_FAST', message: AI_TOO_FAST_MESSAGE, retryAfter});
}
type Deps = {verify: (token: string) => Promise<{uid: string}>; db: () => any; generate: (request: any, feature?: AiFeature) => Promise<string>; stream?: (request: any, feature: AiFeature, onThought: (text: string) => void) => Promise<string>; adminUid?: string};
const defaultDeps = (): Deps => ({
    verify: token => { const {auth} = getFirebaseAdmin(); return verifyFirebaseSession(auth, token) as any; },
    db: () => getFirebaseAdmin().db,
    generate: (request: any, feature?: AiFeature) => generateAi(request, feature),
    stream: generateAiStream,
    adminUid: process.env.ADMIN_UID,
});

/** The month's calls are used up: what to say (the free plan points to the 프리미엄 패스). */
const monthlyMessage = async (db: any, uid: string, feature: 'analyzer' | 'workbook' | 'generator') => {
    const plan = await planOf(db, uid).catch(() => 'free' as const), name = feature === 'analyzer' ? '지문 분석' : feature === 'generator' ? '변형 문제 만들기' : '워크북 AI 해석';
    return plan === 'premium' ? `이번 달 ${name} ${AI_PLANS.premium[feature]}번을 다 썼어요. 다음 달에 또 써 주세요.` : `이번 달 ${name} ${AI_PLANS[plan][feature]}번을 다 썼어요. ${PASS_NOTE.premium}`;
};
/**
 * 지문 분석기 (?task=analyzer, every signed-in user, a monthly limit) and 변형문제 생성기 (?task=generator, the admin only
 * while it is in beta). With ?stream=1 the reply is NDJSON lines: {t:'thought', text} while the model thinks, then
 * {t:'done', text, left} (or {t:'error', code}).
 */
export async function handleGemini(req: IncomingMessage, res: ServerResponse, deps: Deps = defaultDeps()) {
    if (req.method !== 'POST') return sendJson(res, 405, {error: 'Method not allowed'});
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return sendJson(res, 401, {error: 'UNAUTHORIZED'});
    let uid: string;
    try { uid = (await deps.verify(header.slice(7).trim())).uid; } catch { return sendJson(res, 401, {error: 'INVALID_TOKEN'}); }
    const url = new URL(req.url || '', 'http://localhost'), feature: AiFeature = url.searchParams.get('task') === 'generator' ? 'generator' : 'analyzer', streaming = url.searchParams.get('stream') === '1';
    const admin = Boolean(deps.adminUid) && uid === deps.adminUid;
    if (feature === 'generator' && !admin) return sendJson(res, 403, {error: 'FORBIDDEN', message: '변형문제 생성기는 아직 준비 중이에요.'});
    const request = cleanAiRequest(await parseJsonBody(req).catch(() => null));
    if (!request) return sendJson(res, 400, {error: 'INVALID_REQUEST'});
    let left: number | null = null;
    try {
        if (!admin) { const burst = await takeAiBurst(deps.db(), uid); if (!burst.ok) return tooFast(res, burst.retryAfter ?? 60); }
        if (!admin) { left = await takeMonthlyQuota(deps.db(), uid, 'analyzer'); if (left < 0) return sendJson(res, 429, {error: 'AI_MONTHLY_LIMIT', message: await monthlyMessage(deps.db(), uid, 'analyzer')}); }
    } catch { return sendJson(res, 500, {error: 'AI_FAILED'}); }
    const failed = async (error: any) => {
        const code = aiErrorCode(error);
        console.warn('GEMINI_FAILED', {code}); // the code only, never the prompt or the reply
        if (!admin) await refundMonthlyQuota(deps.db(), uid, 'analyzer').catch(() => undefined);
        return code;
    };
    if (streaming && deps.stream) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('X-Accel-Buffering', 'no');
        const line = (x: any) => res.write(JSON.stringify(x) + '\n');
        try { const text = await deps.stream(request, feature, thought => line({t: 'thought', text: thought.slice(0, 2000)})); line({t: 'done', text, left}); }
        catch (error: any) { line({t: 'error', code: await failed(error)}); }
        return res.end();
    }
    try { return sendJson(res, 200, {text: await deps.generate(request, feature), left}); }
    catch (error: any) { const code = await failed(error); return sendJson(res, code === 'AI_BUSY' ? 503 : 500, {error: code}); }
}

/** 워크북 AI 해석 (/api/gemini?task=workbook): teachers (a monthly limit) and the admin (none), one Korean sentence per
 *  English sentence. */
export async function handleWorkbookAi(req: IncomingMessage, res: ServerResponse, deps: Deps = defaultDeps()) {
    if (req.method !== 'POST') return sendJson(res, 405, {ok: false, error: 'Method not allowed'});
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return sendJson(res, 401, {ok: false, error: 'UNAUTHORIZED'});
    let uid: string;
    try { uid = (await deps.verify(header.slice(7).trim())).uid; } catch { return sendJson(res, 401, {ok: false, error: 'INVALID_TOKEN'}); }
    const admin = Boolean(deps.adminUid) && uid === deps.adminUid;
    let left: number | null = null;
    try {
        if (!admin) {
            const [user, access] = await Promise.all([deps.db().collection('users').doc(uid).get(), deps.db().collection('teacherWorkspaceAccess').doc(uid).get()]);
            if (!['teacher', 'principal'].includes(user.data()?.role) || !access.exists || access.data()?.disabled) return sendJson(res, 403, {ok: false, error: 'FORBIDDEN', message: WORKBOOK_AI_MESSAGES.FORBIDDEN});
            const burst = await takeAiBurst(deps.db(), uid); if (!burst.ok) return tooFast(res, burst.retryAfter ?? 60, true);
            left = await takeMonthlyQuota(deps.db(), uid, 'workbook');
            if (left < 0) return sendJson(res, 429, {ok: false, error: 'AI_MONTHLY_LIMIT', message: await monthlyMessage(deps.db(), uid, 'workbook')});
        }
        return sendJson(res, 200, {ok: true, left, ...await translateWorkbook({uid, admin, teacher: true}, await parseJsonBody(req).catch(() => null), request => deps.generate(request, 'workbook'))});
    } catch (error: any) {
        const code = error?.name === 'ZodError' ? 'INVALID_INPUT' : WORKBOOK_AI_MESSAGES[error?.message] ? error.message : 'WORKBOOK_TRANSLATE_FAILED';
        console.warn('WORKBOOK_AI_FAILED', {code}); // never the sentences or the reply
        if (!admin && left !== null) await refundMonthlyQuota(deps.db(), uid, 'workbook').catch(() => undefined);
        return sendJson(res, code === 'INVALID_INPUT' ? 400 : code === 'AI_BUSY' ? 503 : code === 'AI_QUOTA' ? 429 : 502, {ok: false, error: code, message: WORKBOOK_AI_MESSAGES[code]});
    }
}

/**
 * 지문 분석기 (?task=passage, POST {action}): open (analyse a text; the stored analysis when there is one), read, list
 * (지문 보관함), words (학원 단어 세트), ai (직독직해 · 문법·구조 · 주제·요약, by button), edit and info (teachers).
 */
export async function handlePassage(req: IncomingMessage, res: ServerResponse, deps: Deps = defaultDeps(), now = Date.now()) {
    if (req.method !== 'POST') return sendJson(res, 405, {ok: false, error: 'METHOD_NOT_ALLOWED'});
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return sendJson(res, 401, {ok: false, error: 'UNAUTHORIZED'});
    let uid: string;
    try { uid = (await deps.verify(header.slice(7).trim())).uid; } catch { return sendJson(res, 401, {ok: false, error: 'INVALID_TOKEN'}); }
    const db = deps.db();
    try {
        const body: any = await parseJsonBody(req).catch(() => null), actor = await passageActor(db, uid, deps.adminUid);
        const action = String(body?.action || '');
        const out = action === 'open' ? await openPassage(db, actor, body, now)
            : action === 'read' ? await readPassage(db, actor, body?.id)
            : action === 'list' ? await listPassages(db, actor, body)
            : action === 'words' ? await passageWordsPart(db, actor, body?.id, now)
            : action === 'ai' ? await askPassagePart(db, actor, body, request => deps.generate(request, 'analyzer'), now)
            : action === 'edit' ? await editPassagePart(db, actor, body, now)
            : action === 'info' ? await setPassageInfo(db, actor, body, now)
            // 변형 문제 만들기 (counted monthly; AI-helped types also take a daily AI use) and my saved sets.
            : action === 'make-questions' ? await makeQuestionSet(db, actor, body, now, Math.random, request => deps.generate(request, 'generator'))
            : action === 'question-sets' ? await listQuestionSets(db, actor)
            : action === 'question-set' ? await readQuestionSet(db, actor, body?.id)
            // 변형 문제 풀기: open (draft + visit), save the answers so far, 채점 (once).
            : action === 'attempt-open' ? await openAttempt(db, actor, body, now)
            : action === 'attempt-save' ? await saveAttempt(db, actor, body, now)
            : action === 'attempt-submit' ? await submitAttempt(db, actor, body, now)
            : action === 'assigned-list' ? await myAssignedSets(db, actor)
            : null;
        if (!out) return sendJson(res, 400, {ok: false, error: 'BAD_REQUEST', message: PASSAGE_MESSAGES.BAD_REQUEST});
        return sendJson(res, 200, {ok: true, ...out});
    } catch (error: any) {
        const code = String(error?.message || '');
        if (code === 'AI_MONTHLY_LIMIT') return sendJson(res, 429, {ok: false, error: code, message: await monthlyMessage(db, uid, error.feature === 'workbook' ? 'workbook' : error.feature === 'generator' ? 'generator' : 'analyzer')});
        if (code === 'AI_TOO_FAST') return tooFast(res, Number(error.retryAfter) || 60, true);
        if (PASSAGE_MESSAGES[code]) return sendJson(res, code === 'FORBIDDEN' ? 403 : code === 'PASSAGE_NOT_FOUND' ? 404 : code === 'AI_BUSY' ? 503 : code.startsWith('AI_') || code === 'PASSAGE_AI_MISMATCH' ? 502 : 400, {ok: false, error: code, message: PASSAGE_MESSAGES[code]});
        console.warn('PASSAGE_FAILED', {code: 'unknown'}); // never the text
        return sendJson(res, 500, {ok: false, error: 'SERVER_ERROR', message: '잠시 후 다시 해 주세요.'});
    }
}

/** Every model call comes here (Gemini through Vertex AI, from the same region as the other functions): ?task=workbook (워크북 해석), ?task=pet (펫 말 가르치기·대화·혼잣말,
 *  the same pet handler and checks as /api/student/pet), and ?task=analyzer|generator (지문 분석기·변형문제 생성기, see handleGemini). */
export default function handler(req: IncomingMessage, res: ServerResponse) {
    const task = new URL(req.url || '', 'http://localhost').searchParams.get('task');
    if (task === 'workbook') return handleWorkbookAi(req, res);
    if (task === 'pet') return handlePet(req, res);
    if (task === 'passage') return handlePassage(req, res);
    return handleGemini(req, res);
}
