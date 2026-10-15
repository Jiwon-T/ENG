// The model call and the daily AI count, shared by api/gemini (the Seoul function) and the pet handler it serves.
import { GoogleGenAI } from '@google/genai';

export const AI_MODEL = 'gemini-3-flash-preview';
export const AI_DAILY_LIMIT = 60;
const seoulDay = (at = Date.now()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date(at));

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

