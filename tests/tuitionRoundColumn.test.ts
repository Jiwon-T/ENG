import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('수강료 계산 › 회차 칸: the latest 회차 first, then 청구 (소수점 버림) · 일지; a subject without 회차 shows its 일지 count', () => {
  const src = fs.readFileSync(new URL('../src/components/teacher/TuitionCalculator.tsx', import.meta.url), 'utf8');
  assert.match(src, />회차<\/th>/); assert.match(src, /수강료는 소수점을 버린 회차로 계산해요/);
  assert.match(src, /\{r\.lastRound\}회<small>청구 \{typeof r\.taught==='number'\?r\.taught:Math\.floor\(r\.lastRound\)\}회 · 일지 \{r\.written\}<\/small>/);
  assert.match(src, /일지 \{r\.written\}<small>회차 없음 · 일지 수로 계산<\/small>/);
  assert.equal(src.includes('회 반영'), false, 'no more "N회 반영" (it read like 일지 반영)');
});
