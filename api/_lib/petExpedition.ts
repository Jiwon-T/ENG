// 개인 원정대: chapters of stages on a map; every stage is one 단어 먹이 주기 game. This file keeps what the student has
// reached in petExpeditions/{uid}; the game itself stays in petGames. Progress (best stars, bonuses paid) is kept per pet:
// a new pet starts the map from the first stage and earns the stage bonuses again. Chapter rewards (backgrounds, gear)
// are items the student already owns, so they are given once per student.
// Finishing a stage is applied in the same transaction as the last answer, so a bonus can never be paid twice.
import {awardCapped, currentPet, type ServerPetState} from './pet.js';
import {PET_EXPEDITION, PET_JOB2, PET_JOBS, PET_MAX_LEVEL, petItem, stageQuestions, type PetJob, type PetJob2} from '../../src/lib/petCatalog.js';

export const PET_EXPEDITIONS = 'petExpeditions';
/** One pet's map: best stars per stage and the bonuses already paid. */
export interface PetProgress { stars: Record<string, number>; bonuses: Record<string, string[]> }
/** `pets`: progress by pet slot. `stars`/`bonuses` at the top are the old shared map (before per-pet progress): it
 *  belongs to the first pet. `jobReady`: pets (by slot) that cleared the 5장 설산 crown stage and may take the 1차 전직;
 *  `job2Ready`: pets that cleared the 7장 꿈의 정원 crown stage with a job and may take the 2차 전직. */
export interface ExpeditionState { version: 1; pets?: Record<string, PetProgress>; stars?: Record<string, number>; bonuses?: Record<string, string[]>; chapterRewards: string[]; jobReady?: number[]; job2Ready?: number[]; updatedAt: number }
export const initialExpedition = (now = Date.now()): ExpeditionState => ({version: 1, pets: {}, chapterRewards: [], updatedAt: now});
/** The map of one pet (created empty for a pet that hasn't played yet; the old shared map moves to the first pet). */
export function petProgress(e: ExpeditionState, slot: number): PetProgress {
  e.pets ||= {};
  if (e.stars || e.bonuses) { e.pets['1'] ||= {stars: e.stars || {}, bonuses: e.bonuses || {}}; delete e.stars; delete e.bonuses; }
  return e.pets[String(slot)] ||= {stars: {}, bonuses: {}};
}

/** Every stage in play order: forest-1 … forest-5, sea-1 … castle-5. */
export const STAGE_IDS = PET_EXPEDITION.chapters.flatMap(c => c.stages.map((_, i) => `${c.id}-${i + 1}`));
export function stageInfo(id: string) {
  const at = STAGE_IDS.indexOf(id); if (at < 0) return null;
  const [chapterId, n] = id.split('-'), chapter = PET_EXPEDITION.chapters.find(c => c.id === chapterId)!, index = Number(n) - 1;
  return {id, chapter, index, name: chapter.stages[index], boss: index === chapter.stages.length - 1, order: at};
}
export const stageCleared = (e: PetProgress, id: string) => { const info = stageInfo(id); return Boolean(info) && (e.stars[id] || 0) >= (info!.boss ? PET_EXPEDITION.bossStars : 1); };
/** The first stage is always open; every other one opens when the stage before it (in play order) is cleared, and a
 *  chapter also needs the main pet's level. */
export const levelOk = (id: string, level: number) => (stageInfo(id)?.chapter.minLevel ?? Infinity) <= level;
export const stageUnlocked = (e: PetProgress, id: string, level = PET_MAX_LEVEL) => { const at = STAGE_IDS.indexOf(id); return levelOk(id, level) && (at === 0 || (at > 0 && stageCleared(e, STAGE_IDS[at - 1]))); };

/**
 * A finished stage game, for the pet that started it (`slot`, the main pet by default): keep its best stars, pay each
 * bonus once per pet (even when today's cap leaves 0P it counts as paid, nothing is carried over), and give the chapter's
 * background the first time any pet of the student clears its crown stage.
 */
