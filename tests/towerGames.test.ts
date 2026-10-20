import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPet, initialPetState} from '../api/_lib/pet.js';
import {initialTower, openEntranceChest, openTowerDoor, publicTower, towerEvent, towerLayout, towerPet} from '../api/_lib/petTower.js';
import {TOWER_EVENTS, type TowerEvent} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-20T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const words = Array.from({length: 20}, (_, i) => ({w: `word${i}`, m: `뜻${i}`}));
const pool = {words, wordbookId: 'hard', wordbookTitle: '중등 어려운 단어'};
/** A pet on `floor`, the chosen game behind door 0. */
function atGame(type: TowerEvent, floor = 3, rand = seeded()) {
  const s = initialPetState(NOW), t = initialTower(NOW); s.pets[0].chosen = true; currentPet(s).level = 40; openEntranceChest(t, s);
  const tp = towerPet(t, 1); tp.floor = floor; tp.best = floor - 1;
  openTowerDoor(t, s, 'kid', pool, NOW, rand, 0, [type, 'monster', 'monster']);
  return {s, t, tp, ev: tp.event!, view: () => (publicTower(t, s, NOW).event as any), play: (move: string, input: any = {}, at = NOW) => towerEvent(t, s, move, input, at, rand) as any};
}

test('쉬어 가기 놀이: each opens on its own floor; only opened ones are behind the doors', () => {
  for (const [type, e] of Object.entries(TOWER_EVENTS)) if (e.from && e.from > 1) {
    const below = new Set(Array.from({length: 300}, (_, i) => towerLayout(`u${i}`, 1, e.from! - 1)).flat());
    assert.ok(!below.has(type as TowerEvent), `${type} not before floor ${e.from}`);
  }
  const at1 = new Set(Array.from({length: 400}, (_, i) => towerLayout(`u${i}`, 1, 1)).flat());
  assert.ok(at1.has('mimic'));
});

test('🎁 미믹 상자: the browser sees which chest breathes, not which is the mimic; a real chest gives a 강화석, the mimic takes a potion', () => {
  const g = atGame('mimic'), secret = g.ev.game;
  assert.deepEqual(g.view().game, {chests: 3, breath: secret.breath});
  const real = [0, 1, 2].find(i => i !== secret.mimic)!, stones = g.tp.stones || 0;
  const won = g.play('open', {chest: real});
  assert.deepEqual([won.cleared, won.game.success, won.stone, g.tp.stones], [true, true, 1, stones + 1]);
  assert.equal(g.tp.event, null);
  const h = atGame('mimic', 4), potions = h.tp.potions;
  const bit = h.play('open', {chest: h.ev.game.mimic});
  assert.deepEqual([bit.cleared, bit.game.success, bit.game.lostPotion, h.tp.potions], [true, false, 1, potions - 1]);
  const none = atGame('mimic', 5); none.tp.potions = 0;
  assert.equal(none.play('open', {chest: none.ev.game.mimic}).game.lostPotion, 0, 'nothing to take: nothing taken');
  assert.throws(() => atGame('mimic').play('open', {chest: 7}), /PET_BAD_ACTION/);
});

test('🔮 점쟁이 카드 (15층~): 행운 강화석 2 · 보통 물약 · 불운 the next battle starts with 10% less 체력', async () => {
  const {startTowerRun, petTowerStats} = await import('../api/_lib/petTower.js');
  const pick = (luck: string) => { const g = atGame('fortune', 16); const card = g.ev.game.cards.indexOf(luck); assert.deepEqual(g.view().game, {cards: 3}); return {g, r: g.play('pick', {card})}; };
  const good = pick('good'); assert.deepEqual([good.r.stone, good.r.game.success, good.r.game.reveal.cards.length], [2, true, 3]);
  const plain = pick('normal'); assert.equal(plain.r.potions, 1);
  const bad = pick('bad'); assert.deepEqual([bad.r.game.success, bad.r.game.debuff, bad.g.tp.debuffs], [false, 'curse', ['curse']]);
  bad.g.tp.floor = 17; startTowerRun(bad.g.t, bad.g.s, pool, NOW, seeded());
  const run = bad.g.tp.run!, full = petTowerStats(currentPet(bad.g.s), bad.g.tp).hp;
  assert.equal(run.hp, Math.round(full * 0.9)); assert.equal(bad.g.tp.debuffs, undefined, 'only the next battle'); assert.deepEqual(run.debuffs, ['curse']);
});

test('🐸 연잎 점프: three hops give a potion (not faster than a real try); a splash only passes the floor', () => {
  const g = atGame('lilypad');
  assert.throws(() => g.play('hop', {made: 3}, NOW + 500), /PET_BAD_ACTION/);
  const won = g.play('hop', {made: 3}, NOW + 4000);
  assert.deepEqual([won.game.success, won.potions], [true, 1]);
  const h = atGame('lilypad'), fell = h.play('hop', {made: 1}, NOW + 900);
  assert.deepEqual([fell.cleared, fell.game.success, fell.potions], [true, false, 0]);
});

