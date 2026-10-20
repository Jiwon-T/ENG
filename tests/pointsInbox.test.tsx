import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import PointsInbox from '../src/components/pet/PointsInbox';

test('쌓인 포인트 알림 popup: the total, newest line first, minus lines; a total below 0 says the 평가 changed', () => {
  const html = renderToStaticMarkup(<PointsInbox lines={[{day: '2026-10-21', label: '출석·숙제 상', points: 60}, {day: '2026-10-22', label: '지난 수업 보상', points: 825}, {day: '2026-10-22', label: '평가 수정', points: -10}]} onClose={() => {}}/>);
  assert.match(html, /앱에 안 들어온 동안 포인트가 쌓였어요/);
  assert.match(html, />\+875P</);
  assert.ok(html.indexOf('10/22 지난 수업 보상') < html.indexOf('10/21 출석·숙제 상'), 'newest first');
  assert.match(html, /10\/22 평가 수정<\/span><b class="flex-none text-slate-500">−10<\/b>/);
  const down = renderToStaticMarkup(<PointsInbox lines={[{day: '2026-10-22', label: '평가 수정', points: -10}]} onClose={() => {}}/>);
  assert.match(down, /수업 평가가 바뀌어 포인트가 맞춰졌어요/);
});
