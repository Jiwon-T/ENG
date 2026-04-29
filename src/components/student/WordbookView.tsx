import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import VocabularyTest from './VocabularyTest';
import { BookOpen, CheckCircle2, Circle, ChevronRight, Sparkles, Trophy, Volume2, RotateCcw, ChevronLeft, Gamepad2, Timer, X, Info, GraduationCap, AlertCircle } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType, recordStudySession } from '../../lib/firebase';
import { PetService } from '../../lib/petService';
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp, getDocs, orderBy, limit, addDoc, getDoc } from 'firebase/firestore';

interface Wordbook {
  id: string;
  title: string;
  description: string;
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
  // Temp fields for relative-grammar quiz
  quizSentence?: string; 
  quizExplanation?: string;
  quizChoices?: string[];
}

interface Progress {
  [wordId: string]: 'learned' | 'mastered' | 'unlearned';
}

import { COMPLEMENT_QUIZ_DATA, GrammarWord } from '../../lib/grammarSets';
import { MODAL_QUIZ_POOL } from '../../lib/modalQuizPool';
import { VERB_FORM_QUIZ_POOL } from '../../lib/verbFormQuizPool';

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export default function WordbookView({ isMobile, category = 'word', onNavigate }: { isMobile?: boolean; category?: 'word' | 'grammar'; onNavigate?: (view: any) => void }) {
  const [wordbooks, setWordbooks] = useState<Wordbook[]>([]);
  const [selectedWordbook, setSelectedWordbook] = useState<Wordbook | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [loading, setLoading] = useState(true);
  
  // Chunking states (Days)
  const [currentChunk, setCurrentChunk] = useState(0);

  // Learning Unit Size for sessions
  const [sessionUnitSize, setSessionUnitSize] = useState(10);

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

  // Conjugation Challenge states
  const [isConjugationMode, setIsConjugationMode] = useState(false);
  const [conjugationIndex, setConjugationIndex] = useState(0);
  const [conjugationStep, setConjugationStep] = useState<0 | 1>(0); // 0: Past, 1: Participle
  const [conjugationOptions, setConjugationOptions] = useState<string[]>([]);
  const [conjugationScore, setConjugationScore] = useState(0);
  const [isConjugationFinished, setIsConjugationFinished] = useState(false);
  const [sessionWords, setSessionWords] = useState<Word[]>([]);

  // Focus & Confirm states
  const [pendingMode, setPendingMode] = useState<'flashcard' | 'quiz' | 'match' | 'conjugation' | 'test' | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [testRange, setTestRange] = useState({ start: 1, end: 1 });
  const [testWords, setTestWords] = useState<Word[]>([]);
  const [isFocusedMode, setIsFocusedMode] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [earnedXP, setEarnedXP] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [incorrectAnswers, setIncorrectAnswers] = useState<{ word: string; meaning: string; userChoice: string; correctAnswer: string; choices?: string[]; quizSentence?: string }[]>([]);

  const finishSession = (type: 'quiz' | 'flashcard' | 'match' | 'conjugation', score?: number, total?: number, overrideIncorrectAnswers?: any[]) => {
    if (!sessionStartTime || !auth.currentUser || !selectedWordbook) return;
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    if (duration < 1) return; // Ignore very short sessions (less than 1s)

    // Calculate rewards
    let points = 0;
    let xp = 0;
    const finalIncorrectAnswers = overrideIncorrectAnswers || incorrectAnswers;

    if (type === 'quiz' || type === 'conjugation') {
      points = (score || 0) * 5;
      xp = (score || 0) * 10;
    } else if (type === 'match') {
      points = sessionWords.length * 5;
      xp = sessionWords.length * 10;
    } else if (type === 'flashcard') {
      // Flashcards: give half reward?
      points = sessionWords.length * 2;
      xp = sessionWords.length * 5;
    }
    
    setEarnedPoints(points);
    setEarnedXP(xp);
    if (points > 0) {
      const newState = PetService.addPoints(points, auth.currentUser.uid);
      setTotalPoints(newState.points);
    } else {
      setTotalPoints(PetService.getState(auth.currentUser.uid).points);
    }
    if (xp > 0) PetService.addXP(xp, auth.currentUser.uid);

    recordStudySession({
      uid: auth.currentUser.uid,
      wordbookId: selectedWordbook.id,
      wordbookTitle: selectedWordbook.title,
      type,
      category: category as 'word' | 'grammar',
      duration,
      score,
      totalItems: total,
      incorrectAnswers: (type === 'quiz' || type === 'conjugation' || type === 'match') ? finalIncorrectAnswers : undefined
    });
    setSessionStartTime(null);
    setIncorrectAnswers([]);
  };

  const isGrammar = selectedWordbook?.category === 'grammar' || selectedWordbook?.type === 'irregular';
  const daySize = isGrammar ? 10 : (selectedWordbook?.defaultUnitSize || 47);
  let totalChunks: number = Math.ceil(words.length / daySize);
  let displayedWords: Word[] = words.slice(currentChunk * daySize, (currentChunk + 1) * daySize);

  if (selectedWordbook?.type === 'relative-grammar') {
    // For relative-grammar, we only show concepts in the list, hiding sentences with blanks
    const conceptsOnly: Word[] = words.filter(w => !w.word.includes('(___)'));
    totalChunks = Math.ceil(conceptsOnly.length / daySize);
    displayedWords = conceptsOnly.slice(currentChunk * daySize, (currentChunk + 1) * daySize);
  } else if (selectedWordbook?.type === 'complement-grammar') {
    if (daySize >= 26 && !isGrammar) { // isGrammar = true for grammar, but complement-grammar had special 3 day logic
      totalChunks = 1;
      displayedWords = words; 
    } else if (!isGrammar) {
      totalChunks = 3;
      if (currentChunk === 0) displayedWords = words.slice(0, 7);
      else if (currentChunk === 1) displayedWords = words.slice(7, 17);
      else displayedWords = words.slice(17, 26);
    }
  } else if (selectedWordbook?.type === 'modal-grammar') {
    totalChunks = 6;
    // Boundaries: 14, 21, 30, 37, 42, 48
    if (currentChunk === 0) displayedWords = words.slice(0, 14);
    else if (currentChunk === 1) displayedWords = words.slice(14, 21);
    else if (currentChunk === 2) displayedWords = words.slice(21, 30);
    else if (currentChunk === 3) displayedWords = words.slice(30, 37);
    else if (currentChunk === 4) displayedWords = words.slice(37, 42);
    else displayedWords = words.slice(42, 48);
  } else if (selectedWordbook?.type === 'verb-form-grammar') {
    totalChunks = 5;
    displayedWords = words.filter(w => (w as any).set === currentChunk + 1);
  }

  useEffect(() => {
    const q = query(collection(db, 'wordbooks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWordbooks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Wordbook));
      
      // Filter by category
      const filtered = fetchedWordbooks.filter(wb => {
        // Default to 'word' if no category set
        const wbCategory = wb.category || 'word';
        // Special case: Irregular verbs are grammar
        if (wb.type === 'irregular') return category === 'grammar';
        return wbCategory === category;
      });

      // Sort by order to match teacher's arrangement
      filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      setWordbooks(filtered);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [category]);

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
    
    // Set session unit size from wordbook settings, but keep Day tabs separate
    if (selectedWordbook.defaultUnitSize) {
      setSessionUnitSize(selectedWordbook.defaultUnitSize);
    } else {
      setSessionUnitSize(10);
    }
    
    setLoading(true);
    const q = query(collection(db, `wordbooks/${selectedWordbook.id}/words`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedWords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Word));
      // Sort by order if available
      fetchedWords.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setWords(fetchedWords);
      setLoading(false);
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
    if (words.length === 0) return;
    
    // Use only words from the current Day/Set
    const shuffledPool = shuffleArray(displayedWords);
    const selectedSessionWords = shuffledPool.slice(0, sessionUnitSize);
    setSessionWords(selectedSessionWords);

    const cards: any[] = [];
    selectedSessionWords.forEach((w: Word) => {
      cards.push({ id: `${w.id}_word`, content: w.word, type: 'word', matched: false, wordId: w.id });
      cards.push({ id: `${w.id}_meaning`, content: w.meaning, type: 'meaning', matched: false, wordId: w.id });
    });

    setMatchCards(shuffleArray(cards));
    setSelectedMatchCard(null);
    setMatchStartTime(Date.now());
    setSessionStartTime(Date.now());
    setMatchTime(0);
    setIsMatchFinished(false);
    setIsMatchMode(true);
    setIsFlashcardMode(false);
    setIsQuizMode(false);
    setIsFocusedMode(true);
  };

  const startQuiz = async () => {
    if (words.length === 0) return;
    setIncorrectAnswers([]);

    const isRelativeGrammar = selectedWordbook?.type === 'relative-grammar' || 
                              selectedWordbook?.title?.includes('관계부사') ||
                              selectedWordbook?.title?.includes('that');
    
    if (isRelativeGrammar || selectedWordbook?.type === 'verb-form-grammar') {
      // Collect all available examples from all concepts
      // For verb-form-grammar, the user wants ALL sets mixed randomly
      // For relative-grammar, it traditionally used displayedWords (chunk-specific)
      let allPotentialExamples: Word[] = [];
      const concepts = selectedWordbook?.type === 'verb-form-grammar' ? words : displayedWords;
      
      const exampleFetches = concepts.map(async (concept) => {
        const examplesRef = collection(db, `wordbooks/${selectedWordbook.id}/words/${concept.id}/examples`);
        const snapshot = await getDocs(examplesRef);
        
        return snapshot.docs.map(doc => {
          const exampleData = doc.data();
          // The first choice is the answer in the managed examples (choices field)
          const choices = exampleData.choices || [];
          return {
            ...concept,
            id: `${concept.id}_${doc.id}`,
            quizSentence: exampleData.sentence,
            quizExplanation: exampleData.explanation,
            quizChoices: choices,
            meaning: choices[0], // First one is correct answer
            quizCategory: 'grammar'
          } as Word;
        });
      });

      const fetchResults = await Promise.all(exampleFetches);
      allPotentialExamples = fetchResults.flat();

      if (allPotentialExamples.length === 0) {
        alert('객관식 학습을 위해서는 최소한의 예문이 필요합니다. 선생님방에서 예문을 등록해주세요.');
        return;
      }

      // Final pool: pick from entire set but limit by sessionUnitSize
      const shuffled = shuffleArray(allPotentialExamples);
      const selectedSessionWords = shuffled.slice(0, sessionUnitSize);
      
      setSessionWords(selectedSessionWords);
      setQuizIndex(0);
      setQuizScore(0);
      setIsQuizFinished(false);
      setIsQuizMode(true);
      setIsMatchMode(false);
      setIsFlashcardMode(false);
      setIsFocusedMode(true);
      setSessionStartTime(Date.now());
      generateQuizOptions(0, selectedSessionWords);
    } else if (selectedWordbook?.type === 'modal-grammar') {
      // Filter quiz pool by current set (currentChunk + 1)
      const currentSet = currentChunk + 1;
      const setQuizPool = MODAL_QUIZ_POOL.filter(q => q.set === currentSet);
      
      if (setQuizPool.length === 0) {
        alert('이 세트에는 퀴즈 데이터가 없습니다.');
        return;
      }

      // Format quiz pool into Word interface for consistency
      const quizWords: Word[] = setQuizPool.map(q => ({
        id: `modal_quiz_${q.id}`,
        word: q.sentence, // We'll display sentence in front
        meaning: q.choices[q.answer], // Set correct meaning for match logic
        quizSentence: q.sentence,
        quizExplanation: q.explanation,
        quizChoices: q.choices,
        quizCategory: 'grammar'
      } as any));

      const shuffled = shuffleArray(quizWords);
      const selectedSessionWords = shuffled.slice(0, sessionUnitSize);

      setSessionWords(selectedSessionWords);
      setQuizIndex(0);
      setQuizScore(0);
      setIsQuizFinished(false);
      setIsQuizMode(true);
      setIsMatchMode(false);
      setIsFlashcardMode(false);
      setIsFocusedMode(true);
      setSessionStartTime(Date.now());
      generateQuizOptions(0, selectedSessionWords);
    } else {
      // Normal Wordbook: Pick sessionUnitSize random words from the CURRENT Day/Set
      const shuffledPool = shuffleArray(displayedWords);
      const selectedSessionWords = shuffledPool.slice(0, sessionUnitSize);
      
      setSessionWords(selectedSessionWords);
      setIsQuizMode(true);
      setIsMatchMode(false);
      setIsFlashcardMode(false);
      setQuizIndex(0);
      setQuizScore(0);
      setSessionStartTime(Date.now());
      setIsQuizFinished(false);
      generateQuizOptions(0, selectedSessionWords);
      setIsFocusedMode(true);
    }
  };

  const startFlashcards = () => {
    if (words.length === 0) return;
    setIncorrectAnswers([]);
    
    // Use only words from the current Day/Set
    const shuffledPool = shuffleArray(displayedWords);
    const selectedSessionWords = shuffledPool.slice(0, sessionUnitSize);
    setSessionWords(selectedSessionWords);
    
    setIsFlashcardMode(true);
    setIsMatchMode(false);
    setIsQuizMode(false);
    setIsConjugationMode(false);
    setCurrentCardIndex(0);
    setSessionStartTime(Date.now());
    setIsFlipped(false);
    setIsFocusedMode(true);
  };

  const startConjugationChallenge = () => {
    if (words.length === 0) return;
    setIncorrectAnswers([]);
    
    // Use only words from the current Day/Set
    const shuffledPool = shuffleArray(displayedWords);
    const selectedSessionWords = shuffledPool.slice(0, sessionUnitSize);
    setSessionWords(selectedSessionWords);
    
    setIsConjugationMode(true);
    setIsQuizMode(false);
    setIsMatchMode(false);
    setIsFlashcardMode(false);
    setConjugationIndex(0);
    setConjugationStep(0);
    setConjugationScore(0);
    setSessionStartTime(Date.now());
    setIsConjugationFinished(false);
    generateConjugationOptions(0, 0, selectedSessionWords);
    setIsFocusedMode(true);
  };

  const startTestPreparation = async () => {
    // Range setting already happens in the modal, we'll finalize it here
    const isGrammar = selectedWordbook?.category === 'grammar' || selectedWordbook?.type === 'irregular';
    const daySize = isGrammar ? 10 : (selectedWordbook?.defaultUnitSize || 47);
    
    // For relative grammar, we need to apply the same concept-only logic for indexing
    let baseWords = words;
    if (selectedWordbook?.type === 'relative-grammar') {
      baseWords = words.filter(w => !w.word.includes('(___)'));
    }
    
    const startIndex = (testRange.start - 1) * daySize;
    const endIndex = testRange.end * daySize;
    let rangeWords = baseWords.slice(startIndex, endIndex);
    
    if (rangeWords.length === 0) {
      alert('선택한 범위에 단어가 없습니다.');
      return;
    }

    // Pre-fetch examples for relative-grammar or if it's a grammar set that uses them
    const isRelativeGrammar = selectedWordbook?.type === 'relative-grammar' || 
                              selectedWordbook?.title?.includes('관계부사') ||
                              selectedWordbook?.title?.includes('that');
    const isVerbFormGrammar = selectedWordbook?.type === 'verb-form-grammar';
    
    if ((isRelativeGrammar || isVerbFormGrammar) && selectedWordbook) {
      if (isVerbFormGrammar) {
        // Collect quiz pool for the selected range of sets
        let allPool: any[] = [];
        for (let s = testRange.start; s <= testRange.end; s++) {
          allPool = [...allPool, ...VERB_FORM_QUIZ_POOL.filter(q => q.set === s)];
        }
        
        if (allPool.length > 0) {
          const transformed = allPool.map(q => {
            const correct = q.choices[q.answer];
            const others = q.choices.filter((_, idx) => idx !== q.answer);
            return {
              id: `verb_form_quiz_${q.id}`,
              word: q.sentence,
              meaning: correct,
              quizSentence: q.sentence,
              quizExplanation: q.explanation,
              quizChoices: [correct, ...others],
              quizCategory: 'grammar'
            } as any;
          });
          rangeWords = shuffleArray(transformed);
        }
      } else {
        const concepts = rangeWords;
        const exampleFetches = concepts.map(async (concept) => {
          const examplesRef = collection(db, `wordbooks/${selectedWordbook.id}/words/${concept.id}/examples`);
          const snapshot = await getDocs(examplesRef);
          
          return snapshot.docs.map(doc => {
            const exampleData = doc.data();
            return {
              ...concept,
              id: `${concept.id}_${doc.id}`,
              quizSentence: exampleData.sentence,
              quizExplanation: exampleData.explanation,
              quizChoices: exampleData.choices || [],
            } as Word;
          });
        });

        const fetchResults = await Promise.all(exampleFetches);
        const allPotentialExamples = fetchResults.flat();

        if (allPotentialExamples.length > 0) {
          // Use a random subset of 25 examples if there are many
          const shuffled = shuffleArray(allPotentialExamples);
          rangeWords = shuffled.slice(0, 25);
        }
      }
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem('testLimit');
    const rangeKey = `${selectedWordbook?.id}-${isGrammar ? 'unit' : 'day'}${testRange.start}-${testRange.end}`;
    
    if (stored) {
      const data = JSON.parse(stored);
      if (data.date === today) {
        const count = (data.counts && data.counts[rangeKey]) || 0;
        if (count >= 3) {
          alert('오늘은 이 테스트를 더 이상 볼 수 없어요. 내일 다시 도전해보세요!');
          setPendingMode(null);
          return;
        }
      }
    }

    setTestWords(rangeWords);
    setIsTestMode(true);
    setPendingMode(null);
    setIsFocusedMode(true);
  };

  const handleConfirmStart = () => {
    if (pendingMode === 'match') startMatchGame();
    else if (pendingMode === 'quiz') startQuiz();
    else if (pendingMode === 'flashcard') startFlashcards();
    else if (pendingMode === 'conjugation') startConjugationChallenge();
    else if (pendingMode === 'test') startTestPreparation();
    setPendingMode(null);
  };

  const exitFocusedMode = () => {
    // Record session before exiting if it was in progress
    if (isQuizMode && !isQuizFinished) finishSession('quiz', quizScore, sessionWords.length);
    else if (isFlashcardMode) finishSession('flashcard');
    else if (isMatchMode && !isMatchFinished) finishSession('match');
    else if (isConjugationMode && !isConjugationFinished) finishSession('conjugation', conjugationScore, sessionWords.length);

    setIsFocusedMode(false);
    setIsFlashcardMode(false);
    setIsQuizMode(false);
    setIsMatchMode(false);
    setIsConjugationMode(false);
  };

  const generateQuizOptions = (index: number, providedWords?: Word[]) => {
    const currentWords = providedWords || sessionWords;
    if (currentWords.length === 0) return;
    
    const correctWord = currentWords[index];
    const isIrregular = selectedWordbook?.type === 'irregular';
    const isToIngGrammar = selectedWordbook?.type === 'to-ing-grammar';
    const isComplementGrammar = selectedWordbook?.type === 'complement-grammar';
    const isConversionGrammar = selectedWordbook?.type === 'conversion-grammar';
    const isModalGrammar = selectedWordbook?.type === 'modal-grammar';
    const isVerbFormGrammar = selectedWordbook?.type === 'verb-form-grammar';
    const isRelativeGrammar = selectedWordbook?.type === 'relative-grammar' || selectedWordbook?.title?.includes('관계부사');
    
    let correctOption: string;
    let otherOptions: string[];

    if (isRelativeGrammar || isModalGrammar || isVerbFormGrammar) {
      // Use choices from the prepared quiz sentence
      const choices = correctWord.quizChoices || [];
      
      if (isModalGrammar || isVerbFormGrammar) {
        // Find the actual correct option using the answer index from the pool
        const pool = isModalGrammar ? MODAL_QUIZ_POOL : VERB_FORM_QUIZ_POOL;
        const originalQuestion = (pool as any[]).find(q => (isModalGrammar ? `modal_quiz_${q.id}` : `verb_form_quiz_${q.id}`) === correctWord.id);
        if (originalQuestion) {
          correctOption = originalQuestion.choices[originalQuestion.answer];
          otherOptions = originalQuestion.choices.filter((_: any, idx: number) => idx !== originalQuestion.answer);
        } else {
          correctOption = (correctWord.quizChoices || [])[0] || '';
          otherOptions = (correctWord.quizChoices || []).slice(1);
        }
      } else {
        // For relative grammar, it was already mapped such that choices[0] is correct
        correctOption = (correctWord.quizChoices || [])[0] || '';
        otherOptions = (correctWord.quizChoices || []).slice(1);
      }
    } else if (isConversionGrammar) {
      const allLabels = [
        '동사 O to + 간접목적어',
        '동사 O for + 간접목적어',
        '동사 O of + 간접목적어',
        '3형식 전환 불가'
      ];
      const getLabelFromPattern = (p: string) => {
        if (p === 'to') return '동사 O to + 간접목적어';
        if (p === 'for') return '동사 O for + 간접목적어';
        if (p === 'of') return '동사 O of + 간접목적어';
        if (p === 'impossible') return '3형식 전환 불가';
        return p;
      };
      correctOption = getLabelFromPattern(correctWord.pattern || '');
      otherOptions = allLabels.filter(l => l !== correctOption);
    } else if (isComplementGrammar) {
      const verb = correctWord.word;
      correctOption = correctWord.distractors?.[0] || '';
      
      const standardDistractors = [
        `${verb} O 명사/형용사`,
        `${verb} O to V`,
        `${verb} O 동사원형`,
        `${verb} O V-ing`
      ];

      otherOptions = standardDistractors.filter(d => {
        if (d === correctOption) return false;
        // 만약 정답에 '둘 다 가능'이 포함되어 있다면, 그 구성 요소들을 함정 보기에서 제외
        if (correctOption.includes('둘 다 가능')) {
          const parts = correctOption.split('둘 다 가능')[0];
          if (parts.includes('명사/형용사') && d.includes('명사/형용사')) return false;
          if (parts.includes('V-ing') && d.includes('V-ing')) return false;
          if (parts.includes('동사원형') && d.includes('동사원형')) return false;
          if (parts.includes('to V') && d.includes('to V')) return false;
        }
        return true;
      });
      if (otherOptions.length > 3) otherOptions = otherOptions.slice(0, 3);
    } else if (isToIngGrammar) {
      const allPatterns = [
        'to부정사만 목적어로 오는 동사',
        '동명사만 목적어로 오는 동사',
        '둘다 목적어로 오고 의미도 같은 동사',
        '둘다 오지만 의미는 다른 동사'
      ];
      const word = correctWord.word;
      
      const getLabel = (p: string) => {
        if (p === 'to부정사만 목적어로 오는 동사') return `${word} to V`;
        if (p === '동명사만 목적어로 오는 동사') return `${word} Ving`;
        if (p === '둘다 목적어로 오고 의미도 같은 동사') return `둘 다 가능하고 의미도 같음`;
        if (p === '둘다 오지만 의미는 다른 동사') return `둘 다 가능하고 의미 달라짐`;
        return p;
      };

      correctOption = getLabel(correctWord.pattern || '');
      otherOptions = allPatterns
        .filter(p => p !== (correctWord.pattern || ''))
        .map(getLabel);
    } else if (isIrregular) {
      // For irregular, test the past - participle pair
      correctOption = `${correctWord.past} - ${correctWord.pastParticiple}`;
      
      // Attractive distractors for irregular verbs:
      const distractors = new Set<string>();
      
      // 0. Word-specific distractors prioritized
      const teacherDistractors = Array.isArray(correctWord.distractors) 
        ? correctWord.distractors 
        : (typeof correctWord.distractors === 'string' 
            ? (correctWord.distractors as string).split(',').map(s => s.trim()).filter(Boolean)
            : []);

      if (teacherDistractors.length > 0) {
        // Form pairs from specific distractors + correct forms
        const forms = [correctWord.past, correctWord.pastParticiple, ...teacherDistractors];
        for (let i = 0; i < forms.length; i++) {
          if (distractors.size >= 12) break;
          const d1 = forms[i];
          const d2 = forms[(i + 1) % forms.length];
          if (d1 && d2) distractors.add(`${d1} - ${d2}`);
        }
      }

      // 0.5. Custom distractors from teacher (if any)
      if (selectedWordbook.customDistractors && selectedWordbook.customDistractors.length > 0) {
        // We need pairs for the quiz, so we'll use custom distractors as parts of pairs
        // or if they are already pairs, use them directly.
        // For simplicity, let's assume custom distractors are single words and we mix them.
        const custom = selectedWordbook.customDistractors;
        for (let i = 0; i < custom.length; i++) {
          if (distractors.size >= 10) break;
          const d1 = custom[i];
          const d2 = custom[(i + 1) % custom.length];
          distractors.add(`${d1} - ${d2}`);
        }
      }

      // 1. Swap past and participle
      if (correctWord.past !== correctWord.pastParticiple) {
        distractors.add(`${correctWord.pastParticiple} - ${correctWord.past}`);
      }
      
      // 2. Use forms from verbs with the same pattern
      const samePatternWords = words.filter(w => w.id !== correctWord.id && w.pattern === correctWord.pattern);
      samePatternWords.forEach(w => {
        if (w.past && w.pastParticiple) distractors.add(`${w.past} - ${w.pastParticiple}`);
      });
      
      // 3. Use forms from any other irregular verbs
      const otherIrregularWords = words.filter(w => w.id !== correctWord.id);
      otherIrregularWords.forEach(w => {
        if (w.past && w.pastParticiple) distractors.add(`${w.past} - ${w.pastParticiple}`);
      });

      otherOptions = Array.from(distractors).filter(opt => opt !== correctOption);
    } else {
      correctOption = correctWord.meaning;
      otherOptions = currentWords
        .filter(w => w.id !== correctWord.id)
        .map(w => w.meaning);
    }
    
    const options = [correctOption];
    
    // Pick first 3 from otherOptions (already prioritized if it's irregular)
    options.push(...otherOptions.slice(0, 3));
    
    // Fill if not enough
    while (options.length < 4) {
      options.push("---");
    }
    
    // Shuffle all options
    setQuizOptions(shuffleArray(options));
    setSelectedOption(null);
    setIsCorrect(null);
  };

  const handleQuizAnswer = (optionIndex: number) => {
    if (selectedOption !== null || optionIndex < 0 || optionIndex >= quizOptions.length) return;
    
    setSelectedOption(optionIndex);
    const isIrregular = selectedWordbook?.type === 'irregular';
    const isToIngGrammar = selectedWordbook?.type === 'to-ing-grammar';
    const isComplementGrammar = selectedWordbook?.type === 'complement-grammar';
    const isConversionGrammar = selectedWordbook?.type === 'conversion-grammar';
    const isModalGrammar = selectedWordbook?.type === 'modal-grammar';
    const isVerbFormGrammar = selectedWordbook?.type === 'verb-form-grammar';
    const isRelativeGrammar = selectedWordbook?.type === 'relative-grammar' || selectedWordbook?.title?.includes('관계부사');
    
    let correctAnswer: string;
    if (isRelativeGrammar) {
      // In relative grammar, the first element of quizChoices is always the correct one
      correctAnswer = sessionWords[quizIndex].quizChoices?.[0] || '';
    } else if (isModalGrammar || isVerbFormGrammar) {
      const pool = isModalGrammar ? MODAL_QUIZ_POOL : VERB_FORM_QUIZ_POOL;
      const originalQuestion = (pool as any[]).find(q => (isModalGrammar ? `modal_quiz_${q.id}` : `verb_form_quiz_${q.id}`) === sessionWords[quizIndex].id);
      correctAnswer = originalQuestion ? originalQuestion.choices[originalQuestion.answer] : '';
    } else if (isConversionGrammar) {
      const p = sessionWords[quizIndex].pattern || '';
      if (p === 'to') correctAnswer = '동사 O to + 간접목적어';
      else if (p === 'for') correctAnswer = '동사 O for + 간접목적어';
      else if (p === 'of') correctAnswer = '동사 O of + 간접목적어';
      else if (p === 'impossible') correctAnswer = '3형식 전환 불가';
      else correctAnswer = p;
    } else if (isComplementGrammar) {
      correctAnswer = sessionWords[quizIndex].distractors?.[0] || '';
    } else if (isToIngGrammar) {
      const verb = sessionWords[quizIndex];
      const p = verb.pattern || '';
      if (p === 'to부정사만 목적어로 오는 동사') correctAnswer = `${verb.word} to V`;
      else if (p === '동명사만 목적어로 오는 동사') correctAnswer = `${verb.word} Ving`;
      else if (p === '둘다 목적어로 오고 의미도 같은 동사') correctAnswer = `둘 다 가능하고 의미도 같음`;
      else if (p === '둘다 오지만 의미는 다른 동사') correctAnswer = `둘 다 가능하고 의미 달라짐`;
      else correctAnswer = p;
    } else if (isIrregular) {
      correctAnswer = `${sessionWords[quizIndex].past} - ${sessionWords[quizIndex].pastParticiple}`;
    } else {
      correctAnswer = sessionWords[quizIndex].meaning;
    }
      
    const isAnswerCorrect = quizOptions[optionIndex] === correctAnswer || 
      (isRelativeGrammar && (
        (correctAnswer === 'how' && quizOptions[optionIndex] === 'the way') ||
        (correctAnswer === 'the way' && quizOptions[optionIndex] === 'how')
      ));
    
    setIsCorrect(isAnswerCorrect);
    
    let updatedIncorrectAnswers = [...incorrectAnswers];
    if (isAnswerCorrect) {
      setQuizScore(prev => prev + 1);
    } else {
      const newIncorrect = {
        word: sessionWords[quizIndex].word,
        meaning: sessionWords[quizIndex].meaning,
        userChoice: quizOptions[optionIndex],
        correctAnswer: correctAnswer,
        choices: [...quizOptions],
        quizSentence: sessionWords[quizIndex].quizSentence
      };
      updatedIncorrectAnswers.push(newIncorrect);
      setIncorrectAnswers(prev => [...prev, newIncorrect]);
    }

    // Don't auto-advance for relative grammar to show explanation
    if (selectedWordbook?.type === 'relative-grammar') {
      return;
    }

    setTimeout(() => {
      if (quizIndex < sessionWords.length - 1) {
        setQuizIndex(prev => prev + 1);
        generateQuizOptions(quizIndex + 1);
      } else {
        setIsQuizFinished(true);
        finishSession('quiz', quizScore + (isAnswerCorrect ? 1 : 0), sessionWords.length, updatedIncorrectAnswers);
      }
    }, 600);
  };

  const handleNextQuizQuestion = () => {
    if (quizIndex < sessionWords.length - 1) {
      setQuizIndex(prev => prev + 1);
      generateQuizOptions(quizIndex + 1);
    } else {
      setIsQuizFinished(true);
      finishSession('quiz', quizScore, sessionWords.length);
    }
  };

  const generateConjugationOptions = (wordIndex: number, step: 0 | 1, providedWords?: Word[]) => {
    const currentWords = providedWords || sessionWords;
    if (currentWords.length === 0) return;
    
    const correctWord = currentWords[wordIndex];
    if (!correctWord) return;
    
    const correctAnswer = step === 0 ? correctWord.past : correctWord.pastParticiple;
    
    const distractors = new Set<string>();
    distractors.add(correctAnswer!);

    // 0. Word-specific distractors prioritized correctly
    const teacherDistractors = Array.isArray(correctWord.distractors) 
      ? correctWord.distractors 
      : (typeof correctWord.distractors === 'string' 
          ? (correctWord.distractors as string).split(',').map(s => s.trim()).filter(Boolean)
          : []);

    if (teacherDistractors.length > 0) {
      const shuffledSpecific = shuffleArray<string>(teacherDistractors);
      for (const d of shuffledSpecific) {
        if (distractors.size >= 4) break;
        distractors.add(d);
      }
    }

    // 0.5. Custom distractors from teacher (for the whole wordbook)
    if (distractors.size < 4 && selectedWordbook?.customDistractors && selectedWordbook.customDistractors.length > 0) {
      const custom: string[] = selectedWordbook.customDistractors;
      const shuffledCustom = shuffleArray<string>(custom);
      for (const d of shuffledCustom) {
        if (distractors.size >= 4) break;
        distractors.add(d);
      }
    }

    // Attractive distractors:
    // 1. The other form of the same verb
    const otherForm = step === 0 ? correctWord.pastParticiple : correctWord.past;
    if (otherForm && distractors.size < 4) distractors.add(otherForm);

    // 2. The base form (if different)
    if (correctWord.word && distractors.size < 4) distractors.add(correctWord.word);

    // 3. Fake regular form (base + ed)
    const fakeRegular = correctWord.word.endsWith('e') ? correctWord.word + 'd' : correctWord.word + 'ed';
    if (distractors.size < 4) distractors.add(fakeRegular);

    // 4. Forms from verbs with the same pattern
    const samePatternWords = words.filter(w => w.id !== correctWord.id && w.pattern === correctWord.pattern);
    const samePatternForms: string[] = samePatternWords
      .map(w => step === 0 ? w.past : w.pastParticiple)
      .filter((f): f is string => !!f && f !== correctAnswer);
    
    const shuffledPatternForms = shuffleArray<string>(samePatternForms);
    for (const f of shuffledPatternForms) {
      if (distractors.size >= 4) break;
      distractors.add(f);
    }

    // 5. Any other irregular forms
    const otherWords = words.filter(w => w.id !== correctWord.id);
    const otherForms: string[] = otherWords
      .map(w => step === 0 ? w.past : w.pastParticiple)
      .filter((f): f is string => !!f && f !== correctAnswer);
    
    const uniqueOtherForms = otherForms.filter((v, i, a) => a.indexOf(v) === i);
    const shuffledOthers = shuffleArray<string>(uniqueOtherForms);
    for (const f of shuffledOthers) {
      if (distractors.size >= 4) break;
      distractors.add(f);
    }
    
    const options: string[] = Array.from(distractors);
    while (options.length < 4) {
      options.push("???");
    }
    
    setConjugationOptions(shuffleArray(options));
    setSelectedOption(null);
    setIsCorrect(null);
  };

  const handleConjugationAnswer = (optionIndex: number) => {
    if (selectedOption !== null || optionIndex < 0 || optionIndex >= conjugationOptions.length) return;
    
    setSelectedOption(optionIndex);
    const correctWord = sessionWords[conjugationIndex];
    const correctAnswer = conjugationStep === 0 ? correctWord.past : correctWord.pastParticiple;
    
    const isAnswerCorrect = conjugationOptions[optionIndex] === correctAnswer;
    setIsCorrect(isAnswerCorrect);
    
    let updatedIncorrectAnswers = [...incorrectAnswers];
    if (isAnswerCorrect) {
      setConjugationScore(prev => prev + 0.5); // 0.5 for each step
    } else {
      const newIncorrect = {
        word: correctWord.word,
        meaning: conjugationStep === 0 ? '과거형' : '과거분사형',
        userChoice: conjugationOptions[optionIndex],
        correctAnswer: correctAnswer || '',
        choices: [...conjugationOptions],
        quizSentence: correctWord.quizSentence
      };
      updatedIncorrectAnswers.push(newIncorrect);
      setIncorrectAnswers(prev => [...prev, newIncorrect]);
    }

    setTimeout(() => {
      if (conjugationStep === 0) {
        // Move to participle step
        setConjugationStep(1);
        generateConjugationOptions(conjugationIndex, 1);
      } else {
        // Move to next word
        if (conjugationIndex < sessionWords.length - 1) {
          setConjugationIndex(prev => prev + 1);
          setConjugationStep(0);
          generateConjugationOptions(conjugationIndex + 1, 0);
        } else {
          setIsConjugationFinished(true);
          finishSession('conjugation', conjugationScore + (isAnswerCorrect ? 0.5 : 0), sessionWords.length, updatedIncorrectAnswers);
        }
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
      if (isConjugationMode && !isConjugationFinished && selectedOption === null) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= conjugationOptions.length) {
          handleConjugationAnswer(num - 1);
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
          finishSession('match', undefined, undefined, incorrectAnswers);
          saveScore(finalTime);
        }
      } else {
        // No match - Record as incorrect answer
        const card1 = matchCards[selectedMatchCard];
        const card2 = matchCards[index];
        const wordData = sessionWords.find(w => w.id === card1.wordId || w.id === card2.wordId);
        
        if (wordData) {
          setIncorrectAnswers(prev => {
            // Avoid duplicates in the same session
            if (prev.some(ia => ia.word === wordData.word)) return prev;
            return [...prev, {
              word: wordData.word,
              meaning: wordData.meaning,
              userChoice: card1.type === 'word' ? card1.content : card2.content,
              correctAnswer: wordData.meaning,
              quizSentence: wordData.quizSentence
            }];
          });
        }
        
        setSelectedMatchCard(index);
      }
    }
  };

  const saveScore = async (time: number) => {
    if (!auth.currentUser || !selectedWordbook) return;

    try {
      // Get user name
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userName = userDoc.data()?.name || '익명';

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

  const learnedCount = words.filter(w => progress[w.id] === 'learned').length;
  const progressPercent = words.length > 0 ? Math.round((learnedCount / words.length) * 100) : 0;

  const currentWord = isFlashcardMode ? sessionWords[currentCardIndex] : displayedWords[currentCardIndex];

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
              {pendingMode === 'test' ? (
                <div className="space-y-4 mb-8">
                  <p className="text-slate-500 font-medium">테스트 범위를 설정해주세요.</p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">시작</label>
                      <select 
                        value={testRange.start}
                        onChange={(e) => setTestRange(prev => ({ ...prev, start: Math.min(Number(e.target.value), prev.end) }))}
                        className="w-20 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                      >
                        {Array.from({ length: totalChunks }).map((_, i) => (
                          <option key={i} value={i + 1}>{isGrammar ? `${i + 1}세트` : `Day ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-slate-300 mt-5 font-black">~</span>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">종료</label>
                      <select 
                        value={testRange.end}
                        onChange={(e) => setTestRange(prev => ({ ...prev, end: Math.max(Number(e.target.value), prev.start) }))}
                        className="w-20 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm font-bold outline-none"
                      >
                        {Array.from({ length: totalChunks }).map((_, i) => (
                          <option key={i} value={i + 1}>{isGrammar ? `${i + 1}세트` : `Day ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-amber-500 bg-amber-50 py-2 rounded-lg">
                    <AlertCircle size={10} className="inline mr-1" />
                    테스트는 하루에 최대 3회만 응시 가능합니다.
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 font-medium mb-8">
                  {pendingMode === 'flashcard' ? '플래시카드' : pendingMode === 'quiz' ? '객관식 퀴즈' : pendingMode === 'match' ? '매치 게임' : '3단 변화 챌린지'} 모드로 이동하여 학습에 집중합니다.
                </p>
              )}
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
                    {isFlashcardMode ? '📇' : isQuizMode ? '📝' : isConjugationMode ? '✨' : '🎮'}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{selectedWordbook?.title}</h2>
                    <p className="text-xs font-bold text-slate-400">{isGrammar ? `${currentChunk + 1}세트` : `Day ${currentChunk + 1}`} 집중 학습 모드</p>
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
                          총 <span className="text-indigo-500">{sessionWords.length}</span>문제 중 <span className="text-indigo-500">{quizScore}</span>문제를 맞혔습니다.
                        </p>
                        
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-2">
                           <div className="text-emerald-600 font-black text-lg">
                              🎉 {quizScore}개 정답! +{earnedPoints} 포인트를 획득했어요!
                           </div>
                           <div className="text-indigo-500 font-black">
                              +{earnedXP} XP를 획득했어요! (총 {totalPoints} 포인트)
                           </div>
                        </div>

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
                            문제 {quizIndex + 1} / {sessionWords.length}
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={isMobile ? 12 : 16} className="text-emerald-500" />
                            <span className="text-[10px] md:text-sm font-black text-emerald-600">{quizScore}</span>
                          </div>
                        </div>

                        <div className={`flex flex-col items-center gap-4 md:gap-6 ${isMobile ? 'mb-6' : 'mb-10'}`}>
                          {sessionWords[quizIndex].imageUrl && (
                            <div className={`w-full max-w-sm ${isMobile ? 'h-32' : 'h-48'} rounded-2xl md:rounded-3xl overflow-hidden border border-slate-100 shadow-sm`}>
                              <img 
                                src={sessionWords[quizIndex].imageUrl} 
                                alt="Quiz Hint" 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          <h3 className={`${isMobile ? 'text-2xl' : 'text-5xl'} font-black text-slate-900 text-center leading-tight`}>
                            {(selectedWordbook?.type === 'relative-grammar' || selectedWordbook?.type === 'modal-grammar' || selectedWordbook?.title?.includes('관계부사'))
                              ? sessionWords[quizIndex].quizSentence 
                              : sessionWords[quizIndex].word}
                          </h3>
                          {(selectedWordbook?.type !== 'relative-grammar' && selectedWordbook?.type !== 'modal-grammar' && !selectedWordbook?.title?.includes('관계부사')) && (
                            <button 
                              onClick={() => speak(sessionWords[quizIndex].word)}
                              className="p-2 md:p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-pastel-pink-500 transition-colors"
                            >
                              <Volume2 size={isMobile ? 20 : 24} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 md:gap-3">
                          {quizOptions.map((option, idx) => {
                            const isRelative = selectedWordbook?.type === 'relative-grammar' || selectedWordbook?.title?.includes('관계부사');
                            const relativeCorrect = isRelative && sessionWords[quizIndex].quizChoices && (
                              option === sessionWords[quizIndex].quizChoices[0] ||
                              (sessionWords[quizIndex].quizChoices[0] === 'how' && option === 'the way') ||
                              (sessionWords[quizIndex].quizChoices[0] === 'the way' && option === 'how')
                            );
                            
                            const meaningMatch = option === sessionWords[quizIndex].meaning;
                            const pastMatch = (sessionWords[quizIndex].past && sessionWords[quizIndex].pastParticiple && option === `${sessionWords[quizIndex].past} - ${sessionWords[quizIndex].pastParticiple}`);
                            const complementMatch = selectedWordbook?.type === 'complement-grammar' && option === sessionWords[quizIndex].distractors?.[0];
                            const patternMatch = sessionWords[quizIndex].pattern && (() => {
                              const v = sessionWords[quizIndex];
                              const p = v.pattern || '';
                              return option === (
                                p === 'to부정사만 목적어로 오는 동사' ? `${v.word} to V` :
                                p === '동명사만 목적어로 오는 동사' ? `${v.word} Ving` :
                                p === '둘다 목적어로 오고 의미도 같은 동사' ? `둘 다 가능하고 의미도 같음` :
                                p === '둘다 오지만 의미는 다른 동사' ? `둘 다 가능하고 의미 달라짐` : p
                              );
                            })();

                            const isCorrectAnswer = relativeCorrect || meaningMatch || pastMatch || complementMatch || patternMatch;

                            return (
                              <button
                                key={idx}
                                onClick={() => handleQuizAnswer(idx)}
                                disabled={selectedOption !== null}
                                className={`${isMobile ? 'p-3 text-sm' : 'p-5'} rounded-xl md:rounded-2xl border-2 text-left font-bold transition-all flex items-center justify-between group ${
                                  selectedOption === idx
                                    ? isCorrect 
                                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100'
                                      : 'bg-rose-50/50 border-rose-200 text-rose-700 shadow-sm shadow-rose-100'
                                    : selectedOption !== null && isCorrectAnswer
                                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700 ring-2 ring-emerald-100'
                                      : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-100 hover:bg-slate-50'
                                }`}
                              >
                                <span className="flex items-center gap-3 md:gap-4 w-full">
                                  <span className={`${isMobile ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-sm'} rounded-lg flex-shrink-0 flex items-center justify-center font-black transition-all ${
                                    selectedOption === idx
                                      ? isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                                      : selectedOption !== null && isCorrectAnswer
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-500'
                                  }`}>
                                    {selectedOption === idx ? (
                                      isCorrect ? <CheckCircle2 size={isMobile ? 12 : 16} /> : <X size={isMobile ? 12 : 16} />
                                    ) : selectedOption !== null && isCorrectAnswer ? (
                                      <CheckCircle2 size={isMobile ? 12 : 16} />
                                    ) : (
                                      idx + 1
                                    )}
                                  </span>
                                  <span className="whitespace-pre-wrap leading-tight">{option}</span>
                                </span>
                                {selectedOption !== null && isCorrectAnswer && (
                                  <CheckCircle2 size={isMobile ? 16 : 20} className="flex-shrink-0 text-emerald-500 animate-in zoom-in" />
                                )}
                                {selectedOption === idx && !isCorrect && (
                                  <X size={isMobile ? 16 : 20} className="flex-shrink-0 text-rose-500 animate-in zoom-in" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                          { (selectedWordbook?.type === 'relative-grammar' || selectedWordbook?.type === 'modal-grammar' || selectedWordbook?.title?.includes('관계부사')) && selectedOption !== null && (
                          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            />
                            <motion.div 
                              initial={{ scale: 0.9, opacity: 0, y: 20 }}
                              animate={{ scale: 1, opacity: 1, y: 0 }}
                              className={`bg-white relative w-full max-w-md ${isMobile ? 'rounded-[2rem] p-8' : 'rounded-[3rem] p-10'} border-4 border-indigo-100 shadow-2xl flex flex-col items-center text-center`}
                            >
                              <div className={`${isMobile ? 'w-14 h-14' : 'w-20 h-20'} bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-500`}>
                                <Info size={isMobile ? 28 : 40} />
                              </div>
                              <h3 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-black text-slate-900 mb-4`}>
                                {isCorrect ? '정답 이유' : '오답 이유'}
                              </h3>
                              <p className={`${isMobile ? 'text-sm' : 'text-base'} font-bold text-slate-600 leading-relaxed mb-8 whitespace-pre-wrap`}>
                                {sessionWords[quizIndex].quizExplanation}
                              </p>
                              <button
                                onClick={handleNextQuizQuestion}
                                className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 group"
                              >
                                다음 문제로 넘어가기
                                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                              </button>
                            </motion.div>
                          </div>
                        )}

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
                        모든 단어를 <span className="text-amber-500">{matchTime.toFixed(1)}초</span> 만에 맞혔습니다!
                      </p>

                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-2">
                         <div className="text-emerald-600 font-black text-lg">
                            🎉 완료! +{earnedPoints} 포인트를 획득했어요!
                         </div>
                         <div className="text-amber-500 font-black">
                            +{earnedXP} XP를 획득했어요! (총 {totalPoints} 포인트)
                         </div>
                      </div>

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
              ) : isConjugationMode ? (
                <div className="flex flex-col items-center gap-8">
                  <AnimatePresence mode="wait">
                    {isConjugationFinished ? (
                      <motion.div
                        key="conjugation-finished"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white ${isMobile ? 'p-8 rounded-[2.5rem]' : 'p-12 rounded-[3.5rem]'} border-4 border-blue-100 shadow-2xl text-center space-y-4 md:space-y-6 w-full max-w-lg`}
                      >
                        <div className={`${isMobile ? 'w-16 h-16' : 'w-24 h-24'} bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-500`}>
                          <Trophy size={isMobile ? 32 : 48} />
                        </div>
                        <h2 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-slate-900`}>챌린지 완료!</h2>
                        <p className={`${isMobile ? 'text-base' : 'text-xl'} font-bold text-slate-500`}>
                          총 <span className="text-blue-500">{sessionWords.length}</span>단어 중 <span className="text-blue-500">{conjugationScore}</span>점을 획득했습니다.
                        </p>

                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-2">
                           <div className="text-emerald-600 font-black text-lg">
                              🎉 {conjugationScore}점 획득! +{earnedPoints} 포인트를 획득했어요!
                           </div>
                           <div className="text-blue-500 font-black">
                              +{earnedXP} XP를 획득했어요! (총 {totalPoints} 포인트)
                           </div>
                        </div>

                        <div className="pt-4 md:pt-6">
                          <button 
                            onClick={startConjugationChallenge}
                            className="px-8 md:px-10 py-3 md:py-4 bg-blue-500 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:scale-105 transition-transform text-sm md:text-base"
                          >
                            다시 도전하기
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={`${conjugationIndex}_${conjugationStep}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={`w-full max-w-2xl bg-white ${isMobile ? 'rounded-2xl p-6' : 'rounded-[3rem] p-8 md:p-12'} border border-slate-100 shadow-xl`}
                      >
                        <div className="flex justify-between items-center mb-6 md:mb-8">
                          <div className="text-[10px] md:text-sm font-black text-slate-400">
                            단어 {conjugationIndex + 1} / {sessionWords.length}
                          </div>
                          <div className="flex items-center gap-2">
                            <Sparkles size={isMobile ? 12 : 16} className="text-blue-500" />
                            <span className="text-[10px] md:text-sm font-black text-blue-600">Score: {conjugationScore}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-4 md:gap-6 mb-10">
                          <div className="text-center">
                            <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Base Form & Meaning</div>
                            <h3 className={`${isMobile ? 'text-3xl' : 'text-5xl'} font-black text-slate-900 mb-2`}>{sessionWords[conjugationIndex].word}</h3>
                            <p className="text-lg font-bold text-slate-500">{sessionWords[conjugationIndex].meaning}</p>
                          </div>

                          <div className="flex items-center gap-4 mt-4">
                            <div className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${conjugationStep === 0 ? 'bg-blue-500 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                              PAST
                            </div>
                            <ChevronRight className="text-slate-300" />
                            <div className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${conjugationStep === 1 ? 'bg-blue-500 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                              PARTICIPLE
                            </div>
                          </div>
                        </div>

                        <div className="text-center mb-6">
                          <h4 className="text-xl font-black text-slate-900">
                            {conjugationStep === 0 ? '과거형' : '과거분사형'}을 선택하세요
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {conjugationOptions.map((option, idx) => {
                            const isCorrectAnswer = option === (conjugationStep === 0 ? sessionWords[conjugationIndex].past : sessionWords[conjugationIndex].pastParticiple);
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => handleConjugationAnswer(idx)}
                                disabled={selectedOption !== null}
                                className={`p-5 rounded-2xl border-2 text-center font-black transition-all group relative overflow-hidden ${
                                  selectedOption === idx
                                    ? isCorrect 
                                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-100'
                                      : 'bg-rose-50/50 border-rose-200 text-rose-700 shadow-sm shadow-rose-100'
                                    : selectedOption !== null && isCorrectAnswer
                                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700 ring-4 ring-emerald-50 animate-pulse'
                                      : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-slate-50 hover:scale-[1.02]'
                                }`}
                              >
                                <div className="text-lg flex items-center justify-center gap-2">
                                  {selectedOption === idx ? (
                                    isCorrect ? <CheckCircle2 size={18} className="text-emerald-500" /> : <X size={18} className="text-rose-500" />
                                  ) : selectedOption !== null && isCorrectAnswer ? (
                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                  ) : null}
                                  {option}
                                </div>
                                {selectedOption === null && (
                                  <div className="text-[10px] font-bold text-slate-300 mt-1">Option {idx + 1}</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : isFlashcardMode && sessionWords.length > 0 ? (
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
                        {selectedWordbook?.type === 'modal-grammar' && (
                          <div className="absolute top-6 px-3 py-1 bg-indigo-100 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-wider">
                            GRAMMAR CONCEPT
                          </div>
                        )}
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
                        {selectedWordbook?.type === 'to-ing-grammar' ? (
                          <div className="text-center space-y-4">
                            <div className="space-y-1">
                              <div className="text-[10px] font-black uppercase tracking-widest opacity-60">문법 분류</div>
                              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-black`}>
                                {currentWord.pattern}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-[10px] font-black uppercase tracking-widest opacity-60">뜻</div>
                              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{currentWord.meaning}</div>
                            </div>
                          </div>
                        ) : selectedWordbook?.type === 'irregular' ? (
                          <div className="text-center space-y-4">
                            <div className="space-y-1">
                              <div className="text-[10px] font-black uppercase tracking-widest opacity-60">과거형 - 과거분사형</div>
                              <div className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black`}>
                                {currentWord.past} - {currentWord.pastParticiple}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-[10px] font-black uppercase tracking-widest opacity-60">뜻</div>
                              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{currentWord.meaning}</div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black mb-2 md:mb-4 text-center whitespace-pre-wrap leading-tight`}>{currentWord.meaning}</div>
                            {currentWord.example && (
                              <div className="text-[10px] md:text-sm font-medium opacity-80 text-center italic">"{currentWord.example}"</div>
                            )}
                          </>
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
                      <span className="text-slate-900">{currentCardIndex + 1}</span> / {sessionWords.length}
                    </div>
                    <button 
                      disabled={currentCardIndex === sessionWords.length - 1}
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
              ) : isTestMode ? (
                <VocabularyTest 
                  words={testWords}
                  dayRange={testRange}
                  onClose={() => {
                    setIsTestMode(false);
                    setIsFocusedMode(false);
                  }}
                  onNavigateToReport={() => {
                    setIsTestMode(false);
                    setIsFocusedMode(false);
                    onNavigate?.('report');
                  }}
                  wordbookId={selectedWordbook?.id || ''}
                  wordbookTitle={selectedWordbook?.title || ''}
                  category={selectedWordbook?.category || 'word'}
                  type={selectedWordbook?.type}
                />
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
              <h1 className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black text-slate-900 mb-2 md:mb-4 tracking-tight`}>
                {category === 'grammar' ? '반복 학습' : '단어장 학습'}
              </h1>
              <p className="text-sm md:text-base text-slate-500 font-medium">
                {category === 'grammar' ? '선생님이 등록한 학습 세트로 실력을 키워보세요!' : '선생님이 등록한 단어장을 학습하고 실력을 키워보세요!'}
              </p>
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
                ← 전체 학습 세트
              </button>
              <div className="flex flex-wrap items-center gap-2 md:gap-4">
                {selectedWordbook.type === 'irregular' && (
                  <button
                    onClick={() => setPendingMode('conjugation')}
                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all bg-blue-500 text-white shadow-lg shadow-blue-200 hover:scale-105`}
                  >
                    ✨ 3단 변화 챌린지
                  </button>
                )}
                <button
                  onClick={() => setPendingMode('flashcard')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all bg-white text-slate-400 border border-slate-100 hover:bg-slate-50`}
                >
                  플래시카드
                </button>
                <button
                  onClick={() => setPendingMode('quiz')}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all flex items-center gap-1 md:gap-2 ${
                    category === 'grammar' && selectedWordbook.type !== 'irregular'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 hover:scale-105' 
                    : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <CheckCircle2 size={isMobile ? 12 : 14} />
                  객관식
                </button>
                <button
                  onClick={() => setPendingMode('match')}
                  className="px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all flex items-center gap-1 md:gap-2 bg-white text-slate-400 border border-slate-100 hover:bg-slate-50"
                >
                  <Gamepad2 size={isMobile ? 12 : 14} />
                  매치 게임
                </button>
                <button
                  onClick={() => {
                    setTestRange({ start: currentChunk + 1, end: currentChunk + 1 });
                    setPendingMode('test');
                  }}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[10px] md:text-xs font-black transition-all flex items-center gap-1 md:gap-2 bg-blue-600 text-white shadow-lg shadow-blue-200 hover:scale-105`}
                >
                  <GraduationCap size={isMobile ? 12 : 14} />
                  테스트
                </button>
              </div>
            </div>

            {/* Chunk Selector */}
            <div className={`bg-white ${isMobile ? 'p-4 rounded-2xl' : 'p-6 rounded-[2rem]'} border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 overflow-hidden`}>
              <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
                <span className="text-xs md:text-sm font-bold text-slate-500 whitespace-nowrap">학습 단위(게임):</span>
                <select 
                  value={sessionUnitSize}
                  onChange={(e) => {
                    setSessionUnitSize(Number(e.target.value));
                  }}
                  className="bg-slate-50 border border-slate-100 rounded-lg px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pastel-pink-200"
                >
                  {[10, 20, 30, 40, 50, 100].map(size => (
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
                    {isGrammar ? `${i + 1}세트` : `Day ${i + 1}`}
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
                  <p className="text-[10px] md:text-sm font-bold text-slate-400">
                    {selectedWordbook?.type === 'complement-grammar' ? (
                      currentChunk === 0 ? '명사/형용사 보어 동사 (7개)' :
                      currentChunk === 1 ? 'to V 보어 동사 (10개)' :
                      '동사원형 / 둘 다 가능 동사 (9개)'
                    ) : selectedWordbook?.type === 'modal-grammar' ? (
                      currentChunk === 0 ? '1세트(can/may/will): 능력, 허가, 요청, 추측 등 의미 구별 (14개)' :
                      currentChunk === 1 ? '2세트(must/should): 의무, 금지, 불필요, 추측 등 강도 구별 (7개)' :
                      currentChunk === 2 ? '3세트(should 생략): 제안, 주장, 요구 동사 및 예문 (9개)' :
                      currentChunk === 3 ? '4세트(used to / would): 과거 습관 및 상태 구별 (7개)' :
                      currentChunk === 4 ? '5세트(조동사 + have p.p.): 과거 추측 및 후회 표현 (5개)' :
                      '6세트(관용 표현): would like, had better 등 핵심 표현 (6개)'
                    ) : selectedWordbook?.type === 'verb-form-grammar' ? (
                      currentChunk === 0 ? '1세트: 1형식 전용 동사 (happen, occur, rise, matter 등)' :
                      currentChunk === 1 ? '2세트: 2형식 전용 동사 (seem, appear, remain, stay 등)' :
                      currentChunk === 2 ? '3세트: 1형식 vs 2형식 겸용 (grow, run, go, come, turn 등)' :
                      currentChunk === 3 ? '4세트: 감각 동사 (smell, taste, feel, look, sound 등)' :
                      '5세트: 3형식 전용 동사 (discuss, enter, resemble, marry 등)'
                    ) : selectedWordbook?.type === 'conversion-grammar' ? (
                      '4형식 동사의 3형식 전치사 전환 규칙을 학습합니다.'
                    ) : `${isGrammar ? `${currentChunk + 1}세트` : `Day ${currentChunk + 1}`}의 단어들을 학습합니다.`}
                  </p>
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
                      {selectedWordbook.type !== 'relative-grammar' && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            speak(word.word);
                          }}
                          className="p-1.5 md:p-2 bg-white rounded-lg text-slate-400 hover:text-pastel-pink-500 transition-colors"
                        >
                          <Volume2 size={isMobile ? 16 : 18} />
                        </button>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`${isMobile ? 'text-base' : 'text-xl'} font-black ${progress[word.id] === 'learned' ? 'text-emerald-700' : 'text-slate-900'}`}>
                            {word.word}
                          </div>
                          {selectedWordbook.type === 'irregular' && word.pattern && (
                            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[8px] md:text-[10px] font-black rounded uppercase tracking-tighter">
                              {word.pattern}
                            </span>
                          )}
                          {selectedWordbook.type === 'relative-grammar' && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] md:text-[10px] font-black rounded uppercase tracking-tighter">
                              Grammar Concept
                            </span>
                          )}
                          {(selectedWordbook.type === 'modal-grammar' || selectedWordbook.type === 'verb-form-grammar') && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] md:text-[10px] font-black rounded uppercase tracking-tighter">
                              GRAMMAR CONCEPT
                            </span>
                          )}
                        </div>
                        {selectedWordbook.type === 'irregular' ? (
                          <div className="space-y-0.5">
                            <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-black text-blue-500`}>
                              {word.past} - {word.pastParticiple}
                            </div>
                            <div className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium ${progress[word.id] === 'learned' ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                              {word.meaning}
                            </div>
                          </div>
                        ) : selectedWordbook.type === 'modal-grammar' ? (
                          <div className="space-y-0.5">
                            <div className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium ${progress[word.id] === 'learned' ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                              {word.meaning}
                            </div>
                            {word.example && (
                              <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} font-bold text-indigo-500 italic`}>
                                Ex: {word.example}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-medium ${progress[word.id] === 'learned' ? 'text-emerald-600/70' : 'text-slate-500'}`}>
                            {word.meaning}
                          </div>
                        )}
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
