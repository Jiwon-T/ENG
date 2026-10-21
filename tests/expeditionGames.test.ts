import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { initialPetState } from '../api/_lib/pet.ts';
import { answerRun, buildRun, initialGameState, publicRun, runSummary, type FeedSentence, type FeedSource } from '../api/_lib/petWordFeed.ts';
import { readExpeditionSettings, saveExpeditionSettings, sentenceGradeFor } from '../api/_lib/petSentences.ts';
import { stageGame, stageHasSound, stageWithSentences } from '../src/lib/petCatalog.ts';

const NOW = Date.parse('2026-10-16T03:00:00Z');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const WORDS = ['apple', 'river', 'mountain', 'courage', 'journey', 'whisper', 'garden', 'bridge', 'candle', 'forest', 'island', 'letter', 'mirror', 'pencil', 'rocket', 'silver'];
const source: FeedSource = { books: [{ id: 'b1', words: WORDS.map((w, i) => ({ wordbookId: 'b1', wordId: `w${i}`, word: w, meaning: `뜻${i}` })) }], wrongs: [] };
const sentences: FeedSentence[] = Array.from({ length: 6 }, (_, i) => ({ wordbookId: 's1', text: `I want to be a doctor number ${i}.`, chunked: `I want / to be / a doctor number ${i}.`, meaning: `해석 ${i}` }));

test('원정대 stages: 1 단어 먹이, 2 철자, 3 듣고 고르기 (4장부터 문장 배열), 4 짝 맞추기, 👑 섞어서; sound and sentences by stage', () => {
  assert.deepEqual(['forest-1', 'forest-2', 'forest-3', 'forest-4', 'forest-5', 'desert-3', 'desert-5', null].map(stageGame), ['meaning', 'spell', 'listen', 'match', 'mix', 'order', 'mix', 'meaning']);
  assert.deepEqual(['forest-3', 'forest-5', 'desert-3', 'forest-2'].map(stageHasSound), [true, true, false, false]);
  assert.deepEqual(['forest-5', 'desert-5', 'desert-3', 'snow-2'].map(stageWithSentences), [false, true, true, false]);
});

