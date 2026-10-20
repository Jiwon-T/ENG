import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('학부모 주소 카드: another student in the same card starts over (address and guardian phone cleared, reloaded when open); a late answer is dropped, even for the same student again (A → B → A)', () => {
  const src = readFileSync(new URL('../src/components/teacher/ParentLinkControl.tsx', import.meta.url), 'utf8');
  assert.match(src, /useEffect\(\(\)=>\{gen\.current\+=1;setCurrent\(undefined\);setPhone\(''\);setInput\(''\);setMessage\(''\);setCopied\(false\);if\(open\)void load\(\);\},\[studentKey\]\)/);
  assert.match(src, /const load=async\(\)=>\{const g=\+\+gen\.current;setMessage\(''\);const r=await call\('GET'\);if\(gen\.current!==g\)return;/);
  assert.match(src, /const g=gen\.current;setBusy\(true\);/, 'a save remembers the generation it started in');
  assert.doesNotMatch(src, /shownKey/, 'the student key alone is not enough (A → B → A)');
  assert.match(src, /if\(gen\.current!==g\)return;\n   if\(!r\.ok\|\|!r\.data\?\.ok\)\{setMessage\(failureText\(r\)\);return;\}\n   setCurrent\(slug\);/, 'a save answer for the student before is dropped too');
});
