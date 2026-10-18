// The model call, the monthly counts and the short-time guard, shared by api/gemini and the pet handler it serves.
import type { GoogleGenAI } from '@google/genai';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from './firebaseAdmin.js';
import { AI_PLANS, PET_TALK_DAILY_GUARD, activePlan, type AiPass, type AiPlan } from '../../src/lib/aiPlans.js';

export const AI_MODEL = 'gemini-3-flash-preview';
const seoulDay = (at = Date.now()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date(at));
const seoulMonth = (now = Date.now()) => seoulDay(now).slice(0, 7);

/**
 * The short-time guard (not a count people see; the monthly counts per feature are): at most 20 AI requests in 10
 * minutes for one account, shared by 지문 분석, 분석, 워크북 해석 and 변형 문제 (the pet has its own guards; the admin
 * none). Checked and counted in one transaction, after the login, permission and input checks and before the monthly
 * count. A request that fails later still counts: it limits attempts, not use.
 */
export const AI_BURST = {windowMs: 10 * 60_000, limit: 20};
export const AI_TOO_FAST_MESSAGE = '요청이 너무 빨라요. 잠깐 뒤에 다시 해 주세요.';
export async function takeAiBurst(db: any, uid: string, now = Date.now()): Promise<{ok: boolean; retryAfter?: number}> {
    const ref = db.collection('aiBurst').doc(uid);
    // A transaction given up under contention (many tabs at once: ABORTED) is 'try again shortly' too, before the monthly
    // count so nothing is counted. Any other failure (Firestore down …) goes on as a server error.
    return db.runTransaction(async (tx: any) => {
        const d = (await tx.get(ref)).data(), start = Number(d?.windowStart || 0), count = Number(d?.count || 0);
        if (!d || now - start >= AI_BURST.windowMs || now < start) { tx.set(ref, {uid, windowStart: now, count: 1, updatedAt: now}); return {ok: true}; }
        if (count >= AI_BURST.limit) return {ok: false, retryAfter: Math.max(1, Math.ceil((start + AI_BURST.windowMs - now) / 1000))};
        tx.set(ref, {uid, windowStart: start, count: count + 1, updatedAt: now});
        return {ok: true};
    }).catch((error: any) => {
        if (error?.code === 10 || error?.code === 'aborted' || /ABORTED|contention/i.test(String(error?.message || ''))) { console.warn('AI_BURST_BUSY'); return {ok: false, retryAfter: 5}; }
        console.warn('AI_BURST_FAILED'); throw error;
    });
}
/** The guard as an error for the handlers that throw (code AI_TOO_FAST, with the seconds to wait). */
export async function guardAiBurst(db: any, uid: string, now = Date.now()) {
    const r = await takeAiBurst(db, uid, now);
    if (!r.ok) { const e: any = Error('AI_TOO_FAST'); e.retryAfter = r.retryAfter ?? 60; throw e; }
}

/** The person's plan today (a pass the admin turned on, through its last day). */
export async function planOf(db: any, uid: string, now = Date.now()): Promise<AiPlan> {
    // aiPasses/{uid} only (not the user doc: its client rules allow a fixed list of fields).
    return activePlan((await db.collection('aiPasses').doc(uid).get()).data() as AiPass | undefined, seoulDay(now));
}
export type PetTalkKind = 'talk' | 'evolve';
/**
 * One pet AI call. 말 가르치기 and 대화하기 ('talk') count a month: free = 150 for each pet, a pass = 600 for all pets; at
 * most 50 a day on any plan. 혼잣말 ('evolve', automatic) counts a day: 10 free, 30 with a pass.
 */
