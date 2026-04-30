import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Search, Trash2, Edit3, FileSpreadsheet, X, CheckCircle2, Circle, GripVertical, FileText, Download } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch, getDocs, orderBy } from 'firebase/firestore';
import { generateWordTest, generateMultipleChoiceQuiz, generateIrregularVerbTest, generateWordbookTable, generateVerbFormMemorizationTest } from '../../lib/wordTestGenerator';
import { MODAL_QUIZ_POOL } from '../../lib/modalQuizPool';
import { VERB_FORM_QUIZ_POOL } from '../../lib/verbFormQuizPool';
import { VERB_FORM_TABLE_DATA } from '../../lib/verbFormTableData';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Wordbook {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: any;
  order?: number;
  type?: 'standard' | 'irregular' | 'to-ing-grammar' | 'complement-grammar' | 'conversion-grammar' | 'relative-grammar' | 'modal-grammar' | 'verb-form-grammar';
  category?: 'word' | 'grammar';
  customDistractors?: string[];
  defaultUnitSize?: number;
}

interface Word {
  id: string;
  word: string;
  meaning: string;
  past?: string;
  pastParticiple?: string;
  pattern?: string;
  distractors?: string[];
  example?: string;
  imageUrl?: string;
  order?: number;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export default function WordbookManager({ category = 'word' }: { category?: 'word' | 'grammar' }) {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [selectedWordbook, setSelectedWordbook] = useState<Wordbook | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  
  // Edit word states
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [editWordValue, setEditWordValue] = useState('');
  const [editMeaningValue, setEditMeaningValue] = useState('');
  const [editPastValue, setEditPastValue] = useState('');
  const [editPastParticipleValue, setEditPastParticipleValue] = useState('');
  const [editPatternValue, setEditPatternValue] = useState('');
  const [editImageUrlValue, setEditImageUrlValue] = useState('');
  const [editDistractorsValue, setEditDistractorsValue] = useState('');
  const [editExampleValue, setEditExampleValue] = useState('');

  // Edit wordbook states
  const [editingWordbook, setEditingWordbook] = useState<Wordbook | null>(null);
  const [editWbTitleValue, setEditWbTitleValue] = useState('');
  const [editWbDistractorsValue, setEditWbDistractorsValue] = useState('');
  const [editWbUnitSizeValue, setEditWbUnitSizeValue] = useState(10);

  // Individual add states
  const [isIndividualAddOpen, setIsIndividualAddOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  // Delete confirmation states
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; type: 'wordbook' | 'word' } | null>(null);

  // Example management for relative-grammar
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);
  const [currentWordForExamples, setCurrentWordForExamples] = useState<Word | null>(null);
  const [examples, setExamples] = useState<any[]>([]);
  const [isAddingExample, setIsAddingExample] = useState(false);
  const [newExSentence, setNewExSentence] = useState('');
  const [newExExplanation, setNewExExplanation] = useState('');
  const [newExType, setNewExType] = useState<'A' | 'B'>('A');
  const [newExChoices, setNewExChoices] = useState('');

  // Test paper states
  const [isTestPaperModalOpen, setIsTestPaperModalOpen] = useState(false);
  const [isInstantTestModalOpen, setIsInstantTestModalOpen] = useState(false);
  const [instantTestText, setInstantTestText] = useState('');
  const [testPaperConfig, setTestPaperConfig] = useState({
    title: '',
    subtitle: '1회독',
    studentName: '',
    wordCount: 20,
    includeAnswerKey: true,
    testType: 'en-to-ko' as 'en-to-ko' | 'ko-to-en',
    quizType: 'standard' as 'standard' | 'multiple-choice' | 'irregular-writing' | 'memorization-table',
    selectionMode: 'range' as 'random' | 'range',
    unitSize: 40,
    startDay: 1,
    endDay: 1,
    shuffleVerbs: false
  });

