// The teacher room's permission check (account, workspace access, assigned students) remembered for up to a minute per
// server instance, so moving between screens doesn't read it all again. Trade-off (approved 2026-10-17): a change made
// on another instance shows within a minute; any access, role or student change made here forgets it at once.
export const ACTOR_MEMORY_MS = 60_000, ACTOR_MEMORY_MAX = 500;
const actors = new Map<string, {actor: any; db: object; until: number}>();
/** Bumped by every forget: a check that started before a forget never saves what it read (it may be the old access). */
let generation = 0;
export const actorGeneration = () => generation;

export function rememberedActor(uid: string, db: object, now = Date.now()) {
  const known = actors.get(uid);
  if (!known) return null;
  if (known.until <= now || known.db !== db) { actors.delete(uid); return null; }
  return known.actor;
}
export function rememberActor(uid: string, db: object, actor: any, startedAt: number, now = Date.now()) {
  if (startedAt !== generation) return;
  if (actors.size >= ACTOR_MEMORY_MAX) actors.delete(actors.keys().next().value!);
  actors.set(uid, {actor, db, until: now + ACTOR_MEMORY_MS});
}
/** Forget one account (removed, blocked, role changed) or everyone (access or student assignments changed). */
export function forgetTeacherActors(uid?: string) { generation++; if (uid) actors.delete(uid); else actors.clear(); }
