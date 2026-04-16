import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, CheckCircle2, Circle, ChevronRight, Sparkles, Trophy, Volume2, RotateCcw, ChevronLeft, Gamepad2, Timer, X } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';

interface Wordbook {
  id: string;
  title: string;
  description: string;
  order?: number;
}

interface Word {
  id: string;
  word: string;
  meaning: string;
  example?: string;
  imageUrl?: string;
  order?: number;
}

interface Progress {
  [wordId: string]: 'learned' | 'mastered' | 'unlearned';
}

export default function WordbookView({ isMobile }: { isMobile?: boolean }) {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [selectedWordbook, setSelectedWordbook] = useState<Wordbook | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(true);
  
  // Chunking states
  const [chunkSize, setChunkSize] = useState(10);
  const [currentChunk, setCurrentChunk] = useState(0);

  // Flashcard states
  const [isFlashcardMode, setIsFlashcardMode] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Match game states
  const [isMatchMode, setIsMatchMode] = useState(false);
  const [matchCards, setMatchCards] = useState<{ id: string; content: string; type: 'word' | 'meaning'; matched: boolean; wordId: string }[]>([]);
  const [selectedMatchCard, setSelectedMatchCard] = useState<number | null>(null);
  const [matchStartTime, setMatchStartTime] = useState<number | null>(null);
  const [matchTime, setMatchTime] = useState(0);
  const [isMatchFinished, setIsMatchFinished] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ id: string; name: string; time: number; createdAt: any }[]>([]);

  // Quiz states
  const [isQuizMode, setIsQuizMode] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizFinished, setIsQuizFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // Focus & Confirm states
  const [pendingMode, setPendingMode] = useState<'flashcard' | 'quiz' | 'match' | null>(null);
  const [isFocusedMode, setIsFocusedMode] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'wordbooks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWordbooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wordbook));
      // Sort by order to match teacher's arrangement
      fetchedWordbooks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setWordbooks(fetchedWordbooks);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'wordProgress'), where('uid', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newProgress: Progress = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        newProgress[data.wordId] = data.status;
      });
      setProgress(newProgress);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!selectedWordbook) return;
    const q = query(collection(db, `wordbooks/${selectedWordbook.id}/words`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
      // Sort by order if available
      fetchedWords.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setWords(fetchedWords);
    });
    return () => unsubscribe();
  }, [selectedWordbook]);

  useEffect(() => {
    if (!selectedWordbook) return;
    
    const q = query(
      collection(db, 'matchLeaderboard'),
      where('wordbookId', '==', selectedWordbook.id),
      orderBy('time', 'asc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setLeaderboard(records);
    });

    return () => unsubscribe();
  }, [selectedWordbook]);

  const toggleLearned = async (wordId: string) => {
    if (!auth.currentUser || !selectedWordbook) return;
    const currentStatus = progress[wordId] || 'unlearned';
    const newStatus = currentStatus === 'learned' ? 'unlearned' : 'learned';
    
    const progressId = `${auth.currentUser.uid}_${wordId}`;
    try {
      await setDoc(doc(db, 'wordProgress', progressId), {
        uid: auth.currentUser.uid,
        wordId,
        wordbookId: selectedWordbook.id,
        status: newStatus,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startMatchGame = () => {
    if (displayedWords.length === 0) return;
    
    const cards: any[] = [];
    displayedWords.forEach(w => {
      cards.push({ id: `${w.id}_word`, content: w.word, type: 'word', matched: false, wordId: w.id });
      cards.push({ id: `${w.id}_meaning`, content: w.meaning, type: 'meaning', matched: false, wordId: w.id });
    });

    // Shuffle
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    setMatchCards(cards);
    setSelectedMatchCard(null);
    setMatchStartTime(Date.now());
    setMatchTime(0);
    setIsMatchFinished(false);
    setIsMatchMode(true);
    setIsFlashcardMode(false);
    setIsQuizMode(false);
    setIsFocusedMode(true);
  };

  const startQuiz = () => {
    if (displayedWords.length < 4) {
      alert('객관식 학습을 위해서는 최소 4개의 단어가 필요합니다.');
      return;
    }
    setIsQuizMode(true);
    setIsMatchMode(false);
    setIsFlashcardMode(false);
    setQuizIndex(0);
    setQuizScore(0);
    setIsQuizFinished(false);
    generateQuizOptions(0);
    setIsFocusedMode(true);
  };

  const startFlashcards = () => {
    setIsFlashcardMode(true);
    setIsMatchMode(false);
    setIsQuizMode(false);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setIsFocusedMode(true);
  };

  const handleConfirmStart = () => {
    if (pendingMode === 'match') startMatchGame();
    else if (pendingMode === 'quiz') startQuiz();
    else if (pendingMode === 'flashcard') startFlashcards();
    setPendingMode(null);
  };

  const exitFocusedMode = () => {
    setIsFocusedMode(false);
    setIsFlashcardMode(false);
    setIsQuizMode(false);
    setIsMatchMode(false);
  };

  const generateQuizOptions = (index: number) => {
    const correctWord = displayedWords[index];
    const options = [correctWord.meaning];
    const otherMeanings = displayedWords
      .filter(w => w.id !== correctWord.id)
      .map(w => w.meaning);
    
    // Shuffle other meanings and pick 3
    const shuffledOthers = [...otherMeanings].sort(() => Math.random() - 0.5);
    options.push(...shuffledOthers.slice(0, 3));
    
    // Shuffle all options
    setQuizOptions(options.sort(() => Math.random() - 0.5));
    setSelectedOption(null);
    setIsCorrect(null);
  };

  const handleQuizAnswer = (optionIndex: number) => {
    if (selectedOption !== null || optionIndex < 0 || optionIndex >= quizOptions.length) return;
    
    setSelectedOption(optionIndex);
    const isAnswerCorrect = quizOptions[optionIndex] === displayedWords[quizIndex].meaning;
    setIsCorrect(isAnswerCorrect);
    
    if (isAnswerCorrect) {
      setQuizScore(prev => prev + 1);
    }

    setTimeout(() => {
      if (quizIndex < displayedWords.length - 1) {
        setQuizIndex(prev => prev + 1);
        generateQuizOptions(quizIndex + 1);
      } else {
        setIsQuizFinished(true);
      }
    }, 600);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isQuizMode && !isQuizFinished && selectedOption === null) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= quizOptions.length) {
          handleQuizAnswer(num - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isQuizMode, isQuizFinished, selectedOption, quizOptions]);

  useEffect(() => {
    let interval: any;
    if (isMatchMode && !isMatchFinished && matchStartTime) {
      interval = setInterval(() => {
        setMatchTime(Math.floor((Date.now() - matchStartTime) / 100) / 10);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isMatchMode, isMatchFinished, matchStartTime]);

  const handleMatchCardClick = (index: number) => {
    if (isMatchFinished || matchCards[index].matched) return;
    if (selectedMatchCard === index) {
      setSelectedMatchCard(null);
      return;
    }

    if (selectedMatchCard === null) {
      setSelectedMatchCard(index);
    } else {
      const firstCard = matchCards[selectedMatchCard];
      const secondCard = matchCards[index];

      if (firstCard.wordId === secondCard.wordId && firstCard.type !== secondCard.type) {
        // Match!
        const newCards = [...matchCards];
        newCards[selectedMatchCard].matched = true;
        newCards[index].matched = true;
        setMatchCards(newCards);
        setSelectedMatchCard(null);

        if (newCards.every(c => c.matched)) {
          const finalTime = Math.floor((Date.now() - (matchStartTime || 0)) / 100) / 10;
          setIsMatchFinished(true);
          saveScore(finalTime);
        }
      } else {
        // No match
        setSelectedMatchCard(index);
      }
    }
  };

  const saveScore = async (time: number) => {
    if (!auth.currentUser || !selectedWordbook) return;

    try {
      // Get user name
      const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', auth.currentUser.uid)));
      const userName = userDoc.docs[0]?.data()?.name || '익명';

      await addDoc(collection(db, 'matchLeaderboard'), {
        wordbookId: selectedWordbook.id,
        uid: auth.currentUser.uid,
        name: userName,
        time: time,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Failed to save match score:', error);
    }
  };

  const totalChunks = Math.ceil(words.length / chunkSize);
  const displayedWords = words.slice(currentChunk * chunkSize, (currentChunk + 1) * chunkSize);

  const learnedCount = words.filter(w => progress[w.id] === 'learned').length;
  const progressPercent = words.length > 0 ? Math.round((learnedCount / words.length) * 100) : 0;

  const currentWord = displayedWords[currentCardIndex];

  return (
    <div className={`${isMobile ? 'max-w-lg' : 'max-w-4xl'} mx-auto px-4 md:px-6 py-6 md:py-10`}>
      <AnimatePresence>
        {pendingMode && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-sm w-full bg-white rounded-[2.5rem] p-10 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-pastel-pink-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-pastel-pink-500">
                <Sparkles size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">학습을 시작할까요?</h3>
              <p className="text-slate-500 font-medium mb-8">
                {pendingMode === 'flashcard' ? '플래시카드' : pendingMode === 'quiz' ? '객관식 퀴즈' : '매치 게임'} 모드로 이동하여 학습에 집중합니다.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPendingMode(null)}
                  className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-colors"
                >
                  아니오
                </button>
                <button
                  onClick={handleConfirmStart}
                  className="py-4 bg-pastel-pink-500 text-white rounded-2xl font-black shadow-lg shadow-pastel-pink-200 hover:scale-105 transition-transform"
                >
                  네!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFocusedMode && (
          <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto no-print">
            <div className="max-w-4xl mx-auto px-4 py-10">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl">
                    {isFlashcardMode ? '📇' : isQuizMode ? '📝' : '🎮'}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{selectedWordbook?.title}</h2>
                    <p className="text-xs font-bold text-slate-400">Day {currentChunk + 1} 집중 학습 모드</p>
                  </div>
                </div>
                <button
                  onClick={exitFocusedMode}
                  className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-slate-600 transition-all flex items-center gap-2 font-bold text-sm"
                >
                  <X size={20} />
                  학습 종료
                </button>
              </div>

              {isQuizMode ? (
                <div className="flex flex-col items-center gap-8">
                  <AnimatePresence mode="wait">
                    {isQuizFinished ? (
                      <motion.div
                        key="quiz-finished"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white ${isMobile ? 'p-8 rounded-[2.5rem]' : 'p-12 rounded-[3.5rem]'} border-4 border-indigo-100 shadow-2xl text-center space-y-4 md:space-y-6 w-full max-w-lg`}
                      >
                        <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-500`}>
                          <Trophy size={isMobile ? 32 : 48} />
                        </div>
                        <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-slate-900`}>퀴즈 종료!</h2>
                        <p className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-slate-500`}>
                          총 <span className="text-indigo-500">{displayedWords.length}</span>문제 중 <span className="text-indigo-500">{quizScore}</span>문제를 맞췄습니다.
                        </p>
                        <div className="pt-4 md:pt-6">
                          <button 
                            onClick={startQuiz}
                            className="px-8 md:px-10 py-3 md:py-4 bg-indigo-500 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:scale-105 transition-transform text-sm md:text-base"
                          >
                            다시 도전하기
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={quizIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`w-full max-w-2xl bg-white ${isMobile ? 'rounded-2xl p-6' : 'rounded-[3rem] p-8 md:p-12'} border border-slate-100 shadow-xl`}
                      >
                        <div className="flex justify-between items-center mb-6 md:mb-8">
                          <div className="text-[10px] md:text-sm font-black text-slate-400">
                            문제 {quizIndex + 1} / {displayedWords.length}
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={isMobile ? 12 : 16} className="text-emerald-500" />
                            <span className="text-[10px] md:text-sm font-black text-emerald-600">{quizScore}</span>
                          </div>
                        </div>

                        <div className={`flex flex-col items-center gap-4 md:gap-6 ${isMobile ? 'mb-6' : 'mb-10'}`}>
                          {displayedWords[quizIndex].imageUrl && (
                            <div className={`w-full max-w-sm ${isMobile ? 'h-32' : 'h-48'} rounded-2xl md:rounded-3xl overflow-hidden border border-slate-100 shadow-sm`}>
                              <img 
                                src={displayedWords[quizIndex].imageUrl} 
                                alt="Quiz Hint" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <h3 className={`${isMobile ? 'text-3xl' : 'text-5xl'} font-black text-slate-900 text-center`}>{displayedWords[quizIndex].word}</h3>
                          <button 
                            onClick={() => speak(displayedWords[quizIndex].word)}
                            className="p-2 md:p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-pastel-pink-500 transition-colors"
                          >
                            <Volume2 size={isMobile ? 20 : 24} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:gap-3">
                          {quizOptions.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleQuizAnswer(idx)}
                              disabled={selectedOption !== null}
                              className={`${isMobile ? 'p-3 text-sm' : 'p-5'} rounded-xl md:rounded-2xl border-2 text-left font-bold transition-all flex items-center justify-between group ${
                                selectedOption === idx
                                  ? isCorrect 
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                    : 'bg-red-50 border-red-500 text-red-700'
                                  : selectedOption !== null && option === displayedWords[quizIndex].meaning
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                    : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex items-center gap-3 md:gap-4 w-full">
                                <span className={`${isMobile ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-sm'} rounded-lg flex-shrink-0 flex items-center justify-center font-black ${
                                  selectedOption === idx
                                    ? isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                                    : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500'
                                }`}>
                                  {idx + 1}
                                </span>
                                <span className="whitespace-pre-wrap leading-tight">{option}</span>
                              </span>
                              {selectedOption === idx && (
                                isCorrect ? <CheckCircle2 size={isMobile ? 16 : 20} className="flex-shrink-0" /> : <X size={isMobile ? 16 : 20} className="flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                        <div className="mt-6 md:mt-8 text-center text-[10px] font-bold text-slate-300">
                          키보드 숫자로도 선택할 수 있습니다.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : isMatchMode ? (
                <div className="space-y-8">
                  <div className="flex justify-between items-center px-4">
                    <div className="flex items-center gap-2 text-amber-600 font-black">
                      <Timer size={20} />
                      <span className="text-2xl tabular-nums">{matchTime.toFixed(1)}s</span>
                    </div>
                    <button 
                      onClick={startMatchGame}
                      className="text-sm font-bold text-slate-400 hover:text-amber-500 flex items-center gap-1"
                    >
                      <RotateCcw size={16} />
                      다시 시작
                    </button>
                  </div>

                  {isMatchFinished ? (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`bg-white ${isMobile ? 'p-8 rounded-[2.5rem]' : 'p-12 rounded-[3.5rem]'} border-4 border-amber-100 shadow-2xl text-center space-y-4 md:space-y-6`}
                    >
                      <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-500`}>
                        <Trophy size={isMobile ? 32 : 48} />
                      </div>
                      <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-slate-900`}>참 잘했어요!</h2>
                      <p className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-slate-500`}>
                        모든 단어를 <span className="text-amber-500">{matchTime.toFixed(1)}초</span> 만에 맞췄습니다!
                      </p>

                      {/* Leaderboard */}
                      <div className="max-w-md mx-auto bg-slate-50 rounded-3xl p-4 md:p-6 border border-slate-100">
                        <h4 className="text-xs md:text-sm font-black text-slate-900 mb-3 md:mb-4 flex items-center justify-center gap-2">
                          <Trophy size={isMobile ? 14 : 16} className="text-amber-500" />
                          실시간 TOP 10 기록
                        </h4>
                        <div className="space-y-2">
                          {leaderboard.map((record, index) => (
                            <div key={record.id} className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm border border-slate-50">
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                                  index === 0 ? 'bg-amber-100 text-amber-600' :
                                  index === 1 ? 'bg-slate-200 text-slate-600' :
                                  index === 2 ? 'bg-orange-100 text-orange-600' :
                                  'bg-slate-50 text-slate-400'
                                }`}>
                                  {index + 1}
                                </span>
                                <span className="text-sm font-bold text-slate-700">{record.name}</span>
                              </div>
                              <span className="text-sm font-black text-amber-500">{record.time.toFixed(1)}s</span>
                            </div>
                          ))}
                          {leaderboard.length === 0 && (
                            <div className="text-xs font-medium text-slate-400 py-4">아직 기록이 없습니다. 첫 번째 주인공이 되어보세요!</div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 md:pt-6">
                        <button 
                          onClick={startMatchGame}
                          className="px-8 md:px-10 py-3 md:py-4 bg-amber-500 text-white rounded-2xl font-black shadow-xl shadow-amber-200 hover:scale-105 transition-transform text-sm md:text-base"
                        >
                          한 번 더 도전하기
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className={`grid grid-cols-2 ${isMobile ? 'gap-2' : 'md:grid-cols-4 gap-4'}`}>
                      {matchCards.map((card, index) => (
                        <motion.button
                          key={card.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ 
                            opacity: card.matched ? 0 : 1,
                            scale: card.matched ? 0.5 : 1,
                            y: card.matched ? -20 : 0
                          }}
                          onClick={() => handleMatchCardClick(index)}
                          className={`${isMobile ? 'h-24 p-2 text-[10px]' : 'h-32 p-4 text-sm md:text-base'} rounded-xl md:rounded-2xl border-2 transition-all flex items-center justify-center text-center font-bold leading-tight whitespace-pre-wrap ${
                            card.matched ? 'pointer-events-none' :
                            selectedMatchCard === index 
                              ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-lg scale-105 z-10' 
                              : 'bg-white border-slate-100 text-slate-700 hover:border-amber-200 hover:shadow-md'
                          }`}
                        >
                          {card.content}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              ) : isFlashcardMode && displayedWords.length > 0 ? (
                <div className="flex flex-col items-center gap-6 md:gap-8">
                  <div className={`relative w-full ${isMobile ? 'max-w-xs h-64' : 'max-w-md h-80'} perspective-1000`}>
                    <motion.div
                      key={`${currentChunk}_${currentCardIndex}`}
                      className="w-full h-full relative preserve-3d cursor-pointer"
                      animate={{ rotateY: isFlipped ? 180 : 0 }}
                      transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      {/* Front */}
                      <div className={`absolute inset-0 backface-hidden bg-white ${isMobile ? 'rounded-2xl p-6' : 'rounded-[3rem] p-10'} border-2 border-pastel-pink-100 shadow-xl flex flex-col items-center justify-center`}>
                        <div className={`${isMobile ? 'text-3xl' : 'text-5xl'} font-black text-slate-900 mb-4 md:mb-6`}>{currentWord.word}</div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(currentWord.word);
                          }}
                          className={`${isMobile ? 'p-3' : 'p-4'} bg-pastel-pink-50 text-pastel-pink-500 rounded-2xl hover:bg-pastel-pink-100 transition-colors`}
                        >
                          <Volume2 size={isMobile ? 24 : 32} />
                        </button>
                        <div className="absolute bottom-4 md:bottom-6 text-[10px] md:text-xs font-bold text-slate-300">클릭하여 뜻 확인</div>
                      </div>

                      {/* Back */}
                      <div 
                        className={`absolute inset-0 backface-hidden bg-pastel-pink-500 ${isMobile ? 'rounded-2xl p-6' : 'rounded-[3rem] p-10'} shadow-xl flex flex-col items-center justify-center text-white`}
                        style={{ transform: 'rotateY(180deg)' }}
                      >
                        <div className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black mb-2 md:mb-4 text-center whitespace-pre-wrap leading-tight`}>{currentWord.meaning}</div>
                        {currentWord.example && (
                          <div className="text-[10px] md:text-sm font-medium opacity-80 text-center italic">"{currentWord.example}"</div>
                        )}
                        <div className="absolute bottom-4 md:bottom-6 text-[10px] md:text-xs font-bold opacity-60">클릭하여 단어 확인</div>
                      </div>
                    </motion.div>
                  </div>

                  <div className="flex items-center gap-4 md:gap-6">
                    <button 
                      disabled={currentCardIndex === 0}
                      onClick={() => {
                        setCurrentCardIndex(prev => prev - 1);
                        setIsFlipped(false);
                      }}
                      className={`${isMobile ? 'w-10 h-10' : 'w-14 h-14'} bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-pastel-pink-500 disabled:opacity-30 transition-all`}
                    >
                      <ChevronLeft size={isMobile ? 20 : 28} />
                    </button>
                    <div className={`${isMobile ? 'text-base' : 'text-lg'} font-black text-slate-400`}>
                      <span className="text-slate-900">{currentCardIndex + 1}</span> / {displayedWords.length}
                    </div>
                    <button 
                      disabled={currentCardIndex === displayedWords.length - 1}
                      onClick={() => {
                        setCurrentCardIndex(prev => prev + 1);
                        setIsFlipped(false);
                      }}
                      className={`${isMobile ? 'w-10 h-10' : 'w-14 h-14'} bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 hover:text-pastel-pink-500 disabled:opacity-30 transition-all`}
                    >
                      <ChevronRight size={isMobile ? 20 : 28} />
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full md:w-auto">
                    <button 
                      onClick={() => toggleLearned(currentWord.id)}
                      className={`px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${
                        progress[currentWord.id] === 'learned'
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                          : 'bg-white text-slate-400 border border-slate-100 hover:border-emerald-200 hover:text-emerald-500'
                      }`}
                    >
                      <CheckCircle2 size={isMobile ? 16 : 20} />
                      {progress[currentWord.id] === 'learned' ? '학습 완료됨' : '학습 완료로 표시'}
                    </button>
                    <button 
                      onClick={() => {
                        setCurrentCardIndex(0);
                        setIsFlipped(false);
                      }}
                      className="px-6 md:px-8 py-3 md:py-4 bg-slate-100 text-slate-500 rounded-xl md:rounded-2xl font-black hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      <RotateCcw size={isMobile ? 16 : 20} />
                      처음부터
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!selectedWordbook ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <header className={`${isMobile ? 'mb-6' : 'mb-12'} text-center`}>
              <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-slate-900 mb-2 md:mb-4 tracking-tight`}>단어장 학습</h1>
              <p className="text-sm md:text-base text-slate-500 font-medium">선생님이 등록한 단어장을 학습하고 실력을 키워보세요!</p>
            </header>

            <div className={`grid grid-cols-1 ${isMobile ? '' : 'md:grid-cols-2'} gap-4 md:gap-6`}>
              {wordbooks.map((wb) => (
                <button
                  key={wb.id}
                  onClick={() => {
                    setSelectedWordbook(wb);
                    setCurrentChunk(0);
                    setCurrentCardIndex(0);
                  }}
                  className={`${isMobile ? 'p-5 rounded-2xl' : 'p-8 rounded-[2.5rem]'} bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-pastel-pink-200/20 transition-all text-left flex items-center justify-between group`}
                >
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className={`${isMobile ? 'w-10 h-10' : 'w-14 h-14'} bg-pastel-pink-100 rounded-xl md:rounded-2xl flex items-center justify-center text-pastel-pink-600 group-hover:scale-110 transition-transform`}>
                      <BookOpen size={isMobile ? 20 : 28} />
                    </div>
                    <div>
                      <h3 className={`${isMobile ? 'text-base' : 'text-xl'} font-black text-slate-900 mb-0.5 md:mb-1`}>{wb.title}</h3>
                      <p className="text-[10px] md:text-sm text-slate-400 font-medium">{wb.description || '학습을 시작하려면 클릭하세요'}</p>
                    </div>
                  </div>
                  <ChevronRight size={isMobile ? 16 : 24} className="text-slate-300 group-hover:text-pastel-pink-500 transition-colors" />
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <button 
                onClick={() => {
                  setSelectedWordbook(null);
                  setIsFlashcardMode(false);
                }} 
                className="text-sm font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"
              >
                ← 전체 단어장
              </button>
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                <button
                  onClick={() => setPendingMode('flashcard')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all bg-white text-slate-400 border border-slate-100 hover:bg-slate-50`}
                >
                  플래시카드
                </button>
                <button
                  onClick={() => setPendingMode('quiz')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all flex items-center gap-1 md:gap-2 bg-white text-slate-400 border border-slate-100 hover:bg-slate-50`}
                >
                  <CheckCircle2 size={isMobile ? 12 : 14} />
                  객관식
                </button>
                <button
                  onClick={() => setPendingMode('match')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all flex items-center gap-1 md:gap-2 bg-white text-slate-400 border border-slate-100 hover:bg-slate-50`}
                >
                  <Gamepad2 size={isMobile ? 12 : 14} />
                  매치 게임
                </button>
                <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-2 bg-white rounded-full border border-slate-100 shadow-sm">
                  <Trophy size={isMobile ? 12 : 16} className="text-amber-400" />
                  <span className="text-[10px] md:text-xs font-black text-slate-600">{progressPercent}%</span>
                </div>
              </div>
            </div>

            {/* Chunk Selector */}
            <div className={`bg-white ${isMobile ? 'p-4 rounded-2xl' : 'p-6 rounded-[2rem]'} border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 overflow-hidden`}>
              <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
                <span className="text-xs md:text-sm font-bold text-slate-500 whitespace-nowrap">학습 단위:</span>
                <select 
                  value={chunkSize}
                  onChange={(e) => {
                    setChunkSize(Number(e.target.value));
                    setCurrentChunk(0);
                    setCurrentCardIndex(0);
                  }}
                  className="bg-slate-50 border border-slate-100 rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pastel-pink-200"
                >
                  {[10, 20, 30, 40, 47, 50].map(size => (
                    <option key={size} value={size}>{size}개씩</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto pb-2 max-w-full no-scrollbar">
                {Array.from({ length: totalChunks }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentChunk(i);
                      setCurrentCardIndex(0);
                    }}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
                      currentChunk === i 
                        ? 'bg-pastel-pink-100 text-pastel-pink-600 border border-pastel-pink-200' 
                        : 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    Day {i + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className={`bg-white ${isMobile ? 'p-5 rounded-2xl' : 'p-10 rounded-[3rem]'} border border-slate-100 shadow-xl shadow-pastel-pink-200/20`}>
              <div className={`flex items-center gap-3 md:gap-4 ${isMobile ? 'mb-6' : 'mb-8'}`}>
                <div className={`${isMobile ? 'w-10 h-10 text-xl' : 'w-12 h-12 text-2xl'} bg-pastel-pink-100 rounded-xl md:rounded-2xl flex items-center justify-center`}>
                  ✒️
                </div>
                <div>
                  <h2 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-black text-slate-900`}>단어 리스트</h2>
                  <p className="text-[10px] md:text-sm font-bold text-slate-400">Day {currentChunk + 1}의 단어들을 학습합니다.</p>
                </div>
              </div>

              <div className="space-y-3 md:space-y-4">
                {displayedWords.map((word) => (
                  <div 
                    key={word.id} 
                    onClick={() => toggleLearned(word.id)}
                    className={`p-4 md:p-6 rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                      progress[word.id] === 'learned' 
                        ? 'bg-emerald-50 border-emerald-100' 
                        : 'bg-slate-50 border-slate-100 hover:border-pastel-pink-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          speak(word.word);
                        }}
                        className="p-1.5 md:p-2 bg-white rounded-lg text-slate-400 hover:text-pastel-pink-500 transition-colors"
                      >
                        <Volume2 size={isMobile ? 16 : 18} />
                      </button>
                      <div>
                        <div className={`${isMobile ? 'text-base' : 'text-xl'} font-black ${progress[word.id] === 'learned' ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {word.word}
                        </div>
                        <div className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium ${progress[word.id] === 'learned' ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                          {word.meaning}
                        </div>
                      </div>
                    </div>
                    {progress[word.id] === 'learned' && (
                      <CheckCircle2 size={isMobile ? 20 : 24} className="text-emerald-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
