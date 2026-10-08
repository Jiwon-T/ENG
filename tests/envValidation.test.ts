import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getFirebaseAdmin } from '../api/_lib/firebaseAdmin.ts';
import { lookupStudentAndGuardianContact } from '../api/_lib/notion.ts';

// 등록된 서버 환경변수 목록
export const OFFICIAL_SERVER_ENV_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIRESTORE_DATABASE_ID',
  'ADMIN_UID',
  'PHONE_PIN_PEPPER',
  'PARENT_SESSION_SECRET',
  'MAKE_NOTION_WEBHOOK_SECRET',
  'NOTION_INTEGRATION_TOKEN',
  'NOTION_STUDENT_DATABASE_ID',
  'MESSAGE_TEMPLATE_READ_MODE',
  'MESSAGE_TEMPLATE_SYNC_ENABLED',
  'MESSAGE_TEMPLATE_WORKER_SECRET',
  'ACADEMY_DIRECTORY_READ_MODE',
  'ACADEMY_DIRECTORY_SYNC_ENABLED',
  'ACADEMY_CORE_MODE',
  'BATI_WEBHOOK_URL',
  'BATI_MESSAGE_PARAM',
  'BATI_RECIPIENT_PARAM',
  'BATI_WEBHOOK_METHOD',
  'BATI_PAYLOAD_MODE',
  'BATI_RESPONSE_RULE',
  'BATI_SECURITY_HEADER_NAME',
  'BATI_SECURITY_HEADER_VALUE',
] as const;

