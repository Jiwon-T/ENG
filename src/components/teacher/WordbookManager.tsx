import OptionalMark from './OptionalMark';
import { WordbookCache } from '../../lib/wordbookCache';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Search, Trash2, Edit3, FileSpreadsheet, X, CheckCircle2, Circle, GripVertical, FileText, Download, Layers, ArrowUp, ArrowDown, Calendar, CheckSquare, Square, Sliders, Check } from 'lucide-react';
import { saveAs } from 'file-saver';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, writeBatch, getDocs, orderBy } from 'firebase/firestore';
import { generateWordTest, generateMultipleChoiceQuiz, generateIrregularVerbTest, generateWordbookTable, generateVerbFormMemorizationTest, generateComparativeTest } from '../../lib/wordTestGenerator';
import { MODAL_QUIZ_POOL, BASIC_MODAL_QUIZ_POOL } from '../../lib/modalQuizPool';
import { VERB_FORM_QUIZ_POOL } from '../../lib/verbFormQuizPool';
import { VERB_FORM_TABLE_DATA } from '../../lib/verbFormTableData';
import { GRAMMAR_CRAMMING_POOL } from '../../lib/grammarCrammingPool';
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
  type?: 'standard' | 'irregular' | 'to-ing-grammar' | 'complement-grammar' | 'conversion-grammar' | 'relative-grammar' | 'modal-grammar' | 'basic-modal-grammar' | 'verb-form-grammar' | 'grammar-cramming' | 'comparative-grammar' | 'sentence-order';
  category?: 'word' | 'grammar' | 'exam';
  customDistractors?: string[];
  defaultUnitSize?: number;
}

interface Word {
  id: string;
  word: string;
  meaning: string;
  day?: number;
  past?: string;
  pastParticiple?: string;
  comparative?: string;
  superlative?: string;
  pattern?: string;
  distractors?: string[];
  example?: string;
  imageUrl?: string;
  order?: number;
  passageTitle?: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export default function WordbookManager({ category = 'word' }: { category?: 'word' | 'grammar' | 'exam' }) {
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

  // Grammar Cramming states
  const [editQuizSentence, setEditQuizSentence] = useState('');
  const [editQuizQuestion, setEditQuizQuestion] = useState('');
  const [editQuizChoices, setEditQuizChoices] = useState('');
  const [editQuizAnswerIndex, setEditQuizAnswerIndex] = useState(0);
  const [editQuizExplanation, setEditQuizExplanation] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSet, setEditSet] = useState(1);

  // Edit wordbook states
  const [editingWordbook, setEditingWordbook] = useState<Wordbook | null>(null);
  const [editWbTitleValue, setEditWbTitleValue] = useState('');
  const [editWbDistractorsValue, setEditWbDistractorsValue] = useState('');
  const [editWbUnitSizeValue, setEditWbUnitSizeValue] = useState(10);
  const [editWbCategoryValue, setEditWbCategoryValue] = useState<'word' | 'grammar' | 'exam'>(category);
  const [editWbTypeValue, setEditWbTypeValue] = useState<'standard' | 'sentence-order'>('standard');

  // Category navigation & creation states
  const [newWbCategory, setNewWbCategory] = useState<'word' | 'grammar' | 'exam'>(category);
  const [newWbType, setNewWbType] = useState<'standard' | 'sentence-order'>('standard');
  const [mergeTargetCategory, setMergeTargetCategory] = useState<'word' | 'grammar' | 'exam'>(category);
  const [moveToastMessage, setMoveToastMessage] = useState<string | null>(null);
  const [allWordbooks, setAllWordbooks] = useState<Wordbook[]>([]);

  // Sentence-order passage modal states
  const [isPassageModalOpen, setIsPassageModalOpen] = useState(false);
  const [passageInputText, setPassageInputText] = useState('');
  const [passageTargetDay, setPassageTargetDay] = useState(1);
  const [passageTitleInput, setPassageTitleInput] = useState('');

