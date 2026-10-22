import test from 'node:test';
import assert from 'node:assert/strict';
import {SNEAK, sneakStep, type SneakPoint} from '../src/lib/towerSneak.ts';
import {sneakLooksPlayed} from '../api/_lib/petTower.js';

/** Drags the finger with `fingerAt(ms)` (60 moves a second) and returns what the browser would send. */
function drag(fingerAt: (ms: number) => number, limitMs = 60000) {
  let last: SneakPoint = {p: 0, t: 0}; const samples: number[][] = [[0, 0]];
  for (let t = 16; t <= limitMs; t += 16) {
    const s = sneakStep(last, Math.min(1, fingerAt(t)), t);
    if (s.wake) return {woke: true, samples, ms: t};
    if (s.next) { last = s.next; samples.push([t, Math.round(s.next.p * 1000) / 1000]); if (s.next.p >= SNEAK.exit) return {woke: false, samples, ms: t}; }
  }
  return {woke: false, samples, ms: limitMs, stuck: true};
}

test('잠든 드래곤: a steady, slightly quick hand gets through, and the server accepts the walk',()=>{
 for (const speed of [0.15, 0.25, 0.3, 0.35]) { // progress per second of the finger
  const r = drag(t => speed * t / 1000);
  assert.equal(r.woke, false, `finger ${speed}/s`);
  assert.equal(sneakLooksPlayed(r.samples, r.ms + 200), true, `server accepts ${speed}/s`);
 }
});
test('잠든 드래곤: a wobbling hand (back and forth) does not wake the dragon',()=>{
 const r = drag(t => 0.25 * t / 1000 + 0.05 * Math.sin(t / 90));
 assert.equal(r.woke, false); assert.equal(sneakLooksPlayed(r.samples, r.ms + 200), true);
});
test('잠든 드래곤: yanking the pet wakes it; pausing and going on is fine',()=>{
 assert.equal(drag(t => 1.5 * t / 1000).woke, true, 'a fast swipe');
 const paused = drag(t => t < 1500 ? 0.25 * t / 1000 : t < 3500 ? 0.375 : 0.375 + 0.25 * (t - 3500) / 1000);
 assert.equal(paused.woke, false); assert.equal(sneakLooksPlayed(paused.samples, paused.ms + 200), true);
});
