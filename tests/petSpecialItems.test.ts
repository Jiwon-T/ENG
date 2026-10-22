import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {buyItem, equipItem, initialPetState, publicPetState} from '../api/_lib/pet.js';
import {placeDecor} from '../api/_lib/petCoupon.js';
import {handlePet} from '../api/_lib/student/pet.js';
import {PET_ITEMS, petItem, roomDecor} from '../src/lib/petCatalog.js';

const NOW = Date.parse('2026-10-22T03:00:00Z');

test('특별 (목표 물건): 분수대 2,500 · 그랜드 피아노 4,000 · 별빛 텐트 6,000 (방 소품) · 오로라 언덕 10,000 (배경), only in their own tab', () => {
  assert.deepEqual(PET_ITEMS.filter(i => i.special).map(i => [i.id, i.price, i.category]), [['fountain', 2500, 'decor'], ['grand_piano', 4000, 'decor'], ['star_tent', 6000, 'decor'], ['aurora_hill', 10000, 'background']]);
  assert.equal(roomDecor('fountain')?.name, '분수대'); assert.equal(roomDecor('moss_pot')?.name, '이끼 화분'); assert.equal(roomDecor('aurora_hill'), undefined);
});

test('특별 소품: bought with points, placed in the room like the 금메달 (꾸미기), never worn; 오로라 언덕 is a room', () => {
  const s = initialPetState(NOW); s.points = 20_000;
  buyItem(s, 'fountain');
  assert.equal(s.points, 17_500);
  assert.equal(buyItem(s, 'fountain').message, '이미 가지고 있어요.');
  placeDecor(s, 'default', [{id: 'fountain', x: 30, y: 60}]);
  assert.deepEqual(s.decor?.default, [{id: 'fountain', x: 30, y: 60}]);
  assert.throws(() => placeDecor(s, 'default', [{id: 'grand_piano', x: 1, y: 1}]), /PET_BAD_ACTION/, 'not bought');
  assert.throws(() => equipItem(s, 'fountain'), /PET_ITEM_NOT_FOUND/);
  buyItem(s, 'aurora_hill'); equipItem(s, 'aurora_hill');
  assert.equal(s.background, 'aurora_hill');
  assert.equal(petItem('aurora_hill')?.price, 10_000);
});

test('목표 물건: set to a 특별 item (null clears); shown until it is bought', async () => {
  const f = registrationFirestore(); f.rows.set('users/kid', {}); const s = initialPetState(NOW); s.points = 3000; f.rows.set('petStates/kid', s);
  const call = async (body: any) => { let out: any; await handlePet({method: 'POST', headers: {authorization: 'Bearer t'}, body} as any, {setHeader() {}, end(v: string) { out = JSON.parse(v); }, statusCode: 0} as any, {verify: async () => ({uid: 'kid'}), db: () => f.db, generate: async () => '{}', now: () => NOW} as any); return out; };
  assert.equal((await call({action: 'goal-set', itemId: 'uniform'})).error, 'PET_ITEM_NOT_FOUND', 'only 특별 items');
  assert.equal((await call({action: 'goal-set', itemId: 'fountain'})).state.goal, 'fountain');
  assert.equal((await call({action: 'buy', itemId: 'fountain'})).state.goal, null, 'bought: the goal is done');
  assert.equal((await call({action: 'goal-set', itemId: 'star_tent'})).state.goal, 'star_tent');
  assert.equal((await call({action: 'goal-set', itemId: null})).state.goal, null);
  assert.equal(publicPetState(initialPetState(NOW)).goal, null);
});