test('🍄 버섯 징검다리: three meanings, three word mushrooms each; all right gives a potion, a wrong one goes to 오답 복습', () => {
  const g = atGame('mushroom'), secret = g.ev.game;
  const v = g.view().game; assert.deepEqual([v.step, v.steps, v.choices.length, 'answer' in v, 'qs' in v], [0, 3, 3, false, false]);
  assert.equal(v.choices[secret.qs[0].answer], secret.qs[0].word);
  for (let i = 0; i < 2; i++) assert.equal(g.play('step', {choice: g.ev.game.qs[i].answer}).game.step, i + 1);
  const won = g.play('step', {choice: g.ev.game.qs[2].answer});
  assert.deepEqual([won.game.success, won.potions, won.end.right, won.end.asked], [true, 1, 3, 3]);
  const h = atGame('mushroom'), q = h.ev.game.qs[0];
  const fell = h.play('step', {choice: (q.answer + 1) % 3});
  assert.deepEqual([fell.game.success, fell.potions, fell.end.wrongs.length, fell.end.wrongs[0].word], [false, 0, 1, q.word]);
});

test('🔊 메아리 동굴 (11층~): a heard word (no time limit) → its meaning, three in a row for a 강화석', () => {
  const g = atGame('echo', 12), secret = g.ev.game, v = g.view().game;
  assert.deepEqual([v.word, v.choices.length, 'prompt' in v, secret.qs[0].deadline], [secret.qs[0].word, 4, false, null]);
  assert.equal(v.choices[secret.qs[0].answer], secret.qs[0].meaning);
  for (let i = 0; i < 2; i++) g.play('step', {choice: g.ev.game.qs[i].answer});
  const won = g.play('step', {choice: g.ev.game.qs[2].answer});
  assert.deepEqual([won.game.success, won.stone], [true, 1]);
});

test('💡 수정 불빛 퍼즐 (11층~): a solvable 3×3 start; the server replays the presses (all lit within 10 → 강화석)', async () => {
  const {crystalPress, CRYSTAL} = await import('../api/_lib/towerGames.js');
  const g = atGame('crystal', 12), start: boolean[] = g.ev.game.start;
  assert.deepEqual(g.view().game, {cells: start, limit: CRYSTAL.limit});
  assert.ok(start.some(c => !c), 'some are dark');
  // solve by brute force over press sets (each cell pressed 0 or 1 times)
  let sol: number[] | null = null;
  for (let m = 0; m < 512 && !sol; m++) { const ps = [...Array(9).keys()].filter(i => m >> i & 1); if (ps.reduce((c, i) => crystalPress(c, i), start).every(Boolean)) sol = ps; }
  assert.ok(sol);
  assert.deepEqual([g.play('solve', {presses: sol}).game.success, g.tp.event], [true, null]);
  const h = atGame('crystal', 12);
  assert.equal(h.play('solve', {presses: []}).game.success, false);
  assert.throws(() => atGame('crystal', 12).play('solve', {presses: Array(11).fill(0)}), /PET_BAD_ACTION/);
});

test('🧭 신전 미로 (21층~): a solvable 5×5 maze, snakes off the way; the server walks the path through the walls', async () => {
  const {mazeStep, MAZE} = await import('../api/_lib/towerGames.js');
  const g = atGame('maze', 22), {walls, traps} = g.ev.game, n = MAZE.size;
  assert.deepEqual(g.view().game, {size: n, walls, traps});
  const prev = new Map<number, [number, string]>([[0, [-1, '']]]), queue = [0];
  while (queue.length) { const at = queue.shift()!; for (const d of ['U', 'R', 'D', 'L']) { const to = mazeStep(walls, at, d); if (to !== null && !prev.has(to)) { prev.set(to, [at, d]); queue.push(to); } } }
  const path: string[] = [], cells: number[] = [];
  for (let at = n * n - 1; at !== 0; at = prev.get(at)![0]) { path.unshift(prev.get(at)![1]); cells.push(at); }
  assert.ok(!cells.some(c => traps.includes(c)), 'the way has no snake');
  assert.equal(g.play('walk', {path}).game.success, true);
  assert.throws(() => atGame('maze', 22).play('walk', {path: ['U']}), /PET_BAD_ACTION/, 'off the board');
  const h = atGame('maze', 22), w0 = h.ev.game.walls[0], shut = w0 & 2 ? 'R' : w0 & 4 ? 'D' : null;
  if (shut) assert.throws(() => h.play('walk', {path: [shut]}), /PET_BAD_ACTION/, 'through a wall');
  assert.equal(atGame('maze', 22).play('walk', {path: []}).game.success, false, 'giving up');
});

test('⚖️ 황금 저울 (25층~): two weighings tell which side is lighter, then a guess (강화석 2 when right)', () => {
  const g = atGame('scale', 26), fake = g.ev.game.fake;
  assert.deepEqual(g.view().game, {coins: 9, history: [], left: 2});
  const groups = [[0, 1, 2], [3, 4, 5], [6, 7, 8]], inG = groups.findIndex(x => x.includes(fake));
  const first = g.play('weigh', {left: groups[0], right: groups[1]}).game.history[0].heavier;
  assert.equal(first, inG === 0 ? 'right' : inG === 1 ? 'left' : 'even');
  const grp = groups[inG];
  const second = g.play('weigh', {left: [grp[0]], right: [grp[1]]}).game;
  assert.equal(second.left, 0);
  const found = second.history[1].heavier === 'right' ? grp[0] : second.history[1].heavier === 'left' ? grp[1] : grp[2];
  assert.equal(found, fake, 'the classic way finds it');
  assert.throws(() => g.play('weigh', {left: [0], right: [1]}), /PET_BAD_ACTION/, 'only two weighings');
  const won = g.play('guess', {coin: found}); assert.deepEqual([won.game.success, won.stone], [true, 2]);
  const h = atGame('scale', 26);
  assert.throws(() => h.play('weigh', {left: [0, 1], right: [2]}), /PET_BAD_ACTION/, 'same number on each pan');
  assert.throws(() => h.play('weigh', {left: [0], right: [0]}), /PET_BAD_ACTION/, 'a coin on one pan only');
  assert.equal(h.play('guess', {coin: (h.ev.game.fake + 1) % 9}).game.success, false);
});

