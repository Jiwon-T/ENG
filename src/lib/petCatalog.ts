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
export interface PetItem { id: string; name: string; price: number; icon: string; category: PetItemCategory; xp?: number; energy?: number; reward?: boolean; slot?: AccessorySlot; revive?: boolean }

export const PET_CHARACTERS: { id: PetCharacterType; name: string }[] = [
  { id: 'unicorn', name: '다롱' }, { id: 'mymelody', name: '아롱' }, { id: 'haemi', name: '해미' }, { id: 'molang', name: '말랑' }, { id: 'mang_bear', name: '고미' }, { id: 'hodu', name: '호두' },
];
/** The top level (raised later with new end content). At PET_FRIEND_LEVEL a pet brings one more friend home. */
export const PET_MAX_LEVEL = 200;
export const PET_FRIEND_LEVEL = 100;
export const PET_MAX_ENERGY = 100;
/** 기운 회복 간식 (커피·에너지드링크): this many a day, never for a pet at 0 기운 (탈진). */
export const PET_ENERGY_ITEMS_PER_DAY = 2;
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
  { id: 'cookie', name: '쿠키', price: 30, xp: 5, icon: '🍪', category: 'consumable' },
  { id: 'macaron', name: '마카롱', price: 50, xp: 10, icon: '🍭', category: 'consumable' },
  { id: 'cake', name: '딸기케이크', price: 60, xp: 15, icon: '🍰', category: 'consumable' },
  { id: 'candy', name: '별사탕', price: 100, xp: 30, icon: '🍬', category: 'consumable' },
  { id: 'coffee', name: '커피', price: 40, energy: 30, icon: '☕', category: 'consumable' },
  { id: 'energy_drink', name: '에너지드링크', price: 70, energy: 60, icon: '⚡', category: 'consumable' },
  { id: 'monster', name: '몬스터', price: 150, energy: 50, icon: '🥤', category: 'consumable', revive: true },
];
export const petItem = (id: string) => PET_ITEMS.find(item => item.id === id);
/** 이달의 장학 쿠폰: when the points earned in a month (Korea time, from the 1st; spending doesn't matter) reach `goal`,
 *  영어 이지원T's students may ask for that month's coupon (no points are taken; not asked for = that month is gone) and
 *  get that month's 금메달 to place in their room. In the first season the points held when counting began count too. */
