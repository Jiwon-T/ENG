/**
 * 단어장 DAY 채우기 (decided 2026-10-21): the test paper and the print now open on '등록된 DAY 그대로'. A word saved without
 * its DAY is shown on the DAY its place gives it (order ÷ the book's DAY당 단어 수, 40 when unset — getWordDay in
 * WordbookManager); this writes that DAY on the word, so every screen reads the same DAY and nothing moves.
 * Word books only (no type or 'standard'; grammar and sentence books go by their own sets and UNITs). Words that have a DAY
 * are left as they are.
 *
 * Safety: a dry run by default (counts only, no titles). `--apply` writes `day` on those words — only after the user said so.
 *
 *   node --env-file=<env> --import tsx scripts/fill-word-days.ts [--apply]
 */
import { getFirebaseAdmin } from '../api/_lib/firebaseAdmin.ts';

const apply = process.argv.includes('--apply');
const { db } = getFirebaseAdmin();
const wordBook = (b: any) => (b.category || (b.type === 'irregular' ? 'grammar' : 'word')) === 'word' && (!b.type || b.type === 'standard');
let books = 0, words = 0, written = 0;
for (const b of (await db.collection('wordbooks').get()).docs) {
  const book = b.data(); if (!wordBook(book)) continue;
  const unit = Number(book.defaultUnitSize) > 0 ? Number(book.defaultUnitSize) : 40;
  const docs = (await b.ref.collection('words').get()).docs;
  // the same DAY the screens show for a word without one: its place in the book (order, else its index by order)
  const sorted = [...docs].sort((x: any, y: any) => (x.data().order ?? 0) - (y.data().order ?? 0));
  const todo = sorted.map((d: any, i: number) => ({d, day: Number(d.data().day) > 0 ? 0 : Math.floor((d.data().order ?? i) / unit) + 1})).filter(x => x.day);
  if (!todo.length) continue;
  books++; words += todo.length;
  if (!apply) continue;
  for (let i = 0; i < todo.length; i += 400) {
    const batch = db.batch(); for (const x of todo.slice(i, i + 400)) batch.update(x.d.ref, {day: x.day}); await batch.commit(); written += Math.min(400, todo.length - i);
  }
}
console.log(JSON.stringify({mode: apply ? 'apply' : 'dry-run', books, words, written}));
process.exit(0);
