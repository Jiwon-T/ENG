import React, { useRef, useState, useEffect } from 'react';
import { AnalysisResult, SentenceAnalysis } from '../lib/gemini';
import { Download, FileText, File as FileIcon, Sparkles, Printer, Folder, Archive, CheckCircle2, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

interface AnalysisViewProps {
  result: AnalysisResult;
  isMobile?: boolean;
  questionsOnly?: boolean;
}

export default function AnalysisView({ result, isMobile, questionsOnly }: AnalysisViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (showFolderModal && auth.currentUser) {
      const fetchFolders = async () => {
        const q = query(
          collection(db, 'folders'),
          where('uid', '==', auth.currentUser?.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      };
      fetchFolders();
    }
  }, [showFolderModal]);

  const handleSaveToArchive = async (folderId: string | null) => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const { saveAnalysisHistory, saveGeneratorHistory } = await import('../lib/firebase');
      if (questionsOnly) {
        await saveGeneratorHistory(auth.currentUser.uid, result.originalText || '', result, folderId);
      } else {
        await saveAnalysisHistory(auth.currentUser.uid, result.originalText || '', result, folderId);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save to archive:', error);
    } finally {
      setIsSaving(false);
      setShowFolderModal(false);
    }
  };

  const exportToPDF = async () => {
    if (!containerRef.current) return;
    
    setIsSaving(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const canvas = await html2canvas(containerRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${result.title || 'analysis'}.pdf`);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const exportToWord = async () => {
    setIsSaving(true);
    try {
      const { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType, TableBorders, ShadingType, VerticalAlign } = await import('docx');
      const { saveAs } = (await import('file-saver'));

      const parseTextWithUnderline = (text: string, size: number = 18) => {
        if (!text) return [];
        const parts = text.split(/(<u>.*?<\/u>)/g);
        return parts.map((part) => {
          if (part.startsWith('<u>') && part.endsWith('</u>')) {
            const content = part.substring(3, part.length - 4);
            return new TextRun({ text: content, underline: {}, bold: true, size });
          }
          return new TextRun({ text: part, size });
        });
      };

      const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "지원T", size: 16, bold: true, color: "FF4D6D" }),
                new TextRun({ text: " English", size: 16, bold: true, color: "64748B" }),
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 100 },
            }),
            new Paragraph({
              text: result.title,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: result.englishTitle,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Sentences Analysis Section
            ...(!questionsOnly ? result.sentences.flatMap((s, i) => {
              const chunksPerLine = 5;
              const chunkGroups = [];
              for (let j = 0; j < s.chunks.length; j += chunksPerLine) {
                chunkGroups.push(s.chunks.slice(j, j + chunksPerLine));
              }

              return [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${s.category} `, size: 16, color: "059669", bold: true }),
                    new TextRun({ text: `${i + 1}. `, bold: true, size: 24, color: "64748B" }),
                    ...(s.isTopicSentence ? [new TextRun({ text: " [주제 문장]", color: "B45309", bold: true, size: 16 })] : []),
                    ...(s.isInsertionPoint ? [new TextRun({ text: " [삽입 문장]", color: "1D4ED8", bold: true, size: 16 })] : []),
                    ...(s.isImportant ? [new TextRun({ text: " [서술형 대비]", color: "DC2626", bold: true, size: 16 })] : []),
                  ],
                  spacing: { before: 400, after: 200 },
                }),
                ...chunkGroups.map(group => new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  borders: TableBorders.NONE,
                  rows: [
                    // Grammar Note Row
                    new TableRow({
                      children: group.map(c => {
                        const note = c.grammarNote || "";
                        const truncatedNote = note.length > 20 ? note.substring(0, 20) + "..." : note;
                        return new TableCell({
                          children: [new Paragraph({
                            children: [new TextRun({ text: truncatedNote ? `↗${truncatedNote}` : "", size: 12, color: "B45309", italics: true })],
                            alignment: AlignmentType.CENTER,
                          })],
                          borders: TableBorders.NONE,
                          width: { size: 1, type: WidthType.AUTO },
                        });
                      }),
                    }),
                    // Marking Row
                    new TableRow({
                      children: group.map(c => {
                        const mark = c.marking || "";
                        const truncatedMark = mark.length > 10 ? mark.substring(0, 10) + "..." : mark;
                        return new TableCell({
                          children: [new Paragraph({
                            children: [new TextRun({ text: truncatedMark, size: 14, bold: true, color: "DC2626" })],
                            alignment: AlignmentType.CENTER,
                          })],
                          borders: TableBorders.NONE,
                          width: { size: 1, type: WidthType.AUTO },
                        });
                      }),
                    }),
                    // English Text Row
                    new TableRow({
                      children: group.map(c => {
                        let color = "1E293B"; // Default slate-800
                        if (c.color === 'red') color = "DC2626";
                        if (c.color === 'blue') color = "2563EB";
                        if (c.color === 'green') color = "059669";
                        if (c.color === 'purple') color = "9333EA";
                        if (c.color === 'brown') color = "B45309";
                        
                        return new TableCell({
                          children: [new Paragraph({
                            children: [new TextRun({ 
                              text: c.text, 
                              size: 20, 
                              bold: true, 
                              color: color,
                              underline: c.underline ? { type: "single", color: "64748B" } : undefined,
                              highlight: c.highlight ? "yellow" : undefined
                            })],
                            alignment: AlignmentType.CENTER,
                          })],
                          borders: TableBorders.NONE,
                          width: { size: 1, type: WidthType.AUTO },
                        });
                      }),
                    }),
                    // Translation Row
                    new TableRow({
                      children: group.map(c => new TableCell({
                        children: [new Paragraph({
                          children: [new TextRun({ text: c.translation, size: 16, color: "64748B" })],
                          alignment: AlignmentType.CENTER,
                        })],
                        borders: TableBorders.NONE,
                        width: { size: 1, type: WidthType.AUTO },
                      })),
                    }),
                  ],
                })),
                new Paragraph({
                  children: [new TextRun({ text: s.fullTranslation, color: "059669", size: 18, bold: true })],
                  shading: { fill: "ECFDF5", type: ShadingType.CLEAR, color: "auto" },
                  spacing: { before: 200, after: 120 },
                  indent: { left: 200, right: 200 },
                }),
                ...(s.grammarPoints && s.grammarPoints.length > 0 ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "● 어법 포인트: ", bold: true, size: 14, color: "475569" }),
                      new TextRun({ text: s.grammarPoints.join(", "), size: 14, color: "475569" })
                    ],
                    spacing: { after: 200 },
                    indent: { left: 400 },
                  })
                ] : []),
              ];
            }) : []),

            // 논리 구조 분석 Section
            ...(!questionsOnly ? [
              new Paragraph({
                text: "[논리 구조 분석]",
                alignment: AlignmentType.CENTER,
                shading: { fill: "F5F3FF", type: ShadingType.CLEAR }, // Pastel Purple
                spacing: { before: 800, after: 200 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "주제", bold: true, color: "7C3AED" })] })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "EDE9FE" } }),
                      new TableCell({ children: [
                        new Paragraph({ text: `▶ ${result.topic.ko}`, spacing: { after: 60 } }),
                        new Paragraph({ text: result.topic.en, spacing: { after: 60 } }),
                      ]}),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "요지", bold: true, color: "BE185D" })] })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "FCE7F3" } }),
                      new TableCell({ children: [
                        new Paragraph({ text: `▶ ${result.mainIdea.ko}`, spacing: { after: 60 } }),
                        new Paragraph({ text: result.mainIdea.en, spacing: { after: 60 } }),
                      ]}),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "요약", bold: true, color: "0369A1" })] })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "E0F2FE" } }),
                      new TableCell({ children: [
                        new Paragraph({ text: `▶ ${result.summaryLong.ko}`, spacing: { after: 60 } }),
                        new Paragraph({ text: result.summaryLong.en, spacing: { after: 60 } }),
                      ]}),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "전개 방식", bold: true, color: "0D9488" })] })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "F0FDFA" } }),
                      new TableCell({ children: [
                        new Paragraph({ text: `▶ ${result.logicType}`, spacing: { after: 60 } }),
                      ]}),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "글의 목적", bold: true, color: "4338CA" })] })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "EEF2FF" } }),
                      new TableCell({ children: [
                        new Paragraph({ text: `▶ ${result.purpose}`, spacing: { after: 60 } }),
                      ]}),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "핵심 문장", bold: true, color: "7E22CE" })] })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "FAF5FF" } }),
                      new TableCell({ children: [
                        new Paragraph({ text: `▶ ${result.keySentence}`, spacing: { after: 60 } }),
                      ]}),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "핵심 어휘", bold: true, color: "B45309" })] })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "FFFBEB" } }),
                      new TableCell({ children: [
                        new Paragraph({ 
                          children: result.keywords.map((k, idx) => new TextRun({ 
                            text: `${k.en}(${k.ko})${idx < result.keywords.length - 1 ? ", " : ""}`,
                            size: 18
                          })),
                          spacing: { after: 60 } 
                        }),
                      ]}),
                    ],
                  }),
                ],
              }),

              // 지문 흐름 요약 Section
              new Paragraph({
                text: "[지문 흐름 요약]",
                alignment: AlignmentType.CENTER,
                shading: { fill: "FDF2F8", type: ShadingType.CLEAR },
                spacing: { before: 400, after: 200 },
              }),
              ...result.plotPoints.map((point, idx) => new Paragraph({
                children: [
                  new TextRun({ text: `${idx + 1}. `, bold: true, color: "BE185D" }),
                  new TextRun({ text: point }),
                ],
                spacing: { after: 120 },
                indent: { left: 240 },
              })),
            ] : []),

            // Questions Section
            ...(result.questions && result.questions.length > 0 ? [
              new Paragraph({
                text: "변형 문제 (Variant Questions)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 800, after: 400 },
              }),
              // Cloze Passage for Workbook
              ...(result.clozePassage ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "[워크북] 빈칸에 알맞은 말을 쓰시오.", bold: true, color: "FF4D6D" })
                  ],
                  spacing: { before: 400, after: 200 },
                }),
                new Paragraph({
                  children: parseTextWithUnderline(result.clozePassage, 20),
                  border: {
                    top: { color: "000000", space: 8, style: "single", size: 6 },
                    bottom: { color: "000000", space: 8, style: "single", size: 6 },
                    left: { color: "000000", space: 8, style: "single", size: 6 },
                    right: { color: "000000", space: 8, style: "single", size: 6 },
                  },
                  spacing: { after: 400 },
                  indent: { left: 200, right: 200 },
                })
              ] : []),
              // Other Questions in 2 columns
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: TableBorders.NONE,
                rows: (() => {
                  const filteredQuestions = result.questions.filter(q => q.type !== 'vocabulary');
                  const rows = [];
                  for (let i = 0; i < filteredQuestions.length; i += 2) {
                    const q1 = filteredQuestions[i];
                    const q2 = filteredQuestions[i + 1];
                    rows.push(new TableRow({
                      children: [
                        new TableCell({
                          children: q1 ? renderWordQuestion(q1, i) : [],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: TableBorders.NONE,
                          verticalAlign: VerticalAlign.TOP,
                        }),
                        new TableCell({
                          children: q2 ? renderWordQuestion(q2, i + 1) : [],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: TableBorders.NONE,
                          verticalAlign: VerticalAlign.TOP,
                        }),
                      ],
                    }));
                  }
                  return rows;
                })(),
              }),

              // Answer Key at the very end
              new Paragraph({
                text: "정답 및 해설",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 1000, after: 400 },
              }),
              ...(result.clozeAnswers && result.clozeAnswers.length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: "[워크북] 정답: ", bold: true, color: "DC2626" }),
                    new TextRun({ text: result.clozeAnswers.map((ans, i) => `${String.fromCharCode(9312 + i)} ${ans}`).join(', '), color: "DC2626", bold: true }),
                  ],
                  spacing: { before: 120, after: 120 },
                })
              ] : []),
              ...result.questions.flatMap((q, i) => [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Q${i + 1}. 정답: `, bold: true, color: "DC2626" }),
                    new TextRun({ text: q.answer, color: "DC2626", bold: true }),
                  ],
                  spacing: { before: 120, after: 120 },
                }),
                ...(q.explanation ? [new Paragraph({
                  children: [
                    new TextRun({ text: "해설: ", bold: true, color: "64748B" }),
                    new TextRun({ text: q.explanation, color: "64748B" }),
                  ],
                  spacing: { after: 200 },
                })] : []),
              ])
            ] : []),
          ],
        },
      ],
    });

    function renderWordQuestion(q: any, i: number) {
      const isDaeui = ['title', 'gist', 'topic', 'claim'].includes(q.type);
      return [
        new Paragraph({
          children: [
            new TextRun({ text: `Q${i + 1}. [${
              q.type === 'ordering' ? '순서 배열' : 
              q.type === 'insertion' ? '문장 삽입' : 
              q.type === 'summary' ? '요약문 완성' : 
              q.type === 'blank' ? '빈칸 추론' : 
              q.type === 'grammar' ? '어법 수정' : 
              q.type === 'consistency' ? '내용 일치/불일치' : 
              q.type === 'gist' ? '요지 파악' : 
              q.type === 'claim' ? '필자의 주장' : 
              q.type === 'topic' ? '주제 파악' : 
              q.type === 'irrelevant' ? '무관한 문장' : 
              q.type === 'workbook' ? '빈칸 워크북' :
              q.type === 'title' ? '제목 추론' : q.type
            }] `, bold: true, color: "FF4D6D" }),
            new TextRun({ text: q.question, bold: true }),
          ],
          spacing: { before: 200, after: 120 },
        }),
        ...(q.boxContent && !isDaeui ? [
          new Paragraph({
            children: parseTextWithUnderline(q.boxContent, 18),
            border: {
              top: { color: "000000", space: 8, style: "single", size: 6 },
              bottom: { color: "000000", space: 8, style: "single", size: 6 },
              left: { color: "000000", space: 8, style: "single", size: 6 },
              right: { color: "000000", space: 8, style: "single", size: 6 },
            },
            spacing: { before: 120, after: 120 },
            indent: { left: 100, right: 100 },
          })
        ] : []),
        ...(q.passage && q.type !== 'blank' && !isDaeui ? [
          new Paragraph({
            children: parseTextWithUnderline(q.passage, 16),
            border: {
              top: { color: "000000", space: 8, style: "single", size: 6 },
              bottom: { color: "000000", space: 8, style: "single", size: 6 },
              left: { color: "000000", space: 8, style: "single", size: 6 },
              right: { color: "000000", space: 8, style: "single", size: 6 },
            },
            spacing: { before: 120, after: 120 },
            indent: { left: 100, right: 100 },
          })
        ] : []),
        ...(q.summaryPassage ? [
          new Paragraph({
            children: [new TextRun({ text: q.summaryPassage, size: 16, italics: true })],
            border: {
              top: { color: "000000", space: 8, style: "single", size: 6 },
              bottom: { color: "000000", space: 8, style: "single", size: 6 },
              left: { color: "000000", space: 8, style: "single", size: 6 },
              right: { color: "000000", space: 8, style: "single", size: 6 },
            },
            spacing: { before: 120, after: 120 },
            indent: { left: 100, right: 100 },
          })
        ] : []),
        ...(q.paragraphs && q.type === 'ordering' ? [
          ...(['A', 'B', 'C'] as const).map(key => new Paragraph({
            children: [
              new TextRun({ text: `(${key}) `, bold: true, color: "FF4D6D" }),
              new TextRun({ text: q.paragraphs![key], size: 16 }),
            ],
            spacing: { before: 60, after: 60 },
            indent: { left: 200 },
          }))
        ] : []),
        ...(q.options ? q.options.map((opt, oIdx) => new Paragraph({
          children: [
            new TextRun({ text: `${oIdx + 1}. `, bold: true, color: "FF4D6D" }),
            new TextRun({ text: opt }),
          ],
          indent: { left: 200 },
          spacing: { after: 40 },
        })) : []),
      ];
    }

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${result.title || 'analysis'}.docx`);
    } catch (e) {
      console.error('Word export failed:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const renderPassage = (text: string) => {
    if (!text) return null;
    
    // Replace <u>...</u> with styled spans
    const parts = text.split(/(<u>.*?<\/u>)/g);
    return parts.map((part, i) => {
      if (part.startsWith('<u>') && part.endsWith('</u>')) {
        const content = part.substring(3, part.length - 4);
        return (
          <span key={i} className="underline decoration-2 decoration-pastel-pink-400 font-bold underline-offset-4">
            {content}
          </span>
        );
      }
      return part;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print-container">
      <div className="flex justify-end items-center gap-3 no-print">
        {saveSuccess ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-sm border border-green-100">
            <CheckCircle2 size={18} />
            보관소에 저장됨
          </div>
        ) : (
          <button
            onClick={() => setShowFolderModal(true)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-medium text-sm border border-blue-100 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />}
            보관소 저장
          </button>
        )}
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors font-medium text-sm"
        >
          <Printer size={18} />
          인쇄하기
        </button>
        <button
          onClick={exportToWord}
          className="flex items-center gap-2 px-4 py-2 bg-pastel-pink-100 text-pastel-pink-600 rounded-xl hover:bg-pastel-pink-200 transition-colors font-medium text-sm"
        >
          <FileText size={18} />
          Word 다운로드
        </button>
      </div>

      {/* Folder Selection Modal */}
      <AnimatePresence>
        {showFolderModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900">보관 폴더 선택</h3>
                <button onClick={() => setShowFolderModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-3 mb-8 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                <button
                  onClick={() => handleSaveToArchive(null)}
                  disabled={isSaving}
                  className="w-full p-4 text-left bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-500 transition-all font-bold flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 shadow-sm transition-colors">
                    <Archive size={20} />
                  </div>
                  <div>
                    <div className="text-slate-900">최근 기록 (폴더 없음)</div>
                    <div className="text-[10px] text-slate-400">최근 5개까지만 보관됩니다.</div>
                  </div>
                </button>
                
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => handleSaveToArchive(folder.id)}
                    disabled={isSaving}
                    className="w-full p-4 text-left bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-500 transition-all font-bold flex items-center gap-3 group"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm transition-colors">
                      <Folder size={20} />
                    </div>
                    <span className="text-slate-900">{folder.name}</span>
                  </button>
                ))}

                {folders.length === 0 && (
                  <div className="py-8 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    생성된 폴더가 없습니다.
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowFolderModal(false)} 
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  취소
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div ref={containerRef} className={`analysis-container ${isMobile ? 'mobile-mode' : ''}`}>
        {!questionsOnly && (
          <>
            <header className="mb-8 border-b-2 border-slate-200 pb-4">
              <div className={`flex ${isMobile ? 'flex-col' : 'items-start'} gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200`}>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-slate-200 text-slate-700 font-bold rounded text-sm w-10 flex items-center justify-center text-center">
                    제목
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">{result.title}</h1>
                </div>
                <div className={isMobile ? 'w-full' : ''}>
                  <h2 className="text-lg font-medium text-slate-700">{result.englishTitle}</h2>
                </div>
                <div className={`${isMobile ? 'w-full text-left mt-2' : 'ml-auto text-right'} text-[10px] text-slate-400 leading-tight`}>
                  밑줄_병렬, 동사 / <span className="bg-yellow-200 px-1 rounded text-slate-700">형광펜_선행사</span><br />
                  <span className="text-blue-600">주어</span> / <span className="text-red-600">동사</span> / <span className="text-purple-600">목적어</span> / <span className="text-emerald-600">접속사 & 전치사</span> / <span className="text-amber-800">수식어구</span>
                </div>
              </div>
            </header>

            <div className="space-y-6">
              {result.sentences.map((sentence, sIdx) => (
                <SentenceBlock key={sIdx} sentence={sentence} index={sIdx} isMobile={isMobile} />
              ))}
            </div>

            {/* 논리 구조 분석 Section */}
            <div className="mt-12">
              <div className="bg-purple-100 text-center font-bold py-1 text-sm rounded-t-lg border-x border-t border-purple-200 text-purple-700">
                [논리 구조 분석]
              </div>
              <div className="border border-purple-100 rounded-b-lg overflow-hidden">
                {/* 주제 */}
                <div className={`flex ${isMobile ? 'flex-col' : ''} border-b border-purple-50 bg-white`}>
                  <div className={`${isMobile ? 'w-full py-2' : 'w-24'} flex-shrink-0 bg-purple-50 flex items-center justify-center font-bold text-sm text-purple-600 border-r border-purple-100`}>
                    주제
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-purple-300">▶</span>
                      <p className="text-sm font-medium text-slate-800">{result.topic.ko}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-5">
                      <p className="text-xs text-slate-600">{result.topic.en}</p>
                    </div>
                  </div>
                </div>
                {/* 요지 */}
                <div className={`flex ${isMobile ? 'flex-col' : ''} border-b border-pastel-pink-50 bg-white`}>
                  <div className={`${isMobile ? 'w-full py-2' : 'w-24'} flex-shrink-0 bg-pastel-pink-50 flex items-center justify-center font-bold text-sm text-pastel-pink-600 border-r border-pastel-pink-100`}>
                    요지
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-pastel-pink-300">▶</span>
                      <p className="text-sm font-medium text-slate-800">{result.mainIdea.ko}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-5">
                      <p className="text-xs text-slate-600">{result.mainIdea.en}</p>
                    </div>
                  </div>
                </div>
                {/* 요약 */}
                <div className={`flex ${isMobile ? 'flex-col' : ''} border-b border-blue-50 bg-white`}>
                  <div className={`${isMobile ? 'w-full py-2' : 'w-24'} flex-shrink-0 bg-blue-50 flex items-center justify-center font-bold text-sm text-blue-600 border-r border-blue-100`}>
                    요약
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-blue-300">▶</span>
                      <p className="text-sm font-medium text-slate-800">{result.summaryLong.ko}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-5">
                      <p className="text-xs text-slate-600">{result.summaryLong.en}</p>
                    </div>
                  </div>
                </div>
                {/* 전개 방식 */}
                <div className={`flex ${isMobile ? 'flex-col' : ''} border-b border-teal-50 bg-white`}>
                  <div className={`${isMobile ? 'w-full py-2' : 'w-24'} flex-shrink-0 bg-teal-50 flex items-center justify-center font-bold text-sm text-teal-600 border-r border-teal-100`}>
                    전개 방식
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-teal-300">▶</span>
                      <p className="text-sm font-medium text-slate-800">{result.logicType}</p>
                    </div>
                  </div>
                </div>
                {/* 글의 목적 */}
                <div className={`flex ${isMobile ? 'flex-col' : ''} border-b border-indigo-50 bg-white`}>
                  <div className={`${isMobile ? 'w-full py-2' : 'w-24'} flex-shrink-0 bg-indigo-50 flex items-center justify-center font-bold text-sm text-indigo-600 border-r border-indigo-100`}>
                    글의 목적
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-300">▶</span>
                      <p className="text-sm font-medium text-slate-800">{result.purpose}</p>
                    </div>
                  </div>
                </div>
                {/* 핵심 문장 */}
                <div className={`flex ${isMobile ? 'flex-col' : ''} border-b border-violet-50 bg-white`}>
                  <div className={`${isMobile ? 'w-full py-2' : 'w-24'} flex-shrink-0 bg-violet-50 flex items-center justify-center font-bold text-sm text-violet-600 border-r border-violet-100`}>
                    핵심 문장
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-violet-300 mt-0.5">▶</span>
                      <p className="text-sm font-medium text-slate-800 italic leading-relaxed">
                        {result.keySentence}
                      </p>
                    </div>
                  </div>
                </div>
                {/* 핵심 어휘 */}
                <div className={`flex ${isMobile ? 'flex-col' : ''} bg-white`}>
                  <div className={`${isMobile ? 'w-full py-2' : 'w-24'} flex-shrink-0 bg-amber-50 flex items-center justify-center font-bold text-sm text-amber-600 border-r border-amber-100`}>
                    핵심 어휘
                  </div>
                  <div className="flex-grow p-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      {result.keywords.map((k, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="text-slate-800 font-bold text-sm">{k.en}</span>
                          <span className="text-slate-400 text-xs">{k.ko}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 지문 흐름 요약 Section */}
            <div className="mt-8">
              <div className="bg-pastel-pink-100 text-center font-bold py-1 text-sm rounded-t-lg border-x border-t border-pastel-pink-200 text-pastel-pink-700">
                [지문 흐름 요약]
              </div>
              <div className="border border-pastel-pink-100 rounded-b-lg bg-white p-6 space-y-4">
                {result.plotPoints.map((point, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="font-bold text-pastel-pink-500">{idx + 1}.</span>
                    <p className="text-sm text-slate-700 leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {result.questions && result.questions.length > 0 && (
          <div className={`${questionsOnly ? '' : 'mt-16 pt-12 border-t-4 border-pastel-pink-100'}`}>
            <h2 className="text-2xl font-black text-pastel-pink-500 mb-8 flex items-center gap-2">
              <Sparkles size={24} />
              {questionsOnly ? '생성된 변형 문제' : '변형 문제'}
            </h2>
            
            {result.clozePassage && (
              <div className="mb-12 bg-white p-8 rounded-2xl border-2 border-pastel-pink-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="text-pastel-pink-400" size={20} />
                  [워크북] 빈칸에 알맞은 말을 쓰시오.
                </h3>
                <p className="text-lg leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {renderPassage(result.clozePassage)}
                </p>
              </div>
            )}

            <div className="space-y-8">
              {result.questions.filter(q => q.type !== 'vocabulary').map((q, qIdx) => (
                <div key={qIdx} className="bg-pastel-pink-50/50 p-6 rounded-2xl border border-pastel-pink-100">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="px-2 py-1 bg-pastel-pink-200 text-pastel-pink-700 text-[10px] font-bold rounded uppercase">
                      {q.type === 'ordering' ? '순서 배열' : 
                       q.type === 'insertion' ? '문장 삽입' : 
                       q.type === 'summary' ? '요약문 완성' : 
                       q.type === 'blank' ? '빈칸 추론' : 
                       q.type === 'grammar' ? '어법 수정' : 
                       q.type === 'consistency' ? '내용 일치/불일치' : 
                       q.type === 'gist' ? '요지 파악' : 
                       q.type === 'claim' ? '필자의 주장' : 
                       q.type === 'topic' ? '주제 파악' : 
                       q.type === 'irrelevant' ? '무관한 문장' : 
                       q.type === 'workbook' ? '빈칸 워크북' :
                       q.type === 'title' ? '제목 추론' : q.type}
                    </span>
                    <h3 className="font-bold text-slate-800">Q{qIdx + 1}. {q.question}</h3>
                  </div>

                  {q.boxContent && !['title', 'gist', 'topic', 'claim'].includes(q.type) && (
                    <div className="mb-6 p-6 border-2 border-slate-900 bg-white font-medium text-slate-900 text-base leading-relaxed shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                      {renderPassage(q.boxContent)}
                    </div>
                  )}

                  {q.passage && q.type !== 'blank' && !['title', 'gist', 'topic', 'claim'].includes(q.type) && (
                    <div className="mb-6 p-6 border-2 border-slate-900 bg-white text-base text-slate-800 leading-loose whitespace-pre-wrap shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                      {renderPassage(q.passage)}
                    </div>
                  )}

                  {q.summaryPassage && (
                    <div className="mb-6 p-6 bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
                      <p className="text-slate-900 text-base leading-relaxed italic">
                        {q.summaryPassage}
                      </p>
                    </div>
                  )}

                  {q.paragraphs && q.type === 'ordering' && (
                    <div className="space-y-4 mb-6">
                      {(['A', 'B', 'C'] as const).map(key => (
                        <div key={key} className="flex gap-3 p-4 border border-slate-200 bg-white rounded-lg">
                          <span className="font-bold text-slate-900 flex-shrink-0">({key})</span>
                          <p className="text-base text-slate-800 leading-relaxed">{q.paragraphs![key]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {q.options && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 ml-4">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="text-sm text-slate-600 flex gap-2">
                          <span className="font-bold text-pastel-pink-400">{oIdx + 1}.</span>
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-16 p-8 bg-slate-900 rounded-3xl text-white">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2 text-pastel-pink-300">
                <Sparkles size={20} />
                정답 및 해설
              </h3>
              <div className="space-y-6">
                {result.clozeAnswers && result.clozeAnswers.length > 0 && (
                  <div className="border-b border-slate-800 pb-4">
                    <p className="font-bold mb-1">
                      <span className="text-pastel-pink-400 mr-2">[워크북]</span>
                      정답: {result.clozeAnswers.map((ans, i) => `${String.fromCharCode(9312 + i)} ${ans}`).join(', ')}
                    </p>
                  </div>
                )}
                {result.questions.map((q, qIdx) => (
                  <div key={qIdx} className="border-b border-slate-800 pb-4 last:border-0">
                    <p className="font-bold mb-1">
                      <span className="text-pastel-pink-400 mr-2">Q{qIdx + 1}.</span>
                      정답: {q.answer}
                    </p>
                    {q.explanation && <p className="text-slate-400 text-sm">{q.explanation}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SentenceBlock: React.FC<{ sentence: SentenceAnalysis; index: number; isMobile?: boolean }> = ({ sentence, index, isMobile }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="sentence-block border-b border-slate-100 pb-6 mb-6 last:border-0"
    >
      <div className={`flex ${isMobile ? 'flex-col' : 'items-start'} gap-4`}>
        <div className={`flex-shrink-0 ${isMobile ? 'w-full flex items-center gap-3 border-b border-slate-50 pb-2 mb-2' : 'w-24 text-right pt-1'}`}>
          <div className="text-[10px] font-bold text-emerald-600 leading-tight">
            {sentence.category}
          </div>
          <div className="text-lg font-black text-slate-300">
            {index + 1}
          </div>
        </div>
        
        <div className="flex-grow">
          <div className={`flex ${isMobile ? 'justify-start' : 'justify-end'} gap-2 mb-2`}>
            {sentence.isTopicSentence && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded border border-amber-200">
                주제 문장
              </span>
            )}
            {sentence.isInsertionPoint && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
                삽입 문장
              </span>
            )}
            {sentence.isImportant && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded border border-red-200">
                서술형 대비
              </span>
            )}
          </div>

          <div className={`chunk-container mb-4 ${isMobile ? 'flex flex-wrap gap-y-6' : ''}`}>
            {sentence.chunks.map((chunk, cIdx) => (
              <div key={cIdx} className={`chunk-item ${isMobile ? 'min-w-[40px] flex-shrink-0' : 'min-w-[60px]'}`}>
                {chunk.grammarNote && (
                  <span className="chunk-grammar-note text-amber-700 font-bold">
                    <span className="text-red-500 mr-0.5">↗</span>
                    {chunk.grammarNote.length > (isMobile ? 15 : 20) ? chunk.grammarNote.substring(0, isMobile ? 15 : 20) + '...' : chunk.grammarNote}
                  </span>
                )}
                {chunk.marking && (
                  <span className="chunk-marking text-red-500 font-black text-xs">
                    {chunk.marking.length > (isMobile ? 8 : 10) ? chunk.marking.substring(0, isMobile ? 8 : 10) + '...' : chunk.marking}
                  </span>
                )}
                <span className={`chunk-text ${isMobile ? 'text-lg' : 'text-xl'} font-bold ${getChunkColorClass(chunk.color)} ${chunk.underline ? 'border-b-2 border-slate-400' : ''} ${chunk.highlight ? 'bg-yellow-200 px-1 rounded' : ''}`}>
                  {chunk.text}
                </span>
                <span className={`chunk-translation ${isMobile ? 'text-[10px]' : 'text-sm'} text-slate-500 font-medium`}>
                  {chunk.translation}
                </span>
              </div>
            ))}
          </div>

          <div className="text-sm text-emerald-600 font-medium bg-emerald-50/50 p-2 rounded border border-emerald-100/50 mb-2">
            {sentence.fullTranslation}
          </div>

          {sentence.grammarPoints && sentence.grammarPoints.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 ml-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-0.5">어법 포인트</span>
              <div className="flex flex-wrap gap-2">
                {sentence.grammarPoints.map((point, pIdx) => (
                  <span key={pIdx} className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    {point}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function getChunkColorClass(color?: string) {
  const c = color?.toLowerCase().trim();
  switch (c) {
    case 'red': return 'text-red-600';
    case 'blue': return 'text-blue-600';
    case 'green': return 'text-emerald-600';
    case 'purple': return 'text-purple-600';
    case 'brown': return 'text-amber-800';
    default: return 'text-slate-900';
  }
}
