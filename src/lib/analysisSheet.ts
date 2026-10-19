// 지문 분석지 (5단계): one passage on A4 (landscape by default), the same layout for printing and for Word. Page 1 has
// the sentences on the left and the 요점 정리 (구조 · 요지 · 요약 · 제목 · 핵심 어휘) on the right, once; later pages
// carry on with the sentences in two columns. How many sentences go on a page is worked out here from their length
// (직독직해 rows, notes, write lines), so both outputs break pages at the same sentences.
// Two kinds: 분석지 (each 직독직해 piece with its own Korean under it) and 해석 연습 (the pieces with a line to write
// the translation; 요지 · 요약 · 제목 left out, since they would give the answer away).
import type { Passage } from './passageApi';
import { grammarHighlights } from './questionMaker';
import { linkRuns, passageLevel, structureFlow, type LinkKind, type PassageLevel } from './passageLevel';
import { DOCX_BODY, TWIPS_PER_MM, type Orientation } from './printFrame';

export type SheetKind = 'analysis' | 'practice';
export interface SheetOptions {
  kind: SheetKind; orientation: Orientation;
  /** 분석지: each piece's Korean · the whole sentence's Korean · grammar notes; both: 요점 정리 · 핵심 어휘 */
  meaning: boolean; full: boolean; grammar: boolean; summary: boolean; words: boolean;
}
export const DEFAULT_SHEET_OPTIONS: SheetOptions = { kind: 'analysis', orientation: 'landscape', meaning: true, full: false, grammar: true, summary: true, words: true };
export const SHEET_KIND_LABEL: Record<SheetKind, string> = { analysis: '지문 분석지', practice: '해석 연습' };

export interface SheetRun { text: string; kind?: LinkKind }
/** One 직독직해 piece. `slash`: a / follows it (not after the last piece, nor inside a piece split to fit a row). */
export interface SheetChunk { runs: SheetRun[]; ko: string; width: number; slash?: boolean }
export interface SheetLine {
  index: number; rows: SheetChunk[][]; notes: string[]; essay: boolean; full: string;
  /** 해석 연습: lines to write on */
  write: number; height: number;
}
export interface SheetPanel {
  structure: { role: string; nums: string; key: boolean }[]; flow: string;
  mainIdea: string; summary: { ko: string; en: string } | null; title: string; words: { word: string; meaning: string }[];
}
export interface SheetPage { number: number; first: boolean; columns: SheetLine[][] }
export interface SheetLayout {
  kind: SheetKind; orientation: Orientation; title: string; subtitle: string; topic: string; level: PassageLevel | null;
  panel: SheetPanel | null; pages: SheetPage[]; meaning: boolean;
}

/* ------------------------------------------------------------------ measuring (mm) */

