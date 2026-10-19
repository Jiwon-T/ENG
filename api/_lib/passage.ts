// 지문 분석기 (server): one stored analysis per passage (passages/{id}), shared by everyone who analyses the same text.
// The app's own parts (sentences, pauses, grammar marks, words) cost nothing; the AI parts are asked for by button and
// kept once made: 직독직해 (counts as 워크북 AI 해석), 문법·구조 + 서술형 문장, 주제·요지·요약 (each counts as 지문 분석).
// 구조 지도 (each sentence's role and the key sentence) comes with a new 주제·요약 at no extra cost, or alone for an older
// one (counts as 지문 분석); it is kept in its own field (parts.structure), so it never touches the summary or its edits.
// Teachers and the admin see who analysed and who changed what, may fix any part, and choose what students see
// (public). Students see the passages they analysed and the public ones, never names. All access is through here.
import crypto from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { AI_TOO_FAST_MESSAGE, aiErrorCode, guardAiBurst, refundMonthlyQuota, takeMonthlyQuota, type AiMonthlyFeature } from './aiModel.js';
import { COMMON_WORDS, PASSAGE_LIMITS, chunkHints, passageId, passageTokens, wordForms } from '../../src/lib/passageTools.js';
import { splitPassage } from '../../src/lib/workbook.js';
import { STRUCTURE_ROLES, cleanStructure } from '../../src/lib/passageLevel.js';

export const PASSAGES = 'passages', PASSAGE_VIEWS = 'passageViews';
export type PassagePart = 'reading' | 'grammar' | 'summary' | 'structure';
const PART_LABEL: Record<PassagePart | 'words' | 'meta', string> = { reading: '직독직해', grammar: '문법·구조', summary: '주제·요약', structure: '구조 지도', words: '단어', meta: '지문 정보' };
const PART_QUOTA: Record<PassagePart, AiMonthlyFeature> = { reading: 'workbook', grammar: 'analyzer', summary: 'analyzer', structure: 'analyzer' };
export const PASSAGE_MESSAGES: Record<string, string> = {
  PASSAGE_TOO_LONG: `지문은 ${PASSAGE_LIMITS.textChars.toLocaleString('ko-KR')}자, ${PASSAGE_LIMITS.sentences}문장까지 넣을 수 있어요.`,
  PASSAGE_EMPTY: '영어 지문을 넣어 주세요.',
  PASSAGE_NOT_FOUND: '지문을 찾지 못했어요.',
  QUESTIONS_NO_TYPE: '만들 문제 유형을 골라 주세요.',
  QUESTIONS_NOT_SOLVABLE: '이 세트는 화면에서 풀 수 있는 문제가 없어요.',
  ASSIGNMENT_CANCELLED: '선생님이 내주기를 취소한 문제예요.',
  ATTEMPT_NOT_OPEN: '문제를 다시 열어 주세요.',
  ATTEMPT_SUBMITTED: '이미 채점한 문제예요. 결과를 확인해 주세요.',
  ATTEMPT_STALE: '문제가 바뀌었어요. 다시 열어 주세요.',
  ATTEMPT_INCOMPLETE: '모든 문제의 답을 골라 주세요.',
  ATTEMPT_CHECKING: '채점하는 중이에요. 잠시 뒤 다시 눌러 주세요.',
  QUESTIONS_BUNDLE_PICK: '합본으로 묶을 세트를 2~10개 골라 주세요.',
  QUESTIONS_BUNDLE_TOO_BIG: '합본에는 60문제까지 넣을 수 있어요. 세트를 줄여 주세요.',
  QUESTIONS_BUNDLE_NO_MORE: '합본에서 더 만들 지문을 골라 주세요.',
  QUESTIONS_SET_FULL: '한 세트에는 30문제까지 넣을 수 있어요. 새로 만들어 주세요.',
  QUESTIONS_TOO_MANY: '문제 유형은 한 번에 3개까지 고를 수 있어요.',
  QUESTIONS_REDO_BUNDLE: '합본의 문제는 원래 세트에서 다시 만들어 주세요.',
  QUESTIONS_REDO_SAME: '이 지문으로는 다른 문제를 만들지 못했어요. 다시 해 주세요.',
  QUESTIONS_CHANGED: '그 사이 문제가 바뀌었어요. 세트를 다시 열어 주세요.',
  QUESTIONS_EDIT_BAD: '발문, 보기 다섯 개, 정답 번호를 모두 채워 주세요.',
  QUESTIONS_EDIT_CHECK: '고친 문제가 원문과 맞지 않아요.',
  FORBIDDEN: '이 지문은 볼 수 없어요.',
  BAD_REQUEST: '잘못된 요청이에요.',
  PASSAGE_EDIT_MISMATCH: '영어 덩어리를 차례로 이으면 원래 문장과 같아야 해요. 문장 수도 그대로여야 해요.',
  AI_TOO_FAST: AI_TOO_FAST_MESSAGE,
  PASSAGE_AI_MISMATCH: 'AI 답이 문장과 맞지 않았어요. 다시 해 주세요(횟수는 돌려드렸어요).',
  AI_BUSY: '현재 AI 서비스 이용자가 많습니다. 잠시 후 다시 시도해주세요.',
  AI_FAILED: 'AI 분석에 실패했어요. 잠시 후 다시 해 주세요(횟수는 돌려드렸어요).',
};

