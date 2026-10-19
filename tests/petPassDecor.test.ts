import test from 'node:test';
import assert from 'node:assert/strict';
import {buyItem, equipItem, initialPetState} from '../api/_lib/pet.js';
import {PET_ITEMS, passAllows, petItem} from '../src/lib/petCatalog.js';
import {hasSceneArt} from '../src/components/pet/PetScenes.js';
import {placeDecor} from '../api/_lib/petCoupon.js';

const NOW = Date.parse('2026-10-19T03:00:00Z');

test('패스 꾸미기: pass-only rooms (looks only) open by plan, are never bought, and each has its art', () => {
  const rooms = PET_ITEMS.filter(i => i.pass);
  assert.deepEqual(rooms.map(i => [i.id, i.pass]), [['cherry_window', 'pet'], ['night_sky', 'premium'], ['seaside', 'premium']]);
  assert.ok(rooms.every(i => i.category === 'background' && hasSceneArt(i.id)));
  assert.deepEqual(['free', 'pet', 'premium'].map(p => passAllows(petItem('cherry_window'), p)), [false, true, true]);
  assert.deepEqual(['free', 'pet', 'premium'].map(p => passAllows(petItem('night_sky'), p)), [false, false, true]);
  assert.equal(passAllows(petItem('galaxy'), 'premium'), false, 'not a pass item');
  const s = initialPetState(NOW);
  assert.throws(() => equipItem(s, 'night_sky', 'pet'), /PET_PASS_ITEM/);
  equipItem(s, 'cherry_window', 'pet');
  assert.equal(s.background, 'cherry_window');
  equipItem(s, 'night_sky', 'premium');
  assert.equal(s.background, 'night_sky');
  assert.ok(!s.inventory.includes('night_sky'), 'not added to the inventory (it is the pass that opens it)');
  assert.throws(() => buyItem(s, 'seaside'), /PET_ITEM_NOT_FOUND/);
});

test('꾸미기 in a 패스 room: allowed while that pass is on, not after', () => {
  const s: any = initialPetState(NOW); s.medals = ['2026-10'];
  placeDecor(s, 'night_sky', [{id: '2026-10', x: 10, y: 10}], 'premium');
  assert.deepEqual(s.decor.night_sky.map((d: any) => d.id), ['2026-10']);
  assert.throws(() => placeDecor(s, 'night_sky', [], 'pet'), /PET_BAD_ACTION/, '펫 패스: not a premium room');
  assert.throws(() => placeDecor(s, 'cherry_window', []), /PET_BAD_ACTION/, 'no pass');
});
