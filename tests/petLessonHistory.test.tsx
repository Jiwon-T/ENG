import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { PointsHistory } from '../src/components/pet/PetCoupon';

test('포인트 내역: each 수업 line apart, a lowered 평가 as a minus; a 수정 that went back and forth is hidden', () => {
  const ledger: any[] = [
    {day: '2026-10-21', kind: 'class', label: '출석·숙제 상·태도 최상', points: 80},
    {day: '2026-10-21', kind: 'class', label: '평가 수정', points: -15},
    {day: '2026-10-22', kind: 'class', label: '평가 수정', points: 0},
    {day: '2026-10-22', kind: 'study', label: '단어 테스트', points: 20},
    {day: '2026-10-22', kind: 'study', label: '오답 복습', points: 6},
  ];
  const html = renderToStaticMarkup(<PointsHistory coupon={{month: '2026-10', earned: 91}} ledger={ledger} defaultOpen/>);
  assert.match(html, /출석·숙제 상·태도 최상<\/span><b class="flex-none font-bold ">\+80<\/b>/);
  assert.match(html, /평가 수정<\/span><b class="flex-none font-bold text-slate-500">−15<\/b>/);
  assert.equal((html.match(/평가 수정/g) || []).length, 1, 'the 0 line on 10/22 is not shown');
  assert.match(html, /단어 테스트 · 오답 복습<\/span><b class="flex-none font-bold ">\+26<\/b>/, 'other kinds stay one line a day');
});
