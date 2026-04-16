import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Search, Trash2, Edit3, FileSpreadsheet, X, CheckCircle2, Circle, GripVertical } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch, getDocs, orderBy } from 'firebase/firestore';
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
}

interface Word {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  imageUrl?: string;
}

export default function WordbookManager() {
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
  const [editImageUrlValue, setEditImageUrlValue] = useState('');

  // Edit wordbook states
  const [editingWordbook, setEditingWordbook] = useState<Wordbook | null>(null);
  const [editWbTitleValue, setEditWbTitleValue] = useState('');

  // Individual add states
  const [isIndividualAddOpen, setIsIndividualAddOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  // Delete confirmation states
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; type: 'wordbook' | 'word' } | null>(null);

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
      where('createdBy', '==', auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWordbooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wordbook));
      // Sort in-memory to support existing data without 'order' field and avoid index requirements
      fetchedWordbooks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setWordbooks(fetchedWordbooks);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedWordbook) {
      setWords([]);
      return;
    }
    const q = query(collection(db, `wordbooks/${selectedWordbook.id}/words`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word)));
    });
    return () => unsubscribe();
  }, [selectedWordbook]);

  const handleCreateWordbook = async () => {
    if (!newTitle.trim() || !auth.currentUser) return;
    try {
      const maxOrder = wordbooks.length > 0 ? Math.max(...wordbooks.map(wb => wb.order ?? 0)) : -1;
      await addDoc(collection(db, 'wordbooks'), {
        title: newTitle,
        createdBy: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        order: maxOrder + 1
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
          order: maxOrder + 1
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
      await updateDoc(doc(db, `wordbooks/${selectedWordbook.id}/words`, editingWord.id), {
        word: editWordValue.trim(),
        meaning: editMeaningValue.trim(),
        imageUrl: editImageUrlValue.trim(),
        updatedAt: Timestamp.now()
      });
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
      await updateDoc(doc(db, 'wordbooks', editingWordbook.id), {
        title: editWbTitleValue.trim(),
        updatedAt: Timestamp.now()
      });
      if (selectedWordbook?.id === editingWordbook.id) {
        setSelectedWordbook({ ...selectedWordbook, title: editWbTitleValue.trim() });
      }
      setEditingWordbook(null);
    } catch (error) {
      console.error('Failed to update wordbook title:', error);
      alert('수정 중 오류가 발생했습니다.');
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
                    <div className="text-lg font-black text-slate-900">{word.word}</div>
                    <div className="text-sm text-slate-500 font-medium whitespace-pre-wrap">{word.meaning}</div>
                    {word.imageUrl && (
                      <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                        <img src={word.imageUrl} alt={word.word} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => {
                        setEditingWord(word);
                        setEditWordValue(word.word);
                        setEditMeaningValue(word.meaning);
                        setEditImageUrlValue(word.imageUrl || '');
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
            <h2 className="text-2xl font-black text-slate-900 mb-6">단어장 이름 수정</h2>
            <input
              type="text"
              value={editWbTitleValue}
              onChange={(e) => setEditWbTitleValue(e.target.value)}
              placeholder="단어장 제목"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none mb-6 font-bold"
            />
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
                  rows={3}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold resize-none"
                />
              </div>
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
      <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-pastel-pink-600 transition-colors">{wb.title}</h3>
      <p className="text-xs text-slate-400 font-medium mt-auto">생성일: {wb.createdAt?.toDate().toLocaleDateString()}</p>
    </motion.div>
  );
}
