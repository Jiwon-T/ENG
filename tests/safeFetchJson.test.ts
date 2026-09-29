import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeFetchJson } from '../src/lib/safeFetchJson.ts';

describe('SafeFetchJson Robustness Tests', () => {
  it('safeFetchJson handles non-JSON HTML error pages gracefully without throwing syntax error', async () => {
    // Mock global fetch returning HTML 500 error page
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return new Response('<html><body>500 Internal Server Error</body></html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      };

      const result = await safeFetchJson('https://example.com/api/test');
      assert.equal(result.ok, false);
      assert.equal(result.status, 500);
      assert.equal(result.error, 'NON_JSON_RESPONSE');
      assert.equal(result.userMessage, '서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('safeFetchJson parses valid JSON response correctly', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ ok: true, active: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const result = await safeFetchJson<{ ok: boolean; active: boolean }>('https://example.com/api/parent/report-status');
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
      assert.equal(result.data?.active, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('safeFetchJson catches network fetch failure cleanly', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        throw new Error('Connection reset by peer');
      };

      const result = await safeFetchJson('https://example.com/api/test');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'NETWORK_ERROR');
      assert.equal(result.userMessage, '네트워크 연결이 불안정합니다. 인터넷 상태를 확인해 주세요.');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
