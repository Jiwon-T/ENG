import { auth } from './firebase';
import { studyDevice } from './studyDonePing';
import { petStage, type AccessorySlot, type PetJob, type PetJob2, type PetJob3, type PetStage, type PetStudySource, type PetGearLook } from './petCatalog';
export type { PetCharacterType, PetStage } from './petCatalog';

// 펫 in the browser: a thin client. The server (api/_lib/student/pet.ts) keeps the whole state and decides points,
// purchases, daily caps and the AI talk; this file only asks it and shows the answer.
export interface LearnedPhrase { original: string; remembered: string; learnedAtLevel: number; evolvedVersions: Record<string, string> }
export interface PetData { slot: number; character: string; name: string; chosen: boolean; level: number; xp: number; energy: number; maxEnergy: number; learnedPhrases: LearnedPhrase[]; clothing: string | null; accessories?: Partial<Record<AccessorySlot, string>>; job?: PetJob | null; job2?: PetJob2 | null; job3?: PetJob3 | null; gear?: PetGearLook | null; gearShow?: boolean; gearStyle?: PetJob | null }
export interface PetState {
  points: number; inventory: string[]; /** 가방: snacks from 간식 상자 */ snacks?: Record<string, number>; /** 가방 › 친구 선물 (기운 간식) */ friendSnacks?: Record<string, number>; /** 목표 물건 being saved up for */ goal?: string | null; clothing: string | null; accessories?: Partial<Record<AccessorySlot, string>>; background: string;
  currentPetSlot: number; unlockedSlots: number; pets: PetData[]; day: string;
  today: { studyPoints: number; studyCap: number; energyItemsLeft: number; revivesLeft?: number; /** 친구 선물 기운 간식 still allowed today */ friendEnergyLeft?: number }; stage: PetStage;
  /** 금메달 by month ('2026-10') and where they sit in each room (% of the room, by background). */
  medals?: string[]; /** 탑 장식 won */ towerDecor?: string[]; decor?: Record<string, MedalSpot[]>; /** 포인트 내역 (this month and last) */ ledger?: LedgerItem[];
  /** 영어 회화 모드 (works while a 펫 패스·프리미엄 is in force) */ englishTalk?: boolean;
}
export interface MedalSpot { id: string; x: number; y: number }
/** 이달의 장학 쿠폰 on the pet screen (`eligible`: a student linked to the academy). */
/** One month's coupons: earned, used by coupons, left, the won given, and which can be asked for (단계 쿠폰: 5천 원 at 6,000P,
 *  1만 원 at 10,000P, at most 1만 원 a month). */
export interface CouponMonth { earned: number; spent?: number; left?: number; won?: number; tiered?: boolean; requested: boolean; paid: boolean;
  options?: { id: 'half' | 'full'; points: number; won: number; ready: boolean }[]; coupons?: { tier: 'half' | 'full'; won: number; paid: boolean }[];
  /** 숙제 통과율 (80% to ask for a coupon; 중상 이상 = 통과); null: no 숙제 평가 this month */ homework?: { done: number; counted: number; rate: number; ok: boolean } | null;
  /** 장학 쿠폰 누적 보완 (the coupon count only) */ extra?: CouponExtraView | null }
/** What the 보완 is made of (api/_lib/pet couponExtras): 잘한 수업 ×3, 자습 days, 숙제 runs, 한 달 개근. */
export interface CouponExtraView { points: number; lesson: number; boosted?: number; study: number; studyDays: number; homeworkRuns: number; bestRuns: number; perfect: number; pending?: number;
  days?: { day: string; kind: 'lesson' | 'study' | 'hwRun' | 'bestRun'; points: number }[]; perfects?: { month: string; base: number; noLate: number; diligent: number; lates: number; forgiven?: number; final: boolean }[];
  now?: { sessions: number; absences: number; lates: number };
  /** 누적 테스트 개근상 (4+ test days all attended) and this month so far */ testPerfects?: { month: string; days: number; lates: number; base: number; final: boolean }[]; testNow?: { days: number; absences: number; lates: number } }
export interface CouponView extends CouponMonth { eligible: boolean; month: string; label: string; goal: number;
  /** last month's, in the first days of a month (its lessons' points count for it) */ last?: CouponMonth & { month: string; label: string; until: string } }
