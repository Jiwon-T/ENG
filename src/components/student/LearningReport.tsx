import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, TrendingUp, BookOpen, CheckCircle2, Clock, Calendar, ClipboardList, ChevronLeft, ChevronRight, Gamepad2, XCircle, Play, RotateCcw, X, Trophy, ArrowRight, Trash2, Check, Sparkles } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType, markIncorrectAnswerReviewed } from '../../lib/firebase';
import { PetService } from '../../lib/petService';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy, limit, updateDoc, getDocs } from 'firebase/firestore';

export default function LearningReport() {
  const [stats, setStats] = useState({
    totalWords: 0,
    learnedWords: 0,
    attendanceRate: 0,
    weeklyAttendanceRate: 0,
    evaluation: '선생님의 평가를 기다리고 있어요.',
    weeklyTrend: [0, 0, 0, 0, 0, 0, 0],
    weeklyAttendanceTrend: [0, 0, 0, 0, 0, 0, 0],
    assignments: [] as any[],
    hasNewAssignment: false,
    sessionHistory: [] as any[]
  });
  const [userRole, setUserRole] = useState<string>('student');
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [sessionPage, setSessionPage] = useState(1);
  const [wrongPage, setWrongPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewConfirmItem, setReviewConfirmItem] = useState<any>(null);
  const [isReviewQuizOpen, setIsReviewQuizOpen] = useState(false);
  const [reviewWords, setReviewWords] = useState<any[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [reviewOptions, setReviewOptions] = useState<string[]>([]);
  const [selectedReviewOption, setSelectedReviewOption] = useState<number | null>(null);
  const [reviewResult, setReviewResult] = useState<'correct' | 'wrong' | null>(null);
  const [reviewScore, setReviewScore] = useState(0);
  const [isReviewFinished, setIsReviewFinished] = useState(false);
  const [rewardFeedback, setRewardFeedback] = useState<{ points: number; xp: number } | null>(null);

  const ASSIGNMENTS_PER_PAGE = 5;
  const SESSIONS_PER_PAGE = 5;
  const WRONG_PER_PAGE = 5;

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch user role
    getDoc(doc(db, 'users', auth.currentUser.uid)).then(snap => {
      if (snap.exists()) {
        setUserRole(snap.data().role || 'student');
      }
    });

    // Fetch word progress
    const qWords = query(collection(db, 'wordProgress'), where('uid', '==', auth.currentUser.uid));
    const unsubWords = onSnapshot(qWords, (snapshot) => {
      const learned = snapshot.docs.filter(doc => doc.data().status === 'learned').length;
      
      // Calculate weekly trend
      const trend = [0, 0, 0, 0, 0, 0, 0];
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'learned' && data.updatedAt) {
          const date = data.updatedAt.toDate();
          // Normalize both to local 00:00 for day difference
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const learnedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          const diffDays = Math.floor((today.getTime() - learnedDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < 7) {
            trend[6 - diffDays]++;
          }
        }
      });

      setStats(prev => ({ 
        ...prev, 
        learnedWords: learned,
        weeklyTrend: trend
      }));
    });

    // Fetch attendance
    const qAttendance = query(collection(db, 'attendance'), where('studentId', '==', auth.currentUser.uid));
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const total = snapshot.docs.length;
      const present = snapshot.docs.filter(doc => doc.data().status === 'present').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      
      // Calculate weekly attendance trend
      const attTrend = [0, 0, 0, 0, 0, 0, 0];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'present' && data.date) {
          // data.date is YYYY-MM-DD
          const [y, m, d] = data.date.split('-').map(Number);
          const attDate = new Date(y, m - 1, d);
          const diffDays = Math.floor((today.getTime() - attDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays < 7) {
            attTrend[6 - diffDays] = 1;
          }
        }
      });

      const weeklyAttCount = attTrend.filter(v => v === 1).length;
      const weeklyAttRate = Math.round((weeklyAttCount / 7) * 100);

      setStats(prev => ({ 
        ...prev, 
        attendanceRate: rate,
        weeklyAttendanceRate: weeklyAttRate,
        weeklyAttendanceTrend: attTrend
      }));
    });

    // Fetch evaluation
    const unsubEval = onSnapshot(doc(db, 'evaluations', auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setStats(prev => ({ ...prev, evaluation: docSnap.data().evaluation || '선생님의 평가를 기다리고 있어요.' }));
      }
    });

    // Fetch assignments
    const qAssignments = query(
      collection(db, 'assignments'), 
      where('studentUid', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubAssignments = onSnapshot(qAssignments, (snapshot) => {
      const assignments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const hasNew = assignments.some((a: any) => a.isNew);
      setStats(prev => ({ 
        ...prev, 
        assignments,
        hasNewAssignment: hasNew
      }));
    });

    // Fetch study sessions (Activity Log)
    const qSessions = query(
      collection(db, 'studySessions'), 
      where('uid', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStats(prev => ({ ...prev, sessionHistory: sessions }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'studySessions');
    });

    return () => {
      unsubWords();
      unsubAttendance();
      unsubEval();
      unsubAssignments();
      unsubSessions();
    };
  }, []);

  const markAssignmentsAsRead = async () => {
    if (!auth.currentUser || !stats.hasNewAssignment) return;
    
    const q = query(
      collection(db, 'assignments'), 
      where('studentUid', '==', auth.currentUser.uid),
      where('isNew', '==', true)
    );
    
    try {
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map(d => updateDoc(doc(db, 'assignments', d.id), { isNew: false }));
      await Promise.all(updates);
    } catch (error) {
      console.error('Failed to mark assignments as read:', error);
    }
  };

  useEffect(() => {
    // Mark as read when viewing the report
    const timer = setTimeout(() => {
      markAssignmentsAsRead();
    }, 3000); // Mark as read after 3 seconds of viewing
    return () => clearTimeout(timer);
  }, [stats.hasNewAssignment]);

  const getDayLabel = (offset: number) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date();
    date.setDate(date.getDate() - (6 - offset));
    return days[date.getDay()];
  };

  const formatDateWithDay = (date: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const day = days[date.getDay()];
    return `${yyyy}-${mm}-${dd} (${day})`;
  };

  const maxTrend = Math.max(...stats.weeklyTrend, 1);

  const totalAssignmentPages = Math.ceil(stats.assignments.length / ASSIGNMENTS_PER_PAGE);
  const paginatedAssignments = stats.assignments.slice((assignmentPage - 1) * ASSIGNMENTS_PER_PAGE, assignmentPage * ASSIGNMENTS_PER_PAGE);

  const totalSessionPages = Math.ceil(stats.sessionHistory.length / SESSIONS_PER_PAGE);
  const paginatedSessions = stats.sessionHistory.slice((sessionPage - 1) * SESSIONS_PER_PAGE, sessionPage * SESSIONS_PER_PAGE);

  const allIncorrectAnswers = stats.sessionHistory.flatMap(session => 
    (session.incorrectAnswers || []).map((ans: any) => ({
      ...ans,
      sessionId: session.id,
      wordbookTitle: session.wordbookTitle,
      createdAt: session.createdAt
    }))
  );
  const handleRemoveIncorrect = (ans: any) => {
    setReviewConfirmItem(ans);
  };

  const confirmReview = async () => {
    if (!reviewConfirmItem) return;
    const ans = reviewConfirmItem;
    const id = `${ans.sessionId}-${ans.word}`;
    setProcessingId(id);
    setReviewConfirmItem(null);
    try {
      await markIncorrectAnswerReviewed(ans.sessionId, ans.word);
      PetService.addPoints(8);
      PetService.addXP(15);
      setRewardFeedback({ points: 8, xp: 15 });
      setTimeout(() => setRewardFeedback(null), 3000);
    } catch (error) {
      console.error('Action failed:', error);
      alert('처리에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setProcessingId(null);
    }
  };
  const activeIncorrectAnswers = allIncorrectAnswers.filter(ans => !ans.isReviewed);
  const totalWrongPages = Math.ceil(activeIncorrectAnswers.length / WRONG_PER_PAGE);
  const paginatedWrongAnswers = activeIncorrectAnswers.slice((wrongPage - 1) * WRONG_PER_PAGE, wrongPage * WRONG_PER_PAGE);

  const startReviewQuiz = () => {
    // Get unique incorrect answers (by word) - only non-reviewed ones
    const uniqueMap = new Map();
    activeIncorrectAnswers.forEach(ans => {
      if (!uniqueMap.has(ans.word)) {
        uniqueMap.set(ans.word, ans);
      }
    });
    
    const words = Array.from(uniqueMap.values());
    if (words.length === 0) return;
    
    // Shuffle words
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setReviewWords(shuffled);
    setCurrentReviewIndex(0);
    setReviewScore(0);
    setIsReviewFinished(false);
    setIsReviewQuizOpen(true);
    setupReviewQuestion(shuffled, 0);
  };

  const setupReviewQuestion = (words: any[], index: number) => {
    const current = words[index];
    
    // If the mistake record already has choices saved, use them
    if (current.choices && Array.from(current.choices).length >= 4) {
      setReviewOptions([...current.choices].sort(() => Math.random() - 0.5));
    } else {
      // Fallback logic for old records without saved choices
      const choices = [current.correctAnswer];
      
      // Pick 3 random distractors from other wrong answers or placeholders
      const otherAnswers = words
        .filter(w => w.correctAnswer !== current.correctAnswer)
        .map(w => w.correctAnswer);
      
      const distractors = [...new Set(otherAnswers)].sort(() => Math.random() - 0.5);
      choices.push(...distractors.slice(0, 3));
      
      // Fill with generic distractors if needed
      const fillers = ['알 수 없음', '모르겠어요', '공부 중', '복습 필요'];
      while (choices.length < 4) {
        const filler = fillers[Math.floor(Math.random() * fillers.length)];
        if (!choices.includes(filler)) choices.push(filler);
      }
      
      setReviewOptions(choices.sort(() => Math.random() - 0.5));
    }
    
    setSelectedReviewOption(null);
    setReviewResult(null);
  };

  const handleReviewAnswer = (optionIndex: number) => {
    if (reviewResult) return;
    
    setSelectedReviewOption(optionIndex);
    const isCorrect = reviewOptions[optionIndex] === reviewWords[currentReviewIndex].correctAnswer;
    setReviewResult(isCorrect ? 'correct' : 'wrong');
    
    if (isCorrect) {
      setReviewScore(prev => prev + 1);
    }
    
    setTimeout(() => {
      if (currentReviewIndex < reviewWords.length - 1) {
        setCurrentReviewIndex(prev => prev + 1);
        setupReviewQuestion(reviewWords, currentReviewIndex + 1);
      } else {
        setIsReviewFinished(true);
        // Award points and XP for finishing review
        const score = reviewScore + (isCorrect ? 1 : 0);
        PetService.addPoints(score * 8);
        PetService.addXP(score * 15);
      }
    }, 1500);
  };

  const toggleAssignmentDone = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'assignments', id), {
        isDone: !currentStatus
      });
    } catch (error) {
      console.error('Failed to update assignment status:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-12 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight flex items-center gap-3">
            나만의 학습 리포트
            {stats.hasNewAssignment && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white animate-bounce shadow-lg shadow-red-200">
                N
              </span>
            )}
          </h1>
          <p className="text-slate-500 font-medium">나의 학습 성장 과정을 한눈에 확인하세요.</p>
        </div>
      </header>

      {/* Assignments Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-12">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <ClipboardList className="text-blue-500" size={20} />
          과제
        </h3>
        
        <div className="space-y-4">
          {paginatedAssignments.map((item) => (
            <div key={item.id} className={`p-6 rounded-3xl border transition-all ${item.isNew ? 'bg-blue-50 border-blue-100 shadow-md shadow-blue-50' : item.isDone ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.isNew ? 'bg-blue-500 animate-pulse' : item.isDone ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {item.createdAt && formatDateWithDay(item.createdAt.toDate())} {item.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {item.isNew && (
                    <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black rounded-md uppercase">New</span>
                  )}
                  <button
                    onClick={() => toggleAssignmentDone(item.id, !!item.isDone)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black transition-all ${
                      item.isDone 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-emerald-300 hover:text-emerald-500'
                    }`}
                  >
                    <CheckCircle2 size={12} />
                    {item.isDone ? '완료됨' : '미완료'}
                  </button>
                </div>
              </div>
              <p className={`text-slate-700 font-medium leading-relaxed whitespace-pre-wrap ${item.isDone ? 'opacity-50 line-through' : ''}`}>
                {item.content}
              </p>
            </div>
          ))}

          {stats.assignments.length === 0 && (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList className="text-slate-200" size={32} />
              </div>
              <p className="text-slate-400 font-medium">아직 등록된 과제가 없습니다.</p>
            </div>
          )}

          {totalAssignmentPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-6">
              <button
                onClick={() => setAssignmentPage(prev => Math.max(1, prev - 1))}
                disabled={assignmentPage === 1}
                className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-2">
                {Array.from({ length: totalAssignmentPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setAssignmentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${assignmentPage === i + 1 ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAssignmentPage(prev => Math.min(totalAssignmentPages, prev + 1))}
                disabled={assignmentPage === totalAssignmentPages}
                className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <StatCard 
          icon={<BookOpen className="text-blue-500" />} 
          label="학습한 단어" 
          value={`${stats.learnedWords}개`} 
          color="bg-blue-50" 
        />
        <StatCard 
          icon={<Calendar className="text-emerald-500" />} 
          label="주간 출석률" 
          value={`${stats.weeklyAttendanceRate}%`} 
          color="bg-emerald-50" 
        />
        <StatCard 
          icon={<TrendingUp className="text-pastel-pink-500" />} 
          label="학습 성취도" 
          value={userRole === 'teacher' ? '선생님은 항상 최고예요! ✒️' : stats.evaluation} 
          color="bg-pastel-pink-50" 
          isEvaluation
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <BarChart3 className="text-pastel-pink-500" size={20} />
            주간 학습 추이 (최근 7일)
          </h3>
          <div className="h-48 flex items-end justify-between gap-2 px-4">
            {stats.weeklyTrend.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold text-slate-400 mb-1">{val > 0 ? `${val}개` : ''}</div>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${(val / maxTrend) * 100}%` }}
                  className="w-full bg-pastel-pink-100 rounded-t-lg hover:bg-pastel-pink-200 transition-colors min-h-[4px]"
                />
                <span className="text-[10px] font-bold text-slate-400">
                  {getDayLabel(i)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <Calendar className="text-emerald-500" size={20} />
            주간 출석 현황 (최근 7일)
          </h3>
          <div className="h-48 flex items-end justify-between gap-2 px-4">
            {stats.weeklyAttendanceTrend.map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-[10px] font-bold text-slate-400 mb-1">{val === 1 ? '출석' : ''}</div>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: val === 1 ? '100%' : '10%' }}
                  className={`w-full rounded-t-lg transition-colors ${val === 1 ? 'bg-emerald-100 hover:bg-emerald-200' : 'bg-slate-50'}`}
                />
                <span className="text-[10px] font-bold text-slate-400">
                  {getDayLabel(i)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-16">
        <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
          <TrendingUp className="text-pastel-pink-500" size={20} />
          학습 활동 로그
        </h3>
        <div className="space-y-3">
          {paginatedSessions.length > 0 ? (
            paginatedSessions.map((session, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center hover:bg-slate-100 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                    {session.type === 'quiz' && <CheckCircle2 size={18} />}
                    {session.type === 'flashcard' && <BookOpen size={18} />}
                    {session.type === 'match' && <Gamepad2 size={18} />}
                    {session.type === 'conjugation' && <TrendingUp size={18} />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{session.wordbookTitle}</div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {session.type === 'quiz' ? '객관식 퀴즈' : session.type === 'flashcard' ? '플래시카드' : session.type === 'match' ? '매치 게임' : '3단 변화 챌린지'} 
                      {' '}• {session.category === 'grammar' ? '문법' : '단어'} 
                      {' '}• {session.createdAt?.toMillis ? new Date(session.createdAt.toMillis()).toLocaleString() : '방금 전'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-pastel-pink-500 text-sm">{session.duration}초</div>
                  {session.score !== undefined && (
                    <div className="text-[10px] font-bold text-emerald-500">
                      정답: {session.score}/{session.totalItems}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-300 italic text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              최근 기록된 학습 활동이 아직 없습니다.
            </div>
          )}
        </div>

        {totalSessionPages > 1 && (
          <div className="flex justify-center items-center gap-4 pt-6">
            <button
              onClick={() => setSessionPage(prev => Math.max(1, prev - 1))}
              disabled={sessionPage === 1}
              className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex gap-2">
              {Array.from({ length: totalSessionPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSessionPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${sessionPage === i + 1 ? 'bg-pastel-pink-500 text-white shadow-lg shadow-pastel-pink-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSessionPage(prev => Math.min(totalSessionPages, prev + 1))}
              disabled={sessionPage === totalSessionPages}
              className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Incorrect Answers Section */}
      <div id="incorrect-answers-section" className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm mb-16">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <XCircle className="text-rose-500" size={20} />
            오답 노트
            {allIncorrectAnswers.length > 0 && (
              <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-full">
                총 {allIncorrectAnswers.length}개
              </span>
            )}
          </h3>
          {allIncorrectAnswers.length > 0 && (
            <button
              onClick={startReviewQuiz}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-black hover:bg-rose-600 shadow-lg shadow-rose-200 transition-all"
            >
              <RotateCcw size={14} />
              오답 다시 풀기
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          {paginatedWrongAnswers.length > 0 ? (
            paginatedWrongAnswers.map((ans, idx) => (
              <div key={idx} className="p-5 bg-rose-50/30 rounded-3xl border border-rose-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-rose-400 bg-white px-2 py-0.5 rounded-md border border-rose-100 uppercase tracking-tighter">
                      {ans.wordbookTitle}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {ans.createdAt?.toMillis ? new Date(ans.createdAt.toMillis()).toLocaleDateString() : '방금 전'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-lg font-black text-slate-900">
                      {ans.quizSentence ? (
                        <span className="italic">"{ans.quizSentence}"</span>
                      ) : (
                        ans.word
                      )}
                    </span>
                    {!ans.quizSentence && <span className="text-sm font-bold text-slate-500">{ans.meaning}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-4 bg-white/50 p-3 rounded-2xl border border-rose-50">
                    <div className="text-center px-4 border-r border-rose-100">
                      <div className="text-[10px] font-black text-rose-400 uppercase mb-0.5">내가 고른 답</div>
                      <div className="text-sm font-bold text-rose-600">{ans.userChoice}</div>
                    </div>
                    <div className="text-center px-4">
                      <div className="text-[10px] font-black text-emerald-400 uppercase mb-0.5">정답</div>
                      <div className="text-sm font-bold text-emerald-600">{ans.correctAnswer}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveIncorrect(ans)}
                    disabled={processingId === `${ans.sessionId}-${ans.word}`}
                    className={`p-3 rounded-2xl border transition-all shadow-sm group ${
                      processingId === `${ans.sessionId}-${ans.word}`
                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-wait'
                        : 'bg-white text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 hover:border-emerald-100 cursor-pointer'
                    }`}
                    title="복습 완료 (목록에서 제거)"
                  >
                    {processingId === `${ans.sessionId}-${ans.word}` ? (
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check size={20} className="group-hover:scale-110 transition-transform" />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="text-slate-200" size={32} />
              </div>
              <p className="text-slate-400 font-medium">아직 기록된 오답이 없습니다. 잘하고 있어요! 👍</p>
            </div>
          )}

          {totalWrongPages > 1 && (
            <div className="flex justify-center items-center gap-4 pt-6">
              <button
                onClick={() => setWrongPage(prev => Math.max(1, prev - 1))}
                disabled={wrongPage === 1}
                className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-2">
                {Array.from({ length: totalWrongPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setWrongPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${wrongPage === i + 1 ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setWrongPage(prev => Math.min(totalWrongPages, prev + 1))}
                disabled={wrongPage === totalWrongPages}
                className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review Quiz Modal/Overlay */}
      {isReviewQuizOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
          >
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">오답 다시 풀기</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                    Focus Mode • {currentReviewIndex + 1} / {reviewWords.length}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsReviewQuizOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              {!isReviewFinished ? (
                <div className="space-y-8">
                  <div className="text-center py-10 px-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="text-sm font-black text-rose-400 uppercase tracking-widest mb-4">
                        {reviewWords[currentReviewIndex].wordbookTitle}
                      </div>
                      <div className="text-3xl font-black text-slate-900 leading-tight mb-2">
                        {reviewWords[currentReviewIndex].quizSentence ? (
                          <div className="text-2xl italic">"{reviewWords[currentReviewIndex].quizSentence}"</div>
                        ) : (
                          reviewWords[currentReviewIndex].word
                        )}
                      </div>
                      <div className="text-slate-400 font-bold">
                        {reviewWords[currentReviewIndex].quizSentence ? (
                          <span className="text-xs">힌트: {reviewWords[currentReviewIndex].word} ({reviewWords[currentReviewIndex].meaning})</span>
                        ) : (
                          `뜻: ${reviewWords[currentReviewIndex].meaning}`
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {reviewOptions.map((option, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleReviewAnswer(idx)}
                        disabled={reviewResult !== null}
                        className={`w-full p-6 text-left rounded-[1.5rem] font-bold text-sm transition-all border-2 ${
                          selectedReviewOption === idx
                            ? reviewResult === 'correct'
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100'
                              : 'bg-rose-50 border-rose-500 text-rose-700 shadow-lg shadow-rose-100'
                            : reviewResult === 'wrong' && option === reviewWords[currentReviewIndex].correctAnswer
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-blue-50/30'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{option}</span>
                          {selectedReviewOption === idx && (
                            reviewResult === 'correct' ? <CheckCircle2 size={18} /> : <XCircle size={18} />
                          )}
                          {reviewResult === 'wrong' && option === reviewWords[currentReviewIndex].correctAnswer && (
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 px-6">
                  <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 relative">
                    <Trophy className="text-rose-500" size={48} />
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 bg-emerald-500 text-white p-2 rounded-full shadow-lg"
                    >
                      <CheckCircle2 size={20} />
                    </motion.div>
                  </div>
                  
                  <h3 className="text-3xl font-black text-slate-900 mb-2">복습 완료!</h3>
                  <p className="text-slate-500 font-medium mb-8">
                    총 <span className="text-rose-500 font-black">{reviewWords.length}</span>문제 중 <span className="text-emerald-500 font-black">{reviewScore}</span>문제를 맞혔습니다.
                  </p>

                  <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 mb-6">
                    <div className="text-emerald-600 font-black text-lg">
                       🎉 +{reviewScore * 8} 포인트를 획득했어요!
                    </div>
                    <div className="text-emerald-500 font-bold">
                       +{reviewScore * 15} XP를 획득했어요!
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-10">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">정답률</div>
                    <div className="text-4xl font-black text-slate-900">{Math.round((reviewScore / reviewWords.length) * 100)}%</div>
                  </div>

                  <button
                    onClick={() => setIsReviewQuizOpen(false)}
                    className="w-full py-5 bg-rose-500 text-white rounded-[2rem] font-black hover:bg-rose-600 shadow-xl shadow-rose-200 transition-all flex items-center justify-center gap-3 group"
                  >
                    리포트로 돌아가기
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Review Confirmation Modal */}
      <AnimatePresence>
        {reviewConfirmItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="text-emerald-500" size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">복습을 완료했나요?</h3>
              <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                확인 버튼을 누르면 이 단어가 오답 목록에서 사라지고 <span className="text-emerald-500 font-bold">복습 완료</span> 상태가 됩니다.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setReviewConfirmItem(null)}
                  className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={confirmReview}
                  className="py-4 bg-emerald-500 text-white rounded-2xl font-black hover:bg-emerald-600 shadow-lg shadow-emerald-200 transition-all"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rewardFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 font-black"
          >
            <Sparkles size={20} />
            <span>복습 완료! +{rewardFeedback.points}P / +{rewardFeedback.xp}XP</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, color, isEvaluation }: { icon: React.ReactNode; label: string; value: string; color: string; isEvaluation?: boolean }) {
  return (
    <div className={`p-8 rounded-[2.5rem] ${color} border border-white/50 shadow-sm flex flex-col gap-4 ${isEvaluation ? 'md:col-span-1' : ''}`}>
      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-slate-500 mb-1">{label}</div>
        <div className={`${isEvaluation ? 'text-base' : 'text-3xl'} font-black text-slate-900 leading-tight`}>{value}</div>
      </div>
    </div>
  );
}

function ActivityItem({ label, time }: { label: string; time: string }) {
  return (
    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="text-xs text-slate-400 font-medium">{time}</span>
    </div>
  );
}
