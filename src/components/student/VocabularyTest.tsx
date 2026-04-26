import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, ChevronRight, CheckCircle2, X, Trophy, RotateCcw, Home, GraduationCap, Timer, AlertCircle } from 'lucide-react';
import { auth, recordStudySession, db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { PetService } from '../../lib/petService';

interface Word {
  id: string;
  word: string;
  meaning: string;
  order?: number;
  quizSentence?: string;
  quizChoices?: string[];
  pattern?: string;
  distractors?: string[];
  past?: string;
  pastParticiple?: string;
}

interface TestResult {
  score: number;
  total: number;
  correctCount: number;
  incorrectWords: { word: string; meaning: string; userChoice: string; correctAnswer: string; choices: string[] }[];
  date: string;
}

interface VocabularyTestProps {
  words: Word[];
  dayRange: { start: number; end: number };
  onClose: () => void;
  onNavigateToReport?: () => void;
  wordbookId: string;
  wordbookTitle: string;
  category: 'word' | 'grammar';
  type?: string;
}

type TestPhase = 'intro' | 'info' | 'phase1' | 'phase2' | 'feedback' | 'result';

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export default function VocabularyTest({ words, dayRange, onClose, onNavigateToReport, wordbookId, wordbookTitle, category, type }: VocabularyTestProps) {
  const [phase, setPhase] = useState<TestPhase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [incorrectWords, setIncorrectWords] = useState<TestResult['incorrectWords']>([]);
  const scoreRef = React.useRef(0);
  const incorrectWordsRef = React.useRef<TestResult['incorrectWords']>([]);
  const finishingRef = React.useRef(false);
  const isMovingToNextRef = React.useRef(false);
  const isAnsweringRef = React.useRef(false);
  const currentCorrectAnswerRef = React.useRef<string>('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timer, setTimer] = useState(7); // Phase 1: 7s, Phase 2: 8s
  const [attemptCount, setAttemptCount] = useState(1);
  const [previousRecord, setPreviousRecord] = useState<{ date: string; score: number } | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Constants
  const PHASE1_TIME = 7;
  const PHASE2_TIME = 8;
  const FEEDBACK_TIME = 1.2; // Reduced for snappier experience
  const TARGET_SCORE = 95; 
  const GOAL_SCORE = 90;

  // Initialize test data
  const [shuffledWords, setShuffledWords] = useState<Word[]>([]);
  const [conjugationSteps, setConjugationSteps] = useState<number[]>([]);

  useEffect(() => {
    // Get attempt history and limit
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem('testLimit');
    const rangeKey = `${wordbookId}-${category === 'grammar' ? 'unit' : 'day'}${dayRange.start}-${dayRange.end}`;
    
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        const count = (data.counts && data.counts[rangeKey]) || 0;
        setAttemptCount(count + 1);
      }
    }

    // Previous record
    const fetchPreviousRecord = async () => {
      if (!auth.currentUser || !wordbookId) return;
      try {
        const sessionsRef = collection(db, 'studySessions');
        const q = query(
          sessionsRef,
          where('uid', '==', auth.currentUser.uid),
          where('wordbookId', '==', wordbookId),
          where('type', '==', 'test'),
          where('dayStart', '==', dayRange.start),
          where('dayEnd', '==', dayRange.end),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const snapshot = await getDocs(q).catch(err => {
          // Fallback if index is missing
          if (err.message?.includes('index')) {
            console.warn('Index missing for previous record query, performing client-side sort fallback');
            return getDocs(query(
              sessionsRef, 
              where('uid', '==', auth.currentUser.uid),
              where('wordbookId', '==', wordbookId),
              where('type', '==', 'test'),
              where('dayStart', '==', dayRange.start),
              where('dayEnd', '==', dayRange.end)
            ));
          }
          throw err;
        });

        if (!snapshot.empty) {
          let docs = snapshot.docs;
          if (docs.length > 1) {
            // client side sort if we did the fallback
            docs = [...docs].sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis());
          }
          const data = docs[0].data();
          const date = data.createdAt.toDate();
          setPreviousRecord({
            date: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
            score: Math.round((data.score / data.totalItems) * 100)
          });
        }
      } catch (err) {
        console.error('Failed to fetch previous test record:', err);
      }
    };

    fetchPreviousRecord();
  }, [wordbookId, auth.currentUser?.uid, dayRange.start, dayRange.end, words]); // Added words to dependencies

  const startTest = () => {
    if (words.length === 0) return;

    // Shuffle words ONLY when test starts
    const randomized = [...words].sort(() => Math.random() - 0.5);
    setShuffledWords(randomized);
    
    // Initialize steps for irregular test (randomly 0/1 for each word)
    if (type === 'irregular') {
      setConjugationSteps(randomized.map(() => Math.floor(Math.random() * 2)));
    } else {
      setConjugationSteps([]);
    }

    // Increment attempt in localStorage
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem('testLimit');
    const rangeKey = `${wordbookId}-${category === 'grammar' ? 'unit' : 'day'}${dayRange.start}-${dayRange.end}`;
    let data = stored ? JSON.parse(stored) : { date: today, counts: {} };
    
    if (data.date !== today) {
      data = { date: today, counts: {} };
    }
    
    if (!data.counts) data.counts = {};
    data.counts[rangeKey] = (data.counts[rangeKey] || 0) + 1;
    localStorage.setItem('testLimit', JSON.stringify(data));
    
    setCurrentIndex(0);
    setScore(0);
    scoreRef.current = 0;
    setIncorrectWords([]);
    incorrectWordsRef.current = [];
    finishingRef.current = false;
    isMovingToNextRef.current = false;
    isAnsweringRef.current = false;
    setStartTime(Date.now());
    
    // Set initial phase
    setPhase('phase1');
    setTimer(PHASE1_TIME);
    setSelectedOption(null);
    setIsCorrect(null);
  };

  const generateOptions = useCallback((index: number) => {
    const correctWord = shuffledWords[index];
    if (!correctWord) return;
    
    const isIrregular = type === 'irregular';
    const isToIngGrammar = type === 'to-ing-grammar';
    const isComplementGrammar = type === 'complement-grammar';
    const isConversionGrammar = type === 'conversion-grammar';
    const isModalGrammar = type === 'modal-grammar';
    const isRelativeGrammar = type === 'relative-grammar' || wordbookTitle.includes('관계부사');
    
    let correctOption: string;
    let otherOptions: string[];

    if (isRelativeGrammar && correctWord.quizChoices) {
      correctOption = correctWord.quizChoices[0];
      otherOptions = correctWord.quizChoices.slice(1);
    } else if (isConversionGrammar) {
      const allLabels = ['동사 O to + 간접목적어', '동사 O for + 간접목적어', '동사 O of + 간접목적어', '3형식 전환 불가'];
      const getLabelFromPattern = (p: string) => {
        if (p === 'to') return '동사 O to + 간접목적어';
        if (p === 'for') return '동사 O for + 간접목적어';
        if (p === 'of') return '동사 O of + 간접목적어';
        if (p === 'impossible') return '3형식 전환 불가';
        return p || '';
      };
      correctOption = getLabelFromPattern(correctWord.pattern || '');
      otherOptions = allLabels.filter(l => l !== correctOption);
    } else if (isComplementGrammar) {
      const verb = correctWord.word;
      correctOption = correctWord.distractors?.[0] || '';
      const standardDistractors = [`${verb} O 명사/형용사`, `${verb} O to V`, `${verb} O 동사원형`, `${verb} O V-ing`];
      otherOptions = standardDistractors.filter(d => d !== correctOption);
    } else if (isToIngGrammar) {
      const allPatterns = ['to부정사만 목적어로 오는 동사', '동명사만 목적어로 오는 동사', '둘다 목적어로 오고 의미도 같은 동사', '둘다 오지만 의미는 다른 동사'];
      const word = correctWord.word;
      const getLabel = (p: string) => {
        if (p === 'to부정사만 목적어로 오는 동사') return `${word} to V`;
        if (p === '동명사만 목적어로 오는 동사') return `${word} Ving`;
        if (p === '둘다 목적어로 오고 의미도 같은 동사') return `둘 다 가능하고 의미도 같음`;
        if (p === '둘다 오지만 의미는 다른 동사') return `둘 다 가능하고 의미 달라짐`;
        return p || '';
      };
      correctOption = getLabel(correctWord.pattern || '');
      otherOptions = allPatterns.filter(p => p !== (correctWord.pattern || '')).map(getLabel);
    } else if (isIrregular) {
      const step = conjugationSteps[index] || 0;
      correctOption = step === 0 ? (correctWord.past || '') : (correctWord.pastParticiple || '');
      
      const distractorsSet = new Set<string>();
      
      // 1. Word-specific distractors (HIGHEST PRIORITY)
      const teacherDistractors = Array.isArray(correctWord.distractors) 
        ? correctWord.distractors 
        : (typeof correctWord.distractors === 'string' 
            ? (correctWord.distractors as string).split(',').map(s => s.trim()).filter(Boolean)
            : []);
            
      if (teacherDistractors.length > 0) {
        shuffleArray<string>(teacherDistractors).forEach(d => {
          if (distractorsSet.size < 10) distractorsSet.add(d);
        });
      }
      
      // 2. Same word different forms
      const otherForm = step === 0 ? correctWord.pastParticiple : correctWord.past;
      if (otherForm && otherForm !== correctOption) distractorsSet.add(otherForm);
      if (correctWord.word && correctWord.word !== correctOption) distractorsSet.add(correctWord.word);
      
      // 3. Same pattern words
      if (correctWord.pattern) {
        const samePatternWords = shuffledWords.filter(w => w.id !== correctWord.id && w.pattern === correctWord.pattern);
        shuffleArray<Word>(samePatternWords).forEach(w => {
          const f = step === 0 ? w.past : w.pastParticiple;
          if (f && f !== correctOption) distractorsSet.add(f);
        });
      }

      // 4. Other irregular verbs
      const otherWords = shuffledWords.filter(w => w.id !== correctWord.id);
      const otherForms: string[] = otherWords
        .map(w => step === 0 ? w.past : w.pastParticiple)
        .filter((f): f is string => !!f && f !== correctOption);
      
      shuffleArray<string>([...new Set(otherForms)]).forEach(f => {
        if (distractorsSet.size < 20) distractorsSet.add(f);
      });

      otherOptions = Array.from(distractorsSet).filter(o => o !== correctOption);
    } else {
      correctOption = correctWord.meaning;
      otherOptions = shuffledWords.filter(w => w.id !== correctWord.id).map(w => w.meaning);
    }
    
    const optionCount = category === 'grammar' ? 4 : 6;
    // otherOptions is already prioritized since it comes from a Set populated in priority order
    const selectedDistractors = otherOptions.slice(0, optionCount - 1);
    const allOptions = shuffleArray([correctOption, ...selectedDistractors]);
    currentCorrectAnswerRef.current = correctOption;
    setOptions(allOptions);
  }, [shuffledWords, type, wordbookTitle, conjugationSteps]);

  const startPhase1 = useCallback(() => {
    if (shuffledWords.length === 0) return;
    setPhase('phase1');
    setTimer(PHASE1_TIME);
    setSelectedOption(null);
    setIsCorrect(null);
  }, [shuffledWords.length]);

  const startPhase2 = useCallback(() => {
    if (shuffledWords.length === 0) return;
    generateOptions(currentIndex);
    setPhase('phase2');
    setTimer(PHASE2_TIME);
  }, [shuffledWords, currentIndex, generateOptions]);

  const finishTest = useCallback(async () => {
    // Guard against multiple calls
    if (finishingRef.current || phase === 'result') return; 
    finishingRef.current = true;
    
    // Copy the latest values to local variables to ensure they don't change
    const finalScoreValue = scoreRef.current;
    const finalIncorrectWords = [...incorrectWordsRef.current];
    const totalCount = shuffledWords.length;
    
    // Transition to result phase IMMEDIATELY
    setPhase('result');
    
    // Make sure state is synced for the UI
    setScore(finalScoreValue);
    setIncorrectWords(finalIncorrectWords);
    
    const finalScorePercent = Math.round((finalScoreValue / Math.max(1, totalCount)) * 100);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    // Record to Firebase
    if (auth.currentUser) {
      try {
        const points = finalScoreValue * 10; 
        const xp = finalScoreValue * 20;
        
        PetService.addPoints(points, auth.currentUser.uid);
        PetService.addXP(xp, auth.currentUser.uid);

        await recordStudySession({
          uid: auth.currentUser.uid,
          wordbookId,
          wordbookTitle,
          type: 'test',
          category: category as 'word' | 'grammar',
          duration,
          score: finalScoreValue,
          totalItems: totalCount,
          incorrectAnswers: finalIncorrectWords,
          dayStart: dayRange.start,
          dayEnd: dayRange.end
        });
      } catch (err) {
        console.error('Failed to finish test session:', err);
      }
    }

    // Update previous record locally
    const now = new Date();
    setPreviousRecord({
      date: `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      score: finalScorePercent
    });
  }, [phase, shuffledWords.length, startTime, wordbookId, wordbookTitle, category, dayRange.start, dayRange.end]);

  const goToNextQuestion = useCallback(() => {
    // Safety guard
    if (phase !== 'feedback' || isMovingToNextRef.current) return;
    
    if (currentIndex < shuffledWords.length - 1) {
      isMovingToNextRef.current = true;
      setCurrentIndex(prev => prev + 1);
      setPhase('phase1');
      setTimer(PHASE1_TIME);
      setSelectedOption(null);
      setIsCorrect(null);
      isAnsweringRef.current = false;
      // Reset the lock in the next tick after phase change
      setTimeout(() => { isMovingToNextRef.current = false; }, 100);
    } else {
      finishTest();
    }
  }, [phase, currentIndex, shuffledWords.length, finishTest]);

  const handleAnswer = useCallback((optionIndex: number) => {
    if (phase !== 'phase2' || selectedOption !== null || isAnsweringRef.current) return;
    isAnsweringRef.current = true;
    
    const correctWord = shuffledWords[currentIndex];
    if (!correctWord) return;

    setSelectedOption(optionIndex);
    
    const isIrregular = type === 'irregular';
    const isToIngGrammar = type === 'to-ing-grammar';
    const isComplementGrammar = type === 'complement-grammar';
    const isConversionGrammar = type === 'conversion-grammar';
    const isModalGrammar = type === 'modal-grammar';
    const isRelativeGrammar = type === 'relative-grammar' || wordbookTitle.includes('관계부사');
    
    const correctAnswer = currentCorrectAnswerRef.current;
    const userAnswer = optionIndex === -1 ? '시간 초과' : options[optionIndex];
    const correct = userAnswer === correctAnswer || (isRelativeGrammar && (
      (correctAnswer === 'how' && userAnswer === 'the way') ||
      (correctAnswer === 'the way' && userAnswer === 'how')
    ));
    
    setIsCorrect(correct);
    if (correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    } else {
      const newIncorrect = {
        word: correctWord.quizSentence || correctWord.word,
        meaning: correctAnswer,
        userChoice: userAnswer,
        correctAnswer: correctAnswer,
        choices: [...options]
      };
      incorrectWordsRef.current = [...incorrectWordsRef.current, newIncorrect];
      setIncorrectWords(incorrectWordsRef.current);
    }
    
    setPhase('feedback');
    setTimer(FEEDBACK_TIME);
  }, [phase, selectedOption, currentIndex, shuffledWords, options, type, wordbookTitle]);

  const handleTimeout = useCallback(() => {
    if (phase === 'phase1') {
      startPhase2();
    } else if (phase === 'phase2') {
      handleAnswer(-1); // Timeout is incorrect
    }
  }, [phase, startPhase2, handleAnswer]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (phase === 'phase1' || phase === 'phase2') {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 0.1) {
            handleTimeout();
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    } else if (phase === 'feedback') {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 0.1) {
            goToNextQuestion();
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [phase, currentIndex, shuffledWords.length, goToNextQuestion, handleTimeout]); // Added length to dependencies to refresh on shuffle

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (phase === 'phase1' && e.code === 'Space') {
        startPhase2();
      } else if (phase === 'phase2' && selectedOption === null) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 6) {
          handleAnswer(num - 1);
        }
      } else if (phase === 'feedback' && e.code === 'Space') {
        goToNextQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, currentIndex, selectedOption, goToNextQuestion, handleAnswer, startPhase2]);

  const percentage = Math.max(0, Math.round((score / Math.max(1, shuffledWords.length)) * 100));
  const isGoalAchieved = percentage >= 90;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1E1E2E] overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        
        {/* Phase: Intro */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl p-6 md:p-12 relative overflow-hidden mx-4"
          >
            <div className="flex items-center gap-3 mb-6 md:mb-10">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-[#FF6B9D] rounded-full flex items-center justify-center text-white">
                <GraduationCap size={20} className="md:w-6 md:h-6" />
              </div>
              <span className="text-lg md:text-xl font-bold text-slate-600">지원T 출제</span>
            </div>

            <div className="text-center py-6 md:py-10">
              <h1 className="text-5xl md:text-8xl font-black mb-6 md:mb-8">
                <span className="text-[#C084FC]">{attemptCount}차</span>
                <span className="text-[#FF6B9D] ml-2 md:ml-4">테스트</span>
              </h1>
              
              {previousRecord && (
                <div className="flex items-center justify-center gap-2 md:gap-4 text-slate-400 font-bold text-base md:text-xl mb-8 md:mb-12">
                  <CheckCircle2 className="text-[#FF6B9D]" size={20} />
                  <span>{previousRecord.date}</span>
                  <span className="ml-1 md:ml-2">{previousRecord.score}점</span>
                </div>
              )}

              <p className="text-lg md:text-2xl font-bold text-slate-800 mb-8 md:mb-10">
                3번의 응시기회 중 {attemptCount}번째 도전입니다.
              </p>

              <button
                onClick={() => setPhase('info')}
                className="w-full max-w-md py-4 md:py-6 bg-[#FF6B9D] text-white text-xl md:text-3xl font-black rounded-xl shadow-xl shadow-pink-100 hover:scale-[1.02] transition-transform"
              >
                다음
              </button>
            </div>
          </motion.div>
        )}

        {/* Phase: Info */}
        {phase === 'info' && (
          <motion.div
            key="info"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-4xl bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-12 text-[#F8F0F5] border border-white/10 mx-4 overflow-y-auto max-h-[90vh]"
          >
            <div className="space-y-4 md:space-y-6 text-lg md:text-2xl font-bold mb-8 md:mb-12">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-20">
                <span className="sm:w-32 text-slate-400 text-sm md:text-2xl">출제</span>
                <span className="text-[#F8F0F5]">지원T</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-20">
                <span className="sm:w-32 text-slate-400 text-sm md:text-2xl">문항수</span>
                <span className="text-[#FF6B9D]">객관식 {words.length}문항</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-20">
                <span className="sm:w-32 text-slate-400 text-sm md:text-2xl">제한시간</span>
                <span className="text-[#FF6B9D]">7초</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-20">
                <span className="sm:w-32 text-slate-400 text-sm md:text-2xl">목표점수</span>
                <span className="text-[#FF6B9D]">{GOAL_SCORE}점</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-20">
                <span className="sm:w-32 text-slate-400 text-sm md:text-2xl">응시횟수 제한</span>
                <span className="text-[#FF6B9D]">최대 3회</span>
              </div>
            </div>

            <div className="bg-[#1E1E2E]/80 border border-[#FF6B9D]/30 rounded-xl p-4 md:p-8 mb-8 md:mb-12">
              <ol className="text-base md:text-xl text-[#FF6B9D] space-y-2 md:space-y-4 font-bold">
                <li>1. 제시어를 보고 미리 답을 생각하세요. 정답 입력 시간이 아주 짧아요.</li>
                <li>2. 도중에 중단해도 자동 제출 됩니다.</li>
              </ol>
            </div>

            <div className="flex justify-center">
              <button
                onClick={startTest}
                className="w-full max-w-md py-4 md:py-6 bg-[#FF6B9D] text-white text-xl md:text-3xl font-black rounded-xl shadow-xl shadow-pink-900/40 hover:scale-[1.02] transition-transform"
              >
                테스트 시작
              </button>
            </div>
          </motion.div>
        )}

        {/* Phase: Phase 1 */}
        {phase === 'phase1' && (
          <motion.div
            key="phase1"
            className="flex flex-col items-center gap-4 md:gap-8 w-full max-w-4xl px-4"
          >
            <h2 className="text-2xl md:text-4xl font-bold text-slate-400 mb-2 md:mb-4">
              <span className="text-[#C084FC] text-3xl md:text-5xl">{currentIndex + 1}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-600 text-3xl md:text-5xl">{shuffledWords.length}</span>
            </h2>

            <div 
              onClick={startPhase2}
              className="w-full bg-white rounded-2xl shadow-2xl p-8 md:p-24 relative flex items-center justify-center min-h-[250px] md:min-h-[400px] cursor-pointer"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (shuffledWords[currentIndex]) {
                    speak(shuffledWords[currentIndex].word);
                  }
                }}
                className="absolute top-4 left-4 md:top-8 md:left-8 p-2 md:p-3 text-[#C084FC] hover:text-[#FF6B9D] transition-colors z-10"
                id="pronounce-btn"
              >
                <Volume2 size={24} className="md:w-10 md:h-10" />
              </button>

              <h1 className="text-4xl md:text-8xl font-black text-slate-800 tracking-tight text-center break-words px-4">
                {shuffledWords[currentIndex]?.quizSentence || shuffledWords[currentIndex]?.word || ''}
              </h1>

              {type === 'irregular' && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center md:bottom-8">
                  <span className="px-4 py-1.5 md:px-6 md:py-2 bg-[#FF6B9D] text-white rounded-full text-sm md:text-xl font-black shadow-lg animate-bounce">
                    {conjugationSteps[currentIndex] === 0 ? "과거형(Past)을 생각하세요!" : "과거분사(P.P)를 생각하세요!"}
                  </span>
                </div>
              )}
            </div>

            <div className="w-full max-w-2xl text-center space-y-4 md:space-y-6">
              <div className="w-full h-2 md:h-3 bg-[#1E1E2E]/50 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  className="h-full bg-[#FF6B9D]"
                  initial={{ width: '100%' }}
                  animate={{ width: 0 }}
                  transition={{ duration: PHASE1_TIME, ease: "linear" }}
                />
              </div>
              <p className="text-slate-400 text-base md:text-xl font-bold">
                {window.innerWidth > 768 ? '정답을 생각한 후 시작하세요 (스페이스 키)' : '화면을 터치하면 바로 시작합니다'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Phase: Phase 2 */}
        {(phase === 'phase2' || phase === 'feedback') && (
          <motion.div
            key="phase2"
            className="flex flex-col items-center gap-4 md:gap-8 w-full max-w-5xl px-4 overflow-y-auto max-h-screen py-8"
          >
            <h2 className="text-2xl md:text-4xl font-bold text-slate-400 mb-2 md:mb-4">
              <span className="text-[#C084FC] text-3xl md:text-5xl">{currentIndex + 1}</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-600 text-3xl md:text-5xl">{shuffledWords.length}</span>
            </h2>

            <div className="text-center mb-2 md:mb-4">
              <h1 className="text-3xl md:text-6xl font-black text-white mb-2">
                {shuffledWords[currentIndex]?.word || ''}
              </h1>
              {type === 'irregular' && (
                <span className="inline-block px-4 py-1 bg-[#FF6B9D] text-white rounded-full text-sm md:text-xl font-bold">
                  {conjugationSteps[currentIndex] === 0 ? "과거형(Past) 선택" : "과거분사(P.P) 선택"}
                </span>
              )}
            </div>

            <div className="w-full bg-white/5 rounded-3xl p-4 md:p-8 border border-white/10 backdrop-blur-md">
              <div className={`grid grid-cols-1 ${options.length > 4 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-3 md:gap-6`}>
                {options.map((option, idx) => {
                  const isCorrectAnswer = option === currentCorrectAnswerRef.current;
                  const isSelected = selectedOption === idx;
                  
                  let bgColor = "bg-white/10";
                  let textColor = "text-[#F8F0F5]";
                  let borderColor = "border-white/10";

                  if (phase === 'feedback') {
                    if (isCorrectAnswer) {
                      bgColor = "bg-[#FF6B9D]";
                      textColor = "text-white";
                      borderColor = "border-[#FF6B9D]";
                    } else if (isSelected && !isCorrect) {
                      bgColor = "bg-[#FF4D4D]";
                      textColor = "text-white";
                      borderColor = "border-[#FF4D4D]";
                    } else {
                      bgColor = "bg-white/5";
                      textColor = "text-white/30";
                      borderColor = "border-white/5";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswer(idx)}
                      disabled={phase === 'feedback'}
                      className={`relative p-4 md:p-8 rounded-2xl flex items-center justify-center text-center transition-all min-h-[80px] md:min-h-[140px] border-2 group ${bgColor} ${textColor} ${borderColor} ${phase === 'phase2' ? 'hover:scale-[1.02] hover:bg-white/20 active:scale-[0.98]' : ''}`}
                    >
                      <span className={`absolute top-2 left-3 md:top-4 md:left-6 text-[10px] md:text-sm font-black transition-colors ${phase === 'feedback' ? 'text-white/50' : 'text-[#C084FC]'}`}>
                        {idx + 1}
                      </span>
                      <span className={`${option.length > 20 ? 'text-base md:text-xl' : 'text-xl md:text-3xl'} font-black leading-snug`}>
                        {option}
                      </span>
                      
                      {phase === 'feedback' && isCorrectAnswer && (
                        <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-white text-[#FF6B9D] px-2 md:px-3 py-1 rounded-full text-[8px] md:text-xs font-black animate-bounce">
                          정답
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div 
              onClick={() => { if (phase === 'feedback') goToNextQuestion(); }}
              className={`w-full max-w-2xl text-center space-y-4 md:space-y-6 ${phase === 'feedback' ? 'cursor-pointer' : ''}`}
            >
              <div className="w-full h-2 md:h-3 bg-[#1E1E2E]/50 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  className="h-full bg-[#FF6B9D]"
                  initial={{ width: "100%" }}
                  animate={{ width: 0 }}
                  transition={{ duration: phase === 'feedback' ? FEEDBACK_TIME : PHASE2_TIME, ease: "linear" }}
                />
              </div>
              <p className="text-slate-400 text-sm md:text-xl font-bold">
                {phase === 'phase2' ? "정답 버튼을 선택하세요." : (window.innerWidth > 768 ? "잠시 후 다음 문항으로 넘어갑니다 (스페이스 키)" : "터치하면 바로 넘어갑니다")}
              </p>
            </div>
          </motion.div>
        )}

        {/* Phase: Result */}
        {phase === 'result' && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl bg-[#F8F0F5] rounded-3xl md:rounded-[3rem] p-6 md:p-12 text-center mx-4 overflow-y-auto max-h-[90vh]"
          >
            <div className={`w-16 h-16 md:w-24 md:h-24 mx-auto rounded-full flex items-center justify-center mb-6 md:mb-8 ${isGoalAchieved ? 'bg-pink-100 text-[#FF6B9D]' : 'bg-slate-200 text-slate-500'}`}>
              <Trophy size={window.innerWidth > 768 ? 48 : 32} />
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-2 md:mb-4">테스트 결과</h2>
            <div className="flex flex-col items-center gap-1 md:gap-2 mb-8 md:mb-10">
              <div className="text-6xl md:text-8xl font-black text-[#FF6B9D]">{percentage}점</div>
              <div className="text-lg md:text-2xl font-bold text-slate-400">{score} / {shuffledWords.length} 문항</div>
              {isGoalAchieved ? (
                <div className="mt-2 md:mt-4 px-4 md:px-6 py-2 bg-[#FF6B9D] text-white rounded-full font-black text-base md:text-xl animate-pulse">
                  축하드려요! 목표 달성! 🎉
                </div>
              ) : (
                <div className="mt-2 md:mt-4 px-4 md:px-6 py-2 bg-slate-200 text-slate-500 rounded-full font-black text-base md:text-xl">
                  아쉽게 목표에 도달하지 못했어요.
                </div>
              )}
            </div>

            {incorrectWords.length > 0 && (
              <div className="text-left mb-8 md:mb-10 border-t border-slate-200 pt-8 md:pt-10">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-4 md:mb-6 flex items-center gap-2">
                  <AlertCircle className="text-[#FF4D4D]" size={20} />
                  오답 목록 ({incorrectWords.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-h-[250px] md:max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                  {incorrectWords.map((item, idx) => (
                    <div key={idx} className="p-3 md:p-4 bg-white rounded-xl md:rounded-2xl border border-slate-100 shadow-sm">
                      <div className="text-lg md:text-xl font-black text-slate-800">{item.word}</div>
                      <div className="text-xs md:text-sm font-bold text-[#FF6B9D]">{item.correctAnswer}</div>
                      <div className="mt-1 md:mt-2 text-[10px] md:text-xs font-bold text-[#FF4D4D]">내 답변: {item.userChoice}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  if (onNavigateToReport) {
                    onNavigateToReport();
                  } else {
                    onClose();
                  }
                }}
                className="w-full py-4 md:py-6 bg-slate-200 text-slate-600 rounded-xl md:rounded-3xl font-black text-base md:text-lg hover:bg-slate-300 transition-colors"
              >
                오답 복습하러 가기
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setPhase('intro');
                  }}
                  className="py-4 md:py-6 bg-[#C084FC] text-white rounded-xl md:rounded-3xl font-black text-base md:text-lg shadow-xl shadow-purple-100 hover:scale-105 transition-transform"
                >
                  다시 도전
                </button>
                <button
                  onClick={onClose}
                  className="py-4 md:py-6 bg-[#1E1E2E] text-[#F8F0F5] rounded-xl md:rounded-3xl font-black text-base md:text-lg hover:bg-black transition-colors"
                >
                  단어장으로
                </button>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Exit Button */}
      {phase !== 'result' && (
        <button
          onClick={onClose}
          className="fixed top-8 right-8 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
        >
          <X size={24} />
        </button>
      )}
    </div>
  );
}
