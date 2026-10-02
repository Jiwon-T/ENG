import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
test('service worker caches immutable assets, bypasses authenticated APIs and refreshes HTML', async () => {
  const listeners: Record<string, any> = {};
  const cached = new Map();
  let fetches = 0;
  const cache = { match: async (r: any) => cached.get(r.url), put: async (r: any, response: any) => { cached.set(r.url, response); } };
  const response: any = { ok: true, type: 'basic', clone: () => response };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    URL, self: { location: { origin: 'https://www.jiwont.kr' }, addEventListener: (name: string, listener: any) => { listeners[name] = listener; } },
    caches: { open: async () => cache, match: async (r: any) => cached.get(r.url) },
    fetch: async () => { fetches++; return response; },
  });
  const request = async (path: string, method = 'GET') => {
    let result: any;
    listeners.fetch({ request: { url: `https://www.jiwont.kr${path}`, method }, respondWith: (promise: any) => { result = promise; } });
    return result ? await result : undefined;
  };
  await request('/assets/index-12345678.js'); await request('/assets/index-12345678.js');
  assert.equal(fetches, 1);
  assert.equal(await request('/api/student/academic'), undefined);
  assert.equal(await request('/api/teacher/students', 'POST'), undefined);
  assert.equal(fetches, 1);
  await request('/'); await request('/'); assert.equal(fetches, 3);
});