export interface PassageActor { uid: string; name: string; role: string; staff: boolean; admin: boolean }
/** Who is asking: teachers (with workspace access), principals and the admin are staff. */
export async function passageActor(db: any, uid: string, adminUid?: string): Promise<PassageActor> {
  const admin = Boolean(adminUid) && uid === adminUid;
  const [user, access] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('teacherWorkspaceAccess').doc(uid).get()]);
  const u = user.data() || {}, role = admin ? 'admin' : String(u.role || 'student');
  const staff = admin || (['teacher', 'principal'].includes(role) && access.exists && !access.data()?.disabled);
  return { uid, name: String(u.alias || u.name || '이름 없음').slice(0, 40), role, staff, admin };
}
const who = (a: PassageActor) => ({ uid: a.uid, name: a.name, role: a.role });
const clip = (v: any, n: number) => String(v ?? '').trim().slice(0, n);
const record = (a: PassageActor, action: string, now: number) => ({ at: now, ...who(a), action });
const withHistory = (list: any[], entry: any) => [...(Array.isArray(list) ? list : []), entry].slice(-60);

/** What a person may see of a stored passage: students never get names or the change record. */
const NAME_FIELDS = new Set(['by', 'editedBy']);
function view(d: any, a: PassageActor) {
  const parts = a.staff ? d.parts || {} : Object.fromEntries(Object.entries(d.parts || {}).map(([k, v]: [string, any]) => [k, Object.fromEntries(Object.entries(v || {}).filter(([f]) => !NAME_FIELDS.has(f)))]));
  const base = { id: d.id, text: d.text, sentences: d.sentences, hints: d.sentences.map(chunkHints), title: d.title || '', examInfo: d.examInfo || '', public: Boolean(d.public), parts, updatedAt: d.updatedAt };
  return a.staff ? { ...base, createdBy: d.createdBy, history: d.history || [] } : base;
}
/** Who may open a stored passage: staff, a public one, or one this student analysed. */
export async function canSeePassage(db: any, a: PassageActor, d: any) { return canSee(db, a, d); }
async function canSee(db: any, a: PassageActor, d: any) {
  if (a.staff || d.public) return true;
  return (await db.collection(PASSAGE_VIEWS).doc(`${a.uid}_${d.id}`).get()).exists;
}