test('🏺 짝 맞추기 항아리 (21층~): four word·meaning pairs hidden in eight jars; all four within seven tries give 강화석 + 물약', () => {
  const g = atGame('jars', 22), cards = g.ev.game.cards;
  const v = g.view().game; assert.deepEqual([v.jars, v.open, v.found, v.triesLeft, 'cards' in v], [8, [], 0, 7, false]);
  const miss = [0, 1, 2, 3, 4, 5, 6, 7].find(b => b !== 0 && cards[b].pair !== cards[0].pair)!;
  const peek = g.play('flip', {a: 0, b: miss}).game.peek;
  assert.deepEqual([peek.match, peek.texts], [false, [cards[0].text, cards[miss].text]]);
  for (let p = 0; p < 3; p++) { const [a, b] = cards.map((c: any, i: number) => c.pair === p ? i : -1).filter((i: number) => i >= 0); const r = g.play('flip', {a, b}); assert.equal(r.game.peek.match, true); assert.equal(r.game.open.length, (p + 1) * 2); }
  const [a, b] = cards.map((c: any, i: number) => c.pair === 3 ? i : -1).filter((i: number) => i >= 0);
  assert.throws(() => g.play('flip', {a: cards.findIndex((c: any) => c.pair === 0), b: a}), /PET_BAD_ACTION/, 'an open pair can\'t be flipped');
  const won = g.play('flip', {a, b}); assert.deepEqual([won.game.success, won.stone, won.potions, won.end.right], [true, 1, 1, 4]);
  const h = atGame('jars', 22), hc = h.ev.game.cards, wrong = [1, 2, 3, 4, 5, 6, 7].find(b => hc[b].pair !== hc[0].pair)!;
  let last: any; for (let t = 0; t < 7; t++) last = h.play('flip', {a: 0, b: wrong});
  assert.deepEqual([last.game.success, last.cleared], [false, true]);
});

test('놀이에서 지면 디버프: 💧 젖음 −방어 · 😵 침침 −공격 · 🙉 멍멍 4초 막기 · 🐍 뱀독 · 😮‍💨 기운 빠짐 · 🌑 불운, the next battle only', async () => {
  const {startTowerRun, towerAct, towerAnswer, petTowerStats} = await import('../api/_lib/petTower.js');
  const {TOWER_DEBUFF_RULES, towerTaken, towerHit} = await import('../src/lib/petCatalog.js');
  const g = atGame('lilypad', 6), fell = g.play('hop', {made: 0}, NOW + 900);
  assert.deepEqual([fell.game.debuff, g.tp.debuffs, (publicTower(g.t, g.s, NOW) as any).debuffs], ['wet', ['wet'], ['wet']]);
  const fight = (debuff: any, floor = 6) => { const f = atGame('lilypad', floor); f.play('hop', {made: 0}, NOW + 900); f.tp.debuffs = [debuff]; f.tp.floor = floor + 1; startTowerRun(f.t, f.s, pool, NOW, seeded()); return f; };
  const wet = fight('wet'), run = wet.tp.run!, st = petTowerStats(currentPet(wet.s), wet.tp);
  assert.deepEqual(run.debuffs, ['wet']); assert.equal(wet.tp.debuffs, undefined);
  towerAct(wet.t, wet.s, 'attack', NOW, seeded()); towerAnswer(wet.t, wet.s, run.id, run.q!.answer, NOW, seeded());
  const hurt: any = towerAnswer(wet.t, wet.s, run.id, (run.q!.answer + 1) % 4, NOW, seeded());
  assert.equal(hurt.taken, Math.max(2, Math.round(towerTaken(run.monster.atk, st.def * TOWER_DEBUFF_RULES.def, false))));
  const deaf = fight('deafen'), dr = deaf.tp.run!;
  towerAct(deaf.t, deaf.s, 'attack', NOW, seeded()); towerAnswer(deaf.t, deaf.s, dr.id, dr.q!.answer, NOW, seeded());
  assert.equal(dr.q!.deadline! - NOW, 4000);
  const bit = fight('bitten'); assert.deepEqual(bit.tp.run!.foe!.dot, {name: '독', turns: TOWER_DEBUFF_RULES.dotTurns});
  const tired = fight('drained'); assert.equal(tired.tp.run!.mp, Math.round(tired.tp.run!.maxMp * TOWER_DEBUFF_RULES.mp));
  const dim = fight('dazzle'), dmr = dim.tp.run!, dst = petTowerStats(currentPet(dim.s), dim.tp);
  towerAct(dim.t, dim.s, 'attack', NOW, () => 0.5); const hit: any = towerAnswer(dim.t, dim.s, dmr.id, dmr.q!.answer, NOW, () => 0.5);
  assert.equal(hit.damage, Math.max(1, Math.round(towerHit(dst.atk * TOWER_DEBUFF_RULES.atk, dmr.monster.def))));
  void towerHit;
});

