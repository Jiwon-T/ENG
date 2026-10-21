// 펫: the one list of characters, items, prices and point rules, shared by the server (which decides) and the screen
// (which shows). Changing a price or a rate here changes both.
export type PetCharacterType = 'unicorn' | 'mymelody' | 'haemi' | 'molang' | 'mang_bear' | 'hodu';
export type PetStage = 'baby' | 'child' | 'teen' | 'adult' | 'master';
export type PetItemCategory = 'clothing' | 'accessory' | 'background' | 'consumable';
/** Accessories are worn one per place, all places at once (a hat, glasses, a scarf and a sword together). */
export type AccessorySlot = 'head' | 'eyes' | 'neck' | 'hand';
export const ACCESSORY_SLOTS: { id: AccessorySlot; label: string }[] = [{ id: 'head', label: '머리' }, { id: 'eyes', label: '눈' }, { id: 'neck', label: '목' }, { id: 'hand', label: '손' }];
/** `reward`: earned on the 원정대 (never sold in the shop). `slot`: where an accessory is worn. `revive`: only for a pet
 *  with no 기운 left (탈진), once a day, apart from the two 기운 간식. */
/** `pass`: a pass-only room (looks only; never bought): 'pet' for any pass, 'premium' for the 프리미엄 패스. */
export interface PetItem { id: string; name: string; price: number; icon: string; category: PetItemCategory; xp?: number; energy?: number; reward?: boolean; slot?: AccessorySlot; revive?: boolean; pass?: 'pet' | 'premium' }

export const PET_CHARACTERS: { id: PetCharacterType; name: string }[] = [
  { id: 'unicorn', name: '다롱' }, { id: 'mymelody', name: '아롱' }, { id: 'haemi', name: '해미' }, { id: 'molang', name: '말랑' }, { id: 'mang_bear', name: '고미' }, { id: 'hodu', name: '호두' },
];
/** The top level (raised later with new end content). At PET_FRIEND_LEVEL a pet brings one more friend home. */
export const PET_MAX_LEVEL = 200;
export const PET_FRIEND_LEVEL = 100;
export const PET_MAX_ENERGY = 100;
/** 기운 회복 간식 (커피·에너지드링크): this many a day, never for a pet at 0 기운 (탈진). */
export const PET_ENERGY_ITEMS_PER_DAY = 2;
/** 오늘 할 일 (home): three a day — 단어 테스트, 오답 복습 (단어장 공부 when fewer than `reviewNeed` wrong answers wait),
 *  and a pet word game. All three done: a 간식 상자 (snacks into the bag, no points — kept off the points economy); every
 *  `streakDays` days in a row a 특별 상자. */
export const PET_QUESTS = {
  reviewNeed: 5,
  list: {
    test: { label: '단어 테스트 1번', need: 1, go: 'vocab' },
    review: { label: '오답 복습 5개', need: 5, go: 'report' },
    study: { label: '단어장 공부 1번', need: 1, go: 'vocab' },
    feed: { label: '펫과 단어 먹이 주기·원정대 1판', need: 1, go: 'pet' },
  },
  box: { pick: ['cookie', 'macaron', 'cake'], count: 2, energy: 'coffee' },
  special: { items: ['candy', 'candy', 'cake', 'energy_drink'] },
  streakDays: 5,
} as const;
export type PetQuestId = keyof typeof PET_QUESTS.list;
/** 탈진 회복 '몬스터': once a day, only at 0 기운. */
export const PET_REVIVES_PER_DAY = 1;
/** One more pet each time a pet reaches PET_FRIEND_LEVEL; one of each kind at most. */
export const PET_MAX_PETS = 6;
export const PLACEHOLDER_PET_NAME = '친구가 필요해요';
export const petStage = (level: number): PetStage => level <= 20 ? 'baby' : level <= 40 ? 'child' : level <= 60 ? 'teen' : level <= 99 ? 'adult' : 'master';
export const PET_STAGE_LABEL: Record<PetStage, string> = { baby: '아기', child: '어린이', teen: '청소년', adult: '어른', master: '마스터' };
/** The stage's name; from Lv.150 a master is a 전설 (same look). */
export const petStageLabel = (level: number) => level >= 150 ? '전설' : PET_STAGE_LABEL[petStage(level)];
/** XP to the next level: after Lv.100 each level takes half as long again. */
export const xpNeeded = (level: number) => level < PET_FRIEND_LEVEL ? level * 100 : level * 150;

export const PET_ITEMS: PetItem[] = [
  { id: 'muji_cape', name: '무지개 망토', price: 120, icon: '🌈', category: 'clothing' },
  { id: 'uniform', name: '교복', price: 150, icon: '👔', category: 'clothing' },
  { id: 'mori_girl', name: '모리걸', price: 1000, icon: '🌿', category: 'clothing' },
  { id: 'hippie', name: '히피', price: 1000, icon: '🌻', category: 'clothing' },
  { id: 'fairy', name: '페어리', price: 1000, icon: '🧚', category: 'clothing' },
  { id: 'lovely', name: '러블리', price: 1000, icon: '💖', category: 'clothing' },
  { id: 'sporty', name: '스포티', price: 1000, icon: '👟', category: 'clothing' },
  { id: 'onee_gyaru', name: '오네갸루', price: 1000, icon: '🐆', category: 'clothing' },
  { id: 'hime_gyaru', name: '히메갸루', price: 1000, icon: '👑', category: 'clothing' },
  { id: 'latte_gyaru', name: '라떼갸루', price: 1000, icon: '☕', category: 'clothing' },
  { id: 'baby_bib', name: '아기 턱받이', price: 40, icon: '🍼', category: 'clothing' },
  { id: 'bakery_apron', name: '빵집 앞치마', price: 50, icon: '🧁', category: 'clothing' },
  { id: 'stripe_tee', name: '줄무늬 티', price: 60, icon: '👕', category: 'clothing' },
  { id: 'star_pajama', name: '별 파자마', price: 70, icon: '🌙', category: 'clothing' },
  { id: 'raincoat', name: '노란 우비', price: 80, icon: '☔', category: 'clothing' },
  { id: 'overalls', name: '멜빵바지', price: 100, icon: '👖', category: 'clothing' },
  { id: 'pink_ribbon', name: '리본', price: 50, icon: '🎀', category: 'accessory', slot: 'head' },
  { id: 'star_hat', name: '별핀', price: 80, icon: '⭐', category: 'accessory', slot: 'head' },
  { id: 'crown', name: '왕관', price: 200, icon: '👑', category: 'accessory', slot: 'head' },
  { id: 'sunglasses', name: '선글라스', price: 100, icon: '😎', category: 'accessory', slot: 'eyes' },
  { id: 'flower', name: '꽃핀', price: 60, icon: '🌸', category: 'accessory', slot: 'head' },
  { id: 'strawberry_pin', name: '딸기 핀', price: 50, icon: '🍓', category: 'accessory', slot: 'head' },
  { id: 'bow_tie', name: '나비넥타이', price: 60, icon: '🦋', category: 'accessory', slot: 'neck' },
  { id: 'scarf', name: '체크 목도리', price: 80, icon: '🧣', category: 'accessory', slot: 'neck' },
  { id: 'round_glasses', name: '동그란 안경', price: 90, icon: '👓', category: 'accessory', slot: 'eyes' },
  { id: 'beret', name: '베레모', price: 100, icon: '🎨', category: 'accessory', slot: 'head' },
  { id: 'heart_sunglasses', name: '하트 선글라스', price: 120, icon: '💕', category: 'accessory', slot: 'eyes' },
  { id: 'flower_crown', name: '꽃 화관', price: 150, icon: '💐', category: 'accessory', slot: 'head' },
  { id: 'headphones', name: '헤드폰', price: 180, icon: '🎧', category: 'accessory', slot: 'head' },
  { id: 'default', name: '기본 보금자리', price: 0, icon: '🏠', category: 'background' },
  { id: 'pink_cushion', name: '핑크 쿠션', price: 300, icon: '🛋️', category: 'background' },
  { id: 'bed', name: '작은 침대', price: 150, icon: '🛏️', category: 'background' },
  { id: 'star_room', name: '별빛 방', price: 300, icon: '✨', category: 'background' },
  { id: 'desk', name: '미니 책상', price: 350, icon: '📝', category: 'background' },
  { id: 'forest_cabin', name: '숲속 오두막', price: 0, icon: '🏡', category: 'background', reward: true },
  { id: 'coral_sea', name: '산호 바다', price: 0, icon: '🪸', category: 'background', reward: true },
  { id: 'cloud_castle', name: '구름 성', price: 0, icon: '🏰', category: 'background', reward: true },
  { id: 'oasis', name: '오아시스', price: 0, icon: '🏜️', category: 'background', reward: true },
  { id: 'snow_cabin', name: '눈 오두막', price: 0, icon: '🏔️', category: 'background', reward: true },
  { id: 'galaxy', name: '은하수', price: 0, icon: '🌌', category: 'background', reward: true },
  { id: 'dream_garden', name: '꿈의 정원', price: 0, icon: '🌈', category: 'background', reward: true },
  // 패스 꾸미기 (looks only: nothing in the rankings, the coupon or the tower)
  { id: 'cherry_window', name: '벚꽃 창가', price: 0, icon: '🌸', category: 'background', pass: 'pet' },
  { id: 'night_sky', name: '밤하늘', price: 0, icon: '🌃', category: 'background', pass: 'premium' },
  { id: 'seaside', name: '바닷가', price: 0, icon: '🏖️', category: 'background', pass: 'premium' },
  // 원정대 무기 (손): 4장 사막은 나무 검·나무 지팡이를 함께 (전직 전 연습 무기). 5장 설산 왕관에서 1차 전직하면 그 직업의
  // 무기, 6장 밤하늘 왕관은 내 직업의 더 좋은 무기, 7장 꿈의 정원 왕관에서 2차 전직하면 고른 갈래의 무기를 받아요.
  // 꿈의 검·꿈의 지팡이는 7장 왕관을 별 3개로 깼을 때 주는 꾸미기 무기예요.
  { id: 'wood_sword', name: '나무 검', price: 0, icon: '🗡️', category: 'accessory', slot: 'hand', reward: true },
  { id: 'wood_staff', name: '나무 지팡이', price: 0, icon: '🌿', category: 'accessory', slot: 'hand', reward: true },
  { id: 'ice_sword', name: '설원의 검', price: 0, icon: '🧊', category: 'accessory', slot: 'hand', reward: true },
  { id: 'ice_staff', name: '눈꽃 지팡이', price: 0, icon: '❄️', category: 'accessory', slot: 'hand', reward: true },
  { id: 'star_sword', name: '별무리 대검', price: 0, icon: '⭐', category: 'accessory', slot: 'hand', reward: true },
  { id: 'moon_staff', name: '은하수 지팡이', price: 0, icon: '🌙', category: 'accessory', slot: 'hand', reward: true },
  { id: 'dream_sword', name: '꿈의 검', price: 0, icon: '⚔️', category: 'accessory', slot: 'hand', reward: true },
  { id: 'dream_staff', name: '꿈의 지팡이', price: 0, icon: '🪄', category: 'accessory', slot: 'hand', reward: true },
  { id: 'holy_sword', name: '빛의 성검', price: 0, icon: '🗡️', category: 'accessory', slot: 'hand', reward: true },
  { id: 'obsidian_sword', name: '흑요 마검', price: 0, icon: '🗡️', category: 'accessory', slot: 'hand', reward: true },
  { id: 'dawn_scepter', name: '새벽빛 홀', price: 0, icon: '✨', category: 'accessory', slot: 'hand', reward: true },
  { id: 'crescent_staff', name: '그믐달 지팡이', price: 0, icon: '🌙', category: 'accessory', slot: 'hand', reward: true },
  // 3차 전직 (Lv.150 + 채움의 탑 50층, 「별의 시험」) weapons
  { id: 'sky_spear', name: '천공의 성창', price: 0, icon: '🌤️', category: 'accessory', slot: 'hand', reward: true },
  { id: 'abyss_greatsword', name: '심연의 대검', price: 0, icon: '🌑', category: 'accessory', slot: 'hand', reward: true },
  { id: 'dawn_staff', name: '여명의 지팡이', price: 0, icon: '🌅', category: 'accessory', slot: 'hand', reward: true },
  { id: 'dusk_tome', name: '그믐달 마도서', price: 0, icon: '📖', category: 'accessory', slot: 'hand', reward: true },
  { id: 'cookie', name: '쿠키', price: 30, xp: 5, icon: '🍪', category: 'consumable' },
  { id: 'macaron', name: '마카롱', price: 50, xp: 10, icon: '🍭', category: 'consumable' },
  { id: 'cake', name: '딸기케이크', price: 60, xp: 15, icon: '🍰', category: 'consumable' },
  { id: 'candy', name: '별사탕', price: 100, xp: 30, icon: '🍬', category: 'consumable' },
  { id: 'coffee', name: '커피', price: 40, energy: 30, icon: '☕', category: 'consumable' },
  { id: 'energy_drink', name: '에너지드링크', price: 70, energy: 60, icon: '⚡', category: 'consumable' },
  { id: 'monster', name: '몬스터', price: 150, energy: 50, icon: '🥤', category: 'consumable', revive: true },
];
export const petItem = (id: string) => PET_ITEMS.find(item => item.id === id);
/** A pass-only room can be used on this plan ('free' | 'pet' | 'premium'): 프리미엄 opens all, 펫 패스 the 'pet' ones. */
export const passAllows = (item: { pass?: 'pet' | 'premium' } | undefined, plan: string | null | undefined) => Boolean(item?.pass) && (plan === 'premium' || (item!.pass === 'pet' && plan === 'pet'));
/** 이달의 장학 쿠폰: when the points earned in a month (Korea time, from the 1st; spending doesn't matter) reach `goal`,
 *  any 채움 학원 student (linked to the academy) may ask for that month's coupon (no points are taken; not asked for = that month is gone) and
 *  get that month's 금메달 to place in their room. In the first season the points held when counting began count too. */
