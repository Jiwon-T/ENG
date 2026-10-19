import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {textareaHeight} from '../src/lib/useAutoGrowTextarea';

test('시험범위·선생님 메모 grow with the text up to 12 lines before they scroll',()=>{
 const tsx=readFileSync(new URL('../src/components/teacher/LessonAudience.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/teacher/teacherWorkspace.css',import.meta.url),'utf8');
 assert.equal((tsx.match(/<AutoTextarea minRows=\{1\} maxRows=\{12\}/g)||[]).length,2);
 assert.match(css,/\.teacher-only-box textarea\.auto-lesson-textarea\{--textarea-min-rows:1;--textarea-max-rows:12;min-height:36px;max-height:none;/,'no fixed pixel cap below 12 lines');
 // Six lines of text (20px each, 12px padding, 2px border) show in full; past 12 lines the box stops and scrolls.
 assert.equal(textareaHeight(20,12,2,6*20+12,1,12),6*20+12+2);
 assert.equal(textareaHeight(20,12,2,20*20+12,1,12),12*20+12+2);
});
