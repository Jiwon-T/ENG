import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {readWorkbookHistory, saveWorkbookVersion, translateWorkbook} from '../api/_lib/teacherWorkbook.ts';
import {docxXmlText} from '../src/lib/workbookImport.ts';

const admin = {uid: 'admin', admin: true}, teacher = {uid: 't1', admin: false}, principal = {uid: 'p1', admin: false, principal: true};

test('workbook: the admin only (teachers and principals are refused before any AI call or read)', async () => {
  let calls = 0; const generate = async () => { calls++; return JSON.stringify({translations: ['안녕']}); };
  for (const actor of [teacher, principal]) {
    await assert.rejects(translateWorkbook(actor, {sentences: ['Hi.']}, generate), /FORBIDDEN/);
    await assert.rejects(readWorkbookHistory(registrationFirestore().db, actor, 'abc123def'), /FORBIDDEN/);
    await assert.rejects(saveWorkbookVersion(registrationFirestore().db, actor, {key: 'abc123def', blanks: [[1]], orders: [[0]]}), /FORBIDDEN/);
  }
  assert.equal(calls, 0);
});

test('AI translations: one per sentence in order, otherwise nothing is used', async () => {
  const ok = await translateWorkbook(admin, {sentences: ['I run.', 'You swim.']}, async () => JSON.stringify({translations: ['나는 달린다.', '너는 수영한다.']}));
  assert.deepEqual(ok.translations, ['나는 달린다.', '너는 수영한다.']);
  await assert.rejects(translateWorkbook(admin, {sentences: ['I run.', 'You swim.']}, async () => JSON.stringify({translations: ['하나만']})), /WORKBOOK_TRANSLATE_MISMATCH/);
  await assert.rejects(translateWorkbook(admin, {sentences: ['I run.']}, async () => 'not json'), /WORKBOOK_TRANSLATE_FAILED/);
  await assert.rejects(translateWorkbook(admin, {sentences: []}, async () => '{}'));
  await assert.rejects(translateWorkbook(admin, {sentences: Array(81).fill('A.')}, async () => '{}'), 'at most 80 sentences');
});

test('history: each saved version is remembered per teacher and passage; the next version number follows', async () => {
  const f = registrationFirestore(), key = 'k3y9x8w7';
  assert.deepEqual(await readWorkbookHistory(f.db, admin, key), {nextVersion: 1, blanks: [], orders: []});
  assert.deepEqual(await saveWorkbookVersion(f.db, admin, {key, title: '모의고사', blanks: [[1, 4, 7], [0, 2, 5]], orders: [[2, 0, 1], [1, 0]]}, 10), {version: 1});
  await saveWorkbookVersion(f.db, admin, {key, blanks: [[2, 5, 8], [1, 3, 6]], orders: [[1, 2, 0], [0, 1]]}, 20);
  assert.deepEqual(await readWorkbookHistory(f.db, admin, key), {nextVersion: 3, blanks: [[[1, 4, 7], [0, 2, 5]], [[2, 5, 8], [1, 3, 6]]], orders: [[[2, 0, 1], [1, 0]], [[1, 2, 0], [0, 1]]]});
  assert.equal(f.rows.get(`workbookHistory/admin:${key}`).versions[0].blanks[0], '1,4,7', 'stored as strings (no arrays in arrays)');
  await assert.rejects(readWorkbookHistory(f.db, admin, 'bad key!'));
  await assert.rejects(saveWorkbookVersion(f.db, admin, {key, blanks: [[1]], orders: [[0], [1]]}), /INVALID_INPUT/);
});

test('DOCX import: paragraph text with runs joined, entities decoded, tabs as spaces', () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>NASA&apos;s </w:t></w:r><w:r><w:t xml:space="preserve">plan &amp; budget.</w:t></w:r></w:p><w:p><w:r><w:t>1.</w:t><w:tab/><w:t>Next line.</w:t></w:r></w:p></w:body></w:document>';
  assert.equal(docxXmlText(xml), "NASA's plan & budget.\n1. Next line.");
});

test('Word file: title, both parts with translations, answer key on a new page, original sentences in the key', async () => {
  const {buildWorkbook} = await import('../src/lib/workbook.ts');
  const {workbookDocx} = await import('../src/lib/workbookDocx.ts');
  const JSZip = (await import('jszip')).default;
  const sentences = [{id: 'a', text: 'American astronauts are given the opportunity to vote even when they are in space.', ko: '미국 우주비행사들은 우주에서도 투표할 기회를 받는다.'}, {id: 'b', text: 'NASA\'s eco-friendly plan costs $20, doesn\'t it?', ko: 'NASA의 친환경 계획은 20달러가 들지 않나요?'}];
  const build = buildWorkbook(sentences);
  const blob = await workbookDocx(build, '10월 모의고사', 2);
  const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
  const text = docxXmlText(xml);
  for (const part of ['고등학교 영어 워크북', '10월 모의고사 · 버전 2', 'Part 1. 영문 빈칸 완성', 'Part 2. 단어 순서 배열', 'Answer Key', sentences[0].ko, sentences[1].text, '__________']) assert.ok(text.includes(part), part);
  assert.match(xml, /<w:br w:type="page"\/>/, 'the key starts on a new page');
  assert.equal(text.split('NASA\'s eco-friendly plan costs $20, doesn\'t it?').length - 1, 2, 'the full sentence appears in both answer parts only');
});