test('놀이마다 실패 디버프: 버섯 💧 · 메아리 🙉 · 수정 😵 · 미로 🐍/😮‍💨 · 저울 🌑 · 항아리 😵', async () => {
  const debuffOf = (r: any) => r.game.debuff;
  const m = atGame('mushroom'); assert.equal(debuffOf(m.play('step', {choice: (m.ev.game.qs[0].answer + 1) % 3})), 'wet');
  const e = atGame('echo', 12); assert.equal(debuffOf(e.play('step', {choice: (e.ev.game.qs[0].answer + 1) % 4})), 'deafen');
  assert.equal(debuffOf(atGame('crystal', 12).play('solve', {presses: []})), 'dazzle');
  assert.equal(debuffOf(atGame('maze', 22).play('walk', {path: []})), 'drained');
  const s = atGame('scale', 26); assert.equal(debuffOf(s.play('guess', {coin: (s.ev.game.fake + 1) % 9})), 'curse');
  const j = atGame('jars', 22), c = j.ev.game.cards, w = [1, 2, 3, 4, 5, 6, 7].find(b => c[b].pair !== c[0].pair)!;
  let last: any; for (let t = 0; t < 7; t++) last = j.play('flip', {a: 0, b: w}); assert.equal(debuffOf(last), 'dazzle');
  assert.equal(atGame('mimic').play('open', {chest: atGame('mimic').ev.game.mimic}).game.debuff, undefined, 'the mimic takes a potion instead');
});

test('🧭 신전 미로: hundreds of mazes — every one reaches the exit by a way with no snake (never blocked)', async () => {
  const {initGame, mazeStep, MAZE} = await import('../api/_lib/towerGames.js');
  const n = MAZE.size;
  for (let seed = 1; seed <= 400; seed++) {
    const {walls, traps} = initGame('maze', seeded(seed));
    assert.ok(traps.length <= MAZE.traps); // fewer when almost every cell is on the way
    assert.ok(!traps.includes(0) && !traps.includes(n * n - 1));
    const seen = new Set([0]), queue = [0];
    while (queue.length) { const at = queue.shift()!; for (const d of ['U', 'R', 'D', 'L']) { const to = mazeStep(walls, at, d); if (to !== null && !seen.has(to) && !traps.includes(to)) { seen.add(to); queue.push(to); } } }
    assert.ok(seen.has(n * n - 1), `maze ${seed} reaches the exit without a snake`);
    // walls agree on both sides (what one cell shows closed, its neighbour does too)
    for (let i = 0; i < n * n; i++) { if (i % n < n - 1) assert.equal(Boolean(walls[i] & 2), Boolean(walls[i + 1] & 8)); if (i < n * (n - 1)) assert.equal(Boolean(walls[i] & 4), Boolean(walls[i + n] & 1)); }
  }
});

test("🧊 얼음 철자 자물쇠 (31층~): the word's letters shuffled; spell it within two tries for 강화석 2, else ❄️ 손이 꽁꽁", () => {
  const g = atGame('icelock', 32), q = g.ev.game.q, v = g.view().game;
  assert.deepEqual([v.meaning, [...v.letters].sort().join(''), v.triesLeft, 'q' in v], [q.meaning, q.word.toLowerCase().split('').sort().join(''), 2, false]);
  assert.notEqual(v.letters.join(''), q.word.toLowerCase(), 'not already in order');
  const again = g.play('spell', {text: 'zzz'}); assert.deepEqual([again.game.wrong, again.game.triesLeft], [true, 1]);
  const won = g.play('spell', {text: q.word.toUpperCase()}); assert.deepEqual([won.game.success, won.stone], [true, 2]);
  const h = atGame('icelock', 32); h.play('spell', {text: 'aa'}); const lost = h.play('spell', {text: 'bb'});
  assert.deepEqual([lost.game.success, lost.game.debuff, lost.end.wrongs[0].word], [false, 'frozen', h.ev.game.q.word]);
});

test('디버프 쌓기: lost games in a row pile up (newest 3) and all hit the next battle; an older single debuff still counts', async () => {
  const {startTowerRun, petTowerStats} = await import('../api/_lib/petTower.js');
  const {TOWER_DEBUFF_RULES} = await import('../src/lib/petCatalog.js');
  const g = atGame('lilypad', 6); g.play('hop', {made: 0}, NOW + 900);
  for (const type of ['crystal', 'echo', 'lilypad'] as const) {
    g.tp.floor = 12; openTowerDoor(g.t, g.s, 'kid', pool, NOW, seeded(), 0, [type, 'monster', 'monster']);
    if (type === 'crystal') g.play('solve', {presses: []}); else if (type === 'echo') g.play('step', {choice: (g.tp.event!.game.qs[0].answer + 1) % 4}); else g.play('hop', {made: 0}, NOW + 900);
  }
  assert.deepEqual(g.tp.debuffs, ['dazzle', 'deafen', 'wet'], 'the newest three');
  g.tp.floor = 13; startTowerRun(g.t, g.s, pool, NOW, seeded());
  assert.deepEqual(g.tp.run!.debuffs, ['dazzle', 'deafen', 'wet']); assert.equal(g.tp.debuffs, undefined);
  const two = atGame('lilypad', 6); two.play('hop', {made: 3}, NOW + 4000); two.tp.debuffs = ['curse', 'curse']; two.tp.floor = 7; startTowerRun(two.t, two.s, pool, NOW, seeded());
  assert.equal(two.tp.run!.hp, Math.round(petTowerStats(currentPet(two.s), two.tp).hp * TOWER_DEBUFF_RULES.hp ** 2), 'the same kind counts twice');
  const old = atGame('lilypad', 6); old.play('hop', {made: 3}, NOW + 4000); (old.tp as any).debuff = 'drained'; old.tp.floor = 7; startTowerRun(old.t, old.s, pool, NOW, seeded());
  assert.deepEqual(old.tp.run!.debuffs, ['drained']);
});

