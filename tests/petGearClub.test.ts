import test from 'node:test';
import assert from 'node:assert/strict';
import {gearArt, gearPiece} from '../src/components/pet/petGearArt.ts';

test('견습 몽둥이 (weapon tier 0): a club for 검사 and 마법사 alike (never the 마법사 staff); later weapons keep their own look', () => {
  const club = gearArt('knight', {weapon: 0});
  assert.match(club, /M98\.2 40 C108 40 109 52 107 64/);
  assert.equal(gearArt('mage', {weapon: 0}), club);
  assert.equal(gearPiece('mage', 'weapon', 0).box, gearPiece('knight', 'weapon', 0).box, 'the icon is the club too');
  assert.notEqual(gearArt('mage', {weapon: 1}), gearArt('knight', {weapon: 1}));
});