export async function takePetTalkQuota(db: any, uid: string, slot: number, kind: PetTalkKind, now = Date.now()): Promise<{ok: true; left: number | null; plan: AiPlan} | {ok: false; code: string; plan: AiPlan}> {
    const plan = await planOf(db, uid, now), rules = AI_PLANS[plan];
    const dayRef = db.collection('aiUsage').doc(`${uid}:${seoulDay(now)}`), monthRef = db.collection('aiMonthly').doc(`${uid}_${seoulMonth(now)}`);
    return db.runTransaction(async (tx: any) => {
        const day = (await tx.get(dayRef)).data() || {}, month = (await tx.get(monthRef)).data() || {};
        const pet = day.pet || {}, bySlot = month.petTalkBySlot || {}, mine = Number(bySlot[slot] || 0), total = Number(month.petTalk || 0);
        if (kind === 'evolve') {
            if (Number(pet.evolve || 0) >= rules.petMonologue) return {ok: false, code: 'PET_AI_EVOLVE_LIMIT', plan};
            tx.set(dayRef, {uid, day: seoulDay(now), pet: {...pet, evolve: Number(pet.evolve || 0) + 1}, updatedAt: now}, {merge: true});
            return {ok: true, left: null, plan};
        }
        if (Number(pet.talk || 0) >= PET_TALK_DAILY_GUARD) return {ok: false, code: 'PET_TALK_DAILY', plan};
        const limit = rules.petTalkPerPet ?? rules.petTalk ?? 0, used = rules.petTalkPerPet ? mine : total;
        if (used >= limit) return {ok: false, code: 'PET_TALK_LIMIT', plan};
        tx.set(dayRef, {uid, day: seoulDay(now), pet: {...pet, talk: Number(pet.talk || 0) + 1}, updatedAt: now}, {merge: true});
        tx.set(monthRef, {uid, month: seoulMonth(now), petTalk: total + 1, petTalkBySlot: {...bySlot, [slot]: mine + 1}, updatedAt: now}, {merge: true});
        return {ok: true, left: limit - used - 1, plan};
    });
}
/** No answer came back (AI error, empty reply): the talk is given back. */
export async function refundPetTalkQuota(db: any, uid: string, slot: number, kind: PetTalkKind, now = Date.now()) {
    const dayRef = db.collection('aiUsage').doc(`${uid}:${seoulDay(now)}`), monthRef = db.collection('aiMonthly').doc(`${uid}_${seoulMonth(now)}`);
    return db.runTransaction(async (tx: any) => {
        const day = (await tx.get(dayRef)).data(), month = kind === 'talk' ? (await tx.get(monthRef)).data() : null;
        if (day) { const pet = day.pet || {}; tx.set(dayRef, {pet: {...pet, [kind]: Math.max(0, Number(pet[kind] || 0) - 1)}, updatedAt: now}, {merge: true}); }
        if (month) { const bySlot = month.petTalkBySlot || {}; tx.set(monthRef, {petTalk: Math.max(0, Number(month.petTalk || 0) - 1), petTalkBySlot: {...bySlot, [slot]: Math.max(0, Number(bySlot[slot] || 0) - 1)}, updatedAt: now}, {merge: true}); }
    });
}
/** What the talk tab shows: talks left this month for this pet (free) or for all pets (a pass). */
export async function readPetTalk(db: any, uid: string, slot: number, now = Date.now()) {
    const plan = await planOf(db, uid, now), rules = AI_PLANS[plan], month = (await db.collection('aiMonthly').doc(`${uid}_${seoulMonth(now)}`).get()).data() || {};
    const limit = rules.petTalkPerPet ?? rules.petTalk ?? 0, used = rules.petTalkPerPet ? Number(month.petTalkBySlot?.[slot] || 0) : Number(month.petTalk || 0);
    return {plan, limit, left: Math.max(0, limit - used), perPet: Boolean(rules.petTalkPerPet)};
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
/** The AI library is loaded on the first call only, so the pet and other endpoints that just read quotas start faster. */
async function aiClient() {
    const { GoogleGenAI } = await import('@google/genai');
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

/** Which part of the app made the call (for the usage page). */
export type AiFeature = 'pet' | 'workbook' | 'analyzer' | 'generator';
/**
 * Count each call's tokens by Korea day and feature in aiUsageStats/{YYYY-MM-DD} (server only), so 관리자 설정 › AI 사용량
 * can show calls and an estimated cost before Google's billing catches up. Counting never blocks or fails the call.
 */
function recordUsage(feature: AiFeature, usage: any, now = Date.now()) {
    const n = (v: any) => Math.max(0, Math.floor(Number(v) || 0));
    const add = {calls: FieldValue.increment(1), input: FieldValue.increment(n(usage?.promptTokenCount)), output: FieldValue.increment(n(usage?.candidatesTokenCount)), thoughts: FieldValue.increment(n(usage?.thoughtsTokenCount))};
    return getFirebaseAdmin().db.collection('aiUsageStats').doc(seoulDay(now)).set({day: seoulDay(now), [feature]: add, updatedAt: now}, {merge: true}).catch(() => undefined);
}

/** One model call (the pet talk and the workbook use it too). */
export async function generateAi(request: any, feature: AiFeature = 'analyzer') {
    const response = await (await aiClient()).models.generateContent({model: AI_MODEL, ...request});
    await recordUsage(feature, response.usageMetadata);
    return response.text || '';
}


/** 관리자 설정 › AI 사용량 (admin): the last `days` Korea days of counted calls and tokens, newest first. */
export async function readAiUsage(db: any, actor: any, days = 31, now = Date.now()) {
    if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN');
    const ids = Array.from({length: days}, (_, i) => seoulDay(now - i * 86_400_000));
    const snaps = await Promise.all(ids.map(id => db.collection('aiUsageStats').doc(id).get()));
    const pick = (x: any) => ({calls: Number(x?.calls || 0), input: Number(x?.input || 0), output: Number(x?.output || 0), thoughts: Number(x?.thoughts || 0)});
    const features: AiFeature[] = ['pet', 'workbook', 'analyzer', 'generator'];
    return {days: snaps.map((s: any, i: number) => { const d = s.data() || {}; return {day: ids[i], ...Object.fromEntries(features.map(f => [f, pick(d[f])]))} as any; }).filter((d: any) => features.some(f => d[f].calls > 0))};
}

/** Monthly calls per person (Korea month) on the free plan: 지문 분석기 for every signed-in user, 워크북 해석 for teachers.
 *  A pass raises them (src/lib/aiPlans.ts). The admin has no limit and can reset anyone's month (관리자 설정 › AI 사용량). */
export const AI_MONTHLY_LIMITS = {analyzer: AI_PLANS.free.analyzer, workbook: AI_PLANS.free.workbook, generator: AI_PLANS.free.generator} as const;
export type AiMonthlyFeature = keyof typeof AI_MONTHLY_LIMITS;
/** Count one call this month: the calls left after it, or -1 when the month's calls are used up. */
export async function takeMonthlyQuota(db: any, uid: string, feature: AiMonthlyFeature, now = Date.now()) {
    const month = seoulMonth(now), ref = db.collection('aiMonthly').doc(`${uid}_${month}`), limit = AI_PLANS[await planOf(db, uid, now)][feature];
    return db.runTransaction(async (tx: any) => {
        const data = (await tx.get(ref)).data() || {}, used = Number(data[feature] || 0);
        if (used >= limit) return -1;
        tx.set(ref, {uid, month, [feature]: used + 1, updatedAt: now}, {merge: true});
        return limit - used - 1;
    });
}
/** No answer came back: the call is given back. */
export async function refundMonthlyQuota(db: any, uid: string, feature: AiMonthlyFeature, now = Date.now()) {
    const ref = db.collection('aiMonthly').doc(`${uid}_${seoulMonth(now)}`);
    try { return await db.runTransaction(async (tx: any) => { const data = (await tx.get(ref)).data(); if (!data) return; tx.set(ref, {[feature]: Math.max(0, Number(data[feature] || 0) - 1), updatedAt: now}, {merge: true}); }); }
    catch (error) { console.warn('AI_REFUND_FAILED', {feature}); throw error; } // recorded (the feature only); callers go on
}
/** 관리자 설정 › AI 사용량: this month's calls by person (name and role from users), most used first. */
export async function readAiMonthly(db: any, actor: any, now = Date.now()) {
    if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN');
    const month = seoulMonth(now), snap = await db.collection('aiMonthly').where('month', '==', month).get();
    const rows = await Promise.all(snap.docs.map(async (d: any) => {
        const x = d.data(), [user, pass] = await Promise.all([db.collection('users').doc(x.uid).get(), db.collection('aiPasses').doc(x.uid).get()]).then(r => r.map((s: any) => s.data() || {}));
        const plan = activePlan(pass, seoulDay(now));
        return {uid: x.uid, name: String(user.alias || user.name || '이름 없음').slice(0, 40), role: String(user.role || ''), plan, analyzer: Number(x.analyzer || 0), workbook: Number(x.workbook || 0), generator: Number(x.generator || 0), petTalk: Number(x.petTalk || 0)};
    }));
    return {month, plans: AI_PLANS, rows: rows.filter(r => r.analyzer + r.workbook + r.generator + r.petTalk > 0).sort((a, b) => (b.analyzer + b.workbook + b.generator + b.petTalk) - (a.analyzer + a.workbook + a.generator + a.petTalk))};
}
/** The admin resets a person's month (both features). */
export async function resetAiMonthly(db: any, actor: any, input: any, now = Date.now()) {
    if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN');
    const uid = String(input?.uid || ''); if (!/^[A-Za-z0-9]{1,128}$/.test(uid)) throw Error('BAD_REQUEST');
    await db.collection('aiMonthly').doc(`${uid}_${seoulMonth(now)}`).set({uid, month: seoulMonth(now), analyzer: 0, workbook: 0, generator: 0, petTalk: 0, petTalkBySlot: {}, resetAt: now, updatedAt: now}, {merge: true});
    return {uid, reset: true};
}

/**
 * The same call, streamed: Gemini's thought summaries are passed to `onThought` as they come (the 지문 분석기 and the
 * 변형문제 생성기 show them while the student waits); the answer text is returned at the end.
 */
export async function generateAiStream(request: any, feature: AiFeature, onThought: (text: string) => void) {
    const config = {...(request.config || {}), thinkingConfig: {...(request.config?.thinkingConfig || {}), includeThoughts: true}};
    const stream = await (await aiClient()).models.generateContentStream({model: AI_MODEL, ...request, config});
    let text = '', usage: any = null;
    for await (const chunk of stream) {
        for (const part of chunk.candidates?.[0]?.content?.parts || []) {
            if (!part.text) continue;
            if (part.thought) onThought(part.text); else text += part.text;
        }
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
    }
    await recordUsage(feature, usage);
    return text;
}

/** 관리자 설정 › AI 사용량 › 패스: people with a pass (current or ended), newest first. */
export async function readAiPasses(db: any, actor: any, now = Date.now()) {
    if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN');
    const snap = await db.collection('aiPasses').get(), today = seoulDay(now);
    const rows = await Promise.all(snap.docs.map(async (d: any) => { const x = d.data(), user = (await db.collection('users').doc(d.id).get()).data() || {};
        return {uid: d.id, name: String(user.alias || user.name || '이름 없음').slice(0, 40), role: String(user.role || ''), plan: x.plan as AiPlan, until: String(x.until || ''), active: activePlan(x, today) !== 'free'}; }));
    return {plans: AI_PLANS, rows: rows.sort((a, b) => b.until.localeCompare(a.until))};
}
/** The admin turns a pass on (until a day, Korea time) or off ('none') for a person. */
export async function setAiPass(db: any, actor: any, input: any, now = Date.now()) {
    if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN');
    const uid = String(input?.uid || ''), plan = String(input?.plan || ''), until = String(input?.until || '');
    if (!/^[A-Za-z0-9]{1,128}$/.test(uid) || !['none', 'pet', 'premium'].includes(plan)) throw Error('BAD_REQUEST');
    if (plan !== 'none' && !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw Error('BAD_REQUEST');
    const userRef = db.collection('users').doc(uid), passRef = db.collection('aiPasses').doc(uid);
    return db.runTransaction(async (tx: any) => {
        if (!(await tx.get(userRef)).exists) throw Error('BAD_REQUEST');
        if (plan === 'none') { tx.delete(passRef); return {uid, plan: 'none'}; }
        tx.set(passRef, {uid, plan, until, setAt: now, setBy: actor.uid || 'admin'});
        return {uid, plan, until};
    });
}
