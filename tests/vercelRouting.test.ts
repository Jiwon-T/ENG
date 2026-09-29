import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Vercel Routing and Top-Level Slug Configuration', () => {
  it('vercel.json enforces 308 permanent redirect from /report/:slug to /:slug', () => {
    const raw = fs.readFileSync('vercel.json', 'utf8');
    const vercelConfig = JSON.parse(raw);

    assert.ok(Array.isArray(vercelConfig.redirects), 'redirects array must exist');
    const redirect = vercelConfig.redirects.find(
      (r: any) => r.source === '/report/:slug'
    );
    assert.ok(redirect, 'Redirect from /report/:slug must be configured');
    assert.equal(redirect.destination, '/:slug');
    assert.equal(redirect.permanent, true);
  });

  it('vercel.json preserves /api/(.*) before catch-all /index.html rewrite', () => {
    const raw = fs.readFileSync('vercel.json', 'utf8');
    const vercelConfig = JSON.parse(raw);

    assert.ok(Array.isArray(vercelConfig.rewrites), 'rewrites array must exist');
    assert.equal(vercelConfig.rewrites[0].source, '/api/(.*)');
    assert.equal(vercelConfig.rewrites[0].destination, '/api/$1');
    assert.equal(vercelConfig.rewrites[1].source, '/(.*)');
    assert.equal(vercelConfig.rewrites[1].destination, '/index.html');
  });

  it('Comprehensive static inspection: No real phone numbers, real PINs, Notion tokens, or secrets across entire codebase', () => {
    // 010-XXXX-XXXX 형태의 실제 한국 휴대폰 번호 패턴
    const realKoreanPhoneRegex = /010-[1-9]\d{3}-\d{4}/g;
    const notionSecretTokenRegex = /ntn_[a-zA-Z0-9]{20,}/g;
    const privateKeyRegex = /-----BEGIN PRIVATE KEY-----/g;
    const leakedPinStr = ['4', '6', '0', '1'].join('');

    function walkDir(dir: string, fileList: string[] = []): string[] {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        const rel = path.relative('.', full).replace(/\\/g, '/');
        if (
          rel.startsWith('node_modules') ||
          rel.startsWith('dist') ||
          rel.startsWith('.git') ||
          rel.endsWith('.zip') ||
          rel.endsWith('.png') ||
          rel.endsWith('.ico')
        ) {
          continue;
        }
        if (item.isDirectory()) {
          walkDir(full, fileList);
        } else {
          fileList.push(full);
        }
      }
      return fileList;
    }

    const allSourceFiles = walkDir('.');

    for (const filePath of allSourceFiles) {
      // 자기 자신(검사 스크립트 파일)은 검사 대상에서 제외
      if (filePath.replace(/\\/g, '/').endsWith('tests/vercelRouting.test.ts')) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');

      // 1. 실제 전화번호 정규식 검사
      const phoneMatches = content.match(realKoreanPhoneRegex);
      assert.equal(phoneMatches, null, `Real phone number pattern matched in ${filePath}: ${phoneMatches}`);

      // 2. 과거 유출되었던 특정 실제 PIN 번호 검사
      assert.equal(
        content.includes(leakedPinStr),
        false,
        `Prohibited leaked PIN found in ${filePath}`
      );

      // 3. Notion 실제 Secret Token 검사
      const notionMatches = content.match(notionSecretTokenRegex);
      assert.equal(notionMatches, null, `Real Notion integration token pattern matched in ${filePath}`);

      // 4. Firebase 실제 Private Key 원문 검사 (.env.example 제외)
      if (filePath !== '.env.example') {
        const privMatches = content.match(privateKeyRegex);
        assert.equal(privMatches, null, `Real Private Key pattern matched in ${filePath}`);
      }
    }
  });
});
