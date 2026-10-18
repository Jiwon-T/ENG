// 출력 공통 틀 (인쇄 · Word): every printed or downloaded sheet (지문 분석, 변형 문제, 워크북 …) has the app logo and name
// at the top left with the title on the right, and the footer (기본 '채움학원 지원T', each teacher may change it; kept
// on this device) with the page number at the bottom. A4, portrait or landscape. A long passage keeps 8 sentences on a
// page and goes on on the next with the same title and (2).
import { AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, PageOrientation, Paragraph, TabStopPosition, TabStopType, TextRun, type ISectionOptions, type Table } from 'docx';

export const PRINT_LOGO = '/icons/icon-rosy-192.png';
export const APP_NAME = '지원T English';
export const DEFAULT_FOOTER = '채움학원 지원T';
const FOOTER_KEY = 'print-footer', OLD_WORKBOOK_FOOTER = 'workbook-footer';

/** The footer on this device: the one set here, else the 워크북 one set before (moved over once), else 채움학원 지원T. */
export function printFooter(): string {
  try {
    const saved = localStorage.getItem(FOOTER_KEY);
    if (saved !== null) return saved.trim() || DEFAULT_FOOTER;
    const old = localStorage.getItem(OLD_WORKBOOK_FOOTER)?.trim();
    if (old) { localStorage.setItem(FOOTER_KEY, old); return old; }
  } catch { /* storage off: the default */ }
  return DEFAULT_FOOTER;
}
/** Change the footer (empty = back to 채움학원 지원T). */
export function setPrintFooter(value: string) {
  try { localStorage.setItem(FOOTER_KEY, value.trim().slice(0, 80)); } catch { /* not kept: this time only */ }
  return value.trim().slice(0, 80) || DEFAULT_FOOTER;
}

export type Orientation = 'portrait' | 'landscape';
/** A long passage on pages of up to 8 sentences: each page keeps its sentences' numbers; titles get (1), (2) … only
 *  when there is more than one page. */
export const SENTENCES_PER_PAGE = 8;
export function sentencePages<T>(sentences: T[], perPage = SENTENCES_PER_PAGE) {
  const pages: { part: number; of: number; first: number; sentences: T[] }[] = [];
  for (let i = 0; i < sentences.length; i += perPage) pages.push({ part: pages.length + 1, of: 0, first: i, sentences: sentences.slice(i, i + perPage) });
  pages.forEach(p => { p.of = pages.length; });
  return pages.length ? pages : [{ part: 1, of: 1, first: 0, sentences: [] as T[] }];
}
export const partTitle = (title: string, part: number, of: number) => of > 1 ? `${title} (${part})` : title;
export const CIRCLED_NUMBERS = ['❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿', '⓫', '⓬', '⓭', '⓮', '⓯', '⓰', '⓱', '⓲', '⓳', '⓴'];
export const sentenceMark = (index: number) => CIRCLED_NUMBERS[index] || `(${index + 1})`;

/* ------------------------------------------------------------------ Word */

const EN = 'Arial', KO = 'Malgun Gothic';
export const docxFont = { ascii: EN, hAnsi: EN, eastAsia: KO, cs: EN };
export const docxRun = (text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean; underline?: boolean } = {}) =>
  new TextRun({ text, font: docxFont, size: opts.size ?? 21, bold: opts.bold, color: opts.color, italics: opts.italics, ...(opts.underline ? { underline: {} } : {}) });

let logoBytes: Promise<ArrayBuffer | null> | null = null;
/** The logo for Word (read once; a sheet without it is still made if it can't be read). */
function logo() {
  logoBytes ||= fetch(PRINT_LOGO).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
  return logoBytes;
}
const A4 = { width: 11906, height: 16838 }; // twips, portrait (docx turns it for landscape)

/** A group of paragraphs that starts on a new page; `columns`: 2 for an exam-style two-column page (Word flows them). */
export type FrameSection = (Paragraph | Table)[] | { children: (Paragraph | Table)[]; columns?: number };
/** One Word file in the common frame: `sections` are page groups (each starts on a new page). */
export async function frameDocx(info: { title: string; subtitle?: string; orientation?: Orientation; footer?: string }, sections: FrameSection[]): Promise<Blob> {
  const bytes = await logo(), footer = (info.footer ?? printFooter()).trim();
  const rightTab = { type: TabStopType.RIGHT, position: TabStopPosition.MAX };
  const header = new Header({ children: [new Paragraph({ tabStops: [rightTab], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E8A5B4', space: 4 } }, children: [
    ...(bytes ? [new ImageRun({ type: 'png', data: bytes, transformation: { width: 18, height: 18 } })] : []),
    docxRun(` ${APP_NAME}`, { bold: true, size: 18, color: '8B2F40' }),
    docxRun(`\t${[info.title, info.subtitle].filter(Boolean).join(' · ')}`, { size: 18, color: '5E5A5C' }),
  ] })] });
  const foot = new Footer({ children: [new Paragraph({ tabStops: [rightTab], border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'DDD3D6', space: 4 } }, children: [
    docxRun(footer, { size: 16, color: '9A8A8F' }), new TextRun({ children: ['\t', PageNumber.CURRENT], font: docxFont, size: 16, color: '9A8A8F' }),
  ] })] });
  const page = { size: { ...A4, orientation: info.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000, header: 500, footer: 500 } };
  const doc = new Document({
    creator: APP_NAME, title: info.title,
    styles: { default: { document: { run: { font: docxFont, size: 21 } } } },
    sections: (sections.length ? sections : [[]]).map((s): ISectionOptions => {
      const children = Array.isArray(s) ? s : s.children, columns = Array.isArray(s) ? 1 : s.columns || 1;
      return { properties: { page, ...(columns > 1 ? { column: { count: columns, space: 400, separate: true } } : {}) }, headers: { default: header }, footers: { default: foot }, children: children.length ? children : [new Paragraph('')] };
    }),
  });
  return Packer.toBlob(doc);
}
/** A heading line inside a sheet. */
export const docxHeading = (text: string) => new Paragraph({ spacing: { before: 200, after: 120 }, children: [docxRun(text, { bold: true, size: 24, color: '5E1E2A' })] });
export const docxCenter = (text: string, size = 22) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [docxRun(text, { bold: true, size, color: '5E1E2A' })] });

/** Save a made file (Word) under a plain name. */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const fileName = (title: string, kind: string) => `${(title || kind).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)} ${kind}.docx`;
