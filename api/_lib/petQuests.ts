// 오늘 할 일 (home): three small things a day that lead into studying — 단어 테스트, 오답 복습 (or 단어장 공부 when few
// wrong answers wait), and a pet word game. Only what the server can see counts, never an award request on its own:
// 단어 테스트 and 단어장 공부 from the study records saved today (by the time Firestore wrote them), 오답 복습 from the
// answers the server marks reviewed (review-mark), the word game from a run the server graded to the end. All three
// done: a 간식 상자 into the 가방 (no points); 5 days in a row a 특별 상자.
import { PET_QUESTS, type PetQuestId } from '../../src/lib/petCatalog.js';
import { seoulDay, type ServerPetState } from './pet.js';

/** What the study records say about today: wrong answers waiting, 단어 테스트 and 단어장 공부 saved today. */
export interface QuestRecords { wrongs: number; test: number; study: number }
const NO_RECORDS: QuestRecords = {wrongs: 0, test: 0, study: 0};

/** Count toward today's 오늘 할 일 (only what the server did itself: a graded word game, an answer it marked reviewed). */
export function noteQuest(s: ServerPetState, id: 'review' | 'feed', n = 1) {
  const add = Math.max(0, Math.floor(Number(n) || 0)); if (!add) return;
  const q = s.today.quest ||= {};
  q[id] = Math.min(99, (q[id] || 0) + add);
}

/** Today's three: 오답 복습 while enough wrong answers wait — or once started today, so it does not turn into 단어장 공부
 *  halfway through as the wrong answers go down. */
export function todaysQuests(s: ServerPetState | null, wrongs: number): PetQuestId[] {
  const reviewing = wrongs >= PET_QUESTS.reviewNeed || (s?.today.quest?.review || 0) > 0;
  return ['test', reviewing ? 'review' : 'study', 'feed'];
}
const yesterday = (day: string) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
/** For the home card. `s` null: no pet record yet. */
export function questView(s: ServerPetState | null, rec: QuestRecords = NO_RECORDS, now = Date.now()) {
  const today = seoulDay(now), mine = s && s.day === today ? s.today.quest || {} : {};
  const done: Record<PetQuestId, number> = {test: rec.test, study: rec.study, review: mine.review || 0, feed: mine.feed || 0};
  const items = todaysQuests(s, rec.wrongs).map(id => { const d = PET_QUESTS.list[id]; return {id, label: d.label, need: d.need, done: Math.min(d.need, done[id]), go: d.go}; });
  const streak = s?.questStreak && (s.questStreak.day === today || s.questStreak.day === yesterday(today)) ? s.questStreak.n : 0;
  const claimed = Boolean(s && s.day === today && s.today.questClaimed);
  return {items, claimed, ready: !claimed && items.every(i => i.done >= i.need), streak, special: (streak + (claimed ? 0 : 1)) % PET_QUESTS.streakDays === 0};
}
/** Open today's 간식 상자 (all three done, once a day): snacks into the 가방, the streak goes on. */
export function claimQuestBox(s: ServerPetState, rec: QuestRecords, now = Date.now(), rand = Math.random) {
  const view = questView(s, rec, now), today = seoulDay(now);
  if (view.claimed) throw Error('QUEST_CLAIMED');
  if (!view.ready) throw Error('QUEST_NOT_DONE');
  const n = s.questStreak?.day === yesterday(today) ? s.questStreak.n + 1 : 1;
  s.questStreak = {day: today, n}; s.today.questClaimed = true;
  const special = n % PET_QUESTS.streakDays === 0, B = PET_QUESTS.box;
  const items: string[] = special ? [...PET_QUESTS.special.items] : [...Array.from({length: B.count}, () => B.pick[Math.floor(rand() * B.pick.length)]), B.energy];
  const bag = s.snacks ||= {};
  for (const id of items) bag[id] = Math.min(99, (bag[id] || 0) + 1);
  return {items, special, streak: n};
}

const millis = (v: any) => typeof v?.toMillis === 'function' ? v.toMillis() : NaN;
/** The newest 30 study records: wrong answers not reviewed yet, and 단어 테스트 (10 words answered, or all of a shorter
 *  one) / 단어장 공부 (퀴즈·플래시카드·짝 맞추기) with at least one item, written today — by Firestore's own write time, not a time the screen sent. A failed read
 *  counts nothing (the day falls back to 단어장 공부, and nothing is done yet). */
export async function readQuestRecords(db: any, uid: string, now = Date.now()): Promise<QuestRecords> {
  try {
    const snap = await db.collection('studySessions').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(30).get(), today = seoulDay(now);
    const out = {wrongs: 0, test: 0, study: 0};
    for (const d of snap.docs) {
      const x = d.data();
      for (const a of x.incorrectAnswers || []) if (a && !a.isReviewed && typeof a.word === 'string') out.wrongs++;
      const at = millis(d.createTime);
      if (!(at > 0) || seoulDay(at) !== today || !(Number(x.totalItems) > 0 || Number(x.score) > 0)) continue;
      // a 단어 테스트 left halfway is saved too: it counts with 10 words answered (or the whole of a shorter test)
      const answered = (Number(x.score) || 0) + (Array.isArray(x.incorrectAnswers) ? x.incorrectAnswers.length : 0);
      if (x.type === 'test') { if (answered >= Math.min(10, Number(x.totalItems) || 10)) out.test++; } else if (['quiz', 'flashcard', 'match'].includes(x.type)) out.study++;
    }
    return out;
  } catch { console.warn('PET_QUEST_RECORDS_FAILED'); return {...NO_RECORDS}; }
}
/** 오답 복습 done on the server: the answer must be the student's own and not reviewed yet; it is marked reviewed here.
 *  Returns whether it was marked (false: already reviewed or not found). */
export async function markWrongReviewed(db: any, uid: string, sessionId: string, word: string) {
  const ref = db.collection('studySessions').doc(String(sessionId || '').slice(0, 200));
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref), x = snap.data();
    if (!x || x.uid !== uid || !Array.isArray(x.incorrectAnswers)) return false;
    const i = x.incorrectAnswers.findIndex((a: any) => a?.word === word && !a.isReviewed);
    if (i < 0) return false;
    tx.update(ref, {incorrectAnswers: x.incorrectAnswers.map((a: any) => a?.word === word ? {...a, isReviewed: true} : a)});
    return true;
  });
}