/** Analyse (open) a passage: the stored one when it exists, otherwise a new record (no AI). */
export async function openPassage(db: any, a: PassageActor, input: any, now = Date.now()) {
  const text = String(input?.text || '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw Error('PASSAGE_EMPTY');
  if (text.length > PASSAGE_LIMITS.textChars) throw Error('PASSAGE_TOO_LONG');
  const sentences = splitPassage(text);
  if (sentences.length > PASSAGE_LIMITS.sentences) throw Error('PASSAGE_TOO_LONG'); // never cut: the rest would be missed
  if (!sentences.length || !/[A-Za-z]/.test(text)) throw Error('PASSAGE_EMPTY');
  const id = passageId(sentences), ref = db.collection(PASSAGES).doc(id);
  const stored = await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (snap.exists) return { ...snap.data(), id, reused: true };
    const doc = { id, text, sentences, title: '', examInfo: '', public: false, parts: {}, createdBy: { ...who(a), at: now }, createdAt: now, updatedAt: now, history: [record(a, '지문 분석 시작', now)] };
    tx.set(ref, doc);
    return { ...doc, reused: false };
  });
  // Students keep a list of what they analysed (the passage id only).
  if (!a.staff) await db.collection(PASSAGE_VIEWS).doc(`${a.uid}_${id}`).set({ uid: a.uid, passageId: id, at: now });
  return { passage: view(stored, a), reused: stored.reused };
}

export async function readPassage(db: any, a: PassageActor, id: string) {
  const snap = await db.collection(PASSAGES).doc(String(id || '').slice(0, 64)).get();
  if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
  const d = { ...snap.data(), id: snap.id };
  if (!(await canSee(db, a, d))) throw Error('FORBIDDEN');
  return { passage: view(d, a) };
}

/** 지문 보관함: staff see every passage (names included); students the public ones and their own. */
export const PASSAGE_PAGE = 100;
export async function listPassages(db: any, a: PassageActor, input: any = {}) {
  const row = (d: any) => ({ id: d.id, title: d.title || '', examInfo: d.examInfo || '', first: String(d.sentences?.[0] || '').slice(0, 120), public: Boolean(d.public), parts: Object.keys(d.parts || {}), updatedAt: d.updatedAt || 0,
    ...(a.staff ? { createdBy: d.createdBy || null, lastChange: (d.history || []).slice(-1)[0] || null } : {}) });
  if (a.staff) {
    // Newest first by (updatedAt, id). The cursor carries the last row's values as shown, so a passage changed while
    // paging never moves the page boundary (ties are never skipped either).
    let q = db.collection(PASSAGES).orderBy('updatedAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    const at = Number(input?.after?.at), afterId = String(input?.after?.id || '').slice(0, 64);
    if (Number.isFinite(at) && afterId) q = q.startAfter(at, afterId);
    const snap = await q.limit(PASSAGE_PAGE).get(), rows = snap.docs.map((s: any) => row({ ...s.data(), id: s.id }));
    const last = rows[rows.length - 1];
    return { rows, more: rows.length === PASSAGE_PAGE ? { at: last.updatedAt, id: last.id } : null };
  }
  const [pub, mine] = await Promise.all([db.collection(PASSAGES).where('public', '==', true).limit(300).get(), db.collection(PASSAGE_VIEWS).where('uid', '==', a.uid).limit(300).get()]);
  const own = await Promise.all(mine.docs.map(async (v: any) => { const s = await db.collection(PASSAGES).doc(v.data().passageId).get(); return s.exists ? { ...row({ ...s.data(), id: s.id }), analysedAt: v.data().at } : null; }));
  return { public: pub.docs.map((s: any) => row({ ...s.data(), id: s.id })).sort((x: any, y: any) => y.updatedAt - x.updatedAt), mine: own.filter(Boolean).sort((x: any, y: any) => y.analysedAt - x.analysedAt) };
}

/* ------------------------------------------------------------------ AI parts */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); // words must match one by one ("a man" is not "aman")
export function readingRequest(sentences: string[]) {
  return {
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(sentences.map(s => ({ sentence: s, hint: chunkHints(s) }))) }] }],
    config: {
      systemInstruction: '너는 한국 고등학생에게 영어 지문을 직독직해로 가르치는 선생님이야. 입력은 문장 배열이고, 각 문장에는 앱이 미리 끊어 본 힌트가 있어(더 자연스럽게 고쳐도 돼). 각 문장을 의미 단위(보통 2~7단어)로 끊고, 덩어리마다 그 덩어리만의 우리말 뜻을 영어 어순 그대로 붙여. 덩어리 영어를 차례로 이으면 원래 문장과 정확히 같아야 해(단어를 바꾸거나 빼거나 더하지 마). 그리고 문장 전체의 자연스러운 해석도 줘. 같은 순서, 같은 개수로.',
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { sentences: { type: 'ARRAY', items: { type: 'OBJECT', properties: { chunks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { en: { type: 'STRING' }, ko: { type: 'STRING' } }, required: ['en', 'ko'] } }, ko: { type: 'STRING' } }, required: ['chunks', 'ko'] } } }, required: ['sentences'] },
      temperature: 0.2, maxOutputTokens: 16384, thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}