test('⛸️ 미끄러운 얼음길 (31층~): every board can be crossed in 3–8 pushes; the server slides the pushes again', async () => {
  const {initGame, iceBest, iceSlide, ICEPATH} = await import('../api/_lib/towerGames.js');
  for (let seed = 1; seed <= 200; seed++) { const g = initGame('icepath', seeded(seed)); const b = iceBest(g.rocks); assert.ok(b !== null && b >= 3 && b <= 8, `board ${seed}`); assert.equal(b, g.best); }
  const g = atGame('icepath', 32), {rocks, best} = g.ev.game, n = ICEPATH.size;
  assert.deepEqual(g.view().game, {size: n, rocks, limit: best + ICEPATH.spare});
  // the shortest pushes, found by search
  const prev = new Map<number, [number, string]>([[0, [-1, '']]]), queue = [0];
  while (queue.length) { const at = queue.shift()!; for (const d of ['U', 'R', 'D', 'L']) { const to = iceSlide(rocks, at, d)!; if (!prev.has(to)) { prev.set(to, [at, d]); queue.push(to); } } }
  const moves: string[] = []; for (let at = n * n - 1; at !== 0; at = prev.get(at)![0]) moves.unshift(prev.get(at)![1]);
  const won = g.play('slide', {moves}); assert.deepEqual([won.game.success, won.stone, won.potions], [true, 1, 1]);
  const lost = atGame('icepath', 32).play('slide', {moves: []}); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'bruised']);
  assert.throws(() => atGame('icepath', 32).play('slide', {moves: Array(20).fill('U')}), /PET_BAD_ACTION/);
});

test('🎵 룬 따라 하기 (41층~): three rounds (3 → 4 → 5 runes), each shown then pressed back; a slip is 💫 마력 반동', () => {
  const g = atGame('runes', 42), seq = g.ev.game.seq;
  for (let r = 0; r < 2; r++) { const v = r === 0 ? g.view().game : g.view().game; assert.deepEqual(v.show, seq.slice(0, 3 + r)); assert.equal(g.play('repeat', {input: seq.slice(0, 3 + r)}).game.round, r + 1); }
  const won = g.play('repeat', {input: seq.slice(0, 5)}); assert.deepEqual([won.game.success, won.stone, won.potions], [true, 1, 1]);
  const h = atGame('runes', 42), wrong = h.ev.game.seq.slice(0, 3).map((x: number, i: number) => i === 2 ? (x + 1) % 4 : x);
  const lost = h.play('repeat', {input: wrong}); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'backlash']);
  assert.throws(() => atGame('runes', 42).play('repeat', {input: [0]}), /PET_BAD_ACTION/, 'the whole row at once');
});

test('📜 주문서 완성 (41층~): a wordbook sentence in shuffled pieces (a word\u2019s letters when there are none); two tries, 강화석 2 or 📜 주문 역류', () => {
  const s = initialPetState(NOW), t = initialTower(NOW); s.pets[0].chosen = true; currentPet(s).level = 40; openEntranceChest(t, s);
  const tp = towerPet(t, 1); tp.floor = 42; tp.best = 41;
  const withLines = {...pool, sentences: [{text: 'I like to read books.', meaning: '나는 책 읽기를 좋아한다.', chunked: 'I / like / to read / books.'}]} as any;
  openTowerDoor(t, s, 'kid', withLines, NOW, seeded(), 0, ['scroll', 'monster', 'monster']);
  const g = tp.event!.game, v = (publicTower(t, s, NOW).event as any).game;
  assert.deepEqual([g.sentence, v.meaning, v.pieces.length >= 3, v.triesLeft, 'text' in v], [true, '나는 책 읽기를 좋아한다.', true, 2, false]);
  const again = towerEvent(t, s, 'cast', {text: 'books read I'}, NOW, seeded()) as any; assert.equal(again.game.wrong, true);
  const won = towerEvent(t, s, 'cast', {text: 'i like to read books'}, NOW, seeded()) as any; assert.deepEqual([won.game.success, won.stone], [true, 2]);
  const w = atGame('scroll', 42), wg = w.ev.game; assert.equal(wg.sentence, false, 'no sentences: a word');
  assert.equal([...w.view().game.pieces].sort().join(''), wg.text.toLowerCase().split('').sort().join(''));
  w.play('cast', {text: 'x'}); const lost = w.play('cast', {text: 'y'});
  assert.deepEqual([lost.game.success, lost.game.debuff, lost.end.wrongs.length], [false, 'recoil', 1]);
});

test('🧪 물약 섞기 (45층~): two colours to brew from red·blue·yellow·white; both right give 물약 2 + 강화석, a wrong mix is 🤢 배탈', async () => {
  const {BREWS} = await import('../api/_lib/towerGames.js');
  const g = atGame('potions', 46), [a, b] = g.ev.game.targets; assert.notEqual(a, b);
  assert.deepEqual(g.view().game, {flasks: ['red', 'blue', 'yellow', 'white'], target: BREWS[a].name, round: 0, rounds: 2});
  const first = g.play('mix', {a: BREWS[a].pair[1], b: BREWS[a].pair[0]}); assert.deepEqual([first.game.made, first.game.target], [true, BREWS[b].name]);
  const won = g.play('mix', {a: BREWS[b].pair[0], b: BREWS[b].pair[1]}); assert.deepEqual([won.game.success, won.potions, won.stone], [true, 2, 1]);
  const h = atGame('potions', 46), want: readonly string[] = BREWS[h.ev.game.targets[0]].pair, other = ['red', 'blue', 'yellow', 'white'].find(f => !want.includes(f))!;
  const lost = h.play('mix', {a: want[0], b: other}); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'tummy']);
  assert.throws(() => atGame('potions', 46).play('mix', {a: 'red', b: 'red'}), /PET_BAD_ACTION/);
});

