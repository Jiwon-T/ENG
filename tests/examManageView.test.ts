import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/components/exam/ExamMaterialCatalog.tsx',import.meta.url),'utf8');
const manager=readFileSync(new URL('../src/components/teacher/WordbookManager.tsx',import.meta.url),'utf8');

test('선생님 시험기간 tab uses the 단어장 tab layout: tools column, compact cards, no extra heading',()=>{
 assert.match(src,/manage\?managedView:/,'teachers get their own view; students keep the catalogue');
 assert.match(src,/wordbook-tools flex flex-col gap-2/,'the same tools column as the 단어장 tab');
 assert.equal(src.includes('학교별 시험기간 관리'),false,'no second heading under the tabs');
 assert.match(src,/className="exam-m-card"/);
 assert.match(src,/텍스트 일괄 등록으로 단어장 만들기/);
});
test('the 시험기간 tab can bulk-add an exam wordbook',()=>{
 assert.match(manager,/onBulkAdd=\{\(\) => \{setNewWbCategory\('exam'\);setIsBulkAddOpen\(true\);\}\}/);
});
