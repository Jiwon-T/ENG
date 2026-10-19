import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PetCharacter} from '../src/components/pet/PetCharacters';
import {PET_CHARACTERS, PET_ITEMS} from '../src/lib/petCatalog';

const draw = (props: any) => renderToStaticMarkup(<PetCharacter stage="teen" {...props} />);

test('pet art: every character has its own drawing and every wearable shop item changes how it looks', () => {
  const looks = PET_CHARACTERS.map(c => draw({character: c.id}));
  assert.equal(new Set(looks).size, PET_CHARACTERS.length, 'no character falls back to another');
  for (const c of PET_CHARACTERS) {
    const plain = draw({character: c.id});
    for (const item of PET_ITEMS.filter(i => i.category === 'clothing' || i.category === 'accessory')) {
      const key = item.category === 'clothing' ? 'clothing' : 'accessory';
      assert.notEqual(draw({character: c.id, [key]: item.id}), plain, `${c.name} + ${item.name}`);
    }
  }
});

test('장비 그림: a small face shows the helmet and the head 소품 together (no weapon, no glow); the big one covers them', () => {
  const gear = {style: 'knight' as const, look: {weapon: 2, helmet: 2, armor: 2, shoulder: 2, gloves: 2, boots: 2}, full: 2};
  const crown = draw({character: 'molang', accessory: ['crown']}), withCrown = (html: string) => html.includes(crown.match(/#f6d365/)![0]);
  const face = draw({character: 'molang', portrait: true, accessory: ['crown'], gear});
  assert.ok(withCrown(face), 'the 소품 still shows');
  assert.match(face, /pg-tw/); // the 수정 helmet gem
  assert.doesNotMatch(face, /M95 106|opacity="\.2"/); // no sword, no set glow
  const big = draw({character: 'molang', accessory: ['crown'], gear});
  assert.ok(!withCrown(big), 'the helmet covers the head 소품 on the big pet');
  assert.match(big, /<g opacity="\.2"><circle class="pg-pulse"/); // the glow kept soft
  assert.ok(withCrown(draw({character: 'molang', portrait: true, accessory: ['crown'], gear: null})), 'gear hidden: the 소품 only');
});
