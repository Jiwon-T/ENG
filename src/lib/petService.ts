import { auth } from './firebase';
import { petStage, type AccessorySlot, type PetJob, type PetStage, type PetStudySource } from './petCatalog';
export type { PetCharacterType, PetStage } from './petCatalog';

// 펫 in the browser: a thin client. The server (api/_lib/student/pet.ts) keeps the whole state and decides points,
// purchases, daily caps and the AI talk; this file only asks it and shows the answer.
export interface LearnedPhrase { original: string; remembered: string; learnedAtLevel: number; evolvedVersions: Record<string, string> }
export interface PetData { slot: number; character: string; name: string; chosen: boolean; level: number; xp: number; energy: number; maxEnergy: number; learnedPhrases: LearnedPhrase[]; clothing: string | null; accessories?: Partial<Record<AccessorySlot, string>>; job?: PetJob | null }
export interface PetState {
  points: number; inventory: string[]; clothing: string | null; accessories?: Partial<Record<AccessorySlot, string>>; background: string;
  currentPetSlot: number; unlockedSlots: number; pets: PetData[]; day: string;
  today: { studyPoints: number; studyCap: number; energyItemsLeft: number }; stage: PetStage;
}
export interface PetResponse { state: PetState; result?: any; pendingRewards?: number; saved?: boolean; run?: any; expedition?: any }

const LEGACY_KEY = (uid: string) => `pet_system_data_${uid}`;
async function call(method: 'GET' | 'POST', body?: unknown): Promise<PetResponse> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error('로그인이 필요해요.');
  const r = await fetch('/api/student/pet', { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) throw Object.assign(Error(data?.message || '잠시 후 다시 해 주세요.'), { code: data?.error });
  return data;
}

export const PetService = {
  getStage: petStage,
  /** The pet from the server. The first time, what this device kept before (localStorage) is moved up once. */
  async load(uid: string): Promise<PetResponse> {
    const first = await call('GET');
    if (first.saved) return first;
    let local: any = null;
    try { local = JSON.parse(localStorage.getItem(LEGACY_KEY(uid)) || 'null'); } catch { local = null; }
    try {
      const moved = await call('POST', { action: 'import-local', local });
      try { localStorage.removeItem(LEGACY_KEY(uid)); } catch { /* nothing to clean */ }
      // The moved pet may have a higher level than the first answer assumed: read the expedition again (first time only).
      const games = await call('POST', { action: 'expedition-state' }).catch(() => first);
      return { ...moved, pendingRewards: first.pendingRewards, run: games.run, expedition: games.expedition };
    } catch { return first; }
  },
  act(action: string, payload: Record<string, unknown> = {}) { return call('POST', { action, ...payload }); },
  /** 공부 포인트 (server applies the rate and the daily cap). Never blocks the study screen: failures are ignored. */
  award(source: PetStudySource, count: number): Promise<PetResponse | null> {
    if (!auth.currentUser || !(count > 0)) return Promise.resolve(null);
    return call('POST', { action: 'award', source, count }).catch(() => null);
  },
};
