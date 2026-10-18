import AiThinking, { addThought } from './components/AiThinking';
import { studentReportCache } from './lib/studentReportCache';
import React, { useState, useEffect, Suspense, lazy, Component } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { auth, db, recordAttendance, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, where, setDoc } from 'firebase/firestore';
import { ChevronLeft, Home as HomeIcon, Sparkles, Languages, Loader2, LogOut, User as UserIcon, ExternalLink, ArrowRight, AlertTriangle, RefreshCw, Menu, BarChart3, Users, Download, Share, Smartphone, X as CloseIcon, Info, Plus, Dog, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { RecentLearning } from './lib/recentLearning';
import { AppChrome } from './lib/appChrome';
import { lastSignedOut, loadLogin, rememberSignedIn } from './lib/authHint';
import { NibTile } from './components/RosyLogo';
import { PassBadge } from './components/PassBadge';
import { PetService, type PetSummary } from './lib/petService';
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
const Login = lazy(loadLogin);
const Home = lazy(() => import('./components/Home'));
const AnalysisView = lazy(() => import('./components/AnalysisView'));
const PassageAnalyzer = lazy(() => import('./components/passage/PassageAnalyzer'));
const QuestionGenerator = lazy(() => import('./components/generator/QuestionGenerator'));
const TeacherRoom = lazy(() => import('./components/teacher/TeacherRoom'));
const WordbookView = lazy(() => import('./components/student/WordbookView'));
const LearningReport = lazy(() => import('./components/student/LearningReport'));
const PetHome = lazy(() => import('./components/pet/PetHome'));
const ParentReportView = lazy(() => import('./components/parent/ParentReportView').then(m => ({ default: m.ParentReportView })));

/** 변형문제 생성기: question types made in one go (fewer at a time lets the AI think them through carefully). */
const MAX_QUESTION_TYPES = 3;
type View = 'home' | 'analyzer' | 'generator' | 'vocab' | 'grammar' | 'exam' | 'sentence' | 'tutor' | 'report' | 'teacher-room' | 'pet';
/** The screen's name in the top bar (the same words as on the home tiles and in the menu). */
const VIEW_TITLES: Partial<Record<View, string>> = { analyzer: '지문 분석기', generator: '문제 생성기', vocab: '단어 세트', grammar: '문법 세트', exam: '시험기간', sentence: '문장 세트', tutor: 'AI 튜터', report: '학습 리포트', pet: '나만의 펫' };

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  alias?: string; // Add alias field
  role: 'teacher' | 'student' | 'admin' | 'principal';
  photoURL?: string;
  isNameSet?: boolean; // Track if user has explicitly set their name
}