test('🔥 용암 돌다리 기억 (51층~): five rows, one safe stone each (shown, then hidden); all five give 강화석 2, a sinking stone is 🔥 화상', () => {
  const g = atGame('lavapath', 52), path = g.ev.game.path;
  assert.deepEqual(g.view().game, {rows: 5, cols: 3, path, peekMs: 2500});
  const won = g.play('cross', {cols: path}); assert.deepEqual([won.game.success, won.stone], [true, 2]);
  const h = atGame('lavapath', 52), p = h.ev.game.path;
  const lost = h.play('cross', {cols: [p[0], (p[1] + 1) % 3]}); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'burned']);
  assert.throws(() => atGame('lavapath', 52).play('cross', {cols: [atGame('lavapath', 52).ev.game.path[0]].slice(0, 0)}), /PET_BAD_ACTION/);
});

test('🌋 용암 탈출 (51층~): start, then five meanings → words within 20 s (server clock); four right escape for 강화석 2, else 🥵 그을림', () => {
  const g = atGame('lavarun', 52), qs = g.ev.game.qs;
  assert.deepEqual([g.view().game.started, 'prompt' in g.view().game], [false, false]);
  assert.throws(() => g.play('answer', {choice: 0}), /PET_BAD_ACTION/, 'not before the start');
  const started = g.play('start', {}, NOW).game; assert.deepEqual([started.started, started.msLeft, started.prompt], [true, 20000, qs[0].meaning]);
  g.play('answer', {choice: (qs[0].answer + 1) % 4}, NOW + 2000);
  for (let i = 1; i < 4; i++) assert.equal(g.play('answer', {choice: qs[i].answer}, NOW + 2000 + i * 1000).game.right, i);
  const won = g.play('answer', {choice: qs[4].answer}, NOW + 7000);
  assert.deepEqual([won.game.success, won.stone, won.end.right, won.end.wrongs.length], [true, 2, 4, 1]);
  const late = atGame('lavarun', 52); late.play('start', {}, NOW);
  const burnt = late.play('answer', {choice: late.ev.game.qs[0].answer}, NOW + 22000); assert.deepEqual([burnt.game.success, burnt.game.debuff], [false, 'scorched']);
  const two = atGame('lavarun', 52), q2 = two.ev.game.qs; two.play('start', {}, NOW);
  two.play('answer', {choice: (q2[0].answer + 1) % 4}, NOW + 1000);
  const out = two.play('answer', {choice: (q2[1].answer + 1) % 4}, NOW + 2000); assert.deepEqual([out.game.success, out.game.debuff], [false, 'scorched']);
});

test('Codex 반영: 용암 탈출 time-out ends the game; 용암 돌다리 stops sending the path after the peek; 귀가 멍멍 piled up shortens one block each', async () => {
  const r = atGame('lavarun', 52); r.play('start', {}, NOW);
  assert.throws(() => r.play('timeout', {}, NOW + 5000), /PET_BAD_ACTION/, 'not before the time is up');
  const over = r.play('timeout', {}, NOW + 20000); assert.deepEqual([over.cleared, over.game.success, over.game.debuff], [true, false, 'scorched']);
  const p = atGame('lavapath', 52); assert.ok(p.view().game.path);
  const hidden = p.play('hide'); assert.equal('path' in hidden.game, false); assert.equal('path' in p.view().game, false);
  const {startTowerRun, towerAct, towerAnswer} = await import('../api/_lib/petTower.js');
  const f = atGame('lilypad', 6); f.play('hop', {made: 3}, NOW + 4000); f.tp.debuffs = ['deafen', 'deafen']; f.tp.floor = 7; startTowerRun(f.t, f.s, pool, NOW, seeded());
  const run = f.tp.run!, rand = seeded(9); run.monster.hp = run.monster.max = 100000;
  const turn = () => { towerAct(f.t, f.s, 'attack', NOW, rand); towerAnswer(f.t, f.s, run.id, run.q!.answer, NOW, rand); const ms = run.q!.deadline! - NOW; towerAnswer(f.t, f.s, run.id, run.q!.answer, NOW, rand); return ms; };
  assert.deepEqual([turn(), turn(), turn()], [4000, 4000, 8000]);
});

test('🐚 진주 조개 섞기 (61층~): the pearl shown, six swaps of two places; the right shell gives 강화석 + 물약, an empty one is 🐚 조개에 물림', async () => {
  const {shellsEnd, SHELLS} = await import('../api/_lib/towerGames.js');
  assert.deepEqual([shellsEnd(0, [[0, 1], [1, 2]]), shellsEnd(0, [[0, 1], [1, 2], [0, 2]]), shellsEnd(2, [[0, 1]])], [2, 0, 2], 'the pearl follows its place');
  const g = atGame('shells', 62), {start, swaps} = g.ev.game, pearl = shellsEnd(start, swaps);
  assert.deepEqual(g.view().game, {shells: 3, start, swaps, ms: [...SHELLS.ms], peekMs: SHELLS.peekMs});
  assert.equal(swaps.length, 6); assert.ok(swaps.every(([a, b]: number[]) => a !== b && a >= 0 && b < 3));
  const after = NOW + SHELLS.peekMs + SHELLS.ms.reduce((a, b) => a + b, 0);
  assert.throws(() => g.play('pick', {shell: pearl}, NOW + 1000), /PET_BAD_ACTION/, 'not before the swaps could be watched');
  const won = g.play('pick', {shell: pearl}, after); assert.deepEqual([won.game.success, won.stone, won.potions], [true, 1, 1]);
  const h = atGame('shells', 62), p = shellsEnd(h.ev.game.start, h.ev.game.swaps);
  const lost = h.play('pick', {shell: (p + 1) % 3}, after); assert.deepEqual([lost.game.success, lost.game.debuff, lost.game.reveal], [false, 'clamped', {pearl: p}]);
  assert.ok(!new Set(Array.from({length: 300}, (_, i) => towerLayout(`u${i}`, 1, 60)).flat()).has('shells'), 'not before floor 61');
});

