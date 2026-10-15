import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {currentPet, initialPetState} from '../api/_lib/pet.js';
import {initialTower, misspellings, openTowerDoor, towerEvent, towerLayout, towerBookFor, openEntranceChest, publicTower, readTowerSettings, saveTowerSettings, startTowerRun, towerAct, towerAnswer, towerLevelFor, towerPet} from '../api/_lib/petTower.js';
import {handlePet} from '../api/_lib/student/pet.js';
import {PET_TOWER, towerMonster, towerStats} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-16T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const words = Array.from({length: 20}, (_, i) => ({w: `word${i}`, m: `뜻${i}`}));
const pool = {words, wordbookId: 'hard', wordbookTitle: '중등 어려운 단어'};
const ready = (level = 30) => { const s = initialPetState(NOW), t = initialTower(NOW); currentPet(s).level = level; s.pets[0].chosen = true; openEntranceChest(t, s); return {s, t}; };
const right = (t: any, s: any) => towerPet(t, currentPet(s).slot).run!.q!.answer;

test('tower words: 고등 students get the 고등 book; 중등, 초등 and unknown grades get the 중등 book', () => {
  assert.deepEqual([towerLevelFor('김하늘 (평촌고2)'), towerLevelFor('이바다 (평여중1)'), towerLevelFor('박구름 (중앙초5)'), towerLevelFor('최별')], ['high', 'middle', 'middle', 'middle']);
});

test('tower: the entrance chest first (견습 몽둥이 + potions); entering costs 기운; stats come from level and gear', () => {
  const s = initialPetState(NOW), t = initialTower(NOW);
  assert.throws(() => startTowerRun(t, s, pool, NOW), /TOWER_CHEST_FIRST/);
  const {chest} = openEntranceChest(t, s);
  assert.deepEqual([chest.gear, chest.potions, towerPet(t, 1).equip.weapon], [['apprentice_club'], PET_TOWER.startPotions, 'apprentice_club']);
  assert.throws(() => openEntranceChest(t, s), /TOWER_CHEST_OPENED/);
  startTowerRun(t, s, pool, NOW, seeded());
  assert.equal(currentPet(s).energy, 100 - PET_TOWER.energy);
  const run = towerPet(t, 1).run!;
  assert.equal(run.maxHp, towerStats(1, [{id: 'apprentice_club', name: '', short: '', slot: 'weapon', icon: '', atk: 6}]).hp);
  assert.equal(publicTower(t, s, NOW).stats.atk, 10 + 2 + 6, 'level 1 + the club');
  const tired = initialPetState(NOW), tt = initialTower(NOW); openEntranceChest(tt, tired); currentPet(tired).energy = 0;
  assert.throws(() => startTowerRun(tt, tired, pool, NOW), /PET_EXHAUSTED/);
});

test('tower battle: a right word hits; the monster then attacks — blocking in time takes less than a wrong or late answer', () => {
  const {s, t} = ready(1); startTowerRun(t, s, pool, NOW, seeded());
  const run = towerPet(t, 1).run!, start = run.monster.hp;
  towerAct(t, s, 'attack', NOW, seeded());
  assert.equal(publicTower(t, s, NOW).run!.q!.choices.length, 4);
  assert.ok(!('answer' in (publicTower(t, s, NOW).run!.q as any)), 'the answer stays on the server');
  const hit = towerAnswer(t, s, run.id, right(t, s), NOW, seeded());
  assert.ok(hit.correct && hit.damage > 0 && towerPet(t, 1).run!.monster.hp === start - hit.damage);
  assert.equal(towerPet(t, 1).run!.phase, 'defend');
  assert.equal(publicTower(t, s, NOW).run!.q!.msLeft, PET_TOWER.defendSeconds * 1000);
  const blocked = towerAnswer(t, s, run.id, right(t, s), NOW + 2000, seeded());
  towerAct(t, s, 'attack', NOW, seeded()); towerAnswer(t, s, run.id, (right(t, s) + 1) % 4, NOW, seeded());
  const late = towerAnswer(t, s, run.id, right(t, s), NOW + 60_000, seeded());
  assert.ok(blocked.correct && !late.correct && late.late && blocked.taken < late.taken, `${blocked.taken} < ${late.taken}`);
  assert.equal(towerPet(t, 1).run!.wrongs.length, 2, 'the missed attack word and the late answer go to 오답 복습');
  assert.throws(() => towerAnswer(t, s, run.id, 0, NOW, seeded()), /TOWER_NO_RUN/, 'no question waiting');
});

