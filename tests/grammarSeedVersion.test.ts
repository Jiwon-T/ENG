import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the grammar seed version reads every data module the seeds use', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  for (const m of ['irregularVerbsData', 'grammarSets', 'comparativeData', 'grammarCrammingPool']) assert.ok(app.includes(`import('./lib/${m}')`), m);
  // Every module-level data constant in the seed files is exported, so the version sees it.
  for (const file of ['src/lib/grammarSets.ts', 'src/lib/irregularVerbsData.ts', 'src/lib/comparativeData.ts'])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /^(const|let|var) [A-Za-z_]+/m, file);
  // Data modules the seed files import are hashed too.
  for (const file of ['src/lib/grammarSets.ts', 'src/lib/irregularVerbsData.ts', 'src/lib/comparativeData.ts'])
    for (const [, mod] of fs.readFileSync(file, 'utf8').matchAll(/(?:from |import\()'\.\/([A-Za-z]+)'/g)) if (mod !== 'firebase') assert.ok(app.includes(`import('./lib/${mod}')`), `${file}: ${mod}`);
});