// Helper to run teacher seeding logic
// Runs only when the built-in grammar data differs from what this device last synced: each seed deletes and rewrites
// its words, which held up every read after an admin login (시험기간, 단어장) and gave the words new ids each time.
let seedingStarted = false;
const runTeacherSeeding = async () => {
  if (seedingStarted) return;
  seedingStarted = true;
  try {
    const modules = await Promise.all([
      import('./lib/irregularVerbsData'),
      import('./lib/grammarSets'),
      import('./lib/comparativeData'),
      import('./lib/grammarCrammingPool')
    ]);
    const [{ seedIrregularVerbs }, { seedObjectPatternGrammar, seedComplementGrammar, seedConversionGrammar, seedRelativeGrammar, seedModalGrammar, seedBasicModalGrammar, seedVerbFormGrammar, seedGrammarCramming }, { seedComparativeGrammar }] = modules;
    // The version covers every data module the seeds read and the seed functions themselves (titles and field mapping
    // written inside them), so a change to any of them syncs again once.
    const text = JSON.stringify(modules.map(m => Object.entries(m).map(([k, v]) => [k, typeof v === 'function' ? String(v) : v])));
    let hash = 0; for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
    const key = `grammar-seed:${auth.currentUser?.uid || ''}`, version = `${text.length}:${hash}`;
    try { if (localStorage.getItem(key) === version) return; } catch { /* no storage: seed as before */ }
    const results = await Promise.allSettled([seedIrregularVerbs(), seedComparativeGrammar(), seedObjectPatternGrammar(), seedComplementGrammar(), seedConversionGrammar(),
      seedRelativeGrammar(), seedModalGrammar(), seedBasicModalGrammar(), seedVerbFormGrammar(), seedGrammarCramming()]);
    // Remembered only when every set synced; otherwise the next login tries again.
    if (results.every(r => r.status === 'fulfilled')) { try { localStorage.setItem(key, version); } catch { /* optional */ } }
    else console.error('Seeding failed:', 'SEED_PARTIAL');
  } catch {
    console.error('Seeding failed:', 'SEED_FAILED');
  }
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Signed out last time: show the login screen without waiting for Firebase to finish restoring.
  const [assumeSignedOut, setAssumeSignedOut] = useState(lastSignedOut);
  const [currentView, setCurrentView] = useState<View>('home');
  const [isMobile, setIsMobile] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateQuestions, setGenerateQuestions] = useState(false);
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>([]);
  // "AI가 생각하는 중": the model's thought summaries while the analyzer or generator works; calls left this month.
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [aiLeft, setAiLeft] = useState<number | null>(null);
  const [resumeTarget, setResumeTarget] = useState<RecentLearning | null>(null);
  const [pendingAssignmentCount, setPendingAssignmentCount] = useState<number | null>(null);
  const [hasNewAssignment, setHasNewAssignment] = useState(false);
  // Pet points (home chip) and the AI pass (badge by the menu button); read again whenever home opens.
  // Kept with the uid it belongs to: after signing out or switching accounts the old points and badge never show.
  const [petSummaryOf, setPetSummaryOf] = useState<{ uid: string; summary: PetSummary } | null>(null);
  const petSummary = user && petSummaryOf?.uid === user.uid ? petSummaryOf.summary : null;
  // Home's 워크북 opens 선생님방 on that tab; the 선생님방 row opens it as usual.
  const [teacherStartTab, setTeacherStartTab] = useState<string | undefined>(undefined);
  useEffect(() => { if (currentView !== 'teacher-room') setTeacherStartTab(undefined); }, [currentView]);
  useEffect(() => { if (!user) { setPetSummaryOf(null); return; } if (currentView !== 'home') return; const uid = user.uid; let live = true; PetService.summary().then(summary => { if (live) setPetSummaryOf({ uid, summary }); }).catch(() => undefined); return () => { live = false; }; }, [user, currentView]);
  const [showNameEditModal, setShowNameEditModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newName, setNewName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  // Opened from the pencil (a change, can be cancelled) rather than the required first-time prompt.
  const [nameEditByChoice, setNameEditByChoice] = useState(false);
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
      studentReportCache.invalidate();
      setAuthLoading(true);
      setUser(firebaseUser);
      rememberSignedIn(Boolean(firebaseUser));setAssumeSignedOut(false);
      
      if (firebaseUser) {
        void import('./components/Home');
        try {
          const { ensureUserDocExists } = await import('./lib/firebase');
          const profileData = await ensureUserDocExists(firebaseUser, undefined, true);
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          if (profileData) {
            let data = profileData as UserProfile;
            
            // Force update role for teacher email if it's currently student
            if (firebaseUser.email === 'lizzieshere1@gmail.com' && data.role !== 'teacher') {
              data = { ...data, role: 'teacher' as const };
              setDoc(userDocRef, { role: 'teacher' }, { merge: true }).catch(e => console.error('Silent role update failed:', e));
              setTimeout(runTeacherSeeding, 1000); // Defer seeding
            }
            
            setProfile(data);
            // Fetch the screen people open next while the home is idle, so the first click doesn't wait for the download.
            const prefetch = ['teacher', 'principal', 'admin'].includes(data.role) ? () => import('./components/teacher/TeacherRoom') : () => import('./components/pet/PetHome');
            const idle = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
            const prefetchAll = () => { void prefetch().catch(() => {}); void import('./components/student/WordbookView').catch(() => {}); };
            if (idle) idle(prefetchAll); else setTimeout(prefetchAll, 1500);
            
            if (firebaseUser.email === 'lizzieshere1@gmail.com') {
              setTimeout(runTeacherSeeding, 1000); // Defer seeding
            }
            
            if (data.role === 'student' && !data.isNameSet) {
              setNewName(data.alias || data.name || '');
              setShowNameEditModal(true);
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
    setPendingAssignmentCount(null);
    if (!user) {
      setHasNewAssignment(false);
      return;
    }

    const q = query(
      collection(db, 'assignments'),
      where('studentUid', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHasNewAssignment(snapshot.docs.some(d => d.data().isNew));
      setPendingAssignmentCount(snapshot.docs.filter(d => !d.data().isDone).length);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAnalyze = async (shouldGenerate: boolean, questionsOnly: boolean = false) => {
    if (!text.trim()) return;
    
    setLoading(true);
    setError(null);
    setThoughts([]);
    setResult(null); // Clear previous result
    try {
      const { analyzeEnglishText } = await import('./lib/gemini');
      const analysis = await analyzeEnglishText(text, shouldGenerate, selectedQuestionTypes, questionsOnly, piece => setThoughts(list => addThought(list, piece)), setAiLeft);
      setResult(analysis);
      setCurrentView(questionsOnly ? 'generator' : 'analyzer');
      
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

  // 0. 학부모 고정 주소 (/:slug) 접근 시: 학생 로그인 없이 학부모 화면 서빙
  const getParentReportSlug = (): string | null => {
    if (typeof window === 'undefined') return null;
    const pathname = window.location.pathname;

    // 1) /report/:reportSlug 접근 시 즉시 /:reportSlug 로 301/replaceState 리다이렉트
    const reportMatch = pathname.match(/^\/report\/([a-z0-9]{3,30})$/);
    if (reportMatch) {
      const targetSlug = reportMatch[1];
      window.history.replaceState({}, '', `/${targetSlug}`);
      return targetSlug;
    }

    // 2) 최상위 예약 경로 제외한 단독 /:reportSlug
    const reservedList = [
      'api', 'admin', 'teacher', 'student', 'parent', 'report', 'reports',
      'login', 'logout', 'signup', 'register', 'home', 'profile', 'settings',
      'archive', 'analyzer', 'generator', 'library', 'auth', 'callback',
      'assets', 'static', 'favicon', 'robots', 'sitemap', 'manifest', 'health',
      'vocab', 'grammar', 'exam', 'tutor', 'teacher-room', 'pet', 'sw', 'icon'
    ];

    const slugMatch = pathname.match(/^\/([a-z0-9]{3,30})$/);
    if (slugMatch) {
      const candidate = slugMatch[1];
      if (!reservedList.includes(candidate)) {
        return candidate;
      }
    }

    return null;
  };

  const activeReportSlug = getParentReportSlug();

  if (activeReportSlug) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <ParentReportView
          reportSlug={activeReportSlug}
          onGoHome={() => {
            window.history.pushState({}, '', '/');
            window.location.href = '/';
          }}
        />
      </Suspense>
    );
  }

  if (authLoading && !(assumeSignedOut && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <NibTile size={72} className="animate-pulse" />
          <span className="sr-only">불러오는 중</span>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-4">
            <NibTile size={72} className="animate-pulse" />
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
      {/* Global Navigation Bar (the teacher room shows these controls in its own header row) */}
      {currentView !== 'teacher-room' && currentView !== 'home' && (
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[#f3e6e8] px-4 md:px-6 py-2.5 flex justify-between items-center gap-2 no-print">
        {/* One row for every student screen: '‹ 🏠' back home and the screen's name; on the right the screen's own item
            (the pet puts its points in #app-bar-extra) and the menu (avatar + ☰; the name is shown inside the menu). */}
        <div className="flex min-w-0 items-center gap-2.5">
          <button type="button" onClick={goHome} aria-label="홈으로 돌아가기" title="홈으로 돌아가기" className="flex flex-none items-center gap-px rounded-full border border-[#f3e6e8] bg-white py-1.5 pl-1.5 pr-2.5 text-[#8b2f40] transition-colors hover:border-[#eaa9b3] hover:bg-[#fef2f3]">
            <ChevronLeft size={16} aria-hidden="true" /><HomeIcon size={16} aria-hidden="true" />
          </button>
          <h1 className="truncate text-base font-black text-[#5e1e2a]">{VIEW_TITLES[currentView] || ''}</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <div id="app-bar-extra" className="flex items-center" />
          <button
            onClick={() => setIsMenuOpen(true)}
            aria-label={`메뉴 열기 (${profile?.alias || profile?.name || ''}님)`}
            className="flex items-center gap-1.5 rounded-full border border-[#f3e6e8] bg-white py-1 pl-1 pr-2.5 transition-colors hover:border-[#eaa9b3] hover:bg-[#fef2f3] active:scale-[0.98] relative"
          >
            {hasNewAssignment && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-bounce" />
            )}
            <PassBadge pass={petSummary?.pass} />
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 bg-pastel-pink-100 rounded-lg flex items-center justify-center text-sm shadow-inner overflow-hidden">
                {profile?.photoURL && profile.photoURL.startsWith('http') ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span>{profile?.photoURL || '👤'}</span>
                )}
              </div>
              <span className="hidden max-w-[4.5rem] truncate text-xs md:inline font-bold text-[#5e1e2a]">{profile?.alias || profile?.name || ''}</span>
              <Menu size={16} className="text-[#8b2f40]" aria-hidden="true" />
            </div>
          </button>
        </div>
      </nav>
      )}

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
                    <div className="text-2xl font-black text-slate-900 leading-tight tracking-tight flex items-center gap-2">
                      <span>{profile?.alias || profile?.name}님</span>
                      {/* App name: the student's own choice, changeable any time (the admin can also fix it in 앱 사용자). */}
                      <button type="button" aria-label="앱 이름 바꾸기" title="앱 이름 바꾸기"
                        onClick={() => { setNewName(profile?.alias || profile?.name || ''); setNameEditByChoice(true); setShowNameEditModal(true); }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-pastel-pink-500 hover:bg-pastel-pink-50 transition-colors">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="text-[11px] text-pastel-pink-500 font-black uppercase tracking-widest mt-1">
                      {profile?.email === 'lizzieshere1@gmail.com' ? '관리자 선생님' : profile?.role === 'principal' ? '원장 선생님' : profile?.role === 'teacher' || profile?.role === 'admin' ? '선생님' : '수강생'}
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
                  icon={<BarChart3 size={18} />} 
                  label="학습 리포트" 
                  onClick={() => { setCurrentView('report'); setIsMenuOpen(false); }}
                  active={currentView === 'report'}
                  badge={hasNewAssignment ? 'NEW' : null}
                />
                {(profile?.role === 'teacher' || profile?.role === 'admin' || profile?.role === 'principal') && (
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
        <ErrorBoundary>
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
                onNavigate={view => { setTeacherStartTab(view === 'workbook' ? 'workbook' : undefined); setCurrentView(view === 'workbook' ? 'teacher-room' : view); }} 
                userRole={profile?.role} 
                userEmail={profile?.email}
                studentLinked={Boolean((profile as any)?.notionStudentKey)}
                onLinked={key => setProfile(prev => prev ? ({ ...prev, notionStudentKey: key } as any) : prev)}
                hasNewAssignment={hasNewAssignment}
                userUid={user.uid}
                pendingAssignmentCount={pendingAssignmentCount}
                onResume={target => { setResumeTarget(target); setCurrentView(target.category === 'word' ? 'vocab' : target.category); }}
                displayName={profile?.alias || profile?.name}
                avatar={profile?.photoURL}
                onOpenMenu={() => setIsMenuOpen(true)}
                petSummary={petSummary}
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
          ) : currentView === 'analyzer' && user ? (
            <motion.div key="analyzer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* 지문 분석기 (Beta): app-first analysis, AI parts by button, shared stored analyses (components/passage). */}
              <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>}><PassageAnalyzer /></Suspense>
            </motion.div>
          ) : currentView === 'generator' && user ? (
            <motion.div key="generator" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* 변형 문제 만들기 (Beta): app-made types first, counted monthly (components/generator). */}
              <Suspense fallback={<p className="py-10 text-center text-sm text-slate-400">불러오는 중…</p>}><QuestionGenerator /></Suspense>
            </motion.div>
          ) : currentView === 'teacher-room' ? (
            <motion.div
              key="teacher-room"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <AppChrome.Provider value={{ home: goHome, openMenu: () => setIsMenuOpen(true), name: profile?.alias || profile?.name || '', photo: profile?.photoURL, alert: hasNewAssignment }}>
                <TeacherRoom onNavigate={setCurrentView} initialTab={teacherStartTab} />
              </AppChrome.Provider>
            </motion.div>
          ) : currentView === 'vocab' || currentView === 'grammar' || currentView === 'exam' || currentView === 'sentence' ? (
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <WordbookView 
                isMobile={isMobile}
                resumeTarget={resumeTarget}
                onResumeHandled={() => setResumeTarget(null)}
                category={currentView === 'grammar' ? 'grammar' : currentView === 'exam' ? 'exam' : currentView === 'sentence' ? 'sentence' : 'word'} 
                onNavigate={setCurrentView}
              />
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
      </ErrorBoundary>
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
              <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{nameEditByChoice ? '앱 이름 바꾸기' : '이름 설정하기'}</h2>
              <p className="text-slate-500 mb-6 font-medium leading-relaxed">
                {nameEditByChoice ? <>앱에서 보이는 이름을 바꿉니다.</> : <>선생님이 확인하실 수 있도록<br />
                <span className="text-slate-900 font-bold">학생 본인의 이름</span>을 설정해 주세요.</>}
              </p>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="자기 이름을 입력하세요"
                  value={newName}
                  maxLength={100}
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
                      setNameEditByChoice(false);
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
                {/* The first name is required; changing it later can be cancelled. */}
                {nameEditByChoice && (
                  <button type="button" onClick={() => { setShowNameEditModal(false); setNameEditByChoice(false); }} disabled={isUpdatingName}
                    className="w-full py-3 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all">
                    취소
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