export const PET_COUPON = { name: '이달의 장학 쿠폰', goal: 10_000, firstSeason: '2026-10', maxDecor: 24 } as const;
/** '2026-10' → '26.10' (on the medal and the badges). */
export const medalLabel = (month: string) => `${month.slice(2, 4)}.${month.slice(5, 7)}`;
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
export const PET_HOMEWORK_REWARD: Record<string, { points: number; xp: number }> = {
  '최상': { points: 40, xp: 60 }, '상': { points: 30, xp: 45 }, '중상': { points: 20, xp: 30 }, '중': { points: 10, xp: 15 },
};
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
/** The job shown on a pet (the 2차 job when it has one). */
export const petJobLabel = (pet: { job?: PetJob | null; job2?: PetJob2 | null }) => pet.job2 ? PET_JOB2[pet.job2].label : pet.job ? PET_JOBS[pet.job].label : '';
/** Where the jobs are taken (next to the skill button, the tower stats and the expedition map). */
export const PET_JOB_GUIDE = '스킬은 전직 후 · 1차 전직: 5장 설산 · 2차 전직: 7장 꿈의 정원';
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
  name: '채움의 탑', floors: 50, doors: 3, bossEvery: 10, energy: 10, defendSeconds: 8, choices: 4, poolSize: 60,
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
export interface TowerGear { id: string; name: string; /** in the small slot */ short: string; slot: TowerGearSlot; icon: string; atk?: number; def?: number; hp?: number; mp?: number; job?: PetJob; job2?: PetJob2;
  /** Boss treasures change with the pet's job (name and stats): 검사 more 방어/체력, 마법사 more 마력. */ variants?: Partial<Record<PetJob, { name: string; short: string; atk?: number; def?: number; hp?: number; mp?: number }>>;
  /** 크리티컬 확률 per 강화 level (%): 견습 0.5, boss gear 1, job weapons 1.5. */ critPerLevel?: number;
  /** A 원정대 job weapon: owned through the expedition (the student's inventory), not found in the tower. */ expedition?: boolean }
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
export const towerGear = (id: string) => TOWER_GEAR.find(g => g.id === id);
/** A piece of gear as this pet wears it: boss treasures take the job's name and stats (before the job, the plain one). */
export function towerGearFor(id: string, job?: PetJob | null): TowerGear | undefined {
  const g = towerGear(id), v = job && g?.variants?.[job];
  return g && v ? { ...g, ...v } : g;
}
/** Treasure chests: floor 1 (at the entrance) and after each boss (that boss's own treasure). */
export const TOWER_CHESTS: Record<number, { gear: string[]; potions: number; /** a job weapon: the one for the pet's job */ jobWeapon?: Record<PetJob, string> }> = {
  1: { gear: ['apprentice_club'], potions: PET_TOWER.startPotions },
  10: { gear: ['golem_pauldron'], potions: 2 },
  20: { gear: ['crystal_helm'], potions: 3 },
  30: { gear: ['sun_gloves'], potions: 3 },
  40: { gear: ['snow_boots'], potions: 4, jobWeapon: { swordsman: 'frost_greatsword', wizard: 'frost_staff' } },
  50: { gear: ['star_armor'], potions: 5 },
};
export type TowerMonsterKind = 'slime' | 'bat' | 'mushroom' | 'golem' | 'fairy' | 'shadow' | 'dragon' | 'gatekeeper' | 'obsidian_golem' | 'gold_golem'
  | 'crystal_slime' | 'vampire_bat' | 'cave_spider' | 'crystal_queen' | 'sand_scorpion' | 'mummy' | 'temple_cat' | 'sphinx'
  | 'snow_spirit' | 'ice_wolf' | 'frost_knight' | 'frost_dragon' | 'shadow_knight' | 'magic_doll' | 'cursed_book' | 'archmage';
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
  return { atk: 10 + level * 2 + add('atk'), def: 4 + level + add('def'), hp: 60 + level * 4 + add('hp'), mp: 20 + Math.floor(level / 2) + add('mp') };
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
export type TowerEvent = 'monster' | 'treasure' | 'merchant' | 'mirror' | 'riddle' | 'sleeping' | 'trap' | 'fairy';
export const TOWER_EVENTS: Record<TowerEvent, { name: string; icon: string; weight: number }> = {
  monster: { name: '몬스터', icon: '👾', weight: 44 }, treasure: { name: '보물', icon: '🎁', weight: 10 }, merchant: { name: '떠돌이 상인', icon: '🧙', weight: 12 },
  mirror: { name: '거울방', icon: '🪞', weight: 8 }, riddle: { name: '수수께끼 석상', icon: '🗿', weight: 8 }, sleeping: { name: '잠든 드래곤', icon: '🐉', weight: 7 },
  trap: { name: '함정 바닥', icon: '⚠️', weight: 5 }, fairy: { name: '길 잃은 요정', icon: '🧚', weight: 6 },
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
export interface TowerSkill { id: string; name: string; job: PetJob; branch?: PetJob2; level: number; mp: number; kind: 'attack' | 'block' | 'heal'; power?: number; element?: PetElement }
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
];
export const towerSkill = (id: string) => TOWER_SKILLS.find(k => k.id === id);
/** The skills of a pet's job and branch, learned or not yet (branch skills appear once the 2차 job is taken). */
export const jobSkills = (pet: { job?: PetJob | null; job2?: PetJob2 | null }) => TOWER_SKILLS.filter(k => k.job === pet.job && (!k.branch || k.branch === pet.job2));
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
};
/** 크리티컬 확률 (%): pet level × 0.1 + skill level × 2 + gear (critPerLevel × 강화), at most 50. */
export function critChance(petLevel: number, skillLv: number, gear: (TowerGear | undefined)[], levels: Record<string, number> = {}) {
  const fromGear = gear.reduce((n, g) => n + (g?.critPerLevel || 0) * (levels[g?.id || ''] || 0), 0);
  return Math.min(50, Math.round((petLevel * 0.1 + skillLv * 2 + fromGear) * 10) / 10);
}
/** 빗나가면 공격 피해의 30%만, MP는 절반만 써요. 치유 30% (축복 ×1.5); 수호 ×0.9 받는 피해; 흡혈 10%; 저주 적 방어 ×0.9; 크리 ×2. */
export const TOWER_SKILL_RULES = { missDamage: 0.3, missMp: 0.5, heal: 0.3, blessing: 1.5, guard: 0.9, drain: 0.1, curse: 0.9, crit: 2 } as const;
