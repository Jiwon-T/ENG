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

test('탑 몬스터 그림: every monster and boss of the 10 zones has its own drawing', async () => {
  const {TowerMonster} = await import('../src/components/pet/TowerMonster');
  const {TOWER_ZONES} = await import('../src/lib/petCatalog');
  const kinds = TOWER_ZONES.flatMap(z => [...z.monsters.map(m => m.kind), z.boss.kind]).filter(k => k !== 'gatekeeper' && k !== 'crystal_queen' && k !== 'sphinx' && k !== 'frost_dragon');
  const drawn = kinds.map(kind => renderToStaticMarkup(<TowerMonster kind={kind} />));
  for (const [i, html] of drawn.entries()) assert.ok(html.length > 400, `${kinds[i]} is drawn`);
  assert.equal(new Set(drawn).size, new Set(kinds).size, 'no two monsters look the same');
});

test('탑 보스 큰 그림: every zone boss has its own big picture, and they all move (stopped by 움직임 줄이기)', async () => {
  const {MonsterArt} = await import('../src/components/pet/TowerCodex');
  const {TOWER_ZONES} = await import('../src/lib/petCatalog');
  const {readFileSync} = await import('node:fs');
  const pet = {character: 'molang', level: 10, clothing: null, accessories: {}} as any;
  for (const z of TOWER_ZONES) {
    const html = renderToStaticMarkup(<MonsterArt kind={z.boss.kind} boss size={150} pet={pet} />);
    assert.match(html, new RegExp(`aria-label="(${z.boss.name}|보스 몬스터)"`), z.boss.name);
    assert.match(html, /class="bx-/, `${z.boss.name} moves`);
  }
  const css = readFileSync('src/index.css', 'utf8');
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.bx-flap/);
});

test('장비 아이콘: the same piece shown twice gets its own clip ids (TowerGearIcon passes its useId)', async () => {
  const {gearPiece} = await import('../src/components/pet/petGearArt');
  const ids = (svg: string) => [...svg.matchAll(/<clipPath id="([^"]+)"/g)].map(m => m[1]);
  const a = ids(gearPiece('knight', 'armor', 8, 'icA').svg), b = ids(gearPiece('knight', 'armor', 8, 'icB').svg);
  assert.ok(a.length > 0); assert.ok(a.every(id => !b.includes(id)));
  const {readFileSync} = await import('node:fs');
  assert.match(readFileSync('src/components/pet/TowerHall.tsx', 'utf8'), /gearPiece\([^)]*`ic\$\{uid/);
});

test('탑 장식 그림: all ten (floors 10–100) are drawn and move a little', async () => {
  const {DecorArt} = await import('../src/components/pet/PetCoupon');
  const {TOWER_DECOR} = await import('../src/lib/petCatalog');
  assert.deepEqual(TOWER_DECOR.map(d => d.floor), [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  for (const d of TOWER_DECOR) {
    const html = renderToStaticMarkup(<DecorArt id={d.id} />);
    assert.match(html, new RegExp(`aria-label="${d.name}"`));
    assert.ok(html.length > 900, `${d.name} has its detail`);
    assert.match(html, /class="(dx|bx|pg|px)-/, `${d.name} moves`);
  }
});
