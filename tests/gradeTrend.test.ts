import test from 'node:test';
import assert from 'node:assert/strict';
import {round1, trendText} from '../src/components/teacher/TeacherAcademicManager';

test('grade trend keeps one decimal: small changes are no longer shown as no change', () => {
  assert.equal(trendText(round1(76.5 - 76.7)), '▼0.2', '76.7 → 76.5');
  assert.equal(trendText(round1(81.6 - 75.9)), '▲5.7');
  assert.equal(trendText(round1(95.2 - 81.6)), '▲13.6');
  assert.equal(trendText(round1(55 - 50)), '▲5', 'whole numbers stay whole');
  assert.equal(trendText(round1(70.04 - 70)), '–', 'below 0.05 counts as the same');
});
