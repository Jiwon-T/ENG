// 변형 문제지 출력 (인쇄 · Word): one set, or several sets put together with the numbering going on (1–3, 4–6 …), in two
// columns like an exam paper (a question never cut in two), the answers with explanations last in one column.
// The Word file uses the common frame (logo, title, footer, page numbers: printFrame).
import { BorderStyle, Paragraph, TextRun } from 'docx';
import { CIRCLED, typeLabel, type MadeQuestion } from './questionMaker';
import { docxFont, docxRun, frameDocx } from './printFrame';

export interface SheetQuestion { n: number; q: MadeQuestion; setTitle: string }
const LETTERS = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ', 'ⓕ', 'ⓖ', 'ⓗ', 'ⓘ', 'ⓙ', 'ⓚ', 'ⓛ'];

/** The questions of these sets in order, numbered on from 1. */
export function sheetQuestions(sets: { title: string; questions: MadeQuestion[] }[]): SheetQuestion[] {
  let n = 0;
  return sets.flatMap(s => s.questions.map(q => ({ n: ++n, q, setTitle: s.title })));
}
/** About how much of a page a question takes (characters, roughly). */
const cost = (q: MadeQuestion) => 260 + (q.passage?.length || 0) + (q.box?.length || 0) + (q.paragraphs || []).reduce((s, p) => s + p.text.length + 40, 0) + (q.options || []).reduce((s, o) => s + Math.max(60, o.length + 20), 0);
/** About what a two-column A4 page holds at 9.5pt (characters, roughly). */
export const PAGE_BUDGET = 4400;
/** Pages of whole questions (for printing): a page takes questions while they fit; a question bigger than a page has
 *  one to itself. The Word file needs no packing: Word flows the two columns itself. */
export function packQuestions(items: SheetQuestion[], budget = PAGE_BUDGET) {
  const pages: SheetQuestion[][] = [];
  let page: SheetQuestion[] = [], used = 0;
  for (const it of items) {
    const c = cost(it.q);
    if (page.length && used + c > budget) { pages.push(page); page = []; used = 0; }
    page.push(it); used += c;
  }
  if (page.length) pages.push(page);
  return pages;
}
/** The answer as written in the key. */
export function answerText(q: MadeQuestion) {
  if (Array.isArray(q.answer)) return q.answer.map((w, k) => `${LETTERS[k] || k + 1} ${w}`).join('  ');
  return CIRCLED[q.answer - 1] || String(q.answer);
}
/** The passage in parts: plain text, and the numbered underlined bits of 어법 수정 (`①{word}`). */
export function passageParts(text: string): { text: string; mark?: string; under?: boolean }[] {
  const out: { text: string; mark?: string; under?: boolean }[] = [], parts = text.split(/([①-⑤])\{([^}]*)\}/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) { if (parts[i]) out.push({ text: parts[i] }); }
    else if (i % 3 === 1) { out.push({ text: parts[i], mark: parts[i] }); out.push({ text: parts[i + 1], under: true }); i++; }
  }
  return out;
}

/* ------------------------------------------------------------------ Word */

const p = (children: TextRun[], opts: { before?: number; after?: number; indent?: number; box?: boolean; keepNext?: boolean } = {}) => new Paragraph({
  spacing: { before: opts.before ?? 0, after: opts.after ?? 60, line: 276 }, indent: opts.indent ? { left: opts.indent } : undefined, keepNext: opts.keepNext, keepLines: true,
  ...(opts.box ? { border: { top: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 }, left: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 }, right: { style: BorderStyle.SINGLE, size: 4, color: '888888', space: 4 } } } : {}),
  children,
});
function questionParagraphs(it: SheetQuestion): Paragraph[] {
  // 9.5pt in two columns; every part keeps with the next so a question never splits across a column or a page
  const q = it.q, out: Paragraph[] = [p([docxRun(`${it.n}. `, { bold: true, size: 19 }), docxRun(q.prompt, { bold: true, size: 19 })], { before: 160, after: 80, keepNext: true })];
  if (q.box) out.push(p([docxRun(q.box, { size: 19 })], { box: true, after: 100, keepNext: true }));
  for (const para of q.paragraphs || []) out.push(p([docxRun(`${para.label} `, { bold: true, size: 19 }), docxRun(para.text, { size: 19 })], { after: 60, keepNext: true }));
  if (q.passage) out.push(p(passageParts(q.passage).map(x => new TextRun({ text: x.text, font: docxFont, size: 19, underline: x.under ? {} : undefined })), { after: 80, keepNext: Boolean(q.options) }));
  (q.options || []).forEach((o, k, all) => out.push(p([docxRun(`${CIRCLED[k]} ${o}`, { size: 19 })], { after: 10, indent: 160, keepNext: k < all.length - 1 })));
  return out;
}
/** The 문제지 as a Word file: the questions in two flowing columns, then the answers and explanations (one column). */
export async function questionSheetDocx(info: { title: string; subtitle?: string; footer?: string }, items: SheetQuestion[]) {
  const questions = items.flatMap(questionParagraphs);
  const key: Paragraph[] = [p([docxRun('정답 · 해설', { bold: true, size: 24, color: '5E1E2A' })], { after: 160 })];
  for (const it of items) {
    key.push(p([docxRun(`${it.n}. `, { bold: true }), docxRun(answerText(it.q), { bold: true, color: '8B2F40' }), docxRun(`  ${typeLabel(it.q.type)}`, { size: 16, color: '9A8A8F' })], { before: 80, after: 20, keepNext: Boolean(it.q.explanation) }));
    if (it.q.explanation) for (const line of it.q.explanation.split('\n')) key.push(p([docxRun(line, { size: 18, color: '5E5A5C' })], { indent: 300, after: 20 }));
  }
  return frameDocx({ title: info.title, subtitle: info.subtitle, orientation: 'portrait', footer: info.footer }, [{ children: questions, columns: 2 }, key]);
}