test('원정대 games (server-graded): 철자 and 문장 배열 tries (3, answer hidden until then), 짝 맞추기 picks checked one by one, 낭독 pays no points', () => {
  const pet = initialPetState(NOW), g = initialGameState(NOW);
  g.run = buildRun(source, [], NOW, seeded(), 'forest-2', 6, { game: 'spell' });
  assert.ok(g.run!.questions.every(q => q.type === 'spell' && q.meaning && q.hint && q.letters));
  const view: any = publicRun(g.run)!.questions[0];
  assert.deepEqual([view.word, view.letters.join('') === g.run!.questions[0].word.slice(2)], ['', false], 'the word is not sent; the letters are shuffled');
  const q0 = g.run!.questions[0];
  assert.equal(answerRun(g, pet, g.run!.id, 0, { text: q0.word.toUpperCase() }).correct, true);
  const t1: any = answerRun(g, pet, g.run!.id, 1, { text: 'wrong' });
  assert.deepEqual([t1.pending, t1.triesLeft, g.run!.results.length], [true, 2, 1], 'a wrong try is not an answer yet');
  answerRun(g, pet, g.run!.id, 1, { text: 'wrong' });
  assert.equal(answerRun(g, pet, g.run!.id, 1, { text: 'wrong' }).correct, false, 'the third wrong try ends it');
  assert.ok((publicRun(g.run)!.questions[1] as any).word, 'the answer shows once answered');
  assert.equal(g.run!.questions.filter(q => q.retry).length, 1, 'a missed word comes back later');

  g.rewardedToday = [];
  g.run = buildRun(source, [], NOW, seeded(), 'forest-4', 12, { game: 'match' });
  assert.equal(g.run!.questions.length, 3);
  const board = g.run!.questions[0], shown = (w: number) => board.meaningOrder!.indexOf(w);
  assert.throws(() => answerRun(g, pet, g.run!.id, 0, { pick: [9, 0] }), /FEED_BAD_CHOICE/);
  const wrongPick: any = answerRun(g, pet, g.run!.id, 0, { pick: [0, shown(1)] });
  assert.deepEqual([wrongPick.pending, wrongPick.correct, wrongPick.mistakes], [true, false, 1]);
  const before = pet.points;
  for (const w of [0, 1, 2]) assert.equal(answerRun(g, pet, g.run!.id, 0, { pick: [w, shown(w)] }).pending, true);
  const last: any = answerRun(g, pet, g.run!.id, 0, { pick: [3, shown(3)] });
  assert.deepEqual([last.pending, last.correct, pet.points - before], [undefined, true, 20], 'one slip passes; the board pays its 4 pairs');
  const v: any = publicRun(g.run)!.questions[1];
  assert.equal(v.pairs, undefined, 'pairs are not sent'); assert.equal(v.meanings.length, 4);

  g.run = buildRun(source, [], NOW, seeded(), 'desert-3', 12, { game: 'order', sentences });
  const o: any = publicRun(g.run)!.questions[0];
  assert.deepEqual([o.word, o.chunked, o.pieces.length >= 3], ['', undefined, true], 'only the shuffled pieces');
  const s0 = g.run!.questions[0];
  assert.equal(answerRun(g, pet, g.run!.id, 0, { text: s0.word.replace('.', ' .') }).correct, true, 'spacing and marks may differ');
  assert.equal((answerRun(g, pet, g.run!.id, 1, { text: 'doctor want I' }) as any).pending, true);

  g.run = buildRun(source, [], NOW, seeded(), 'desert-5', 12, { game: 'mix', sentences });
  const ri = g.run!.questions.findIndex(q => q.type === 'read'); g.run!.results = g.run!.questions.slice(0, ri).map(() => ({ choice: -1, correct: true, points: 0 }));
  const p0 = pet.points; assert.equal(answerRun(g, pet, g.run!.id, ri, { correct: true }).points, 0); assert.equal(pet.points, p0, '낭독 counts for the stars, not points');
});

test('원정대 games: quiet places and no microphone swap the sound questions; no sentences → word games; the crown mixes them', () => {
  const listen = buildRun(source, [], NOW, seeded(), 'forest-3', 8, { game: 'listen' })!;
  assert.ok(listen.questions.every(q => q.type === 'listen'));
  assert.ok(buildRun(source, [], NOW, seeded(), 'forest-3', 8, { game: 'listen', quiet: true })!.questions.every(q => !q.type || q.type === 'meaning'));
  assert.ok(buildRun(source, [], NOW, seeded(), 'desert-3', 8, { game: 'order', sentences: [] })!.questions.every(q => q.type === 'listen'), 'no sentence set: 듣고 고르기');
  const crown = buildRun(source, [], NOW, seeded(), 'desert-5', 12, { game: 'mix', sentences })!;
  const types = new Set(crown.questions.map(q => q.type || 'meaning'));
  assert.ok(['meaning', 'spell', 'listen', 'order', 'read'].every(t => types.has(t as any)), [...types].join());
  const quietCrown = buildRun(source, [], NOW, seeded(), 'desert-5', 12, { game: 'mix', sentences, noMic: true })!;
  assert.ok(!quietCrown.questions.some(q => q.type === 'read'), 'no microphone: 낭독 → 문장 배열');
  // 낭독 reports how it went; the stars count first tries as before.
  const pet = initialPetState(NOW), g = initialGameState(NOW); g.run = crown;
  for (let i = 0; i < g.run.questions.length && !g.run.finished; i++) {
    const q = g.run.questions[i], t = q.type || 'meaning';
    if (t === 'match') { for (let w = 0; w < q.pairs!.length; w++) answerRun(g, pet, g.run.id, i, { pick: [w, q.meaningOrder!.indexOf(w)] }); continue; }
    answerRun(g, pet, g.run.id, i, t === 'read' ? { correct: true } : t === 'spell' || t === 'order' ? { text: q.word } : { choice: q.answer });
  }
  assert.equal(runSummary(g.run).stars, 3);
});

