// 채움의 탑 쉬어 가기 놀이 (문 뒤 이벤트): puzzles, intuition and word games that open zone by zone. The server keeps what
// must stay secret (the mimic, the answers), the browser plays; winning gives 강화석 or 물약, losing only passes the floor
// (a mimic takes a potion). Each game: its start (`initGame`), what the browser sees (`publicGame`), and its moves (`playGame`).
import type {TowerDebuff, TowerEvent} from '../../src/lib/petCatalog.js';

export type MiniGame = Extract<TowerEvent, 'mimic' | 'fortune' | 'lilypad' | 'mushroom' | 'echo' | 'crystal' | 'maze' | 'scale' | 'jars' | 'icelock' | 'icepath' | 'runes' | 'scroll' | 'potions' | 'lavapath' | 'lavarun'>;
export const MINI_GAMES = new Set<TowerEvent>(['mimic', 'fortune', 'lilypad', 'mushroom', 'echo', 'crystal', 'maze', 'scale', 'jars', 'icelock', 'icepath', 'runes', 'scroll', 'potions', 'lavapath', 'lavarun']);
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
