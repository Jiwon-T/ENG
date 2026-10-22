import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('the page asks browsers not to translate it (quiz words, React crash) and guards the DOM if they do',()=>{
 assert.match(html,/<html lang="ko" translate="no">/);
 assert.match(html,/<meta name="google" content="notranslate" \/>/);
 assert.ok(main.indexOf("import './lib/translateGuard';")>=0&&main.indexOf("import './lib/translateGuard';")<main.indexOf("from 'react'"),'the guard loads before React');
});
