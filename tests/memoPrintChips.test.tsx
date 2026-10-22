import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import MemoPrintChips from '../src/components/teacher/MemoPrintChips';

const preset = [{ id: 'w', title: '워드마스터 중등 고난도' }];
const render = (text: string) => renderToStaticMarkup(<MemoPrintChips text={text} preset={preset} />);

test('바로 출력 칩: "Day 1,2,3,4" is one 1~4 chip with 한번에/나눠서; written apart it starts 나눠서 (1~2, 3~4)', () => {
  const once = render('단어 : 중등 고난도 Day 1,2,3,4 차례');
  assert.match(once, /워드마스터 중등 고난도 · Day 1~4/);
  assert.match(once, /aria-pressed="true"[^>]*>한번에/);
  const apart = render('단어 : 중등 고난도 Day 1~2, 3~4');
  assert.match(apart, /워드마스터 중등 고난도 · Day 1~2/); assert.match(apart, />Day 3~4<\/button>/);
  assert.match(apart, /aria-pressed="true"[^>]*>나눠서/);
  const two = render('단어 : 중등 고난도 Day 1,2');
  assert.match(two, /Day 1~2/); assert.match(two, /한번에/); assert.match(two, /나눠서/);
  assert.doesNotMatch(render('단어 : 중등 고난도 Day 3'), /나눠서/, 'one DAY: nothing to split');
});
