import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { CIRCLED, ORDER_OPTIONS, buildAiQuestion, checkQuestion, choiceQuestion, grammarQuestion, insertQuestion, makeAppQuestions, orderQuestion, reviewApproved, reviewCandidates } from '../src/lib/questionMaker.ts';
import { splitPassage } from '../src/lib/workbook.ts';
import { openPassage, passageActor, resetWordIndex } from '../api/_lib/passage.ts';
import { listQuestionSets, makeQuestionSet, readQuestionSet } from '../api/_lib/questionSets.ts';
import { AI_PLANS } from '../src/lib/aiPlans.ts';

const NOW = Date.parse('2026-10-17T03:00:00Z');
const TEXT = 'Many people believe that talent is something we are born with. However, research shows that practice matters more than we think. For example, musicians who practiced for ten thousand hours performed best. This suggests that effort can shape ability. Of course, natural gifts still play a role. But without steady work, those gifts rarely grow. Therefore, we should value the process of learning. In the end, persistence is what turns potential into skill.';
/** mulberry32: well spread from the first number on, for any seed. */
const seeded = (seed = 3) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

test('변형 문제 (app): 순서 배열, 문장 삽입, 어법 선택 give the passage back exactly; answers fit; many seeds', () => {
  const s = splitPassage(TEXT);
  const answers = new Set<number>();
  for (let seed = 1; seed < 60; seed++) {
    const o = orderQuestion(s, seeded(seed))!, i = insertQuestion(s, seeded(seed))!, w = choiceQuestion(s, seeded(seed))!;
    for (const q of [o, i, w]) assert.deepEqual(checkQuestion(q, s), [], `${q.type} seed ${seed}`);
    assert.notEqual(ORDER_OPTIONS[(o.answer as number) - 1], '(A)-(B)-(C)');
    assert.equal((i.passage!.match(/\( [①-⑤] \)/g) || []).length, 5);
    answers.add(o.answer as number);
  }
  assert.ok(answers.size >= 4, 'the right order lands on different choice numbers');
  // a broken question is caught
  const o = orderQuestion(s, seeded(2))!;
  assert.ok(checkQuestion({ ...o, answer: (o.answer as number) % 5 + 1 }, s).length > 0);
  // too short for some types: reported, not invented
  const short = makeAppQuestions('Scientists discovered remarkable evidence about ancient climates. Researchers analyzed frozen samples carefully. Their conclusions surprised everyone completely.', ['order', 'insert', 'choice'], seeded());
  assert.deepEqual(short.skipped.map(x => x.type), ['order', 'insert', 'choice'], 'too few sentences, and nothing to choose between');
});

