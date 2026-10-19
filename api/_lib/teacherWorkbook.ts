// 워크북 만들기: AI 해석과 같은 지문의 재생성 기록. Every signed-in account (students too, for 선생님 인증); AI calls have a
// monthly limit by plan (the admin none).
// Nothing here changes lesson or student data; history lives in workbookHistory/{uid}:{passageKey} (server only).
import {aiErrorCode as modelErrorCode} from './aiModel.js';
import {z} from 'zod';
import {WORKBOOK_LIMITS} from '../../src/lib/workbook.js';

export const WORKBOOK_HISTORY = 'workbookHistory';
const KEEP_VERSIONS = 10;
/** A signed-in account (each keeps its own history). */
const onlyAdmin = (actor: any) => { if (!actor?.uid) throw Error('FORBIDDEN'); };
const sentencesSchema = z.array(z.string().trim().min(1).max(WORKBOOK_LIMITS.sentenceChars)).min(1).max(WORKBOOK_LIMITS.sentences);
const keySchema = z.string().regex(/^[a-z0-9]{6,40}$/);

export const WORKBOOK_AI_MESSAGES: Record<string, string> = {
  FORBIDDEN: '로그인한 뒤에 쓸 수 있어요.', AI_MONTHLY_LIMIT: '이번 달 워크북 AI 해석 횟수를 다 썼어요. 더 필요하면 관리자 선생님께 말씀해 주세요.', INVALID_INPUT: '해석할 문장을 다시 확인해 주세요 (1~80문장, 문장마다 600자 이하).',
  WORKBOOK_TRANSLATE_FAILED: 'AI 해석을 받지 못했어요. 잠시 후 다시 해 주세요.', WORKBOOK_TRANSLATE_MISMATCH: 'AI 해석 개수가 문장 수와 맞지 않아 넣지 않았어요. 다시 해 주세요.',
  AI_NOT_CONFIGURED: 'AI 연결 설정이 없어요. 관리자에게 확인해 주세요.', AI_MODEL_NOT_FOUND: 'AI 모델을 찾지 못했어요. 모델 이름이나 지역 설정을 확인해 주세요.', AI_REGION_UNSUPPORTED: 'AI 서버가 이 서버 지역에서는 쓸 수 없다고 거절했어요. 서버 지역 설정을 확인해 주세요.',
  AI_BUSY: 'AI 서버가 바빠요. 잠시 후 다시 해 주세요.', AI_QUOTA: 'AI 사용 한도에 걸렸어요. 잠시 후 다시 하거나 요금 설정을 확인해 주세요.',
};

/** What went wrong with a model call, as a code the screen can explain (never the prompt or the reply). Gemini refuses
 *  calls from regions it does not serve (for example Hong Kong, hkg1) with "User location is not supported". */
export const aiErrorCode = (error: any) => modelErrorCode(error, 'WORKBOOK_TRANSLATE_FAILED');

/** Korean translations for the given English sentences, one each, in the same order (the teacher reviews them). */
/** `generate` is the server model call (api/gemini, which runs in a region Gemini serves). */
export async function translateWorkbook(actor: any, input: any, generate: (request: any) => Promise<string>) {
  onlyAdmin(actor);
  const sentences = sentencesSchema.parse(input?.sentences);
  const text = await generate({
    contents: [{role: 'user', parts: [{text: JSON.stringify(sentences)}]}],
    config: {
      systemInstruction: '너는 한국 고등학생용 영어 워크북의 해석을 쓰는 선생님이야. 입력은 영어 문장 배열이야. 각 문장을 자연스럽고 정확한 한국어 한 문장으로 옮겨, 같은 순서와 같은 개수의 배열로 돌려줘. 문장을 합치거나 나누거나 빼지 말고, 설명이나 번호를 붙이지 마.',
      responseMimeType: 'application/json',
      responseSchema: {type: 'OBJECT', properties: {translations: {type: 'ARRAY', items: {type: 'STRING'}}}, required: ['translations']},
      temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: {thinkingLevel: 'LOW'},
    },
  }).catch((error: any) => { throw Error(aiErrorCode(error)); });
  let parsed: any; try { parsed = JSON.parse(text); } catch { throw Error('WORKBOOK_TRANSLATE_FAILED'); }
  const translations = Array.isArray(parsed?.translations) ? parsed.translations.map((t: any) => String(t ?? '').trim()) : [];
  // One translation per sentence or nothing: a shifted list would pair translations with the wrong sentences.
  if (translations.length !== sentences.length || translations.some((t: string) => !t)) throw Error('WORKBOOK_TRANSLATE_MISMATCH');
  return {translations};
}

/** Blank positions and arrange orders of the earlier versions of this passage (newest last), and the next version number. */
export async function readWorkbookHistory(db: any, actor: any, keyInput: unknown) {
  onlyAdmin(actor);
  const key = keySchema.parse(keyInput), data = (await db.collection(WORKBOOK_HISTORY).doc(`${actor.uid}:${key}`).get()).data();
  const versions = Array.isArray(data?.versions) ? data.versions : [];
  const decode = (rows: unknown) => (Array.isArray(rows) ? rows : []).map(r => String(r || '').split(',').filter(Boolean).map(Number).filter(Number.isInteger));
  return {nextVersion: (Number(data?.version) || 0) + 1, blanks: versions.map((v: any) => decode(v.blanks)), orders: versions.map((v: any) => decode(v.orders))};
}

const indexList = z.array(z.number().int().min(0).max(400)).max(400);
const saveSchema = z.object({key: keySchema, title: z.string().trim().max(120).default(''), blanks: z.array(indexList).min(1).max(WORKBOOK_LIMITS.sentences), orders: z.array(indexList).min(1).max(WORKBOOK_LIMITS.sentences)}).strict();
/** Remember what this version used, so the next one of the same passage picks other blanks and orders. Firestore has
 *  no arrays inside arrays, so each sentence's list is kept as "1,4,7". */
export async function saveWorkbookVersion(db: any, actor: any, input: any, now = Date.now()) {
  onlyAdmin(actor);
  const v = saveSchema.parse(input);
  if (v.blanks.length !== v.orders.length) throw Error('INVALID_INPUT');
  const ref = db.collection(WORKBOOK_HISTORY).doc(`${actor.uid}:${v.key}`);
  return db.runTransaction(async (tx: any) => {
    const old = (await tx.get(ref)).data(), version = (Number(old?.version) || 0) + 1;
    const versions = [...(Array.isArray(old?.versions) ? old.versions : []), {version, at: now, title: v.title, sentences: v.blanks.length, blanks: v.blanks.map(r => r.join(',')), orders: v.orders.map(r => r.join(','))}].slice(-KEEP_VERSIONS);
    tx.set(ref, {ownerUid: actor.uid, key: v.key, version, title: v.title, updatedAt: now, versions});
    return {version};
  });
}
