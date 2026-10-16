// 문장 게임 rules (단어 순서 배열, 낭독), kept apart from the screens so they can be tested and reused by the pet games.
import { chunkHints } from './passageTools.js';

export interface GameSentence { word: string; meaning: string; chunked?: string }
type Rand = () => number;

/** The pieces of a sentence: the teacher's / marks first, else the app's meaning units; with fewer than 3, the longest
 *  piece is split in half (a two-word sentence stays two words). */
export function orderPieces(s: GameSentence): string[] {
  const marked = (s.chunked || '').includes('/') ? s.chunked!.split('/').map(p => p.trim()).filter(Boolean) : chunkHints(s.word);
  let pieces = [...marked];
  // Fewer than 3 pieces is too easy: split the longest piece in half until there are 3.
  while (pieces.length < 3) {
    const at = pieces.reduce((best, p, i) => p.split(/\s+/).length > pieces[best].split(/\s+/).length ? i : best, 0), w = pieces[at].split(/\s+/);
    if (w.length < 2) break;
    const half = Math.ceil(w.length / 2);
    pieces.splice(at, 1, w.slice(0, half).join(' '), w.slice(half).join(' '));
  }
  return pieces;
}
/** Shuffled piece positions, never the right order when there is more than one way (same text counts as the same). */
export function shuffledOrder(pieces: string[], rand: Rand = Math.random): number[] {
  const idx = pieces.map((_, i) => i);
  for (let tries = 0; tries < 12; tries++) {
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.map(i => pieces[i]).join(' ') !== pieces.join(' ')) return idx;
  }
  return idx.length > 1 ? [...idx.slice(1), idx[0]] : idx;
}
/** Right when the placed pieces read as the sentence (two pieces with the same text may swap). */
export const orderIsRight = (pieces: string[], placed: number[]) => placed.length === pieces.length && placed.map(i => pieces[i]).join(' ') === pieces.join(' ');

const words = (t: string) => t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
/**
 * 낭독: which words of the sentence were heard, in order (longest common run of words), and the share heard.
 * Passing needs 80%. Stars: all words ★3, 90%+ ★2, else ★1.
 */
export function readingScore(target: string, heard: string) {
  const a = words(target), b = words(heard), n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] || (a[i].replace(/'/g, '') === b[j].replace(/'/g, '')) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j] || a[i].replace(/'/g, '') === b[j].replace(/'/g, '')) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  const share = n ? hit.filter(Boolean).length / n : 0;
  return { words: a, hit, share, pass: share >= 0.8, stars: share === 1 ? 3 : share >= 0.9 ? 2 : share >= 0.8 ? 1 : 0 };
}
/** Up to `count` sentences of the range, in a random order. */
export function pickSentences<T>(list: T[], count = 10, rand: Rand = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, count);
}
/** Speech recognition in this browser (Chrome, Edge, Safari 14.5+ on iPhone), or null. */
export const speechRecognitionClass = (): any => typeof window === 'undefined' ? null : (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
