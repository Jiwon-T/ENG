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

export const generateMultipleChoiceQuiz = async (
  title: string,
  subtitle: string,
  words: any[],
  options: {
    includeAnswerKey: boolean;
    paperTitle?: string;
    studentName?: string;
    wordbookType?: string;
  }
) => {
  const { includeAnswerKey, paperTitle = '객관식 퀴즈', studentName = '', wordbookType } = options;

  // Collect all unique patterns/labels to use as distractors if not provided
  const allPatterns = Array.from(new Set(words.map(w => w.pattern || w.meaning))).filter(p => !!p);

  const createDocument = (isAnswerKey: boolean) => {
    // Header Table
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          height: { value: 800, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "지원T", bold: true, size: 20 })] })],
            }),
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 26 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: subtitle, bold: true, size: 22 })] }),
              ],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `이름: ${studentName}`, size: 22, bold: true })],
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 80, after: 80 },
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const quizElements: any[] = [];
    quizElements.push(headerTable);
    quizElements.push(new Paragraph({ spacing: { before: 200 } }));

    words.forEach((item, index) => {
      let distractors: string[] = [];
      let correctAnswer = "";
      let questionPrefix = "";

      if (wordbookType === 'irregular') {
        const isPast = (index % 2 === 0);
        correctAnswer = isPast ? item.past : item.pastParticiple;
        questionPrefix = isPast ? "과거형(Past)을 고르세요" : "과거분사(Participle)를 고르세요";
        
        // Use custom distractors if they exist, otherwise scramble from data
        if (item.distractors && item.distractors.length >= 3) {
          distractors = [...item.distractors].slice(0, 3);
        } else {
          // Fallback scrambled distractors
          distractors = [item.base + 'ed', item.past + 'ed', item.base + 'en'].filter(d => d !== correctAnswer);
          while (distractors.length < 3) distractors.push(item.base + 't');
        }
      } else if (wordbookType === 'conversion-grammar') {
        const baseOptions = [
          "동사 O to + 간접목적어",
          "동사 O for + 간접목적어",
          "동사 O of + 간접목적어",
          "3형식 전환 불가"
        ];
        if (item.pattern === 'to') correctAnswer = baseOptions[0];
        else if (item.pattern === 'for') correctAnswer = baseOptions[1];
        else if (item.pattern === 'of') correctAnswer = baseOptions[2];
        else if (item.pattern === 'impossible') correctAnswer = baseOptions[3];
        
        distractors = baseOptions.filter(o => o !== correctAnswer);
      } else if (wordbookType === 'to-ing-grammar') {
        const baseOptions = [
          "둘 다 가능하고 의미도 같음",
          "둘 다 가능하고 의미 달라짐",
          `${item.word} to V`,
          `${item.word} Ving`
        ];
        if (item.pattern?.includes('의미도 같은')) correctAnswer = baseOptions[0];
        else if (item.pattern?.includes('의미는 다른')) correctAnswer = baseOptions[1];
        else if (item.pattern?.includes('to부정사만')) correctAnswer = baseOptions[2];
        else if (item.pattern?.includes('동명사만')) correctAnswer = baseOptions[3];
        
        distractors = baseOptions.filter(o => o !== correctAnswer);
      } else if (wordbookType === 'complement-grammar') {
        const baseOptions = [
          `${item.word} O 명사/형용사`,
          `${item.word} O to V`,
          `${item.word} O 동사원형`,
          `${item.word} O V-ing`
        ];
        if (item.pattern?.includes('명형')) correctAnswer = baseOptions[0];
        else if (item.pattern?.includes('to V')) correctAnswer = baseOptions[1];
        else if (item.pattern?.includes('동사원형')) correctAnswer = baseOptions[2];
        else if (item.pattern?.includes('V-ing')) correctAnswer = baseOptions[3];
        
        distractors = baseOptions.filter(o => o !== correctAnswer);
      } else if (wordbookType === 'relative-grammar') {
        // Index 0 in seed data is the correct answer
        const choices = item.distractors || [];
        correctAnswer = choices[0] || '';
        distractors = choices.slice(1);
      } else {
        correctAnswer = item.meaning;
        distractors = allPatterns.filter(p => p !== correctAnswer).sort(() => 0.5 - Math.random()).slice(0, 3);
      }

      const choices = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());

      // Question
      const isRelative = wordbookType === 'relative-grammar';
      quizElements.push(new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, size: 22, bold: true }),
          // For relative grammar, word is already a sentence. For others, show meaning in brackets.
          new TextRun({ 
            text: isRelative ? item.word : `${item.word} (${item.meaning})`, 
            size: 22, 
            bold: true 
          }),
          questionPrefix ? new TextRun({ text: ` - ${questionPrefix}`, size: 20, color: "555555" }) : new TextRun({ text: "" }),
        ],
        spacing: { before: 120, after: 80 },
      }));

      // Answer/Explanation for Answer Key
      if (isAnswerKey && isRelative && item.meaning) {
        quizElements.push(new Paragraph({
          children: [
            new TextRun({ text: `   💡 해설: ${item.meaning}`, size: 18, italics: true, color: "666666" })
          ],
          spacing: { before: 40, after: 40 }
        }));
      }

      // Options
      choices.forEach((choice, cIdx) => {
        const isCorrect = choice === correctAnswer || 
          (wordbookType === 'relative-grammar' && (
            (correctAnswer === 'how' && choice === 'the way') ||
            (correctAnswer === 'the way' && choice === 'how')
          ));
        
        quizElements.push(new Paragraph({
          children: [
            new TextRun({ text: `   ${cIdx + 1}) `, size: 20 }),
            new TextRun({ 
              text: choice, 
              size: 20,
              bold: isAnswerKey && isCorrect,
              color: isAnswerKey && isCorrect ? "FF0000" : undefined
            }),
          ],
          spacing: { before: 40, after: 40 },
        }));
      });
    });

    return new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: quizElements,
      }],
    });
  };

  const testDoc = createDocument(false);
  const testBlob = await Packer.toBlob(testDoc);
  saveAs(testBlob, `${paperTitle}_${studentName}_객관식_퀴즈.docx`);

  if (includeAnswerKey) {
    const answerDoc = createDocument(true);
    const answerBlob = await Packer.toBlob(answerDoc);
    saveAs(answerBlob, `${paperTitle}_${studentName}_객관식_정답지.docx`);
  }
};