export const PET_COUPON = { name: '이달의 장학 쿠폰', goal: 10_000, firstSeason: '2026-10', maxDecor: 24, /** last month's coupon may still be asked for until this day of the new month (a lesson's points count for its own month) */ graceDays: 3,
  /** 단계 쿠폰 (from tiersFrom): 6,000P → 5천 원 (those 6,000P are used; what is left keeps counting), 10,000P → 1만 원; at
   *  most monthWon a month (from October, the first season: decided 2026-10-21). Before it: one 1만 원 coupon at the goal. */
  tiersFrom: '2026-10', monthWon: 10_000, tiers: [{ id: 'half', points: 6_000, won: 5_000 }, { id: 'full', points: 10_000, won: 10_000 }] } as const;
export type CouponTier = 'half' | 'full';
/** 장학 쿠폰 누적 보완 (doing well counts more; the coupon count only — the points to spend stay as they are): a lesson
 *  attended whose 숙제·테스트·태도 are all 상 이상 ('없는 날'·'미확인' left out) has those three ×3 (출석 stays ×1); a 자습 day with 태도
 *  상 이상 30P (×3); 한 달 개근 (8+ class sessions attended, no 결석 — at 11+ one 결석 is let pass, counted like a 지각) 1,000P
 *  less 30% a 지각, +500 with no 지각, +500 more with no 숙제
 *  미제출 (성실 개근); 숙제 상 이상 3 in a row +500, 최상 2 in a row +300. A coupon needs 숙제 통과율 80% (중상 이상 = 통과). */
export const COUPON_BOOST = { lessonTimes: 3, studyDay: 30, perfect: 1000, perfectNoLate: 500, diligent: 500, latePenalty: 0.3, minSessions: 8, /** 11+ attended: one 결석 is let pass, counted like a 지각 (decided 2026-10-21) */ forgiveAt: 11, homeworkRun: { need: 3, points: 500 }, bestRun: { need: 2, points: 300 }, homeworkRate: 0.8 } as const;
/** The months a day's points count for: its own month — and in the first season, the September lessons before it too
 *  (the 9월 수업 포인트 added to October's count). */
const monthBefore = (month: string) => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
export const countsForMonth = (day: string, month: string) => { const m = String(day || '').slice(0, 7); return m === month || (month === PET_COUPON.firstSeason && m === monthBefore(month)); };
/** '2026-10' → '26.10' (on the medal and the badges). */
export const medalLabel = (month: string) => `${month.slice(2, 4)}.${month.slice(5, 7)}`;
/** 은메달 ('2026-11-s'): the month's first 5천 원 coupon; it turns into the 금메달 ('2026-11') when the month reaches 1만 원
 *  (one 1만 원 coupon at 10,000P, or two 5천 원 at 12,000P — the harder way). */
export const silverMedal = (month: string) => `${month}-s`;
export const isSilverMedal = (id: string) => /^\d{4}-\d{2}-s$/.test(id);
export const accessorySlot = (id: string): AccessorySlot => petItem(id)?.slot || 'head';
/** What a pet wears, in drawing order; older saves (and party snapshots) kept a single `accessory`. */
export const wornAccessories = (p: { accessories?: Partial<Record<AccessorySlot, string | null>> | null; accessory?: string | null } | null | undefined): string[] =>
  !p ? [] : p.accessories ? ACCESSORY_SLOTS.map(s => p.accessories![s.id]).filter((id): id is string => Boolean(id)) : p.accessory ? [p.accessory] : [];

/** 공부로 받는 포인트 (per correct answer / word / review). Their sum is capped per day; 출석·과제 rewards are not. */
export const PET_STUDY_RATES = {
  'vocab-test': { points: 10, xp: 20 },
  'wordbook-quiz': { points: 5, xp: 10 },
  'wordbook-match': { points: 5, xp: 10 },
  'wordbook-flashcard': { points: 2, xp: 5 },
  'review-confirm': { points: 8, xp: 15 },
  'review-round': { points: 8, xp: 15 },
} as const;
export type PetStudySource = keyof typeof PET_STUDY_RATES;
export const PET_DAILY_STUDY_POINTS = 300;
/** Real lessons, once per lesson, from the last 30 days on: each 출석, and each 숙제 by the 숙제 평가 the teacher writes in
 *  the next lesson's 일지 (중하 and below, 미제출: nothing). The student's own 완료 check is a to-do mark and gives nothing. */
export const PET_ATTENDANCE_REWARD = { points: 30, xp: 50 };
/** 지각 (보강 지각 too): half the 출석 reward. */
export const PET_LATE_REWARD = { points: 15, xp: 25 };
/** 누적 테스트 (3차시 테스트 날, from the timetable): 출석 보너스 +50P on top of 출석 (지각: 80%), and 누적 테스트 개근상 1000P
 *  (coupon count) in a month with 4+ test days all attended, 30% less a 지각. A test day with no 일지 counts as 결석
 *  (decided 2026-10-21: a day left blank is mostly a student who did not come). */
export const PET_TEST_DAY = { from: '2026-10-01', bonus: { points: 50, xp: 50 }, lateRate: 0.8, perfect: 1000, latePenalty: 0.3, minDays: 4 } as const;
export const PET_HOMEWORK_REWARD: Record<string, { points: number; xp: number }> = {
  '최상': { points: 40, xp: 60 }, '상': { points: 30, xp: 45 }, '중상': { points: 20, xp: 30 }, '중': { points: 10, xp: 15 },
};
/** 테스트 평가 (the 일지's 테스트 grade, once per lesson, outside the daily cap): a test on paper pays more (it is harder,
 *  and an app test already paid its 단어 테스트 points). Paper or app: the teacher's chip in the 일지, else 자동 (no app
 *  단어 테스트 that day = paper). */
export const PET_TEST_REWARD: Record<'paper' | 'app', Record<string, { points: number; xp: number }>> = {
  paper: { '최상': { points: 40, xp: 60 }, '상': { points: 30, xp: 45 }, '중상': { points: 20, xp: 30 }, '중': { points: 10, xp: 15 } },
  app: { '최상': { points: 20, xp: 30 }, '상': { points: 15, xp: 22 }, '중상': { points: 10, xp: 15 }, '중': { points: 5, xp: 8 } },
};
export const PET_TEST_REWARD_TEXT = (kind: 'paper' | 'app') => Object.entries(PET_TEST_REWARD[kind]).map(([grade, r]) => `${grade} ${r.points}`).join(' · ') + 'P';
/** 수업 태도: the 일지's 태도 (once a lesson, outside the daily cap); below 중 nothing. */
export const PET_ATTITUDE_REWARD: Record<string, { points: number; xp: number }> = { '최상': { points: 20, xp: 30 }, '상': { points: 15, xp: 22 }, '중상': { points: 10, xp: 15 }, '중': { points: 5, xp: 8 } };
/** 수업 보상 on 반영 (from this lesson day on): each 반영 settles the lesson to what its 일지 now says — the difference is
 *  paid or taken back (never below 0 points), and 7 days after the lesson it stays as it is. Lessons before this day keep
 *  the old way (taken when the app opens). */
export const LESSON_REWARD_FROM = '2026-10-21';
export const LESSON_REWARD_LOCK_DAYS = 7;
/** "최상 40 · 상 30 · 중상 20 · 중 10P" for the screens that explain the rewards. */
export const PET_HOMEWORK_REWARD_TEXT = Object.entries(PET_HOMEWORK_REWARD).map(([grade, r]) => `${grade} ${r.points}`).join(' · ') + 'P';
export const PET_REWARD_WINDOW_DAYS = 30;
/** What the pet says on its own. Babies use a few easy words, never baby-talk sounds or emoji. */
export const PET_IDLE_LINES: { upTo: number; lines: string[] }[] = [
  // 아기: one easy word, then two
  { upTo: 10, lines: ['안녕!', '좋아!', '놀자!', '배고파', '여기!', '최고!'] },
  { upTo: 20, lines: ['공부 했어?', '같이 놀자', '쓰다듬어 줘', '간식 줘', '오늘 좋아', '나 여기 있어'] },
  // 어린이: one short, easy sentence
  { upTo: 40, lines: ['오늘 뭐 배웠어?', '간식 먹고 싶어', '같이 단어 외우자', '숙제 다 했어?', '나 오늘 조금 컸어', '단어 하나 알려 줄래?'] },
  // 청소년: natural sentences
  { upTo: 60, lines: ['오늘도 공부했구나, 멋지다', '틀린 단어 다시 보면 금방 외워져', '나도 영어 배우고 싶어', '어제 배운 단어 기억나?', '조금 쉬었다가 또 하자'] },
  // 어른: warm and clever, a little easy English
  { upTo: 99, lines: ['오늘 정말 열심히 했네. Good job!', '조금씩 하면 다 할 수 있어', "Let's study together!", '힘들 땐 나한테 말해 줘', '네가 외운 단어, 나도 다 기억해'] },
  // 마스터: a proud partner
  { upTo: 149, lines: ["너랑 공부해서 여기까지 왔어. I'm so proud of you!", '오늘도 같이 해 보자', 'Practice makes perfect, 알지?', '어려운 단어도 이제 문제없어', '탑 꼭대기까지 같이 가 보자'] },
  // 전설
  { upTo: 200, lines: ['우리 이제 전설이야. Legends never stop learning!', '네 덕분에 나도 이렇게 자랐어', '오늘의 너는 어제보다 더 멋져', 'Every word counts. 한 단어씩, 같이!', '어떤 몬스터도 우리 앞에선 문제없어'] },
];
export const petIdleLine = (level: number, seed = 0) => { const band = PET_IDLE_LINES.find(b => level <= b.upTo) || PET_IDLE_LINES[PET_IDLE_LINES.length - 1]; return band.lines[Math.abs(seed) % band.lines.length]; };
/** Babies (≤ Lv.20) speak without emoji; older pets may keep one. Whole emoji are kept or dropped (flags, skin tones, ZWJ
 *  families), so no stray pieces are left. Also applied to phrases saved before. */