test('🫧 진주 거품 (61층~): four meanings, four word bubbles each; three popped right give 강화석 2; bubbles gone count as missed (오답 복습), two misses are 🫧 숨이 참', () => {
  const g = atGame('bubbles', 62), qs = g.ev.game.qs;
  assert.deepEqual(g.view().game, {step: 0, steps: 4, need: 3, right: 0, riseMs: 7000, prompt: qs[0].meaning, choices: qs[0].choices});
  assert.equal(g.play('gone', {}, NOW + 7000).game.last, false, 'floated away: a miss');
  for (let i = 1; i < 3; i++) assert.equal(g.play('pop', {choice: qs[i].answer}, NOW + 7000 + i * 1000).game.right, i);
  const won = g.play('pop', {choice: qs[3].answer}, NOW + 10_000);
  assert.deepEqual([won.game.success, won.stone, won.end.right, won.end.wrongs.length], [true, 2, 3, 1]);
  const h = atGame('bubbles', 62), q = h.ev.game.qs;
  h.play('pop', {choice: (q[0].answer + 1) % 4}, NOW + 500);
  const lost = h.play('gone', {}, NOW + 7500); assert.deepEqual([lost.game.success, lost.game.debuff, lost.end.wrongs.length], [false, 'breathless', 2]);
  assert.throws(() => atGame('bubbles', 62).play('pop', {choice: 9}), /PET_BAD_ACTION/);
});
test('🫧 진주 거품: the server keeps when each meaning began — `gone` too soon is refused, a pop after the bubbles floated away is a miss', () => {
  const g = atGame('bubbles', 62), qs = g.ev.game.qs;
  assert.throws(() => g.play('gone', {}, NOW + 1000), /PET_BAD_ACTION/, 'the bubbles are still rising');
  assert.equal(g.play('pop', {choice: qs[0].answer}, NOW + 9000).game.last, false, 'right word, but popped after they were gone');
  assert.throws(() => g.play('gone', {}, NOW + 9000 + 2000), /PET_BAD_ACTION/, 'the next meaning starts from that move');
  assert.equal(g.play('pop', {choice: qs[1].answer}, NOW + 9000 + 6000).game.right, 1, 'in time');
});
test('🫧 진주 거품 screen: a failed pop or gone unlocks that meaning again (a failed gone is sent again)', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/components/pet/TowerMiniGames.tsx', import.meta.url), 'utf8');
  assert.match(src, /send\(name, input\)\.then\(r => \{ if \(!r\) unlock\(\); \}, unlock\);/);
  assert.match(src, /done\.current = step - 1; if \(name === 'gone'\) retry\.current = window\.setTimeout/);
});

test('🌬️ 바람길 비행 (71층~): five ring heights from the server; all five (in a believable time) give 강화석 + 물약, a missed ring is 🌪️ 바람에 휘청', async () => {
  const {WINDPATH} = await import('../api/_lib/towerGames.js');
  const g = atGame('windpath', 72), rings = g.ev.game.rings;
  assert.deepEqual(g.view().game, {rings, spacingMs: WINDPATH.spacingMs});
  assert.ok(rings.length === 5 && rings.every((y: number) => y >= 0.25 && y <= 0.75));
  assert.throws(() => g.play('fly', {passed: 5}, NOW + 2000), /PET_BAD_ACTION/, 'too fast to be a flight');
  const won = g.play('fly', {passed: 5}, NOW + WINDPATH.minMs); assert.deepEqual([won.game.success, won.stone, won.potions], [true, 1, 1]);
  const lost = atGame('windpath', 72).play('fly', {passed: 2}, NOW + 3000); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'gust']);
  assert.ok(!new Set(Array.from({length: 300}, (_, i) => towerLayout(`u${i}`, 1, 70)).flat()).has('windpath'), 'not before floor 71');
});

