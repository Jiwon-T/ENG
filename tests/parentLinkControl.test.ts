import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('학부모 주소 카드: another student in the same card starts over (address and guardian phone cleared, reloaded when open); a late answer for the student before is dropped', () => {
  const src = readFileSync(new URL('../src/components/teacher/ParentLinkControl.tsx', import.meta.url), 'utf8');
  assert.match(src, /useEffect\(\(\)=>\{setCurrent\(undefined\);setPhone\(''\);setInput\(''\);setMessage\(''\);setCopied\(false\);if\(open\)void load\(\);\},\[studentKey\]\)/);
  assert.match(src, /const load=async\(\)=>\{const key=studentKey;setMessage\(''\);const r=await call\('GET'\);if\(shownKey\.current!==key\)return;/);
  assert.match(src, /if\(shownKey\.current!==key\)return;\n   if\(!r\.ok\|\|!r\.data\?\.ok\)\{setMessage\(failureText\(r\)\);return;\}\n   setCurrent\(slug\);/, 'a save answer for the student before is dropped too');
});