export const generateIrregularVerbTest = async (
  title: string,
  subtitle: string,
  words: any[],
  options: {
    includeAnswerKey: boolean;
    paperTitle?: string;
    studentName?: string;
  }
) => {
  const { includeAnswerKey, paperTitle = '불규칙 변화 테스트', studentName = '' } = options;

  const createDocument = (isAnswerKey: boolean) => {
    // Header Table
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          height: { value: 800, rule: HeightRule.EXACT },
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "지원T", bold: true, size: 20 })] })],
            }),
            new TableCell({
              width: { size: 55, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 26 })] }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: subtitle, bold: true, size: 22 })] }),
              ],
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `이름: ${studentName}`, size: 22, bold: true })],
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 80, after: 80 },
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // Main Table Construction
    const halfCount = Math.ceil(words.length / 2);
    const rows: TableRow[] = [];

    // Table Header Row
    const createHeaderCell = (text: string, width: number) => new TableCell({
      width: { size: width, type: WidthType.PERCENTAGE },
      shading: { fill: "FFF1F2" }, // Pastel pink background
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 18 })] })]
    });

    rows.push(new TableRow({
      height: { value: 400, rule: HeightRule.EXACT },
      children: [
        createHeaderCell("", 4), // Index
        createHeaderCell("현재형", 18),
        createHeaderCell("과거형", 14),
        createHeaderCell("과거분사", 14),
        createHeaderCell("", 4), // Index 2
        createHeaderCell("현재형", 18),
        createHeaderCell("과거형", 14),
        createHeaderCell("과거분사", 14),
      ]
    }));

    for (let i = 0; i < halfCount; i++) {
      const leftWord = words[i];
      const rightWord = words[i + halfCount];

      const createCell = (text: string, width: number, align = AlignmentType.CENTER, bold: boolean = false, color?: string) => new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ 
          alignment: align, 
          children: [new TextRun({ text, size: 18, bold, color })] 
        })]
      });

      const createBaseCell = (word: any) => new TableCell({
        width: { size: 18, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({ 
            alignment: AlignmentType.CENTER, 
            children: [new TextRun({ text: word.word, bold: true, size: 18 })] 
          }),
          new Paragraph({ 
            alignment: AlignmentType.CENTER, 
            children: [new TextRun({ text: word.meaning, size: 16, color: "666666" })] 
          })
        ]
      });

      rows.push(new TableRow({
        height: { value: 600, rule: HeightRule.EXACT },
        children: [
          createCell((i + 1).toString(), 4), // Left Index
          createBaseCell(leftWord),
          createCell(isAnswerKey ? leftWord.past : "", 14, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "FF0000" : undefined),
          createCell(isAnswerKey ? leftWord.pastParticiple : "", 14, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "FF0000" : undefined),
          
          createCell(rightWord ? (i + halfCount + 1).toString() : "", 4), // Right Index
          rightWord ? createBaseCell(rightWord) : createCell("", 18),
          createCell(rightWord && isAnswerKey ? rightWord.past : "", 14, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "FF0000" : undefined),
          createCell(rightWord && isAnswerKey ? rightWord.pastParticiple : "", 14, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "FF0000" : undefined),
        ]
      }));
    }

    const mainTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: rows
    });

    return new Document({
      sections: [{
        properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          headerTable,
          new Paragraph({ spacing: { before: 200 } }),
          mainTable
        ],
      }],
    });
  };

  const testDoc = createDocument(false);
  const testBlob = await Packer.toBlob(testDoc);
  saveAs(testBlob, `${paperTitle}_${studentName}_3단변화_테스트.docx`);

  if (includeAnswerKey) {
    const answerDoc = createDocument(true);
    const answerBlob = await Packer.toBlob(answerDoc);
    saveAs(answerBlob, `${paperTitle}_${studentName}_3단변화_정답지.docx`);
  }
};
