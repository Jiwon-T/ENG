import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSentences, showSentence, stripNumber } from '../src/lib/sentenceImport.ts';

test('문장 세트 paste: leading numbers of every kind are taken off, numbers inside a sentence stay', () => {
  for (const line of ['001. I run.', '1. I run.', '2 I run.', '3) I run.', '(3) I run.', '① I run.', '❶ I run.', '➊ I run.', '⑴ I run.', '⒈ I run.', '⓵ I run.'])
    assert.equal(stripNumber(line), 'I run.', line);
  assert.equal(stripNumber('1.5 million people came.'), '1.5 million people came.');
  assert.equal(stripNumber('I have 2 cats.'), 'I have 2 cats.');
  assert.equal(stripNumber('100 people came.'), '100 people came.', 'a sentence that starts with a number keeps it');
  assert.equal(stripNumber('2026 is the year.'), '2026 is the year.');
});

test('문장 세트 paste: alternating lines, one line with both, a tab, and a sentence without a translation', () => {
  const {rows, skipped} = parseSentences('001. I want / to be a doctor.\n나는 의사가 되고 싶다.\n\n2 She is reading / a book. 그녀는 책을 읽고 있다.\n❸ He sings.\t그는 노래한다.\n③ It\'s raining.\n④ Look at the TV. 그 TV를 봐.');
  assert.deepEqual(rows, [
    {english: 'I want / to be a doctor.', korean: '나는 의사가 되고 싶다.'},
    {english: 'She is reading / a book.', korean: '그녀는 책을 읽고 있다.'},
    {english: 'He sings.', korean: '그는 노래한다.'},
    {english: 'It\'s raining.', korean: ''},
    {english: 'Look at the TV.', korean: '그 TV를 봐.'},
  ]);
  assert.deepEqual(skipped, []);
});

test('문장 세트 paste: a Korean line with no sentence waiting for it is listed, not dropped silently; / is hidden when shown', () => {
  const {rows, skipped} = parseSentences('나 혼자 있는 해석\nI run.\n나는 달린다.\n또 다른 해석');
  assert.deepEqual(rows, [{english: 'I run.', korean: '나는 달린다.'}]);
  assert.deepEqual(skipped, ['나 혼자 있는 해석', '또 다른 해석']);
  assert.equal(showSentence('I want / to be / a doctor.'), 'I want to be a doctor.');
});
