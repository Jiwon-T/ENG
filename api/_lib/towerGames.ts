// 채움의 탑 쉬어 가기 놀이 (문 뒤 이벤트): puzzles, intuition and word games that open zone by zone. The server keeps what
// must stay secret (the mimic, the answers), the browser plays; winning gives 강화석 or 물약, losing only passes the floor
// (a mimic takes a potion). Each game: its start (`initGame`), what the browser sees (`publicGame`), and its moves (`playGame`).
import type {TowerDebuff, TowerEvent} from '../../src/lib/petCatalog.js';

export type MiniGame = Extract<TowerEvent, 'mimic' | 'fortune' | 'lilypad' | 'mushroom' | 'echo' | 'crystal' | 'maze' | 'scale' | 'jars' | 'icelock' | 'icepath' | 'runes' | 'scroll' | 'potions' | 'lavapath' | 'lavarun' | 'shells' | 'bubbles' | 'windpath' | 'blanks' | 'oneline' | 'stars' | 'hoard' | 'trial'>;
export const MINI_GAMES = new Set<TowerEvent>(['mimic', 'fortune', 'lilypad', 'mushroom', 'echo', 'crystal', 'maze', 'scale', 'jars', 'icelock', 'icepath', 'runes', 'scroll', 'potions', 'lavapath', 'lavarun', 'shells', 'bubbles', 'windpath', 'blanks', 'oneline', 'stars', 'hoard', 'trial']);
/** 용의 보물 더미: a dragon asleep on its gold; take coins one at a time and leave when you like. The more taken, the likelier
 *  it wakes (the server rolled at which coin), and then every coin is lost. Holding coins, it may stir: usually the sign the
 *  next coin wakes it, sometimes not (a hunch, like the mimic's breath). */
export const HOARD = {max: 8, wake: [0.06, 0.12, 0.18, 0.25, 0.32, 0.4, 0.48, 0.56], stirIfWaking: 0.7, stirElse: 0.15} as const;
interface HoardState { wake: number | null; stir: boolean[]; coins: number }
/** What the coins taken out are worth. */
export const hoardPrize = (coins: number): {stone?: number; potions?: number} => coins >= 7 ? {stone: 2, potions: 1} : coins >= 5 ? {stone: 1, potions: 1} : coins >= 3 ? {stone: 1} : coins >= 1 ? {potions: 1} : {};
/** 용왕의 시험: five gates — 뜻 (a meaning → its word), 듣기 (a word heard → its meaning), 철자 (the word's letters, shuffled),
 *  단어 (a word → its meaning), 문장 (a sentence's pieces in order; a wordbook with no sentences: a word's letters). One try
 *  each; four right pass. */
export const TRIAL = {gates: ['meaning', 'listen', 'spell', 'word', 'sentence'], need: 4} as const;
type TrialGate = {kind: 'meaning' | 'listen' | 'word'; q: any} | {kind: 'spell'; q: any; letters: string[]} | {kind: 'sentence'; text: string; meaning: string; pieces: string[]; sentence: boolean; q?: any};
interface TrialState { gates: TrialGate[]; step: number; right: number }
/** 진주 조개 섞기: the pearl is shown under one of three shells, then the shells swap six times, faster and faster (the
 *  browser plays the swaps the server chose: two places trade shells); pick the shell with the pearl. A pick before the
 *  swaps could have been watched is refused. */
export const SHELLS = {count: 3, peekMs: 1500, ms: [800, 700, 600, 500, 420, 360]} as const;
const SHELLS_MIN_MS = SHELLS.peekMs + SHELLS.ms.reduce((a, b) => a + b, 0);
interface ShellsState { start: number; swaps: [number, number][] }
/** Where the pearl ends: the place it started, moved by each swap of two places. */
export const shellsEnd = (start: number, swaps: [number, number][]) => swaps.reduce((at, [a, b]) => at === a ? b : at === b ? a : at, start);
/** 진주 거품: four meanings; for each, four word bubbles rise — pop the right one before they float away (`gone`: a miss);
 *  three right win. The server keeps when each meaning began (`stepAt`): a pop after the bubbles are gone is a miss,
 *  and `gone` before they could have floated away is refused. */
export const BUBBLES = {steps: 4, need: 3, riseMs: 7000, graceMs: 1500} as const;
interface BubblesState { qs: any[]; step: number; right: number; stepAt?: number }
/** 바람길 비행: tap to rise through five cloud rings (heights from the server, 0 = top … 1 = bottom of the sky); the
 *  timing runs in the browser, the server only checks a full flight took a believable time. */
export const WINDPATH = {rings: 5, spacingMs: 1800, minMs: 8000} as const;
/** 번개 빈칸: three words, each with 1–3 letters gone (shown with the meaning); fill them from letter tiles (the missing
 *  ones and three more). Two right win. */
export const BLANKS = {steps: 3, need: 2, decoys: 3} as const;
interface BlanksWord { q: any; blanks: number[]; tiles: string[] }
interface BlanksState { words: BlanksWord[]; step: number; right: number }
/** 한붓 별 그리기: a figure of stars (points 0–100) and lines that can be drawn in one stroke; tap star after star along
 *  the lines, each line once, all of them. Two tries (a stroke that gets stuck is one). */
