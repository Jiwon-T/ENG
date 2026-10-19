// 지문 분석지 › Word: the pages layoutSheet worked out, each its own page (page 1: the sentences and the 요점 정리 side
// by side in a borderless table; later pages: two columns with a column break where the printed sheet has one).
import { BorderStyle, ColumnBreak, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow, TabStopPosition, TabStopType, TextRun, WidthType } from 'docx';
import { SHEET_KIND_LABEL, SHEET_TYPE, sheetWidths, stars, type SheetLayout, type SheetLine, type SheetPanel, type SheetRun } from './analysisSheet';
import { TWIPS_PER_MM, docxFont, docxRun, frameDocx, partTitle } from './printFrame';

const MM = TWIPS_PER_MM, tw = (mm: number) => Math.round(mm * MM), NUM = Math.floor(5 * MM); // the 5 mm the layout keeps for the number
const half = (pt: number) => Math.round(pt * 2);
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };
const para = (children: TextRun[], opts: { after?: number; before?: number; line?: number; border?: any; tabs?: boolean } = {}) =>
  new Paragraph({ spacing: { before: opts.before ?? 0, after: opts.after ?? 0, line: opts.line ?? 240 }, keepLines: true, border: opts.border, children,
    ...(opts.tabs ? { tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }] } : {}) });
