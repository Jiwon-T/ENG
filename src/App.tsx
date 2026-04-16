import React, { useState, useEffect } from 'react';
import { analyzeEnglishText, AnalysisResult, QuestionType } from './lib/gemini';
import AnalysisView from './components/AnalysisView';
import Home from './components/Home';
import Login from './components/auth/Login';
import TeacherRoom from './components/teacher/TeacherRoom';
import WordbookView from './components/student/WordbookView';
import LearningReport from './components/student/LearningReport';
import ArchiveView from './components/student/ArchiveView';
import { auth, db, logout, recordAttendance, saveAnalysisHistory, saveGeneratorHistory } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Sparkles, Languages, Loader2, ArrowRight, ChevronLeft, LogOut, User as UserIcon, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type View = 'home' | 'analyzer' | 'generator' | 'vocab' | 'tutor' | 'report' | 'archive' | 'teacher-room';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  photoURL?: string;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('home');
  const [isMobile, setIsMobile] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateQuestions, setGenerateQuestions] = useState(false);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>(['blank', 'grammar', 'summary', 'gist', 'workbook']);
  const [isKakao, setIsKakao] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf('kakao') > -1) {
      setIsKakao(true);
      // Try to force open in external browser
      const currentUrl = window.location.href;
      if (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1 || ua.indexOf('ipod') > -1) {
        // iOS KakaoTalk doesn't support the openExternalApp scheme well for all versions
        // but we can try or show the guide
      } else {
        // Android KakaoTalk
        window.location.href = 'kakaotalk://web/openExternalApp/?url=' + encodeURIComponent(currentUrl);
      }
    }
  }, []);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Record attendance
        recordAttendance(firebaseUser.uid);

        // Fetch profile
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          // Force update role for teacher email if it's currently student
          if (firebaseUser.email === 'lizzieshere1@gmail.com' && data.role !== 'teacher') {
            const updatedProfile = { ...data, role: 'teacher' as const };
            setProfile(updatedProfile);
            // Update Firestore in background
            import('firebase/firestore').then(({ setDoc }) => {
              setDoc(userDocRef, { role: 'teacher' }, { merge: true });
            });
          } else {
            setProfile(data);
          }
        }
      } else {
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAnalyze = async (shouldGenerate: boolean, questionsOnly: boolean = false) => {
    if (!text.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeEnglishText(text, shouldGenerate, selectedQuestionTypes, questionsOnly);
      setResult(analysis);
      
      // Save to history
      if (user) {
        if (currentView === 'generator') {
          saveGeneratorHistory(user.uid, text, analysis);
        } else {
          saveAnalysisHistory(user.uid, text, analysis);
        }
      }
    } catch (err) {
      console.error(err);
      setError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setText('');
    setError(null);
  };

  const goHome = () => {
    setCurrentView('home');
    reset();
  };

  if (isKakao) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-3xl flex items-center justify-center mb-8">
          <span className="text-4xl">💬</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-4">카카오톡 브라우저 안내</h2>
        <p className="text-slate-600 mb-8 font-medium leading-relaxed">
          구글 로그인은 보안 정책상<br />
          카카오톡 내 브라우저에서 이용이 어렵습니다.<br /><br />
          <span className="text-pastel-pink-500 font-bold">크롬(Chrome)</span>이나 <span className="text-pastel-pink-500 font-bold">사파리(Safari)</span> 등<br />
          외부 브라우저로 접속해주세요!
        </p>
        
        <div className="space-y-4 w-full max-w-xs">
          <button
            onClick={() => {
              const currentUrl = window.location.href;
              window.location.href = 'kakaotalk://web/openExternalApp/?url=' + encodeURIComponent(currentUrl);
            }}
            className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-yellow-100"
          >
            <ExternalLink size={20} />
            외부 브라우저로 열기
          </button>
          
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium">
              우측 상단 [︙] 또는 [공유] 버튼을 눌러<br />
              '다른 브라우저로 열기'를 선택하셔도 됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="text-4xl">🏫</div>
          <div className="text-slate-400 font-black tracking-widest animate-pulse uppercase text-xs">
            loading...
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen pb-20 bg-[#fafafa]">
      {/* Global Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex justify-between items-center no-print">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={goHome}>
          <div className="w-8 h-8 bg-pastel-pink-100 rounded-lg flex items-center justify-center text-sm group-hover:bg-pastel-pink-200 transition-colors">
            {currentView === 'home' ? '🏫' : '🏡'}
          </div>
          {currentView !== 'home' && (
            <span className="font-black text-slate-900 tracking-tight group-hover:text-pastel-pink-500 transition-colors">
              돌아가기
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-6 h-6 rounded-full" />
            ) : (
              <UserIcon size={16} className="text-slate-400" />
            )}
            <span className="text-xs font-bold text-slate-600">{profile?.name}님</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-pastel-pink-100 text-pastel-pink-600 rounded-md font-black uppercase">
              {profile?.role === 'teacher' ? '선생님' : '수강생'}
            </span>
          </div>
          <button
            onClick={() => logout()}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
            title="로그아웃"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {currentView === 'home' ? (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Home onNavigate={setCurrentView} userRole={profile?.role} />
          </motion.div>
        ) : currentView === 'analyzer' ? (
          <motion.div
            key="analyzer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pt-12"
          >
            {/* Header */}
            <header className="pb-8 text-center max-w-4xl mx-auto px-6 flex flex-col items-center">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
                지문 <span className="text-pastel-pink-500">분석기</span>
              </h1>
              <p className="text-slate-500 max-w-lg mx-auto font-medium">
                영어 지문을 붙여넣으면 분석해드려요.
              </p>
            </header>

            <main className="max-w-4xl mx-auto px-6">
              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.div
                    key="input"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-200/50 border border-blue-50"
                  >
                    <div className="mb-6">
                      <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                        영어 지문 입력
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="분석하고 싶은 영어 지문을 여기에 붙여넣으세요..."
                        className="w-full h-64 p-6 bg-blue-50/30 border-2 border-blue-100 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all resize-none text-lg leading-relaxed outline-none"
                      />
                    </div>

                    {error && (
                      <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={() => handleAnalyze(false)}
                      disabled={loading || !text.trim()}
                      className="w-full py-5 bg-blue-500 text-white rounded-2xl font-black text-xl shadow-lg shadow-blue-200 hover:bg-blue-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          AI가 분석 중...
                        </>
                      ) : (
                        <>
                          <Languages size={24} />
                          분석 시작하기
                          <ArrowRight size={24} />
                        </>
                      )}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-between items-center no-print">
                      <button
                        onClick={reset}
                        className="text-slate-400 hover:text-pastel-pink-500 font-bold text-sm transition-colors flex items-center gap-1"
                      >
                        ← 처음으로 돌아가기
                      </button>
                    </div>
                    <AnalysisView result={result} isMobile={isMobile} />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        ) : currentView === 'generator' ? (
          <motion.div
            key="generator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pt-12"
          >
            {/* Header */}
            <header className="pb-8 text-center max-w-4xl mx-auto px-6 flex flex-col items-center">
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
                문제 <span className="text-amber-500">생성기</span>
              </h1>
              <p className="text-slate-500 max-w-lg mx-auto font-medium">
                영어 지문을 붙여넣으면 변형 문제를 만들어드려요.
              </p>
            </header>

            <main className="max-w-4xl mx-auto px-6">
              <AnimatePresence mode="wait">
                {!result ? (
                  <motion.div
                    key="input-gen"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white p-8 rounded-3xl shadow-xl shadow-amber-200/50 border border-amber-50"
                  >
                    <div className="mb-6">
                      <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">
                        영어 지문 입력
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="문제를 생성하고 싶은 영어 지문을 여기에 붙여넣으세요..."
                        className="w-full h-64 p-6 bg-amber-50/30 border-2 border-amber-100 rounded-2xl focus:ring-4 focus:ring-amber-100 focus:border-amber-300 transition-all resize-none text-lg leading-relaxed outline-none"
                      />
                    </div>

                    <div className="mb-6 p-6 bg-white border-2 border-amber-100 rounded-2xl space-y-4">
                      <div className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2">생성할 문제 유형 선택 (최대 4개)</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { id: 'blank', label: '빈칸 추론' },
                          { id: 'grammar', label: '어법 수정' },
                          { id: 'summary', label: '요약문 완성' },
                          { id: 'gist', label: '요지 파악' },
                          { id: 'ordering', label: '순서 배열' },
                          { id: 'insertion', label: '문장 삽입' },
                          { id: 'claim', label: '필자의 주장' },
                          { id: 'topic', label: '주제 파악' },
                          { id: 'title', label: '제목 추론' },
                          { id: 'consistency', label: '내용 일치/불일치' },
                          { id: 'irrelevant', label: '무관한 문장' },
                          { id: 'workbook', label: '빈칸 워크북' },
                        ].map((type) => (
                          <label key={type.id} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedQuestionTypes.includes(type.id as QuestionType)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedQuestionTypes([...selectedQuestionTypes, type.id as QuestionType]);
                                } else {
                                  setSelectedQuestionTypes(selectedQuestionTypes.filter(t => t !== type.id));
                                }
                              }}
                              className="w-4 h-4 accent-amber-500 rounded"
                            />
                            <span className="text-sm font-medium text-slate-600 group-hover:text-amber-500 transition-colors">
                              {type.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (selectedQuestionTypes.length > 4) {
                          alert('문제 유형은 최대 4개까지 선택 가능합니다.');
                          return;
                        }
                        handleAnalyze(true, true);
                      }}
                      disabled={loading || !text.trim() || selectedQuestionTypes.length === 0}
                      className="w-full py-5 bg-amber-500 text-white rounded-2xl font-black text-xl shadow-lg shadow-amber-200 hover:bg-amber-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          AI가 문제 생성 중...
                        </>
                      ) : (
                        <>
                          <Sparkles size={24} />
                          문제 생성하기
                          <ArrowRight size={24} />
                        </>
                      )}
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="result-gen"
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-between items-center no-print">
                      <button
                        onClick={reset}
                        className="text-slate-400 hover:text-amber-500 font-bold text-sm transition-colors flex items-center gap-1"
                      >
                        ← 처음으로 돌아가기
                      </button>
                    </div>
                    <AnalysisView result={result} isMobile={isMobile} questionsOnly={true} />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </motion.div>
        ) : currentView === 'teacher-room' ? (
          <motion.div
            key="teacher-room"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <TeacherRoom />
          </motion.div>
        ) : currentView === 'vocab' ? (
          <motion.div
            key="vocab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <WordbookView isMobile={isMobile} />
          </motion.div>
        ) : currentView === 'report' ? (
          <motion.div
            key="report"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <LearningReport />
          </motion.div>
        ) : currentView === 'archive' ? (
          <motion.div
            key="archive"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ArchiveView />
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-screen text-center p-6"
          >
            <div className="w-20 h-20 bg-pastel-pink-100 rounded-3xl flex items-center justify-center mb-6">
              <Sparkles className="text-pastel-pink-500" size={40} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4">준비 중인 기능입니다</h2>
            <p className="text-slate-500 mb-8 font-medium">더 나은 학습 경험을 위해 열심히 개발하고 있어요!</p>
            <button
              onClick={goHome}
              className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
            >
              메인으로 돌아가기
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Decoration */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pastel-pink-200 via-pastel-pink-400 to-pastel-pink-200 opacity-50" />
    </div>
  );
}