export const petEmojiLimit = (level: number) => level <= 20 ? 0 : 1;
const EMOJI_PART = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\u20e3/u;
export function cleanPetSpeech(text: string, maxEmoji = 0) {
  const raw = String(text || '');
  const Segmenter = (Intl as any).Segmenter;
  // Without Intl.Segmenter an emoji can't be kept whole (families, flags), so then none is kept.
  if (!Segmenter) maxEmoji = 0;
  const parts: string[] = Segmenter ? Array.from(new Segmenter('ko', { granularity: 'grapheme' }).segment(raw), (s: any) => s.segment) : Array.from(raw);
  let kept = 0;
  const out = parts.filter(g => !EMOJI_PART.test(g) || kept++ < maxEmoji).join('')
    .replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\u20e3]/gu, ch => (maxEmoji ? ch : ''));
  return out.replace(/([~♡♥★☆])\1+/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** Energy costs and XP for the pet's own actions. */
export const PET_ACTIONS = { pet: { energy: 5, xp: 3 }, teach: { energy: 20, xp: 20 }, chat: { energy: 10, xp: 10 } };
/** 단어 먹이 주기: one game = 10 questions with 3 meaning cards; entering costs pet energy (resuming is free).
 *  Points: 5P (wordbook-quiz rate) for a word answered right the first time today, inside the daily study cap. */
/** 개인 원정대: 3 chapters × 5 stages; every stage is one 단어 먹이 주기 game (energy as PET_WORD_FEED). A stage opens when the
 *  one before is cleared (★1, the crown stage at the end of a chapter needs ★2); the crown stage gives the chapter's
 *  background. A chapter also needs the main pet at `minLevel`. Bonuses are paid once per stage, inside the daily study cap. */
export const PET_EXPEDITION = {
  chapters: [
    { id: 'forest', title: '1장 숲', name: '속삭이는 숲', minLevel: 1, reward: 'forest_cabin', stages: ['숲 입구', '이끼 오솔길', '버섯 동굴 입구', '반딧불 개울', '숲의 왕관'] },
    { id: 'sea', title: '2장 바다', name: '반짝이는 바다', minLevel: 5, reward: 'coral_sea', stages: ['모래사장', '조개 언덕', '파도 다리', '산호 정원', '바다의 왕관'] },
    { id: 'castle', title: '3장 성', name: '구름 위 성', minLevel: 10, reward: 'cloud_castle', stages: ['구름 계단', '바람 탑', '별빛 복도', '무지개 문', '성의 왕관'] },
    { id: 'desert', title: '4장 사막', name: '모래바람 오아시스', minLevel: 20, reward: 'oasis', gear: ['wood_sword', 'wood_staff'], questions: 12, stages: ['모래 언덕', '선인장 길', '신기루 다리', '오아시스 샘', '사막의 왕관'] },
    { id: 'snow', title: '5장 설산', name: '눈꽃 산맥', minLevel: 35, reward: 'snow_cabin', questions: 12, stages: ['눈길 입구', '얼음 호수', '눈꽃 동굴', '오로라 능선', '설산의 왕관'] },
    { id: 'night', title: '6장 밤하늘', name: '별똥별 언덕', minLevel: 50, reward: 'galaxy', questions: 15, stages: ['반딧불 들판', '달빛 계단', '별자리 다리', '별똥별 언덕', '밤하늘의 왕관'] },
    { id: 'dream', title: '7장 꿈의 정원', name: '무지개 너머', minLevel: 70, reward: 'dream_garden', questions: 15, stages: ['솜사탕 구름', '꽃잎 미로', '무지개 다리', '꿈의 분수', '정원의 왕관'] },
  ] as { id: string; title: string; name: string; minLevel: number; reward: string; gear?: string[]; questions?: number; stages: string[] }[],
  bonus: { clear: 20, star2: 10, star3: 10 },
  bossStars: 2,
  /** 1차 전직: clearing this chapter's crown stage lets the pet choose 검사 or 마법사 (once per pet). */
  jobChapter: 'snow',
  /** This chapter's crown stage gives the pet's job its better weapon (the job's `nextWeapon`). */
  weaponChapter: 'night',
  /** 2차 전직: clearing this chapter's crown stage lets a pet with a job choose its light or dark branch (once). */
  job2Chapter: 'dream',
  /** Three stars on the 2차 전직 crown stage: both dream weapons (looks only), once per student. */
  perfectGear: ['dream_sword', 'dream_staff'],
} as const;
/**
 * 원정대 games by stage (the same in every chapter): 1 단어 먹이 (뜻 고르기), 2 철자 맞히기, 3 듣고 고르기 (from 4장: 문장
 * 배열), 4 짝 맞추기, 👑 섞어서 (from 4장 with 낭독). Sentences come from the admin's 학년별 문장 세트.
 */
export type StageGame = 'meaning' | 'spell' | 'listen' | 'order' | 'match' | 'mix';
export const STAGE_GAME_LABEL: Record<StageGame, string> = { meaning: '단어 먹이', spell: '철자 맞히기', listen: '듣고 고르기', order: '문장 배열', match: '짝 맞추기', mix: '섞어서' };
/** From this chapter on (0 = 1장) stage 3 is 문장 배열 and the crown stage mixes in sentences (문장 배열 and 낭독). */
export const SENTENCE_FROM_CHAPTER = 3;
export function stageGame(stage?: string | null): StageGame {
  if (!stage) return 'meaning';
  const [chapterId, n] = stage.split('-'), ci = PET_EXPEDITION.chapters.findIndex(c => c.id === chapterId), sentences = ci >= SENTENCE_FROM_CHAPTER;
  return n === '1' ? 'meaning' : n === '2' ? 'spell' : n === '3' ? (sentences ? 'order' : 'listen') : n === '4' ? 'match' : 'mix';
}
/** Stages with sound (듣고 고르기, or the crown's mix): the quiet-place question comes first, every time. */
export const stageHasSound = (stage?: string | null) => ['listen', 'mix'].includes(stageGame(stage));
export const stageWithSentences = (stage?: string | null) => { const g = stageGame(stage); return g === 'order' || (g === 'mix' && PET_EXPEDITION.chapters.findIndex(c => c.id === String(stage).split('-')[0]) >= SENTENCE_FROM_CHAPTER); };
/** 원정대 문장 세트 by school grade (관리자 설정). 초등 and unknown grades use 중1; teachers 고3; an empty grade falls back to 고3. */
export const SENTENCE_GRADES = ['초등', '중1', '중2', '중3', '고1', '고2', '고3'] as const;
export type SentenceGrade = typeof SENTENCE_GRADES[number];
export const stageQuestions = (stage?: string | null) => (stage && PET_EXPEDITION.chapters.find(c => stage.startsWith(c.id + '-'))?.questions) || PET_WORD_FEED.questions;
/** 1차 전직 (5장 설산 왕관, Lv.35): 펫마다 한 번. 직업 무기를 받고, 6장 밤하늘 왕관에서 더 좋은 무기(`nextWeapon`)를 받아요. */
export type PetJob = 'swordsman' | 'wizard';
export const PET_JOBS: Record<PetJob, { label: string; weapon: string; nextWeapon: string; icon: string; line: string }> = {
  swordsman: { label: '검사', weapon: 'ice_sword', nextWeapon: 'star_sword', icon: '⚔️', line: '검사가 될래요' },
  wizard: { label: '마법사', weapon: 'ice_staff', nextWeapon: 'moon_staff', icon: '🪄', line: '마법사가 될래요' },
};
/** 2차 전직 (7장 꿈의 정원 왕관, Lv.70): 1차 직업마다 빛과 어둠 두 갈래. 갈래의 무기와 칭호를 받아요. */
export type PetJob2 = 'paladin' | 'dark_knight' | 'white_mage' | 'dark_mage';
export const PET_JOB2: Record<PetJob2, { label: string; base: PetJob; element: '빛' | '어둠'; weapon: string; title: string; icon: string; line: string }> = {
  paladin: { label: '성기사', base: 'swordsman', element: '빛', weapon: 'holy_sword', title: '빛의 수호자', icon: '🛡️', line: '빛의 길로 갈래요' },
  dark_knight: { label: '흑기사', base: 'swordsman', element: '어둠', weapon: 'obsidian_sword', title: '그림자 기사', icon: '🗡️', line: '어둠의 길로 갈래요' },
  white_mage: { label: '백마법사', base: 'wizard', element: '빛', weapon: 'dawn_scepter', title: '새벽의 현자', icon: '✨', line: '빛의 길로 갈래요' },
  dark_mage: { label: '흑마법사', base: 'wizard', element: '어둠', weapon: 'crescent_staff', title: '달그림자 마도사', icon: '🌙', line: '어둠의 길로 갈래요' },
};
/** 3차 전직 「별의 시험」: a pet with its 2차 job at Lv.150 that has cleared 채움의 탑 floor 50 takes the one 3차 job of its
 *  branch (no choice: the branch was chosen at the 2차). The weapon, a title, an aura around the pet (looks only) and a skill. */
export type PetJob3 = 'sky_knight' | 'abyss_knight' | 'dawn_sage' | 'dusk_mage';
export const PET_JOB3: Record<PetJob3, { label: string; from: PetJob2; weapon: string; title: string; icon: string }> = {
  sky_knight: { label: '천공의 기사', from: 'paladin', weapon: 'sky_spear', title: '하늘을 가르는 자', icon: '🌤️' },
  abyss_knight: { label: '심연의 기사', from: 'dark_knight', weapon: 'abyss_greatsword', title: '심연을 걷는 자', icon: '🌑' },
  dawn_sage: { label: '여명의 대현자', from: 'white_mage', weapon: 'dawn_staff', title: '새벽을 여는 자', icon: '🌅' },
  dusk_mage: { label: '그믐의 마도사', from: 'dark_mage', weapon: 'dusk_tome', title: '그믐밤의 별', icon: '📖' },
};
export const PET_JOB3_RULE = { name: '별의 시험', level: 150, floor: 50 } as const;
/** The 3차 job a 2차 job leads to. */
export const job3For = (job2?: PetJob2 | null) => (Object.keys(PET_JOB3) as PetJob3[]).find(k => PET_JOB3[k].from === job2) || null;
/** The aura a 3차 pet shows: the light branches glow gold and sky, the dark ones violet. */
export const petAura = (pet: { job3?: PetJob3 | null }) => pet.job3 ? (PET_JOB2[PET_JOB3[pet.job3].from].element === '빛' ? 'light' : 'dark') : null;
/** The job shown on a pet (the highest it has taken). */
export const petJobLabel = (pet: { job?: PetJob | null; job2?: PetJob2 | null; job3?: PetJob3 | null }) => pet.job3 ? PET_JOB3[pet.job3].label : pet.job2 ? PET_JOB2[pet.job2].label : pet.job ? PET_JOBS[pet.job].label : '';
/** Where the jobs are taken (next to the skill button, the tower stats and the expedition map). */
export const PET_JOB_GUIDE = '스킬은 전직 후 · 1차 전직: 5장 설산 · 2차 전직: 7장 꿈의 정원 · 3차 전직: Lv.150 + 탑 50층';
/** 파티 원정대: 2–4 students, one team a week (Monday–Sunday, Seoul). Every word a member answers right for the first time
 *  that week (in 단어 먹이 주기 or a stage) takes 1 off the boss. Rewards are paid after the week, by contribution, outside
 *  the daily study cap but at most `weeklyCap` per student. Names are picked from fixed words; nicknames are free text
 *  that an admin can warn (a warned nickname must be changed and can't be used again). */
export const PET_PARTY = {
  sizes: [2, 3, 4],
  bosses: [{ id: 'forest', name: '숲의 거인', icon: '🌳' }, { id: 'sea', name: '바다의 고래', icon: '🐋' }, { id: 'castle', name: '성의 용', icon: '🐉' }],
  nameA: ['반짝', '용감한', '졸린', '씩씩한', '말랑한', '빛나는', '신나는', '조용한'],
  nameB: ['해달', '별빛', '토끼', '구름', '고래', '여우', '사탕', '바람'],
  phrases: ['같이 모험할 친구 구해요!', '매일 조금씩 해요', '단어 왕 모여라!', '천천히 함께해요', '오늘부터 열심히!', '주말에 몰아서 해요'],
  hpPerMember: 100, poolPerMember: 150, partialFrom: 0.3, participateMin: 10, weeklyCap: 500, inactiveDays: 3,
  nickname: { min: 2, max: 10 },
} as const;
export const PET_WORD_FEED = { questions: 10, minQuestions: 5, choices: 3, wrongAnswers: 3, retryAfter: 3, books: 3, sessionScan: 80, wordWindow: 120, energy: 10 };

/**
 * 채움의 탑: a turn-based climb, one floor per battle. Attacking: pick an action, then answer the word (right = hit).
 * The monster's turn: answer the meaning within `defendSeconds` to block (less damage); either way the damage depends on
 * the pet's level and gear. Progress is saved on every floor cleared; running away empties 기운 (탈진). Every
 * `bossEvery` floors a boss guards a treasure chest. Words come from the hard wordbook the admin sets (중등 / 고등).
 */
export const PET_TOWER = {
  name: '채움의 탑', floors: 100, doors: 3, bossEvery: 10, energy: 10, defendSeconds: 8, choices: 4, poolSize: 60,
  potionHeal: 0.4, startPotions: 2,
  /** 함정 바닥: answer within this many seconds. 상인: prices in points. A won battle drops a 강화석 this often. */
  trapSeconds: 6, stonePrice: 120, potionPrice: 40, stoneDrop: 0.3, merchantPotions: 3,
  /** 잠든 드래곤: sneaking past takes at least this long along the U path (checked by the server); woken, it fights at
   *  end-game strength (a top-level pet in full enhanced gear has to block every turn). `dragonColors`: how many looks. */
  sneakMinMs: 3000, dragon: { hp: 3000, atk: 800, def: 380 }, dragonColors: 6,
  /** First clear of a floor (inside the daily study cap): points and XP; a boss floor pays `boss`. */
  reward: { base: 10, perFloor: 5, boss: 100 },
} as const;
export type TowerGearSlot = 'weapon' | 'helmet' | 'armor' | 'shoulder' | 'gloves' | 'boots';
export const TOWER_GEAR_SLOTS: { id: TowerGearSlot; label: string }[] = [{ id: 'weapon', label: '무기' }, { id: 'helmet', label: '투구' }, { id: 'armor', label: '갑옷' }, { id: 'shoulder', label: '견갑' }, { id: 'gloves', label: '장갑' }, { id: 'boots', label: '신발' }];
/** Tower equipment (never in the shop). `job`: only for a pet with that job (none = 견습자도 OK). */
export interface TowerGear { id: string; name: string; /** in the small slot */ short: string; slot: TowerGearSlot; icon: string; atk?: number; def?: number; hp?: number; mp?: number; job?: PetJob; job2?: PetJob2; job3?: PetJob3;
  /** Boss treasures change with the pet's job (name and stats): 검사 more 방어/체력, 마법사 more 마력. */ variants?: Partial<Record<PetJob, { name: string; short: string; atk?: number; def?: number; hp?: number; mp?: number }>>;
  /** 크리티컬 확률 per 강화 level (%): 견습 0.5, boss gear 1, job weapons 1.5. */ critPerLevel?: number;
  /** A 원정대 job weapon: owned through the expedition (the student's inventory), not found in the tower. */ expedition?: boolean;
  /** 장비 세트 piece: its tier (0 견습 … 5 마도사) */ set?: number }
export const TOWER_GEAR: TowerGear[] = [
  { id: 'apprentice_club', name: '견습 몽둥이', short: '몽둥이', slot: 'weapon', icon: '🏏', atk: 6, critPerLevel: 0.5 },
  // 원정대 job weapons, also worn in the tower (1차 전직 12, 6장 22, 2차 전직 32 공격; enhanced like the rest).
  { id: 'ice_sword', name: '설원의 검', short: '설원의 검', slot: 'weapon', icon: '🗡️', atk: 12, job: 'swordsman', critPerLevel: 1.5, expedition: true },
  { id: 'ice_staff', name: '눈꽃 지팡이', short: '눈꽃 지팡이', slot: 'weapon', icon: '❄️', atk: 12, job: 'wizard', critPerLevel: 1.5, expedition: true },
  { id: 'star_sword', name: '별무리 대검', short: '별무리 대검', slot: 'weapon', icon: '⭐', atk: 22, job: 'swordsman', critPerLevel: 1.5, expedition: true },
  { id: 'moon_staff', name: '은하수 지팡이', short: '은하수 지팡이', slot: 'weapon', icon: '🌙', atk: 22, job: 'wizard', critPerLevel: 1.5, expedition: true },
  { id: 'holy_sword', name: '빛의 성검', short: '빛의 성검', slot: 'weapon', icon: '🗡️', atk: 32, job: 'swordsman', job2: 'paladin', critPerLevel: 1.5, expedition: true },
  { id: 'obsidian_sword', name: '흑요 마검', short: '흑요 마검', slot: 'weapon', icon: '🗡️', atk: 32, job: 'swordsman', job2: 'dark_knight', critPerLevel: 1.5, expedition: true },
  { id: 'dawn_scepter', name: '새벽빛 홀', short: '새벽빛 홀', slot: 'weapon', icon: '✨', atk: 32, job: 'wizard', job2: 'white_mage', critPerLevel: 1.5, expedition: true },
  { id: 'crescent_staff', name: '그믐달 지팡이', short: '그믐달 지팡이', slot: 'weapon', icon: '🌙', atk: 32, job: 'wizard', job2: 'dark_mage', critPerLevel: 1.5, expedition: true },
  // 3차 전직 weapons (44 공격, above the 40층 서리 용 treasures)
  { id: 'sky_spear', name: '천공의 성창', short: '천공의 성창', slot: 'weapon', icon: '🌤️', atk: 44, job: 'swordsman', job2: 'paladin', job3: 'sky_knight', critPerLevel: 1.5, expedition: true },
  { id: 'abyss_greatsword', name: '심연의 대검', short: '심연의 대검', slot: 'weapon', icon: '🌑', atk: 44, job: 'swordsman', job2: 'dark_knight', job3: 'abyss_knight', critPerLevel: 1.5, expedition: true },
  { id: 'dawn_staff', name: '여명의 지팡이', short: '여명의 지팡이', slot: 'weapon', icon: '🌅', atk: 44, job: 'wizard', job2: 'white_mage', job3: 'dawn_sage', critPerLevel: 1.5, expedition: true },
  { id: 'dusk_tome', name: '그믐달 마도서', short: '그믐달 마도서', slot: 'weapon', icon: '📖', atk: 44, job: 'wizard', job2: 'dark_mage', job3: 'dusk_mage', critPerLevel: 1.5, expedition: true },
  // Each boss keeps a treasure of its own: 10층 수문장 골렘 → 돌 견갑 (later bosses: 투구·장갑·신발·갑옷; past the floors for
  // Lv.70+, weapons for 검사 or 마법사).
  { id: 'golem_pauldron', name: '수문장의 돌 견갑', short: '돌 견갑', slot: 'shoulder', icon: '🪨', def: 8, hp: 20, critPerLevel: 1,
    variants: { swordsman: { name: '수문장의 강철 견갑', short: '강철 견갑', def: 12, hp: 30 }, wizard: { name: '수문장의 룬 견갑', short: '룬 견갑', def: 6, hp: 20, mp: 8 } } },
  { id: 'crystal_helm', name: '수정 투구', short: '수정 투구', slot: 'helmet', icon: '💎', def: 10, hp: 30, critPerLevel: 1,
    variants: { swordsman: { name: '수정 기사 투구', short: '기사 투구', def: 14, hp: 40 }, wizard: { name: '수정 마법 모자', short: '마법 모자', def: 8, hp: 30, mp: 10 } } },
  { id: 'sun_gloves', name: '태양 장갑', short: '태양 장갑', slot: 'gloves', icon: '☀️', atk: 6, def: 6, critPerLevel: 1,
    variants: { swordsman: { name: '태양 건틀릿', short: '건틀릿', atk: 10, def: 8 }, wizard: { name: '태양 마법 장갑', short: '마법 장갑', atk: 8, def: 4, mp: 12 } } },
  { id: 'snow_boots', name: '눈송이 신발', short: '눈송이 신발', slot: 'boots', icon: '❄️', def: 10, hp: 40, critPerLevel: 1,
    variants: { swordsman: { name: '서리 기사 장화', short: '기사 장화', def: 14, hp: 50 }, wizard: { name: '눈꽃 마법 신발', short: '마법 신발', def: 8, hp: 40, mp: 14 } } },
  { id: 'star_armor', name: '별빛 갑옷', short: '별빛 갑옷', slot: 'armor', icon: '✨', def: 16, hp: 60, critPerLevel: 1,
    variants: { swordsman: { name: '별빛 판금 갑옷', short: '판금 갑옷', def: 22, hp: 80 }, wizard: { name: '별빛 로브', short: '별빛 로브', def: 12, hp: 60, mp: 18 } } },
  // 40층 서리 용's job weapon treasure (the chest gives the one for the pet's job).
  { id: 'frost_greatsword', name: '서리 용의 대검', short: '서리 대검', slot: 'weapon', icon: '🗡️', atk: 40, job: 'swordsman', critPerLevel: 1.5 },
  { id: 'frost_staff', name: '서리 용의 지팡이', short: '서리 지팡이', slot: 'weapon', icon: '🪄', atk: 40, job: 'wizard', critPerLevel: 1.5 },
];
/** 장비 세트: one set a tier (견습 → 마도사), 6 places each, found in the tower (and on 원정대 ★3); 검사 and 마법사 versions.
 *  Stats grow with the tier; 3 places of one set: 능력치 +5%, all 6: +12% and a glow. */
const SET_NOUNS: Record<TowerGearSlot, [string, string, string]> = { weapon: ['무기', '검', '지팡이'], helmet: ['투구', '투구', '모자'], armor: ['갑옷', '갑옷', '로브'], shoulder: ['견갑', '견갑', '견갑'], gloves: ['장갑', '건틀릿', '장갑'], boots: ['신발', '장화', '신발'] };
const SET_ICONS: Record<TowerGearSlot, string> = { weapon: '🗡️', helmet: '⛑️', armor: '🛡️', shoulder: '🪨', gloves: '🧤', boots: '🥾' };
const SET_BASE: Record<TowerGearSlot, { atk?: number; def?: number; hp?: number }> = { weapon: { atk: 4 }, helmet: { def: 3, hp: 8 }, armor: { def: 4, hp: 12 }, shoulder: { def: 3, hp: 6 }, gloves: { atk: 2, def: 2 }, boots: { def: 3, hp: 8 } };
export const GEAR_SET_SHORT = ['견습', '이끼', '수정', '모래', '얼음', '마도', '화염', '심해', '천공', '성운', '용왕'] as const;
export const GEAR_SET_BONUS = { three: 0.05, six: 0.12 } as const;
export const setGearId = (tier: number, slot: TowerGearSlot) => `set_${tier}_${slot}`;
function setPiece(tier: number, slot: TowerGearSlot): TowerGear {
  const k = 1 + tier * 0.6, b = SET_BASE[slot], up = (n?: number, x = 1) => n ? Math.round(n * k * x) : undefined, [plain, sword, wiz] = SET_NOUNS[slot], name = (noun: string) => `${GEAR_SET_SHORT[tier]} ${noun}`;
  const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return clean({ id: setGearId(tier, slot), name: name(plain), short: name(plain), slot, icon: SET_ICONS[slot], set: tier, atk: up(b.atk), def: up(b.def), hp: up(b.hp), critPerLevel: Math.round((0.5 + tier * 0.1) * 10) / 10,
    variants: { swordsman: clean({ name: name(sword), short: name(sword), atk: up(b.atk), def: up(b.def, 1.25), hp: up(b.hp, 1.25) }), wizard: clean({ name: name(wiz), short: name(wiz), atk: up(b.atk), def: up(b.def), hp: up(b.hp), mp: slot === 'weapon' ? undefined : 2 + tier * 2 }) } });
}
export const TOWER_SET_GEAR: TowerGear[] = GEAR_SET_SHORT.flatMap((_, t) => TOWER_GEAR_SLOTS.map(s => setPiece(t, s.id)));
TOWER_GEAR.push(...TOWER_SET_GEAR);
/** Which set a floor drops (1–5 견습, 6–10 이끼 숲, 11–20 수정 동굴, 21–30 모래 신전, 31–40 얼음 성채, 41+ 마도사) and a 원정대 chapter
 *  gives on ★3 (1–2장 견습, 3장 이끼 숲 … 7장 마도사); 51~100층: 화염 · 심해 · 천공 · 성운 · 용왕, ten floors each (tower only).
 *  Normal floors: 15% on the first clear; boss floors: always one. */
export const floorGearTier = (floor: number) => floor <= 5 ? 0 : floor <= 10 ? 1 : Math.min(GEAR_SET_SHORT.length - 1, 2 + Math.floor((floor - 11) / 10));
export const chapterGearTier = (chapterIndex: number) => [0, 0, 1, 2, 3, 4, 5][chapterIndex] ?? 5;
export const GEAR_DROP = { floorChance: 0.15 } as const;
export const towerGear = (id: string) => TOWER_GEAR.find(g => g.id === id);
/** A piece of gear as this pet wears it: boss treasures take the job's name and stats (before the job, the plain one). */
export function towerGearFor(id: string, job?: PetJob | null): TowerGear | undefined {
  const g = towerGear(id), v = job && g?.variants?.[job];
  return g && v ? { ...g, ...v } : g;
}
/** 장비 그림 단계: 0 견습 · 1 이끼 숲 · 2 수정 동굴 · 3 모래 신전 · 4 얼음 성채 · 5 마도사, then (51~100층) 6 화염 · 7 심해 · 8 천공 ·
 *  9 성운 · 10 용왕 (more detail, and from 수정 동굴 it moves). */
export const GEAR_TIER_NAMES = ['견습', '이끼 숲', '수정 동굴', '모래 신전', '얼음 성채', '마도사', '화염', '심해', '천공', '성운', '용왕'] as const;
const GEAR_LOOKS: Record<string, number> = {
  apprentice_club: 0, golem_pauldron: 1, crystal_helm: 2, sun_gloves: 3, snow_boots: 4, star_armor: 5, frost_greatsword: 4, frost_staff: 4,
  ice_sword: 3, ice_staff: 3, star_sword: 4, moon_staff: 4, holy_sword: 5, obsidian_sword: 5, dawn_scepter: 5, crescent_staff: 5,
  sky_spear: 5, abyss_greatsword: 5, dawn_staff: 5, dusk_tome: 5,
};
export const gearLookTier = (id: string) => towerGear(id)?.set ?? GEAR_LOOKS[id] ?? 0;
/** How the worn tower gear looks (kept on the pet, so the home, the ranking and the party can draw it). */
export interface PetGearLook { look: Partial<Record<TowerGearSlot, number>>; /** a full 6-piece set of one tier: glow (and more) */ full?: number | null }
export interface PetGearView extends PetGearLook { style: 'knight' | 'mage' }
export function gearLookOf(equip: Partial<Record<TowerGearSlot, string>>): PetGearLook {
  const look: Partial<Record<TowerGearSlot, number>> = {};
  for (const { id: slot } of TOWER_GEAR_SLOTS) { const id = equip[slot]; if (id && towerGear(id)) look[slot] = gearLookTier(id); }
  const sets = TOWER_GEAR_SLOTS.map(s => towerGear(String(equip[s.id] || ''))?.set);
  return { look, full: sets.every(t => t !== undefined && t === sets[0]) ? sets[0]! : null };
}
/** What the pet shows (null: 👁 off or nothing worn). 검사 → 검사 모양, 마법사 → 마법사 모양; before the job, the look picked. */
export function petGearView(pet: { job?: PetJob | null; gear?: PetGearLook | null; gearShow?: boolean; gearStyle?: PetJob | null } | null | undefined): PetGearView | null {
  if (!pet || pet.gearShow === false || !pet.gear || !Object.keys(pet.gear.look || {}).length) return null;
  return { style: (pet.job || pet.gearStyle) === 'wizard' ? 'mage' : 'knight', look: pet.gear.look, full: pet.gear.full ?? null };
}
/** 탑 장식: the first clear of each zone's boss floor gives that zone's room decoration (once a student, never in the
 *  shop), placed in the room like the 금메달 (the same 꾸미기); ten, one for each zone (floors 10–100). */
export const TOWER_DECOR: { id: string; name: string; floor: number }[] = [
  { id: 'moss_pot', name: '이끼 화분', floor: 10 }, { id: 'crystal_lamp', name: '수정 램프', floor: 20 }, { id: 'hourglass', name: '모래시계', floor: 30 },
  { id: 'ice_statue', name: '얼음 조각상', floor: 40 }, { id: 'spellbook_shelf', name: '마도서 책장', floor: 50 },
  { id: 'lava_brazier', name: '용암 화로', floor: 60 }, { id: 'pearl_bed', name: '진주 조개 침대', floor: 70 }, { id: 'cloud_swing', name: '구름 그네', floor: 80 },
  { id: 'star_telescope', name: '별자리 망원경', floor: 90 }, { id: 'dragon_throne', name: '용왕의 왕좌', floor: 100 },
];
export const towerDecor = (id: string) => TOWER_DECOR.find(d => d.id === id);
/** Treasure chests: floor 1 (at the entrance) and after each boss (that boss's own treasure). */
export const TOWER_CHESTS: Record<number, { gear: string[]; potions: number; /** a job weapon: the one for the pet's job */ jobWeapon?: Record<PetJob, string>; /** 51~100층 bosses: 강화석 */ stones?: number }> = {
  1: { gear: ['apprentice_club'], potions: PET_TOWER.startPotions },
  10: { gear: ['golem_pauldron'], potions: 2 },
  20: { gear: ['crystal_helm'], potions: 3 },
  30: { gear: ['sun_gloves'], potions: 3 },
  40: { gear: ['snow_boots'], potions: 4, jobWeapon: { swordsman: 'frost_greatsword', wizard: 'frost_staff' } },
  50: { gear: ['star_armor'], potions: 5 },
  // 51~100층 bosses: potions and 강화석 (their set piece drops on the floor as always)
  60: { gear: [], potions: 5, stones: 2 }, 70: { gear: [], potions: 6, stones: 2 }, 80: { gear: [], potions: 6, stones: 3 }, 90: { gear: [], potions: 7, stones: 3 }, 100: { gear: [], potions: 8, stones: 5 },
};
export type TowerMonsterKind = 'slime' | 'bat' | 'mushroom' | 'golem' | 'fairy' | 'shadow' | 'dragon' | 'gatekeeper' | 'obsidian_golem' | 'gold_golem'
  | 'crystal_slime' | 'vampire_bat' | 'cave_spider' | 'crystal_queen' | 'sand_scorpion' | 'mummy' | 'temple_cat' | 'sphinx'
  | 'snow_spirit' | 'ice_wolf' | 'frost_knight' | 'frost_dragon' | 'shadow_knight' | 'magic_doll' | 'cursed_book' | 'archmage'
  | 'lava_slime' | 'fire_lizard' | 'ash_golem' | 'fire_drake' | 'glow_jelly' | 'merfolk_knight' | 'turtle_guard' | 'kraken'
  | 'wind_spirit' | 'griffin' | 'thunder_bird' | 'storm_griffin' | 'star_fairy' | 'meteor_golem' | 'comet_fox' | 'nebula_whale'
  | 'dragon_knight' | 'time_mage' | 'gold_wyvern' | 'dragon_king';
/** 1구역 (floors 1–9) monsters; TOWER_ZONES has every zone. Floor 10 is the boss. */
export const TOWER_MONSTERS: { kind: TowerMonsterKind; name: string }[] = [
  { kind: 'slime', name: '말랑 슬라임' }, { kind: 'bat', name: '밤 박쥐' }, { kind: 'mushroom', name: '버섯돌이' }, { kind: 'golem', name: '골렘' },
];
/** 10 floors a zone, each with its monsters and a boss on the last floor (more zones can come later). `level`: the
 *  recommended level (the tower is always open). */
export const TOWER_ZONES: { from: number; to: number; name: string; level: number; monsters: { kind: TowerMonsterKind; name: string }[]; boss: { kind: TowerMonsterKind; name: string } }[] = [
  { from: 1, to: 10, name: '이끼 숲', level: 1, monsters: TOWER_MONSTERS, boss: { kind: 'gatekeeper', name: '고대 수문장 골렘' } },
  { from: 11, to: 20, name: '수정 동굴', level: 20, monsters: [{ kind: 'crystal_slime', name: '수정 슬라임' }, { kind: 'vampire_bat', name: '흡혈 박쥐' }, { kind: 'cave_spider', name: '동굴 거미' }, { kind: 'golem', name: '골렘' }], boss: { kind: 'crystal_queen', name: '수정 여왕 거미' } },
  { from: 21, to: 30, name: '모래 신전', level: 40, monsters: [{ kind: 'sand_scorpion', name: '모래 전갈' }, { kind: 'mummy', name: '미라' }, { kind: 'gold_golem', name: '황금 골렘' }, { kind: 'temple_cat', name: '신전 고양이' }], boss: { kind: 'sphinx', name: '스핑크스' } },
  { from: 31, to: 40, name: '얼음 성채', level: 70, monsters: [{ kind: 'snow_spirit', name: '눈 정령' }, { kind: 'ice_wolf', name: '얼음 늑대' }, { kind: 'frost_knight', name: '서리 기사' }], boss: { kind: 'frost_dragon', name: '서리 용' } },
  { from: 41, to: 50, name: '마도사의 탑', level: 100, monsters: [{ kind: 'shadow_knight', name: '그림자 기사' }, { kind: 'magic_doll', name: '마도 인형' }, { kind: 'cursed_book', name: '저주받은 책' }], boss: { kind: 'archmage', name: '대마도사' } },
  // 51–100층 (Lv.120 → 200): 화염 → 심해 → 천공 → 성운 → 용왕
  { from: 51, to: 60, name: '화염 용암굴', level: 120, monsters: [{ kind: 'lava_slime', name: '용암 슬라임' }, { kind: 'fire_lizard', name: '불꽃 도마뱀' }, { kind: 'ash_golem', name: '재 골렘' }], boss: { kind: 'fire_drake', name: '화염 드레이크' } },
  { from: 61, to: 70, name: '심해 신전', level: 140, monsters: [{ kind: 'glow_jelly', name: '빛 해파리' }, { kind: 'merfolk_knight', name: '인어 기사' }, { kind: 'turtle_guard', name: '거북 수호자' }], boss: { kind: 'kraken', name: '크라켄' } },
  { from: 71, to: 80, name: '천공의 섬', level: 160, monsters: [{ kind: 'wind_spirit', name: '바람 정령' }, { kind: 'griffin', name: '그리핀' }, { kind: 'thunder_bird', name: '번개 새' }], boss: { kind: 'storm_griffin', name: '폭풍의 그리핀' } },
  { from: 81, to: 90, name: '성운의 정원', level: 180, monsters: [{ kind: 'star_fairy', name: '별 요정' }, { kind: 'meteor_golem', name: '운석 골렘' }, { kind: 'comet_fox', name: '혜성 여우' }], boss: { kind: 'nebula_whale', name: '성운 고래' } },
  { from: 91, to: 100, name: '용왕의 왕좌', level: 200, monsters: [{ kind: 'dragon_knight', name: '용 기사' }, { kind: 'time_mage', name: '시간 마도사' }, { kind: 'gold_wyvern', name: '황금 와이번' }], boss: { kind: 'dragon_king', name: '태초의 용왕' } },
];
export const towerZone = (floor: number) => TOWER_ZONES.find(z => floor >= z.from && floor <= z.to) || TOWER_ZONES[TOWER_ZONES.length - 1];
/** 10층: the obsidian 고대 수문장 골렘 (purple runes, a crystal crown). The floors' own 골렘 is a smaller, mossy one; from
 *  floor 16 it comes as the 흑요석 골렘 and from floor 21 as the 황금 골렘 (same shape, other stone). */
export const TOWER_BOSSES: Record<number, { kind: TowerMonsterKind; name: string }> = Object.fromEntries(TOWER_ZONES.map(z => [z.to, z.boss]));
const golemFor = (floor: number) => floor >= 21 ? { kind: 'gold_golem' as const, name: '황금 골렘' } : floor >= 16 ? { kind: 'obsidian_golem' as const, name: '흑요석 골렘' } : null;
/** The pet's battle stats: level first, gear on top (each 강화 level: weapon +2 공격, other gear +2 방어; 마법사 gear adds 마력). */
export function towerStats(level: number, gear: (TowerGear | undefined)[], levels: Record<string, number> = {}) {
  const plus = (g: TowerGear | undefined, k: 'atk' | 'def') => g && (levels[g.id] || 0) * ((g.slot === 'weapon') === (k === 'atk') ? TOWER_ENHANCE_STEP : 0) || 0;
  const add = (k: 'atk' | 'def' | 'hp' | 'mp') => gear.reduce((n, g) => n + (g?.[k] || 0) + (k === 'hp' || k === 'mp' ? 0 : plus(g, k)), 0);
  const up = 1 + gearSetBonus(gear), x = (n: number) => Math.round(n * up);
  return { atk: x(10 + level * 2 + add('atk')), def: x(4 + level + add('def')), hp: x(60 + level * 4 + add('hp')), mp: x(20 + Math.floor(level / 2) + add('mp')) };
}
/** 세트 효과: each set with 3 places worn +5%, a full set +12% (two half sets: +10%). */
export function gearSetBonus(gear: (TowerGear | undefined)[]) {
  const count: Record<number, number> = {}; for (const g of gear) if (g?.set !== undefined) count[g.set] = (count[g.set] || 0) + 1;
  return Object.values(count).reduce((n, c) => n + (c >= 6 ? GEAR_SET_BONUS.six : c >= 3 ? GEAR_SET_BONUS.three : 0), 0);
}
/** `door`: which of the floor's three doors was opened (a different monster behind each; same strength). */
export function towerMonster(floor: number, door = 0) {
  const list = towerZone(floor).monsters, pick = list[(floor - 1 + door) % list.length], boss = TOWER_BOSSES[floor], look = boss || (pick.kind === 'golem' && golemFor(floor)) || pick;
  const hp = 40 + floor * 15, atk = 12 + floor * 4, def = 3 + floor * 2;
  // A boss: about twice a floor monster's 체력, a little more 공격 (floor 10 stays as it was).
  return boss ? { ...look, boss: true, hp: Math.round(hp * 2.2), atk: Math.round(atk * 1.15), def } : { ...look, boss: false, hp, atk, def };
}
/** Damage: a hit on the monster; the monster's hit on the pet when blocked or not. Always at least 1 (2 unblocked). */
export const towerHit = (atk: number, def: number) => Math.max(1, Math.round(atk - def / 2));
export const towerTaken = (atk: number, def: number, blocked: boolean) => blocked ? Math.max(1, Math.round(atk * 0.25 - def * 0.2)) : Math.max(2, Math.round(atk - def / 2));

/** What can wait behind a door (not a boss floor). Each pet's floor has its own fixed set (the same on a retry, different
 *  for other students); `weight`: how often. */
export type TowerEvent = 'monster' | 'treasure' | 'merchant' | 'mirror' | 'riddle' | 'sleeping' | 'trap' | 'fairy'
  /** 쉬어 가기 놀이 (api/_lib/towerGames), opening zone by zone */ | 'mimic' | 'fortune' | 'lilypad' | 'mushroom' | 'echo' | 'crystal' | 'maze' | 'scale' | 'jars' | 'icelock' | 'icepath' | 'runes' | 'scroll' | 'potions' | 'lavapath' | 'lavarun' | 'shells' | 'bubbles' | 'windpath' | 'blanks' | 'oneline' | 'stars' | 'hoard' | 'trial';
/** A 쉬어 가기 놀이 lost: the pet starts its next battle with one of these (then it wears off). */
/** What a debuff does (`TOWER_DEBUFF_RULES`): def −방어, atk −공격, hp 체력이 줄어든 채, mp MP 절반, block 첫 막기 문제가 짧게,
 *  dot 화상·독 3턴. Each game names its own (젖음, 손이 꽁꽁, 엉덩방아…). */
type DebuffEffect = 'def' | 'atk' | 'hp' | 'mp' | 'block' | 'dot';
const debuff = (icon: string, name: string, effect: DebuffEffect, text: string, dot?: '화상' | '독') => ({ icon, name, effect, text, ...(dot ? { dot } : {}) });
export const TOWER_DEBUFFS = {
  wet: debuff('💧', '물에 젖음', 'def', '몸이 무거워 방어 -15%'),
  curse: debuff('🌑', '불운', 'hp', '체력 -10%로 시작'),
  dazzle: debuff('😵', '눈이 침침', 'atk', '공격 -10%'),
  deafen: debuff('🙉', '귀가 멍멍', 'block', '첫 막기 문제는 4초'),
  bitten: debuff('🐍', '뱀독', 'dot', '독에 걸린 채 시작 (3턴)', '독'),
  drained: debuff('😮‍💨', '기운 빠짐', 'mp', 'MP 절반으로 시작'),
  frozen: debuff('❄️', '손이 꽁꽁', 'atk', '손이 얼어 공격 -10%'),
  bruised: debuff('🤕', '엉덩방아', 'def', '꽈당! 방어 -15%'),
  backlash: debuff('💫', '마력 반동', 'mp', '룬이 튕겨 MP 절반으로 시작'),
  recoil: debuff('📜', '주문 역류', 'hp', '주문이 되돌아와 체력 -10%로 시작'),
  tummy: debuff('🤢', '배탈', 'dot', '이상한 물약에 배탈이 난 채 시작 (3턴)', '독'),
  burned: debuff('🔥', '화상', 'dot', '발을 데어 화상 입은 채 시작 (3턴)', '화상'),
  scorched: debuff('🥵', '그을림', 'def', '열기에 그을려 방어 -15%'),
  clamped: debuff('🐚', '조개에 물림', 'atk', '손가락이 얼얼해 공격 -10%'),
  breathless: debuff('🫧', '숨이 참', 'mp', '물속에서 숨이 차 MP 절반으로 시작'),
  gust: debuff('🌪️', '바람에 휘청', 'def', '어지러워 방어 -15%'),
  shocked: debuff('⚡', '감전', 'hp', '찌릿! 체력 -10%로 시작'),
  tangled: debuff('🌀', '머리가 빙글', 'block', '선이 꼬여 어질어질, 첫 막기 문제는 4초'),
  starstruck: debuff('✨', '별빛에 눈부심', 'atk', '눈이 부셔 공격 -10%'),
  roared: debuff('🐲', '용에게 쫓김', 'hp', '깨어난 용에게 쫓겨 체력 -10%로 시작'),
  awed: debuff('👑', '용왕의 위엄', 'def', '위엄에 움츠러들어 방어 -15%'),
} as const satisfies Record<string, { icon: string; name: string; effect: DebuffEffect; text: string; dot?: '화상' | '독' }>;
export type TowerDebuff = keyof typeof TOWER_DEBUFFS;
/** `stack`: lost games in a row pile up (the newest ones kept) and all hit the next battle; the same kind counts each time. */
export const TOWER_DEBUFF_RULES = { def: 0.85, hp: 0.9, atk: 0.9, mp: 0.5, blockSeconds: 4, dotTurns: 3, stack: 3 } as const;
export const debuffEffect = (id: TowerDebuff | null | undefined) => id ? TOWER_DEBUFFS[id].effect : null;

/** `from`: the first floor it can be behind a door (none: from floor 1). */
export const TOWER_EVENTS: Record<TowerEvent, { name: string; icon: string; weight: number; from?: number }> = {
  monster: { name: '몬스터', icon: '👾', weight: 44 }, treasure: { name: '보물', icon: '🎁', weight: 10 }, merchant: { name: '떠돌이 상인', icon: '🧙', weight: 12 },
  mirror: { name: '거울방', icon: '🪞', weight: 8 }, riddle: { name: '수수께끼 석상', icon: '🗿', weight: 8 }, sleeping: { name: '잠든 드래곤', icon: '🐉', weight: 7 },
  trap: { name: '함정 바닥', icon: '⚠️', weight: 5 }, fairy: { name: '길 잃은 요정', icon: '🧚', weight: 6 },
  mimic: { name: '미믹 상자', icon: '🎁', weight: 4, from: 1 }, fortune: { name: '점쟁이 카드', icon: '🔮', weight: 4, from: 15 },
  lilypad: { name: '연잎 점프', icon: '🐸', weight: 4, from: 1 }, mushroom: { name: '버섯 징검다리', icon: '🍄', weight: 4, from: 1 },
  echo: { name: '메아리 동굴', icon: '🔊', weight: 4, from: 11 }, crystal: { name: '수정 불빛 퍼즐', icon: '💡', weight: 4, from: 11 },
  maze: { name: '신전 미로', icon: '🧭', weight: 4, from: 21 }, scale: { name: '황금 저울', icon: '⚖️', weight: 4, from: 25 },
  jars: { name: '짝 맞추기 항아리', icon: '🏺', weight: 4, from: 21 },
  icelock: { name: '얼음 철자 자물쇠', icon: '🧊', weight: 4, from: 31 }, icepath: { name: '미끄러운 얼음길', icon: '⛸️', weight: 4, from: 31 },
  runes: { name: '룬 따라 하기', icon: '🎵', weight: 4, from: 41 }, scroll: { name: '주문서 완성', icon: '📜', weight: 4, from: 41 },
  potions: { name: '물약 섞기', icon: '🧪', weight: 4, from: 45 }, lavapath: { name: '용암 돌다리 기억', icon: '🔥', weight: 4, from: 51 },
  lavarun: { name: '용암 탈출', icon: '🌋', weight: 4, from: 51 },
  shells: { name: '진주 조개 섞기', icon: '🐚', weight: 4, from: 61 }, bubbles: { name: '진주 거품', icon: '🫧', weight: 4, from: 61 },
  windpath: { name: '바람길 비행', icon: '🌬️', weight: 4, from: 71 }, blanks: { name: '번개 빈칸', icon: '⚡', weight: 4, from: 71 },
  oneline: { name: '한붓 별 그리기', icon: '⭐', weight: 4, from: 81 }, stars: { name: '별자리 잇기', icon: '✨', weight: 4, from: 81 },
  hoard: { name: '용의 보물 더미', icon: '💰', weight: 4, from: 91 }, trial: { name: '용왕의 시험', icon: '🐉', weight: 4, from: 91 },
};
/** 장비 강화 at the 상인: +1 … +5. A failure only uses up the 강화석 (the gear never breaks). */
export const TOWER_ENHANCE_STEP = 2;
export const TOWER_ENHANCE: { to: number; stones: number; rate: number }[] = [
  { to: 1, stones: 1, rate: 0.9 }, { to: 2, stones: 1, rate: 0.8 }, { to: 3, stones: 2, rate: 0.7 }, { to: 4, stones: 2, rate: 0.6 }, { to: 5, stones: 3, rate: 0.5 },
];

/* ------------------------------------------------------------------ 채움의 탑 스킬 (4단계) */

export type PetElement = '화' | '수' | '목' | '금' | '토' | '빛' | '어둠';
/** A tower skill: learned at `level` by a pet with `job` (and `branch`, the 2차 job). Attack skills hit with `power` × 공격;
 *  방패 막기 blocks the monster's next attack; 치유 heals. Every skill is cast by answering a word. */
/** `job3`: a 3차 skill (only for a pet with that 3차 job). `effect`, on a right answer: 'shield' also blocks the monster's
 *  next attack, 'double' hits twice, 'weaken' cuts the monster's 공격 for the rest of the battle (once); a heal's `power`
 *  multiplies the heal. */
export interface TowerSkill { id: string; name: string; job: PetJob; branch?: PetJob2; job3?: PetJob3; level: number; mp: number; kind: 'attack' | 'block' | 'heal'; power?: number; element?: PetElement; effect?: 'shield' | 'double' | 'weaken'; text?: string }
const skillAtk = (id: string, name: string, job: PetJob, level: number, mp: number, power: number, element: PetElement, branch?: PetJob2): TowerSkill => ({ id, name, job, level, mp, kind: 'attack', power, element, ...(branch ? { branch } : {}) });
export const TOWER_SKILLS: TowerSkill[] = [
  skillAtk('slash', '베기', 'swordsman', 35, 4, 1.5, '금'),
  { id: 'shield', name: '방패 막기', job: 'swordsman', level: 35, mp: 5, kind: 'block' },
  skillAtk('smash', '강타', 'swordsman', 60, 6, 1.8, '토'),
  skillAtk('holy_slash', '성광 베기', 'swordsman', 70, 8, 2.0, '빛', 'paladin'),
  skillAtk('dark_slash', '암흑 베기', 'swordsman', 70, 8, 2.0, '어둠', 'dark_knight'),
  skillAtk('whirl', '회오리 베기', 'swordsman', 100, 10, 2.2, '목'),
  skillAtk('finisher', '필살 일격', 'swordsman', 150, 12, 2.5, '화'),
  skillAtk('abyss_oath', '심연의 맹세', 'swordsman', 200, 15, 3.0, '어둠', 'paladin'),
  skillAtk('atonement', '속죄의 빛', 'swordsman', 200, 15, 3.0, '빛', 'dark_knight'),
  skillAtk('fire', '불꽃', 'wizard', 35, 4, 1.5, '화'),
  { id: 'heal', name: '치유', job: 'wizard', level: 35, mp: 5, kind: 'heal' },
  skillAtk('ice_arrow', '얼음 화살', 'wizard', 60, 6, 1.8, '수'),
  skillAtk('holy_light', '성스러운 빛', 'wizard', 70, 8, 2.0, '빛', 'white_mage'),
  skillAtk('shadow_arrow', '그림자 화살', 'wizard', 70, 8, 2.0, '어둠', 'dark_mage'),
  skillAtk('thunder', '번개', 'wizard', 100, 10, 2.2, '금'),
  skillAtk('star_storm', '별빛 폭풍', 'wizard', 150, 12, 2.5, '토'),
  skillAtk('eclipse', '월식', 'wizard', 200, 15, 3.0, '어둠', 'white_mage'),
  skillAtk('dawn', '여명', 'wizard', 200, 15, 3.0, '빛', 'dark_mage'),
  // 3차 전직 skills (Lv.150, after 「별의 시험」)
  { ...skillAtk('sky_cleave', '하늘 가르기', 'swordsman', 150, 14, 2.8, '빛', 'paladin'), job3: 'sky_knight', effect: 'shield', text: '맞히면 다음 공격도 막아요' },
  { ...skillAtk('shadow_cut', '그림자 베기', 'swordsman', 150, 14, 1.6, '어둠', 'dark_knight'), job3: 'abyss_knight', effect: 'double', text: '두 번 베어요' },
  { id: 'dawn_heal', name: '새벽빛 치유', job: 'wizard', branch: 'white_mage', job3: 'dawn_sage', level: 150, mp: 14, kind: 'heal', power: 2, text: '체력을 크게 회복해요' },
  { ...skillAtk('dusk_curse', '그믐 저주', 'wizard', 150, 14, 2.6, '어둠', 'dark_mage'), job3: 'dusk_mage', effect: 'weaken', text: '맞히면 적 공격이 약해져요' },
];
export const towerSkill = (id: string) => TOWER_SKILLS.find(k => k.id === id);
/** The skills of a pet's job and branch, learned or not yet (branch skills appear once the 2차 job is taken). */
export const jobSkills = (pet: { job?: PetJob | null; job2?: PetJob2 | null; job3?: PetJob3 | null }) => TOWER_SKILLS.filter(k => k.job === pet.job && (!k.branch || k.branch === pet.job2) && (!k.job3 || k.job3 === pet.job3));
/** Skill level: 1 when learned, +1 every 10 pet levels after, at most 10 (0 = not learned yet). */
export const skillLevel = (k: TowerSkill, petLevel: number) => petLevel < k.level ? 0 : Math.min(10, 1 + Math.floor((petLevel - k.level) / 10));
/** 2차 job passives: 수호 (damage taken −10%), 흡혈 (10% of damage dealt healed), 축복 (healing ×1.5), 저주 (monster 방어 −10%). */
export const BRANCH_PASSIVE: Record<PetJob2, { name: string; text: string }> = {
  paladin: { name: '수호', text: '받는 피해 10% 감소' }, dark_knight: { name: '흡혈', text: '준 피해의 10% 회복' },
  white_mage: { name: '축복', text: '치유량 1.5배' }, dark_mage: { name: '저주', text: '적 방어 10% 감소' },
};
/** Each monster's weak element (a skill of that element may land a CRITICAL HIT ×2). */
export const TOWER_WEAKNESS: Partial<Record<TowerMonsterKind, PetElement>> = {
  slime: '토', bat: '빛', mushroom: '금', golem: '화', gatekeeper: '수', obsidian_golem: '토', gold_golem: '화', dragon: '수', shadow: '빛', fairy: '어둠',
  crystal_slime: '화', vampire_bat: '빛', cave_spider: '화', crystal_queen: '화', sand_scorpion: '수', mummy: '빛', temple_cat: '어둠', sphinx: '수',
  snow_spirit: '화', ice_wolf: '화', frost_knight: '빛', frost_dragon: '화', shadow_knight: '빛', magic_doll: '금', cursed_book: '화', archmage: '빛',
  lava_slime: '수', fire_lizard: '빛', ash_golem: '어둠', fire_drake: '빛', glow_jelly: '어둠', merfolk_knight: '빛', turtle_guard: '토', kraken: '어둠',
  wind_spirit: '금', griffin: '어둠', thunder_bird: '토', storm_griffin: '빛', star_fairy: '어둠', meteor_golem: '수', comet_fox: '빛', nebula_whale: '어둠',
  dragon_knight: '빛', time_mage: '어둠', gold_wyvern: '화', dragon_king: '빛',
};
/** 크리티컬 확률 (%): pet level × 0.1 + skill level × 2 + gear (critPerLevel × 강화), at most 50. */
export function critChance(petLevel: number, skillLv: number, gear: (TowerGear | undefined)[], levels: Record<string, number> = {}) {
  const fromGear = gear.reduce((n, g) => n + (g?.critPerLevel || 0) * (levels[g?.id || ''] || 0), 0);
  return Math.min(50, Math.round((petLevel * 0.1 + skillLv * 2 + fromGear) * 10) / 10);
}
/** 빗나가면 공격 피해의 30%만, MP는 절반만 써요. 치유 30% (축복 ×1.5); 수호 ×0.9 받는 피해; 흡혈 10%; 저주 적 방어 ×0.9; 크리 ×2. */
export const TOWER_SKILL_RULES = { missDamage: 0.3, missMp: 0.5, heal: 0.3, blessing: 1.5, guard: 0.9, drain: 0.1, curse: 0.9, crit: 2, weaken: 0.8 } as const;

/* ------------------------------------------------------------------ 몬스터 스킬 (each monster its own) */

/** What a monster skill does: 강타 ×2 · 연속 (two hits, a block question each) · 지속 피해 (화상·독·저주, unless blocked) ·
 *  방어 태세 · 재생 (cancelled by a hit that turn) · 봉인 (no skills, unless blocked) · 묶기 (a shorter block question) · 흡혈. */
export type FoeEffect = 'smash' | 'multi' | 'dot' | 'guard' | 'regen' | 'seal' | 'bind' | 'drain';
/** One monster skill: its name, what it does, and the warning shown one turn before (`warn`). */
export interface FoeSkill { id: string; name: string; fx: FoeEffect[]; dot?: '화상' | '독' | '저주'; warn: string }
export const FOE_RULES = {
  smash: 2, multi: 0.7, dotPct: 0.05, dotTurns: 3, guard: 1.5, guardTurns: 2, regen: 0.1, sealTurns: 2, bindSeconds: 4, drain: 0.5,
  /** 분노 (51층+ bosses): 공격 ×1.3 below 30% 체력 */ rage: 1.3, rageAt: 0.3,
  /** how often a monster warns of a skill after a plain attack (never two skills in a row) */ chance: 0.35, bossChance: 0.5,
} as const;
export const FOE_HINT: Record<FoeEffect, { icon: string; hint: string }> = {
  smash: { icon: '💥', hint: '2배 피해 — 꼭 막으세요!' }, multi: { icon: '⚔️', hint: '두 번 공격 — 막기 문제가 2개예요' },
  dot: { icon: '🔥', hint: '막지 못하면 3턴 동안 체력이 줄어요 (물약·치유로 나아요)' }, guard: { icon: '🛡️', hint: '2턴 동안 단단해져요 — 약점 속성 스킬로 깨요' },
  regen: { icon: '💚', hint: '이번 턴에 공격을 맞히면 회복을 막아요' }, seal: { icon: '🔒', hint: '막지 못하면 2턴 동안 스킬을 못 써요' },
  bind: { icon: '🕸️', hint: '다음 막기 문제는 4초 안에 답해야 해요' }, drain: { icon: '🩸', hint: '준 피해의 절반만큼 회복해요 — 막아서 줄여요' },
};
export const DOT_ICON = { 화상: '🔥', 독: '☠️', 저주: '💀' } as const;
type S = [name: string, fx: FoeEffect | FoeEffect[], warn: string, dot?: FoeSkill['dot']];
const FOE_TABLE: Partial<Record<TowerMonsterKind, S[]>> = {
  gatekeeper: [['대지 내려찍기', 'smash', '주먹을 높이 들어 올렸어요']],
  golem: [['바위 던지기', 'smash', '바위를 집어 들었어요']], obsidian_golem: [['흑요석 던지기', 'smash', '흑요석 덩어리를 들어 올렸어요']],
  crystal_slime: [['수정 껍질', 'guard', '몸이 수정처럼 굳어 가요']], vampire_bat: [['흡혈 이빨', 'drain', '송곳니를 드러냈어요']], cave_spider: [['거미줄', 'bind', '거미줄을 뿜으려 해요']],
  crystal_queen: [['수정 독침', 'dot', '독침을 겨누고 있어요', '독'], ['거미줄 감옥', 'bind', '거미줄 감옥을 짜고 있어요']],
  sand_scorpion: [['독침', 'dot', '꼬리 독침을 치켜들었어요', '독']], mummy: [['붕대 감기', 'regen', '붕대를 다시 감으려 해요']], gold_golem: [['황금 갑옷', 'guard', '몸이 황금빛으로 빛나요']],
  temple_cat: [['할퀴기 연타', 'multi', '발톱을 세웠어요']], sphinx: [['수수께끼의 저주', 'seal', '수수께끼를 읊기 시작했어요'], ['모래 폭풍', 'multi', '모래바람을 일으켜요']],
  snow_spirit: [['눈보라', 'bind', '눈보라를 모으고 있어요']], ice_wolf: [['연속 물기', 'multi', '으르렁거리며 몸을 낮췄어요']], frost_knight: [['얼음 방패', 'guard', '얼음 방패를 세웠어요']],
  frost_dragon: [['얼음 숨결', 'smash', '차가운 숨을 들이마셔요'], ['빙결 비늘', 'guard', '비늘이 얼어붙고 있어요']],
  shadow_knight: [['그림자 베기', 'smash', '검에 그림자를 모아요']], magic_doll: [['조종 실', 'seal', '보이지 않는 실을 늘어뜨려요']], cursed_book: [['저주 주문', 'dot', '책장이 저절로 넘어가요', '저주']],
  archmage: [['마력 봉인', 'seal', '봉인 주문을 외워요'], ['흑염 폭발', 'smash', '검은 불꽃을 모아요']],
  lava_slime: [['용암 튀기기', 'dot', '몸이 부글부글 끓어요', '화상'], ['녹아 붙기', 'regen', '녹아내린 몸을 다시 붙여요']],
  fire_lizard: [['불꽃 꼬리', 'multi', '꼬리에 불이 붙었어요'], ['불씨', 'dot', '불씨를 머금었어요', '화상']],
  ash_golem: [['재 구름', 'bind', '재를 흩뿌리려 해요'], ['바위 주먹', 'smash', '불붙은 주먹을 들어 올렸어요']],
  fire_drake: [['화염 숨결', ['smash', 'dot'], '숨을 크게 들이마셔요', '화상'], ['불꽃 날개', 'multi', '불꽃 날개를 펼쳤어요'], ['용암 비늘', 'guard', '비늘이 용암처럼 달아올라요']],
  glow_jelly: [['마비 촉수', 'bind', '촉수가 찌릿찌릿 빛나요'], ['발광', 'regen', '온몸이 환하게 빛나요']],
  merfolk_knight: [['삼지창 찌르기', 'multi', '삼지창을 겨눴어요'], ['물의 방패', 'guard', '물의 방패를 펼쳐요']],
  turtle_guard: [['등껍질 숨기', 'guard', '등껍질 속으로 숨으려 해요'], ['박치기', 'smash', '고개를 뒤로 젖혔어요']],
  kraken: [['촉수 강타', 'smash', '촉수를 높이 들어 올렸어요'], ['먹물', 'seal', '먹물을 뿜으려 해요'], ['휘감기', 'drain', '촉수로 휘감으려 해요']],
  wind_spirit: [['회오리', 'multi', '바람이 빙글빙글 돌아요'], ['바람 장막', 'guard', '바람 장막을 두르려 해요']],
  griffin: [['급강하', 'smash', '하늘 높이 날아올랐어요'], ['날갯바람', 'bind', '날개를 크게 펼쳤어요']],
  thunder_bird: [['번개', 'bind', '깃털이 찌릿찌릿해요'], ['연쇄 번개', 'multi', '번개를 모으고 있어요']],
  storm_griffin: [['천둥 낙뢰', 'smash', '먹구름이 몰려와요'], ['폭풍 날개', 'multi', '폭풍을 일으켜요'], ['회오리 장막', 'guard', '회오리를 두르고 있어요']],
  star_fairy: [['별빛 치유', 'regen', '별빛을 모으고 있어요'], ['별가루', 'seal', '반짝이는 가루를 뿌리려 해요']],
  meteor_golem: [['운석 낙하', 'smash', '하늘에서 운석을 불러요'], ['운석 갑옷', 'guard', '운석 조각을 두르려 해요']],
  comet_fox: [['혜성 꼬리', 'multi', '꼬리가 혜성처럼 빛나요'], ['여우불', 'dot', '푸른 여우불을 피워요', '화상']],
  nebula_whale: [['은하의 노래', 'seal', '깊은 노래를 부르기 시작했어요'], ['별 물줄기', 'multi', '별 물줄기를 뿜으려 해요'], ['성운 재생', 'regen', '성운이 몸을 감싸요']],
  dragon_knight: [['용의 일격', 'smash', '용의 기운을 검에 모아요'], ['용린 방패', 'guard', '용 비늘 방패를 세워요']],
  time_mage: [['시간 정지', 'bind', '시계 바늘이 멈춰 가요'], ['되감기', 'regen', '시간을 되감으려 해요']],
  gold_wyvern: [['황금 숨결', 'dot', '황금빛 숨을 머금었어요', '화상'], ['연속 할퀴기', 'multi', '발톱을 번뜩여요']],
  dragon_king: [['태초의 불길', ['smash', 'dot'], '태초의 불꽃을 모아요', '화상'], ['시간의 포효', 'seal', '크게 숨을 들이마셔요'], ['용린 재생', 'regen', '비늘이 금빛으로 빛나요']],
  // 문 뒤 이벤트 전투: 거울 속 그림자, 수상한 요정, 깨어난 드래곤 (any floor, end-game strength)
  shadow: [['거울 베기', 'smash', '내 동작을 똑같이 따라 해요'], ['그림자 장막', 'guard', '그림자가 짙어지고 있어요']],
  fairy: [['요정 가루', 'bind', '반짝이는 가루를 흩뿌리려 해요'], ['반짝 치유', 'regen', '날개가 환하게 빛나요']],
  dragon: [['용의 숨결', ['smash', 'dot'], '불꽃을 머금고 고개를 들었어요', '화상'], ['꼬리 휘두르기', 'multi', '꼬리를 크게 휘둘러요'], ['잠 깬 포효', 'seal', '크게 숨을 들이마셔요']],
};
export const TOWER_FOE_SKILLS: Partial<Record<TowerMonsterKind, FoeSkill[]>> = Object.fromEntries(Object.entries(FOE_TABLE).map(([kind, list]) =>
  [kind, list!.map(([name, fx, warn, dot], i) => ({ id: `${kind}.${i}`, name, fx: Array.isArray(fx) ? fx : [fx], warn, ...(dot ? { dot } : {}) }))]));
export const foeSkill = (id: string) => TOWER_FOE_SKILLS[id.split('.')[0] as TowerMonsterKind]?.find(k => k.id === id);
/** The skills a monster uses on a floor: none below floor 10 (1구역 monsters), from the floor-10 boss on; the woken dragon and the 수상한 요정 always. */
export const foeSkillsFor = (kind: TowerMonsterKind, floor: number) => floor >= PET_TOWER.bossEvery || kind === 'dragon' || kind === 'fairy' ? TOWER_FOE_SKILLS[kind] || [] : [];
/** 51층+ bosses and the woken dragon grow angry when hurt (분노). */
export const FOE_RAGE = new Set<TowerMonsterKind>(['fire_drake', 'kraken', 'storm_griffin', 'nebula_whale', 'dragon_king', 'dragon']);
/** A skill that is the monster's whole turn (no attack, no block question): 방어 태세 and 재생. */
export const foeQuiet = (k: FoeSkill) => k.fx.every(f => f === 'guard' || f === 'regen');