export function grammarRequest(sentences: string[]) {
  return {
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(sentences) }] }],
    config: {
      systemInstruction: '너는 한국 고등학생에게 영어 문법과 문장 구조를 가르치는 선생님이야. 입력은 지문의 문장 배열이야. 문장마다 structure(문장 성분을 S, V, O, C, M으로 짧게 표시, 예: "S(Many people) V(believe) O(that절)")와 points(꼭 알아야 할 문법 포인트 1~3개, 한국어로 짧고 정확하게)를 줘. 그리고 서술형(영작, 어순 배열, 문법 서술) 문제에 가장 나올 법한 문장 하나를 골라 essay.index(0부터)와 essay.reason(한두 문장)에 적어. 같은 순서, 같은 개수로.',
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { sentences: { type: 'ARRAY', items: { type: 'OBJECT', properties: { structure: { type: 'STRING' }, points: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['structure', 'points'] } }, essay: { type: 'OBJECT', properties: { index: { type: 'INTEGER' }, reason: { type: 'STRING' } }, required: ['index', 'reason'] } }, required: ['sentences', 'essay'] },
      temperature: 0.2, maxOutputTokens: 16384, thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}
const STRUCTURE_HELP = `문장마다 역할(roles, 문장 순서대로 같은 개수)을 다음 중 하나로 줘: ${STRUCTURE_ROLES.join(', ')}. 딱 맞는 역할이 없으면 빈 문자열("")로 둬. 같은 역할이 여러 문장에 와도 돼. key는 글의 핵심 문장의 번호(0부터 센 index) 하나야.`;
const STRUCTURE_SCHEMA = { type: 'OBJECT', properties: { roles: { type: 'ARRAY', items: { type: 'STRING' } }, key: { type: 'INTEGER' } }, required: ['roles', 'key'] };
/** `sentences` (when given) are numbered from 0 for the 구조 지도 that comes with the summary. */
export function summaryRequest(text: string, sentences?: string[]) {
  return {
    contents: [{ role: 'user', parts: [{ text: sentences ? JSON.stringify({ text, sentences: sentences.map((sentence, index) => ({ index, sentence })) }) : text }] }],
    config: {
      systemInstruction: '너는 한국 고등학생에게 영어 독해를 가르치는 선생님이야. 지문의 제목(한국어 title, 영어 englishTitle), 주제(topic), 요지(mainIdea), 요약(summary, 3~4문장), 글의 전개 방식(logic, 짧게)을 줘. topic·mainIdea·summary는 한국어 ko와 영어 en을 모두 써.' + (sentences ? ` 그리고 structure에 글의 구조를 줘. ${STRUCTURE_HELP}` : ''),
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { title: { type: 'STRING' }, englishTitle: { type: 'STRING' }, topic: { type: 'OBJECT', properties: { ko: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['ko', 'en'] }, mainIdea: { type: 'OBJECT', properties: { ko: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['ko', 'en'] }, summary: { type: 'OBJECT', properties: { ko: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['ko', 'en'] }, logic: { type: 'STRING' }, ...(sentences ? { structure: STRUCTURE_SCHEMA } : {}) }, required: ['title', 'englishTitle', 'topic', 'mainIdea', 'summary', 'logic'] },
      temperature: 0.3, maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}

/** 구조 지도 alone, for a passage whose 주제·요약 was made before it existed. */
export function structureRequest(sentences: string[]) {
  return {
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(sentences.map((sentence, index) => ({ index, sentence }))) }] }],
    config: {
      systemInstruction: `너는 한국 고등학생에게 영어 독해를 가르치는 선생님이야. 입력은 지문의 문장 배열(index는 0부터)이야. 글의 구조를 줘. ${STRUCTURE_HELP}`,
      responseMimeType: 'application/json', responseSchema: STRUCTURE_SCHEMA,
      temperature: 0.2, maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: 'LOW' },
    },
  };
}

