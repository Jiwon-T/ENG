import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Word } from '../components/teacher/wordbookTypes';

// 바로 출력 (수업 일지): the 학습 세트 window's code and the chosen book's words are fetched while the teacher is still
// picking 시험지 or 단어장 출력, so the window opens on them at once. Kept a minute; the window's own live read still
// follows and wins.
const TTL_MS = 60_000;
const words = new Map<string, { at: number; read: Promise<Word[]> }>();
let code: Promise<unknown> | null = null;

/** Start loading the 학습 세트 window (once a visit). */
export function prefetchWordbookManager() {
  code ||= import('../components/teacher/WordbookManager').catch(() => { code = null; });
}
const keyOf = (id: string) => `${auth.currentUser?.uid || ''}|${id}`;
/** Start reading a book's words (in order), unless read in the last minute — per account. */
export function prefetchBookWords(id: string) {
  const key = keyOf(id), hit = words.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.read;
  const read = getDocs(query(collection(db, `wordbooks/${id}/words`), orderBy('order', 'asc')))
    .then(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Word)));
  read.catch(() => { if (words.get(key)?.read === read) words.delete(key); });
  words.set(key, { at: Date.now(), read });
  return read;
}
/** The words read ahead for this book, if a read started in the last minute. */
export function prefetchedBookWords(id: string) {
  const hit = words.get(keyOf(id));
  return hit && Date.now() - hit.at < TTL_MS ? hit.read : null;
}
