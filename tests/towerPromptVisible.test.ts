import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/components/pet/TowerView.tsx',import.meta.url),'utf8');

test('탑 전투: a message (몬스터가 깼어요! …) never hides the word to answer',()=>{
 assert.match(src,/\{q && !feedback \? <>\{message && <span[^>]*>\{message\}<\/span>\}\{prompt\}<\/>/,'while a word is asked, the message sits above the prompt');
 assert.equal(/\{message \|\| \(q \?/.test(src),false,'the old either-or (message replaced the prompt) is gone');
});