/** 포인트 내역: one line a day, kind and what it was for. */
export interface LedgerItem { day: string; kind: 'class' | 'study' | 'cert' | 'adventure' | 'etc'; label: string; points: number }
/** 쌓인 포인트 알림: a 수업 보상 line that came in without the student (shown once when the app opens). */
export interface InboxLine { day: string; label: string; points: number }
/** Talks (말 가르치기·대화하기) left this month: free = for this pet (`perPet`), a 펫 패스 = all pets together. */
export interface AiTalkView { plan: 'free' | 'pet' | 'premium'; limit: number; left: number; perPet: boolean }
/** Points and the AI pass for the home screen and the top bar (GET ?summary=1, two reads). */
/** 오늘 할 일 (home): today's three, and the 간식 상자 (`special` every 5 days in a row). */
export interface QuestView { items: { id: string; label: string; need: number; done: number; go: 'vocab' | 'report' | 'pet' }[]; claimed: boolean; ready: boolean; streak: number; special: boolean }
export interface PetSummary { /** 오늘 할 일 */ quests?: QuestView | null; /** 쌓인 포인트 알림 waiting (shown once as a popup on the home screen) */ inbox?: InboxLine[]; hasPet: boolean; points: number; pass: { plan: 'pet' | 'premium'; until: string } | null; /** 장학 쿠폰 students only (`extra`: what the 보완 added) */ coupon?: { earned: number; goal: number; requested: boolean; extra?: CouponExtraView | null } | null; /** best 모험가 place; null = no place yet (–위); left out when it couldn't be read */ rank?: number | null; /** the place is in the ranking with the teachers */ rankTeacher?: boolean }
export interface PetResponse { state: PetState; result?: any; quests?: QuestView; /** 친구 방 today (opening the pet screen) */ room?: { visits: number; stickers: number; gifts?: number }; pendingRewards?: number; saved?: boolean; run?: any; expedition?: any; coupon?: CouponView; aiTalk?: AiTalkView | null }

const LEGACY_KEY = (uid: string) => `pet_system_data_${uid}`;
/** The AI actions go to /api/gemini (it runs where Gemini is served); everything else to /api/student/pet. */
const AI_ACTIONS = new Set(['teach', 'chat', 'evolve', 'muse']);
async function call(method: 'GET' | 'POST', body?: unknown, path = '/api/student/pet'): Promise<PetResponse> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Error('로그인이 필요해요.');
  const r = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
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
  async summary(): Promise<PetSummary> { const r: any = await call('GET', undefined, '/api/student/pet?summary=1'); return { ...(Array.isArray(r.inbox) && r.inbox.length ? { inbox: r.inbox as InboxLine[] } : {}), hasPet: Boolean(r.hasPet), points: Number(r.points || 0), pass: r.pass || null, coupon: r.coupon || null, quests: r.quests || null, ...('rank' in r ? { rank: r.rank ?? null, rankTeacher: Boolean(r.rankTeacher) } : {}) }; },
  // `device`: a phone or a computer, for the teacher's 학생 학습 알림 (모바일만)
  act(action: string, payload: Record<string, unknown> = {}) { return AI_ACTIONS.has(action) ? call('POST', { action, ...payload }, '/api/gemini?task=pet') : call('POST', { action, ...payload, device: studyDevice() }, '/api/student/pet'); },
  /** 오답 복습: only the server marks an answer reviewed (and counts it for 오늘 할 일 in the same write). False: it was
   *  reviewed already or is not there; a failed request throws and the answer stays to be reviewed again. */
  async reviewMark(sessionId: string, word: string): Promise<boolean> {
    if (!auth.currentUser) return false;
    const r = await call('POST', { action: 'review-mark', sessionId, word });
    return Boolean(r.result?.marked);
  },
  /** 공부 포인트 (server applies the rate and the daily cap). Never blocks the study screen: failures are ignored. */
  award(source: PetStudySource, count: number): Promise<PetResponse | null> {
    if (!auth.currentUser || !(count > 0)) return Promise.resolve(null);
    return call('POST', { action: 'award', source, count }).catch(() => null);
  },
};
