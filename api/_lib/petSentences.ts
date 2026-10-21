// 원정대 문장 세트: the admin picks up to two 문장 세트 for each school grade (초등–고3; sentences come from both). 문장 배열
// and 낭독 stages ask from the player's grade: unknown grades use 중1, teachers 고3, an empty 초등 uses 중1 and any other
// empty grade falls back to 고3 (then no sentences: those questions become word games). A grade saved before as one set
// (a string) still reads as that one set.
import {FieldPath} from 'firebase-admin/firestore';
import {SENTENCE_GRADES, type SentenceGrade} from '../../src/lib/petCatalog.js';
import {gradeOf} from '../../src/lib/schoolGrade.js';
import {randomDocId, type FeedSentence} from './petWordFeed.js';
import {climber} from './petTower.js';

export const PET_EXPEDITION_SETTINGS = 'petExpeditionSettings';
const SENTENCE_WINDOW = 60;
const showSentence = (t: string) => t.replace(/\s*\/\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();

/** The grade whose set this player uses. */
export function sentenceGradeFor(displayName: string, teacher = false): SentenceGrade {
  if (teacher) return '고3';
  const g = gradeOf(displayName);
  if (g?.startsWith('초')) return '초등';
  return g && (SENTENCE_GRADES as readonly string[]).includes(g) ? g as SentenceGrade : '중1';
}
const isSentenceSet = (b: any) => Boolean(b) && b.type === 'sentence';
export const SENTENCE_SETS_PER_GRADE = 2;
/** The sets saved for one grade: a list (now) or one id (saved before), up to two. */
export const setsOf = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : typeof v === 'string' ? [v] : []).filter((id): id is string => typeof id === 'string' && Boolean(id.trim())).map(id => id.trim()))].slice(0, SENTENCE_SETS_PER_GRADE);

/** A window of each of the player's 문장 세트 (from a random place, to keep reads small; with two sets, half from each);
 *  [] when none is set. */
export async function loadSentencesFor(db: any, uid: string, rand: () => number = Math.random): Promise<FeedSentence[]> {
  const settings = (await db.collection(PET_EXPEDITION_SETTINGS).doc('main').get()).data()?.sentences || {}, who = await climber(db, uid);
  // an empty grade uses 고3 (초등: 중1 first, then 고3)
  const grade = sentenceGradeFor(who.name, who.teacher), own = setsOf(settings[grade]), middle = grade === '초등' ? setsOf(settings['중1']) : [];
  const picked = own.length ? own : middle.length ? middle : setsOf(settings['고3']);
  const ids = (await Promise.all(picked.map(async id => isSentenceSet((await db.collection('wordbooks').doc(id).get()).data()) ? id : ''))).filter(Boolean);
  if (!ids.length) return [];
  const size = Math.ceil(SENTENCE_WINDOW / ids.length);
  const windows = await Promise.all(ids.map(async id => {
    const words = db.collection('wordbooks').doc(id).collection('words'), start = randomDocId(rand);
    const first = await words.orderBy(FieldPath.documentId()).startAt(start).limit(size).get();
    const rest = first.size < size ? await words.orderBy(FieldPath.documentId()).limit(size - first.size).get() : {docs: []};
    return [...first.docs, ...rest.docs];
  }));
  const out: FeedSentence[] = [];
  ids.forEach((id, i) => {
    const seen = new Set<string>();
    for (const d of windows[i]) {
      if (seen.has(d.id)) continue; seen.add(d.id);
      const x = d.data() || {}, raw = String(x.word || '').trim(), meaning = String(x.meaning || '').trim();
      if (raw && meaning && /[a-z]/i.test(raw)) out.push({wordbookId: id, text: showSentence(raw), chunked: raw, meaning: showSentence(meaning)});
    }
  });
  return out;
}

function admin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
/** 관리자 설정 › 원정대 문장 세트: the chosen sets (up to two) for each grade and the 문장 세트 to choose from. */
export async function readExpeditionSettings(db: any, actor: any) {
  admin(actor);
  const [settings, books] = await Promise.all([db.collection(PET_EXPEDITION_SETTINGS).doc('main').get(), db.collection('wordbooks').get()]);
  const list = books.docs.map((d: any) => ({id: d.id, ...d.data()})).filter(isSentenceSet).map((b: any) => ({id: b.id, title: String(b.title || '제목 없음')})).sort((a: any, b: any) => a.title.localeCompare(b.title, 'ko'));
  const s = settings.data()?.sentences || {};
  return {sentences: Object.fromEntries(SENTENCE_GRADES.map(g => [g, setsOf(s[g])])), sets: list};
}
export async function saveExpeditionSettings(db: any, actor: any, input: any) {
  admin(actor);
  // A grade left out of the request (an older screen still open) keeps what it had; read and written in one transaction
  // so two screens saving at once never put back an older value.
  const sent = input?.sentences || {}, chosen: Record<string, string[]> = {};
  for (const g of SENTENCE_GRADES) {
    if (!Object.hasOwn(sent, g)) continue;
    if (Array.isArray(sent[g]) && sent[g].filter(Boolean).length > SENTENCE_SETS_PER_GRADE) throw Error('BAD_REQUEST');
    const ids = setsOf(sent[g]); // one id (an older screen) or a list
    for (const id of ids) if (!isSentenceSet((await db.collection('wordbooks').doc(id).get()).data())) throw Error('BAD_REQUEST');
    chosen[g] = ids;
  }
  const ref = db.collection(PET_EXPEDITION_SETTINGS).doc('main');
  const next = await db.runTransaction(async (tx: any) => {
    const old = (await tx.get(ref)).data()?.sentences || {}, merged: Record<string, string[]> = {};
    for (const g of SENTENCE_GRADES) merged[g] = Object.hasOwn(chosen, g) ? chosen[g] : setsOf(old[g]);
    tx.set(ref, {sentences: merged, updatedAt: Date.now(), updatedBy: actor.uid || 'admin'});
    return merged;
  });
  return {sentences: next};
}
