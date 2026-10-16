// 지문 분석기 › Word 저장: whatever the passage has (직독직해, 문법·구조, 단어, 주제·요약); parts not made yet are left out.
import type { Passage } from './passageApi';
import { grammarTags } from './passageTools';

export async function passageDocx(p: Passage) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const { saveAs } = await import('file-saver');
  const title = p.title || p.parts.summary?.title || '지문 분석';
  const kids: any[] = [];
  const heading = (text: string) => kids.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }));
  const line = (runs: any[], after = 60) => kids.push(new Paragraph({ children: runs, spacing: { after } }));
  kids.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 80 } }));
  if (p.examInfo) line([new TextRun({ text: p.examInfo, color: '64748B', size: 20 })], 160);

  heading('① 직독직해');
  p.sentences.forEach((s, i) => {
    const r = p.parts.reading?.sentences[i];
    line([new TextRun({ text: `${i + 1}. `, bold: true }), new TextRun(r ? r.chunks.map(c => c.en).join(' / ') : p.hints[i].join(' / '))], 20);
    if (r) { line([new TextRun({ text: r.chunks.map(c => c.ko).join(' / '), color: '8B2F40', size: 20 })], 20); if (r.ko) line([new TextRun({ text: r.ko, color: '475569', size: 20 })], 120); }
    else kids.push(new Paragraph({ spacing: { after: 100 } }));
  });

  heading('② 문법·구조');
  p.sentences.forEach((s, i) => {
    const g = p.parts.grammar?.sentences[i], essay = p.parts.grammar?.essay.index === i, tags = grammarTags(s).map(t => t.label);
    line([new TextRun({ text: `${i + 1}. `, bold: true }), new TextRun(s), ...(essay ? [new TextRun({ text: '  [서술형 출제 예상]', bold: true, color: '8B2F40' })] : [])], 20);
    if (tags.length) line([new TextRun({ text: `표시: ${tags.join(', ')}`, color: '64748B', size: 18 })], 20);
    if (g) { line([new TextRun({ text: `구조 ${g.structure}`, size: 20 })], 20); g.points.forEach(pt => line([new TextRun({ text: `· ${pt}`, size: 20 })], 20)); }
    if (essay && p.parts.grammar?.essay.reason) line([new TextRun({ text: `서술형 포인트: ${p.parts.grammar.essay.reason}`, color: '8B2F40', size: 20 })], 20);
    kids.push(new Paragraph({ spacing: { after: 80 } }));
  });

  if (p.parts.words?.known.length) { heading('③ 단어'); p.parts.words.known.forEach(w => line([new TextRun({ text: w.word, bold: true }), new TextRun(`  ${w.meaning}`)], 20)); }
  const sum = p.parts.summary;
  if (sum) {
    heading('④ 주제·요약');
    for (const [label, v] of [['주제', sum.topic], ['요지', sum.mainIdea], ['요약', sum.summary]] as const) { line([new TextRun({ text: `${label} `, bold: true }), new TextRun(v.ko)], 20); line([new TextRun({ text: v.en, color: '64748B', size: 20 })], 100); }
    if (sum.logic) line([new TextRun({ text: '전개 방식 ', bold: true }), new TextRun(sum.logic)]);
  }
  const blob = await Packer.toBlob(new Document({ sections: [{ children: kids }] }));
  saveAs(blob, `${title.replace(/[\\/:*?"<>|]/g, '').slice(0, 60) || '지문 분석'}.docx`);
}