test('tower: winning saves the floor and pays the first clear once; losing keeps the floor; running away empties 기운', () => {
  const {s, t} = ready(60);
  const play = (floor: number) => { startTowerRun(t, s, pool, NOW, seeded(floor)); let r: any;
    for (let i = 0; i < 60 && towerPet(t, 1).run; i++) { const run = towerPet(t, 1).run!; if (run.phase === 'act') towerAct(t, s, 'attack', NOW, seeded()); r = towerAnswer(t, s, run.id, right(t, s), NOW, seeded()); }
    return r; };
  const first = play(1);
  assert.deepEqual([first.won, first.floor, first.first, first.points > 0, towerPet(t, 1).floor, towerPet(t, 1).best], [true, 1, true, true, 2, 1]);
  for (let f = 2; f <= 9; f++) { currentPet(s).energy = 100; play(f); }
  currentPet(s).energy = 100;
  const boss = play(10);
  assert.deepEqual([boss.won, boss.chest?.gear, towerPet(t, 1).equip.shoulder], [true, ['golem_pauldron'], 'golem_pauldron'], 'the floor-10 boss guards a chest');
  assert.throws(() => startTowerRun(t, s, pool, NOW), /TOWER_TOP/);
  // Losing: a weak pet at floor 9.
  const weak = ready(1); towerPet(weak.t, 1).floor = 9; startTowerRun(weak.t, weak.s, pool, NOW, seeded());
  let out: any; for (let i = 0; i < 40 && towerPet(weak.t, 1).run; i++) { const run = towerPet(weak.t, 1).run!; if (run.phase === 'act') towerAct(weak.t, weak.s, 'attack', NOW, seeded()); out = towerAnswer(weak.t, weak.s, run.id, (right(weak.t, weak.s) + 1) % 4, NOW, seeded()); }
  assert.deepEqual([out.lost, towerPet(weak.t, 1).floor], [true, 9], 'lost: the same floor again');
  const flee = ready(); startTowerRun(flee.t, flee.s, pool, NOW, seeded());
  const r = towerAct(flee.t, flee.s, 'flee', NOW);
  assert.deepEqual([r.fled, currentPet(flee.s).energy, towerPet(flee.t, 1).floor, towerPet(flee.t, 1).run], [true, 0, 1, null]);
  assert.throws(() => towerAct(ready().t, ready().s, 'skill', NOW), /TOWER_NO_RUN/);
});

test('tower monsters: floors grow stronger, floor 10 is a boss', () => {
  assert.ok(towerMonster(9).hp > towerMonster(1).hp && towerMonster(9).atk > towerMonster(1).atk);
  assert.equal(towerMonster(10).boss, true);
});