// The page body and the type sizes the printed sheet uses (analysisSheet.css .as-*), as millimetres; a 0.96 safety
// margin is kept so a slightly wider font never pushes a sentence off its page. The width is the narrower of print
// (269 / 182 mm in the printed frame) and Word (its wider margins leave about 262 / 175 mm), so both break lines and
// pages at the same places; on paper the sheet just keeps a few mm spare on the right.
const PT = 0.3528, SAFE = 0.96;
export const SHEET_TYPE = { en: 9, ko: 7.5, note: 7.5, panel: 8 }; // pt
const ROW_EN = 4.2, ROW_KO = 3.5, NOTE = 3.4, FULL = 3.6, WRITE = 8.5, GAP = 2.4, TITLE = 15;
const narrower = (print: number, o: Orientation) => Math.min(print, Math.floor(DOCX_BODY[o] / TWIPS_PER_MM * 10) / 10);
const GEOMETRY: Record<Orientation, { body: number; height: number }> = { landscape: { body: narrower(269, 'landscape'), height: 167 }, portrait: { body: narrower(182, 'portrait'), height: 254 } };
export const PANEL_SHARE = 1 / 2.85, COLUMN_GAP = 7;
/** The widths (mm) the sentences are laid out in: page 1 next to the 요점 정리, and a column of a two-column page. */
export function sheetWidths(orientation: Orientation) {
  const body = GEOMETRY[orientation].body, panel = (body - COLUMN_GAP) * PANEL_SHARE;
  return { body, panel, first: body - COLUMN_GAP - panel, column: (body - COLUMN_GAP) / 2 };
}
/** Width in mm of a text at a type size (Korean full width, capitals wider, spaces narrow). */
export function textWidth(text: string, pt: number) {
  let em = 0;
  for (const ch of text) em += /[ㄱ-힣]/.test(ch) ? 0.92 : ch === ' ' ? 0.28 : /[A-Z]/.test(ch) ? 0.66 : /[mwMW]/.test(ch) ? 0.8 : /[il.,;:'!|]/.test(ch) ? 0.26 : 0.52;
  return em * pt * PT;
}
const linesOf = (text: string, pt: number, width: number) => text ? Math.max(1, Math.ceil(textWidth(text, pt) / width)) : 0;
const PIECE_PAD = 4.5;
/** A piece wider than a row, cut into parts that fit: the English by words, its Korean into as many parts by words
 *  (balanced), so print and Word never have to squeeze or re-wrap a piece. Only a single word wider than the row
 *  (not met in real passages) is left as it is. */
export function splitPiece(c: SheetChunk, width: number): SheetChunk[] {
  if (c.width <= width) return [c];
  const room = width - PIECE_PAD, words = c.runs.flatMap(r => r.text.split(' ').filter(Boolean).map(text => ({ text, kind: r.kind })));
  const ko = c.ko.split(' ').filter(Boolean);
  // words into n parts of about equal width (cut where the running width passes each n-th of the total)
  const balance = <T,>(list: T[], n: number, w: (x: T) => number) => {
    const total = list.reduce((t, x) => t + w(x), 0), out: T[][] = Array.from({ length: n }, () => []);
    let used = 0;
    for (const x of list) { out[Math.min(n - 1, Math.floor(((used + w(x) / 2) / Math.max(total, 1e-6)) * n))].push(x); used += w(x); }
    return out;
  };
  const enW = (x: { text: string }) => textWidth(`${x.text} `, SHEET_TYPE.en), koW = (x: string) => textWidth(`${x} `, SHEET_TYPE.ko);
  let n = Math.max(2, Math.ceil(Math.max(textWidth(c.runs.map(r => r.text).join(' '), SHEET_TYPE.en), textWidth(c.ko, SHEET_TYPE.ko)) / room));
  for (;; n++) {
    // both languages over the same n parts, each on its own: when one runs out (a short English with a long
    // Korean), the remaining parts carry only the other
    const en = balance<(typeof words)[number]>(words, n, enW), kos = balance(ko, n, koW);
    const parts = en.map((part, k) => {
      const runs = part.reduce<SheetRun[]>((out, w) => { const last = out[out.length - 1]; if (last && last.kind === w.kind) last.text += ` ${w.text}`; else out.push({ text: w.text, ...(w.kind ? { kind: w.kind } : {}) }); return out; }, []);
      const koText = kos[k].join(' ');
      return { runs, ko: koText, width: Math.max(textWidth(runs.map(r => r.text).join(' '), SHEET_TYPE.en), textWidth(koText, SHEET_TYPE.ko)) + PIECE_PAD };
    }).filter(x => x.runs.length || x.ko);
    if (parts.every(x => x.width <= width) || n >= Math.max(words.length, ko.length)) return parts; // one word a part: as narrow as it gets
  }
}
/** Pieces into rows that fit `width` (a piece wider than the row is first cut to fit, see splitPiece). */
export function packRows(chunks: SheetChunk[], width: number) {
  const rows: SheetChunk[][] = [];
  let used = 0;
  for (const c of chunks) {
    if (rows.length && used + c.width <= width) { rows[rows.length - 1].push(c); used += c.width; }
    else { rows.push([c]); used = c.width; }
  }
  return rows;
}

function lineFor(base: Omit<SheetLine, 'rows' | 'write' | 'height'> & { chunks: SheetChunk[] }, o: SheetOptions, width: number): SheetLine {
  // a / after each piece except the last; parts of one split piece are joined without it
  const chunks = base.chunks.flatMap((c, i) => splitPiece(c, width - 5).map((part, k, all) => ({ ...part, slash: k === all.length - 1 && i < base.chunks.length - 1 })));
  const rows = packRows(chunks, width - 5), practice = o.kind === 'practice', withKo = !practice && o.meaning && base.chunks.some(c => c.ko);
  const write = practice ? Math.max(1, rows.length) : 0;
  const height = rows.length * (ROW_EN + (withKo ? ROW_KO : 0)) + base.notes.reduce((n, t) => n + linesOf(t, SHEET_TYPE.note, width - 5) * NOTE, 0)
    + linesOf(base.full, SHEET_TYPE.ko, width - 5) * FULL + write * WRITE + GAP;
  return { index: base.index, rows, notes: base.notes, essay: base.essay, full: base.full, write, height };
}

/* ------------------------------------------------------------------ layout */

function panelFor(p: Passage, o: SheetOptions, width: number, room: number): SheetPanel | null {
  const sum = o.kind === 'analysis' && o.summary ? p.parts.summary : undefined, map = o.summary ? p.parts.structure : undefined;
  const panel: SheetPanel = { structure: [], flow: '', mainIdea: sum?.mainIdea.ko || '', summary: sum ? { ko: sum.summary.ko, en: sum.summary.en } : null, title: sum ? [sum.title, sum.englishTitle].filter(Boolean).join(' · ') : '', words: [] };
  if (map) {
    // sentences with the same role in one entry (1 · 3–4), the key sentence apart with ★
    const byRole = new Map<string, number[]>();
    map.roles.forEach((r, i) => { if (r && i !== map.key) byRole.set(r, [...(byRole.get(r) || []), i + 1]); });
    const nums = (list: number[]) => list.reduce<string[]>((out, n, k) => { if (k && list[k - 1] === n - 1) { const last = out.pop()!; out.push(`${last.split('–')[0]}–${n}`); } else out.push(String(n)); return out; }, []).join(' · ');
    panel.structure = [...[...byRole].map(([role, list]) => ({ role, nums: nums(list), key: false, first: list[0] })), { role: map.roles[map.key] || '핵심', nums: String(map.key + 1), key: true, first: map.key + 1 }]
      .sort((a, b) => a.first - b.first).map(({ first: _, ...e }) => e);
    panel.flow = structureFlow(map.roles);
  }
  const box = (lines: number) => lines ? 5.5 + lines * FULL : 0, w = width - 4;
  let used = (panel.structure.length ? box(Math.ceil(panel.structure.length / 2) + 1) : 0) + box(linesOf(panel.mainIdea, SHEET_TYPE.panel, w)) + box(linesOf(panel.title, SHEET_TYPE.panel, w));
  if (panel.summary) {
    const ko = linesOf(panel.summary.ko, SHEET_TYPE.panel, w), en = linesOf(panel.summary.en, SHEET_TYPE.panel - 0.5, w);
    if (used + box(ko + en) > room * 0.7) panel.summary.en = ''; // the English line goes first when room is short
    used += box(ko + (panel.summary.en ? en : 0));
  }
  if (o.words && p.parts.words?.known.length) {
    const rows = Math.max(0, Math.floor((room - used - 5.5) / FULL));
    panel.words = p.parts.words.known.slice(0, Math.min(16, rows * 2)).map(w => ({ word: w.word, meaning: w.meaning }));
  }
  const empty = !panel.structure.length && !panel.mainIdea && !panel.summary && !panel.title && !panel.words.length;
  return empty ? null : panel;
}

/** The whole sheet for a passage: what goes on each page, measured the same way for print and Word. */
export function layoutSheet(p: Passage, o: SheetOptions): SheetLayout {
  const g = GEOMETRY[o.orientation], room1 = (g.height - TITLE) * SAFE, room = g.height * SAFE;
  const { panel: panelWidth, column: columnWidth, first: besidePanel } = sheetWidths(o.orientation);
  const panel = panelFor(p, o, panelWidth, room1);
  const firstWidth = panel ? besidePanel : columnWidth;
  const marks = o.kind === 'analysis' && o.grammar ? grammarHighlights(p.sentences) : [];
  const bases = p.sentences.map((s, i) => {
    const reading = p.parts.reading?.sentences[i], pieces = reading ? reading.chunks.map(c => c.en) : p.hints[i] || [s];
    const kos = reading ? reading.chunks.map(c => c.ko) : pieces.map(() => '');
    const showKo = o.kind === 'analysis' && o.meaning;
    const chunks = linkRuns(s, pieces).map((runs, k) => { const en = runs.map(r => r.text).join(' '), ko = showKo ? kos[k] || '' : '';
      return { runs, ko, width: Math.max(textWidth(en, SHEET_TYPE.en), textWidth(ko, SHEET_TYPE.ko)) + PIECE_PAD }; });
    const notes: string[] = [];
    if (o.kind === 'analysis' && o.grammar) {
      for (const h of (marks[i] || []).filter(h => h.kind === 'sure').slice(0, 2)) notes.push(`${h.word} (✖ ${h.wrong}) — ${h.why}`);
      for (const pt of p.parts.grammar?.sentences[i]?.points || []) if (notes.length < 2) notes.push(pt);
    }
    return { index: i, chunks, notes, essay: o.kind === 'analysis' && p.parts.grammar?.essay.index === i, full: o.kind === 'analysis' && o.full ? reading?.ko || '' : '' };
  });
  // page 1: one column next to the 요점 정리 (or two columns when there is none); then two columns a page
  const pages: SheetPage[] = [];
  let i = 0;
  while (i < bases.length || !pages.length) {
    const first = !pages.length, cols = first && panel ? 1 : 2, width = first ? firstWidth : columnWidth, cap = first ? room1 : room;
    const columns: SheetLine[][] = [];
    for (let c = 0; c < cols && i < bases.length; c++) {
      const col: SheetLine[] = [];
      let used = 0;
      while (i < bases.length) {
        const line = lineFor(bases[i], o, width);
        if (col.length && used + line.height > cap) break; // a sentence too tall for an empty column still goes in
        col.push(line); used += line.height; i++;
      }
      columns.push(col);
    }
    // the last page in two columns: its sentences shared out evenly (not all in the left column)
    if (cols === 2 && i >= bases.length && columns.length === 1 && columns[0].length > 1) {
      const all = columns[0], half = all.reduce((n, l) => n + l.height, 0) / 2;
      let used = 0, cut = 0;
      while (cut < all.length - 1 && used + all[cut].height / 2 <= half) used += all[cut++].height;
      columns.splice(0, 1, all.slice(0, Math.max(1, cut)), all.slice(Math.max(1, cut)));
    }
    pages.push({ number: pages.length + 1, first, columns });
    if (!bases.length) break;
  }
  const level = passageLevel(p.sentences);
  return { kind: o.kind, orientation: o.orientation, title: p.title || p.parts.summary?.title || '지문 분석', subtitle: p.examInfo || '', topic: o.kind === 'analysis' ? p.parts.summary?.topic.ko || '' : '', level, panel, pages, meaning: o.kind === 'analysis' && o.meaning };
}
/** The options a passage can use: parts it does not have yet are off (and say why on screen). */
export function sheetAvailability(p: Passage) {
  return { meaning: Boolean(p.parts.reading), full: Boolean(p.parts.reading), grammar: true, summary: Boolean(p.parts.summary || p.parts.structure), words: Boolean(p.parts.words?.known.length) };
}
export const stars = (level: PassageLevel | null) => level ? `${'★'.repeat(level.stars)}${'☆'.repeat(5 - level.stars)} ${level.label}` : '';
