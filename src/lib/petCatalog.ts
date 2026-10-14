// 펫: the one list of characters, items, prices and point rules, shared by the server (which decides) and the screen
// (which shows). Changing a price or a rate here changes both.
export type PetCharacterType = 'unicorn' | 'mymelody' | 'haemi' | 'molang' | 'mang_bear' | 'hodu';
export type PetStage = 'baby' | 'child' | 'teen' | 'adult' | 'master';
export type PetItemCategory = 'clothing' | 'accessory' | 'background' | 'consumable';
/** `reward`: earned on the 원정대 (never sold in the shop). */
export interface PetItem { id: string; name: string; price: number; icon: string; category: PetItemCategory; xp?: number; energy?: number; reward?: boolean }

export const PET_CHARACTERS: { id: PetCharacterType; name: string }[] = [
  { id: 'unicorn', name: '다롱' }, { id: 'mymelody', name: '아롱' }, { id: 'haemi', name: '해미' }, { id: 'molang', name: '말랑' }, { id: 'mang_bear', name: '고미' }, { id: 'hodu', name: '호두' },
];
export const PET_MAX_LEVEL = 100;
export const PET_MAX_ENERGY = 100;
/** 기운 회복 간식 (커피·에너지드링크): this many a day. */
export const PET_ENERGY_ITEMS_PER_DAY = 2;
/** One more pet each time a pet reaches the top level; one of each kind at most. */
export const PET_MAX_PETS = 6;
export const PLACEHOLDER_PET_NAME = '친구가 필요해요';
export const petStage = (level: number): PetStage => level <= 20 ? 'baby' : level <= 40 ? 'child' : level <= 60 ? 'teen' : level <= 99 ? 'adult' : 'master';
export const PET_STAGE_LABEL: Record<PetStage, string> = { baby: '아기', child: '어린이', teen: '청소년', adult: '어른', master: '마스터' };
export const xpNeeded = (level: number) => level * 100;

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
  { id: 'pink_ribbon', name: '리본', price: 50, icon: '🎀', category: 'accessory' },
  { id: 'star_hat', name: '별핀', price: 80, icon: '⭐', category: 'accessory' },
  { id: 'crown', name: '왕관', price: 200, icon: '👑', category: 'accessory' },
  { id: 'sunglasses', name: '선글라스', price: 100, icon: '😎', category: 'accessory' },
  { id: 'flower', name: '꽃핀', price: 60, icon: '🌸', category: 'accessory' },
  { id: 'strawberry_pin', name: '딸기 핀', price: 50, icon: '🍓', category: 'accessory' },
  { id: 'bow_tie', name: '나비넥타이', price: 60, icon: '🦋', category: 'accessory' },
  { id: 'scarf', name: '체크 목도리', price: 80, icon: '🧣', category: 'accessory' },
  { id: 'round_glasses', name: '동그란 안경', price: 90, icon: '👓', category: 'accessory' },
  { id: 'beret', name: '베레모', price: 100, icon: '🎨', category: 'accessory' },
  { id: 'heart_sunglasses', name: '하트 선글라스', price: 120, icon: '💕', category: 'accessory' },
  { id: 'flower_crown', name: '꽃 화관', price: 150, icon: '💐', category: 'accessory' },
  { id: 'headphones', name: '헤드폰', price: 180, icon: '🎧', category: 'accessory' },
  { id: 'default', name: '기본 보금자리', price: 0, icon: '🏠', category: 'background' },
  { id: 'pink_cushion', name: '핑크 쿠션', price: 80, icon: '🛋️', category: 'background' },
  { id: 'bed', name: '작은 침대', price: 150, icon: '🛏️', category: 'background' },
  { id: 'star_room', name: '별빛 방', price: 300, icon: '✨', category: 'background' },
  { id: 'desk', name: '미니 책상', price: 200, icon: '📝', category: 'background' },
  { id: 'forest_cabin', name: '숲속 오두막', price: 0, icon: '🏡', category: 'background', reward: true },
  { id: 'coral_sea', name: '산호 바다', price: 0, icon: '🪸', category: 'background', reward: true },
  { id: 'cloud_castle', name: '구름 성', price: 0, icon: '🏰', category: 'background', reward: true },
  { id: 'cookie', name: '쿠키', price: 30, xp: 5, icon: '🍪', category: 'consumable' },
  { id: 'macaron', name: '마카롱', price: 50, xp: 10, icon: '🍭', category: 'consumable' },
  { id: 'cake', name: '딸기케이크', price: 60, xp: 15, icon: '🍰', category: 'consumable' },
  { id: 'candy', name: '별사탕', price: 100, xp: 30, icon: '🍬', category: 'consumable' },
  { id: 'coffee', name: '커피', price: 40, energy: 30, icon: '☕', category: 'consumable' },
  { id: 'energy_drink', name: '에너지드링크', price: 70, energy: 60, icon: '⚡', category: 'consumable' },
];
export const petItem = (id: string) => PET_ITEMS.find(item => item.id === id);

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
/** Real lessons: each 출석 and each 과제 완료 from the lesson reports, once per lesson, from the last 30 days on. */
export const PET_ATTENDANCE_REWARD = { points: 30, xp: 50 };
export const PET_ASSIGNMENT_REWARD = { points: 20, xp: 30 };
export const PET_REWARD_WINDOW_DAYS = 30;
/** What the pet says on its own. Babies use a few easy words, never baby-talk sounds or emoji. */
export const PET_IDLE_LINES: { upTo: number; lines: string[] }[] = [
  { upTo: 10, lines: ['안녕!', '좋아!', '같이 놀자', '나 여기 있어'] },
  { upTo: 20, lines: ['공부 했어?', '배고파', '쓰다듬어 줘', '오늘 재밌었어?'] },
  { upTo: 40, lines: ['오늘 뭐 배웠어?', '간식 먹고 싶어', '같이 단어 외우자', '숙제 다 했어?'] },
  { upTo: 60, lines: ['오늘도 공부했구나, 멋지다', '틀린 단어 다시 보면 금방 외워져', '나도 영어 배우고 싶어'] },
  { upTo: 99, lines: ['오늘 정말 열심히 했네. Good job!', '조금씩 하면 다 할 수 있어', 'Let\'s study together!'] },
  { upTo: 100, lines: ['너랑 공부해서 여기까지 왔어. I\'m so proud of you!', '오늘도 같이 해 보자'] },
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
  ],
  bonus: { clear: 20, star2: 10, star3: 10 },
  bossStars: 2,
} as const;
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
export const PET_WORD_FEED = { questions: 10, minQuestions: 5, choices: 3, wrongAnswers: 3, retryAfter: 3, books: 3, sessionScan: 200, wordWindow: 120, energy: 10 };
