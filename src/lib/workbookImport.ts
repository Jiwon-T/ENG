// 워크북 지문 불러오기: the plain text of a .txt or .docx file (paragraphs kept as lines). Nothing leaves the browser.
import JSZip from 'jszip';

export const WORKBOOK_FILE_MAX = 5 * 1024 * 1024;
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');

/** Paragraph texts of word/document.xml: runs (<w:t>) joined, tabs as spaces, one line per paragraph. */
export function docxXmlText(xml: string) {
  return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(p => decode((p.match(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>/g) || [])
    .map(t => t.startsWith('<w:tab') ? ' ' : t.startsWith('<w:br') ? '\n' : t.replace(/<[^>]+>/g, '')).join(''))).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function readWorkbookFile(file: File): Promise<string> {
  if (file.size > WORKBOOK_FILE_MAX) throw Error('파일이 너무 커요. 5MB 이하 파일을 올려 주세요.');
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return (await file.text()).replace(/^﻿/, '');
  if (name.endsWith('.docx')) {
    let xml: string | undefined;
    try { xml = await (await JSZip.loadAsync(await file.arrayBuffer())).file('word/document.xml')?.async('string'); } catch { /* not a zip */ }
    if (!xml) throw Error('Word 파일을 읽지 못했어요. .docx 형식인지 확인해 주세요.');
    return docxXmlText(xml);
  }
  throw Error('TXT 또는 DOCX 파일만 불러올 수 있어요.');
}