const pair = (x: any) => ({ ko: clip(x?.ko, 1500), en: clip(x?.en, 1500) });
/** Check and tidy an AI part (or a teacher's edit) against the passage. Throws PASSAGE_AI_MISMATCH / BAD_REQUEST. */
export function cleanPart(part: PassagePart, data: any, sentences: string[], fail = 'PASSAGE_AI_MISMATCH') {
  if (part === 'structure') { const map = cleanStructure(data, sentences.length); if (!map) throw Error(fail); return map; }
  if (part === 'reading') {
    const list = Array.isArray(data?.sentences) ? data.sentences : [];
    if (list.length !== sentences.length) throw Error(fail);
    return { sentences: list.map((x: any, i: number) => {
      const chunks = (Array.isArray(x?.chunks) ? x.chunks : []).map((c: any) => ({ en: clip(c?.en, 300), ko: clip(c?.ko, 300) })).filter((c: any) => c.en);
      // The pieces must give the sentence back (letters and numbers compared; spaces and marks may differ).
      if (!chunks.length || norm(chunks.map((c: any) => c.en).join(' ')) !== norm(sentences[i])) throw Error(fail);
      return { chunks, ko: clip(x?.ko, 1500) };
    }) };
  }
  if (part === 'grammar') {
    const list = Array.isArray(data?.sentences) ? data.sentences : [];
    if (list.length !== sentences.length) throw Error(fail);
    const index = Number(data?.essay?.index);
    return { sentences: list.map((x: any) => ({ structure: clip(x?.structure, 600), points: (Array.isArray(x?.points) ? x.points : []).map((p: any) => clip(p, 300)).filter(Boolean).slice(0, 5) })),
      essay: { index: Number.isInteger(index) && index >= 0 && index < sentences.length ? index : 0, reason: clip(data?.essay?.reason, 600) } };
  }
  return { title: clip(data?.title, 120), englishTitle: clip(data?.englishTitle, 200), topic: pair(data?.topic), mainIdea: pair(data?.mainIdea), summary: pair(data?.summary), logic: clip(data?.logic, 200) };
}

/**
 * Ask for an AI part. Already made (by anyone) → returned at once, nothing counted. Otherwise the monthly count
 * (워크북 or 지문 분석; none for the admin) and the daily AI count are taken; a failed or mismatched answer gives the
 * monthly one back. If someone saved the same part meanwhile, theirs is kept and this call is given back.
 */
