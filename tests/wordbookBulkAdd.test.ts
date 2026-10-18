import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/components/teacher/WordbookManager.tsx',import.meta.url),'utf8');

test('엑셀 일괄 등록 inside an open wordbook adds to it, even with a "단어장 제목 :" line; only the list makes a new one',()=>{
 assert.match(src,/const title = selectedWordbook \? '' : parsed\.title \|\| '';/,'the title is ignored while a wordbook is open');
 assert.match(src,/let targetWbId = selectedWordbook\?\.id;\s+\/\/[^\n]*\s+if \(title\) \{/,'a new wordbook only when a title is left');
 assert.match(src,/const startOrder = targetWbId === selectedWordbook\?\.id && words\.length \?/,'added after the open wordbook\'s last word');
 assert.match(src,/\{selectedWordbook \? <>이 단어장에 추가됩니다\. "단어장 제목 :" 줄은 무시해요\./,'the dialog says where the words go');
});
