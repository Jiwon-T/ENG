import React, { useState, useEffect, Suspense, lazy, Component } from 'react';
import { auth, db, recordAttendance, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, setDoc } from 'firebase/firestore';
import { Sparkles, Languages, Loader2, LogOut, User as UserIcon, ExternalLink, ArrowRight, AlertTriangle, RefreshCw, Menu, History, BarChart3, Users, Download, Share, Smartphone, X as CloseIcon, Info, Plus, Dog } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AnalysisResult, QuestionType } from './lib/gemini';

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all whitespace-nowrap ${
        active 
          ? 'bg-pastel-pink-500 text-white shadow-lg shadow-pastel-pink-100' 
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MenuNavItem({ icon, label, onClick, active, badge }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean, badge?: string | null }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl transition-all duration-200 group ${
        active 
          ? 'bg-pastel-pink-50 text-pastel-pink-600' 
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl transition-colors ${
          active ? 'bg-white' : 'bg-slate-50 group-hover:bg-white'
        }`}>
          {React.cloneElement(icon as React.ReactElement, { size: 18 })}
        </div>
        <span className="text-sm font-bold">{label}</span>
      </div>
      {badge && (
        <span className="px-2 py-0.5 bg-red-500 text-[8px] font-black text-white rounded-full animate-pulse uppercase">
          {badge}
        </span>
      )}
      <ArrowRight size={14} className={`opacity-0 group-hover:opacity-100 transition-all ${active ? 'opacity-100' : ''}`} />
    </button>
  );
}

// Simple Error Boundary Component
class ErrorBoundary extends (Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 text-red-500">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">문제가 발생했습니다.</h2>
          <p className="text-slate-500 mb-8 font-medium">화면을 불러오는 중 오류가 발생했습니다.<br />잠시 후 다시 시도해주세요.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-pastel-pink-200"
          >
            <RefreshCw size={18} />
            페이지 새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load heavy components
const Login = lazy(() => import('./components/auth/Login'));
const Home = lazy(() => import('./components/Home'));
const AnalysisView = lazy(() => import('./components/AnalysisView'));
const TeacherRoom = lazy(() => import('./components/teacher/TeacherRoom'));
const WordbookView = lazy(() => import('./components/student/WordbookView'));
const LearningReport = lazy(() => import('./components/student/LearningReport'));
const ArchiveView = lazy(() => import('./components/student/ArchiveView'));
const PetHome = lazy(() => import('./components/pet/PetHome'));

type View = 'home' | 'analyzer' | 'generator' | 'vocab' | 'grammar' | 'tutor' | 'report' | 'archive' | 'teacher-room' | 'pet';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  alias?: string; // Add alias field
  role: 'teacher' | 'student' | 'admin';
  photoURL?: string;
  isNameSet?: boolean; // Track if user has explicitly set their name
}

// Helper to run teacher seeding logic
const runTeacherSeeding = async () => {
  try {
    const [{ seedIrregularVerbs }, { seedObjectPatternGrammar, seedComplementGrammar, seedConversionGrammar, seedRelativeGrammar, seedModalGrammar }] = await Promise.all([
      import('./lib/irregularVerbsData'),
      import('./lib/grammarSets')
    ]);
    seedIrregularVerbs();
    seedObjectPatternGrammar();
    seedComplementGrammar();
    seedConversionGrammar();
    seedRelativeGrammar();
    seedModalGrammar();
  } catch (error) {
    console.error('Seeding failed:', error);
  }
};

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
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>([]);
  const [hasNewAssignment, setHasNewAssignment] = useState(false);
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newName, setNewName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);

  useEffect(() => {
    // Detect platform
    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) setPlatform('ios');
    else if (/Android/.test(ua)) setPlatform('android');

    // Detect if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsPWAInstalled(true);
    }

    // Capture install prompt for Android
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPWAInstalled(true);
      }
      setDeferredPrompt(null);
    }
  };

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
      setAuthLoading(true);
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const { ensureUserDocExists } = await import('./lib/firebase');
          await ensureUserDocExists(firebaseUser);
          
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            let data = userDoc.data() as UserProfile;
            
            // Force update role for teacher email if it's currently student
            if (firebaseUser.email === 'lizzieshere1@gmail.com' && data.role !== 'teacher') {
              data = { ...data, role: 'teacher' as const };
              setDoc(userDocRef, { role: 'teacher' }, { merge: true }).catch(e => console.error('Silent role update failed:', e));
              setTimeout(runTeacherSeeding, 1000); // Defer seeding
            }
            
            setProfile(data);
            
            // If student hasn't set their name yet, show the modal
            if (data.role === 'student' && !data.isNameSet) {
              setNewName(data.alias || data.name || '');
              setShowNameEditModal(true);
            }

            if (data.role === 'teacher') {
              setTimeout(runTeacherSeeding, 1000); // Defer seeding
            }
          } else {
            console.warn('User doc still does not exist after ensureUserDocExists');
            // Mock profile if firestore is lagging
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || '사용자',
              role: firebaseUser.email === 'lizzieshere1@gmail.com' ? 'teacher' : 'student'
            });
          }
        } catch (error: any) {
          console.error('Failed to manage user profile:', error);
          // Fallback profile for any load failure to keep the app functional
          setProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '사용자',
            role: firebaseUser.email === 'lizzieshere1@gmail.com' ? 'teacher' : 'student'
          });
        }
      } else {
        setProfile(null);
        setHasNewAssignment(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []); // Singleton listener

  // Listener for new assignments (student only)
  useEffect(() => {
    if (!user) {
      setHasNewAssignment(false);
      return;
    }

    const q = query(
      collection(db, 'assignments'),
      where('studentUid', '==', user.uid),
      where('isNew', '==', true)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasNewAssignment(!snapshot.empty);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAnalyze = async (shouldGenerate: boolean, questionsOnly: boolean = false) => {
    if (!text.trim()) return;
    
    setLoading(true);
    setError(null);
    setResult(null); // Clear previous result
    try {
      const { analyzeEnglishText } = await import('./lib/gemini');
      const analysis = await analyzeEnglishText(text, shouldGenerate, selectedQuestionTypes, questionsOnly);
      setResult(analysis);
      setCurrentView(questionsOnly ? 'generator' : 'analyzer');
      
      // Save to history
      if (user) {
        const { saveAnalysisHistory, saveGeneratorHistory } = await import('./lib/firebase');
        if (questionsOnly) {
          saveGeneratorHistory(user.uid, text, analysis);
        } else {
          saveAnalysisHistory(user.uid, text, analysis);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '분석 중 오류가 발생했습니다. 다시 시도해주세요.');
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
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl animate-bounce">🏫</div>
          </div>
        </div>
      }>
        <Login />
      </Suspense>
    );
  }

  return (
    <ErrorBoundary>
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
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 rounded-full border border-slate-100 shadow-sm transition-all active:scale-[0.98] relative"
          >
            {hasNewAssignment && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-bounce" />
            )}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-pastel-pink-100 rounded-lg flex items-center justify-center text-sm shadow-inner overflow-hidden">
                {profile?.photoURL && profile.photoURL.startsWith('http') ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{profile?.photoURL || '👤'}</span>
                )}
              </div>
              <span className="text-xs font-bold text-slate-600">
                {profile?.alias || profile?.name}님
              </span>
              <Menu size={16} className="text-slate-400" />
            </div>
          </button>
        </div>
      </nav>

      {/* Side Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm no-print"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[300px] z-[70] bg-white shadow-2xl flex flex-col no-print"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-start">
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => setShowIconPicker(true)}
                    className="relative group w-16 h-16"
                  >
                    <div className="w-16 h-16 bg-pastel-pink-100 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner overflow-hidden group-hover:bg-pastel-pink-200 transition-colors">
                      {profile?.photoURL && profile.photoURL.startsWith('http') ? (
                        <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{profile?.photoURL || '👤'}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center text-pastel-pink-500 border border-slate-50 group-hover:scale-110 transition-transform">
                      <Plus size={12} />
                    </div>
                  </button>
                  <div>
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tight">
                      {profile?.alias || profile?.name}님
                    </div>
                    <div className="text-[11px] text-pastel-pink-500 font-black uppercase tracking-widest mt-1">
                      {profile?.role === 'teacher' ? '관리자 선생님' : '수강생'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 text-slate-300 hover:text-slate-500 transition-colors mt-[-8px] mr-[-8px]"
                >
                  <CloseIcon size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                <MenuNavItem 
                  icon={<History size={18} />} 
                  label="보관소" 
                  onClick={() => { setCurrentView('archive'); setIsMenuOpen(false); }}
                  active={currentView === 'archive'}
                />
                <MenuNavItem 
                  icon={<BarChart3 size={18} />} 
                  label="학습 리포트" 
                  onClick={() => { setCurrentView('report'); setIsMenuOpen(false); }}
                  active={currentView === 'report'}
                  badge={hasNewAssignment ? 'NEW' : null}
                />
                {(profile?.role === 'teacher' || profile?.role === 'admin') && (
                  <MenuNavItem 
                    icon={<Users size={18} />} 
                    label="선생님방" 
                    onClick={() => { setCurrentView('teacher-room'); setIsMenuOpen(false); }}
                    active={currentView === 'teacher-room'}
                  />
                )}
                
                <MenuNavItem 
                  icon={<Dog size={18} />} 
                  label="펫 키우기" 
                  onClick={() => { setCurrentView('pet'); setIsMenuOpen(false); }}
                  active={currentView === 'pet'}
                />
              
              <div className="pt-4 mt-4">
                  <button
                    onClick={() => { logout(); setIsMenuOpen(false); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all font-bold text-xs"
                  >
                    <LogOut size={14} />
                    로그아웃
                  </button>
                </div>
              </div>

              {/* PWA Promotion */}
              {!isPWAInstalled && (
                <div className="p-6">
                  <div className="bg-gradient-to-br from-pastel-pink-50 to-rose-50 rounded-[2rem] p-6 border border-pastel-pink-100/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-pastel-pink-100/20 rounded-full -mr-10 -mt-10 blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    
                    <div className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-pastel-pink-500 shadow-sm">
                          <Smartphone size={24} />
                        </div>
                        <div className="text-xs font-black text-slate-800 leading-snug">
                          앱으로 설치해서 더<br />
                          <span className="text-pastel-pink-500">쾌적하게 학습하세요!</span>
                        </div>
                      </div>
                      
                      {platform === 'ios' ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold bg-white/60 backdrop-blur-sm rounded-lg px-3 py-2">
                            <Share size={12} className="text-pastel-pink-500" />
                            <span>하단 공유 버튼 클릭</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold bg-white/60 backdrop-blur-sm rounded-lg px-3 py-2">
                            <Plus className="bg-pastel-pink-500 text-white rounded p-0.5" size={14} />
                            <span>'홈 화면에 추가' 선택</span>
                          </div>
                        </div>
                      ) : platform === 'android' ? (
                        <button
                          onClick={handleInstallClick}
                          className="w-full py-3.5 bg-pastel-pink-500 text-white rounded-2xl font-black text-xs shadow-lg shadow-pastel-pink-100 hover:bg-pastel-pink-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <Download size={14} />
                          간편 설치하기
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium justify-center italic">
                          <Info size={12} />
                          모바일 기기에서 설치 가능합니다
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 text-pastel-pink-500 animate-spin" />
            <p className="text-slate-400 font-bold text-sm">불러오는 중...</p>
          </div>
        }>
          {currentView === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Home 
                onNavigate={setCurrentView} 
                userRole={profile?.role} 
                hasNewAssignment={hasNewAssignment}
              />
            </motion.div>
          ) : currentView === 'pet' ? (
            <motion.div
              key="pet"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <PetHome onBack={() => setCurrentView('home')} />
            </motion.div>
          ) : currentView === 'analyzer' ? (
            <motion.div
              key="analyzer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pt-12"
            >
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
                            { id: 'blank' as QuestionType, label: '빈칸 추론' },
                            { id: 'grammar' as QuestionType, label: '어법 수정' },
                            { id: 'summary' as QuestionType, label: '요약문 완성' },
                            { id: 'gist' as QuestionType, label: '요지 파악' },
                            { id: 'ordering' as QuestionType, label: '순서 배열' },
                            { id: 'insertion' as QuestionType, label: '문장 삽입' },
                            { id: 'claim' as QuestionType, label: '필자의 주장' },
                            { id: 'topic' as QuestionType, label: '주제 파악' },
                            { id: 'title' as QuestionType, label: '제목 추론' },
                            { id: 'consistency' as QuestionType, label: '내용 일치/불일치' },
                            { id: 'irrelevant' as QuestionType, label: '무관한 문장' },
                            { id: 'workbook' as QuestionType, label: '빈칸 워크북' },
                          ].map((type) => (
                            <label key={type.id} className="flex items-center gap-2 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={selectedQuestionTypes.includes(type.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedQuestionTypes([...selectedQuestionTypes, type.id]);
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
          ) : currentView === 'vocab' || currentView === 'grammar' ? (
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <WordbookView isMobile={isMobile} category={currentView === 'grammar' ? 'grammar' : 'word'} />
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
        </Suspense>
      </AnimatePresence>

      {/* Footer Decoration */}
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pastel-pink-200 via-pastel-pink-400 to-pastel-pink-200 opacity-50" />
    </div>
      <AnimatePresence>
        {showIconPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIconPicker(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center"
            >
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">아이콘 선택</h2>
              <p className="text-slate-500 mb-8 font-medium">나를 표현하는 아이콘을 골라보세요!</p>
              
              <div className="grid grid-cols-5 gap-3 max-h-[300px] overflow-y-auto no-scrollbar p-2">
                {['🦊', '🐰', '🐯', '🐼', '🦁', '🐥', '🐱', '🐶', '🦄', '🐨', '🍎', '⭐️', '🎨', '🚀', '💡', '🌈', '🍦', '🍩', '🥑', '👾'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={async () => {
                      if (!user) return;
                      try {
                        const userDocRef = doc(db, 'users', user.uid);
                        await setDoc(userDocRef, { photoURL: emoji }, { merge: true });
                        setProfile(prev => prev ? { ...prev, photoURL: emoji } : null);
                        setShowIconPicker(false);
                      } catch (err) {
                        console.error('Failed to update icon:', err);
                      }
                    }}
                    className="aspect-square flex items-center justify-center text-3xl hover:bg-pastel-pink-50 rounded-2xl transition-all hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowIconPicker(false)}
                className="mt-8 w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}

        {showNameEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-pastel-pink-100 rounded-2xl flex items-center justify-center mb-6 mx-auto text-pastel-pink-500">
                <UserIcon size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">이름 설정하기</h2>
              <p className="text-slate-500 mb-6 font-medium leading-relaxed">
                선생님이 확인하실 수 있도록<br />
                <span className="text-slate-900 font-bold">학생 본인의 이름</span>을 설정해 주세요.
              </p>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="자기 이름을 입력하세요"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-pastel-pink-200 focus:ring-4 focus:ring-pastel-pink-50 transition-all font-bold text-center text-lg"
                  autoFocus
                />
                
                <button
                  onClick={async () => {
                    if (!newName.trim() || !user) return;
                    setIsUpdatingName(true);
                    try {
                      const userDocRef = doc(db, 'users', user.uid);
                      await setDoc(userDocRef, { 
                        alias: newName.trim(),
                        isNameSet: true 
                      }, { merge: true });
                      
                      setProfile(prev => prev ? { 
                        ...prev, 
                        alias: newName.trim(),
                        isNameSet: true 
                      } : null);
                      
                      setShowNameEditModal(false);
                    } catch (err) {
                      console.error('Failed to update name:', err);
                    } finally {
                      setIsUpdatingName(false);
                    }
                  }}
                  disabled={isUpdatingName || !newName.trim()}
                  className="w-full py-4 bg-pastel-pink-500 text-white rounded-2xl font-black shadow-lg shadow-pastel-pink-200 hover:bg-pastel-pink-600 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isUpdatingName ? '저장 중...' : '설정 완료'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
