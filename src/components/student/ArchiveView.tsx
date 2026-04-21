import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { History, FileText, X, Sparkles, Folder, FolderPlus, Trash2, Move, Clock } from 'lucide-react';
import { db, auth, createFolder, deleteFolder, moveToFolder } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, orderBy, deleteDoc } from 'firebase/firestore';
import AnalysisView from '../AnalysisView';

export default function ArchiveView() {
  const [stats, setStats] = useState({
    history: [] as any[],
    generatorHistory: [] as any[],
    folders: [] as any[]
  });
  const [selectedAnalysis, setSelectedAnalysis] = useState<any | null>(null);
  const [selectedGenerator, setSelectedGenerator] = useState<any | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isMovingRecord, setIsMovingRecord] = useState<{ id: string, type: 'analysis' | 'generator' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'analysis' | 'generator' | 'folder', name?: string } | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    // Fetch generator history
    const qGenHistory = query(
      collection(db, 'generatorHistory'), 
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const unsubGenHistory = onSnapshot(qGenHistory, (snapshot) => {
      setStats(prev => ({ ...prev, generatorHistory: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });

    // Fetch analysis history
    const qHistory = query(
      collection(db, 'analysisHistory'), 
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      setStats(prev => ({ ...prev, history: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });

    // Fetch folders
    const qFolders = query(
      collection(db, 'folders'),
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const unsubFolders = onSnapshot(qFolders, (snapshot) => {
      setStats(prev => ({ ...prev, folders: snapshot.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });

    return () => {
      unsubHistory();
      unsubGenHistory();
      unsubFolders();
    };
  }, [auth.currentUser]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !auth.currentUser) return;
    await createFolder(auth.currentUser.uid, newFolderName);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
    if (activeFolderId === id) setActiveFolderId(null);
    setConfirmDelete(null);
  };

  const handleMoveRecord = async (folderId: string | null) => {
    if (!isMovingRecord) return;
    try {
      await moveToFolder(isMovingRecord.id, isMovingRecord.type, folderId);
      setIsMovingRecord(null);
    } catch (error) {
      console.error('Failed to move record:', error);
      alert('이동 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteRecord = async (id: string, type: 'analysis' | 'generator') => {
    const collectionName = type === 'analysis' ? 'analysisHistory' : 'generatorHistory';
    await deleteDoc(doc(db, collectionName, id));
    setConfirmDelete(null);
  };

  const [analysisPage, setAnalysisPage] = useState(1);
  const [generatorPage, setGeneratorPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  useEffect(() => {
    setAnalysisPage(1);
    setGeneratorPage(1);
  }, [activeFolderId]);

  const filteredHistory = stats.history.filter(item => (item.folderId || null) === activeFolderId);
  const filteredGenHistory = stats.generatorHistory.filter(item => (item.folderId || null) === activeFolderId);
  const recentHistory = stats.history.filter(item => !item.folderId);
  const recentGenHistory = stats.generatorHistory.filter(item => !item.folderId);

  const currentAnalysisItems = activeFolderId ? filteredHistory : recentHistory;
  const currentGeneratorItems = activeFolderId ? filteredGenHistory : recentGenHistory;

  const totalAnalysisPages = Math.ceil(currentAnalysisItems.length / ITEMS_PER_PAGE);
  const totalGeneratorPages = Math.ceil(currentGeneratorItems.length / ITEMS_PER_PAGE);

  const paginatedAnalysis = currentAnalysisItems.slice((analysisPage - 1) * ITEMS_PER_PAGE, analysisPage * ITEMS_PER_PAGE);
  const paginatedGenerator = currentGeneratorItems.slice((generatorPage - 1) * ITEMS_PER_PAGE, generatorPage * ITEMS_PER_PAGE);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <header className="mb-8 md:mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2 tracking-tight">보관소</h1>
          <p className="text-sm md:text-base text-slate-500 font-medium">저장된 지문 분석과 변형 문제들을 관리하세요.</p>
        </div>
        <button
          onClick={() => setIsCreatingFolder(true)}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-100"
        >
          <FolderPlus size={18} />
          새 폴더 만들기
        </button>
      </header>

      {/* Folder Creation Modal */}
      {isCreatingFolder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-6">새 폴더 만들기</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="폴더 이름을 입력하세요"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl mb-6 outline-none focus:border-blue-500 transition-all"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setIsCreatingFolder(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">취소</button>
              <button onClick={handleCreateFolder} className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all">만들기</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Folder List */}
      <div className="mb-12">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <Folder className="text-blue-500" size={20} />
          내 보관함
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          <button
            onClick={() => setActiveFolderId(null)}
            className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-all flex flex-col items-center gap-2 md:gap-3 ${activeFolderId === null ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'}`}
          >
            <Clock className="w-6 h-6 md:w-8 md:h-8" />
            <span className="font-bold text-sm md:text-base">최근 기록</span>
          </button>
          {stats.folders.map(folder => (
            <div key={folder.id} className="relative group">
              <button
                onClick={() => setActiveFolderId(folder.id)}
                className={`w-full p-4 md:p-6 rounded-2xl md:rounded-3xl border-2 transition-all flex flex-col items-center gap-2 md:gap-3 ${activeFolderId === folder.id ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'}`}
              >
                <Folder className="w-6 h-6 md:w-8 md:h-8" />
                <span className="font-bold text-sm md:text-base truncate w-full text-center">{folder.name}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: folder.id, type: 'folder', name: folder.name }); }}
                className="absolute top-1 right-1 md:top-2 md:right-2 p-1.5 md:p-2 bg-red-50 text-red-500 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-100"
              >
                <Trash2 size={12} className="md:w-[14px] md:h-[14px]" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Analysis History */}
        <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg md:text-xl font-black text-slate-900 mb-4 md:mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="text-blue-500" size={18} />
              {activeFolderId ? '폴더 내 분석 기록' : '최근 지문 분석 내역'}
            </div>
            <span className="text-[10px] md:text-xs text-slate-400 font-bold">{(activeFolderId ? filteredHistory : recentHistory).length}개</span>
          </h3>
          <div className="space-y-4">
            {paginatedAnalysis.map((item) => (
              <div key={item.id} className="group relative flex items-center bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all overflow-hidden">
                <button 
                  onClick={() => setSelectedAnalysis(item.result)}
                  className="flex-1 text-left p-4 md:p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg md:rounded-xl flex items-center justify-center text-blue-500 shadow-sm">
                      <FileText size={16} className="md:w-5 md:h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm md:text-base text-slate-900 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">{item.title || '제목 없음'}</div>
                      <div className="text-[10px] md:text-xs text-slate-400 font-medium">
                        {item.createdAt?.toDate().toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 md:gap-2 pr-4 md:pr-5">
                  <button
                    onClick={() => setIsMovingRecord({ id: item.id, type: 'analysis' })}
                    className="p-1.5 md:p-2 text-slate-300 hover:text-blue-500 transition-colors"
                    title="폴더 이동"
                  >
                    <Move size={14} className="md:w-4 md:h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ id: item.id, type: 'analysis', name: item.title })}
                    className="p-1.5 md:p-2 text-slate-300 hover:text-red-500 transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={14} className="md:w-4 md:h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {totalAnalysisPages > 1 && (
              <div className="flex justify-center items-center gap-2 pt-4">
                {Array.from({ length: totalAnalysisPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAnalysisPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${analysisPage === i + 1 ? 'bg-blue-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {paginatedAnalysis.length === 0 && (
              <div className="py-8 md:py-12 text-center text-slate-400 font-medium text-sm">
                기록이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Generator History */}
        <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-lg md:text-xl font-black text-slate-900 mb-4 md:mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="text-amber-500" size={18} />
              {activeFolderId ? '폴더 내 문제 세트' : '최근 변형 문제 생성 내역'}
            </div>
            <span className="text-[10px] md:text-xs text-slate-400 font-bold">{(activeFolderId ? filteredGenHistory : recentGenHistory).length}개</span>
          </h3>
          <div className="space-y-4">
            {paginatedGenerator.map((item) => (
              <div key={item.id} className="group relative flex items-center bg-slate-50 rounded-xl md:rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all overflow-hidden">
                <button 
                  onClick={() => setSelectedGenerator(item.result)}
                  className="flex-1 text-left p-4 md:p-5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-lg md:rounded-xl flex items-center justify-center text-amber-500 shadow-sm">
                      <Sparkles size={16} className="md:w-5 md:h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm md:text-base text-slate-900 truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">{item.title || '변형 문제 세트'}</div>
                      <div className="text-[10px] md:text-xs text-slate-400 font-medium">
                        {item.createdAt?.toDate().toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-1 md:gap-2 pr-4 md:pr-5">
                  <button
                    onClick={() => setIsMovingRecord({ id: item.id, type: 'generator' })}
                    className="p-1.5 md:p-2 text-slate-300 hover:text-amber-500 transition-colors"
                    title="폴더 이동"
                  >
                    <Move size={14} className="md:w-4 md:h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ id: item.id, type: 'generator', name: item.title })}
                    className="p-1.5 md:p-2 text-slate-300 hover:text-red-500 transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={14} className="md:w-4 md:h-4" />
                  </button>
                </div>
              </div>
            ))}

            {totalGeneratorPages > 1 && (
              <div className="flex justify-center items-center gap-2 pt-4">
                {Array.from({ length: totalGeneratorPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setGeneratorPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${generatorPage === i + 1 ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {paginatedGenerator.length === 0 && (
              <div className="py-8 md:py-12 text-center text-slate-400 font-medium text-sm">
                기록이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-4">정말 삭제하시겠습니까?</h3>
            <p className="text-slate-500 mb-8 font-medium leading-relaxed">
              {confirmDelete.type === 'folder' 
                ? `[${confirmDelete.name}] 폴더와 그 안의 모든 기록이 영구적으로 삭제됩니다.`
                : `[${confirmDelete.name || '제목 없음'}] 기록이 영구적으로 삭제됩니다.`}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)} 
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  if (confirmDelete.type === 'folder') {
                    handleDeleteFolder(confirmDelete.id);
                  } else {
                    handleDeleteRecord(confirmDelete.id, confirmDelete.type as 'analysis' | 'generator');
                  }
                }} 
                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
              >
                삭제하기
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Move Record Modal */}
      {isMovingRecord && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">폴더로 이동</h3>
              <button onClick={() => setIsMovingRecord(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 mb-8 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              <button
                onClick={() => handleMoveRecord(null)}
                className="w-full p-4 text-left bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-500 transition-all font-bold flex items-center gap-3"
              >
                <Clock size={20} className="text-slate-400" />
                최근 기록으로 이동
              </button>
              {stats.folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => handleMoveRecord(folder.id)}
                  className="w-full p-4 text-left bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-500 transition-all font-bold flex items-center gap-3"
                >
                  <Folder size={20} className="text-blue-500" />
                  {folder.name}
                </button>
              ))}
            </div>
            <button onClick={() => setIsMovingRecord(null)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all">취소</button>
          </motion.div>
        </div>
      )}

      {/* Analysis Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-black text-slate-900">저장된 지문 분석</h2>
              <button 
                onClick={() => setSelectedAnalysis(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <AnalysisView result={selectedAnalysis} />
            </div>
          </motion.div>
        </div>
      )}

      {/* Generator Modal */}
      {selectedGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-5xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-black text-slate-900">저장된 변형 문제</h2>
              <button 
                onClick={() => setSelectedGenerator(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8">
              <AnalysisView result={selectedGenerator} questionsOnly={true} />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
