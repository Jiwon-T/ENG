import test from 'node:test';
import assert from 'node:assert/strict';
import { actionOf, recordTiming, recentTimings, clearTimings } from '../src/lib/requestTimings.ts';
import { startServerTiming } from '../api/_lib/serverTiming.ts';

test('timing labels keep only the endpoint, action and section (no student keys or values)', () => {
    assert.equal(actionOf('/api/teacher/workspace?action=bootstrap&section=lesson&draftsSize=6'), 'teacher/workspace · bootstrap · lesson');
    assert.equal(actionOf('/api/teacher/workspace?action=student-profile&studentKey=11111111-1111-4111-8111-111111111111'), 'teacher/workspace · student-profile');
    assert.equal(actionOf('/api/teacher/workspace', { method: 'POST', body: JSON.stringify({ action: 'save-draft', data: { content: '비밀' } }) }), 'teacher/workspace · save-draft');
    clearTimings();
    for (let i = 0; i < 45; i++) recordTiming({ at: i, action: 'a', ms: i, token: 0, status: 200, server: [] });
    assert.equal(recentTimings().length, 40); assert.equal(recentTimings()[0].ms, 44);
});

test('server timing header lists stages, total, and a cold-start flag only on the first request', () => {
    const run = () => { const headers: any = {}; const res: any = { headersSent: false, setHeader: (k: string, v: string) => { headers[k] = v; }, end() { return 'sent'; } };
        const t = startServerTiming(res); t.mark('auth'); t.add('auth-token', 12.34); res.end('{}'); return headers['Server-Timing'] as string; };
    const first = run(), second = run();
    assert.match(first, /^cold;desc="서버 깨어남", auth;dur=[\d.]+, auth-token;dur=12\.3, total;dur=[\d.]+$/);
    assert.doesNotMatch(second, /cold/);
});