test('⚡ 번개 빈칸 (71층~): three words with letters gone and letter tiles (the missing ones among them); two right give 강화석 2, two wrong are ⚡ 감전', () => {
  const g = atGame('blanks', 72), ws = g.ev.game.words;
  const missing = (w: any) => w.blanks.map((i: number) => String(w.q.word).toLowerCase()[i]);
  const v = g.view().game; assert.deepEqual([v.step, v.steps, v.need, v.meaning, v.tiles], [0, 3, 2, ws[0].q.meaning, ws[0].tiles]);
  assert.equal(v.pattern.filter((c: string | null) => c === null).length, ws[0].blanks.length);
  for (const w of ws) { assert.ok(w.blanks.length >= 1 && w.blanks.length <= 3); for (const c of missing(w)) assert.ok(w.tiles.includes(c), 'the missing letters are on the tiles'); }
  assert.throws(() => g.play('fill', {letters: ['a', 'b', 'c', 'd']}), /PET_BAD_ACTION/, 'as many letters as blanks');
  const wrong = missing(ws[0]).map((c: string) => c === 'z' ? 'y' : 'z');
  const first = g.play('fill', {letters: wrong}).game; assert.deepEqual([first.last, first.right], [{ok: false, word: ws[0].q.word}, 0]);
  g.play('fill', {letters: missing(ws[1])});
  const won = g.play('fill', {letters: missing(ws[2])}); assert.deepEqual([won.game.success, won.stone, won.end.right, won.end.wrongs.length], [true, 2, 2, 1]);
  const h = atGame('blanks', 72), hw = h.ev.game.words, bad = (w: any) => missing(w).map((c: string) => c === 'z' ? 'y' : 'z');
  h.play('fill', {letters: bad(hw[0])});
  const lost = h.play('fill', {letters: bad(hw[1])}); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'shocked']);
});

test('⭐ 한붓 별 그리기 (81층~): every figure can be drawn in one stroke; a full stroke gives 강화석 2, a stuck one is a try, two are 🌀 머리가 빙글', async () => {
  const {ONELINE, strokeDone} = await import('../api/_lib/towerGames.js');
  // each figure has a stroke (a search over the lines finds one)
  const strokeOf = (shape: number) => {
    const s = ONELINE.shapes[shape], go = (path: number[], used: Set<string>): number[] | null => {
      if (used.size === s.edges.length) return path;
      for (const [a, b] of s.edges) { const at = path[path.length - 1], k = `${Math.min(a, b)}-${Math.max(a, b)}`; if (used.has(k) || (a !== at && b !== at)) continue;
        const r = go([...path, a === at ? b : a], new Set([...used, k])); if (r) return r; }
      return null;
    };
    for (let n = 0; n < s.nodes.length; n++) { const r = go([n], new Set()); if (r) return r; }
    return null;
  };
  ONELINE.shapes.forEach((_, i) => { const st = strokeOf(i); assert.ok(st && strokeDone(i, st), `figure ${i} can be drawn`); });
  const g = atGame('oneline', 82), shape = g.ev.game.shape, s = ONELINE.shapes[shape];
  assert.deepEqual(g.view().game, {name: s.name, nodes: s.nodes, edges: s.edges, triesLeft: 2});
  const once = g.play('draw', {path: [s.edges[0][0], s.edges[0][1]]}).game; assert.deepEqual([once.wrong, once.triesLeft], [true, 1]);
  const won = g.play('draw', {path: strokeOf(shape)}); assert.deepEqual([won.game.success, won.stone], [true, 2]);
  const h = atGame('oneline', 82), hs = ONELINE.shapes[h.ev.game.shape], half = [hs.edges[0][0], hs.edges[0][1]];
  h.play('draw', {path: half}); const lost = h.play('draw', {path: half}); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'tangled']);
  assert.throws(() => atGame('oneline', 82).play('draw', {path: [99]}), /PET_BAD_ACTION/);
  assert.ok(!new Set(Array.from({length: 300}, (_, i) => towerLayout(`u${i}`, 1, 80)).flat()).has('oneline'), 'not before floor 81');
});

test('✨ 별자리 잇기 (81층~): a word\u2019s letters as stars (two more that don\u2019t belong); joined in order right twice give 강화석 2, two wrong are ✨ 별빛에 눈부심', () => {
  const g = atGame('stars', 82), ws = g.ev.game.words;
  const order = (w: any) => { const left = w.stars.map((_: any, i: number) => i); return [...w.word].map((c: string) => { const k = left.findIndex((i: number) => w.stars[i].c === c); return left.splice(k, 1)[0]; }); };
  const v = g.view().game; assert.deepEqual([v.step, v.steps, v.need, v.meaning, v.length, v.stars], [0, 3, 2, ws[0].q.meaning, ws[0].word.length, ws[0].stars]);
  for (const w of ws) assert.equal(w.stars.length, w.word.length + 2);
  assert.throws(() => g.play('trace', {stars: [0]}), /PET_BAD_ACTION/, 'as many stars as letters');
  const wrong = (w: any) => { const o = order(w); return [...o.slice(1), o[0]]; };
  const first = g.play('trace', {stars: wrong(ws[0])}).game;
  assert.deepEqual([first.right, first.last.word], [0, ws[0].q.word]);
  g.play('trace', {stars: order(ws[1])});
  const won = g.play('trace', {stars: order(ws[2])}); assert.deepEqual([won.game.success, won.stone, won.end.right], [true, 2, 2]);
  const h = atGame('stars', 82), hw = h.ev.game.words;
  h.play('trace', {stars: [...order(hw[0])].reverse()});
  const lost = h.play('trace', {stars: [...order(hw[1])].reverse()}); assert.deepEqual([lost.game.success, lost.game.debuff], [false, 'starstruck']);
});
test('🌬️ 바람길 screen: a failed result (or no answer) shows 결과 다시 보내기, which sends the same flight again', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/components/pet/TowerMiniGames.tsx', import.meta.url), 'utf8');
  assert.match(src, /send\('fly', \{ passed: run\.current\.passed \}\)\.then\(r => \{ if \(!r\) setUnsent\(true\); \}, \(\) => setUnsent\(true\)\);/);
  assert.match(src, /\{unsent && <button type="button" disabled=\{busy\} onClick=\{report\}[^>]*>결과 다시 보내기/);
});
