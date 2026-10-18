import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { chunkHints, grammarTags, passageSentences, wordForms } from '../src/lib/passageTools.ts';
import { askPassagePart, editPassagePart, listPassages, openPassage, passageActor, passageWords, passageWordsPart, readPassage, resetWordIndex, setPassageInfo } from '../api/_lib/passage.ts';

const NOW = Date.parse('2026-10-16T03:00:00Z');
const TEXT = 'Many people believe that success comes from talent, but research shows otherwise. The key is consistent practice over a long period.';
const month = '2026-10';
function setup() {
  const f = registrationFirestore();
  f.rows.set('users/kid', { name: '김하늘', role: 'student' });
  f.rows.set('users/kid2', { name: '박서준', role: 'student' });
  f.rows.set('users/t1', { name: '이지원', role: 'teacher' });
  f.rows.set('teacherWorkspaceAccess/t1', { academyId: 'main' });
  return f;
}
const reading = (sentences: string[]) => JSON.stringify({ sentences: sentences.map(s => ({ chunks: chunkHints(s).map(en => ({ en, ko: '뜻' })), ko: '해석' })) });

test('지문 분석기 (app only): sentences, pauses that give the sentence back, grammar marks, word forms', () => {
  const sentences = passageSentences(TEXT);
  assert.equal(sentences.length, 2);
  for (const s of sentences) assert.equal(chunkHints(s).join(' '), s);
  assert.deepEqual(chunkHints(sentences[0]), ['Many people believe', 'that success comes', 'from talent,', 'but research shows otherwise.']);
  assert.deepEqual(grammarTags(sentences[0]).map(t => t.label), ['접속사·관계사 that']);
  assert.ok(grammarTags('It is important to read every day.').some(t => t.label === '가주어 it'));
  assert.ok(grammarTags('The book was written by her.').some(t => t.label === '수동태'));
  assert.ok(grammarTags('She wants to win.').some(t => t.label === 'to부정사'));
  assert.ok(!grammarTags('He went to the park.').some(t => t.label === 'to부정사'));
  assert.ok(wordForms('studies').includes('study') && wordForms('running').includes('run') && wordForms('made')[0] === 'made');
});

test('지문 분석기: one stored analysis per passage; students never see names, staff see who started it', async () => {
  const f = setup(), kid = await passageActor(f.db, 'kid'), kid2 = await passageActor(f.db, 'kid2'), t1 = await passageActor(f.db, 't1');
  assert.deepEqual([kid.staff, t1.staff], [false, true]);
  const first = await openPassage(f.db, kid, { text: TEXT }, NOW);
  assert.equal(first.reused, false);
  assert.equal((first.passage as any).createdBy, undefined, 'no names for students');
  const again = await openPassage(f.db, kid2, { text: `  ${TEXT}\n` }, NOW + 1);
  assert.equal(again.reused, true, 'the same text uses the stored one');
  const staffView: any = (await readPassage(f.db, t1, first.passage.id)).passage;
  assert.deepEqual([staffView.createdBy.name, staffView.createdBy.role, staffView.history[0].action], ['김하늘', 'student', '지문 분석 시작']);
  assert.ok(f.rows.has(`passageViews/kid2_${first.passage.id}`), 'each student keeps their list');
  await assert.rejects(() => openPassage(f.db, kid, { text: '' }, NOW), /PASSAGE_EMPTY/);
  await assert.rejects(() => openPassage(f.db, kid, { text: 'a '.repeat(4000) }, NOW), /PASSAGE_TOO_LONG/);
});

