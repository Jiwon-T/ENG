import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import WordTasksPanel, { days, md } from '../src/components/teacher/WordTasksPanel';

test('학습 리포트 › 원정대 과제: the range and Seoul dates as the list shows them; nothing before the tasks are read', () => {
  assert.deepEqual([days({ startDay: 1, endDay: 2 }), days({ startDay: 3, endDay: 3 })], ['Day 1~2', 'Day 3']);
  assert.equal(md(Date.parse('2026-10-21T16:30:00Z')), '10/22', 'Seoul time (01:30 on the 22nd)');
  assert.equal(renderToStaticMarkup(<WordTasksPanel studentKey="11111111-1111-4111-8111-111111111111" />), '');
});