  // Print Wordbook states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState({
    startDay: 1,
    endDay: 1,
    unitSize: 40
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'wordbooks'), 
      where('createdBy', 'in', [auth.currentUser.uid, 'system'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWordbooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wordbook));
      
      // Filter by category
      const filtered = fetchedWordbooks.filter(wb => {
        const wbCategory = wb.category || 'word';
        // Irregular verbs are forced into grammar category in the teacher view too
        if (wb.type === 'irregular') return category === 'grammar';
        return wbCategory === category;
      });

      // Sort in-memory to support existing data without 'order' field and avoid index requirements
      filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setWordbooks(filtered);
    });
    return () => unsubscribe();
  }, [category]);

  useEffect(() => {
    if (!selectedWordbook) {
      setWords([]);
      return;
    }
    const q = query(
      collection(db, `wordbooks/${selectedWordbook.id}/words`),
      orderBy('order', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `wordbooks/${selectedWordbook.id}/words`);
    });
    return () => unsubscribe();
  }, [selectedWordbook]);

  useEffect(() => {
    if (isExampleModalOpen && currentWordForExamples && selectedWordbook) {
      const examplesRef = collection(db, `wordbooks/${selectedWordbook.id}/words/${currentWordForExamples.id}/examples`);
      const q = query(examplesRef, orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setExamples(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [isExampleModalOpen, currentWordForExamples, selectedWordbook]);

  const handleAddExample = async () => {
    if (!selectedWordbook || !currentWordForExamples || !newExSentence.trim() || !newExExplanation.trim()) return;
    try {
      const examplesRef = collection(db, `wordbooks/${selectedWordbook.id}/words/${currentWordForExamples.id}/examples`);
      await addDoc(examplesRef, {
        sentence: newExSentence.trim(),
        explanation: newExExplanation.trim(),
        type: newExType,
        choices: newExChoices.split(',').map(s => s.trim()).filter(s => !!s),
        createdAt: Timestamp.now()
      });
      setNewExSentence('');
      setNewExExplanation('');
      setNewExChoices('');
      setIsAddingExample(false);
    } catch (error) {
      console.error('Failed to add example:', error);
    }
  };

  const handleDeleteExample = async (exampleId: string) => {
    if (!selectedWordbook || !currentWordForExamples) return;
    try {
      await deleteDoc(doc(db, `wordbooks/${selectedWordbook.id}/words/${currentWordForExamples.id}/examples`, exampleId));
    } catch (error) {
      console.error('Failed to delete example:', error);
    }
  };

  const handleCreateWordbook = async () => {
    if (!newTitle.trim() || !auth.currentUser) return;
    try {
      const maxOrder = wordbooks.length > 0 ? Math.max(...wordbooks.map(wb => wb.order ?? 0)) : -1;
      await addDoc(collection(db, 'wordbooks'), {
        title: newTitle,
        createdBy: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        order: maxOrder + 1,
        category: category
      });
      setNewTitle('');
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Failed to create wordbook:', error);
    }
  };

  const handleBulkAddWords = async () => {
    if (!bulkText.trim() || !auth.currentUser) return;
    
    let title = '';
    const wordsToProcess: { word: string; meaning: string; example?: string }[] = [];

    let remainingText = bulkText.trim();
    const titleMatch = remainingText.match(/^단어장 제목\s*:\s*(.*)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      remainingText = remainingText.replace(titleMatch[0], '').trim();
    }

    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < remainingText.length; i++) {
      const char = remainingText[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      
      if (inQuotes) {
        currentField += char;
      } else {
        if (char === '\t') {
          currentRecord.push(currentField.trim());
          currentField = '';
        } else if (char === '\n') {
          currentRecord.push(currentField.trim());
          if (currentRecord.some(f => f !== '')) {
            records.push(currentRecord);
          }
          currentRecord = [];
          currentField = '';
        } else if (char === ' ' && remainingText[i+1] === ' ') {
          currentRecord.push(currentField.trim());
          currentField = '';
          while (i + 1 < remainingText.length && remainingText[i+1] === ' ') {
            i++;
          }
        } else {
          currentField += char;
        }
      }
    }
    if (currentField || currentRecord.length > 0) {
      currentRecord.push(currentField.trim());
      if (currentRecord.some(f => f !== '')) {
        records.push(currentRecord);
      }
    }

    records.forEach(parts => {
      if (parts.length < 2 && parts[0]) {
        // Fallback for single space if only one field found
        const firstSpaceIndex = parts[0].indexOf(' ');
        if (firstSpaceIndex !== -1) {
          const word = parts[0].substring(0, firstSpaceIndex).trim();
          const meaning = parts[0].substring(firstSpaceIndex + 1).trim();
          wordsToProcess.push({ word, meaning });
        }
      } else if (parts.length >= 2) {
        wordsToProcess.push({
          word: parts[0],
          meaning: parts[1],
          example: parts[2] || ''
        });
      }
    });

    if (wordsToProcess.length === 0) {
      alert('추가할 단어를 찾지 못했습니다. 형식을 확인해주세요.');
      return;
    }

    try {
      let targetWbId = selectedWordbook?.id;

      // If title found, create a new wordbook
      if (title) {
        const maxOrder = wordbooks.length > 0 ? Math.max(...wordbooks.map(wb => wb.order ?? 0)) : -1;
        const wbRef = await addDoc(collection(db, 'wordbooks'), {
          title,
          createdBy: auth.currentUser.uid,
          createdAt: Timestamp.now(),
          order: maxOrder + 1,
          category: category
        });
        targetWbId = wbRef.id;
      }

      if (!targetWbId) {
        alert('단어장을 먼저 선택하거나 "단어장 제목 :"을 포함해주세요.');
        return;
      }

      const batch = writeBatch(db);
      wordsToProcess.forEach((item, index) => {
        const newWordRef = doc(collection(db, `wordbooks/${targetWbId}/words`));
        batch.set(newWordRef, {
          ...item,
          order: index,
          createdAt: Timestamp.now()
        });
      });

      await batch.commit();
      setIsBulkAddOpen(false);
      setBulkText('');
      if (title) {
        alert(`"${title}" 단어장이 생성되고 ${wordsToProcess.length}개의 단어가 등록되었습니다.`);
      } else {
        alert(`${wordsToProcess.length}개의 단어가 등록되었습니다.`);
      }
    } catch (error) {
      console.error('Bulk add words failed:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteWordbook = async () => {
    if (!deleteTarget || deleteTarget.type !== 'wordbook') return;
    const { id } = deleteTarget;
    
    try {
      // 1. Delete all words in the wordbook first
      const wordsQuery = query(collection(db, `wordbooks/${id}/words`));
      const wordsSnapshot = await getDocs(wordsQuery);
      const batch = writeBatch(db);
      wordsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // 2. Delete the wordbook document
      await deleteDoc(doc(db, 'wordbooks', id));
      setDeleteTarget(null);
      setSelectedWordbook(null);
    } catch (error) {
      console.error('Failed to delete wordbook:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateWord = async () => {
    if (!editingWord || !selectedWordbook || !editWordValue.trim() || !editMeaningValue.trim()) return;
    
    try {
      const updateData: any = {
        word: editWordValue.trim(),
        meaning: editMeaningValue.trim(),
        imageUrl: editImageUrlValue.trim(),
        updatedAt: Timestamp.now()
      };

      if (selectedWordbook.type === 'irregular' || selectedWordbook.type === 'modal-grammar') {
        updateData.past = editPastValue.trim();
        updateData.pastParticiple = editPastParticipleValue.trim();
        updateData.pattern = editPatternValue.trim();
        updateData.example = editExampleValue.trim();
        updateData.distractors = editDistractorsValue.split(',').map(s => s.trim()).filter(s => !!s);
      }

      await updateDoc(doc(db, `wordbooks/${selectedWordbook.id}/words`, editingWord.id), updateData);
      setEditingWord(null);
    } catch (error) {
      console.error('Failed to update word:', error);
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteWord = async () => {
    if (!deleteTarget || deleteTarget.type !== 'word' || !selectedWordbook) return;
    try {
      await deleteDoc(doc(db, `wordbooks/${selectedWordbook.id}/words`, deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete word:', error);
    }
  };

  const handleAddIndividualWord = async () => {
    if (!selectedWordbook || !newWord.trim() || !newMeaning.trim()) return;
    
    try {
      // Get current max order
      const maxOrder = words.length > 0 ? Math.max(...words.map(w => (w as any).order || 0)) : -1;
      
      await addDoc(collection(db, `wordbooks/${selectedWordbook.id}/words`), {
        word: newWord.trim(),
        meaning: newMeaning.trim(),
        imageUrl: newImageUrl.trim(),
        order: maxOrder + 1,
        createdAt: Timestamp.now()
      });
      setNewWord('');
      setNewMeaning('');
      setNewImageUrl('');
      setIsIndividualAddOpen(false);
    } catch (error) {
      console.error('Failed to add word:', error);
      alert('추가 중 오류가 발생했습니다.');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = wordbooks.findIndex((wb) => wb.id === active.id);
    const newIndex = wordbooks.findIndex((wb) => wb.id === over.id);

    const newWordbooks = arrayMove(wordbooks, oldIndex, newIndex);
    setWordbooks(newWordbooks);

    // Update Firestore
    try {
      const batch = writeBatch(db);
      newWordbooks.forEach((wb: Wordbook, index) => {
        const wbRef = doc(db, 'wordbooks', wb.id);
        batch.update(wbRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error('Failed to update wordbook order:', error);
    }
  };

  const handleUpdateWordbookTitle = async () => {
    if (!editingWordbook || !editWbTitleValue.trim()) return;
    try {
      const updateData: any = {
        title: editWbTitleValue.trim(),
        defaultUnitSize: editWbUnitSizeValue,
        updatedAt: Timestamp.now()
      };

      if (editingWordbook.type === 'irregular') {
        const distractors = editWbDistractorsValue
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== '');
        updateData.customDistractors = distractors;
      }

      await updateDoc(doc(db, 'wordbooks', editingWordbook.id), updateData);
      
      if (selectedWordbook?.id === editingWordbook.id) {
        setSelectedWordbook({ 
          ...selectedWordbook, 
          title: editWbTitleValue.trim(),
          defaultUnitSize: updateData.defaultUnitSize,
          customDistractors: updateData.customDistractors
        });
      }
      setEditingWordbook(null);
    } catch (error) {
      console.error('Failed to update wordbook:', error);
      alert('수정 중 오류가 발생했습니다.');
    }
  };

  const handleGenerateTestPaper = async () => {
    if (!selectedWordbook || words.length === 0) return;
    
    let selectedWords: Word[] = [];

    if (testPaperConfig.selectionMode === 'random') {
      // Shuffle and pick words
      const isVerbForm = selectedWordbook.type === 'verb-form-grammar';
      const shuffled = isVerbForm ? [...words] : [...words].sort(() => 0.5 - Math.random());
      selectedWords = shuffled.slice(0, Math.min(testPaperConfig.wordCount, words.length));
    } else {
      // Range selection by DAY
      const startIndex = (testPaperConfig.startDay - 1) * testPaperConfig.unitSize;
      const endIndex = testPaperConfig.endDay * testPaperConfig.unitSize;
      const rangeWords = words.slice(startIndex, endIndex);
      // Shuffle words within the range (except for verb-form-grammar)
      const isVerbForm = selectedWordbook.type === 'verb-form-grammar';
      selectedWords = isVerbForm ? [...rangeWords] : [...rangeWords].sort(() => 0.5 - Math.random());
    }

    if (selectedWords.length === 0) {
      alert('선택된 범위에 단어가 없습니다.');
      return;
    }
    
    if (testPaperConfig.quizType === 'memorization-table' && selectedWordbook.type === 'verb-form-grammar') {
      await generateVerbFormMemorizationTest(
        testPaperConfig.title || selectedWordbook.title,
        testPaperConfig.subtitle,
        VERB_FORM_TABLE_DATA,
        {
          includeAnswerKey: testPaperConfig.includeAnswerKey,
          studentName: testPaperConfig.studentName,
          shuffle: testPaperConfig.shuffleVerbs
        }
      );
      setIsTestPaperModalOpen(false);
      return;
    }

    if (testPaperConfig.quizType === 'multiple-choice') {
      try {
        let wordsForQuiz: any[] = selectedWords;

        // Special handling for relative-grammar: use examples instead of concepts
        if (selectedWordbook.type === 'relative-grammar') {
          const allExamples: any[] = [];
          
          // Determine which concepts to pull examples from
          let conceptsToFetch = selectedWords;
          if (testPaperConfig.selectionMode === 'random') {
            // For random mode, we can pull from all categories if they want many questions
            conceptsToFetch = words;
          }

          for (const concept of conceptsToFetch) {
            const examplesRef = collection(db, `wordbooks/${selectedWordbook.id}/words/${concept.id}/examples`);
            const snap = await getDocs(examplesRef);
            snap.docs.forEach(doc => {
              const data = doc.data();
              allExamples.push({
                word: data.sentence,
                meaning: data.explanation,
                distractors: data.choices, // Index 0 is correct
                id: doc.id
              });
            });
          }

          if (allExamples.length === 0) {
            alert('출제할 예문이 없습니다. 먼저 예문을 등록해주세요.');
            return;
          }

          // Pick the requested number of questions
          const targetCount = testPaperConfig.selectionMode === 'random' 
            ? testPaperConfig.wordCount 
            : (testPaperConfig.endDay - testPaperConfig.startDay + 1) * testPaperConfig.unitSize;

          const shuffledEx = allExamples.sort(() => 0.5 - Math.random());
          wordsForQuiz = shuffledEx.slice(0, Math.min(targetCount, allExamples.length));
        }

        if (selectedWordbook.type === 'modal-grammar') {
          const activeSets = Array.from(new Set(selectedWords.map(w => (w as any).set))).filter(s => s !== undefined);
          if (activeSets.length > 0) {
            const applicableQuestions = MODAL_QUIZ_POOL.filter(q => activeSets.includes(q.set));
            if (applicableQuestions.length > 0) {
              const shuffledPool = [...applicableQuestions].sort(() => 0.5 - Math.random());
              const targetCount = testPaperConfig.selectionMode === 'random' ? testPaperConfig.wordCount : selectedWords.length;
              const finalQuestions = shuffledPool.slice(0, Math.min(targetCount, shuffledPool.length));
              
              wordsForQuiz = finalQuestions.map(q => ({
                word: q.sentence,
                meaning: q.choices[q.answer],
                distractors: q.choices.filter((_, idx) => idx !== q.answer),
                question: q.question,
                explanation: q.explanation
              }));
            }
          }
        }

        if (selectedWordbook.type === 'verb-form-grammar') {
          const allExamples: any[] = [];
          
          for (const concept of selectedWords) {
            const examplesRef = collection(db, `wordbooks/${selectedWordbook.id}/words/${concept.id}/examples`);
            const snap = await getDocs(examplesRef);
            snap.docs.forEach(doc => {
              const data = doc.data();
              const choices = data.choices || [];
              allExamples.push({
                word: data.sentence,
                meaning: choices[0],
                distractors: choices.slice(1),
                explanation: data.explanation,
                id: doc.id
              });
            });
          }

          if (allExamples.length === 0) {
            alert('출제할 예문이 없습니다. 먼저 예문을 등록해주세요.');
            return;
          }

          const isVerbForm = selectedWordbook.type === 'verb-form-grammar';
          const processedEx = isVerbForm ? allExamples : allExamples.sort(() => 0.5 - Math.random());
          wordsForQuiz = processedEx.slice(0, Math.min(testPaperConfig.wordCount, allExamples.length));
        }

        await generateMultipleChoiceQuiz(
          testPaperConfig.title || selectedWordbook.title,
          testPaperConfig.subtitle,
          wordsForQuiz,
          {
            includeAnswerKey: testPaperConfig.includeAnswerKey,
            paperTitle: testPaperConfig.title || selectedWordbook.title,
            studentName: testPaperConfig.studentName,
            wordbookType: selectedWordbook.type
          }
        );
        setIsTestPaperModalOpen(false);
      } catch (error) {
        console.error('Failed to generate quiz:', error);
        alert('퀴즈 생성 중 오류가 발생했습니다.');
      }
      return;
    }

    if (testPaperConfig.quizType === 'irregular-writing') {
      try {
        await generateIrregularVerbTest(
          testPaperConfig.title || selectedWordbook.title,
          testPaperConfig.subtitle,
          selectedWords,
          {
            includeAnswerKey: testPaperConfig.includeAnswerKey,
            paperTitle: testPaperConfig.title || selectedWordbook.title,
            studentName: testPaperConfig.studentName
          }
        );
        setIsTestPaperModalOpen(false);
      } catch (error) {
        console.error('Failed to generate irregular test:', error);
        alert('시험지 생성 중 오류가 발생했습니다.');
      }
      return;
    }

    try {
      await generateWordTest(
        testPaperConfig.title || selectedWordbook.title,
        testPaperConfig.subtitle,
        selectedWords,
        {
          testType: testPaperConfig.testType,
          includeAnswerKey: testPaperConfig.includeAnswerKey,
          paperTitle: testPaperConfig.title || selectedWordbook.title,
          studentName: testPaperConfig.studentName
        }
      );
      setIsTestPaperModalOpen(false);
    } catch (error) {
      console.error('Failed to generate test paper:', error);
      alert('시험지 생성 중 오류가 발생했습니다.');
    }
  };

  const handlePrintWordbook = async () => {
    if (!selectedWordbook || words.length === 0) return;
    
    const startIndex = (printConfig.startDay - 1) * printConfig.unitSize;
    const endIndex = printConfig.endDay * printConfig.unitSize;
    const selectedWords = words.slice(startIndex, endIndex);

    if (selectedWords.length === 0) {
      alert('선택된 범위에 단어가 없습니다.');
      return;
    }

    try {
      await generateWordbookTable(
        `${selectedWordbook.title} (DAY ${printConfig.startDay}-${printConfig.endDay})`,
        selectedWords,
        {
          paperTitle: selectedWordbook.title,
          wordbookType: selectedWordbook.type,
          unitSize: printConfig.unitSize,
          startDay: printConfig.startDay
        }
      );
      setIsPrintModalOpen(false);
    } catch (error) {
      console.error('Failed to print wordbook:', error);
      alert('출력 중 오류가 발생했습니다.');
    }
  };

  const handleGenerateInstantTest = async () => {
    if (!instantTestText.trim()) return;

    let title = testPaperConfig.title || '즉석 단어 시험';
    const wordsToProcess: Word[] = [];

    let remainingText = instantTestText.trim();
    const titleMatch = remainingText.match(/^단어장 제목\s*:\s*(.*)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      remainingText = remainingText.replace(titleMatch[0], '').trim();
    }

    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentField = '';
    let inQuotes = false;
    
    for (let i = 0; i < remainingText.length; i++) {
      const char = remainingText[i];
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (inQuotes) {
        currentField += char;
      } else {
        if (char === '\t') {
          currentRecord.push(currentField.trim());
          currentField = '';
        } else if (char === '\n') {
          currentRecord.push(currentField.trim());
          if (currentRecord.some(f => f !== '')) records.push(currentRecord);
          currentRecord = [];
          currentField = '';
        } else if (char === ' ' && remainingText[i+1] === ' ') {
          currentRecord.push(currentField.trim());
          currentField = '';
          while (i + 1 < remainingText.length && remainingText[i+1] === ' ') i++;
        } else {
          currentField += char;
        }
      }
    }
    if (currentField || currentRecord.length > 0) {
      currentRecord.push(currentField.trim());
      if (currentRecord.some(f => f !== '')) records.push(currentRecord);
    }

    records.forEach((parts, idx) => {
      if (parts.length < 2 && parts[0]) {
        const firstSpaceIndex = parts[0].indexOf(' ');
        if (firstSpaceIndex !== -1) {
          const word = parts[0].substring(0, firstSpaceIndex).trim();
          const meaning = parts[0].substring(firstSpaceIndex + 1).trim();
          wordsToProcess.push({ id: `tmp-${idx}`, word, meaning });
        }
      } else if (parts.length >= 2) {
        wordsToProcess.push({
          id: `tmp-${idx}`,
          word: parts[0],
          meaning: parts[1],
          example: parts[2] || ''
        });
      }
    });

    if (wordsToProcess.length === 0) {
      alert('출제할 단어를 찾지 못했습니다. 단어 뜻 순서로 입력해주세요.');
      return;
    }

    const shuffledWords = shuffleArray(wordsToProcess);

    try {
      await generateWordTest(
        title,
        testPaperConfig.subtitle,
        shuffledWords,
        {
          testType: testPaperConfig.testType,
          includeAnswerKey: testPaperConfig.includeAnswerKey,
          paperTitle: title,
          studentName: testPaperConfig.studentName
        }
      );
      setIsInstantTestModalOpen(false);
      setInstantTestText('');
    } catch (error) {
      console.error('Failed to generate instant test:', error);
      alert('시험지 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {!selectedWordbook ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex-1 rounded-[2.5rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-pastel-pink-300 hover:text-pastel-pink-500 hover:bg-pastel-pink-50/30 transition-all group min-h-[12rem]"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-pastel-pink-100 transition-colors">
                  <Plus size={24} />
                </div>
                <span className="font-bold">새 단어장 만들기</span>
              </button>
              <button
                onClick={() => setIsBulkAddOpen(true)}
                className="py-4 bg-emerald-50 text-emerald-600 rounded-3xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"
              >
                <FileSpreadsheet size={18} />
                텍스트 일괄 등록으로 만들기
              </button>
              <button
                onClick={() => {
                  setTestPaperConfig({
                    ...testPaperConfig,
                    title: '',
                    subtitle: '1회독',
                    studentName: ''
                  });
                  setIsInstantTestModalOpen(true);
                }}
                className="py-4 bg-blue-50 text-blue-600 rounded-3xl font-bold text-sm hover:bg-blue-100 transition-all flex items-center justify-center gap-2 border border-blue-100"
              >
                <FileText size={18} />
                외부 단어로 즉석 시험지 만들기
              </button>
            </div>

            <SortableContext
              items={wordbooks.map(wb => wb.id)}
              strategy={rectSortingStrategy}
            >
              {wordbooks.map((wb: Wordbook) => (
                <SortableWordbookCard 
                  key={wb.id} 
                  wb={wb} 
                  onClick={() => setSelectedWordbook(wb)}
                  onDelete={() => setDeleteTarget({ id: wb.id, title: wb.title, type: 'wordbook' })}
                  onEdit={() => {
                    setEditingWordbook(wb);
                    setEditWbTitleValue(wb.title);
                    setEditWbUnitSizeValue(wb.defaultUnitSize || 10);
                    setEditWbDistractorsValue(wb.customDistractors?.join(', ') || '');
                  }}
                />
              ))}
            </SortableContext>
          </div>
        </DndContext>
      ) : (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="flex justify-between items-center">
            <button onClick={() => setSelectedWordbook(null)} className="text-sm font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1">
              ← 단어장 목록으로
            </button>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setTestPaperConfig({
                    ...testPaperConfig,
                    title: selectedWordbook.title,
                    unitSize: selectedWordbook.defaultUnitSize || 10
                  });
                  setIsTestPaperModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all"
              >
                <FileText size={16} />
                시험지 만들기
              </button>
              <button 
                onClick={() => {
                  if (selectedWordbook) {
                    setPrintConfig({
                      ...printConfig,
                      unitSize: selectedWordbook.defaultUnitSize || 40
                    });
                    setIsPrintModalOpen(true);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pastel-pink-600 rounded-xl font-bold text-sm hover:bg-pink-100 transition-all border border-pastel-pink-100"
              >
                <Download size={16} />
                단어장 출력하기
              </button>
              <button onClick={() => setIsBulkAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-all">
                <FileSpreadsheet size={16} />
                엑셀로 단어 추가
              </button>
              <button 
                onClick={() => setIsIndividualAddOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-pastel-pink-500 text-white rounded-xl font-bold text-sm hover:bg-pastel-pink-600 transition-all"
              >
                <Plus size={16} />
                단어 개별 추가
              </button>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <BookOpen className="text-pastel-pink-500" />
                {selectedWordbook.title}
                <button 
                  onClick={() => {
                    setEditingWordbook(selectedWordbook);
                    setEditWbTitleValue(selectedWordbook.title);
                    setEditWbUnitSizeValue(selectedWordbook.defaultUnitSize || 10);
                    setEditWbDistractorsValue(selectedWordbook.customDistractors?.join(', ') || '');
                  }}
                  className="p-2 text-slate-300 hover:text-pastel-pink-500 transition-colors"
                  title="단어장 이름 수정"
                >
                  <Edit3 size={18} />
                </button>
              </h2>
              <button
                onClick={() => setDeleteTarget({ id: selectedWordbook.id, title: selectedWordbook.title, type: 'wordbook' })}
                className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
              >
                <Trash2 size={16} />
                단어장 전체 삭제
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {words.map((word) => (
                <div key={word.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-black text-slate-900">{word.word}</div>
                      {selectedWordbook.type === 'irregular' && word.pattern && (
                        <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black rounded uppercase tracking-tighter">
                          {word.pattern}
                        </span>
                      )}
                      {selectedWordbook.type === 'relative-grammar' && word.word.includes('(___)') && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-black rounded uppercase tracking-tighter flex items-center gap-1">
                          ⚠️ MOVE TO EXAMPLES
                        </span>
                      )}
                    </div>
                    {selectedWordbook.type === 'irregular' ? (
                      <div className="space-y-0.5">
                        <div className="text-sm font-black text-blue-500">{word.past} - {word.pastParticiple}</div>
                        <div className="text-sm text-slate-500 font-medium whitespace-pre-wrap">{word.meaning}</div>
                      </div>
                    ) : selectedWordbook.type === 'modal-grammar' ? (
                      <div className="space-y-0.5">
                        <div className="text-sm font-black text-pastel-pink-500">{word.meaning}</div>
                        {word.example && <div className="text-xs text-slate-400 font-medium italic">Ex: {word.example}</div>}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 font-medium whitespace-pre-wrap">
                        {selectedWordbook.type === 'relative-grammar' && word.word.includes('(___)') ? (
                          <span className="text-orange-500 font-bold">이 항목은 문장 형태입니다. 삭제 후 특정 개념의 [예문 관리] 버튼을 통해 등록해주세요.</span>
                        ) : word.meaning}
                      </div>
                    )}
                    {word.imageUrl && (
                      <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                        <img src={word.imageUrl} alt={word.word} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(selectedWordbook.type === 'relative-grammar' || selectedWordbook.type === 'verb-form-grammar') && (
                      <button 
                        onClick={() => {
                          setCurrentWordForExamples(word);
                          setIsExampleModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-all flex items-center gap-1.5"
                      >
                        <FileText size={14} />
                        예문 관리
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        setEditingWord(word);
                        setEditWordValue(word.word);
                        setEditMeaningValue(word.meaning);
                        setEditPastValue(word.past || '');
                        setEditPastParticipleValue(word.pastParticiple || '');
                        setEditPatternValue(word.pattern || '');
                        setEditImageUrlValue(word.imageUrl || '');
                        setEditDistractorsValue(word.distractors?.join(', ') || '');
                        setEditExampleValue((word as any).example || '');
                      }}
                      className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button 
                      onClick={() => setDeleteTarget({ id: word.id, title: word.word, type: 'word' })}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {words.length === 0 && (
                <div className="col-span-2 py-20 text-center text-slate-400 font-medium">
                  등록된 단어가 없습니다.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Create Wordbook Modal */}
      {isExampleModalOpen && currentWordForExamples && selectedWordbook && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl w-full bg-white rounded-[3rem] p-10 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">[{currentWordForExamples.word}] 랜덤 예문 풀</h2>
                <p className="text-sm font-bold text-slate-400 mt-1">퀴즈 시 이 중 하나의 문장이 랜덤으로 추출됩니다.</p>
              </div>
              <button 
                onClick={() => {
                  setIsExampleModalOpen(false);
                  setIsAddingExample(false);
                }} 
                className="p-2 text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-[10rem]">
              {isAddingExample ? (
                <div className="bg-indigo-50/50 p-6 rounded-3xl border-2 border-indigo-100 space-y-4">
                  <h4 className="font-black text-indigo-600">새 예문 추가</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1">문제 문장 (빈칸은 (___)로 표시)</label>
                      <textarea 
                        value={newExSentence}
                        onChange={(e) => setNewExSentence(e.target.value)}
                        placeholder="예: This is the news (___) surprised everyone."
                        className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-200"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1">문제 유형</label>
                        <select 
                          value={newExType}
                          onChange={(e) => setNewExType(e.target.value as 'A' | 'B')}
                          className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none"
                        >
                          <option value="A">유형 A (빈칸 채우기)</option>
                          <option value="B">유형 B (쓰임 구별)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1">정답 및 오답 (쉼표 구분, 첫번째가 정답)</label>
                        <input 
                          type="text"
                          value={newExChoices}
                          onChange={(e) => setNewExChoices(e.target.value)}
                          placeholder="that, which, what, where"
                          className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-1 ml-1">해설 (정답 이유)</label>
                      <textarea 
                        value={newExExplanation}
                        onChange={(e) => setNewExExplanation(e.target.value)}
                        placeholder="이 문장에서 that은 동격으로 쓰였습니다..."
                        className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-200"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsAddingExample(false)} className="flex-1 py-3 bg-white text-slate-500 rounded-xl font-bold text-sm border-2 border-slate-100">취소</button>
                    <button onClick={handleAddExample} className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-100">저장하기</button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAddingExample(true)}
                  className="w-full py-4 border-2 border-dashed border-indigo-200 text-indigo-400 rounded-2xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> 예문 추가하기
                </button>
              )}

              {examples.map((ex) => (
                <div key={ex.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                  <div className="flex justify-between items-start pe-10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${ex.type === 'A' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                          유형 {ex.type}
                        </span>
                        <span className="text-xs font-black text-indigo-500">{ex.choices?.[0]} (정답)</span>
                      </div>
                      <div className="font-bold text-slate-800 mb-2 leading-snug">{ex.sentence}</div>
                      <div className="text-xs text-slate-400 font-medium leading-relaxed bg-white/50 p-2 rounded-lg">{ex.explanation}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteExample(ex.id)}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {examples.length === 0 && !isAddingExample && (
                <div className="py-12 text-center text-slate-300 font-bold text-sm">
                  등록된 예문이 없습니다.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Create Wordbook Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">새 단어장 만들기</h2>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="단어장 제목 (예: 고1 필수 어휘)"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none mb-6 font-bold"
            />
            <div className="flex gap-3">
              <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">취소</button>
              <button onClick={handleCreateWordbook} className="flex-1 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pastel-pink-200">만들기</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Wordbook Modal */}
      {editingWordbook && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">단어장 설정 수정</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">단어장 제목</label>
                <input
                  type="text"
                  value={editWbTitleValue}
                  onChange={(e) => setEditWbTitleValue(e.target.value)}
                  placeholder="단어장 제목"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">학습 기본 단위 (DAY당 단어 수)</label>
                <input
                  type="number"
                  value={editWbUnitSizeValue}
                  onChange={(e) => setEditWbUnitSizeValue(parseInt(e.target.value) || 1)}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-2 ml-1 leading-relaxed">
                  * 시험지 생성 및 학생 학습 시 이 값이 기본 DAY 단위로 사용됩니다.
                </p>
              </div>
              {editingWordbook.type === 'irregular' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">
                    매력적인 오답용 단어 (쉼표로 구분)
                  </label>
                  <textarea
                    value={editWbDistractorsValue}
                    onChange={(e) => setEditWbDistractorsValue(e.target.value)}
                    placeholder="예: seed, seeden, seedded, seedt"
                    rows={3}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold resize-none text-sm"
                  />
                  <p className="text-[10px] text-slate-400 mt-2 ml-1 leading-relaxed">
                    * 여기에 입력한 단어들이 3단 변화 챌린지와 객관식 퀴즈에서 오답 선지로 우선적으로 등장합니다. 
                    비슷하게 생겼거나 학생들이 자주 헷갈려하는 가짜 변화형을 입력해 보세요.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingWordbook(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">취소</button>
              <button onClick={handleUpdateWordbookTitle} className="flex-1 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pastel-pink-200">수정하기</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Word Modal */}
      {editingWord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">단어 수정</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">단어</label>
                <input
                  type="text"
                  value={editWordValue}
                  onChange={(e) => setEditWordValue(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">뜻</label>
                <textarea
                  value={editMeaningValue}
                  onChange={(e) => setEditMeaningValue(e.target.value)}
                  rows={2}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold resize-none"
                />
              </div>
              {selectedWordbook?.type === 'modal-grammar' && (
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">문법 패턴 (예: 능력, 허가)</label>
                    <input
                      type="text"
                      value={editPatternValue}
                      onChange={(e) => setEditPatternValue(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">예문</label>
                    <textarea
                      value={editExampleValue}
                      onChange={(e) => setEditExampleValue(e.target.value)}
                      rows={2}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold resize-none"
                    />
                  </div>
                </div>
              )}
              {selectedWordbook?.type === 'irregular' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">과거형</label>
                    <input
                      type="text"
                      value={editPastValue}
                      onChange={(e) => setEditPastValue(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">과거분사형</label>
                    <input
                      type="text"
                      value={editPastParticipleValue}
                      onChange={(e) => setEditPastParticipleValue(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">변화 패턴 (예: A-B-C)</label>
                    <input
                      type="text"
                      value={editPatternValue}
                      onChange={(e) => setEditPatternValue(e.target.value)}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">단어별 매력적인 오답 (쉼표 구분)</label>
                    <input
                      type="text"
                      value={editDistractorsValue}
                      onChange={(e) => setEditDistractorsValue(e.target.value)}
                      placeholder="예: seed, seeden, seedded"
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 ml-1">* 이 단어에 대해서만 특별히 헷갈리게 만들고 싶은 오답들을 적어주세요.</p>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">이미지 URL (선택)</label>
                <input
                  type="text"
                  value={editImageUrlValue}
                  onChange={(e) => setEditImageUrlValue(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingWord(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">취소</button>
              <button onClick={handleUpdateWord} className="flex-1 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pastel-pink-200">저장하기</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Individual Add Word Modal */}
      {isIndividualAddOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6">단어 추가</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">단어</label>
                <input
                  type="text"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  placeholder="예: apple"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">뜻</label>
                <textarea
                  value={newMeaning}
                  onChange={(e) => setNewMeaning(e.target.value)}
                  placeholder="예: 사과"
                  rows={3}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">이미지 URL (선택)</label>
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsIndividualAddOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">취소</button>
              <button onClick={handleAddIndividualWord} className="flex-1 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pastel-pink-200">추가하기</button>
            </div>
          </motion.div>
        </div>
      )}
      {isBulkAddOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl w-full bg-white rounded-[3rem] p-10 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-black text-slate-900">단어 엑셀 일괄 등록</h2>
              <button onClick={() => setIsBulkAddOpen(false)}><X size={24} className="text-slate-400" /></button>
            </div>
            <div className="mb-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-xs font-bold text-blue-600 leading-relaxed">
              형식: 단어 [탭] 뜻<br/>
              또는: 단어 [공백2개이상] 뜻<br/>
              팁: 뜻을 큰따옴표(")로 감싸면 줄바꿈이 포함된 여러 줄의 뜻을 입력할 수 있습니다.
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="apple	사과	I like apples."
              className="w-full h-64 p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none resize-none font-mono text-sm mb-6"
            />
            <div className="flex gap-3">
              <button onClick={() => setIsBulkAddOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">취소</button>
              <button onClick={handleBulkAddWords} className="flex-1 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pastel-pink-200">등록하기</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Instant Test Paper Modal */}
      {isInstantTestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center p-8 pb-4 border-b border-slate-50">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <FileText className="text-blue-500" />
                외부 단어로 즉석 시험지 만들기
              </h2>
              <button onClick={() => setIsInstantTestModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-4 no-scrollbar">
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider ml-1">단어 입력 (단어 뜻 순서)</label>
                    <span className="text-[10px] text-slate-400 font-medium italic">탭(Tab)이나 엔터(Enter), 또는 공백 2개로 구분</span>
                  </div>
                  <textarea
                    value={instantTestText}
                    onChange={(e) => setInstantTestText(e.target.value)}
                    placeholder="apple 사과&#10;banana 바나나&#10;cherry 체리"
                    className="w-full h-48 px-6 py-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-blue-100 focus:border-blue-200 outline-none font-medium text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">학생 이름</label>
                    <input
                      type="text"
                      value={testPaperConfig.studentName}
                      onChange={(e) => setTestPaperConfig({ ...testPaperConfig, studentName: e.target.value })}
                      placeholder="이름 입력"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">시험지 제목</label>
                    <input
                      type="text"
                      value={testPaperConfig.title}
                      onChange={(e) => setTestPaperConfig({ ...testPaperConfig, title: e.target.value })}
                      placeholder="예: 단어 퀴즈"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">소제목 (회독 등)</label>
                    <input
                      type="text"
                      value={testPaperConfig.subtitle}
                      onChange={(e) => setTestPaperConfig({ ...testPaperConfig, subtitle: e.target.value })}
                      placeholder="예: 1회독"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">시험 유형</label>
                    <select
                      value={testPaperConfig.testType}
                      onChange={(e) => setTestPaperConfig({ ...testPaperConfig, testType: e.target.value as any })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                    >
                      <option value="en-to-ko">영어 → 뜻</option>
                      <option value="ko-to-en">뜻 → 영어</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px] mt-auto">
                    <button 
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, includeAnswerKey: !testPaperConfig.includeAnswerKey })}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.includeAnswerKey ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                    >
                      {testPaperConfig.includeAnswerKey && <CheckCircle2 size={14} />}
                    </button>
                    <span className="font-bold text-slate-700 text-xs">정답지 포함하기</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 pt-0 flex gap-3 mt-4">
              <button 
                onClick={() => setIsInstantTestModalOpen(false)} 
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm"
              >
                취소
              </button>
              <button 
                onClick={handleGenerateInstantTest}
                disabled={!instantTestText.trim()}
                className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50 text-sm transition-all hover:bg-blue-600"
              >
                <Download size={18} />
                즉석 시험지 다운로드
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-2xl text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
              <Trash2 size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">삭제하시겠습니까?</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">
              {deleteTarget.type === 'wordbook' 
                ? `"${deleteTarget.title}" 단어장과 포함된 모든 단어가 영구적으로 삭제됩니다.`
                : `"${deleteTarget.title}" 단어를 삭제하시겠습니까?`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">아니오</button>
              <button 
                onClick={deleteTarget.type === 'wordbook' ? handleDeleteWordbook : handleDeleteWord} 
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-200"
              >
                네, 삭제합니다
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Test Paper Generation Modal */}
      {isTestPaperModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="max-w-lg w-full bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="flex justify-between items-center p-8 pb-4 border-b border-slate-50">
              <h2 className="text-xl font-black text-slate-900">
                {category === 'grammar' ? '문법 시험지/퀴즈 만들기' : '단어 시험지 만들기'}
              </h2>
              <button onClick={() => setIsTestPaperModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pt-4 no-scrollbar">
              <div className="space-y-4 mb-6">
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'standard' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      기본 시험지 (직접 쓰기)
                    </button>
                    <button
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'multiple-choice' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'multiple-choice' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      객관식 퀴즈
                    </button>
                    {selectedWordbook?.type === 'irregular' && (
                      <button
                        onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'irregular-writing' })}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'irregular-writing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        3단 변화 쓰기
                      </button>
                    )}
                    {selectedWordbook?.type === 'verb-form-grammar' && (
                      <button
                        onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'memorization-table' })}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'memorization-table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                      >
                        암기용 (표)
                      </button>
                    )}
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, selectionMode: 'range' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${testPaperConfig.selectionMode === 'range' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      범위 지정 (DAY 단위)
                    </button>
                    <button
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, selectionMode: 'random' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${testPaperConfig.selectionMode === 'random' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      랜덤 추출
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">학생 이름</label>
                    <input
                      type="text"
                      value={testPaperConfig.studentName}
                      onChange={(e) => setTestPaperConfig({ ...testPaperConfig, studentName: e.target.value })}
                      placeholder="이름 입력"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">시험지 제목 (왼쪽 상단)</label>
                    <input
                      type="text"
                      value={testPaperConfig.title}
                      onChange={(e) => setTestPaperConfig({ ...testPaperConfig, title: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">회차/부제 (중앙 상단)</label>
                  <input
                    type="text"
                    value={testPaperConfig.subtitle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTestPaperConfig({ ...testPaperConfig, subtitle: val });
                    }}
                    placeholder="예: 1회독, DAY 01-02"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                  />
                </div>

                {testPaperConfig.selectionMode === 'range' ? (
                  <div className="space-y-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-blue-400 mb-1 ml-1">학습 단위 (DAY당 단어)</label>
                        <input
                          type="number"
                          value={testPaperConfig.unitSize}
                          onChange={(e) => setTestPaperConfig({ ...testPaperConfig, unitSize: parseInt(e.target.value) || 1 })}
                          className="w-full p-2.5 bg-white border border-blue-100 rounded-lg focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-blue-400 mb-1 ml-1">총 DAY 수</label>
                        <div className="p-2.5 bg-white border border-blue-100 rounded-lg font-bold text-blue-600 text-sm">
                          약 {Math.ceil(words.length / testPaperConfig.unitSize)} DAYS
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-blue-400 mb-1 ml-1">시작 DAY</label>
                        <input
                          type="number"
                          min={1}
                          value={testPaperConfig.startDay}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setTestPaperConfig({ 
                              ...testPaperConfig, 
                              startDay: val,
                              subtitle: `DAY ${val.toString().padStart(2, '0')}-${testPaperConfig.endDay.toString().padStart(2, '0')}`
                            });
                          }}
                          className="w-full p-2.5 bg-white border border-blue-100 rounded-lg focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-blue-400 mb-1 ml-1">종료 DAY</label>
                        <input
                          type="number"
                          min={testPaperConfig.startDay}
                          value={testPaperConfig.endDay}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setTestPaperConfig({ 
                              ...testPaperConfig, 
                              endDay: val,
                              subtitle: `DAY ${testPaperConfig.startDay.toString().padStart(2, '0')}-${val.toString().padStart(2, '0')}`
                            });
                          }}
                          className="w-full p-2.5 bg-white border border-blue-100 rounded-lg focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                        />
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-blue-400 text-center">
                      선택 범위: {((testPaperConfig.startDay - 1) * testPaperConfig.unitSize) + 1}번 ~ {Math.min(testPaperConfig.endDay * testPaperConfig.unitSize, words.length)}번 단어
                    </div>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const isGrammarType = selectedWordbook?.type && ['relative-grammar', 'conversion-grammar', 'to-ing-grammar', 'complement-grammar'].includes(selectedWordbook.type);
                      return (
                        <>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">
                            단어 개수 (최대 {isGrammarType ? 100 : words.length})
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {[10, 20, 40, 80, 100].map(count => (
                              <button
                                key={count}
                                onClick={() => setTestPaperConfig({ ...testPaperConfig, wordCount: isGrammarType ? count : Math.min(count, words.length) })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${testPaperConfig.wordCount === count ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                              >
                                {count}개
                              </button>
                            ))}
                          </div>
                          <input
                            type="number"
                            min={1}
                            max={isGrammarType ? 200 : words.length}
                            value={testPaperConfig.wordCount}
                            onChange={(e) => setTestPaperConfig({ ...testPaperConfig, wordCount: parseInt(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                          />
                        </>
                      );
                    })()}
                  </div>
                )}

                {testPaperConfig.quizType === 'standard' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 ml-1">시험 유형</label>
                      <select
                        value={testPaperConfig.testType}
                        onChange={(e) => setTestPaperConfig({ ...testPaperConfig, testType: e.target.value as any })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                      >
                        <option value="en-to-ko">영어 → 뜻</option>
                        <option value="ko-to-en">뜻 → 영어</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px] mt-auto">
                      <button 
                        onClick={() => setTestPaperConfig({ ...testPaperConfig, includeAnswerKey: !testPaperConfig.includeAnswerKey })}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.includeAnswerKey ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                      >
                        {testPaperConfig.includeAnswerKey && <CheckCircle2 size={14} />}
                      </button>
                      <span className="font-bold text-slate-700 text-xs">정답지 포함하기</span>
                    </div>
                  </div>
                )}

                {testPaperConfig.quizType === 'multiple-choice' && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px]">
                    <button 
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, includeAnswerKey: !testPaperConfig.includeAnswerKey })}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.includeAnswerKey ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                    >
                      {testPaperConfig.includeAnswerKey && <CheckCircle2 size={14} />}
                    </button>
                    <span className="font-bold text-slate-700 text-xs">정답지 포함하기</span>
                  </div>
                )}

                {testPaperConfig.quizType === 'irregular-writing' && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px]">
                    <button 
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, includeAnswerKey: !testPaperConfig.includeAnswerKey })}
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.includeAnswerKey ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                    >
                      {testPaperConfig.includeAnswerKey && <CheckCircle2 size={14} />}
                    </button>
                    <span className="font-bold text-slate-700 text-xs">정답지 포함하기</span>
                  </div>
                )}

                {testPaperConfig.quizType === 'memorization-table' && (
                  <div className="flex gap-4">
                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px]">
                      <button 
                        onClick={() => setTestPaperConfig({ ...testPaperConfig, includeAnswerKey: !testPaperConfig.includeAnswerKey })}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.includeAnswerKey ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                      >
                        {testPaperConfig.includeAnswerKey && <CheckCircle2 size={14} />}
                      </button>
                      <span className="font-bold text-slate-700 text-xs text-nowrap">정답지 포함하기</span>
                    </div>

                    <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px]">
                      <button 
                        onClick={() => setTestPaperConfig({ ...testPaperConfig, shuffleVerbs: !testPaperConfig.shuffleVerbs })}
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.shuffleVerbs ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                      >
                        {testPaperConfig.shuffleVerbs && <CheckCircle2 size={14} />}
                      </button>
                      <span className="font-bold text-slate-700 text-xs text-nowrap">단어 순서 랜덤</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 pt-0 flex gap-3">
              <button onClick={() => setIsTestPaperModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm">취소</button>
              <button 
                onClick={handleGenerateTestPaper} 
                disabled={testPaperConfig.quizType === 'memorization-table' ? false : (testPaperConfig.selectionMode === 'range' ? (testPaperConfig.startDay > testPaperConfig.endDay) : (testPaperConfig.wordCount <= 0))}
                className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                <Download size={18} />
                {testPaperConfig.quizType === 'multiple-choice' ? '퀴즈 다운로드' : 
                 testPaperConfig.quizType === 'irregular-writing' ? '3단 변화 시험지 다운로드' : '시험지 다운로드'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Print Wordbook Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-slate-900">단어장 출력 설정</h2>
              <button onClick={() => setIsPrintModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-6 mb-8">
              <div className="p-4 bg-pastel-pink-50 rounded-2xl border border-pastel-pink-100">
                <p className="text-xs font-bold text-pastel-pink-600 mb-3 ml-1">출력할 범위를 DAY 단위로 지정해주세요.</p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-black text-pastel-pink-400 uppercase mb-1 ml-1">학습 단위 (DAY당 단어)</label>
                    <input
                      type="number"
                      value={printConfig.unitSize}
                      onChange={(e) => setPrintConfig({ ...printConfig, unitSize: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 bg-white border border-pastel-pink-100 rounded-xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-pastel-pink-400 uppercase mb-1 ml-1">총 DAY 수</label>
                    <div className="px-4 py-3 bg-white border border-pastel-pink-100 rounded-xl font-bold text-pastel-pink-600 text-sm">
                      약 {Math.ceil(words.length / printConfig.unitSize)} DAYS
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-pastel-pink-400 uppercase mb-1 ml-1">시작 DAY</label>
                    <input
                      type="number"
                      min={1}
                      value={printConfig.startDay}
                      onChange={(e) => setPrintConfig({ ...printConfig, startDay: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 bg-white border border-pastel-pink-100 rounded-xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-pastel-pink-400 uppercase mb-1 ml-1">종료 DAY</label>
                    <input
                      type="number"
                      min={printConfig.startDay}
                      value={printConfig.endDay}
                      onChange={(e) => setPrintConfig({ ...printConfig, endDay: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 bg-white border border-pastel-pink-100 rounded-xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="mt-4 text-[11px] font-bold text-pastel-pink-400 text-center bg-white/50 py-2 rounded-lg">
                  선택 범위: {((printConfig.startDay - 1) * printConfig.unitSize) + 1}번 ~ {Math.min(printConfig.endDay * printConfig.unitSize, words.length)}번 단어
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsPrintModalOpen(false)} 
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm transition-all hover:bg-slate-200"
              >
                취소
              </button>
              <button 
                onClick={handlePrintWordbook}
                disabled={printConfig.startDay > printConfig.endDay}
                className="flex-1 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold shadow-lg shadow-pastel-pink-200 flex items-center justify-center gap-2 disabled:opacity-50 text-sm transition-all hover:bg-pastel-pink-600"
              >
                <Download size={18} />
                워드 다운로드
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SortableWordbookCard({ wb, onClick, onDelete, onEdit }: { wb: Wordbook; onClick: () => void; onDelete: () => void; onEdit: () => void; key?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: wb.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      className="h-48 p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-pastel-pink-200/20 transition-all text-left flex flex-col group cursor-pointer active:scale-[0.98] relative"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          <div 
            {...attributes} 
            {...listeners}
            className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={20} />
          </div>
          <div className="w-10 h-10 bg-pastel-pink-100 rounded-xl flex items-center justify-center text-pastel-pink-600">
            <BookOpen size={20} />
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title="단어장 이름 수정"
          >
            <Edit3 size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            title="단어장 삭제"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xl font-black text-slate-900 group-hover:text-pastel-pink-600 transition-colors">{wb.title}</h3>
        {wb.type === 'irregular' && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-tighter">
            Irregular
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 font-medium mt-auto">생성일: {wb.createdAt?.toDate().toLocaleDateString()}</p>
    </motion.div>
  );
}