export const ONELINE = {tries: 2, shapes: [
  {name: '별빛 집', nodes: [[20, 90], [80, 90], [20, 45], [80, 45], [50, 10]], edges: [[0, 1], [0, 2], [1, 3], [2, 3], [0, 3], [1, 2], [2, 4], [3, 4]]},
  {name: '오각 별', nodes: [[50, 6], [92, 38], [76, 90], [24, 90], [8, 38]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [2, 4], [4, 1], [1, 3], [3, 0]]},
  {name: '삼각 별', nodes: [[50, 8], [92, 88], [8, 88], [71, 48], [50, 88], [29, 48]], edges: [[0, 3], [3, 1], [1, 4], [4, 2], [2, 5], [5, 0], [3, 4], [4, 5], [5, 3]]},
]} as const;
interface OnelineState { shape: number; tries: number }
/** A stroke (star numbers) that follows the lines of `shape`, each line once, every line. */
export function strokeDone(shape: number, path: number[]) {
  const s = ONELINE.shapes[shape], key = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`, lines = new Set(s.edges.map(([a, b]) => key(a, b))), used = new Set<string>();
  for (let i = 1; i < path.length; i++) { const k = key(path[i - 1], path[i]); if (!lines.has(k) || used.has(k)) return false; used.add(k); }
  return used.size === lines.size;
}
/** 별자리 잇기: a meaning and the letters of its word as stars (two more stars that don't belong); join the stars in the
 *  word's order. Two of three right win. */
export const STARS = {steps: 3, need: 2, decoys: 2} as const;
interface StarsWord { q: any; word: string; stars: {c: string; x: number; y: number}[] }
interface StarsState { words: StarsWord[]; step: number; right: number }
/** 용암 탈출: five meanings → words before the lava rises (20 seconds from the start, the server's clock); four right to escape. */
export const LAVARUN = {steps: 5, need: 4, ms: 20_000, graceMs: 1500} as const;
interface LavarunState { qs: any[]; step: number; right: number; deadline: number | null }
/** 용암 돌다리 기억: five rows of three stones over lava, one safe in each; the safe ones glow for a moment (the browser shows
 *  `path` briefly, then hides it) — cross by memory. */
export const LAVAPATH = {rows: 5, cols: 3, peekMs: 2500} as const;
/** 물약 섞기: four flasks (red, blue, yellow, white); mix two to make the colour asked — twice, two different colours. */
export const FLASKS = ['red', 'blue', 'yellow', 'white'] as const;
export const BREWS = [{name: '보라', pair: ['red', 'blue']}, {name: '초록', pair: ['blue', 'yellow']}, {name: '주황', pair: ['red', 'yellow']}, {name: '분홍', pair: ['red', 'white']}, {name: '하늘', pair: ['blue', 'white']}, {name: '연노랑', pair: ['yellow', 'white']}] as const;
interface PotionsState { targets: number[]; round: number }
/** 주문서 완성: a spell (an English sentence from the wordbook, its meaning shown) torn into pieces — put them in order (two
 *  tries). A wordbook with no sentences: a word's letters instead. */
export const SCROLL = {tries: 2} as const;
interface ScrollState { text: string; meaning: string; pieces: string[]; sentence: boolean; tries: number; q?: any }
const sameLine = (a: string, b: string) => { const n = (t: string) => t.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim(); return n(a) === n(b); };
/** 룬 따라 하기: four runes glow in a row — press them back in the same order; three rounds, 3 → 4 → 5 long. */
export const RUNES = {count: 4, rounds: 3, first: 3} as const;
interface RunesState { seq: number[]; round: number }
/** 미끄러운 얼음길: a 6×6 ice floor with rocks; a push slides until a rock or the wall (passing the exit counts). From the
 *  top-left to the exit at the bottom-right within `best + spare` pushes; every board is checked solvable (3–8 pushes). */
export const ICEPATH = {size: 6, spare: 4} as const;
const SLIDE = {U: [-1, 0], R: [0, 1], D: [1, 0], L: [0, -1]} as const;
export function iceSlide(rocks: number[], at: number, dir: string) {
  const d = SLIDE[dir as keyof typeof SLIDE], n = ICEPATH.size, exit = n * n - 1; if (!d) return null;
  let r = Math.floor(at / n), c = at % n;
  for (;;) { const rr = r + d[0], cc = c + d[1]; if (rr < 0 || rr >= n || cc < 0 || cc >= n || rocks.includes(rr * n + cc)) break; r = rr; c = cc; if (r * n + c === exit) break; }
  return r * n + c;
}
/** The fewest pushes from the start to the exit (null: no way). */
export function iceBest(rocks: number[]) {
  const n = ICEPATH.size, exit = n * n - 1, dist = new Map([[0, 0]]), queue = [0];
  while (queue.length) { const at = queue.shift()!; if (at === exit) return dist.get(at)!; for (const d of Object.keys(SLIDE)) { const to = iceSlide(rocks, at, d)!; if (!dist.has(to)) { dist.set(to, dist.get(at)! + 1); queue.push(to); } } }
  return null;
}
/** 얼음 철자 자물쇠: a meaning and the word's letters, shuffled; spell it to open the frozen chest (two tries). */
export const ICELOCK = {tries: 2} as const;
interface IcelockState { q: any; letters: string[]; tries: number }
/** 짝 맞추기 항아리: eight jars hide four words and their meanings; open two at a time, find all four pairs within `tries`. */
export const JARS = {pairs: 4, tries: 7} as const;
interface JarsState { cards: {pair: number; text: string}[]; found: number[]; tries: number; words: string[] }
/** 황금 저울: nine gold coins, one a lighter fake; two weighings, then point to it. */
export const SCALE = {coins: 9, weighings: 2} as const;
interface ScaleState { fake: number; history: {left: number[]; right: number[]; heavier: 'left' | 'right' | 'even'}[] }
/** 신전 미로: a 5×5 maze from the top-left to the exit at the bottom-right, two snake traps off the way. `walls[i]`: which sides of
 *  cell i are closed (bits: 1 up, 2 right, 4 down, 8 left). */
export const MAZE = {size: 5, traps: 2, maxSteps: 60} as const;
const DIRS = {U: [-1, 0, 1, 4], R: [0, 1, 2, 8], D: [1, 0, 4, 1], L: [0, -1, 8, 2]} as const;
export function mazeStep(walls: number[], at: number, dir: string) {
  const d = DIRS[dir as keyof typeof DIRS], n = MAZE.size; if (!d || walls[at] & d[2]) return null;
  const r = Math.floor(at / n) + d[0], c = at % n + d[1]; return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : null;
}
/** 수정 불빛 퍼즐: 3×3 crystals; a press flips it and its up/down/left/right neighbours. Light them all within `limit` presses. */
export const CRYSTAL = {size: 3, limit: 10} as const;
export function crystalPress(cells: boolean[], i: number) {
  const n = CRYSTAL.size, r = Math.floor(i / n), c = i % n, out = [...cells];
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < n && cc >= 0 && cc < n) out[rr * n + cc] = !out[rr * n + cc]; }
  return out;
}
/** 연잎 점프: three hops, played in the browser (a timing game); three take at least this long. */
export const LILYPAD = {hops: 3, minMs: 2500} as const;
export const isMiniGame = (type: TowerEvent): type is MiniGame => MINI_GAMES.has(type);

/** How a game ended: what it gives (or takes) and the line shown on the result screen. */
export interface GameResult { success: boolean; text: string; stone?: number; potions?: number; losePotion?: boolean; /** lost: the next battle starts with this (TOWER_DEBUFFS) */ debuff?: TowerDebuff; right?: number; asked?: number; /** shown with the result (all the cards) */ reveal?: any }

/** 미믹 상자: one of three chests is a mimic. One chest "breathes" — usually the mimic, sometimes not (a hunch, not a sure thing). */
interface MimicState { mimic: number; breath: number }
/** 점쟁이 카드: three face-down cards — 행운 (강화석 2), 보통 (물약), 불운 (the next battle starts weaker). */
type Fortune = 'good' | 'normal' | 'bad';
interface FortuneState { cards: Fortune[] }

/** Word questions from the tower wordbook (made by petTower): `meaning → word` or `word → meaning`. */
export interface GameWords { ask: (kind: 'attack' | 'defend') => any; sentence?: () => {text: string; meaning: string; pieces: string[]} | null }
/** Three word questions in a row: 버섯 징검다리 (a meaning → three word mushrooms), 메아리 동굴 (a word heard → its meaning). */
interface StepsState { step: number; qs: any[] }
const STEPS = {
  mushroom: {kind: 'attack', three: true, prize: {potions: 1}, debuff: 'wet', win: '버섯 세 개를 모두 밟고 건넜어요! 물약을 주웠어요', miss: (w: string) => `미끄덩! '${w}' 버섯이 아니었어요. 풍덩 빠져 흠뻑 젖었어요`},
  echo: {kind: 'defend', three: false, prize: {stone: 1}, debuff: 'deafen', win: '메아리를 세 번 모두 알아들었어요! 동굴 벽에서 강화석이 떨어졌어요', miss: (w: string) => `메아리는 '${w}'였어요. 울림이 너무 커서 귀가 멍멍해요`},
} as const;
const isSteps = (type: MiniGame): type is keyof typeof STEPS => type in STEPS;
/** Three of the four choices, the answer kept. */
function three(q: any, rand: () => number) {
  const others = q.choices.filter((_: string, i: number) => i !== q.answer), drop = Math.floor(rand() * others.length), keep = others.filter((_: string, i: number) => i !== drop);
  const at = Math.floor(rand() * 3), choices = [...keep.slice(0, at), q.choices[q.answer], ...keep.slice(at)];
  return {...q, choices, answer: at};
}

export function initGame(type: MiniGame, rand: () => number, words?: GameWords): any {
  if (type === 'hoard') {
    const at = HOARD.wake.findIndex(p => rand() < p), wake = at < 0 ? null : at + 1;
    return {wake, stir: Array.from({length: HOARD.max}, (_, i) => rand() < (wake === i + 1 ? HOARD.stirIfWaking : HOARD.stirElse)), coins: 0} satisfies HoardState;
  }
  if (type === 'trial') {
    const mix = (list: string[], join: string) => { const out = [...list]; for (let t = 0; t < 5 && out.join(join) === list.join(join); t++) for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
    const plain = () => { let q = words!.ask('attack'); for (let k = 0; k < 6 && !/^[a-z]{3,10}$/i.test(q.word); k++) q = words!.ask('attack'); return q; };
    const gates = TRIAL.gates.map((kind): TrialGate => {
      if (kind === 'spell') { const q = plain(); return {kind, q, letters: mix(q.word.toLowerCase().split(''), '')}; }
      if (kind === 'sentence') {
        const line = words!.sentence?.() || null; if (line) return {kind, text: line.text, meaning: line.meaning, pieces: mix([...line.pieces], ' '), sentence: true};
        const q = plain(); return {kind, text: q.word, meaning: q.meaning, pieces: mix(q.word.toLowerCase().split(''), ''), sentence: false, q};
      }
      return {kind, q: words!.ask(kind === 'meaning' ? 'attack' : 'defend')};
    });
    return {gates, step: 0, right: 0} satisfies TrialState;
  }
  if (type === 'oneline') return {shape: Math.floor(rand() * ONELINE.shapes.length), tries: 0} satisfies OnelineState;
  if (type === 'stars') return {words: Array.from({length: STARS.steps}, () => {
    let q = words!.ask('attack'); for (let k = 0; k < 6 && !/^[a-z]{3,8}$/i.test(q.word); k++) q = words!.ask('attack');
    const word = String(q.word).toLowerCase().replace(/[^a-z]/g, '').slice(0, 10) || 'star', letters = [...word, ...Array.from({length: STARS.decoys}, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(rand() * 26)])];
    // spread out: a few tries for each star to keep away from the others
    const stars: {c: string; x: number; y: number}[] = [];
    for (const c of letters) { let best = {x: 50, y: 50}, far = -1; for (let t = 0; t < 12; t++) { const p = {x: 8 + Math.round(rand() * 84), y: 10 + Math.round(rand() * 76)}, d = Math.min(999, ...stars.map(o => Math.hypot(o.x - p.x, o.y - p.y))); if (d > far) { far = d; best = p; } } stars.push({c, ...best}); }
    for (let i = stars.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [stars[i], stars[j]] = [stars[j], stars[i]]; }
    return {q, word, stars};
  }), step: 0, right: 0} satisfies StarsState;
  if (type === 'windpath') return {rings: Array.from({length: WINDPATH.rings}, () => Math.round((0.25 + rand() * 0.5) * 100) / 100)};
  if (type === 'blanks') return {words: Array.from({length: BLANKS.steps}, () => {
    let q = words!.ask('attack'); for (let k = 0; k < 6 && !/^[a-z]{3,12}$/i.test(q.word); k++) q = words!.ask('attack');
    const word = String(q.word).toLowerCase(), letters = [...word.matchAll(/[a-z]/g)].map(m => m.index!);
    const count = Math.min(letters.length - 1, word.length >= 7 ? 3 : word.length >= 4 ? 2 : 1), blanks: number[] = [];
    while (blanks.length < Math.max(1, count)) { const i = letters[Math.floor(rand() * letters.length)]; if (!blanks.includes(i)) blanks.push(i); }
    blanks.sort((a, b) => a - b);
    const tiles = [...blanks.map(i => word[i]), ...Array.from({length: BLANKS.decoys}, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(rand() * 26)])];
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    return {q, blanks, tiles};
  }), step: 0, right: 0} satisfies BlanksState;
  if (type === 'shells') return {start: Math.floor(rand() * SHELLS.count), swaps: SHELLS.ms.map(() => { const a = Math.floor(rand() * SHELLS.count); return [a, (a + 1 + Math.floor(rand() * (SHELLS.count - 1))) % SHELLS.count] as [number, number]; })} satisfies ShellsState;
  if (type === 'bubbles') return {qs: Array.from({length: BUBBLES.steps}, () => words!.ask('attack')), step: 0, right: 0} satisfies BubblesState;
  if (type === 'lavarun') return {qs: Array.from({length: LAVARUN.steps}, () => words!.ask('attack')), step: 0, right: 0, deadline: null} satisfies LavarunState;
  if (type === 'lavapath') return {path: Array.from({length: LAVAPATH.rows}, () => Math.floor(rand() * LAVAPATH.cols))};
  if (type === 'potions') { const a = Math.floor(rand() * BREWS.length), b = (a + 1 + Math.floor(rand() * (BREWS.length - 1))) % BREWS.length; return {targets: [a, b], round: 0} satisfies PotionsState; }
  if (type === 'scroll') {
    const line = words!.sentence?.() || null, q = line ? null : words!.ask('attack');
    const pieces = line ? [...line.pieces] : q.word.toLowerCase().split(''), right = pieces.join(line ? ' ' : '');
    for (let t = 0; t < 5 && pieces.join(line ? ' ' : '') === right; t++) for (let i = pieces.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
    return {text: line ? line.text : q.word, meaning: line ? line.meaning : q.meaning, pieces, sentence: Boolean(line), tries: 0, ...(q ? {q} : {})} satisfies ScrollState;
  }
  if (type === 'runes') return {seq: Array.from({length: RUNES.first + RUNES.rounds - 1}, () => Math.floor(rand() * RUNES.count)), round: 0} satisfies RunesState;
  if (type === 'icepath') {
    // random rocks until the board takes 3–8 pushes (a known board if luck runs out)
    const n = ICEPATH.size;
    for (let tries = 0; tries < 400; tries++) {
      const rocks: number[] = []; while (rocks.length < 7) { const i = 1 + Math.floor(rand() * (n * n - 2)); if (!rocks.includes(i)) rocks.push(i); }
      const best = iceBest(rocks); if (best !== null && best >= 3 && best <= 8) return {rocks, best};
    }
    return {rocks: [4, 9, 14, 19, 26, 31], best: iceBest([4, 9, 14, 19, 26, 31])};
  }
  if (type === 'icelock') {
    // a word of plain letters (3–10); the letters shuffled, never already in order
    let q = words!.ask('attack'); for (let k = 0; k < 6 && !/^[a-z]{3,10}$/i.test(q.word); k++) q = words!.ask('attack');
    const letters = q.word.toLowerCase().split('');
    for (let t = 0; t < 5 && letters.join('') === q.word.toLowerCase(); t++) for (let i = letters.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [letters[i], letters[j]] = [letters[j], letters[i]]; }
    return {q, letters, tries: 0} satisfies IcelockState;
  }
  if (type === 'jars') {
    const qs = Array.from({length: JARS.pairs}, () => words!.ask('attack')), cards = qs.flatMap((q, pair) => [{pair, text: q.word}, {pair, text: q.meaning}]);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return {cards, found: [], tries: 0, words: qs.map(q => q.word)} satisfies JarsState;
  }
  if (type === 'scale') return {fake: Math.floor(rand() * SCALE.coins), history: []} satisfies ScaleState;
  if (type === 'maze') {
    // a perfect maze (one way between any two cells) carved from the start, then traps on cells off the way to the exit
    const n = MAZE.size, walls: number[] = Array(n * n).fill(15), seen = new Set([0]), stack = [0], from = new Map<number, number>();
    while (stack.length) {
      const at = stack[stack.length - 1], r = Math.floor(at / n), c = at % n;
      const next = Object.values(DIRS).map(d => [r + d[0], c + d[1], d[2], d[3]]).filter(([rr, cc]) => rr >= 0 && rr < n && cc >= 0 && cc < n && !seen.has(rr * n + cc));
      if (!next.length) { stack.pop(); continue; }
      const [rr, cc, mine, theirs] = next[Math.floor(rand() * next.length)], to = rr * n + cc;
      walls[at] &= ~mine; walls[to] &= ~theirs; seen.add(to); from.set(to, at); stack.push(to);
    }
    const way = new Set<number>(); for (let at: number | undefined = n * n - 1; at !== undefined; at = from.get(at)) way.add(at);
    const off = [...Array(n * n).keys()].filter(i => !way.has(i)), traps: number[] = [];
    while (traps.length < Math.min(MAZE.traps, off.length)) traps.push(off.splice(Math.floor(rand() * off.length), 1)[0]);
    return {walls, traps};
  }
  if (type === 'crystal') {
    // from all lit, a few different presses: always solvable (pressing the same cells again)
    let cells = Array(CRYSTAL.size ** 2).fill(true); const presses = new Set<number>();
    while (presses.size < 3 + Math.floor(rand() * 2)) presses.add(Math.floor(rand() * cells.length));
    for (const i of presses) cells = crystalPress(cells, i);
    return {start: cells};
  }
  if (isSteps(type)) { const c = STEPS[type]; return {step: 0, qs: [0, 1, 2].map(() => { const q = {...words!.ask(c.kind), deadline: null}; return c.three ? three(q, rand) : q; })} satisfies StepsState; }
  if (type === 'mimic') {
    const mimic = Math.floor(rand() * 3), breath = rand() < 0.75 ? mimic : (mimic + 1 + Math.floor(rand() * 2)) % 3;
    return {mimic, breath} satisfies MimicState;
  }
  if (type === 'fortune') { const cards: Fortune[] = ['good', 'normal', 'bad']; for (let i = 2; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; } return {cards} satisfies FortuneState; }
  return {};
}

export function publicGame(type: MiniGame, game: any, now = Date.now()) {
  // what the coins are worth stays a surprise until the result (a game of nerve)
  if (type === 'hoard') { const g = game as HoardState; return {coins: g.coins, max: HOARD.max, stir: g.coins > 0 && g.stir[g.coins]}; }
  if (type === 'trial') {
    const g = game as TrialState, gate = g.gates[g.step], base = {step: g.step, steps: g.gates.length, need: TRIAL.need, right: g.right, kind: gate.kind};
    if (gate.kind === 'spell') return {...base, meaning: gate.q.meaning, letters: gate.letters};
    if (gate.kind === 'sentence') return {...base, meaning: gate.meaning, pieces: gate.pieces, sentence: gate.sentence};
    return {...base, ...(gate.kind === 'meaning' ? {prompt: gate.q.meaning} : {word: gate.q.word}), choices: gate.q.choices};
  }
  if (type === 'oneline') { const g = game as OnelineState, s = ONELINE.shapes[g.shape]; return {name: s.name, nodes: s.nodes, edges: s.edges, triesLeft: ONELINE.tries - g.tries}; }
  if (type === 'stars') { const g = game as StarsState, w = g.words[g.step]; return {step: g.step, steps: STARS.steps, need: STARS.need, right: g.right, meaning: w.q.meaning, length: w.word.length, stars: w.stars}; }
  if (type === 'windpath') return {rings: game.rings, spacingMs: WINDPATH.spacingMs};
  if (type === 'blanks') {
    const g = game as BlanksState, w = g.words[g.step], word = String(w.q.word).toLowerCase();
    return {step: g.step, steps: BLANKS.steps, need: BLANKS.need, right: g.right, meaning: w.q.meaning, pattern: [...word].map((c, i) => w.blanks.includes(i) ? null : c), tiles: w.tiles};
  }
  if (type === 'shells') { const g = game as ShellsState; return {shells: SHELLS.count, start: g.start, swaps: g.swaps, ms: SHELLS.ms, peekMs: SHELLS.peekMs}; }
  if (type === 'bubbles') { const g = game as BubblesState, q = g.qs[g.step]; return {step: g.step, steps: BUBBLES.steps, need: BUBBLES.need, right: g.right, riseMs: BUBBLES.riseMs, prompt: q.meaning, choices: q.choices}; }
  if (type === 'lavarun') {
    const g = game as LavarunState, q = g.deadline === null ? null : g.qs[g.step];
    return {started: g.deadline !== null, step: g.step, steps: LAVARUN.steps, need: LAVARUN.need, right: g.right, ms: LAVARUN.ms, msLeft: g.deadline === null ? null : Math.max(0, g.deadline - now), ...(q ? {prompt: q.meaning, choices: q.choices} : {})};
  }
  if (type === 'mimic') return {chests: 3, breath: (game as MimicState).breath};
  if (type === 'fortune') return {cards: 3};
  if (type === 'crystal') return {cells: game.start, limit: CRYSTAL.limit};
  if (type === 'maze') return {size: MAZE.size, walls: game.walls, traps: game.traps};
  if (type === 'lavapath') return {rows: LAVAPATH.rows, cols: LAVAPATH.cols, peekMs: LAVAPATH.peekMs, ...(game.hidden ? {} : {path: game.path})};
  if (type === 'potions') { const g = game as PotionsState; return {flasks: FLASKS, target: BREWS[g.targets[g.round]].name, round: g.round, rounds: g.targets.length}; }
  if (type === 'scroll') { const g = game as ScrollState; return {meaning: g.meaning, pieces: g.pieces, sentence: g.sentence, triesLeft: SCROLL.tries - g.tries}; }
  if (type === 'runes') { const g = game as RunesState; return {runes: RUNES.count, round: g.round, rounds: RUNES.rounds, show: g.seq.slice(0, RUNES.first + g.round)}; }
  if (type === 'icepath') return {size: ICEPATH.size, rocks: game.rocks, limit: game.best + ICEPATH.spare};
  if (type === 'icelock') { const g = game as IcelockState; return {meaning: g.q.meaning, letters: g.letters, triesLeft: ICELOCK.tries - g.tries}; }
  if (type === 'jars') { const g = game as JarsState; return {jars: g.cards.length, open: g.cards.map((c, i) => g.found.includes(c.pair) ? {i, text: c.text} : null).filter(Boolean), found: g.found.length, pairs: JARS.pairs, triesLeft: JARS.tries - g.tries}; }
  if (type === 'scale') { const g = game as ScaleState; return {coins: SCALE.coins, history: g.history, left: SCALE.weighings - g.history.length}; }
  if (isSteps(type)) { const g = game as StepsState, q = g.qs[g.step]; return {step: g.step, steps: g.qs.length, ...(type === 'echo' ? {word: q.word} : {prompt: q.meaning}), choices: q.choices}; }
  return null;
}

/** One move; a GameResult when the game is over, otherwise what the browser should show next. */
/** `missed`: a word answered wrong (it goes to 오답 복습). */
export type GameMove = ({over: GameResult} | {next: any}) & {missed?: {q: any; choice: number}};
export function playGame(type: MiniGame, game: any, move: unknown, input: any, playedMs = Infinity, now = Date.now()): GameMove {
  if (type === 'hoard' && (move === 'grab' || move === 'stop')) {
    const g = game as HoardState;
    if (move === 'grab') {
      if (g.coins >= HOARD.max) throw Error('PET_BAD_ACTION');
      g.coins += 1;
      if (g.coins === g.wake) return {over: {success: false, debuff: 'roared', reveal: {coins: g.coins, wake: g.wake}, text: `${g.coins}번째 금화에서 용이 깼어요! 금화를 모두 떨어뜨리고 쫓겨났어요`}};
      if (g.coins < HOARD.max) return {next: publicGame(type, g)};
    }
    // left with the coins (or took the last one)
    const prize = hoardPrize(g.coins), got = [prize.stone ? `강화석 ${prize.stone}개` : '', prize.potions ? `물약 ${prize.potions}개` : ''].filter(Boolean).join('와 ');
    return {over: {success: true, ...prize, reveal: {coins: g.coins, wake: g.wake}, text: g.coins ? `금화 ${g.coins}개를 들고 살금살금 빠져나왔어요! ${got}로 바꿨어요` : '금화는 그대로 두고 살금살금 지나갔어요'}};
  }
  if (type === 'trial' && move === 'gate') {
    const g = game as TrialState, gate = g.gates[g.step]; if (!gate) throw Error('PET_BAD_ACTION');
    let ok: boolean, answer: string, missed: GameMove['missed'];
    if (gate.kind === 'spell' || gate.kind === 'sentence') {
      const text = String(input?.text || '').trim(); if (!text || text.length > 300) throw Error('PET_BAD_ACTION');
      answer = gate.kind === 'spell' ? gate.q.word : gate.text; ok = gate.kind === 'spell' ? text.toLowerCase() === answer.toLowerCase() : sameLine(text, answer);
      if (!ok && gate.q) missed = {q: gate.q, choice: -1};
    } else {
      const choice = Math.floor(Number(input?.choice)); if (!(choice >= 0 && choice < gate.q.choices.length)) throw Error('PET_BAD_ACTION');
      ok = choice === gate.q.answer; answer = gate.q.choices[gate.q.answer]; if (!ok) missed = {q: gate.q, choice};
    }
    if (ok) g.right += 1; g.step += 1;
    const steps = g.gates.length;
    if (g.step >= steps && g.right >= TRIAL.need) return {over: {success: true, stone: 3, potions: 1, right: g.right, asked: g.step, text: `다섯 관문 중 ${g.right}개를 넘었어요! 용왕이 인정하며 강화석 3개와 물약을 내렸어요`}, missed};
    if (g.right + (steps - g.step) < TRIAL.need) return {over: {success: false, debuff: 'awed', right: g.right, asked: g.step, reveal: {answer}, text: `'${answer}'였어요. 관문 두 개를 놓쳐 용왕의 위엄에 움츠러들었어요`}, missed};
    return {next: {...publicGame(type, g), last: {ok, answer}}, missed};
  }
  if (type === 'oneline' && move === 'draw') {
    const g = game as OnelineState, s = ONELINE.shapes[g.shape], path = Array.isArray(input?.path) ? input.path.map(Number) : null;
    if (!path || path.length < 1 || path.length > s.edges.length + 1 || path.some((i: number) => !Number.isInteger(i) || i < 0 || i >= s.nodes.length) || g.tries >= ONELINE.tries) throw Error('PET_BAD_ACTION');
    if (strokeDone(g.shape, path)) return {over: {success: true, stone: 2, text: `한 번에 '${s.name}'을 그렸어요! 별빛이 모여 강화석 2개가 됐어요`}};
    g.tries += 1;
    if (g.tries < ONELINE.tries) return {next: {...publicGame(type, g), wrong: true}};
    return {over: {success: false, debuff: 'tangled', text: '선이 엉켜 버렸어요. 머리가 빙글빙글 돌아요'}};
  }
  if (type === 'stars' && move === 'trace') {
    const g = game as StarsState, w = g.words[g.step], picked = Array.isArray(input?.stars) ? input.stars.map(Number) : null;
    if (!w || !picked || picked.length !== w.word.length || new Set(picked).size !== picked.length || picked.some((i: number) => !Number.isInteger(i) || i < 0 || i >= w.stars.length)) throw Error('PET_BAD_ACTION');
    const missed = picked.map((i: number) => w.stars[i].c).join('') !== w.word ? {q: w.q, choice: -1} : undefined;
    if (!missed) g.right += 1; g.step += 1;
    if (g.step >= STARS.steps && g.right >= STARS.need) return {over: {success: true, stone: 2, right: g.right, asked: g.step, text: `별자리 ${g.right}개를 이었어요! 밤하늘에서 강화석 2개가 떨어졌어요`}, missed};
    if (g.right + (STARS.steps - g.step) < STARS.need) return {over: {success: false, debuff: 'starstruck', right: g.right, asked: g.step, reveal: {word: w.q.word}, text: `'${w.q.word}' 별자리였어요. 별빛에 눈이 부셔요`}, missed};
    return {next: {...publicGame(type, g), last: {ok: !missed, word: w.q.word}}, missed};
  }
  if (type === 'windpath' && move === 'fly') {
    const passed = Math.max(0, Math.min(WINDPATH.rings, Math.floor(Number(input?.passed)) || 0));
    if (passed === WINDPATH.rings && playedMs < WINDPATH.minMs) throw Error('PET_BAD_ACTION');
    return passed === WINDPATH.rings ? {over: {success: true, stone: 1, potions: 1, text: '구름 고리 다섯 개를 모두 통과했어요! 바람 끝에서 강화석과 물약을 주웠어요'}}
      : {over: {success: false, debuff: 'gust', text: `휘잉! 고리 ${passed}개를 지나고 돌풍에 휘청였어요`}};
  }
  if (type === 'blanks' && move === 'fill') {
    const g = game as BlanksState, w = g.words[g.step], letters = Array.isArray(input?.letters) ? input.letters.map((x: unknown) => String(x).toLowerCase()) : null;
    if (!w || !letters || letters.length !== w.blanks.length || letters.some((x: string) => !/^[a-z]$/.test(x))) throw Error('PET_BAD_ACTION');
    const word = String(w.q.word).toLowerCase(), made = [...word].map((c, i) => { const k = w.blanks.indexOf(i); return k >= 0 ? letters[k] : c; }).join('');
    const missed = made !== word ? {q: w.q, choice: -1} : undefined;
    if (!missed) g.right += 1; g.step += 1;
    if (g.step >= BLANKS.steps && g.right >= BLANKS.need) return {over: {success: true, stone: 2, right: g.right, asked: g.step, text: `번개처럼 ${g.right}/${BLANKS.steps} 단어를 완성했어요! 번개 구름에서 강화석 2개가 떨어졌어요`}, missed};
    if (g.right + (BLANKS.steps - g.step) < BLANKS.need) return {over: {success: false, debuff: 'shocked', right: g.right, asked: g.step, reveal: {word: w.q.word}, text: `'${w.q.word}'였어요. 빈칸을 놓쳐 번개에 찌릿!`}, missed};
    return {next: {...publicGame(type, g), last: {ok: !missed, word: w.q.word}}, missed};
  }
  if (type === 'shells' && move === 'pick') {
    const g = game as ShellsState, shell = Math.floor(Number(input?.shell)); if (!(shell >= 0 && shell < SHELLS.count) || playedMs < SHELLS_MIN_MS) throw Error('PET_BAD_ACTION');
    const pearl = shellsEnd(g.start, g.swaps);
    return shell === pearl ? {over: {success: true, stone: 1, potions: 1, reveal: {pearl}, text: '진주를 찾았어요! 조개가 고맙다며 강화석과 물약을 내줬어요'}}
      : {over: {success: false, debuff: 'clamped', reveal: {pearl}, text: `진주는 ${pearl + 1}번 조개에 있었어요. 빈 조개가 덥석! 손가락을 물렸어요`}};
  }
  if (type === 'bubbles' && (move === 'pop' || move === 'gone')) {
    const g = game as BubblesState, q = g.qs[g.step], picked = move === 'gone' ? -1 : Math.floor(Number(input?.choice));
    if (!q || (move === 'pop' && !(picked >= 0 && picked < q.choices.length))) throw Error('PET_BAD_ACTION');
    // The first meaning began with the floor (now - playedMs); each next one when the last move was taken.
    const since = now - (g.stepAt ?? now - playedMs);
    if (move === 'gone' && since < BUBBLES.riseMs - BUBBLES.graceMs) throw Error('PET_BAD_ACTION');
    const choice = move === 'pop' && since > BUBBLES.riseMs + BUBBLES.graceMs ? -1 : picked; // popped after they floated away: a miss
    const missed = choice !== q.answer ? {q, choice} : undefined;
    if (!missed) g.right += 1; g.step += 1; g.stepAt = now;
    if (g.step >= BUBBLES.steps && g.right >= BUBBLES.need) return {over: {success: true, stone: 2, right: g.right, asked: g.step, text: `${g.right}/${BUBBLES.steps} 거품을 터뜨렸어요! 거품 속에서 강화석 2개가 나왔어요`}, missed};
    if (g.right + (BUBBLES.steps - g.step) < BUBBLES.need) return {over: {success: false, debuff: 'breathless', right: g.right, asked: g.step, reveal: {answer: q.choices[q.answer]}, text: `거품을 ${BUBBLES.steps - BUBBLES.need + 1}개 놓쳤어요. 물속에서 숨이 차올라요`}, missed};
    return {next: {...publicGame(type, g), last: !missed}, missed};
  }
  if (type === 'lavarun' && move === 'start') { const g = game as LavarunState; if (g.deadline !== null) throw Error('PET_BAD_ACTION'); g.deadline = now + LAVARUN.ms; return {next: publicGame(type, g, now)}; }
  if (type === 'lavarun' && move === 'timeout') {
    const g = game as LavarunState; if (g.deadline === null || now < g.deadline - LAVARUN.graceMs) throw Error('PET_BAD_ACTION');
    return {over: {success: false, debuff: 'scorched', right: g.right, asked: g.step, text: `용암이 차올랐어요! ${g.right}문제를 맞히고 열기에 그을린 채 빠져나왔어요`}};
  }
  if (type === 'lavarun' && move === 'answer') {
    const g = game as LavarunState, q = g.qs[g.step], choice = Math.floor(Number(input?.choice));
    if (g.deadline === null || !q || !(choice >= 0 && choice < q.choices.length)) throw Error('PET_BAD_ACTION');
    const late = now > g.deadline + LAVARUN.graceMs, missed = late || choice !== q.answer ? {q, choice} : undefined;
    const lost = (text: string) => ({over: {success: false, debuff: 'scorched' as const, right: g.right, asked: g.step + 1, text}, missed});
    if (late) return lost(`용암이 차올랐어요! ${g.right}문제를 맞히고 열기에 그을린 채 빠져나왔어요`);
    if (!missed) g.right += 1; g.step += 1;
    if (g.right >= LAVARUN.need && g.step >= LAVARUN.steps) return {over: {success: true, stone: 2, right: g.right, asked: g.step, text: `${g.right}/${LAVARUN.steps} 정답! 용암이 닿기 전에 탈출했어요. 강화석 2개!`}, missed};
    if (g.right + (LAVARUN.steps - g.step) < LAVARUN.need) return lost(`${LAVARUN.steps - LAVARUN.need + 1}문제를 놓쳐 용암에 발이 닿을 뻔! 그을린 채 빠져나왔어요`);
    return {next: {...publicGame(type, g, now), last: !missed}, missed};
  }
  if (type === 'mimic' && move === 'open') {
    const chest = Math.floor(Number(input?.chest)); if (!(chest >= 0 && chest < 3)) throw Error('PET_BAD_ACTION');
    const g = game as MimicState;
    return chest === g.mimic
      ? {over: {success: false, losePotion: true, text: '미믹이었어요! 물약 하나를 뺏기고 겨우 도망쳤어요'}}
      : {over: {success: true, stone: 1, text: '진짜 보물상자였어요! 강화석을 찾았어요'}};
  }
  if (isSteps(type) && move === 'step') {
    const c = STEPS[type], g = game as StepsState, q = g.qs[g.step], choice = Math.floor(Number(input?.choice));
    if (!q || !(choice >= 0 && choice < q.choices.length)) throw Error('PET_BAD_ACTION');
    if (choice !== q.answer) return {over: {success: false, debuff: c.debuff, right: g.step, asked: g.step + 1, reveal: {answer: q.answer}, text: c.miss(q.word)}, missed: {q, choice}};
    g.step += 1;
    if (g.step >= g.qs.length) return {over: {success: true, ...c.prize, right: g.step, asked: g.step, text: c.win}};
    return {next: publicGame(type, g)};
  }
  if (type === 'lavapath' && move === 'hide') { game.hidden = true; return {next: publicGame(type, game)}; }
  if (type === 'lavapath' && move === 'cross') {
    const cols = Array.isArray(input?.cols) ? input.cols.map(Number) : null, path: number[] = game.path;
    if (!cols || cols.length < 1 || cols.length > LAVAPATH.rows || cols.some((c: number) => !(c >= 0 && c < LAVAPATH.cols))) throw Error('PET_BAD_ACTION');
    const slip = cols.findIndex((c: number, i: number) => c !== path[i]);
    if (slip >= 0) return {over: {success: false, debuff: 'burned', reveal: {path}, text: `${slip + 1}번째 줄 돌이 가라앉았어요! 발을 데었지만 겨우 건넜어요`}};
    if (cols.length < LAVAPATH.rows) throw Error('PET_BAD_ACTION');
    return {over: {success: true, stone: 2, text: '안전한 돌만 밟고 용암을 건넜어요! 건너편에서 강화석 2개를 주웠어요'}};
  }
  if (type === 'potions' && move === 'mix') {
    const g = game as PotionsState, a = String(input?.a), b = String(input?.b), want: readonly string[] = BREWS[g.targets[g.round]].pair;
    if (a === b || !FLASKS.includes(a as any) || !FLASKS.includes(b as any)) throw Error('PET_BAD_ACTION');
    if (!(want.includes(a) && want.includes(b))) return {over: {success: false, debuff: 'tummy', reveal: {want}, text: `${BREWS[g.targets[g.round]].name} 물약이 아니라 이상한 물약이 됐어요. 한 모금 마셨다가 배탈이 났어요`}};
    g.round += 1;
    if (g.round >= g.targets.length) return {over: {success: true, stone: 1, potions: 2, text: '두 물약을 모두 만들었어요! 물약 2개와 강화석을 챙겼어요'}};
    return {next: {...publicGame(type, g), made: true}};
  }
  if (type === 'scroll' && move === 'cast') {
    const g = game as ScrollState, text = String(input?.text || '');
    if (!text || text.length > 300 || g.tries >= SCROLL.tries) throw Error('PET_BAD_ACTION');
    g.tries += 1;
    if (sameLine(text, g.text)) return {over: {success: true, stone: 2, right: 1, asked: 1, text: `주문 완성! "${g.text}" 봉인이 풀리고 강화석 2개가 나왔어요`}};
    if (g.tries < SCROLL.tries) return {next: {...publicGame(type, g), wrong: true}};
    return {over: {success: false, debuff: 'recoil', right: 0, asked: 1, reveal: {text: g.text}, text: `주문은 "${g.text}"였어요. 틀린 주문이 되돌아와 따끔해요`}, ...(g.q ? {missed: {q: g.q, choice: -1}} : {})};
  }
  if (type === 'runes' && move === 'repeat') {
    const g = game as RunesState, want = g.seq.slice(0, RUNES.first + g.round), got = Array.isArray(input?.input) ? input.input.map(Number) : null;
    if (!got || got.length !== want.length) throw Error('PET_BAD_ACTION');
    if (got.some((x: number, i: number) => x !== want[i])) return {over: {success: false, debuff: 'backlash', reveal: {want}, text: `${g.round + 1}번째에서 순서가 틀렸어요. 룬의 힘이 튕겨 마력이 빠져나가요`}};
    g.round += 1;
    if (g.round >= RUNES.rounds) return {over: {success: true, stone: 1, potions: 1, text: '룬 세 번을 모두 따라 했어요! 마법진에서 강화석과 물약이 나왔어요'}};
    return {next: publicGame(type, g)};
  }
  if (type === 'icepath' && move === 'slide') {
    // pushed in the browser; the server slides them again
    const moves = Array.isArray(input?.moves) ? input.moves.map(String) : null, limit = game.best + ICEPATH.spare, exit = ICEPATH.size ** 2 - 1;
    if (!moves || moves.length > limit || moves.some((d: string) => !(d in SLIDE))) throw Error('PET_BAD_ACTION');
    let at = 0; for (const d of moves) { at = iceSlide(game.rocks, at, d)!; if (at === exit) break; }
    return at === exit ? {over: {success: true, stone: 1, potions: 1, text: `슝— ${moves.length}번 밀어서 얼음길을 건넜어요! 강화석과 물약을 주웠어요`}} : {over: {success: false, debuff: 'bruised', text: '미끄러지다 꽈당! 엉덩방아를 찧고 겨우 빠져나왔어요'}};
  }
  if (type === 'icelock' && move === 'spell') {
    const g = game as IcelockState, text = String(input?.text || '').trim().toLowerCase();
    if (!text || text.length > 20 || g.tries >= ICELOCK.tries) throw Error('PET_BAD_ACTION');
    g.tries += 1;
    if (text === g.q.word.toLowerCase()) return {over: {success: true, stone: 2, right: 1, asked: 1, text: `'${g.q.word}'! 얼음 자물쇠가 녹아 열렸어요. 강화석 2개!`}};
    if (g.tries < ICELOCK.tries) return {next: {...publicGame(type, g), wrong: true}};
    return {over: {success: false, debuff: 'frozen', right: 0, asked: 1, reveal: {word: g.q.word}, text: `정답은 '${g.q.word}'였어요. 얼음을 만지다 손이 꽁꽁 얼었어요`}, missed: {q: g.q, choice: -1}};
  }
  if (type === 'jars' && move === 'flip') {
    const g = game as JarsState, a = Math.floor(Number(input?.a)), b = Math.floor(Number(input?.b)), n = g.cards.length;
    if (!(a >= 0 && a < n && b >= 0 && b < n) || a === b || g.found.includes(g.cards[a].pair) || g.found.includes(g.cards[b].pair) || g.tries >= JARS.tries) throw Error('PET_BAD_ACTION');
    g.tries += 1; const match = g.cards[a].pair === g.cards[b].pair; if (match) g.found.push(g.cards[a].pair);
    const peek = {a, b, texts: [g.cards[a].text, g.cards[b].text], match};
    if (g.found.length === JARS.pairs) return {over: {success: true, stone: 1, potions: 1, right: JARS.pairs, asked: JARS.pairs, text: `짝 ${JARS.pairs}쌍을 모두 찾았어요! 항아리 속에서 강화석과 물약이 나왔어요`}};
    if (g.tries >= JARS.tries) return {over: {success: false, debuff: 'dazzle', right: g.found.length, asked: JARS.pairs, text: `짝 ${g.found.length}쌍까지 찾았어요. 뚜껑이 닫히며 먼지가 날려 눈이 침침해요`}};
    return {next: {...publicGame(type, g), peek}};
  }
  if (type === 'scale' && move === 'weigh') {
    const g = game as ScaleState, side = (x: unknown) => Array.isArray(x) ? x.map(Number) : null, left = side(input?.left), right = side(input?.right);
    const ok = (l: number[] | null) => l && l.length >= 1 && l.length <= 4 && l.every(i => Number.isInteger(i) && i >= 0 && i < SCALE.coins);
    if (g.history.length >= SCALE.weighings || !ok(left) || !ok(right) || left!.length !== right!.length || new Set([...left!, ...right!]).size !== left!.length * 2) throw Error('PET_BAD_ACTION');
    // the lighter side holds the fake
    const heavier = left!.includes(g.fake) ? 'right' : right!.includes(g.fake) ? 'left' : 'even';
    g.history.push({left: left!, right: right!, heavier});
    return {next: publicGame(type, g)};
  }
  if (type === 'scale' && move === 'guess') {
    const g = game as ScaleState, coin = Math.floor(Number(input?.coin)); if (!(coin >= 0 && coin < SCALE.coins)) throw Error('PET_BAD_ACTION');
    return coin === g.fake ? {over: {success: true, stone: 2, reveal: {fake: g.fake}, text: `${coin + 1}번이 가짜 금화였어요! 진짜 금화 대신 강화석 2개를 받았어요`}} : {over: {success: false, debuff: 'curse', reveal: {fake: g.fake}, text: `아쉬워요, 가짜는 ${g.fake + 1}번이었어요. 가짜 금화의 저주가 따라와요`}};
  }
  if (type === 'maze' && move === 'walk') {
    // walked in the browser; the server follows the steps through the walls
    const path = Array.isArray(input?.path) ? input.path.map(String) : null;
    if (!path || path.length > MAZE.maxSteps) throw Error('PET_BAD_ACTION');
    let at = 0;
    for (const dir of path) {
      const to = mazeStep(game.walls, at, dir); if (to === null) throw Error('PET_BAD_ACTION');
      at = to; if (game.traps.includes(at)) return {over: {success: false, debuff: 'bitten', text: '앗, 뱀 함정! 뱀에게 물려 독이 퍼져요'}};
    }
    return at === MAZE.size ** 2 - 1 ? {over: {success: true, stone: 1, text: '미로를 빠져나왔어요! 출구 옆에서 강화석을 주웠어요'}} : {over: {success: false, debuff: 'drained', text: '길을 잃고 헤매다 기운이 빠졌어요… 신전 지기가 출구로 데려다줬어요'}};
  }
  if (type === 'crystal' && move === 'solve') {
    // played in the browser; the server replays the presses
    const presses = Array.isArray(input?.presses) ? input.presses.map(Number) : null;
    if (!presses || presses.length > CRYSTAL.limit || presses.some((i: number) => !Number.isInteger(i) || i < 0 || i >= CRYSTAL.size ** 2)) throw Error('PET_BAD_ACTION');
    const lit = presses.reduce((cells: boolean[], i: number) => crystalPress(cells, i), game.start as boolean[]).every(Boolean);
    return lit ? {over: {success: true, stone: 1, text: `수정 9개가 모두 빛나요! (${presses.length}번 만에) 강화석을 얻었어요`}} : {over: {success: false, debuff: 'dazzle', text: '수정이 다 켜지지 않았어요. 깜빡이는 빛에 눈이 침침해요'}};
  }
  if (type === 'lilypad' && move === 'hop') {
    // the timing game runs in the browser; the server only checks it took a believable time
    const made = Math.max(0, Math.min(LILYPAD.hops, Math.floor(Number(input?.made)) || 0));
    if (made === LILYPAD.hops && playedMs < LILYPAD.minMs) throw Error('PET_BAD_ACTION');
    return made === LILYPAD.hops ? {over: {success: true, potions: 1, text: '퐁퐁퐁! 연잎을 세 번 건너 물약을 주웠어요'}} : {over: {success: false, debuff: 'wet', text: `풍덩! ${made}번 건너고 물에 빠졌어요. 흠뻑 젖어 몸이 무거워요`}};
  }
  if (type === 'fortune' && move === 'pick') {
    const card = Math.floor(Number(input?.card)); if (!(card >= 0 && card < 3)) throw Error('PET_BAD_ACTION');
    const {cards} = game as FortuneState, reveal = {picked: card, cards};
    if (cards[card] === 'good') return {over: {success: true, stone: 2, reveal, text: '🌟 행운의 별 카드! 강화석 2개를 받았어요'}};
    if (cards[card] === 'normal') return {over: {success: true, potions: 1, reveal, text: '🌙 달 카드: 무난한 하루. 물약 하나를 받았어요'}};
    return {over: {success: false, debuff: 'curse', reveal, text: '🌑 불운의 카드… 다음 전투는 체력이 10% 적은 채로 시작해요'}};
  }
  throw Error('PET_BAD_ACTION');
}
