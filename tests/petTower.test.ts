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

test('tower words: 고등 students get the 고등 books, 초등 the 초등 ones, 중등 and unknown grades the 중등 ones', () => {
  assert.deepEqual([towerLevelFor('김하늘 (평촌고2)'), towerLevelFor('이바다 (평여중1)'), towerLevelFor('박구름 (중앙초5)'), towerLevelFor('최별')], ['high', 'middle', 'elementary', 'middle']);
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
  assert.equal(towerPet(t, 1).floor, 11, 'the climb goes on to the 수정 동굴');
  towerPet(t, 1).floor = PET_TOWER.floors + 1; towerPet(t, 1).run = null;
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
  assert.deepEqual((await readTowerSettings(f.db, admin)).middle, ['hard']);
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

test('tower books: up to three books per level, words from all, missed words filed under their own book; teachers play the 고등 books', async () => {
  const f = registrationFirestore(), admin = {admin: true, academyId: 'main', uid: 'admin'};
  for (const id of ['m1', 'm2', 'm3', 'm4', 'h1']) f.rows.set(`wordbooks/${id}`, {title: `책 ${id}`, category: 'word'});
  await saveTowerSettings(f.db, admin, {middle: ['m1', 'm2', 'm3', 'm4'], high: 'h1'});
  assert.deepEqual(await readTowerSettings(f.db, admin).then(r => [r.middle, r.high]), [['m1', 'm2', 'm3'], ['h1']], 'three at most');
  f.rows.set('users/kid3', {role: 'student'});
  assert.deepEqual((await towerBookFor(f.db, 'kid3')).books.map(b => b.id), ['m1', 'm2', 'm3'], 'all three are used');
  await saveTowerSettings(f.db, admin, {middle: ['m1', 'm2'], high: 'h1'});
  f.rows.set('users/kid', {role: 'student'}); f.rows.set('users/teach', {role: 'teacher'});
  assert.deepEqual((await towerBookFor(f.db, 'kid')).books.map(b => b.id), ['m1', 'm2'], 'no grade known: 중등 books');
  assert.deepEqual((await towerBookFor(f.db, 'teach')).books.map(b => b.id), ['h1'], 'a teacher: 고등 books');
  // 초등: its own books once set, the 중등 ones while it has none
  f.rows.set('users/young', {role: 'student', name: '박구름 (중앙초5)'});
  assert.deepEqual((await towerBookFor(f.db, 'young')).books.map(b => b.id), ['m1', 'm2'], '초등 with no books of its own: 중등 books');
  await saveTowerSettings(f.db, admin, {elementary: ['h1'], middle: ['m1', 'm2'], high: 'h1'});
  assert.deepEqual((await readTowerSettings(f.db, admin)).elementary, ['h1']);
  await saveTowerSettings(f.db, admin, {middle: ['m1'], high: 'h1'});
  assert.deepEqual((await readTowerSettings(f.db, admin)).elementary, ['h1'], 'an older screen leaving out 초등 keeps it');
  const {towerWrongsSessions} = await import('../api/_lib/petTower.js');
  const wrong = (w: string, b: string) => ({word: w, meaning: '뜻', userChoice: '', correctAnswer: '뜻', choices: [], quizSentence: '', wordbookId: b});
  const sessions = towerWrongsSessions('kid', {runId: 'r1', wrongs: [wrong('a', 'm1'), wrong('b', 'm2'), wrong('c', 'm1')], right: 2, asked: 5, wordbookId: 'm1', wordbookTitle: '책 m1 · 책 m2', startedAt: NOW, books: [{id: 'm1', title: '책 m1'}, {id: 'm2', title: '책 m2'}]}, NOW + 5000);
  assert.deepEqual(sessions.map(s => [s.id, s.data.wordbookId, s.data.incorrectAnswers.length, s.data.wordbookTitle]), [['tower_kid_r1', 'm1', 2, '채움의 탑 · 책 m1'], ['tower_kid_r1_1', 'm2', 1, '채움의 탑 · 책 m2']]);
  assert.ok(!('wordbookId' in sessions[0].data.incorrectAnswers[0]), 'the review entries keep their usual shape');
});

test('탑 4단계 skills: need the job, the level and MP; right = power × 공격, wrong = a glancing 30% and half the MP; 방패 막기 blocks; 치유 heals', () => {
  const {s, t} = ready(40); startTowerRun(t, s, pool, NOW, seeded());
  const run = () => towerPet(t, currentPet(s).slot).run!;
  assert.throws(() => towerAct(t, s, 'skill', NOW, seeded(), 'slash'), /TOWER_SKILL_LOCKED/);
  currentPet(s).job = 'swordsman';
  assert.throws(() => towerAct(t, s, 'skill', NOW, seeded(), 'smash'), /TOWER_SKILL_NOT_LEARNED/, 'Lv.60 skill');
  assert.throws(() => towerAct(t, s, 'skill', NOW, seeded(), 'fire'), /TOWER_SKILL_NOT_LEARNED/, 'another job');
  run().monster.hp = run().monster.max = 10_000; run().mp = 20;
  towerAct(t, s, 'skill', NOW, seeded(), 'slash');
  const hit = towerAnswer(t, s, run().id, right(t, s), NOW, seeded());
  assert.equal(hit.skill, 'slash'); assert.ok(hit.damage > 0);
  assert.equal(run().mp, 20 + 2 - 4, '+2 for the right word, −4 for 베기');
  towerAnswer(t, s, run().id, right(t, s), NOW, seeded()); // the monster's turn
  const mpBefore = run().mp;
  towerAct(t, s, 'skill', NOW, seeded(), 'slash');
  const miss = towerAnswer(t, s, run().id, (right(t, s) + 1) % 4, NOW, seeded());
  assert.deepEqual([miss.glancing, miss.damage < hit.damage, run().mp], [true, true, mpBefore - 2], 'a miss still hits a little and costs half the MP');
  towerAnswer(t, s, run().id, right(t, s), NOW, seeded());
  // 방패 막기: the next monster attack is blocked even with a wrong answer.
  towerAct(t, s, 'skill', NOW, seeded(), 'shield');
  const blocked = towerAnswer(t, s, run().id, (right(t, s) + 1) % 4, NOW, seeded());
  assert.deepEqual([blocked.shield, blocked.blocked], [true, true]);
  run().mp = 0;
  assert.throws(() => towerAct(t, s, 'skill', NOW, seeded(), 'slash'), /TOWER_NO_MP/);
});

test('탑 4단계 crits: only a weak-element skill can crit (×2), the first crit reveals the weakness; job weapons are tower gear', () => {
  const {s, t} = ready(200); currentPet(s).job = 'wizard'; currentPet(s).job2 = 'white_mage';
  s.inventory.push('ice_staff', 'dawn_scepter', 'ice_sword');
  const view: any = publicTower(t, s, NOW);
  assert.ok(view.gear.includes('ice_staff') && view.gear.includes('dawn_scepter') && !view.gear.includes('ice_sword'), 'only this pet’s job weapons');
  assert.deepEqual(view.skills.map((k: any) => k.id), ['fire', 'heal', 'ice_arrow', 'holy_light', 'thunder', 'star_storm', 'eclipse']);
  assert.equal(view.passive.name, '축복');
  startTowerRun(t, s, pool, NOW, seeded());
  const run = () => towerPet(t, currentPet(s).slot).run!;
  run().monster.kind = 'golem'; run().monster.hp = run().monster.max = 1_000_000; run().mp = 100;
  let crit: any = null;
  for (let i = 0; i < 40 && !crit; i++) {
    towerAct(t, s, 'skill', NOW, () => 0, 'fire');
    const r = towerAnswer(t, s, run().id, right(t, s), NOW, () => 0); // rand 0: always under the chance
    if (r.crit) crit = r;
    towerAnswer(t, s, run().id, right(t, s), NOW, () => 0);
  }
  assert.ok(crit, 'fire on a golem (weak to 화) crits');
  assert.deepEqual(crit.weakFound, {kind: 'golem', name: run().monster.name, element: '화'});
  assert.deepEqual(t.weakFound, ['golem']);
  assert.equal((publicTower(t, s, NOW) as any).run.weak, '화', 'shown once found');
  towerAct(t, s, 'skill', NOW, () => 0, 'ice_arrow');
  assert.equal(towerAnswer(t, s, run().id, right(t, s), NOW, () => 0).crit, undefined, '수 is not the golem’s weakness');
});

test('탑 5단계: 50 floors in zones of 10 with their monsters and bosses; boss treasures change with the job; floor 40 gives the job weapon', async () => {
  const { TOWER_ZONES, towerMonster, towerGearFor, towerZone, TOWER_WEAKNESS } = await import('../src/lib/petCatalog.js');
  assert.equal(PET_TOWER.floors, 50);
  assert.deepEqual(TOWER_ZONES.map(z => [z.from, z.to, z.boss.name]), [[1, 10, '고대 수문장 골렘'], [11, 20, '수정 여왕 거미'], [21, 30, '스핑크스'], [31, 40, '서리 용'], [41, 50, '대마도사']]);
  assert.equal(towerZone(25).name, '모래 신전');
  assert.ok(['crystal_slime', 'vampire_bat', 'cave_spider', 'golem', 'obsidian_golem'].includes(towerMonster(12).kind));
  assert.deepEqual([towerMonster(50).boss, towerMonster(50).name], [true, '대마도사']);
  const b10 = towerMonster(10); assert.deepEqual([b10.hp, b10.atk], [418, 60], 'floor 10 stays about as it was');
  for (const z of TOWER_ZONES) for (const m of [...z.monsters, z.boss]) assert.ok(TOWER_WEAKNESS[m.kind], `${m.name} has a weakness`);
  assert.deepEqual([towerGearFor('crystal_helm', null)?.name, towerGearFor('crystal_helm', 'swordsman')?.name, towerGearFor('crystal_helm', 'wizard')?.mp], ['수정 투구', '수정 기사 투구', 10]);
  // The floor-40 chest: the weapon for the pet's job (none yet: a 강화석).
  const { s, t } = ready(80); currentPet(s).job = 'wizard';
  const tp = towerPet(t, 1); tp.floor = 40; startTowerRun(t, s, pool, NOW, seeded());
  tp.run!.monster.hp = 1; towerAct(t, s, 'attack', NOW, seeded());
  const won: any = towerAnswer(t, s, tp.run!.id, right(t, s), NOW, seeded());
  assert.deepEqual(won.chest.gear.sort(), ['frost_staff', 'snow_boots']);
  assert.ok(publicTower(t, s, NOW).stats.mp > towerStats(80, [], {}).mp, '마법사 boots add 마력');
});


test('탑 5단계 도감: a monster is written down when first met (floor) and counted when beaten; shared by the pets; the shadow under one name', () => {
  const {s, t} = ready(30);
  startTowerRun(t, s, pool, NOW, seeded());
  const run = () => towerPet(t, currentPet(s).slot).run!, kind = run().monster.kind;
  assert.deepEqual(t.codex![kind], {name: run().monster.name, boss: false, first: 1, wins: 0, at: NOW});
  run().monster.hp = 1; towerAct(t, s, 'attack', NOW, seeded());
  assert.equal(towerAnswer(t, s, run().id, right(t, s), NOW, seeded()).won, true);
  assert.equal(t.codex![kind].wins, 1);
  openTowerDoor(t, s, 'u1', pool, NOW + 1, seeded(), 0, undefined, undefined); // floor 2: maybe a new monster, the old entry stays
  assert.deepEqual([t.codex![kind].first, t.codex![kind].wins], [1, 1]);
  towerPet(t, currentPet(s).slot).run = null; towerPet(t, currentPet(s).slot).event = null;
  openTowerDoor(t, s, 'u1', pool, NOW + 2, seeded(), 0, ['mirror', 'mirror', 'mirror']);
  assert.equal(t.codex!.shadow.name, '그림자');
  t.weakFound = ['sphinx'];
  const codex: any[] = (publicTower(t, s, NOW) as any).codex;
  assert.equal(codex[0].kind, kind, 'in the order met');
  assert.deepEqual(codex.at(-1), {kind: 'sphinx', name: null, hidden: true, boss: true, first: null, wins: null, weak: '수'}, 'a weakness found before the 도감 still shows (a boss not beaten: ???)');
  // a boss met but not beaten stays ??? (도감 and battle); beaten, its name shows
  const tp = towerPet(t, currentPet(s).slot); tp.run = null; tp.event = null; tp.floor = 10;
  startTowerRun(t, s, pool, NOW + 3, seeded());
  const view: any = publicTower(t, s, NOW);
  assert.deepEqual([view.run.monster.name, view.codex.find((x: any) => x.kind === 'gatekeeper').name, view.codex.find((x: any) => x.kind === 'gatekeeper').hidden], ['???', null, true]);
  tp.best = 10;
  assert.equal((publicTower(t, s, NOW) as any).codex.find((x: any) => x.kind === 'gatekeeper').name, '고대 수문장 골렘');
});

test('탑 5단계 명예의 전당: boss floors keep the first clear and the fewest attacks (all academies); nicknames read fresh, no uids; teachers not counted', async () => {
  const {hallUpdate} = await import('../api/_lib/petTowerHall.js');
  const e = (uid: string, attacks: number) => ({uid, attacks, at: NOW, pet: {} as any});
  const a = hallUpdate(null, e('a', 9))!;
  assert.deepEqual([a.first, a.fewest, a.records.first!.uid], [true, true, 'a']);
  assert.equal(hallUpdate(a.records, e('b', 9)), null, 'a tie keeps the earlier record');
  const b = hallUpdate(a.records, e('b', 7))!;
  assert.deepEqual([b.first, b.fewest, b.records.first!.uid, b.records.fewest!.uid], [false, true, 'a', 'b']);

  const f = registrationFirestore();
  const beatBoss = async (uid: string, attacks: number) => {
    const {s, t} = ready(60); s.background = 'forest_cabin'; currentPet(s).name = `펫${uid}`;
    const tp = towerPet(t, 1); tp.floor = 10; tp.best = 9;
    startTowerRun(t, s, pool, NOW, seeded());
    tp.run!.monster.hp = 1; towerAct(t, s, 'attack', NOW, seeded()); tp.run!.attacks = attacks;
    f.rows.set(`petStates/${uid}`, s); f.rows.set(`petTowers/${uid}`, t);
    const answer = tp.run!.q!.answer;
    let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
    await handlePet({method: 'POST', headers: {authorization: 'Bearer t'}, body: {action: 'tower-answer', runId: tp.run!.id, choice: answer}} as any, res, {verify: async () => ({uid}), db: () => f.db, generate: async () => '{}', now: () => NOW} as any);
    return out;
  };
  f.rows.set('users/kid', {}); f.rows.set('users/kid2', {}); f.rows.set('users/teach', {role: 'teacher'});
  f.rows.set('petGuild/kid', {nickname: '별빛 해달', warned: false});
  const first = await beatBoss('kid', 9);
  assert.deepEqual([first.result.won, first.result.hall], [true, {first: true, fewest: true}]);
  assert.deepEqual((await beatBoss('teach', 1)).result.hall, {first: false, fewest: true}, 'a teacher holds it in the hall with teachers');
  assert.deepEqual((await beatBoss('kid2', 6)).result.hall, {first: false, fewest: true});
  const saved = f.rows.get('petTowerHall/f10');
  assert.deepEqual([saved.first.uid, saved.fewest.uid, saved.first.pet.background, saved.first.pet.gear[0].id], ['kid', 'kid2', 'forest_cabin', 'apprentice_club']);
  const hallFor = async (uid: string, teachers = false) => { let out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0};
    await handlePet({method: 'POST', headers: {authorization: 'Bearer t'}, body: {action: 'tower-hall', teachers}} as any, res, {verify: async () => ({uid}), db: () => f.db, generate: async () => '{}', now: () => NOW} as any); return out.hall; };
  const hall = await hallFor('kid2', true), f10 = hall.floors.find((x: any) => x.floor === 10);
  assert.deepEqual([hall.teacherView, hall.withTeachers], [false, false], 'a student never gets the teachers’ records');
  assert.deepEqual([hall.floors.map((x: any) => x.floor), f10.boss, f10.first.nickname, f10.first.me, f10.fewest.nickname, f10.fewest.me, f10.fewest.attacks], [[10, 20, 30, 40, 50], '고대 수문장 골렘', '별빛 해달', false, '이름 없는 모험가', true, 7], 'six attacks before + the winning one');
  assert.ok(!JSON.stringify(hall).includes('"uid"'), 'no uids in the hall');
  assert.equal(hall.floors[1].first, null);
  assert.deepEqual(hall.floors.map((x: any) => x.boss), ['고대 수문장 골렘', null, null, null, null], 'a boss stays ??? until beaten');
  f.rows.set('users/new', {});
  assert.equal((await hallFor('new')).floors[0].boss, null, 'not beaten yet: the floor-10 boss is ??? too');
  f.rows.set('petGuild/kid2', {guildName: '구름빵', aliases: {1: '초록'}, aliasWarned: {}});
  assert.equal((await hallFor('kid2')).floors[0].fewest.nickname, '구름빵 · 초록', '원정대 이름 · 모험가 별칭 of the pet that won');
  const plain = await hallFor('teach'), withT = await hallFor('teach', true);
  assert.deepEqual([plain.teacherView, plain.withTeachers, plain.floors[0].fewest.attacks], [true, false, 7]);
  assert.deepEqual([withT.withTeachers, withT.floors[0].first.nickname, withT.floors[0].fewest.nickname, withT.floors[0].fewest.teacher, withT.floors[0].fewest.attacks], [true, '별빛 해달', '선생님', true, 2]);
});