export async function askPassagePart(db: any, a: PassageActor, input: any, generate: (request: any) => Promise<string>, now = Date.now()) {
  const part = input?.part as PassagePart;
  if (!['reading', 'grammar', 'summary', 'structure'].includes(part)) throw Error('BAD_REQUEST');
  const ref = db.collection(PASSAGES).doc(String(input?.id || '').slice(0, 64)), snap = await ref.get();
  if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
  const d = { ...snap.data(), id: snap.id };
  if (!(await canSee(db, a, d))) throw Error('FORBIDDEN');
  if (d.parts?.[part]) return { passage: view(d, a), left: null, reused: true };
  const quota = PART_QUOTA[part];
  let left: number | null = null;
  if (!a.admin) {
    await guardAiBurst(db, a.uid, now);
    left = await takeMonthlyQuota(db, a.uid, quota, now);
    if (left < 0) { const e: any = Error('AI_MONTHLY_LIMIT'); e.feature = quota; throw e; }
  }
  const giveBack = () => a.admin ? undefined : refundMonthlyQuota(db, a.uid, quota, now).catch(() => undefined);
  let data: any, structure: any = null;
  try {
    const request = part === 'reading' ? readingRequest(d.sentences) : part === 'grammar' ? grammarRequest(d.sentences) : part === 'structure' ? structureRequest(d.sentences) : summaryRequest(d.text, d.sentences);
    const text = await generate(request).catch((error: any) => { throw Error(aiErrorCode(error)); });
    let parsed: any; try { parsed = JSON.parse(text); } catch { throw Error('PASSAGE_AI_MISMATCH'); }
    data = cleanPart(part, parsed, d.sentences);
    if (part === 'summary') structure = cleanStructure(parsed?.structure, d.sentences.length); // a bad map is left out; the summary still counts
  } catch (error: any) { await giveBack(); throw Error(PASSAGE_MESSAGES[error?.message] ? error.message : 'AI_FAILED'); }
  let saved: any;
  try { saved = await db.runTransaction(async (tx: any) => {
    const fresh = (await tx.get(ref)).data();
    if (fresh.parts?.[part]) return { ...fresh, id: d.id, raced: true };
    const extra = structure && !fresh.parts?.structure ? { structure: { ...structure, by: who(a), at: now } } : {};
    const next = { ...fresh, parts: { ...(fresh.parts || {}), [part]: { ...data, by: who(a), at: now }, ...extra }, updatedAt: now, history: withHistory(fresh.history, record(a, `${PART_LABEL[part]} 받음`, now)) };
    tx.set(ref, next);
    return { ...next, id: d.id };
  }); } catch (error) { await giveBack(); throw error; } // not saved: the count is given back
  if (saved.raced) { await giveBack(); return { passage: view(saved, a), left: null, reused: true }; }
  return { passage: view(saved, a), left, reused: false };
}

/* ------------------------------------------------------------------ words (학원 단어 세트) */

/** The academy's words → meanings, with `version` (a hash of the content) so stored passage words know when they're old. */
export type WordIndex = Map<string, string> & { version?: string };
let wordIndex: { at: number; map: Promise<WordIndex> } | null = null;
/** Every word with a meaning in the academy's word sets (단어장·시험기간, plain word sets), cached for 10 minutes per
 *  server instance; calls that arrive together share one load. Words are worked out once per passage and stored. */
export function loadWordIndex(db: any, now = Date.now()) {
  if (wordIndex && now - wordIndex.at < 600_000) return wordIndex.map;
  const map = readWordIndex(db, now);
  wordIndex = { at: now, map };
  map.catch(() => { if (wordIndex?.map === map) wordIndex = null; });
  return map;
}
/** The word index is also kept in Firestore (passageWordIndex: `meta` + chunks of words), so a new server instance reads
 *  a few documents instead of every word of every set. It is rebuilt when a set is added or removed, when a set's word
 *  count changes (counted, not read: 1 read per 1,000 words), or once a day (meanings edited in place). */
