import test from 'node:test';
import assert from 'node:assert/strict';
import {buyItem, initialPetState, rollDay} from '../api/_lib/pet.js';
import {claimQuestBox, markWrongReviewed, noteQuest, questView, readQuestRecords, todaysQuests} from '../api/_lib/petQuests.js';

const DAY = (d: number) => Date.parse(`2026-10-${String(d).padStart(2, '0')}T03:00:00Z`);

test('오늘 할 일: 단어 테스트, 오답 복습 (단어장 공부 when fewer than 5 wrong answers wait), a pet word game', () => {
  const s = initialPetState(DAY(21));
  assert.deepEqual(todaysQuests(s, 7), ['test', 'review', 'feed']);
  assert.deepEqual(todaysQuests(s, 2), ['test', 'study', 'feed']);
  noteQuest(s, 'review', 3);
  assert.deepEqual(todaysQuests(s, 2), ['test', 'review', 'feed'], 'started today: stays 오답 복습 as the wrong answers go down');
});

test('오늘 할 일: all three done opens a 간식 상자 once (snacks into the 가방, no points); counts reset the next day', () => {
  const s = initialPetState(DAY(21)), points = s.points, rec = {wrongs: 9, test: 1, study: 0};
  noteQuest(s, 'review', 2);
  assert.equal(questView(s, rec, DAY(21)).ready, false);
  assert.throws(() => claimQuestBox(s, rec, DAY(21)), /QUEST_NOT_DONE/);
  noteQuest(s, 'review', 3); noteQuest(s, 'feed');
  assert.equal(questView(s, {...rec, test: 0}, DAY(21)).ready, false, 'no 단어 테스트 saved today');
  const v = questView(s, rec, DAY(21));
  assert.deepEqual([v.ready, v.items.map(i => i.done)], [true, [1, 5, 1]]);
  const out = claimQuestBox(s, rec, DAY(21), () => 0);
  assert.deepEqual(out, {items: ['cookie', 'cookie', 'coffee'], special: false, streak: 1});
  assert.deepEqual(s.snacks, {cookie: 2, coffee: 1});
  assert.equal(s.points, points, 'no points');
  assert.throws(() => claimQuestBox(s, rec, DAY(21)), /QUEST_CLAIMED/);
  rollDay(s, DAY(22));
  const none = {wrongs: 9, test: 0, study: 0};
  assert.deepEqual(questView(s, none, DAY(22)).items.map(i => i.done), [0, 0, 0]);
  assert.equal(questView(s, none, DAY(22)).streak, 1, 'yesterday still counts toward the run');
});

test('오늘 할 일: 5 days in a row give a 특별 상자; a missed day starts again', () => {
  const s = initialPetState(DAY(1));
  const rec = {wrongs: 0, test: 1, study: 1};
  const finish = (d: number) => { rollDay(s, DAY(d)); noteQuest(s, 'feed'); return claimQuestBox(s, rec, DAY(d)); };
  for (const d of [1, 2, 3, 4]) assert.equal(finish(d).special, false);
  rollDay(s, DAY(5)); noteQuest(s, 'feed');
  assert.equal(questView(s, rec, DAY(5)).special, true, 'told before opening');
  assert.deepEqual(claimQuestBox(s, rec, DAY(5)), {items: ['candy', 'candy', 'cake', 'energy_drink'], special: true, streak: 5});
  assert.equal(finish(7).streak, 1);
});

test('가방: a snack is given without points, under the same daily limits; none left → 가방에 없어요', () => {
  const s = initialPetState(DAY(21)); s.points = 0; s.snacks = {coffee: 3, cake: 1};
  s.pets[0].energy = 10;
  buyItem(s, 'coffee', true); buyItem(s, 'coffee', true);
  assert.equal(s.snacks.coffee, 1);
  assert.throws(() => buyItem(s, 'coffee', true), /PET_ENERGY_ITEM_USED/, 'two energy items a day still');
  buyItem(s, 'cake', true);
  assert.equal(s.snacks.cake, undefined);
  assert.throws(() => buyItem(s, 'cake', true), /PET_BAG_EMPTY/);
  assert.throws(() => buyItem(s, 'uniform', true), /PET_BAG_EMPTY/);
  assert.equal(s.points, 0);
});

test('오늘 할 일 records: 단어 테스트 / 단어장 공부 by the time Firestore wrote them (not a date the screen sent), wrong answers waiting', async () => {
  const at = (iso: string) => ({toMillis: () => Date.parse(iso)});
  const docs = [
    {createTime: at('2026-10-21T01:00:00Z'), data: () => ({type: 'test', totalItems: 20, score: 8, incorrectAnswers: [{word: 'a'}, {word: 'b', isReviewed: true}]})},
    {createTime: at('2026-10-21T01:30:00Z'), data: () => ({type: 'test', totalItems: 20, score: 3})},                              // left after 3 words
    {createTime: at('2026-10-21T02:00:00Z'), data: () => ({type: 'flashcard', totalItems: 10})},
    {createTime: at('2026-10-20T02:00:00Z'), data: () => ({type: 'test', totalItems: 20, createdAt: at('2026-10-21T02:00:00Z'), incorrectAnswers: [{word: 'c'}]})}, // written yesterday
    {data: () => ({type: 'test', totalItems: 5})},                                                                                 // no write time
  ];
  const q: any = {where: () => q, orderBy: () => q, limit: () => q, get: async () => ({docs})};
  assert.deepEqual(await readQuestRecords({collection: () => q}, 'kid', DAY(21)), {wrongs: 2, test: 1, study: 1});
  assert.deepEqual(await readQuestRecords({collection: () => { throw Error('down'); }}, 'kid', DAY(21)), {wrongs: 0, test: 0, study: 0});
});

test("오답 복습 marked on the server: only the student's own answer not reviewed yet", async () => {
  let doc: any = {uid: 'kid', incorrectAnswers: [{word: 'apple'}, {word: 'pear', isReviewed: true}]};
  const ref = {}, db: any = {collection: () => ({doc: () => ref}), runTransaction: (f: any) => f({get: async () => ({data: () => doc}), update: (_r: any, v: any) => { doc = {...doc, ...v}; }})};
  assert.equal(await markWrongReviewed(db, 'kid', 's1', 'apple'), true);
  assert.equal(doc.incorrectAnswers[0].isReviewed, true);
  assert.equal(await markWrongReviewed(db, 'kid', 's1', 'apple'), false, 'already reviewed');
  assert.equal(await markWrongReviewed(db, 'kid', 's1', 'pear'), false);
  assert.equal(await markWrongReviewed(db, 'other', 's1', 'apple'), false, 'not their record');
});