test('변형 문제 API: pasted or a stored passage; every 만들기 counts against the month (admin not); nothing made → nothing counted; own sets only', async () => {
  const f = registrationFirestore();
  f.rows.set('users/kid', { name: '김하늘', role: 'student' }); f.rows.set('users/kid2', { name: '박서준', role: 'student' });
  resetWordIndex();
  const kid = await passageActor(f.db, 'kid'), admin = await passageActor(f.db, 'boss', 'boss');
  const made: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['order', 'insert', 'grammar'] }, NOW, seeded());
  assert.deepEqual([made.set.questions.map((q: any) => q.type), made.left], [['order', 'insert', 'grammar'], AI_PLANS.free.generator - 1]);
  const none: any = await makeQuestionSet(f.db, kid, { text: 'Too short.', types: ['order'] }, NOW);
  assert.deepEqual([none.set, none.left], [null, null]);
  assert.equal(f.rows.get('aiMonthly/kid_2026-10').generator, 1, 'the short passage was not counted');
  await assert.rejects(makeQuestionSet(f.db, kid, { text: TEXT, types: [] }, NOW), /QUESTIONS_NO_TYPE/);
  // a stored passage: only one the student may see
  const { passage } = await openPassage(f.db, kid, { text: TEXT }, NOW);
  assert.equal(((await makeQuestionSet(f.db, kid, { passageId: passage.id, types: ['choice'] }, NOW, seeded())) as any).set.passageId, passage.id);
  const kid2 = await passageActor(f.db, 'kid2');
  await assert.rejects(makeQuestionSet(f.db, kid2, { passageId: passage.id, types: ['order'] }, NOW), /FORBIDDEN/);
  // the month runs out
  f.rows.set('aiMonthly/kid_2026-10', { uid: 'kid', month: '2026-10', generator: AI_PLANS.free.generator });
  await assert.rejects(makeQuestionSet(f.db, kid, { text: TEXT, types: ['order'] }, NOW), /AI_MONTHLY_LIMIT/);
  assert.equal(((await makeQuestionSet(f.db, admin, { text: TEXT, types: ['order'] }, NOW)) as any).left, null, 'the admin has no limit');
  // my sets
  const mine = (await listQuestionSets(f.db, kid)).sets;
  assert.equal(mine.length, 2);
  // the newest 30 come first, however many there are
  // older sets: some saved with uuid ids (before ids sorted by time), some with the new ids
  for (let i = 0; i < 12; i++) f.rows.set(`questionSets/${i.toString(16)}0000000-uuid-${i}`, { id: `u${i}`, uid: 'kid', title: 'old', types: ['order'], questions: [], createdAt: NOW - 2e6 - i });
  for (let i = 0; i < 35; i++) f.rows.set(`questionSets/n${String(9_999_999_999_999 - (NOW - 1e6 - i)).padStart(13, '0')}_old${i}`, { id: `old${i}`, uid: 'kid', title: 'old', types: ['order'], questions: [], createdAt: NOW - 1e6 - i });
  const latest = (await listQuestionSets(f.db, kid)).sets;
  assert.deepEqual([latest.length, latest[0].createdAt >= latest[1].createdAt, latest.slice(0, 2).every((x: any) => x.title !== 'old')], [30, true, true]);
  // a set that couldn't be saved gives the count back
  const before = f.rows.get('aiMonthly/kid2_2026-10')?.generator || 0, broken: any = { ...f.db, collection: (name: string) => name === 'questionSets' ? { doc: () => ({ set: async () => { throw Error('WRITE_FAILED'); } }) } : f.db.collection(name) };
  await assert.rejects(makeQuestionSet(broken, kid2, { text: TEXT, types: ['order'] }, NOW), /WRITE_FAILED/);
  assert.equal(f.rows.get('aiMonthly/kid2_2026-10')?.generator || 0, before, 'refunded');
  await assert.rejects(readQuestionSet(f.db, kid2, mine[0].id), /FORBIDDEN/);
  assert.equal((await readQuestionSet(f.db, kid, mine[0].id)).set.questions.length > 0, true);
});

test('변형 문제 어법 선택: the original word is one of each pair and the answer; the pair order varies; a broken one is caught', () => {
  const s = splitPassage(TEXT), firsts = new Set<boolean>();
  for (let seed = 1; seed < 60; seed++) {
    const q = choiceQuestion(s, seeded(seed))!, words = q.answer as string[];
    assert.deepEqual(checkQuestion(q, s), [], `seed ${seed}`);
    const pairs = [...q.passage!.matchAll(/[ⓐ-ⓛ]\[([^\]/]+) \/ ([^\]]+)\]/g)];
    assert.equal(pairs.length, words.length);
    pairs.forEach((p, k) => { assert.ok(p[1] === words[k] || p[2] === words[k]); firsts.add(p[1] === words[k]); });
    assert.ok(words.length >= 3 && q.explanation.split('\n').length === words.length);
  }
  assert.equal(firsts.size, 2, 'the right word comes first in some pairs, second in others');
  const q = choiceQuestion(s, seeded(4))!;
  assert.ok(checkQuestion({ ...q, answer: (q.answer as string[]).map((w, k) => (k ? w : 'zzz')) }, s).length > 0);
});

test('변형 문제 어법: agreement only where the word before settles the number; -ly only before an adjective', () => {
  const unsure = splitPassage('The data is clear. The family are happy. One of the students is late. There are many reasons. The stars shone brightly. Everyone smiled happily.');
  for (let seed = 1; seed < 30; seed++) assert.equal(choiceQuestion(unsure, seeded(seed)), null, 'none of these may be asked');
  const sure = splitPassage('They are tired. The results are extremely important. She has a dog. The plan was carefully designed.');
  const asked = new Set<string>();
  for (let seed = 1; seed < 30; seed++) for (const m of choiceQuestion(sure, seeded(seed))!.answer as string[]) asked.add(m);
  assert.deepEqual([...asked].sort(), ['are', 'carefully', 'extremely', 'has', 'was'].filter(w => asked.has(w)).sort());
  assert.ok(asked.has('are') && asked.has('has') && (asked.has('extremely') || asked.has('carefully')));
});

