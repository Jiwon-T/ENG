import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTranslations, arrangeLine, blankCount, blankedText, buildWorkbook, checkWorkbook, chooseBlanks, passageKey, safeFileName, shuffleOrder, splitExcerpts, splitPassage, splitToken, toggleBlank, tokenize, type WorkbookSentence} from '../src/lib/workbook.ts';

const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const S = (text: string, ko = '해석'): WorkbookSentence => ({id: text.slice(0, 12), text, ko});

test('연속 지문: sentences in order; abbreviations, decimals, quotes and ellipses do not cut a sentence', () => {
  const text = 'American astronauts are given the opportunity to vote even when they are in space. Mr. Kim paid $3.50 at 9 a.m. on Monday!\n\nDid the U.S. team win? "Yes," she said. He waited... and waited. It cost $20.';
  assert.deepEqual(splitPassage(text), [
    'American astronauts are given the opportunity to vote even when they are in space.',
    'Mr. Kim paid $3.50 at 9 a.m. on Monday!',
    'Did the U.S. team win?',
    '"Yes," she said.',
    'He waited... and waited.',
    'It cost $20.',
  ]);
  assert.deepEqual(splitPassage('  '), []);
});

test('발췌 문장: one per line, item numbers removed, the sentence itself untouched', () => {
  assert.deepEqual(splitExcerpts('1. NASA\'s plan works.\n2) They don\'t vote.\n\n(3) 3 cats sat.\n① Eco-friendly cars cost $79.\n10 - Last one.'),
    ['NASA\'s plan works.', 'They don\'t vote.', '3 cats sat.', 'Eco-friendly cars cost $79.', 'Last one.']);
});

test('tokens: punctuation stays on its word; hyphens, possessives, contractions and money stay whole', () => {
  const s = 'NASA\'s science-fiction fans don\'t pay $20, but candidates\' i-voting costs 3.5% (sometimes).';
  const tokens = tokenize(s);
  assert.deepEqual(tokens, ['NASA\'s', 'science-fiction', 'fans', 'don\'t', 'pay', '$20,', 'but', 'candidates\'', 'i-voting', 'costs', '3.5%', '(sometimes).']);
  assert.equal(tokens.join(' '), s);
  assert.deepEqual(splitToken('(sometimes).'), {lead: '(', core: 'sometimes', trail: ').'});
  assert.deepEqual(splitToken('candidates\''), {lead: '', core: 'candidates', trail: '\''});
});

test('blanks: 3–5 per sentence by length, at least 3 even for short ones, punctuation kept, original restorable', () => {
  assert.deepEqual([blankCount(4), blankCount(12), blankCount(18), blankCount(40), blankCount(2)], [3, 3, 5, 5, 2]);
  const tokens = tokenize('American astronauts are given the opportunity to vote even when they are in space.');
  const blanks = chooseBlanks(tokens, [], seeded());
  assert.ok(blanks.length >= 3 && blanks.length <= 5);
  assert.ok(!blanks.some((b, i) => i && b - blanks[i - 1] === 1), 'spread out');
  const text = blankedText(tokens, [13]);
  assert.match(text, /in __________\.$/, 'the period stays after the blank');
  const short = chooseBlanks(tokenize('It is so.'), [], seeded());
  assert.equal(short.length, 3, 'short sentence: still 3');
});

test('a passage made again avoids the blanks and orders used before (and repeats only when nothing else is left)', () => {
  const tokens = tokenize('Students who read widely develop richer vocabulary and stronger writing skills.');
  const first = chooseBlanks(tokens, [], seeded(1)), second = chooseBlanks(tokens, [first], seeded(1));
  assert.notDeepEqual(second, first);
  const order = shuffleOrder(8, [], seeded(3)), again = shuffleOrder(8, [order], seeded(3));
  assert.notDeepEqual(again, order);
  assert.notDeepEqual(order, [0, 1, 2, 3, 4, 5, 6, 7], 'never the original order');
  const tiny = tokenize('Go now.');
  assert.deepEqual(chooseBlanks(tiny, [[0, 1]], seeded()), [0, 1], 'only one set possible: repeated');
});

