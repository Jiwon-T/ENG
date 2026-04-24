import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign, HeightRule, SectionType, PageOrientation } from 'docx';
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
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      },
      rows: [
        new TableRow({
          height: { value: 900, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              shading: { fill: "F1F5F9" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: "지원T",
                      bold: true,
                      size: 24,
                      color: "FF4D6D"
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
                      size: 28,
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
                      color: "64748B"
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
                      text: `이름: ${studentName || '__________'}`, 
                      size: 22,
                      bold: true 
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  indent: { left: 200 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: isAnswerKey ? "(정답지)" : "점수: ______ / ______", 
                      size: 16,
                      color: isAnswerKey ? "DC2626" : "64748B"
                    }),
                  ],
                  alignment: AlignmentType.LEFT,
                  indent: { left: 200 },
                  spacing: { before: 100 },
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
          height: { value: 650, rule: HeightRule.ATLEAST },
          children: [
            // LEFT SIDE
            // Index
            new TableCell({
              width: { size: 4, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [new Paragraph({ children: [new TextRun({ text: `${i + 1}`, size: 18, color: "888888" })], alignment: AlignmentType.CENTER })],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              }
            }),
            // Question (Word or Meaning)
            new TableCell({
              width: { size: 21, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: testType === 'en-to-ko' ? (leftWord.word || "") : (leftWord.meaning || ""), 
                      size: 22,
                      bold: true,
                      color: isAnswerKey && testType === 'en-to-ko' ? "666666" : "000000"
                    })
                  ],
                  indent: { left: 100 },
                }),
              ],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              }
            }),
            // Answer Blank
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: isAnswerKey ? [
                    new TextRun({
                      text: testType === 'en-to-ko' ? (leftWord.meaning || "") : (leftWord.word || ""),
                      size: 20,
                      bold: true,
                      color: "DC2626"
                    })
                  ] : [],
                  alignment: AlignmentType.LEFT,
                  indent: { left: 40 },
                }),
              ],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" }, // The "Blank" line
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.SINGLE, size: 4, color: "333333" }, // Center divider
              }
            }),

            // RIGHT SIDE
            // Index
            new TableCell({
              width: { size: 4, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: rightWord ? [new Paragraph({ children: [new TextRun({ text: `${i + 2}`, size: 18, color: "888888" })], alignment: AlignmentType.CENTER })] : [],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              }
            }),
            // Question
            new TableCell({
              width: { size: 21, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: rightWord ? [
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: testType === 'en-to-ko' ? (rightWord.word || "") : (rightWord.meaning || ""), 
                      size: 22,
                      bold: true,
                      color: isAnswerKey && testType === 'en-to-ko' ? "666666" : "000000"
                    })
                  ],
                  indent: { left: 100 },
                }),
              ] : [],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              }
            }),
            // Answer Blank
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              children: rightWord ? [
                new Paragraph({
                  children: isAnswerKey ? [
                    new TextRun({
                      text: testType === 'en-to-ko' ? (rightWord.meaning || "") : (rightWord.word || ""),
                      size: 20,
                      bold: true,
                      color: "DC2626"
                    })
                  ] : [],
                  alignment: AlignmentType.LEFT,
                  indent: { left: 40 },
                }),
              ] : [],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "F5F5F5" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" }, // The "Blank" line
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              }
            }),
          ],
        })
      );
    }

    const wordTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "333333" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333" },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "EEEEEE" },
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
          height: { value: 800, rule: HeightRule.ATLEAST },
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

    const headerElements: any[] = [];
    headerElements.push(headerTable);
    headerElements.push(new Paragraph({ spacing: { before: 100 } }));

    const quizElements: any[] = [];

    words.forEach((item, index) => {
      let distractors: string[] = [];
      let correctAnswer = "";
      let questionPrefix = "";

      if (wordbookType === 'irregular') {
        const isPast = (index % 2 === 0);
        correctAnswer = isPast ? item.past : item.pastParticiple;
        questionPrefix = isPast ? "과거형(Past)을 고르세요" : "과거분사(Participle)를 고르세요";
        
        if (item.distractors && item.distractors.length >= 3) {
          distractors = [...item.distractors].slice(0, 3);
        } else {
          distractors = [item.base + 'ed', item.past + 'ed', item.base + 'en'].filter(d => d !== correctAnswer);
          while (distractors.length < 3) distractors.push(item.base + 't');
        }
      } else if (wordbookType === 'conversion-grammar') {
        const baseOptions = ["동사 O to + 간접목적어", "동사 O for + 간접목적어", "동사 O of + 간접목적어", "3형식 전환 불가"];
        if (item.pattern === 'to') correctAnswer = baseOptions[0];
        else if (item.pattern === 'for') correctAnswer = baseOptions[1];
        else if (item.pattern === 'of') correctAnswer = baseOptions[2];
        else if (item.pattern === 'impossible') correctAnswer = baseOptions[3];
        distractors = baseOptions.filter(o => o !== correctAnswer);
      } else if (wordbookType === 'to-ing-grammar') {
        const baseOptions = ["둘 다 가능(의미도 같음)", "둘 다 가능(의미는 다름)", "to부정사만 목적어", "동명사(V-ing)만 목적어"];
        if (item.pattern?.includes('의미도 같은')) correctAnswer = baseOptions[0];
        else if (item.pattern?.includes('의미는 다른')) correctAnswer = baseOptions[1];
        else if (item.pattern?.includes('to부정사만')) correctAnswer = baseOptions[2];
        else if (item.pattern?.includes('동명사만')) correctAnswer = baseOptions[3];
        distractors = baseOptions.filter(o => o !== correctAnswer);
      } else if (wordbookType === 'complement-grammar') {
        const baseOptions = ["O + 명사/형용사", "O + to V", "O + 동사원형", "O + V-ing", "O + p.p. (과거분사)"];
        if (item.pattern?.includes('명형')) correctAnswer = baseOptions[0];
        else if (item.pattern?.includes('to V')) correctAnswer = baseOptions[1];
        else if (item.pattern?.includes('동사원형')) correctAnswer = baseOptions[2];
        else if (item.pattern?.includes('V-ing')) correctAnswer = baseOptions[3];
        else if (item.pattern?.includes('p.p') || item.pattern?.includes('과거분사')) correctAnswer = baseOptions[4];
        
        // Pick 3 distractors from the rest
        distractors = baseOptions.filter(o => o !== correctAnswer).sort(() => 0.5 - Math.random()).slice(0, 3);
      } else if (wordbookType === 'relative-grammar') {
        const choices = item.distractors || [];
        correctAnswer = choices[0] || '';
        distractors = choices.slice(1);
      } else {
        correctAnswer = item.meaning;
        distractors = allPatterns.filter(p => p !== correctAnswer).sort(() => 0.5 - Math.random()).slice(0, 3);
      }

      const choices = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());

      const isRelative = wordbookType === 'relative-grammar';
      const isConceptGrammar = ['conversion-grammar', 'to-ing-grammar', 'complement-grammar'].includes(wordbookType || '');
      
      quizElements.push(new Paragraph({
        children: [
          new TextRun({ text: `${index + 1}. `, size: 22, bold: true }),
          new TextRun({ 
            text: (isRelative || isConceptGrammar) ? item.word : `${item.word} (${item.meaning})`, 
            size: 24, 
            bold: true 
          }),
          questionPrefix ? new TextRun({ text: ` - ${questionPrefix}`, size: 18, color: "555555", italics: true }) : new TextRun({ text: "" }),
        ],
        spacing: { before: 300, after: 100 },
        keepNext: true,
      }));

      if (isAnswerKey && isRelative && item.meaning) {
        quizElements.push(new Paragraph({
          children: [
            new TextRun({ text: `   💡 해설: ${item.meaning}`, size: 18, italics: true, color: "666666" })
          ],
          spacing: { before: 40, after: 40 }
        }));
      }

      choices.forEach((choice, cIdx) => {
        const isCorrect = choice === correctAnswer || 
          (wordbookType === 'relative-grammar' && (
            (correctAnswer === 'how' && choice === 'the way') ||
            (correctAnswer === 'the way' && choice === 'how')
          ));
        
        quizElements.push(new Paragraph({
          children: [
            new TextRun({ text: `   (${cIdx + 1}) `, size: 20 }),
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
      sections: [
        {
          properties: {
            page: { margin: { top: 720, bottom: 400, left: 720, right: 720 } },
          },
          children: headerElements,
        },
        {
          properties: {
            page: { margin: { top: 200, bottom: 720, left: 720, right: 720 } },
            type: SectionType.CONTINUOUS,
            column: {
              count: 2,
              space: 720,
            },
          },
          children: quizElements,
        }
      ],
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
          height: { value: 800, rule: HeightRule.ATLEAST },
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
      shading: { fill: "F8FAFC" }, // Light slate background
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, size: 18, color: "334155" })] })],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: "333333" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "333333" },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      }
    });

    rows.push(new TableRow({
      height: { value: 450, rule: HeightRule.ATLEAST },
      children: [
        createHeaderCell("№", 4),
        createHeaderCell("현재형 (+뜻)", 25),
        createHeaderCell("과거형", 10),
        createHeaderCell("과거분사", 11),
        createHeaderCell("№", 4),
        createHeaderCell("현재형 (+뜻)", 25),
        createHeaderCell("과거형", 10),
        createHeaderCell("과거분사", 11),
      ]
    }));

    for (let i = 0; i < halfCount; i++) {
      const leftWord = words[i];
      const rightWord = words[i + halfCount];

      const createCell = (text: string, width: number, align = AlignmentType.CENTER, bold: boolean = false, color?: string, showBottomBorder: boolean = false) => new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ 
          alignment: align, 
          children: [new TextRun({ text, size: 18, bold, color })] 
        })],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "F1F5F9" },
          bottom: showBottomBorder ? { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" } : { style: BorderStyle.SINGLE, size: 1, color: "F1F5F9" },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        }
      });

      const createBaseCell = (word: any) => new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({ 
            alignment: AlignmentType.CENTER, 
            children: [
              new TextRun({ text: word.word, bold: true, size: 18 }),
              new TextRun({ text: `  (${word.meaning})`, size: 14, color: "666666" })
            ] 
          })
        ],
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "F1F5F9" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "F1F5F9" },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        }
      });

      rows.push(new TableRow({
        height: { value: 650, rule: HeightRule.ATLEAST },
        children: [
          createCell((i + 1).toString(), 4),
          createBaseCell(leftWord),
          createCell(isAnswerKey ? leftWord.past : "", 10, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "DC2626" : undefined, !isAnswerKey),
          createCell(isAnswerKey ? leftWord.pastParticiple : "", 11, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "DC2626" : undefined, !isAnswerKey),
          
          createCell(rightWord ? (i + halfCount + 1).toString() : "", 4),
          rightWord ? createBaseCell(rightWord) : createCell("", 25),
          createCell(rightWord && isAnswerKey ? rightWord.past : "", 10, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "DC2626" : undefined, rightWord && !isAnswerKey),
          createCell(rightWord && isAnswerKey ? rightWord.pastParticiple : "", 11, AlignmentType.CENTER, isAnswerKey, isAnswerKey ? "DC2626" : undefined, rightWord && !isAnswerKey),
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