const runsOf = (runs: SheetRun[], size: number) => runs.flatMap((r, k) => [
  ...(k ? [new TextRun({ text: ' ', font: docxFont, size })] : []),
  new TextRun({ text: r.text, font: docxFont, size, ...(r.kind ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FBEAF0' }, color: '72243E' } : {}) }),
]);
const slash = (size: number) => new TextRun({ text: ' / ', font: docxFont, size, color: 'D4537E' });

function sentence(line: SheetLine, layout: SheetLayout, width: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [], en = half(SHEET_TYPE.en), ko = half(SHEET_TYPE.ko), note = half(SHEET_TYPE.note);
  const num = new TextRun({ text: `${line.index + 1} `, font: docxFont, size: en, bold: true, color: '993556' });
  const essay = line.essay ? [new TextRun({ text: '  서술형', font: docxFont, size: note, bold: true, color: '8B2F40' })] : [];
  if (layout.meaning && line.rows.some(r => r.some(c => c.ko))) {
    // each row of pieces as a borderless table: the English piece over its Korean
    line.rows.forEach((row, r) => {
      const total = row.reduce((n, c) => n + c.width, 0), scale = Math.min(1, (width - NUM) / (total * MM));
      out.push(new Table({ layout: TableLayoutType.FIXED, borders: noBorders, width: { size: Math.round(total * MM * scale) + (r === 0 ? NUM : 0), type: WidthType.DXA }, rows: [new TableRow({ cantSplit: true, children: [
        ...(r === 0 ? [new TableCell({ width: { size: NUM, type: WidthType.DXA }, borders: noBorders, children: [para([num])] })] : []),
        ...row.map((c, k) => new TableCell({ width: { size: Math.round(c.width * MM * scale), type: WidthType.DXA }, borders: noBorders, margins: { left: 0, right: 40 }, children: [
          // a part with only Korean (a long translation of a short piece) keeps an empty English line of the same size
          para([...(c.runs.length ? runsOf(c.runs, en) : [new TextRun({ text: '', font: docxFont, size: en })]), ...(c.slash ? [slash(en)] : []), ...(r === line.rows.length - 1 && k === row.length - 1 ? essay : [])]),
          para([new TextRun({ text: c.ko, font: docxFont, size: ko, color: '72243E' })]),
        ] })),
      ] })] }));
    });
  } else {
    const pieces = line.rows.flat();
    out.push(para([num, ...pieces.flatMap((c, k) => [...(k ? [pieces[k - 1].slash ? slash(en) : new TextRun({ text: ' ', font: docxFont, size: en })] : []), ...runsOf(c.runs, en)]), ...essay], { line: 276 }));
  }
  for (const n of line.notes) out.push(para([new TextRun({ text: `· ${n}`, font: docxFont, size: note, color: '5F5E5A' })], { line: 220 }));
  if (line.full) out.push(para([new TextRun({ text: line.full, font: docxFont, size: ko, color: '72243E' })], { line: 220 }));
  for (let k = 0; k < line.write; k++) out.push(para([new TextRun({ text: ' ', font: docxFont, size: en })], { before: 260, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B4B2A9', space: 1 } } }));
  out.push(para([], { after: 60, ...(line.write ? {} : { border: { bottom: { style: BorderStyle.DOTTED, size: 2, color: 'D3D1C7', space: 1 } } }) }));
  return out;
}

function panelBox(title: string, body: TextRun[][]): Paragraph[] {
  const side = { style: BorderStyle.SINGLE, size: 4, color: 'B4B2A9', space: 3 }, size = half(SHEET_TYPE.panel);
  const border = (first: boolean, last: boolean) => ({ left: side, right: side, ...(first ? { top: side } : {}), ...(last ? { bottom: side } : {}) });
  const lines = [[new TextRun({ text: title, font: docxFont, size, bold: true, color: '72243E' })], ...body];
  return [...lines.map((runs, k) => para(runs, { border: border(k === 0, k === lines.length - 1), line: 230 })), para([], { after: 100 })];
}
function panel(p: SheetPanel): Paragraph[] {
  const size = half(SHEET_TYPE.panel), t = (text: string, color = '2C2C2A', s = size) => new TextRun({ text, font: docxFont, size: s, color });
  const out: Paragraph[] = [];
  if (p.structure.length) out.push(...panelBox('글의 구조', [p.structure.map((e, k) => t(`${k ? '   ' : ''}${e.key ? '★' : ''}${e.role} ${e.nums}`, e.key ? '72243E' : '2C2C2A')), ...(p.flow ? [[t(p.flow, '888780', size - 2)]] : [])]));
  if (p.mainIdea) out.push(...panelBox('요지', [[t(p.mainIdea)]]));
  if (p.summary) out.push(...panelBox('요약', [[t(p.summary.ko)], ...(p.summary.en ? [[t(p.summary.en, '5F5E5A', size - 1)]] : [])]));
  if (p.title) out.push(...panelBox('제목', [[t(p.title)]]));
  if (p.words.length) { const rows: TextRun[][] = []; for (let i = 0; i < p.words.length; i += 2) rows.push(p.words.slice(i, i + 2).map((w, k) => t(`${k ? '      ' : ''}${w.word} ${w.meaning}`))); out.push(...panelBox('핵심 어휘', rows)); }
  return out;
}

/** The 분석지 (or 해석 연습) as a Word file, page for page as printed. */
export async function analysisSheetDocx(layout: SheetLayout, footer?: string) {
  // the same widths the layout used (mm → twips), so no row of pieces has to be squeezed to fit
  const kind = SHEET_KIND_LABEL[layout.kind], w = sheetWidths(layout.orientation), of = layout.pages.length;
  const top = [
    para([docxRun(`${layout.title} · ${kind}`, { bold: true, size: 26, color: '2C2C2A' }), docxRun('\t이름 __________   날짜 ______', { size: 16, color: '5F5E5A' })], { tabs: true }),
    para([docxRun([layout.subtitle, layout.topic && `주제 ${layout.topic}`, layout.level && `난이도 ${stars(layout.level)}`].filter(Boolean).join('  ·  '), { size: 16, color: '5F5E5A' })],
      { after: 120, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: '72243E', space: 3 } } }),
  ];
  const twoColumns = (columns: SheetLine[][], width: number) => columns.flatMap((col, c) => [...(c ? [new Paragraph({ children: [new ColumnBreak()] })] : []), ...col.flatMap(l => sentence(l, layout, width))]);
  const sections = layout.pages.map(page => {
    if (page.first && layout.panel) {
      const gap = tw(w.body - w.first - w.panel), left = tw(w.first), panelWidth = tw(w.panel);
      const table = new Table({ layout: TableLayoutType.FIXED, borders: noBorders, width: { size: left + gap + panelWidth, type: WidthType.DXA }, rows: [new TableRow({ children: [
        new TableCell({ width: { size: left + gap, type: WidthType.DXA }, borders: noBorders, margins: { left: 0, right: gap }, children: page.columns[0]?.flatMap(l => sentence(l, layout, left)) || [para([])] }),
        new TableCell({ width: { size: panelWidth, type: WidthType.DXA }, borders: noBorders, margins: { left: 0, right: 0 }, children: panel(layout.panel) }),
      ] })] });
      return { children: [...top, table, para([])] };
    }
    const width = tw(w.column);
    return { children: [...(page.first ? top : [para([docxRun(partTitle(`${layout.title} · ${kind}`, page.number, of), { bold: true, size: 20, color: '5E1E2A' })], { after: 120 })]), ...twoColumns(page.columns, width)], columns: 2 };
  });
  return frameDocx({ title: `${layout.title} · ${kind}`, orientation: layout.orientation, footer }, sections);
}
