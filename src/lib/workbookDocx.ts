// 워크북 Word 파일: A4, Part 1 (빈칸 + 해석), Part 2 (해석 → 단어 배열 → 답 쓰는 줄), Answer Key on a new page. In the
// common frame (logo and title at the top, the footer and page number at the bottom: printFrame). Built in the browser
// with the docx library; nothing is stored.
import { AlignmentType, BorderStyle, HeadingLevel, Paragraph, TextRun } from 'docx';
import { frameDocx } from './printFrame';
import { BLANK, arrangeLine, blankedText, type WorkbookBuild } from './workbook';

const EN = 'Arial', KO = 'Malgun Gothic';
const font = { ascii: EN, hAnsi: EN, eastAsia: KO, cs: EN };
const run = (text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) => new TextRun({ text, font, size: opts.size ?? 21, bold: opts.bold, color: opts.color, italics: opts.italics });
const koLine = (ko: string) => new Paragraph({ spacing: { after: 160 }, indent: { left: 360 }, children: [run('해석  ', { bold: true, size: 18, color: 'B04A5A' }), run(ko, { size: 19, color: '5E5A5C' })] });
const heading = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'F3C4CC', space: 4 } }, children: [run(text, { bold: true, size: 26, color: '8B2F40' })] });

/** `footer`: the line at the bottom of every page (the common one when not given). */
export async function workbookDocx(build: WorkbookBuild, info: { title: string; subtitle?: string; footer?: string }): Promise<Blob> {
  const heading2 = [info.title, info.subtitle].filter(Boolean).join(' · ');
  const body: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run('WORKBOOK', { bold: true, size: 44, color: '5E1E2A' })] }),
    ...(heading2 ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 }, children: [run(heading2, { size: 22, color: '8B2F40' })] })] : []),
    heading('Part 1. 영문 빈칸 완성'),
  ];
  build.blanks.forEach((item, n) => {
    body.push(new Paragraph({ spacing: { before: 120, after: 60, line: 360 }, keepNext: true, children: [run(`${n + 1}. `, { bold: true }), run(blankedText(item.tokens, item.blanks))] }));
    body.push(koLine(item.ko));
  });
  body.push(heading('Part 2. 단어 순서 배열'));
  build.arrange.forEach((item, n) => {
    body.push(new Paragraph({ spacing: { before: 140, after: 40 }, keepNext: true, children: [run(`${n + 1}. `, { bold: true }), run(item.ko, { size: 20, color: '5E5A5C' })] }));
    body.push(new Paragraph({ spacing: { after: 60, line: 320 }, indent: { left: 360 }, keepNext: true, children: [run(arrangeLine(item), { size: 20, color: '1F1A24' })] }));
    // Room to write: two ruled lines (long sentences wrap onto the second).
    for (let i = 0; i < 2; i++) body.push(new Paragraph({ spacing: { before: 200, after: 40 }, indent: { left: 360 }, keepNext: i === 0, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFB4B7', space: 1 } }, children: [run(i === 0 ? '정답: ' : ' ', { size: 18, color: '9A8A8F' })] }));
  });
  const key: Paragraph[] = [heading('Answer Key'), new Paragraph({ spacing: { after: 100 }, children: [run('Part 1', { bold: true, size: 22, color: '8B2F40' })] })];
  // Answers come from the original sentences, never rebuilt from the blanks or the shuffle.
  build.blanks.forEach((item, n) => key.push(new Paragraph({ spacing: { after: 80, line: 320 }, children: [run(`${n + 1}. `, { bold: true }), run(item.text)] })));
  key.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [run('Part 2', { bold: true, size: 22, color: '8B2F40' })] }));
  build.arrange.forEach((item, n) => {
    key.push(new Paragraph({ spacing: { after: 20, line: 320 }, children: [run(`${n + 1}. `, { bold: true }), run(item.text)] }));
    key.push(koLine(item.ko));
  });
  // the answer key starts on a new page (its own section)
  return frameDocx({ title: heading2 ? `WORKBOOK · ${heading2}` : 'WORKBOOK', footer: info.footer }, [body, key]);
}
/** The blank placeholder, for previews that want the same look as the file. */
export const WORKBOOK_BLANK = BLANK;