export const WORD_INDEX = 'passageWordIndex', WORD_INDEX_MAX_AGE = 24 * 3_600_000, WORD_INDEX_CHUNK_BYTES = 600_000;
async function readWordIndex(db: any, now: number): Promise<WordIndex> {
  const books = await db.collection('wordbooks').get();
  const plain = books.docs.filter((b: any) => { const x = b.data() || {}; return ['word', 'exam', undefined].includes(x.category) && (!x.type || x.type === 'standard'); });
  const counts: number[] = await Promise.all(plain.map((b: any) => db.collection(`wordbooks/${b.id}/words`).count().get().then((c: any) => Number(c.data().count) || 0)));
  const sig = plain.map((b: any, i: number) => `${b.id}:${counts[i]}`).join('|'), metaRef = db.collection(WORD_INDEX).doc('meta'), meta = (await metaRef.get()).data();
  if (meta?.sig === sig && now - Number(meta.builtAt || 0) < WORD_INDEX_MAX_AGE) {
    const parts = await Promise.all(Array.from({ length: Number(meta.chunks) || 0 }, (_, i) => db.collection(WORD_INDEX).doc(`c${i}`).get()));
    if (parts.every((d: any) => d.exists)) {
      const map: WordIndex = new Map<string, string>();
      for (const d of parts) { const { words = [], meanings = [] } = d.data(); words.forEach((w: string, i: number) => map.set(w, meanings[i])); }
      map.version = String(meta.version || '');
      return map;
    }
  }
  const map: WordIndex = new Map<string, string>();
  const lists = await Promise.all(plain.map((b: any) => db.collection(`wordbooks/${b.id}/words`).get()));
  for (const list of lists) for (const w of list.docs) {
    const x = w.data() || {}, word = String(x.word || '').trim().toLowerCase(), meaning = String(x.meaning || '').trim();
    if (word && meaning && word.length <= 60 && !map.has(word)) map.set(word, meaning.slice(0, 120));
  }
  map.version = crypto.createHash('sha1').update(JSON.stringify([...map])).digest('hex').slice(0, 16);
  // Saved for the next instance (a failure only means the next one reads the words again).
  try {
    // Chunks by size (UTF-8 bytes, well under Firestore's 1 MiB per document), not by count: long Korean meanings fit too.
    const entries = [...map], groups: [string, string][][] = [[]]; let bytes = 0;
    for (const e of entries) { const size = Buffer.byteLength(e[0]) + Buffer.byteLength(e[1]) + 16; if (bytes + size > WORD_INDEX_CHUNK_BYTES && groups.at(-1)!.length) { groups.push([]); bytes = 0; } groups.at(-1)!.push(e); bytes += size; }
    await db.runTransaction(async (tx: any) => {
      groups.forEach((part, i) => tx.set(db.collection(WORD_INDEX).doc(`c${i}`), { words: part.map(e => e[0]), meanings: part.map(e => e[1]) }));
      tx.set(metaRef, { sig, builtAt: now, chunks: groups.length, words: entries.length, version: map.version });
    });
  } catch { console.warn('PASSAGE_WORD_INDEX_SAVE_FAILED'); }
  return map;
}
export const resetWordIndex = () => { wordIndex = null; };

/** ③ 단어: words of the passage found in the academy's sets (with the form seen), and the rest as "모르는 단어". */
export function passageWords(text: string, index: Map<string, string>) {
  const low = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ')} `, known: { word: string; meaning: string; seen: string }[] = [], unknown: string[] = [];
  const seen = new Set<string>();
  // Phrases first (e.g. "take part in"), then single words by their forms.
  for (const [word, meaning] of index) if (word.includes(' ') && low.includes(` ${word} `)) { known.push({ word, meaning, seen: word }); word.split(' ').forEach(w => seen.add(w)); }
  for (const token of passageTokens(text)) {
    if (seen.has(token)) continue;
    seen.add(token);
    const form = wordForms(token).find(f => index.has(f));
    if (form) { if (!known.some(k => k.word === form)) known.push({ word: form, meaning: index.get(form)!, seen: token }); }
    else if (token.length > 3 && !COMMON_WORDS.has(token) && !wordForms(token).some(f => COMMON_WORDS.has(f))) unknown.push(token);
  }
  return { known: known.slice(0, 120), unknown: unknown.slice(0, 60) };
}
/** Words are worked out per passage and stored (no AI, nothing counted); worked out again when the academy's word sets
 *  changed since (the index version), so an edited meaning reaches passages analysed before. */
