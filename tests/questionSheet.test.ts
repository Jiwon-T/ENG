import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { answerText, packQuestions, passageParts, questionSheetDocx, sheetQuestions, PAGE_BUDGET } from '../src/lib/questionSheet.ts';

const q = (type: string, passage: string, answer: any, explanation = '해설'): any => ({ id: type, type, prompt: `${type} 문제`, passage, options: ['a', 'b', 'c', 'd', 'e'], answer, explanation });
const xmlText = (xml: string) => xml.replace(/<[^>]+>/g, '');

test('변형 문제지: sets put together are numbered on; pages hold whole questions; answers written as in the key', () => {
  const items = sheetQuestions([{ title: '31번', questions: [q('order', 'x'.repeat(1600), 2), q('insert', 'y'.repeat(1600), 4)] }, { title: '32번', questions: [q('title', 'z'.repeat(1600), 1)] }]);
  assert.deepEqual(items.map(i => [i.n, i.setTitle]), [[1, '31번'], [2, '31번'], [3, '32번']]);
  const pages = packQuestions(items);
  assert.ok(pages.every(p => p.length >= 1) && pages.flat().length === 3, 'no question lost or cut');
  assert.ok(pages.length >= 2, `about ${PAGE_BUDGET} characters a page`);
  const huge = packQuestions(sheetQuestions([{ title: 't', questions: [q('order', 'w'.repeat(PAGE_BUDGET * 2), 1), q('title', 'v', 3)] }]));
  assert.deepEqual(huge.map(p => p.length), [1, 1], 'a question bigger than a page has one to itself');
  assert.equal(answerText(q('order', '', 3)), '③');
  assert.equal(answerText({ ...q('choice', '', ['is', 'are']) }), 'ⓐ is  ⓑ are');
  assert.deepEqual(passageParts('We ①{are} here ②{is}.').map(p => [p.text, Boolean(p.under)]), [['We ', false], ['①', false], ['are', true], [' here ', false], ['②', false], ['is', true], ['.', false]]);
});

test('변형 문제지 (Word): the questions with their numbers, then 정답 · 해설; the common frame header and footer', async () => {
  const items = sheetQuestions([{ title: '31번', questions: [q('order', 'Many people believe that talent matters.', 2, '원문 순서예요.'), q('grammar', 'We ①{are} here.', 1, "① 'are' → 'is'")] }]);
  const blob = await questionSheetDocx({ title: '31번 변형 문제', footer: '채움학원 지원T' }, items);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer()), body = await zip.file('word/document.xml')!.async('string');
  const text = xmlText(body);
  assert.ok(text.includes('1. order 문제') && text.includes('2. grammar 문제'));
  assert.ok(text.includes('정답 · 해설') && text.includes('②') && text.includes('원문 순서예요.'));
  assert.match(body, /<w:u w:val="single"\/>/, 'the 어법 수정 part is underlined');
  assert.match(body, /<w:cols[^>]*w:num="2"/, 'the questions in two columns');
  const header = await zip.file(Object.keys(zip.files).find(f => /^word\/header\d*\.xml$/.test(f))!)!.async('string');
  assert.ok(xmlText(header).includes('31번 변형 문제'));
});
