import test from 'node:test';
import assert from 'node:assert/strict';
import { parentStartupSlug } from '../src/lib/startupRoute.ts';
test('startup routes only parent slugs into the lightweight parent entry', () => {
  assert.equal(parentStartupSlug('/alice123'), 'alice123');
  assert.equal(parentStartupSlug('/report/alice123'), 'alice123');
  for (const path of ['/', '/login', '/api', '/teacher-room', '/auth', '/assets', '/alice123/other', '/ab', '/ALEX']) assert.equal(parentStartupSlug(path), null);
});