test('원정대 문장 세트 by grade: 초등 → 초등, unknown → 중1, teachers → 고3; admin only; only 문장 세트 can be chosen', async () => {
  assert.deepEqual(['김하늘(고덕중2)', '박서준(중앙초5)', '이름만', '최다은(비전고1)'].map(n => sentenceGradeFor(n)), ['중2', '초등', '중1', '고1']);
  assert.equal(sentenceGradeFor('', true), '고3');
  const f = registrationFirestore(), admin = { admin: true, academyId: 'main', uid: 'admin' };
  f.rows.set('wordbooks/s1', { title: '중2 핵심 문장', category: 'sentence', type: 'sentence' });
  f.rows.set('wordbooks/w1', { title: '단어장', category: 'word', type: 'standard' });
  await assert.rejects(() => readExpeditionSettings(f.db, { admin: false, academyId: 'main' }), /FORBIDDEN/);
  const view = await readExpeditionSettings(f.db, admin);
  assert.deepEqual(view.sets.map((x: any) => x.id), ['s1']);
  await assert.rejects(() => saveExpeditionSettings(f.db, admin, { sentences: { 중2: 'w1' } }), /BAD_REQUEST/);
  const saved = await saveExpeditionSettings(f.db, admin, { sentences: { 중2: 's1', 고3: 's1' } });
  assert.deepEqual([saved.sentences['중2'], saved.sentences['중1'], saved.sentences['초등']], [['s1'], [], []]);
  assert.deepEqual((await saveExpeditionSettings(f.db, admin, { sentences: { 초등: 's1' } })).sentences['초등'], ['s1'], '초등 can be set');
  const older = await saveExpeditionSettings(f.db, admin, { sentences: { 중1: '', 중2: 's1', 중3: '', 고1: '', 고2: '', 고3: '' } });
  assert.deepEqual(older.sentences['초등'], ['s1'], 'an older screen leaving out 초등 keeps it');
});
test('원정대 문장 세트: up to two sets for each grade (like the 탑 단어장); one set saved before still reads', async () => {
  const f = registrationFirestore(), admin = { admin: true, academyId: 'main', uid: 'admin' };
  for (const id of ['s1', 's2', 's3']) f.rows.set(`wordbooks/${id}`, { title: id, category: 'sentence', type: 'sentence' });
  f.rows.set('petExpeditionSettings/main', { sentences: { 중2: 's1' } });
  assert.deepEqual((await readExpeditionSettings(f.db, admin)).sentences['중2'], ['s1'], 'one set saved as a string before');
  const two = await saveExpeditionSettings(f.db, admin, { sentences: { 중2: ['s1', 's2'], 고1: ['s3', 's3'] } });
  assert.deepEqual([two.sentences['중2'], two.sentences['고1']], [['s1', 's2'], ['s3']], 'two sets; the same set twice is one');
  assert.deepEqual((await readExpeditionSettings(f.db, admin)).sentences['중2'], ['s1', 's2']);
  await assert.rejects(() => saveExpeditionSettings(f.db, admin, { sentences: { 중2: ['s1', 's2', 's3'] } }), /BAD_REQUEST/, 'three are too many');
  const src = (await import('node:fs')).readFileSync(new URL('../src/components/teacher/ExpeditionSentenceSettingsPanel.tsx', import.meta.url), 'utf8');
  assert.match(src, /\{\[0,1\]\.map\(i=><select key=\{i\} aria-label=\{`\$\{g\} \$\{i\+1\}번째 문장 세트`\}/, 'two pickers for each grade');
});