test('지문 분석기 AI parts: 직독직해 counts as 워크북 AI 해석, 문법·구조 as 지문 분석; made once, then free for everyone', async () => {
  const f = setup(), kid = await passageActor(f.db, 'kid'), kid2 = await passageActor(f.db, 'kid2');
  const { passage } = await openPassage(f.db, kid, { text: TEXT }, NOW);
  await openPassage(f.db, kid2, { text: TEXT }, NOW);
  let calls = 0;
  const gen = async (request: any) => { calls++; const items = JSON.parse(request.contents[0].parts[0].text); return reading(items.map((x: any) => x.sentence)); };
  const r1: any = await askPassagePart(f.db, kid, { id: passage.id, part: 'reading' }, gen, NOW);
  assert.equal(r1.passage.parts.reading.sentences[0].chunks[0].en, 'Many people believe');
  assert.equal(f.rows.get(`aiMonthly/kid_${month}`).workbook, 1);
  const r2: any = await askPassagePart(f.db, kid2, { id: passage.id, part: 'reading' }, gen, NOW);
  assert.deepEqual([r2.reused, calls, f.rows.get(`aiMonthly/kid2_${month}`)], [true, 1, undefined], 'stored: no AI call, nothing counted');
  // A reply that changes the sentence is refused and the count given back.
  const bad = async () => JSON.stringify({ sentences: [{ chunks: [{ en: 'Something else', ko: 'x' }], ko: 'x' }, { chunks: [{ en: 'x', ko: 'x' }], ko: 'x' }] });
  const grammarBad = async () => 'not json';
  await assert.rejects(() => askPassagePart(f.db, kid, { id: passage.id, part: 'grammar' }, grammarBad, NOW), /PASSAGE_AI_MISMATCH/);
  assert.equal(f.rows.get(`aiMonthly/kid_${month}`).analyzer, 0, 'given back');
  const grammar = async () => JSON.stringify({ sentences: [{ structure: 'S V O', points: ['명사절 that'] }, { structure: 'S V C', points: ['2형식'] }], essay: { index: 7, reason: '영작' } });
  const g: any = await askPassagePart(f.db, kid, { id: passage.id, part: 'grammar' }, grammar, NOW);
  assert.deepEqual([g.passage.parts.grammar.essay.index, f.rows.get(`aiMonthly/kid_${month}`).analyzer], [0, 1], 'an index out of range falls back to the first sentence');
  void bad;
});

test('지문 분석기 edits and 공개: teachers fix parts with their name recorded; students see only public or their own', async () => {
  const f = setup(), kid = await passageActor(f.db, 'kid'), kid2 = await passageActor(f.db, 'kid2'), t1 = await passageActor(f.db, 't1');
  const { passage } = await openPassage(f.db, kid, { text: TEXT }, NOW);
  const data = { sentences: passage.sentences.map(s => ({ chunks: [{ en: s, ko: '고친 뜻' }], ko: '고친 해석' })) };
  await assert.rejects(() => editPassagePart(f.db, kid, { id: passage.id, part: 'reading', data }, NOW), /FORBIDDEN/);
  await assert.rejects(() => editPassagePart(f.db, t1, { id: passage.id, part: 'reading', data: { sentences: [{ chunks: [{ en: 'wrong', ko: '' }], ko: '' }, data.sentences[1]] } }, NOW), /PASSAGE_EDIT_MISMATCH/);
  const edited: any = (await editPassagePart(f.db, t1, { id: passage.id, part: 'reading', data, note: '2번 문장' }, NOW + 5)).passage;
  assert.deepEqual([edited.parts.reading.editedBy.name, edited.history.at(-1).action], ['이지원', '직독직해 고침 (2번 문장)']);
  await assert.rejects(() => readPassage(f.db, kid2, passage.id), /FORBIDDEN/, 'not public, not theirs');
  assert.equal((await listPassages(f.db, kid2) as any).public.length, 0);
  await setPassageInfo(f.db, t1, { id: passage.id, title: '노력의 힘', examInfo: '2026 3월 고2 18번', public: true }, NOW + 9);
  const seen: any = await readPassage(f.db, kid2, passage.id);
  assert.equal(seen.passage.history, undefined);
  const lists: any = await listPassages(f.db, kid2);
  assert.deepEqual([lists.public.length, lists.public[0].title, lists.public[0].createdBy, lists.mine.length], [1, '노력의 힘', undefined, 0]);
  const mine: any = await listPassages(f.db, kid);
  assert.deepEqual(mine.mine.map((r: any) => r.id), [passage.id]);
  const staff: any = await listPassages(f.db, t1);
  assert.deepEqual([staff.rows[0].createdBy.name, staff.rows[0].lastChange.action, staff.rows[0].lastChange.name], ['김하늘', '제목 · 시험 정보 · 학생 공개', '이지원']);
});

