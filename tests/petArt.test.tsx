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
