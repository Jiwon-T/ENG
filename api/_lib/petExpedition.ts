// 개인 원정대: chapters of stages on a map; every stage is one 단어 먹이 주기 game. This file keeps what the student has
// reached (best stars, bonuses already paid, chapter rewards) in petExpeditions/{uid}; the game itself stays in petGames.
// Finishing a stage is applied in the same transaction as the last answer, so a bonus can never be paid twice.
import {awardCapped, type ServerPetState} from './pet.js';
import {PET_EXPEDITION, PET_MAX_LEVEL, petItem} from '../../src/lib/petCatalog.js';

export const PET_EXPEDITIONS = 'petExpeditions';
export interface ExpeditionState { version: 1; stars: Record<string, number>; bonuses: Record<string, string[]>; chapterRewards: string[]; updatedAt: number }
export const initialExpedition = (now = Date.now()): ExpeditionState => ({version: 1, stars: {}, bonuses: {}, chapterRewards: [], updatedAt: now});

/** Every stage in play order: forest-1 … forest-5, sea-1 … castle-5. */
export const STAGE_IDS = PET_EXPEDITION.chapters.flatMap(c => c.stages.map((_, i) => `${c.id}-${i + 1}`));
export function stageInfo(id: string) {
  const at = STAGE_IDS.indexOf(id); if (at < 0) return null;
  const [chapterId, n] = id.split('-'), chapter = PET_EXPEDITION.chapters.find(c => c.id === chapterId)!, index = Number(n) - 1;
  return {id, chapter, index, name: chapter.stages[index], boss: index === chapter.stages.length - 1, order: at};
}
export const stageCleared = (e: ExpeditionState, id: string) => { const info = stageInfo(id); return Boolean(info) && (e.stars[id] || 0) >= (info!.boss ? PET_EXPEDITION.bossStars : 1); };
/** The first stage is always open; every other one opens when the stage before it (in play order) is cleared, and a
 *  chapter also needs the main pet's level. */
export const levelOk = (id: string, level: number) => (stageInfo(id)?.chapter.minLevel ?? Infinity) <= level;
export const stageUnlocked = (e: ExpeditionState, id: string, level = PET_MAX_LEVEL) => { const at = STAGE_IDS.indexOf(id); return levelOk(id, level) && (at === 0 || (at > 0 && stageCleared(e, STAGE_IDS[at - 1]))); };

/**
 * A finished stage game: keep the best stars, pay each bonus once (even when today's cap leaves 0P it counts as paid,
 * nothing is carried over), and give the chapter's background the first time its crown stage is cleared.
 */
export function finishStage(e: ExpeditionState, s: ServerPetState, id: string, stars: number) {
  const info = stageInfo(id); if (!info) throw Error('EXPEDITION_BAD_STAGE');
  const wasCleared = stageCleared(e, id), best = Math.max(e.stars[id] || 0, stars);
  e.stars[id] = best;
  const cleared = stageCleared(e, id), paid = e.bonuses[id] || [], out = {stage: id, boss: info.boss, stars, best, cleared, bonus: 0, bonuses: [] as string[], paid: {} as Record<string, number>, unlocked: null as string | null, chapterReward: null as string | null};
  const pay = (key: keyof typeof PET_EXPEDITION.bonus) => { if (paid.includes(key)) return; paid.push(key); out.bonuses.push(key); const amount = PET_EXPEDITION.bonus[key], got = awardCapped(s, amount, amount * 2).points; out.paid[key] = got; out.bonus += got; };
  if (cleared) pay('clear');
  if (stars >= 2) pay('star2');
  if (stars >= 3) pay('star3');
  e.bonuses[id] = paid;
  if (cleared && !wasCleared) out.unlocked = STAGE_IDS[info.order + 1] || null;
  if (cleared && info.boss && !e.chapterRewards.includes(info.chapter.id)) {
    e.chapterRewards.push(info.chapter.id);
    if (petItem(info.chapter.reward) && !s.inventory.includes(info.chapter.reward)) s.inventory.push(info.chapter.reward);
    out.chapterReward = info.chapter.reward;
  }
  return out;
}

/** The map as the browser draws it. */
export function publicExpedition(e: ExpeditionState, level = PET_MAX_LEVEL) {
  // The next stage to play by progress alone (the level is not considered here, so a chapter waiting for a level still
  // shows as the next goal, marked `currentNeedsLevel`); after the last crown stage everything is done.
  const next = STAGE_IDS.find(id => stageUnlocked(e, id) && !stageCleared(e, id)), current = next || STAGE_IDS[STAGE_IDS.length - 1];
  const needs = next && !levelOk(next, level) ? stageInfo(next)!.chapter.minLevel : null;
  return {
    current, allCleared: !next, currentNeedsLevel: needs, totalStars: Object.values(e.stars).reduce((a, n) => a + n, 0), maxStars: STAGE_IDS.length * 3,
    chapters: PET_EXPEDITION.chapters.map(c => ({id: c.id, title: c.title, name: c.name, reward: c.reward, rewarded: e.chapterRewards.includes(c.id), minLevel: c.minLevel, levelOk: c.minLevel <= level,
      unlocked: stageUnlocked(e, `${c.id}-1`, level),
      stages: c.stages.map((name, i) => { const id = `${c.id}-${i + 1}`; return {id, name, boss: i === c.stages.length - 1, stars: e.stars[id] || 0, unlocked: stageUnlocked(e, id, level), cleared: stageCleared(e, id), bonuses: e.bonuses[id] || []}; })})),
  };
}