describe('Environment Variable and Configuration Enforcement Tests', () => {
  it('1. .env.example strictly matches registered server environment variables with zero divergence', () => {
    const envExample = fs.readFileSync('.env.example', 'utf8');
    const parsedVars = envExample
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => line.split('=')[0].trim());

    assert.equal(
      parsedVars.length,
      OFFICIAL_SERVER_ENV_VARS.length,
      `Expected exactly ${OFFICIAL_SERVER_ENV_VARS.length} vars in .env.example, found ${parsedVars.length}`
    );

    for (const officialVar of OFFICIAL_SERVER_ENV_VARS) {
      assert.ok(
        parsedVars.includes(officialVar),
        `Official env var ${officialVar} is missing from .env.example`
      );
    }

    for (const parsedVar of parsedVars) {
      assert.ok(
        (OFFICIAL_SERVER_ENV_VARS as readonly string[]).includes(parsedVar),
        `Unexpected env var ${parsedVar} in .env.example`
      );
    }
  });

  it('2. All server code in api/ references ONLY the official environment variables', () => {
    const allowedEnvNames = new Set<string>([
      ...OFFICIAL_SERVER_ENV_VARS,
      'NODE_ENV', // 표준 런타임 변수 허용 (verify-pin secure cookie 분기용)
    ]);

    const apiFiles: string[] = [];
    function scanDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) scanDir(full);
        else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) apiFiles.push(full);
      }
    }
    scanDir('api');

    const referencedEnvVars = new Set<string>();
    for (const file of apiFiles) {
      // gemini.ts는 기존 Gemini 프록시이므로 이번 리포트 시스템 환경변수 검사에서 분리 확인
      if (file.endsWith('gemini.ts')) continue;

      const code = fs.readFileSync(file, 'utf8');
      const matches1 = code.matchAll(/process\.env\.([A-Z0-9_]+)/g);
      for (const m of matches1) referencedEnvVars.add(m[1]);

      const matches2 = code.matchAll(/getSecretOrThrow\(['"]([A-Z0-9_]+)['"]/g);
      for (const m of matches2) referencedEnvVars.add(m[1]);
    }

    for (const usedVar of referencedEnvVars) {
      assert.ok(
        allowedEnvNames.has(usedVar),
        `api/ code uses unregistered environment variable: ${usedVar}`
      );
    }

    for (const officialVar of OFFICIAL_SERVER_ENV_VARS) {
      assert.ok(
        referencedEnvVars.has(officialVar),
        `Official variable ${officialVar} is not referenced by any server code in api/`
      );
    }
  });

  it('3. getFirebaseAdmin throws CONFIG_ERROR when FIRESTORE_DATABASE_ID is missing (no fallback)', () => {
    const origDb = process.env.FIRESTORE_DATABASE_ID;
    const origProj = process.env.FIREBASE_PROJECT_ID;
    const origEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const origKey = process.env.FIREBASE_PRIVATE_KEY;

    try {
      process.env.FIREBASE_PROJECT_ID = 'test-proj';
      process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
      process.env.FIREBASE_PRIVATE_KEY = 'test-key';
      delete process.env.FIRESTORE_DATABASE_ID;

      assert.throws(() => getFirebaseAdmin(), /CONFIG_ERROR.*FIRESTORE_DATABASE_ID/);
    } finally {
      if (origDb) process.env.FIRESTORE_DATABASE_ID = origDb;
      if (origProj) process.env.FIREBASE_PROJECT_ID = origProj;
      if (origEmail) process.env.FIREBASE_CLIENT_EMAIL = origEmail;
      if (origKey) process.env.FIREBASE_PRIVATE_KEY = origKey;
    }
  });

  it('4. lookupStudentAndGuardianContact throws CONFIG_ERROR when NOTION_STUDENT_DATABASE_ID is missing', async () => {
    const origToken = process.env.NOTION_INTEGRATION_TOKEN;
    const origDb = process.env.NOTION_STUDENT_DATABASE_ID;

    try {
      process.env.NOTION_INTEGRATION_TOKEN = 'test_token';
      delete process.env.NOTION_STUDENT_DATABASE_ID;

      await assert.rejects(
        async () => await lookupStudentAndGuardianContact('학생1'),
        /CONFIG_ERROR.*NOTION_STUDENT_DATABASE_ID/
      );
    } finally {
      if (origToken) process.env.NOTION_INTEGRATION_TOKEN = origToken;
      if (origDb) process.env.NOTION_STUDENT_DATABASE_ID = origDb;
    }
  });

  it('5. All relative imports in api/**/*.ts end strictly with .js and none end with .ts (Vercel ESM runtime compatibility)', () => {
    const apiFiles: string[] = [];
    function scanDir(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          apiFiles.push(full);
        }
      }
    }
    scanDir('api');

    assert.ok(apiFiles.length >= 10, `Expected at least 10 api TypeScript files, found ${apiFiles.length}`);

    const relativeImportRegex = /from\s+['"](\.[^'"]+)['"]/g;

    let relativeImportCount = 0;
    for (const filePath of apiFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      let match: RegExpExecArray | null;
      while ((match = relativeImportRegex.exec(content)) !== null) {
        relativeImportCount++;
        const importPath = match[1];

        // 상대 경로 import는 절대 .ts로 끝나면 안 됨
        assert.ok(
          !importPath.endsWith('.ts'),
          `Vercel runtime violation: ${filePath} contains relative import ending in .ts: "${importPath}"`
        );

        // JSON modules require an explicit Node ESM type attribute.
        const jsonModule=importPath.endsWith('.json')&&/^\s+with\s*\{\s*type\s*:\s*['"]json['"]\s*\}/.test(content.slice(relativeImportRegex.lastIndex));
        if(jsonModule)assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(path.resolve(path.dirname(filePath),importPath),'utf8')));
        // Executable modules still require .js; JSON is checked separately above.
        assert.ok(
          importPath.endsWith('.js')||jsonModule,
          `Node ESM violation: ${filePath} contains relative import not ending in .js: "${importPath}"`
        );
      }
    }

    assert.ok(relativeImportCount >= 20, `Expected at least 20 relative imports in api files, found ${relativeImportCount}`);
  });

  it('6. jwks-rsa dependency strictly overrides jose to 5.10.0 and loads via CommonJS without ERR_REQUIRE_ESM', () => {
    // 1. package.json overrides 검증
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.equal(
      pkg.overrides?.['jwks-rsa']?.jose,
      '5.10.0',
      'package.json must contain "overrides": { "jwks-rsa": { "jose": "5.10.0" } }'
    );

    // 2. package-lock.json 검증
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    const packages = lock.packages || {};
    
    // node_modules/jose 버전 확인
    const directJose = packages['node_modules/jose'];
    if (directJose) {
      assert.equal(directJose.version, '5.10.0', 'node_modules/jose in package-lock.json must be 5.10.0');
    }
    
    // jwks-rsa 하위 또는 루트의 jose가 6.x가 아님을 확인
    for (const [pkgPath, pkgInfo] of Object.entries(packages) as [string, { version?: string }][]) {
      if (pkgPath.endsWith('node_modules/jose') || pkgPath.includes('jwks-rsa/node_modules/jose')) {
        assert.ok(
          !pkgInfo.version?.startsWith('6.'),
          `Found jose 6.x in package-lock.json at ${pkgPath}: ${pkgInfo.version}`
        );
      }
    }

    // 3. CommonJS require('jwks-rsa') 테스트
    assert.doesNotThrow(() => {
      const req = createRequire(import.meta.url);
      const jwks = req('jwks-rsa');
      assert.ok(jwks, 'jwks-rsa module should be defined');
    }, 'require("jwks-rsa") threw an error');
  });
});