  // Individual add states
  const [isIndividualAddOpen, setIsIndividualAddOpen] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newPast, setNewPast] = useState('');
  const [newPastParticiple, setNewPastParticiple] = useState('');

  // Grammar Cramming new word states
  const [newQuizSentence, setNewQuizSentence] = useState('');
  const [newQuizQuestion, setNewQuizQuestion] = useState('');
  const [newQuizChoices, setNewQuizChoices] = useState('');
  const [newQuizAnswerIndex, setNewQuizAnswerIndex] = useState(0);
  const [newQuizExplanation, setNewQuizExplanation] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newSet, setNewSet] = useState(1);

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
  const [isTestPaperModalOpen, setIsTestPape…32947 tokens truncated…r-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold resize-none text-sm leading-relaxed"
                  />
                ) : (
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="예: apple"
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">
                  {selectedWordbook?.type === 'sentence-order' ? '한국어 해석' : '뜻'}
                </label>
                <textarea
                  value={newMeaning}
                  onChange={(e) => setNewMeaning(e.target.value)}
                  placeholder={selectedWordbook?.type === 'sentence-order' ? "예: 성공의 비결은 목표를 향한 불변이다." : "예: 사과"}
                  rows={3}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">
                  {selectedWordbook?.type === 'sentence-order' ? '소속 지문 번호' : '소속 DAY'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={newWordDay}
                    onChange={(e) => setNewWordDay(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                  />
                  <span className="text-sm font-bold text-indigo-600 whitespace-nowrap px-3 py-2 bg-indigo-50 rounded-xl">
                    {selectedWordbook?.type === 'sentence-order' ? `지문 ${newWordDay}` : `DAY ${newWordDay}`}
                  </span>
                </div>
              </div>
              {(selectedWordbook?.type === 'irregular' || selectedWordbook?.type === 'comparative-grammar') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">
                      {selectedWordbook?.type === 'comparative-grammar' ? '비교급 (-er / more)' : '과거형'}
                    </label>
                    <input
                      type="text"
                      value={newPast}
                      onChange={(e) => setNewPast(e.target.value)}
                      placeholder={selectedWordbook?.type === 'comparative-grammar' ? '예: faster' : '예: went'}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">
                      {selectedWordbook?.type === 'comparative-grammar' ? '최상급 (-est / most)' : '과거분사형'}
                    </label>
                    <input
                      type="text"
                      value={newPastParticiple}
                      onChange={(e) => setNewPastParticiple(e.target.value)}
                      placeholder={selectedWordbook?.type === 'comparative-grammar' ? '예: fastest' : '예: gone'}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none font-bold"
                    />
                  </div>
                </div>
              )}
              {selectedWordbook?.type === 'grammar-cramming' && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="font-black text-indigo-500 text-sm">벼락치기 문제 상세</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">카테고리</label>
                      <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">세트 (일차)</label>
                      <input type="number" value={newSet} onChange={(e) => setNewSet(parseInt(e.target.value) || 1)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">문제 문장 (빈칸 (___) 포함)</label>
                    <textarea value={newQuizSentence} onChange={(e) => setNewQuizSentence(e.target.value)} rows={2} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-sm resize-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">질문 텍스트</label>
                    <input type="text" value={newQuizQuestion} onChange={(e) => setNewQuizQuestion(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">객관식 선택지 (쉼표 구분)</label>
                    <input type="text" value={newQuizChoices} onChange={(e) => setNewQuizChoices(e.target.value)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">정답 인덱스 (0부터)</label>
                      <input type="number" value={newQuizAnswerIndex} onChange={(e) => setNewQuizAnswerIndex(parseInt(e.target.value) || 0)} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1">해설</label>
                    <textarea value={newQuizExplanation} onChange={(e) => setNewQuizExplanation(e.target.value)} rows={2} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-sm resize-none" />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">이미지 URL<OptionalMark/></label>
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
                  <div className="flex bg-slate-100 p-1 rounded-xl flex-wrap gap-1">
                    <button
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'standard' })}
                      className={`flex-1 min-w-[110px] py-2 px-1.5 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'standard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      기본 시험지 (직접 쓰기)
                    </button>
                    <button
                      onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'multiple-choice' })}
                      className={`flex-1 min-w-[90px] py-2 px-1.5 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'multiple-choice' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      객관식 퀴즈
                    </button>
                    {(selectedWordbook?.type === 'irregular' || selectedWordbook?.type === 'comparative-grammar') && (
                      <>
                        <button
                          onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'irregular-writing' })}
                          className={`flex-1 min-w-[120px] py-2 px-1.5 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'irregular-writing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          3단 변화 (뜻 제공)
                        </button>
                        <button
                          onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'irregular-writing-with-meaning' })}
                          className={`flex-1 min-w-[130px] py-2 px-1.5 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'irregular-writing-with-meaning' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          3단 변화 + 한글뜻
                        </button>
                      </>
                    )}
                    {selectedWordbook?.type === 'verb-form-grammar' && (
                      <button
                        onClick={() => setTestPaperConfig({ ...testPaperConfig, quizType: 'memorization-table' })}
                        className={`flex-1 min-w-[90px] py-2 px-1.5 rounded-lg text-xs font-bold transition-all ${testPaperConfig.quizType === 'memorization-table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
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
                    {selectedWordbook?.type === 'grammar-cramming' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-blue-400 mb-1 ml-1">시작 세트</label>
                          <select
                            value={testPaperConfig.startDay}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setTestPaperConfig({ 
                                ...testPaperConfig, 
                                startDay: val,
                                subtitle: `${val}세트 - ${testPaperConfig.endDay}세트`
                              });
                            }}
                            className="w-full p-2.5 bg-white border border-blue-100 rounded-lg focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                          >
                            {[1, 2, 3, 4, 5, 6].map(s => (
                              <option key={s} value={s}>{s}세트</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-blue-400 mb-1 ml-1">종료 세트</label>
                          <select
                            value={testPaperConfig.endDay}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setTestPaperConfig({ 
                                ...testPaperConfig, 
                                endDay: val,
                                subtitle: `${testPaperConfig.startDay}세트 - ${val}세트`
                              });
                            }}
                            className="w-full p-2.5 bg-white border border-blue-100 rounded-lg focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                          >
                            {[1, 2, 3, 4, 5, 6].filter(s => s >= testPaperConfig.startDay).map(s => (
                              <option key={s} value={s}>{s}세트</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                    <div className="text-[10px] font-bold text-blue-400 text-center">
                      {selectedWordbook?.type === 'grammar-cramming' ? (
                        `선택된 세트: ${testPaperConfig.startDay}세트 ~ ${testPaperConfig.endDay}세트`
                      ) : (
                        `선택 범위: ${((testPaperConfig.startDay - 1) * testPaperConfig.unitSize) + 1}번 ~ ${Math.min(testPaperConfig.endDay * testPaperConfig.unitSize, words.length)}번 단어`
                      )}
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
                  <div className="space-y-4">
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
                        <span className="font-bold text-slate-700 text-xs text-nowrap">정답지 포함하기</span>
                      </div>
                    </div>
                    {testPaperConfig.selectionMode === 'range' && (
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px]">
                        <button 
                          onClick={() => setTestPaperConfig({ ...testPaperConfig, shuffleVerbs: !testPaperConfig.shuffleVerbs })}
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.shuffleVerbs ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                        >
                          {testPaperConfig.shuffleVerbs && <CheckCircle2 size={14} />}
                        </button>
                        <span className="font-bold text-slate-700 text-xs text-nowrap">단어 순서 랜덤</span>
                      </div>
                    )}
                  </div>
                )}

                {testPaperConfig.quizType === 'multiple-choice' && (
                  <div className="space-y-4">
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
                      {testPaperConfig.selectionMode === 'range' && (
                        <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px]">
                          <button 
                            onClick={() => setTestPaperConfig({ ...testPaperConfig, shuffleVerbs: !testPaperConfig.shuffleVerbs })}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.shuffleVerbs ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                          >
                            {testPaperConfig.shuffleVerbs && <CheckCircle2 size={14} />}
                          </button>
                          <span className="font-bold text-slate-700 text-xs text-nowrap">단어 순서 랜덤</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(testPaperConfig.quizType === 'irregular-writing' || testPaperConfig.quizType === 'irregular-writing-with-meaning') && (
                  <div className="space-y-4">
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
                      {testPaperConfig.selectionMode === 'range' && (
                        <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 h-[50px]">
                          <button 
                            onClick={() => setTestPaperConfig({ ...testPaperConfig, shuffleVerbs: !testPaperConfig.shuffleVerbs })}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${testPaperConfig.shuffleVerbs ? 'bg-blue-500 text-white' : 'bg-white border-2 border-slate-200'}`}
                          >
                            {testPaperConfig.shuffleVerbs && <CheckCircle2 size={14} />}
                          </button>
                          <span className="font-bold text-slate-700 text-xs text-nowrap">단어 순서 랜덤</span>
                        </div>
                      )}
                    </div>
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

      {/* Wordbook Merge Modal */}
      {isMergeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl w-full bg-white rounded-[3rem] p-8 md:p-10 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Layers className="text-purple-600" />
                  단어장 합치기 (통합 및 내보내기)
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  여러 단어장을 하나로 묶어 새 단어장으로 생성하거나 CSV 파일로 내보낼 수 있습니다.
                </p>
              </div>
              <button onClick={() => setIsMergeModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {/* Step 1: Select Wordbooks */}
              <div>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    1. 합칠 단어장 선택 ({selectedWbIdsForMerge.length}개 선택됨)
                  </label>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setMergeFilterTab('all')}
                      className={`px-2 py-1 rounded-lg transition-all ${mergeFilterTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      전체 ({allWordbooks.length || wordbooks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeFilterTab('word')}
                      className={`px-2 py-1 rounded-lg transition-all ${mergeFilterTab === 'word' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      📘 단어장
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeFilterTab('grammar')}
                      className={`px-2 py-1 rounded-lg transition-all ${mergeFilterTab === 'grammar' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      🎓 문법
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeFilterTab('exam')}
                      className={`px-2 py-1 rounded-lg transition-all ${mergeFilterTab === 'exam' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      🎯 시험기간
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-100 custom-scrollbar">
                  {(allWordbooks.length > 0 ? allWordbooks : wordbooks)
                    .filter(wb => {
                      if (mergeFilterTab === 'all') return true;
                      const cat = wb.category || (wb.type === 'irregular' ? 'grammar' : 'word');
                      return cat === mergeFilterTab;
                    })
                    .map(wb => {
                      const isChecked = selectedWbIdsForMerge.includes(wb.id);
                      const cat = wb.category || (wb.type === 'irregular' ? 'grammar' : 'word');
                      const count = wordbookWordCounts[wb.id];
                      return (
                        <div
                          key={wb.id}
                          onClick={() => toggleWbForMerge(wb.id)}
                          className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-purple-50 border-purple-200 text-purple-900 shadow-sm'
                              : 'bg-white border-slate-200/70 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-400 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                cat === 'exam' ? 'bg-amber-100 text-amber-700' : cat === 'grammar' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {cat === 'exam' ? '시험' : cat === 'grammar' ? '문법' : '단어'}
                              </span>
                              <span className="font-bold text-sm truncate">{wb.title}</span>
                            </div>
                            {typeof count === 'number' && (
                              <span className="text-[10px] text-slate-400 font-bold ml-0.5">{count}개 단어</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Step 2: Configure Wordbooks Order */}
              {mergeOrder.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      2. 단어 순서 설정 (어느 단어장의 단어가 먼저 올지 정렬)
                    </label>
                    <span className="text-[11px] font-bold text-purple-600">▲▼ 버튼으로 순서 변경</span>
                  </div>
                  <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    {mergeOrder.map((wbId, index) => {
                      const wb = (allWordbooks.length > 0 ? allWordbooks : wordbooks).find(w => w.id === wbId);
                      const cat = wb?.category || (wb?.type === 'irregular' ? 'grammar' : 'word');
                      return (
                        <div key={wbId} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-black text-xs rounded-lg shrink-0">
                              {index + 1}순위
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              cat === 'exam' ? 'bg-amber-100 text-amber-700' : cat === 'grammar' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {cat === 'exam' ? '시험' : cat === 'grammar' ? '문법' : '단어'}
                            </span>
                            <span className="font-bold text-sm text-slate-800 truncate">{wb?.title || wbId}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              disabled={index === 0}
                              onClick={() => moveMergeWb(index, 'up')}
                              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                              title="위로 이동 (먼저 출제)"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              disabled={index === mergeOrder.length - 1}
                              onClick={() => moveMergeWb(index, 'down')}
                              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                              title="아래로 이동 (나중에 출제)"
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              onClick={() => toggleWbForMerge(wbId)}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg ml-1"
                              title="선택 제외"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Settings */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1 ml-1">
                    3. 통합 단어장 제목
                  </label>
                  <input
                    type="text"
                    value={mergedTitle}
                    onChange={(e) => setMergedTitle(e.target.value)}
                    placeholder="예: 수특라 + 6모 비전고2 통합 단어장"
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-100 outline-none font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5 ml-1">
                    통합 단어장이 저장될 탭 (카테고리)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMergeTargetCategory('word')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        mergeTargetCategory === 'word'
                          ? 'bg-pastel-pink-500 text-white border-pastel-pink-500 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      📘 단어장
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeTargetCategory('grammar')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        mergeTargetCategory === 'grammar'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🎓 문법 세트
                    </button>
                    <button
                      type="button"
                      onClick={() => setMergeTargetCategory('exam')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all ${
                        mergeTargetCategory === 'exam'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🎯 시험기간
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1 ml-1">
                      DAY 배정 방식
                    </label>
                    <select
                      value={mergeDayOption}
                      onChange={(e) => setMergeDayOption(e.target.value as any)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-100 outline-none font-bold text-xs"
                    >
                      <option value="sequential">단어 수 기준 순차 배정 (DAY당 {mergedUnitSize}개)</option>
                      <option value="separate">단어장별로 각각 1 DAY씩 배정</option>
                      <option value="preserve">기존 각 단어장의 DAY 유지</option>
                    </select>
                  </div>
                  {mergeDayOption === 'sequential' && (
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1 ml-1">
                        DAY당 단어 수
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={mergedUnitSize}
                        onChange={(e) => setMergedUnitSize(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-purple-100 outline-none font-bold text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer" onClick={() => setRemoveDuplicates(!removeDuplicates)}>
                  <input
                    type="checkbox"
                    checked={removeDuplicates}
                    onChange={(e) => setRemoveDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-400 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-black text-slate-800">중복 단어 자동 제거</span>
                    <span className="text-slate-400 ml-2">(동일한 스펠링의 단어가 여러 단어장에 있으면 1번만 포함)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-slate-100 mt-4">
              <button
                onClick={() => setIsMergeModalOpen(false)}
                className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm transition-all"
              >
                닫기
              </button>
              <button
                onClick={handleExportMergeAsCsv}
                disabled={isMerging || mergeOrder.length === 0}
                className="flex-1 py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download size={16} />
                {isMerging ? '처리 중...' : '합쳐서 CSV로 내보내기'}
              </button>
              <button
                onClick={handleExecuteMerge}
                disabled={isMerging || mergeOrder.length < 2 || !mergedTitle.trim()}
                className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Layers size={16} />
                {isMerging ? '단어장 합치는 중...' : '새 단어장으로 합치기'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* DAY Management Modal */}
      {isDayManagementOpen && selectedWordbook && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-lg w-full bg-white rounded-[3rem] p-8 md:p-10 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="text-indigo-600" />
                  DAY 일괄 설정 및 관리
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  [{selectedWordbook.title}] 단어장의 DAY 구성을 한눈에 확인하고 일괄 재배정합니다.
                </p>
              </div>
              <button onClick={() => setIsDayManagementOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {/* Current Day Distribution */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
                  현재 DAY별 단어 수 현황 (전체: {words.length}개)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentDays.map(d => {
                    const count = words.filter((w, i) => getWordDay(w, i) === d).length;
                    return (
                      <div key={d} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold shadow-2xs">
                        <span className="text-indigo-600 font-black">DAY {d}</span>
                        <span className="text-slate-500 font-medium">{count}단어</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Auto Split Option */}
              <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-4">
                <div className="flex items-center gap-2 text-indigo-900">
                  <FileSpreadsheet size={18} className="text-indigo-600" />
                  <h4 className="text-sm font-black">균등 일괄 자동 분할</h4>
                </div>
                <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                  단어 순서대로 DAY 1부터 지정된 개수만큼 차례대로 DAY를 재배정합니다.
                </p>
                <div>
                  <label className="block text-xs font-bold text-indigo-800 mb-1">
                    DAY당 단어 수
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={bulkDaySplitSize}
                      onChange={(e) => setBulkDaySplitSize(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 p-3 bg-white border border-indigo-200 rounded-xl font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-100"
                    />
                    <button
                      onClick={() => {
                        if (confirm(`전체 ${words.length}개 단어를 DAY당 ${bulkDaySplitSize}개씩 일괄 재배정하시겠습니까?`)) {
                          handleAutoSplitDays(bulkDaySplitSize);
                        }
                      }}
                      className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all whitespace-nowrap"
                    >
                      일괄 분할 적용
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">
                    * {words.length}개 단어 분할 시 총 약 {Math.ceil(words.length / bulkDaySplitSize)}개 DAY 생성 예정
                  </p>
                </div>
              </div>

              {/* Direct Individual / Batch Guidance */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  원하는 단어만 직접 DAY 지정하는 방법
                </h4>
                <ul className="text-xs text-slate-500 space-y-1.5 font-medium leading-relaxed list-disc list-inside">
                  <li>
                    <strong className="text-slate-800">단어별 즉시 변경</strong>: 단어 카드 좌측 상단의 <span className="text-indigo-600 font-bold">[DAY X]</span> 뱃지 드롭다운을 클릭하여 즉시 다른 DAY로 이동할 수 있습니다.
                  </li>
                  <li>
                    <strong className="text-slate-800">체크박스 다중 이동</strong>: 목록에서 여러 단어의 체크박스를 선택한 후 상단 바에서 이동할 대상 DAY를 선택하고 [이동 적용]을 누르면 한 번에 이동됩니다.
                  </li>
                  <li>
                    <strong className="text-slate-800">단어 편집창</strong>: 각 단어 카드의 수정(연필 아이콘) 버튼을 누르면 단어의 소속 DAY를 직접 숫자로 입력할 수도 있습니다.
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 mt-4">
              <button
                onClick={() => setIsDayManagementOpen(false)}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-all"
              >
                닫기
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SortableWordbookCard({ 
  wb, 
  onClick, 
  onDelete, 
  onEdit,
  onMoveCategory,
  onPrefetch
}: { 
  wb: Wordbook; 
  onPrefetch?:()=>void;
  onClick: () => void; 
  onDelete: () => void; 
  onEdit: () => void; 
  onMoveCategory?: (targetCategory: 'word' | 'grammar' | 'exam') => void;
  key?: string;
}) {
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

  const wbCat = wb.category || (wb.type === 'irregular' ? 'grammar' : 'word');

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={onClick}
      onPointerEnter={onPrefetch}
      className="wordbook-card h-48 p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-pastel-pink-200/20 transition-all text-left flex flex-col group cursor-pointer active:scale-[0.98] relative"
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
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            wbCat === 'exam' ? 'bg-amber-100 text-amber-600' : wbCat === 'grammar' ? 'bg-purple-100 text-purple-600' : 'bg-pastel-pink-100 text-pastel-pink-600'
          }`}>
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
            title="단어장 설정 및 카테고리 수정"
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
        <h3 className="text-xl font-black text-slate-900 group-hover:text-pastel-pink-600 transition-colors line-clamp-1">{wb.title}</h3>
        {wb.type === 'irregular' && (
          <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-tighter shrink-0">
            Irregular
          </span>
        )}
        {wb.type === 'sentence-order' && (
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-full uppercase tracking-tighter shrink-0">
            🧩 문장 순서 배열
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
        <p className="text-[11px] text-slate-400 font-medium">
          {wb.createdAt?.toDate ? wb.createdAt.toDate().toLocaleDateString() : '등록됨'}
        </p>
        <div 
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold hover:bg-white hover:border-slate-300 transition-all shadow-2xs"
          onClick={(e) => e.stopPropagation()}
          title="소속 탭(카테고리) 이동"
        >
          <span className="text-[10px] text-slate-400">이동:</span>
          <select
            value={wbCat}
            onChange={(e) => {
              e.stopPropagation();
              onMoveCategory?.(e.target.value as 'word' | 'grammar' | 'exam');
            }}
            className="font-bold text-[11px] text-slate-700 bg-transparent outline-none cursor-pointer"
          >
            <option value="word">📘 단어장</option>
            <option value="grammar">🎓 문법 세트</option>
            <option value="exam">🎯 시험기간</option>
          </select>
        </div>
      </div>
    </motion.div>
  );
}

function SortableWordCard({
  word,
  selectedWordbook,
  currentDay,
  availableDays,
  onDayChange,
  onMoveOrder,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onOpenExamples
}: {
  word: Word;
  selectedWordbook: Wordbook;
  currentDay: number;
  availableDays: number[];
  onDayChange: (newDay: number) => void;
  onMoveOrder?: (direction: 'up' | 'down') => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenExamples: () => void;
  key?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: word.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-6 rounded-2xl border flex justify-between items-center gap-3 relative transition-all ${
        isSelected ? 'bg-indigo-50/40 border-indigo-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-200'
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 rounded text-pastel-pink-500 border-slate-300 focus:ring-pastel-pink-400 cursor-pointer"
          />
          <div 
            {...attributes} 
            {...listeners}
            className="p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0"
            title="드래그하여 순서 변경"
          >
            <GripVertical size={20} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative inline-flex items-center">
              <select
                value={currentDay}
                onChange={(e) => onDayChange(parseInt(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-xs py-0.5 px-2 rounded-lg cursor-pointer transition-all border border-indigo-200 outline-none"
                title={selectedWordbook.type === 'sentence-order' ? "지문 번호 변경" : "단어 소속 DAY 변경"}
              >
                {!availableDays.includes(currentDay) && (
                  <option value={currentDay}>
                    {selectedWordbook.type === 'sentence-order' ? `지문 ${currentDay}` : `DAY ${currentDay}`}
                  </option>
                )}
                {availableDays.map((d) => (
                  <option key={d} value={d}>
                    {selectedWordbook.type === 'sentence-order' ? `지문 ${d}` : `DAY ${d}`}
                  </option>
                ))}
                <option value={(Math.max(...availableDays, 0)) + 1}>
                  {selectedWordbook.type === 'sentence-order'
                    ? `+ 새 지문 ${(Math.max(...availableDays, 0)) + 1}`
                    : `+ DAY ${(Math.max(...availableDays, 0)) + 1}`}
                </option>
              </select>
            </div>
            {selectedWordbook.type === 'sentence-order' && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-black rounded-lg">
                {(word.order ?? 0) + 1}번 문장
              </span>
            )}
            <div className="text-lg font-black text-slate-900 break-words">
              {selectedWordbook.type === 'grammar-cramming' ? (word as any).quizSentence || word.word : word.word}
            </div>
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
            <div className="space-y-0.5 mt-1">
              <div className="text-sm font-black text-blue-500">
                {word.past} - {word.pastParticiple}
              </div>
              <div className="text-sm text-slate-500 font-medium whitespace-pre-wrap">{word.meaning}</div>
            </div>
          ) : selectedWordbook.type === 'comparative-grammar' ? (
            <div className="space-y-0.5 mt-1">
              <div className="text-sm font-black text-rose-500">
                비교급: {word.comparative || word.past || '-'} | 최상급: {word.superlative || word.pastParticiple || '-'}
              </div>
              <div className="text-sm text-slate-500 font-medium whitespace-pre-wrap">{word.meaning}</div>
            </div>
          ) : (selectedWordbook.type === 'modal-grammar' || selectedWordbook.type === 'basic-modal-grammar') ? (
            <div className="space-y-0.5 mt-1">
              <div className="text-sm font-black text-pastel-pink-500">{word.meaning}</div>
              {word.example && <div className="text-xs text-slate-400 font-medium italic">Ex: {word.example}</div>}
            </div>
          ) : (
            <div className="text-sm text-slate-500 font-medium whitespace-pre-wrap mt-1">
              {selectedWordbook.type === 'relative-grammar' && word.word.includes('(___)') ? (
                <span className="text-orange-500 font-bold">이 항목은 문장 형태입니다. 삭제 후 특정 개념의 [예문 관리] 버튼을 통해 등록해주세요.</span>
              ) : selectedWordbook.type === 'grammar-cramming' ? (
                <div className="space-y-1">
                  <div className="text-xs font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded inline-block">개념: {word.word}</div>
                  <div className="text-sm text-slate-600">정답: <span className="font-bold text-slate-900">{word.meaning}</span></div>
                  <div className="text-[10px] text-slate-400 font-medium italic">해설: {(word as any).quizExplanation}</div>
                </div>
              ) : word.meaning}
            </div>
          )}
          {word.imageUrl && (
            <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
              <img src={word.imageUrl} alt={word.word} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0 items-center">
        {selectedWordbook.type === 'sentence-order' && onMoveOrder && (
          <div className="flex flex-col gap-0.5 mr-1">
            <button
              onClick={() => onMoveOrder('up')}
              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-indigo-600 rounded transition-colors"
              title="문장 순서 위로 이동"
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={() => onMoveOrder('down')}
              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-indigo-600 rounded transition-colors"
              title="문장 순서 아래로 이동"
            >
              <ArrowDown size={14} />
            </button>
          </div>
        )}
        {(selectedWordbook.type === 'relative-grammar' || selectedWordbook.type === 'verb-form-grammar') && (
          <button 
            onClick={onOpenExamples}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg font-bold text-xs hover:bg-indigo-100 transition-all flex items-center gap-1.5"
          >
            <FileText size={14} />
            예문 관리
          </button>
        )}
        <button 
          onClick={onEdit}
          className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
          title="수정"
        >
          <Edit3 size={18} />
        </button>
        <button 
          onClick={onDelete}
          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
          title="삭제"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