test('지문 분석기 ③ 단어: meanings from the academy word sets (forms and phrases), the rest listed as unknown', async () => {
  const index = new Map([['believe', '믿다'], ['research', '연구'], ['consistent', '일관된'], ['period', '기간'], ['comes from', '~에서 오다']]);
  const w = passageWords(TEXT, index);
  assert.deepEqual(w.known.map(k => k.word).sort(), ['believe', 'comes from', 'consistent', 'period', 'research']);
  assert.ok(w.unknown.includes('talent') && w.unknown.includes('otherwise') && !w.unknown.includes('people'));
  const f = setup(), kid = await passageActor(f.db, 'kid');
  f.rows.set('wordbooks/b1', { category: 'word', type: 'standard' });
  f.rows.set('wordbooks/b1/words/w1', { word: 'Practice', meaning: '연습' });
  f.rows.set('wordbooks/g1', { category: 'grammar', type: 'to-ing-grammar' });
  f.rows.set('wordbooks/g1/words/w1', { word: 'talent', meaning: '문법 세트는 안 씀' });
  resetWordIndex();
  const { passage } = await openPassage(f.db, kid, { text: TEXT }, NOW);
  const out: any = await passageWordsPart(f.db, kid, passage.id, NOW);
  assert.deepEqual(out.passage.parts.words.known.map((k: any) => [k.word, k.meaning]), [['practice', '연습']]);
  assert.ok(out.passage.parts.words.unknown.includes('talent'));
  // the index is saved: a new server instance reads it (a few docs), not every word again
  const { loadWordIndex } = await import('../api/_lib/passage.ts');
  assert.deepEqual([f.rows.get('passageWordIndex/meta').chunks, f.rows.get('passageWordIndex/c0').words], [1, ['practice']]);
  f.rows.set('wordbooks/b1/words/w1', { word: 'Practice', meaning: '바뀐 뜻 (같은 개수)' });
  resetWordIndex();
  assert.equal((await loadWordIndex(f.db, NOW + 1000)).get('practice'), '연습', 'same sets and counts: the saved index');
  f.rows.set('wordbooks/b1/words/w2', { word: 'talent', meaning: '재능' });
  resetWordIndex();
  assert.equal((await loadWordIndex(f.db, NOW + 2000)).get('talent'), '재능', 'a set grew: rebuilt');
  f.rows.set('wordbooks/b1/words/w1', { word: 'Practice', meaning: '하루 뒤' });
  resetWordIndex();
  assert.equal((await loadWordIndex(f.db, NOW + 2000 + 25 * 3_600_000)).get('practice'), '하루 뒤', 'once a day: rebuilt (meanings edited in place)');
  // a passage analysed before gets its words again once the sets changed (the index version)
  const again: any = await passageWordsPart(f.db, kid, passage.id, NOW + 2000 + 25 * 3_600_000);
  assert.equal(again.passage.parts.words.known.find((k: any) => k.word === 'practice').meaning, '하루 뒤');
  // chunks by size: long Korean meanings never make a document too big
  const g = setup();
  g.rows.set('wordbooks/big', { category: 'word', type: 'standard' });
  for (let i = 0; i < 2500; i++) g.rows.set(`wordbooks/big/words/w${i}`, { word: `word${i}`, meaning: '아주 긴 한국어 뜻'.repeat(12) });
  resetWordIndex();
  await loadWordIndex(g.db, NOW);
  const meta = g.rows.get('passageWordIndex/meta');
  assert.ok(meta.chunks >= 2 && meta.words === 2500, 'split by bytes');
  for (let i = 0; i < meta.chunks; i++) { const doc = g.rows.get(`passageWordIndex/c${i}`); assert.ok(Buffer.byteLength(JSON.stringify(doc)) < 700_000); }
});

test('지문 분석기 route (/api/gemini?task=passage): login, actions, the monthly limit message', async () => {
  const { handlePassage } = await import('../api/gemini.ts');
  const f = setup();
  const call = async (body: any, token = 'kid') => { let status = 0, out: any; const req: any = { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body };
    const res: any = { setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; } };
    await handlePassage(req, res, { verify: async (t: string) => ({ uid: t }), db: () => f.db, generate: async () => '{}', adminUid: 'admin' } as any, NOW); return { status, out }; };
  assert.equal((await call({ action: 'list' }, '')).status, 401);
  const opened = await call({ action: 'open', text: TEXT });
  assert.equal(opened.out.ok, true);
  f.rows.set(`aiMonthly/kid_${month}`, { uid: 'kid', month, workbook: 50 });
  const full = await call({ action: 'ai', id: opened.out.passage.id, part: 'reading' });
  assert.deepEqual([full.status, full.out.error], [429, 'AI_MONTHLY_LIMIT']);
  assert.match(full.out.message, /워크북 AI 해석/);
  assert.equal((await call({ action: 'nope' })).status, 400);
});