test('build + checks: counts match, every word once, translations travel with their sentence', () => {
  const sentences = [S('American astronauts are given the opportunity to vote even when they are in space.', '미국 우주비행사들은 우주에서도 투표할 기회를 받는다.'), S('NASA\'s eco-friendly rockets cost $20 million, don\'t they?', 'NASA의 친환경 로켓은 2천만 달러가 들지 않나요?')];
  const build = buildWorkbook(sentences, {blanks: [], orders: []}, seeded());
  assert.deepEqual(checkWorkbook(sentences, build), []);
  for (const item of build.arrange) assert.deepEqual([...item.order].sort((a, b) => a - b), item.pieces.map((_, i) => i));
  assert.match(arrangeLine(build.arrange[1]), /NASA's/);
  assert.ok(!arrangeLine(build.arrange[1]).split(' / ').includes(','), 'no punctuation-only piece');
  // A broken build is reported, not hidden.
  const broken = {...build, blanks: [{...build.blanks[0], blanks: [1]}, build.blanks[1]]};
  assert.ok(checkWorkbook(sentences, broken).some(m => m.includes('빈칸이 1개')));
  assert.ok(checkWorkbook([{...sentences[0], ko: ''}, sentences[1]], build).some(m => m.includes('한글 해석이 비어')));
  assert.ok(checkWorkbook(sentences, {...build, arrange: [build.arrange[1], build.arrange[0]]}).some(m => m.includes('순서')));
});

test('toggle blanks, pasted translations, passage key and file name', () => {
  const build = buildWorkbook([S('Small habits slowly change our lives.')], {blanks: [], orders: []}, seeded());
  const item = build.blanks[0], off = toggleBlank(item, item.blanks[0]);
  assert.equal(off.blanks.length, item.blanks.length - 1);
  const typed: WorkbookSentence[] = [{id: 'a', text: 'A.', ko: '직접 쓴 해석', koEdited: true}, {id: 'b', text: 'B.', ko: ''}];
  assert.deepEqual(applyTranslations(typed, ['덮어쓰면 안 됨', '새 해석']).map(s => s.ko), ['직접 쓴 해석', '새 해석']);
  assert.equal(passageKey(['1. Hello  world.', '2) Bye.']), passageKey(['Hello world.', 'Bye.']));
  assert.notEqual(passageKey(['Hello world.']), passageKey(['Hello World.']));
  assert.equal(safeFileName('고2: 10월 "모의고사"/A', '18번 지문'), '고2 10월 모의고사 A_18번 지문.docx');
  assert.equal(safeFileName('10월 모의고사'), '10월 모의고사.docx', 'no subtitle: the title alone, no version');
  assert.equal(safeFileName('', ''), '워크북.docx');
});

test('articles: never a blank, and in Part 2 kept with the first word of their noun phrase', async () => {
  const {arrangePieces, isArticle} = await import('../src/lib/workbook.ts');
  assert.deepEqual(arrangePieces('The astronauts are given an opportunity to vote in a secure way.'),
    ['The astronauts', 'are', 'given', 'an opportunity', 'to', 'vote', 'in', 'a secure', 'way.']);
  assert.deepEqual(arrangePieces('I saw the "Mona Lisa" at the museum.'), ['I', 'saw', 'the "Mona', 'Lisa"', 'at', 'the museum.'], 'joins the next word as written');
  assert.deepEqual(arrangePieces('It is the end of the'), ['It', 'is', 'the end', 'of', 'the'], 'a last article stays alone');
  assert.deepEqual([isArticle('The'), isArticle('an,'), isArticle('then'), isArticle('another')], [true, true, false, false]);
  for (let seed = 1; seed < 40; seed++) {
    const tokens = tokenize('The cat saw a dog and an owl at the end of the day.');
    assert.ok(!chooseBlanks(tokens, [], seeded(seed)).some(i => isArticle(tokens[i])), `seed ${seed}`);
  }
  const short = tokenize('The sun is a star.');
  assert.ok(!chooseBlanks(short, [], seeded()).some(i => isArticle(short[i])), 'short sentence: still no article blank');
  const build = buildWorkbook([S('The astronauts vote in a secure way from the station.')], {blanks: [], orders: []}, seeded());
  const article = build.blanks[0].tokens.indexOf('a');
  assert.deepEqual(toggleBlank(build.blanks[0], article).blanks, build.blanks[0].blanks, 'an article cannot be switched on as a blank');
  assert.ok(checkWorkbook([S('The astronauts vote in a secure way from the station.')], {...build, blanks: [{...build.blanks[0], blanks: [0, 3, 6]}]}).some(m => m.includes('관사')));
  assert.deepEqual(checkWorkbook([S('The astronauts vote in a secure way from the station.')], build), []);
});

test('blanks stay at 5 or fewer: the preview cannot add a sixth, and the check refuses more than 5', () => {
  const s = S('Curious students quickly discover remarkable patterns hidden inside ordinary everyday language.');
  const build = buildWorkbook([s], {blanks: [], orders: []}, seeded());
  let item = {...build.blanks[0], blanks: [0, 2, 4, 6, 8]};
  item = toggleBlank(item, 10);
  assert.deepEqual(item.blanks, [0, 2, 4, 6, 8], 'a sixth blank is not added');
  assert.deepEqual(toggleBlank(item, 8).blanks, [0, 2, 4, 6], 'taking one off still works');
  assert.ok(checkWorkbook([s], {...build, blanks: [{...item, blanks: [0, 2, 4, 6, 8, 10]}]}).some(m => m.includes('5개까지')));
});

test('AI translations: applied only to sentences unchanged since the request; the confirmation is tied to their content', async () => {
  const {aiReviewKey, applyAiTranslations} = await import('../src/lib/workbook.ts');
  const asked = [{id: 'a', text: 'I run.'}, {id: 'b', text: 'You swim.'}, {id: 'c', text: 'We fly.'}];
  // While the request ran: a was edited in English, b got a typed translation, c is unchanged.
  const now: WorkbookSentence[] = [{id: 'a', text: 'I ran.', ko: ''}, {id: 'b', text: 'You swim.', ko: '직접 쓴 해석', koEdited: true}, {id: 'c', text: 'We fly.', ko: ''}];
  const filled = applyAiTranslations(now, asked, ['나는 달린다.', '너는 수영한다.', '우리는 난다.']);
  assert.deepEqual(filled.map(s => s.ko), ['', '직접 쓴 해석', '우리는 난다.']);
  assert.equal(filled[2].koEdited, false);
  const confirmed = aiReviewKey(filled);
  assert.equal(aiReviewKey(filled.map(s => ({...s}))), confirmed, 'same content: still confirmed');
  assert.notEqual(aiReviewKey(filled.map(s => s.id === 'c' ? {...s, text: 'We flew.'} : s)), confirmed, 'English changed: confirm again');
  assert.equal(aiReviewKey(filled.filter(s => s.id !== 'b')), confirmed, 'removing a sentence without an AI translation does not matter');
  const two: WorkbookSentence[] = [{id: 'x', text: 'A.', ko: '가', koEdited: false}, {id: 'y', text: 'B.', ko: '나', koEdited: false}];
  assert.notEqual(aiReviewKey([...two].reverse()), aiReviewKey(two), 'order of AI-translated sentences changed: confirm again');
  assert.notEqual(aiReviewKey(two.slice(0, 1)), aiReviewKey(two), 'an AI-translated sentence removed: confirm again');
  assert.equal(aiReviewKey(filled.map(s => s.id === 'c' ? {...s, ko: '고친 해석', koEdited: true} : s)), '[]', 'edited by the teacher: no AI translation left to confirm');
});