test('변형 문제 어법: 비교급 강조, very, such a, little/much/many — asked where certain, not elsewhere', () => {
  const seen = (s: string[], n = 40) => { const out = new Set<string>(); for (let seed = 1; seed < n; seed++) for (const m of choiceQuestion(s, seeded(seed))?.passage?.matchAll(/\[([^\]/]+) \/ ([^\]]+)\]/g) || []) out.add([m[1], m[2]].map(w => w.toLowerCase()).sort().join('/')); return out; };
  const sure = seen(splitPassage('The new plan is much better than before. It was a very useful idea. It was such a long day. We had little time left. Many students stayed late.'));
  for (const p of ['much/very', 'so/such', 'few/little', 'many/much']) assert.ok(sure.has(p), p);
  const unsure = seen(splitPassage('He was much loved by all. It is not much different. She is still taller now. A little known fact surprised us. They talked very much.'));
  assert.deepEqual([...unsure].filter(p => !['are/is', 'was/were'].includes(p)), [], 'only agreement here (much loved, much different, still taller, little known, very much are not asked)');
});

test('변형 문제 어법: little/much before a function word is not asked ("Little did he know")', () => {
  const s = splitPassage('Little did he know the truth. They are ready. She has a dog. The results are extremely important.');
  for (let seed = 1; seed < 20; seed++) assert.ok(!/\[(Little|Few) \//.test(choiceQuestion(s, seeded(seed))!.passage!));
});

test('변형 문제 어법: only forms with one right answer (no that/what; no -ly after a linking verb)', () => {
  const s = splitPassage('I know that story is true. The city grew steadily over the years. She smiled happily at the crowd. They were kindly people. Their plans are simple.');
  for (let seed = 1; seed < 30; seed++) {
    const q = choiceQuestion(s, seeded(seed));
    if (!q) continue;
    assert.ok(!/\[(that|what) \/ (that|what)\]/.test(q.passage!), 'no that/what pair');
    assert.ok(!/\[(steadily|steady) \//.test(q.passage!) && !/\/ (steadily|steady)\]/.test(q.passage!), 'grew steadily is not asked');
    assert.ok(!/kindly|kindl\b/.test(q.passage!.replace(/kindly people/, '')), 'kindly (an adjective too) is not asked');
  }
});

test('변형 문제 어법 수정: five underlined parts, one wrong; fixing it gives the passage back; many seeds', () => {
  const s = splitPassage(TEXT), answers = new Set<number>();
  for (let seed = 1; seed < 60; seed++) {
    const q = grammarQuestion(s, seeded(seed))!;
    assert.deepEqual(checkQuestion(q, s), [], `seed ${seed}`);
    const marked = q.passage!.match(/([①-⑤])\{([^}]*)\}/g)!, wrong = marked[(q.answer as number) - 1];
    assert.notEqual(wrong.slice(2, -1), q.fix, 'the marked word is the wrong one');
    assert.ok(q.explanation.startsWith(CIRCLED[(q.answer as number) - 1]));
    answers.add(q.answer as number);
  }
  assert.ok(answers.size >= 3);
});

const AI_REPLY = {
  blank: { phrase: 'practice matters more than we think', wrong: ['talent decides everything', 'luck is the key', 'gifts never change', 'rest is more useful'], explanation: '연습이 중요하다는 글이에요.' },
  irrelevant: { sentence: 'Many musicians also enjoy cooking at home on weekends.', explanation: '요리는 글과 관계 없어요.' },
  title: { answer: 'Practice Shapes Ability', wrong: ['Born to Be Great', 'The Secret of Luck', 'Why Music Is Hard', 'Gifts Never Fade'], explanation: '노력이 능력을 만든다는 글이에요.' },
  summary: { summary: 'Ability grows through (A) more than through (B).', a: 'effort', b: 'talent', wrongPairs: [{ a: 'talent', b: 'effort' }, { a: 'luck', b: 'work' }, { a: 'rest', b: 'practice' }, { a: 'gifts', b: 'process' }], explanation: '노력 > 재능.' },
  consistency: { truths: ['많은 사람은 재능을 타고난다고 믿는다.', '연습이 생각보다 중요하다.', '만 시간 연습한 음악가가 가장 잘했다.', '꾸준함이 잠재력을 기술로 바꾼다.'], lie: '타고난 재능은 아무 역할도 하지 않는다.', explanation: '재능도 역할을 한다고 했어요.' },
};
test('변형 문제 (AI-helped): the app places the answer and checks each one; a bad AI part is caught', () => {
  const s = splitPassage(TEXT), spots = new Set<number>();
  for (let seed = 1; seed < 30; seed++) for (const type of ['blank', 'irrelevant', 'title', 'summary', 'consistency'] as const) {
    const q = buildAiQuestion(type, s, (AI_REPLY as any)[type], seeded(seed))!;
    assert.deepEqual(checkQuestion(q, s), [], `${type} seed ${seed}`);
    if (type === 'title') { assert.equal(q.options![(q.answer as number) - 1], AI_REPLY.title.answer); spots.add(q.answer as number); }
    if (type === 'consistency') assert.equal(q.options![(q.answer as number) - 1], AI_REPLY.consistency.lie);
  }
  assert.ok(spots.size >= 4, 'the right answer lands on different numbers');
  assert.equal(buildAiQuestion('blank', s, { ...AI_REPLY.blank, phrase: 'practice is the only thing' }), null, 'a phrase not in the passage');
  assert.equal(buildAiQuestion('title', s, { ...AI_REPLY.title, wrong: ['A', 'B'] }), null, 'too few wrong choices');
  assert.equal(buildAiQuestion('irrelevant', s, { sentence: s[2] }), null, 'a sentence already in the passage');
  const same = buildAiQuestion('title', s, { ...AI_REPLY.title, wrong: ['Practice shapes ability!', 'B', 'C', 'D'] }, seeded())!;
  assert.ok(checkQuestion(same, s).length > 0, 'two choices that are the same');
});

test('변형 문제 API (AI-helped): 3 at most; one AI call; one 만들기 count (no daily AI use); AI failing keeps the app-made ones', async () => {
  const f = registrationFirestore();
  f.rows.set('users/kid', { name: '김하늘', role: 'student' });
  resetWordIndex();
  const kid = await passageActor(f.db, 'kid'), asked: any[] = [];
  const ai = async (request: any) => { asked.push(request); return JSON.stringify(AI_REPLY); };
  await assert.rejects(makeQuestionSet(f.db, kid, { text: TEXT, types: ['order', 'blank', 'title', 'topic'] }, NOW, seeded(), ai), /QUESTIONS_TOO_MANY/, 'three types at most, all kinds together');
  const made: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['title', 'blank', 'irrelevant'] }, NOW, seeded(), ai);
  assert.deepEqual(made.set.questions.map((q: any) => q.type), ['blank', 'irrelevant', 'title'], 'in the usual order');
  assert.equal(asked.length, 1, 'one AI call');
  assert.deepEqual(Object.keys(asked[0].config.responseSchema.properties), ['blank', 'irrelevant', 'title']);
  assert.deepEqual([f.rows.get('aiMonthly/kid_2026-10').generator, f.rows.get('aiUsage/kid:2026-10-17')], [1, undefined], 'only the 만들기 count');
  // the AI part that doesn't fit is reported, the rest kept
  const bad = async () => JSON.stringify({ ...AI_REPLY, blank: { ...AI_REPLY.blank, phrase: 'not in it' } });
  const partly: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['blank', 'title'] }, NOW, seeded(), bad);
  assert.deepEqual([partly.set.questions.map((q: any) => q.type), partly.skipped.map((x: any) => x.type)], [['title'], ['blank']]);
  // the AI fails: with an app type the set is still made; with AI types only, an error and the month count comes back
  const down = async () => { throw Error('boom'); };
  const kept: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['order', 'title'] }, NOW, seeded(), down);
  assert.deepEqual([kept.set.questions.map((q: any) => q.type), kept.skipped.map((x: any) => x.type)], [['order'], ['title']]);
  const month = f.rows.get('aiMonthly/kid_2026-10').generator;
  await assert.rejects(makeQuestionSet(f.db, kid, { text: TEXT, types: ['title'] }, NOW, seeded(), down), /AI_FAILED/);
  assert.equal(f.rows.get('aiMonthly/kid_2026-10').generator, month, 'refunded');
  // every AI part unusable: nothing saved, nothing counted
  const junk: any = await makeQuestionSet(f.db, kid, { text: TEXT, types: ['title'] }, NOW, seeded(), async () => JSON.stringify({}));
  assert.deepEqual([junk.set, f.rows.get('aiMonthly/kid_2026-10').generator], [null, month]);
  // a stored 지문 분석 summary is given to the AI as the reference
  const { passage } = await openPassage(f.db, kid, { text: TEXT }, NOW);
  f.rows.set(`passages/${passage.id}`, { ...f.rows.get(`passages/${passage.id}`), parts: { summary: { englishTitle: 'Effort Over Talent', topic: { en: 'the power of practice' }, mainIdea: { ko: '노력이 능력을 만든다' } } } });
  await makeQuestionSet(f.db, kid, { passageId: passage.id, types: ['topic'] }, NOW, seeded(), ai);
  assert.match(asked.at(-1).config.systemInstruction, /Effort Over Talent/);
});

