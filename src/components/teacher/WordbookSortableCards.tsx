import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Search, Trash2, Edit3, FileSpreadsheet, X, CheckCircle2, Circle, GripVertical, FileText, Download, Layers, ArrowUp, ArrowDown, Calendar, CheckSquare, Square, Sliders, Check } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Wordbook, Word } from './wordbookTypes';
// Drag-and-drop cards used by WordbookManager (moved out unchanged).
export function SortableWordbookCard({ 
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

export function SortableWordCard({
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


