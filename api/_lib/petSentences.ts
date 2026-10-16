// 원정대 문장 세트: the admin picks one 문장 세트 for each school grade (중1–고3). 문장 배열 and 낭독 stages ask from the
// player's grade: 초등 and unknown grades use 중1, teachers 고3, and a grade left empty falls back to 고3 (then no
// sentences: those questions become word games).
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
  return g && (SENTENCE_GRADES as readonly string[]).includes(g) ? g as SentenceGrade : '중1';
}
const isSentenceSet = (b: any) => Boolean(b) && b.type === 'sentence';

/** A window of the player's 문장 세트 (from a random place, to keep reads small); [] when none is set. */
export async function loadSentencesFor(db: any, uid: string, rand: () => number = Math.random): Promise<FeedSentence[]> {
  const settings = (await db.collection(PET_EXPEDITION_SETTINGS).doc('main').get()).data()?.sentences || {}, who = await climber(db, uid);
  const grade = sentenceGradeFor(who.name, who.teacher), id = String(settings[grade] || settings['고3'] || '');
  if (!id || !isSentenceSet((await db.collection('wordbooks').doc(id).get()).data())) return [];
  const words = db.collection('wordbooks').doc(id).collection('words'), start = randomDocId(rand);
  const first = await words.orderBy(FieldPath.documentId()).startAt(start).limit(SENTENCE_WINDOW).get();
  const rest = first.size < SENTENCE_WINDOW ? await words.orderBy(FieldPath.documentId()).limit(SENTENCE_WINDOW - first.size).get() : {docs: []};
  const seen = new Set<string>(), out: FeedSentence[] = [];
  for (const d of [...first.docs, ...rest.docs]) {
    if (seen.has(d.id)) continue; seen.add(d.id);
    const x = d.data() || {}, raw = String(x.word || '').trim(), meaning = String(x.meaning || '').trim();
    if (raw && meaning && /[a-z]/i.test(raw)) out.push({wordbookId: id, text: showSentence(raw), chunked: raw, meaning: showSentence(meaning)});
  }
  return out;
}

function admin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
/** 관리자 설정 › 원정대 문장 세트: the chosen set for each grade and the 문장 세트 to choose from. */
export async function readExpeditionSettings(db: any, actor: any) {
  admin(actor);
  const [settings, books] = await Promise.all([db.collection(PET_EXPEDITION_SETTINGS).doc('main').get(), db.collection('wordbooks').get()]);
  const list = books.docs.map((d: any) => ({id: d.id, ...d.data()})).filter(isSentenceSet).map((b: any) => ({id: b.id, title: String(b.title || '제목 없음')})).sort((a: any, b: any) => a.title.localeCompare(b.title, 'ko'));
  const s = settings.data()?.sentences || {};
  return {sentences: Object.fromEntries(SENTENCE_GRADES.map(g => [g, typeof s[g] === 'string' ? s[g] : ''])), sets: list};
}
export async function saveExpeditionSettings(db: any, actor: any, input: any) {
  admin(actor);
  const next: Record<string, string> = {};
  for (const g of SENTENCE_GRADES) {
    const id = String(input?.sentences?.[g] || '').trim();
    if (id && !isSentenceSet((await db.collection('wordbooks').doc(id).get()).data())) throw Error('BAD_REQUEST');
    next[g] = id;
  }
  await db.collection(PET_EXPEDITION_SETTINGS).doc('main').set({sentences: next, updatedAt: Date.now(), updatedBy: actor.uid || 'admin'});
  return {sentences: next};
}