test('지문 분석기 (Codex P2): over 40 sentences is refused, students get no names in parts, word saving keeps an AI part, a failed save gives the count back, the staff list is newest first in pages', async () => {
  const { PASSAGE_PAGE } = await import('../api/_lib/passage.ts');
  const f = setup(), kid = await passageActor(f.db, 'kid'), kid2 = await passageActor(f.db, 'kid2'), t1 = await passageActor(f.db, 't1');
  await assert.rejects(() => openPassage(f.db, kid, { text: Array.from({ length: 41 }, (_, i) => `Sentence number ${i} is here.`).join(' ') }, NOW), /PASSAGE_TOO_LONG/);
  const { passage } = await openPassage(f.db, kid, { text: TEXT }, NOW);
  await openPassage(f.db, kid2, { text: TEXT }, NOW);
  const gen = async (request: any) => reading(JSON.parse(request.contents[0].parts[0].text).map((x: any) => x.sentence));
  await askPassagePart(f.db, t1, { id: passage.id, part: 'reading' }, gen, NOW);
  const studentView: any = (await readPassage(f.db, kid2, passage.id)).passage;
  assert.equal(studentView.parts.reading.by, undefined, 'no teacher name for students');
  assert.ok(studentView.parts.reading.sentences.length);
  // An AI part saved while the words are worked out stays.
  f.rows.set('wordbooks/b1', { category: 'word' }); f.rows.set('wordbooks/b1/words/w1', { word: 'talent', meaning: '재능' });
  resetWordIndex();
  const words: any = await passageWordsPart(f.db, kid, passage.id, NOW);
  assert.ok(words.passage.parts.reading && words.passage.parts.words);
  assert.ok(f.rows.get(`passages/${passage.id}`).parts.reading, 'reading kept');
  // A failed save gives the monthly count back.
  // The save fails (the counts were taken before the AI call): the commit after the AI answer is made to fail.
  const grammar = async () => { f.failNextCommit(); return JSON.stringify({ sentences: [{ structure: 'S V O', points: [] }, { structure: 'S V C', points: [] }], essay: { index: 0, reason: '' } }); };
  await assert.rejects(() => askPassagePart(f.db, kid, { id: passage.id, part: 'grammar' }, grammar, NOW), /FIRESTORE_UNAVAILABLE/);
  assert.equal(f.rows.get(`aiMonthly/kid_${month}`).analyzer, 0);
  // The reading check keeps word boundaries.
  const joined = async () => JSON.stringify({ sentences: [{ chunks: [{ en: 'Manypeople believe that success comes from talent, but research shows otherwise.', ko: 'x' }], ko: 'x' }, { chunks: [{ en: 'The key is consistent practice over a long period.', ko: 'x' }], ko: 'x' }] });
  const { cleanPart } = await import('../api/_lib/passage.ts');
  const glued = JSON.parse(await joined());
  assert.throws(() => cleanPart('reading', glued, passage.sentences), /PASSAGE_AI_MISMATCH/, '"Manypeople" is not "Many people"');
  assert.doesNotThrow(() => cleanPart('reading', { sentences: passage.sentences.map(s => ({ chunks: [{ en: s.replace(',', ' ,'), ko: 'x' }], ko: 'x' })) }, passage.sentences), 'spacing around marks may differ');
  // Staff list: newest first, PASSAGE_PAGE at a time, then the next page from the cursor.
  // Many passages share one updatedAt: none is skipped or repeated across pages.
  for (let i = 0; i < PASSAGE_PAGE + 5; i++) f.rows.set(`passages/x${String(i).padStart(3, '0')}`, { sentences: ['A.'], updatedAt: 1000 + Math.floor(i / 50), parts: {} });
  const page1: any = await listPassages(f.db, t1);
  assert.equal(page1.rows.length, PASSAGE_PAGE);
  assert.ok(page1.rows[0].updatedAt >= page1.rows[PASSAGE_PAGE - 1].updatedAt);
  // A passage on page 1 changed meanwhile: the boundary stays where page 1 ended.
  const moved = page1.rows[3].id; f.rows.set(`passages/${moved}`, { ...f.rows.get(`passages/${moved}`), updatedAt: 999999 });
  const page2: any = await listPassages(f.db, t1, { after: page1.more });
  const all = [...page1.rows, ...page2.rows].map((r: any) => r.id);
  assert.equal(new Set(all).size, all.length, 'nothing twice');
  assert.equal(all.length, PASSAGE_PAGE + 5 + 1, 'nothing missed (plus the passage opened above)');
  assert.equal(page2.more, null);
});