export async function passageWordsPart(db: any, a: PassageActor, id: string, now = Date.now()) {
  const ref = db.collection(PASSAGES).doc(String(id || '').slice(0, 64)), snap = await ref.get();
  if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
  const d = { ...snap.data(), id: snap.id };
  if (!(await canSee(db, a, d))) throw Error('FORBIDDEN');
  const index = await loadWordIndex(db, now);
  if (d.parts?.words && d.parts.words.version === index.version) return { passage: view(d, a) };
  const words = passageWords(d.text, index);
  const next = await db.runTransaction(async (tx: any) => {
    const fresh = (await tx.get(ref)).data();
    if (fresh.parts?.words && fresh.parts.words.version === index.version) return { ...fresh, id: d.id };
    const merged = { ...fresh, parts: { ...(fresh.parts || {}), words: { ...words, at: now, version: index.version } } };
    tx.set(ref, merged);
    return { ...merged, id: d.id };
  });
  return { passage: view(next, a) };
}

/* ------------------------------------------------------------------ staff edits */

/** Teachers and the admin fix a part (the edit becomes what everyone sees; the change is recorded with their name). */
export async function editPassagePart(db: any, a: PassageActor, input: any, now = Date.now()) {
  if (!a.staff) throw Error('FORBIDDEN');
  const part = input?.part as PassagePart;
  if (!['reading', 'grammar', 'summary'].includes(part)) throw Error('BAD_REQUEST');
  const ref = db.collection(PASSAGES).doc(String(input?.id || '').slice(0, 64));
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
    const d = snap.data(), data = cleanPart(part, input?.data, d.sentences, 'PASSAGE_EDIT_MISMATCH');
    const note = clip(input?.note, 60);
    const next = { ...d, parts: { ...(d.parts || {}), [part]: { ...data, by: d.parts?.[part]?.by || who(a), at: d.parts?.[part]?.at || now, editedBy: who(a), editedAt: now } }, updatedAt: now,
      history: withHistory(d.history, record(a, `${PART_LABEL[part]} 고침${note ? ` (${note})` : ''}`, now)) };
    tx.set(ref, next);
    return { passage: view({ ...next, id: snap.id }, a) };
  });
}
/** Title, exam info and whether students see it (staff only). */
export async function setPassageInfo(db: any, a: PassageActor, input: any, now = Date.now()) {
  if (!a.staff) throw Error('FORBIDDEN');
  const ref = db.collection(PASSAGES).doc(String(input?.id || '').slice(0, 64));
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw Error('PASSAGE_NOT_FOUND');
    const d = snap.data(), changes: string[] = [], next: any = { ...d };
    if (typeof input?.title === 'string' && clip(input.title, 120) !== (d.title || '')) { next.title = clip(input.title, 120); changes.push('제목'); }
    if (typeof input?.examInfo === 'string' && clip(input.examInfo, 120) !== (d.examInfo || '')) { next.examInfo = clip(input.examInfo, 120); changes.push('시험 정보'); }
    if (typeof input?.public === 'boolean' && input.public !== Boolean(d.public)) { next.public = input.public; changes.push(input.public ? '학생 공개' : '비공개로'); }
    if (!changes.length) return { passage: view({ ...d, id: snap.id }, a) };
    next.updatedAt = now; next.history = withHistory(d.history, record(a, changes.join(' · '), now));
    tx.set(ref, next);
    return { passage: view({ ...next, id: snap.id }, a) };
  });
}
