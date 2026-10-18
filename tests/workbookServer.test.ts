import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {readWorkbookHistory, saveWorkbookVersion, translateWorkbook} from '../api/_lib/teacherWorkbook.ts';
import {docxXmlText} from '../src/lib/workbookImport.ts';

const admin = {uid: 'admin', admin: true}, teacher = {uid: 't1', admin: false, academyId: 'main'}, principal = {uid: 'p1', admin: false, principal: true, academyId: 'main'};

test('workbook: teachers, principals and the admin; anyone else is refused before any AI call or read', async () => {
  let calls = 0; const generate = async () => { calls++; return JSON.stringify({translations: ['안녕']}); };
  const stranger = {uid: 'kid'};
  await assert.rejects(translateWorkbook(stranger, {sentences: ['Hi.']}, generate), /FORBIDDEN/);
  await assert.rejects(readWorkbookHistory(registrationFirestore().db, stranger, 'abc123def'), /FORBIDDEN/);
  assert.equal(calls, 0);
  for (const actor of [teacher, principal]) assert.deepEqual((await translateWorkbook(actor, {sentences: ['Hi.']}, generate)).translations, ['안녕']);
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
  const blob = await workbookDocx(build, {title: '10월 모의고사', subtitle: '18번', footer: '채움학원 지원T'});
  const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
  const text = docxXmlText(xml);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer()), footerXml = await zip.file(Object.keys(zip.files).find(f => /^word\/footer\d*\.xml$/.test(f))!)!.async('string');
  assert.ok(docxXmlText(footerXml).includes('채움학원 지원T'), 'the footer on every page');
  assert.ok(!/버전|v\d/i.test(text), 'no version in the file');
  assert.match(xml, /<w:r>(?:(?!<\/w:r>)[\s\S])*<w:b\/>(?:(?!<\/w:r>)[\s\S])*<w:t[^>]*>WORKBOOK<\/w:t>/, 'the title WORKBOOK is bold');
  for (const part of ['WORKBOOK', '10월 모의고사 · 18번', 'Part 1. 영문 빈칸 완성', 'Part 2. 단어 순서 배열', 'Answer Key', sentences[0].ko, sentences[1].text, '__________']) assert.ok(text.includes(part), part);
  assert.equal((xml.match(/<w:sectPr/g) || []).length, 2, 'the key starts on a new page (its own section, same header and footer)');
  assert.ok(xml.indexOf('Answer Key') > xml.indexOf('<w:sectPr'), 'after the first section');
  assert.equal(text.split('NASA\'s eco-friendly plan costs $20, doesn\'t it?').length - 1, 2, 'the full sentence appears in both answer parts only');
});

test('AI errors become codes the screen can explain (region refusal, busy, quota, key)', async () => {
  const {aiErrorCode} = await import('../api/_lib/teacherWorkbook.ts');
  assert.equal(aiErrorCode(Error('[400 Bad Request] User location is not supported for the API use.')), 'AI_REGION_UNSUPPORTED');
  assert.equal(aiErrorCode(Error('503 The model is overloaded')), 'AI_BUSY');
  assert.equal(aiErrorCode(Error('429 RESOURCE_EXHAUSTED')), 'AI_QUOTA');
  assert.equal(aiErrorCode(Error('AI_NOT_CONFIGURED')), 'AI_NOT_CONFIGURED');
  assert.equal(aiErrorCode(Error('[403] PERMISSION_DENIED: Vertex AI API has not been used')), 'AI_NOT_CONFIGURED', 'Vertex: API off or no role');
  assert.equal(aiErrorCode(Error('[404] NOT_FOUND: Publisher model was not found')), 'AI_MODEL_NOT_FOUND');
  assert.equal(aiErrorCode(Error('something else')), 'WORKBOOK_TRANSLATE_FAILED');
  await assert.rejects(translateWorkbook(admin, {sentences: ['Hi.']}, async () => { throw Error('User location is not supported for the API use.'); }), /AI_REGION_UNSUPPORTED/);
});

test('워크북 AI route (/api/gemini?task=workbook): teachers with a monthly limit, the admin without; students refused', async () => {
  const {handleWorkbookAi} = await import('../api/gemini.ts');
  const {AI_MONTHLY_LIMITS} = await import('../api/_lib/aiModel.ts');
  const f = registrationFirestore();
  f.rows.set('users/teacher', {role: 'teacher'}); f.rows.set('teacherWorkspaceAccess/teacher', {academyId: 'main'}); f.rows.set('users/kid', {role: 'student'});
  const call = async (body: any, uid: string, generate: any) => { let status = 0, out: any; const req: any = {method: 'POST', headers: {authorization: 'Bearer t'}, body};
    const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
    await handleWorkbookAi(req, res, {verify: async () => ({uid}), db: () => f.db, generate, adminUid: 'admin'}); return {status, out}; };
  let calls = 0; const ok = async () => { calls++; return JSON.stringify({translations: ['나는 달린다.']}); };
  assert.deepEqual((await call({sentences: ['I run.']}, 'admin', ok)).out, {ok: true, left: null, translations: ['나는 달린다.']});
  const byTeacher = await call({sentences: ['I run.']}, 'teacher', ok);
  assert.deepEqual([byTeacher.out.ok, byTeacher.out.left], [true, AI_MONTHLY_LIMITS.workbook - 1]);
  const refused = await call({sentences: ['I run.']}, 'kid', ok);
  assert.deepEqual([refused.status, refused.out.error, calls], [403, 'FORBIDDEN', 2], 'a student never reaches the model');
  const failed = await call({sentences: ['I run.']}, 'teacher', async () => { throw Error('503 overloaded'); });
  assert.equal(failed.out.error, 'AI_BUSY');
  assert.equal([...f.rows.entries()].find(([k]) => k.startsWith('aiMonthly/teacher_'))![1].workbook, 1, 'a failed call is given back');
  f.rows.set([...f.rows.keys()].find(k => k.startsWith('aiMonthly/teacher_'))!, {uid: 'teacher', month: 'x', workbook: AI_MONTHLY_LIMITS.workbook});
  const month = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Seoul'}).format(new Date()).slice(0, 7);
  f.rows.set(`aiMonthly/teacher_${month}`, {uid: 'teacher', month, workbook: AI_MONTHLY_LIMITS.workbook});
  assert.equal((await call({sentences: ['I run.']}, 'teacher', ok)).out.error, 'AI_MONTHLY_LIMIT');
  const region = await call({sentences: ['I run.']}, 'admin', async () => { throw Error('User location is not supported for the API use.'); });
  assert.deepEqual([region.status, region.out.error], [502, 'AI_REGION_UNSUPPORTED']);
  assert.equal((await call({sentences: []}, 'admin', ok)).out.error, 'INVALID_INPUT');
});