const REVIEW_TEXT = 'They are ready for the trip. The results are extremely important. She has a dog at home. The movie was boring, so we left early. The company changed its policy last year.';
test('변형 문제 어법 review: the app finds context places (that/what, 감정 분사, where/which, its/their) with the sentence kept', () => {
  const r = reviewCandidates(splitPassage('Many people believe that talent matters. The movie was boring, so the children felt bored. This is the town where I grew up. The company changed its policy.'));
  assert.deepEqual(r.map(x => `${x.word}/${x.wrong}`), ['that/what', 'boring/bored', 'bored/boring', 'where/which', 'its/their']);
  assert.match(r[1].sentence, /^The movie was \[r2: (boring \/ bored|bored \/ boring)\], so the children felt \[r3: (bored \/ boring|boring \/ bored)\]\.$/, 'every review place in the sentence is masked');
  const firsts = new Set(Array.from({ length: 20 }, (_, k) => reviewCandidates(splitPassage('The company changed its policy.'), seeded(k + 1))[0].sentence.includes(': its')));
  assert.equal(firsts.size, 2, 'the AI is not told which word is the original (random order)');
  const picks = [{ id: 'r1', right: 'that' }, { id: 'r2', right: 'bored' }, { id: 'r3', right: '' }, { id: 'r4', right: 'Where' }];
  assert.deepEqual(reviewApproved(r, picks).map(x => x.word), ['that', 'where'], 'only picks of the original word (any case); the other word or none: not used');
  assert.ok(r.every(x => x.why));
  assert.deepEqual(reviewCandidates(splitPassage('They are ready. She has a dog.')), [], 'only sure-rule places: nothing to review');
});

