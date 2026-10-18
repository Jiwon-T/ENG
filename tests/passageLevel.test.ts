import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationFirestore } from './helpers/registrationFirestore.ts';
import { cleanStructure, linkWords, passageLevel, structureFlow } from '../src/lib/passageLevel.ts';
import { askPassagePart, editPassagePart, openPassage, passageActor } from '../api/_lib/passage.ts';

const NOW = Date.parse('2026-10-18T03:00:00Z'), month = '2026-10';
const SENTENCES = [
  'Many people believe that talent decides success.',
  'However, researchers found a different answer in 2015.',
  'They studied 300 students at Harvard for ten years.',
  'These students practiced every day without rest.',
  'For example, Mina played the piano for two hours.',
  'As a result, most of them improved quickly.',
  'Therefore, we should focus on effort rather than talent.',
];

test('난이도: fixed rules with the measurements; short passages marked rough, fragments none', () => {
  const level = passageLevel(SENTENCES)!;
  assert.ok(level.stars >= 1 && level.stars <= 5);
  assert.match(level.measures.join(' · '), /^평균 \d+단어 · 25단어 이상 문장 \d+개 · 긴 단어\(9글자 이상\) \d+% · 관계사·접속사·분사구 \d+곳$/);
  assert.equal(level.short, false);
  const short = passageLevel(['Many students practice the piano every day after school.', 'Their skills improve quickly over time.'])!;
  assert.equal(short.short, true, 'a short passage still gets stars, marked rough');
  assert.equal(passageLevel(['I like apples.', 'You like pears.']), null, 'a fragment under 15 words');
  const hard = Array.from({ length: 4 }, () => 'Although the unprecedented technological transformation, which researchers had anticipated considerably, fundamentally reorganized international communication, governments, whose responsibilities were expanding, struggled to establish comprehensive regulations.');
  assert.ok(passageLevel(hard)!.stars > level.stars);
});

test('연결어: only 역접·예시·결과·결론, by token position; short words only at the start', () => {
  assert.deepEqual(linkWords('However, researchers found a different answer.'), [{ at: 0, length: 1, kind: '역접' }]);
  assert.deepEqual(linkWords('For example, Mina played the piano.'), [{ at: 0, length: 2, kind: '예시' }]);
  assert.deepEqual(linkWords('Therefore, we should focus on effort.'), [{ at: 0, length: 1, kind: '결론' }]);
  assert.deepEqual(linkWords('She was tired but happy, so she smiled.'), [], '"but"/"so" inside a sentence are not marked');
  assert.deepEqual(linkWords('But this was wrong.'), [{ at: 0, length: 1, kind: '역접' }]);
  assert.deepEqual(linkWords('These students also practiced.'), [], 'demonstratives and 첨가 words are not marked');
  assert.deepEqual(linkWords('The plan failed; as a result, we left.'), [{ at: 3, length: 3, kind: '결과' }]);
});

test('구조 지도 contract: one role per sentence (blank allowed), 0-based key in range', () => {
  assert.deepEqual(cleanStructure({ roles: ['통념', '반박', '근거', '근거', '예시', '결과', '결론'], key: 6 }, 7), { roles: ['통념', '반박', '근거', '근거', '예시', '결과', '결론'], key: 6 });
  assert.deepEqual(cleanStructure({ roles: ['도입', '', '이상한 역할'], key: 0 }, 3), { roles: ['도입', '', ''], key: 0 });
  assert.equal(cleanStructure({ roles: ['도입', '결론'], key: 1 }, 3), null, 'wrong length');
  assert.equal(cleanStructure({ roles: ['도입', '근거', '결론'], key: 3 }, 3), null, 'key out of range');
  assert.equal(cleanStructure({ roles: ['도입', '근거', '결론'], key: 1.5 }, 3), null, 'key not an integer');
  assert.equal(cleanStructure({ roles: ['', '', ''], key: 0 }, 3), null, 'no role at all');
  assert.equal(structureFlow(['통념', '반박', '근거', '근거', '', '결론']), '통념 → 반박 → 근거 → 결론');
});

function setup() {
  const f = registrationFirestore();
  f.rows.set('users/kid', { name: '김하늘', role: 'student' });
  f.rows.set('users/t1', { name: '이지원', role: 'teacher' });
  f.rows.set('teacherWorkspaceAccess/t1', { academyId: 'main' });
  return f;
}
const summary = { title: '노력', englishTitle: 'Effort', topic: { ko: '노력', en: 'effort' }, mainIdea: { ko: '노력', en: 'effort' }, summary: { ko: '요약', en: 'sum' }, logic: '통념-반박' };

test('구조 지도 (server): comes free with a new summary; alone it counts once, is kept apart and never redone', async () => {
  const f = setup(), kid = await passageActor(f.db, 'kid'), t1 = await passageActor(f.db, 't1');
  const { passage } = await openPassage(f.db, kid, { text: SENTENCES.join(' ') }, NOW);
  // a summary with a map: one count, the map saved in its own field
  const withMap = async (request: any) => { assert.ok(JSON.parse(request.contents[0].parts[0].text).sentences[6].index === 6); return JSON.stringify({ ...summary, structure: { roles: ['통념', '반박', '근거', '근거', '예시', '결과', '결론'], key: 6 } }); };
  const s: any = await askPassagePart(f.db, kid, { id: passage.id, part: 'summary' }, withMap, NOW);
  assert.deepEqual([s.passage.parts.structure.key, s.passage.parts.summary.structure, f.rows.get(`aiMonthly/kid_${month}`).analyzer], [6, undefined, 1]);
  const again: any = await askPassagePart(f.db, kid, { id: passage.id, part: 'structure' }, async () => { throw Error('no call'); }, NOW);
  assert.deepEqual([again.reused, f.rows.get(`aiMonthly/kid_${month}`).analyzer], [true, 1], 'already there: no call, no count');

  // an older summary without a map: the map alone counts once; a bad reply is refused and given back
  const other = await openPassage(f.db, kid, { text: SENTENCES.slice(0, 5).join(' ') }, NOW);
  await askPassagePart(f.db, kid, { id: other.passage.id, part: 'summary' }, async () => JSON.stringify({ ...summary, structure: { roles: ['통념'], key: 0 } }), NOW);
  assert.equal((f.rows.get(`passages/${other.passage.id}`) as any).parts.structure, undefined, 'a map that does not fit is left out, the summary kept');
  await editPassagePart(f.db, t1, { id: other.passage.id, part: 'summary', data: { ...summary, title: '선생님이 고친 제목' } }, NOW + 1);
  await assert.rejects(() => askPassagePart(f.db, kid, { id: other.passage.id, part: 'structure' }, async () => JSON.stringify({ roles: ['통념'], key: 9 }), NOW), /PASSAGE_AI_MISMATCH/);
  assert.equal(f.rows.get(`aiMonthly/kid_${month}`).analyzer, 2, 'the failed one was given back');
  const m: any = await askPassagePart(f.db, kid, { id: other.passage.id, part: 'structure' }, async () => JSON.stringify({ roles: ['통념', '반박', '근거', '', '예시'], key: 1 }), NOW + 2);
  assert.deepEqual([m.passage.parts.structure.roles[3], m.passage.parts.summary.title, f.rows.get(`aiMonthly/kid_${month}`).analyzer], ['', '선생님이 고친 제목', 3], "the teacher's summary edit is untouched");
  await assert.rejects(() => editPassagePart(f.db, t1, { id: other.passage.id, part: 'structure', data: { roles: [], key: 0 } }, NOW), /BAD_REQUEST/);
});