export function finishStage(state: ExpeditionState, s: ServerPetState, id: string, stars: number, slot = currentPet(s).slot) {
  const info = stageInfo(id); if (!info) throw Error('EXPEDITION_BAD_STAGE');
  const e = petProgress(state, slot), wasCleared = stageCleared(e, id), best = Math.max(e.stars[id] || 0, stars);
  e.stars[id] = best;
  const cleared = stageCleared(e, id), paid = e.bonuses[id] || [], out = {stage: id, boss: info.boss, stars, best, cleared, bonus: 0, bonuses: [] as string[], paid: {} as Record<string, number>, unlocked: null as string | null, chapterReward: null as string | null, gear: [] as string[], jobChoice: false, job2Choice: false};
  const pay = (key: keyof typeof PET_EXPEDITION.bonus) => { if (paid.includes(key)) return; paid.push(key); out.bonuses.push(key); const amount = PET_EXPEDITION.bonus[key], got = awardCapped(s, amount, amount * 2).points; out.paid[key] = got; out.bonus += got; };
  if (cleared) pay('clear');
  if (stars >= 2) pay('star2');
  if (stars >= 3) pay('star3');
  e.bonuses[id] = paid;
  if (cleared && !wasCleared) out.unlocked = STAGE_IDS[info.order + 1] || null;
  if (cleared && info.boss && !state.chapterRewards.includes(info.chapter.id)) {
    state.chapterRewards.push(info.chapter.id);
    if (petItem(info.chapter.reward) && !s.inventory.includes(info.chapter.reward)) s.inventory.push(info.chapter.reward);
    out.chapterReward = info.chapter.reward;
    for (const id of info.chapter.gear || []) if (petItem(id) && !s.inventory.includes(id)) { s.inventory.push(id); out.gear.push(id); }
  }
  // Crown stages can be replayed: each clear by a pet that hasn't taken the job yet lets it choose.
  const pet = s.pets.find(p => p.slot === slot) || currentPet(s), crown = info.boss && stars >= PET_EXPEDITION.bossStars;
  const give = (item: string) => { if (petItem(item) && !s.inventory.includes(item)) { s.inventory.push(item); out.gear.push(item); } };
  if (crown && info.chapter.id === PET_EXPEDITION.jobChapter && !pet.job) {
    state.jobReady = [...new Set([...(state.jobReady || []), pet.slot])]; out.jobChoice = pet.slot === currentPet(s).slot;
  }
  // 6장 밤하늘: the better weapon of this pet's job (a pet without a job gets it when it takes one).
  if (crown && info.chapter.id === PET_EXPEDITION.weaponChapter && pet.job) give(PET_JOBS[pet.job].nextWeapon);
  if (crown && info.chapter.id === PET_EXPEDITION.job2Chapter) {
    if (pet.job && !pet.job2) { state.job2Ready = [...new Set([...(state.job2Ready || []), pet.slot])]; out.job2Choice = pet.slot === currentPet(s).slot; }
    if (stars >= 3 && !state.chapterRewards.includes(`${info.chapter.id}-perfect`)) { state.chapterRewards.push(`${info.chapter.id}-perfect`); PET_EXPEDITION.perfectGear.forEach(give); }
  }
  return out;
}

/** 1차 전직: the main pet becomes a 검사 or 마법사 (once) and holds that job's weapon. If this pet already cleared the
 *  6장 crown stage, the better weapon comes too. */
export function chooseJob(e: ExpeditionState, s: ServerPetState, jobInput: unknown) {
  const job = String(jobInput || '') as PetJob; if (!Object.hasOwn(PET_JOBS, job)) throw Error('PET_JOB_BAD');
  const pet = currentPet(s); if (pet.job) throw Error('PET_JOB_TAKEN');
  if (!(e.jobReady || []).includes(pet.slot)) throw Error('PET_JOB_LOCKED');
  const weapon = PET_JOBS[job].weapon, gear = [weapon];
  if ((petProgress(e, pet.slot).stars[`${PET_EXPEDITION.weaponChapter}-5`] || 0) >= PET_EXPEDITION.bossStars) gear.push(PET_JOBS[job].nextWeapon);
  pet.job = job; for (const id of gear) if (!s.inventory.includes(id)) s.inventory.push(id);
  pet.accessories.hand = gear[gear.length - 1];
  e.jobReady = (e.jobReady || []).filter(slot => slot !== pet.slot);
  return {job, weapon};
}
/** 2차 전직: a pet with a 1차 job chooses its light or dark branch (once) and holds the branch's weapon. */
export function chooseJob2(e: ExpeditionState, s: ServerPetState, branchInput: unknown) {
  const branch = String(branchInput || '') as PetJob2; if (!Object.hasOwn(PET_JOB2, branch)) throw Error('PET_JOB2_BAD');
  const pet = currentPet(s);
  if (!pet.job || PET_JOB2[branch].base !== pet.job) throw Error('PET_JOB2_BAD');
  if (pet.job2) throw Error('PET_JOB_TAKEN');
  if (!(e.job2Ready || []).includes(pet.slot)) throw Error('PET_JOB2_LOCKED');
  const weapon = PET_JOB2[branch].weapon;
  pet.job2 = branch; if (!s.inventory.includes(weapon)) s.inventory.push(weapon); pet.accessories.hand = weapon;
  e.job2Ready = (e.job2Ready || []).filter(slot => slot !== pet.slot);
  return {job2: branch, weapon};
}

/** One pet's map as the browser draws it (the main pet's unless `slot` is given). */
export function publicExpedition(state: ExpeditionState, level = PET_MAX_LEVEL, slot = 1) {
  const e = petProgress(state, slot);
  // The next stage to play by progress alone (the level is not considered here, so a chapter waiting for a level still
  // shows as the next goal, marked `currentNeedsLevel`); after the last crown stage everything is done.
  const next = STAGE_IDS.find(id => stageUnlocked(e, id) && !stageCleared(e, id)), current = next || STAGE_IDS[STAGE_IDS.length - 1];
  const needs = next && !levelOk(next, level) ? stageInfo(next)!.chapter.minLevel : null;
  return {
    slot, current, allCleared: !next, currentNeedsLevel: needs, jobReady: state.jobReady || [], job2Ready: state.job2Ready || [], totalStars: Object.values(e.stars).reduce((a, n) => a + n, 0), maxStars: STAGE_IDS.length * 3,
    chapters: PET_EXPEDITION.chapters.map(c => ({id: c.id, title: c.title, name: c.name, reward: c.reward, gear: c.gear || [], questions: stageQuestions(`${c.id}-1`), rewarded: state.chapterRewards.includes(c.id), minLevel: c.minLevel, levelOk: c.minLevel <= level,
      unlocked: stageUnlocked(e, `${c.id}-1`, level),
      stages: c.stages.map((name, i) => { const id = `${c.id}-${i + 1}`; return {id, name, boss: i === c.stages.length - 1, stars: e.stars[id] || 0, unlocked: stageUnlocked(e, id, level), cleared: stageCleared(e, id), bonuses: e.bonuses[id] || []}; })})),
  };
}