test('변형 문제 어법 review API: same AI call; only approved places are used; AI failing still makes 어법 from the sure rules', async () => {
  const f = registrationFirestore();
  f.rows.set('users/kid', { name: '김하늘', role: 'student' });
  resetWordIndex();
  const kid = await passageActor(f.db, 'kid'), asked: any[] = [];
  // the AI picks boring (the original) for the movie, and their (not the original) for the company
  const ai = async (request: any) => { asked.push(request); const items = JSON.parse(request.contents[0].parts[1].text).review; return JSON.stringify({ review: items.map((x: any) => ({ id: x.id, right: /movie/.test(x.sentence) ? 'boring' : 'their' })) }); };
  const seen = new Set<string>();
  for (let seed = 1; seed <= 8; seed++) {
    const made: any = await makeQuestionSet(f.db, kid, { text: REVIEW_TEXT, types: ['choice'] }, NOW + seed, seeded(seed), ai);
    for (const m of made.set.questions[0].passage.matchAll(/\[([^\]/]+) \/ ([^\]]+)\]/g)) seen.add([m[1], m[2]].sort().join('/'));
    assert.deepEqual(checkQuestion(made.set.questions[0], splitPassage(REVIEW_TEXT)), []);
  }
  assert.ok(seen.has('bored/boring'), 'the approved 감정 분사 is asked');
  assert.ok(!seen.has('its/their'), 'the one the AI did not approve is not');
  assert.equal(asked[0].contents[0].parts.length, 2);
  assert.ok(!/was boring|changed its/.test(asked[0].contents[0].parts[0].text) && /\[r\d: /.test(asked[0].contents[0].parts[0].text), 'the passage the AI gets has the review places masked');
  assert.ok(asked[0].config.responseSchema.properties.review && !asked[0].config.responseSchema.properties.title);
  assert.deepEqual([f.rows.get('aiMonthly/kid_2026-10').generator, f.rows.get('aiUsage/kid:2026-10-17')], [8, undefined], 'one 만들기 count each, no daily AI use');
  const down: any = await makeQuestionSet(f.db, kid, { text: REVIEW_TEXT, types: ['choice'] }, NOW, seeded(), async () => { throw Error('boom'); });
  assert.ok(down.set && !/boring \/|\/ boring/.test(down.set.questions[0].passage), 'made from the sure rules');
  const before = asked.length;
  await makeQuestionSet(f.db, kid, { text: 'They are ready. The results are extremely important. She has a dog.', types: ['choice'] }, NOW, seeded(), ai);
  assert.equal(asked.length, before, 'nothing to review: no AI call');
  await makeQuestionSet(f.db, kid, { text: 'The movie was boring. We left.', types: ['choice', 'grammar'] }, NOW, seeded(), ai);
  assert.equal(asked.length, before, 'too short for the 어법 types: no AI call (no daily use)');
});
