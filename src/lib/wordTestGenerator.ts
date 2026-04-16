import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, HeightRule } from 'docx';
import { saveAs } from 'file-saver';

interface Word {
  word: string;
  meaning: string;
}

export const generateWordTest = async (
  title: string, 
  subtitle: string, 
  words: Word[], 
  options: {
    testType: 'en-to-ko' | 'ko-to-en' | 'mixed';
    includeAnswerKey: boolean;
    paperTitle?: string;
    studentName?: string;
  }
) => {
  const { testType, includeAnswerKey, paperTitle = '단어 테스트', studentName = '' } = options;

  const createDocument = (isAnswerKey: boolean) => {
    // Create header table
    const headerTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          height: { value: 800, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "지원T",
                      bold: true,
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: title,
                      bold: true,
                      size: 26,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: subtitle,
                      bold: true,
                      size: 22,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: `이름: ${studentName}`, 
                      size: 22,
                      bold: true 
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 80, after: 80 },
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const wordRows: TableRow[] = [];
    for (let i = 0; i < words.length; i += 2) {
      const leftWord = words[i];
      const rightWord = words[i + 1];

      wordRows.push(
        new TableRow({
          height: { value: 450, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${i + 1}. `, size: 22 }),
                    new TextRun({ 
                      text: testType === 'en-to-ko' ? leftWord.word : leftWord.meaning, 
                      size: 22,
                      color: isAnswerKey && testType === 'en-to-ko' ? "666666" : undefined,
                      bold: isAnswerKey && testType === 'ko-to-en' ? true : false
                    }),
                    isAnswerKey ? new TextRun({
                      text: `  ${testType === 'en-to-ko' ? leftWord.meaning : leftWord.word}`,
                      size: 22,
                      bold: testType === 'en-to-ko' ? true : false,
                      color: testType === 'ko-to-en' ? "666666" : "000000"
                    }) : new TextRun({ 
                      text: " ____________________", 
                      size: 22, 
                      color: "999999" 
                    }),
                  ],
                  spacing: { before: 80, after: 80 },
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: rightWord ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${i + 2}. `, size: 22 }),
                    new TextRun({ 
                      text: testType === 'en-to-ko' ? rightWord.word : rightWord.meaning, 
                      size: 22,
                      color: isAnswerKey && testType === 'en-to-ko' ? "666666" : undefined,
                      bold: isAnswerKey && testType === 'ko-to-en' ? true : false
                    }),
                    isAnswerKey ? new TextRun({
                      text: `  ${testType === 'en-to-ko' ? rightWord.meaning : rightWord.word}`,
                      size: 22,
                      bold: testType === 'en-to-ko' ? true : false,
                      color: testType === 'ko-to-en' ? "666666" : "000000"
                    }) : new TextRun({ 
                      text: " ____________________", 
                      size: 22, 
                      color: "999999" 
                    }),
                  ],
                  spacing: { before: 80, after: 80 },
                }),
              ] : [],
            }),
          ],
        })
      );
    }

    const wordTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: wordRows,
    });

    return new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          headerTable,
          new Paragraph({ spacing: { before: 200 } }),
          wordTable,
        ],
      }],
    });
  };

  // Generate Test Paper
  const testDoc = createDocument(false);
  const testBlob = await Packer.toBlob(testDoc);
  saveAs(testBlob, `${paperTitle}_${studentName}_테스트.docx`);

  // Generate Answer Key if requested
  if (includeAnswerKey) {
    const answerDoc = createDocument(true);
    const answerBlob = await Packer.toBlob(answerDoc);
    saveAs(answerBlob, `${paperTitle}_${studentName}_정답지.docx`);
  }
};
