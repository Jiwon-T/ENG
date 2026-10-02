import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecentLearning, saveRecentLearning } from '../src/lib/recentLearning.ts';
test('recent learning is isolated by user and tolerates invalid or unavailable local storage', () => {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => entries.get(key) || null, setItem: (key: string, value: string) => entries.set(key, value) } });
  const recent = { wordbookId: 'book-A', title: '단어', category: 'word' as const, chunk: 2, unitSize: 20 };
  saveRecentLearning('user-A', recent);
  assert.deepEqual(readRecentLearning('user-A'), recent);
  assert.equal(readRecentLearning('user-B'), null);
  entries.set('recent-learning:user-A', '{broken'); assert.equal(readRecentLearning('user-A'), null);
  entries.set('recent-learning:user-A', JSON.stringify({ ...recent, chunk: -1 })); assert.equal(readRecentLearning('user-A'), null);
  entries.set('recent-learning:user-A', JSON.stringify({ ...recent, unitSize: 0 })); assert.equal(readRecentLearning('user-A'), null);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('disabled'); } });
  assert.equal(readRecentLearning('user-A'), null);
  assert.doesNotThrow(() => saveRecentLearning('user-A', recent));
});