test('tower API: words from the admin-set book; the battle runs on the server; missed words reach 오답 복습; settings are admin only', async () => {
  const f = registrationFirestore();
  const s = initialPetState(NOW); s.pets[0].chosen = true; currentPet(s).level = 40; f.rows.set('petStates/kid', s);
  f.rows.set('users/kid', {notionStudentKey: '11111111-1111-4111-8111-111111111111'});
  await assert.rejects(() => towerBookFor(f.db, 'kid'), /TOWER_NOT_READY/, 'no book set yet');
  f.rows.set('wordbooks/hard', {title: '중등 어려운 단어', category: 'word'});
  words.forEach((w, i) => f.rows.set(`wordbooks/hard/words/w${String(i).padStart(2, '0')}`, {word: w.w, meaning: w.m}));
  const admin = {admin: true, academyId: 'main', uid: 'admin'};
  await assert.rejects(() => saveTowerSettings(f.db, {admin: false, principal: true, academyId: 'main'}, {middle: 'hard'}), /FORBIDDEN/);
  await saveTowerSettings(f.db, admin, {middle: 'hard', high: ''});
  assert.deepEqual((await readTowerSettings(f.db, admin)).middle, 'hard');
  const call = async (body: any) => { let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
    await handlePet({method: 'POST', headers: {authorization: 'Bearer t'}, body} as any, res, {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{}', now: () => NOW, towerPool: async (db: any, uid: string) => ({words, ...await towerBookFor(db, uid)})} as any); return out; };
  assert.equal((await call({action: 'tower-start'})).error, 'TOWER_CHEST_FIRST');
  assert.equal((await call({action: 'tower-chest'})).tower.equip.weapon, 'apprentice_club');
  const started = await call({action: 'tower-start'});
  assert.deepEqual([started.ok, started.tower.run.floor, started.tower.run.phase], [true, 1, 'act']);
  const attack = await call({action: 'tower-act', move: 'attack'});
  const runId = attack.tower.run.id, answer = f.rows.get('petTowers/kid').pets['1'].run.q.answer;
  const missed = await call({action: 'tower-answer', runId, choice: (answer + 1) % 4});
  assert.deepEqual([missed.result.correct, typeof missed.result.answer], [false, 'number'], 'the answer is shown after answering');
  assert.equal(missed.result.end, undefined, 'internal battle data stays on the server');
  const fled = await call({action: 'tower-act', move: 'defend-skip'});
  assert.equal(fled.error, 'TOWER_WAIT');
  const q = f.rows.get('petTowers/kid').pets['1'].run.q;
  await call({action: 'tower-answer', runId, choice: q.answer});
  const away = await call({action: 'tower-act', move: 'flee'});
  assert.deepEqual([away.result.fled, away.state.pets[0].energy], [true, 0]);
  const [sessionKey, session] = [...f.rows.entries()].find(([k]) => k.startsWith('studySessions/')) || [];
  assert.equal(sessionKey, `studySessions/tower_kid_${runId}`, 'one session per battle (its run id), saved with the battle end');
  assert.ok(session && session.uid === 'kid' && session.incorrectAnswers.length === 1 && session.wordbookTitle.startsWith('채움의 탑'));
});

test('tower doors: three doors a floor, a different monster behind each (same strength); the door number is kept in range', () => {
  const kinds = [0, 1, 2].map(d => towerMonster(3, d));
  assert.equal(new Set(kinds.map(k => k.kind)).size, 3);
  assert.ok(kinds.every(k => k.hp === kinds[0].hp && k.atk === kinds[0].atk));
  const {s, t} = ready(); startTowerRun(t, s, pool, NOW, seeded(), 9);
  assert.equal(towerPet(t, 1).run!.monster.kind, towerMonster(1, 2).kind, 'door 9 → the last door');
});

const open = (t: any, s: any, type: string) => openTowerDoor(t, s, 'kid', pool, NOW, seeded(), 0, [type as any, 'monster', 'monster']);

test("tower doors: each pet's floor has a fixed layout (the same on a retry), different for other students and floors", () => {
  assert.deepEqual(towerLayout('kid', 1, 3), towerLayout('kid', 1, 3));
  const many = Array.from({length: 30}, (_, f) => towerLayout('kid', 1, f + 1).join()), others = Array.from({length: 30}, (_, f) => towerLayout('other', 1, f + 1).join());
  assert.ok(new Set(many).size > 10 && many.join() !== others.join());
  const all = new Set(Array.from({length: 200}, (_, i) => towerLayout(`u${i}`, 1, 1)).flat());
  assert.ok(['monster', 'treasure', 'merchant', 'mirror', 'riddle', 'sleeping', 'trap', 'fairy'].every(e => all.has(e as any)), 'every event shows up');
});

test("tower events: treasure clears at once; 거울방 is a battle with the pet's shadow; the fairy can be saved or fought", () => {
  let {s, t} = ready(20); const r: any = open(t, s, 'treasure');
  assert.deepEqual([r.opened, r.cleared, towerPet(t, 1).floor], ['treasure', true, 2]);
  ({s, t} = ready(20)); open(t, s, 'mirror');
  assert.deepEqual([towerPet(t, 1).run!.monster.kind, towerPet(t, 1).run!.monster.name], ['shadow', `${currentPet(s).name}의 그림자`]);
  ({s, t} = ready(20)); open(t, s, 'fairy'); const potions = towerPet(t, 1).potions;
  const saved: any = towerEvent(t, s, 'save', {}, NOW);
  assert.deepEqual([saved.cleared, towerPet(t, 1).potions, towerPet(t, 1).event], [true, potions + 1, null]);
  ({s, t} = ready(80)); open(t, s, 'fairy'); towerEvent(t, s, 'fight', {}, NOW);
  const run = towerPet(t, 1).run!; assert.equal(run.monster.kind, 'fairy');
  const before = towerPet(t, 1).potions; let out: any;
  for (let i = 0; i < 30 && towerPet(t, 1).run; i++) { const rr = towerPet(t, 1).run!; if (rr.phase === 'act') towerAct(t, s, 'attack', NOW, seeded()); out = towerAnswer(t, s, rr.id, right(t, s), NOW, seeded()); }
  assert.deepEqual([out.won, out.potions, towerPet(t, 1).potions], [true, 2, before + 2], 'fighting the fairy pays two potions');
});

test('tower merchant: 강화석 and potions for points; 강화 succeeds or only uses up the stones (the gear never breaks)', () => {
  const {s, t} = ready(20); s.points = 500; open(t, s, 'merchant');
  const stock = towerPet(t, 1).event!.stock.stone;
  towerEvent(t, s, 'buy', {item: 'stone'}, NOW);
  assert.deepEqual([s.points, towerPet(t, 1).stones, towerPet(t, 1).event!.stock.stone], [380, 1, stock - 1]);
  towerEvent(t, s, 'buy', {item: 'potion'}, NOW); assert.equal(s.points, 340);
  s.points = 10; assert.throws(() => towerEvent(t, s, 'buy', {item: 'potion'}, NOW), /PET_NOT_ENOUGH_POINTS/);
  const ok: any = towerEvent(t, s, 'enhance', {gearId: 'apprentice_club'}, NOW, () => 0.1);
  assert.deepEqual([ok.enhanced, towerPet(t, 1).levels!.apprentice_club, towerPet(t, 1).stones], [true, 1, 0]);
  assert.equal(publicTower(t, s, NOW).stats.atk, 10 + 40 + 6 + 2, '+1 club: +2 공격');
  assert.throws(() => towerEvent(t, s, 'enhance', {gearId: 'apprentice_club'}, NOW), /TOWER_NO_STONES/);
  towerPet(t, 1).stones = 1;
  const fail: any = towerEvent(t, s, 'enhance', {gearId: 'apprentice_club'}, NOW, () => 0.99);
  assert.deepEqual([fail.enhanced, towerPet(t, 1).levels!.apprentice_club, towerPet(t, 1).stones, towerPet(t, 1).gear.includes('apprentice_club')], [false, 1, 0, true]);
  const left: any = towerEvent(t, s, 'leave', {}, NOW);
  assert.deepEqual([left.cleared, towerPet(t, 1).floor, towerPet(t, 1).event], [true, 2, null]);
});

test('tower riddle, trap and sleeping monster: a right answer gives a 강화석; a trap or a woken monster starts a battle', () => {
  assert.equal(misspellings('ambiguous', seeded()).length, 3);
  assert.ok(!misspellings('ambiguous', seeded()).includes('ambiguous'));
  let {s, t} = ready(20); open(t, s, 'riddle');
  const q = towerPet(t, 1).event!.q!; assert.equal(q.choices.filter(c => c === q.word).length, 1);
  const solved: any = towerEvent(t, s, 'answer', {choice: q.answer}, NOW);
  assert.deepEqual([solved.correct, solved.stone, solved.cleared, towerPet(t, 1).stones], [true, 1, true, 1]);
  ({s, t} = ready(20)); open(t, s, 'riddle'); const rq = towerPet(t, 1).event!.q!;
  const missed: any = towerEvent(t, s, 'answer', {choice: (rq.answer + 1) % 4}, NOW);
  assert.deepEqual([missed.correct, missed.cleared, missed.end.wrongs.length], [false, true, 1], 'a wrong riddle still passes, the word goes to 오답 복습');
  ({s, t} = ready(20)); open(t, s, 'trap');
  const late: any = towerEvent(t, s, 'answer', {choice: towerPet(t, 1).event!.q!.answer}, NOW + 60_000);
  assert.deepEqual([late.late, late.trapped, towerPet(t, 1).run!.hp < towerPet(t, 1).run!.maxHp, towerPet(t, 1).run!.wrongs.length], [true, true, true, 1]);
  ({s, t} = ready(20)); open(t, s, 'sleeping');
  const walk = Array.from({length: 40}, (_, i) => [i * 100, Math.min(1, i / 36)]); // ~3.6 s, a slow walk to the exit
  assert.throws(() => towerEvent(t, s, 'sneak', {ok: true, samples: walk}, NOW + 1000), /TOWER_SNEAK_INVALID/, 'too soon on the server clock');
  assert.throws(() => towerEvent(t, s, 'sneak', {ok: true}, NOW + 4000), /TOWER_SNEAK_INVALID/, 'no path: no pass');
  assert.throws(() => towerEvent(t, s, 'sneak', {ok: true, samples: walk.map(([ms, p]) => [ms / 3, p])}, NOW + 4000), /TOWER_SNEAK_INVALID/, 'too fast');
  assert.throws(() => towerEvent(t, s, 'sneak', {ok: true, samples: Array.from({length: 10}, (_, i) => [i * 400, 0.9])}, NOW + 4000), /TOWER_SNEAK_INVALID/, 'standing at the exit is not a walk');
  assert.throws(() => towerEvent(t, s, 'sneak', {ok: true, samples: [[0, 0], ...Array.from({length: 10}, (_, i) => [400 + i * 400, 0.9])]}, NOW + 4000), /TOWER_SNEAK_INVALID/, 'one jump to the exit');
  const sneaked: any = towerEvent(t, s, 'sneak', {ok: true, samples: walk}, NOW + 4000);
  assert.deepEqual([sneaked.cleared, towerPet(t, 1).stones], [true, 1]);
  ({s, t} = ready(20)); open(t, s, 'sleeping'); towerEvent(t, s, 'sneak', {ok: false}, NOW);
  const dragon = towerPet(t, 1).run!.monster;
  assert.deepEqual([dragon.kind, dragon.hp, dragon.atk], ['dragon', PET_TOWER.dragon.hp, PET_TOWER.dragon.atk], 'woken: the end-game dragon');
  assert.equal(typeof dragon.color, 'number');
  assert.equal(publicTower(t, s, NOW).event, null);
});

test('tower public view never shows what is behind unopened doors or the event answers', () => {
  const {s, t} = ready(20); open(t, s, 'riddle');
  const view: any = publicTower(t, s, NOW);
  assert.equal(view.event.type, 'riddle'); assert.ok(!('answer' in view.event.q) && !('pool' in view.event));
  assert.ok(!JSON.stringify(view).includes('monster","monster'));
});

test('tower: a resent door request gets the same answer (no second 기운 or reward); the dragon is too strong for a young pet', () => {
  const {s, t} = ready(20);
  const first: any = openTowerDoor(t, s, 'kid', pool, NOW, seeded(), 0, ['treasure', 'monster', 'monster'], 'req-123456');
  const energy = currentPet(s).energy, floor = towerPet(t, 1).floor;
  const again: any = openTowerDoor(t, s, 'kid', pool, NOW, seeded(), 0, ['treasure', 'monster', 'monster'], 'req-123456');
  assert.deepEqual([again.replayed, again.cleared, currentPet(s).energy, towerPet(t, 1).floor], [true, first.cleared, energy, floor]);
  const young = ready(30); open(young.t, young.s, 'sleeping'); towerEvent(young.t, young.s, 'sneak', {ok: false}, NOW);
  const run = towerPet(young.t, 1).run!; towerAct(young.t, young.s, 'attack', NOW, seeded());
  const hit: any = towerAnswer(young.t, young.s, run.id, right(young.t, young.s), NOW, seeded());
  assert.ok(hit.damage <= 2, `a Lv.30 pet barely scratches it (${hit.damage})`);
});
