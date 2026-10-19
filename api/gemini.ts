import type { IncomingMessage, ServerResponse } from 'http';
import { parseJsonBody, sendJson } from './_lib/http.js';
import { getFirebaseAdmin } from './_lib/firebaseAdmin.js';
import { verifyFirebaseSession } from './_lib/firebaseSession.js';
import { WORKBOOK_AI_MESSAGES, translateWorkbook } from './_lib/teacherWorkbook.js';
import { handlePet } from './_lib/student/pet.js';
import { AI_MODEL, AI_TOO_FAST_MESSAGE, generateAi, planOf, refundMonthlyQuota, takeAiBurst, takeMonthlyQuota, type AiFeature } from './_lib/aiModel.js';
import { AI_PLANS, PASS_NOTE } from '../src/lib/aiPlans.js';
import { bundleQuestionSets, listQuestionSets, makeQuestionSet, readQuestionSet } from './_lib/questionSets.js';
import { editQuestion, redoQuestion } from './_lib/questionEdits.js';
import { myAssignedSets, openAttempt, saveAttempt, submitAttempt } from './_lib/questionAttempts.js';
import { PASSAGE_MESSAGES, askPassagePart, editPassagePart, listPassages, openPassage, passageActor, passageWordsPart, readPassage, setPassageInfo } from './_lib/passage.js';
export { AI_MODEL, generateAi };

/** The short-time guard's answer: 429 with Retry-After (no automatic retry on the client; the message says to wait). */
function tooFast(res: ServerResponse, retryAfter: number, okField = false) {
    res.setHeader('Retry-After', String(retryAfter));
    return sendJson(res, 429, {...(okField ? {ok: false} : {}), error: 'AI_TOO_FAST', message: AI_TOO_FAST_MESSAGE, retryAfter});
}
type Deps = {verify: (token: string) => Promise<{uid: string}>; db: () => any; generate: (request: any, feature?: AiFeature) => Promise<string>; adminUid?: string};
const defaultDeps = (): Deps => ({
    verify: token => { const {auth} = getFirebaseAdmin(); return verifyFirebaseSession(auth, token) as any; },
    db: () => getFirebaseAdmin().db,
    generate: (request: any, feature?: AiFeature) => generateAi(request, feature),
    adminUid: process.env.ADMIN_UID,
});

/** The month's calls are used up: what to say (the free plan points to the 프리미엄 패스). */
const monthlyMessage = async (db: any, uid: string, feature: 'analyzer' | 'workbook' | 'generator') => {
    const plan = await planOf(db, uid).catch(() => 'free' as const), name = feature === 'analyzer' ? '지문 분석' : feature === 'generator' ? '변형 문제 만들기' : '워크북 AI 해석';
    return plan === 'premium' ? `이번 달 ${name} ${AI_PLANS.premium[feature]}번을 다 썼어요. 다음 달에 또 써 주세요.` : `이번 달 ${name} ${AI_PLANS[plan][feature]}번을 다 썼어요. ${PASS_NOTE.premium}`;
};
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
            : action === 'bundle-sets' ? await bundleQuestionSets(db, actor, body, now)
            // 문제 하나 다시 만들기 (AI-helped types count once) · 고치기
            : action === 'question-redo' ? await redoQuestion(db, actor, body, now, Math.random, request => deps.generate(request, 'generator'))
            : action === 'question-edit' ? await editQuestion(db, actor, body, now)
            // 변형 문제 풀기: open (draft + visit), save the answers so far, 채점 (once).
            : action === 'attempt-open' ? await openAttempt(db, actor, body, now)
            : action === 'attempt-save' ? await saveAttempt(db, actor, body, now)
            : action === 'attempt-submit' ? await submitAttempt(db, actor, body, now, request => deps.generate(request, 'generator'))
            : action === 'assigned-list' ? await myAssignedSets(db, actor)
            : null;
        if (!out) return sendJson(res, 400, {ok: false, error: 'BAD_REQUEST', message: PASSAGE_MESSAGES.BAD_REQUEST});
        return sendJson(res, 200, {ok: true, ...out});
    } catch (error: any) {
        const code = String(error?.message || '');
        if (code === 'AI_MONTHLY_LIMIT') return sendJson(res, 429, {ok: false, error: code, message: await monthlyMessage(db, uid, error.feature === 'workbook' ? 'workbook' : error.feature === 'generator' ? 'generator' : 'analyzer')});
        if (code === 'AI_TOO_FAST') return tooFast(res, Number(error.retryAfter) || 60, true);
        if (PASSAGE_MESSAGES[code]) return sendJson(res, code === 'FORBIDDEN' ? 403 : code === 'PASSAGE_NOT_FOUND' ? 404 : code === 'AI_BUSY' ? 503 : code.startsWith('AI_') || code === 'PASSAGE_AI_MISMATCH' ? 502 : 400, {ok: false, error: code, message: PASSAGE_MESSAGES[code] + (error.detail ? ` (${String(error.detail).slice(0, 80)})` : '')});
        console.warn('PASSAGE_FAILED', {code: 'unknown'}); // never the text
        return sendJson(res, 500, {ok: false, error: 'SERVER_ERROR', message: '잠시 후 다시 해 주세요.'});
    }
}

/** Every model call comes here (Gemini through Vertex AI, from the same region as the other functions): ?task=workbook (워크북 해석), ?task=pet (펫 말 가르치기·대화·혼잣말,
 *  the same pet handler and checks as /api/student/pet) and ?task=passage (지문 분석기 · 변형 문제 · 풀이). There is no open model proxy: anything
 *  else is 404. */
export default function handler(req: IncomingMessage, res: ServerResponse) {
    const task = new URL(req.url || '', 'http://localhost').searchParams.get('task');
    if (task === 'workbook') return handleWorkbookAi(req, res);
    if (task === 'pet') return handlePet(req, res);
    if (task === 'passage') return handlePassage(req, res);
    return sendJson(res, 404, {error: 'NOT_FOUND'});
}
