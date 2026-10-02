import TeacherWorkspace from './TeacherWorkspace';
import AcademicImport from './AcademicImport';
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Calendar, ClipboardList, Plus, Search, MoreVertical, Phone, GraduationCap, Clock, MessageSquare, Trash2, Save, X, FileSpreadsheet, BookOpen, BarChart3, Sparkles, FileText, Languages, History, Link } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDocs, writeBatch } from 'firebase/firestore';

const WordbookManager = lazy(() => import('./WordbookManager'));
import StudentReportManager from './StudentReportManager';
import { PetService } from '../../lib/petService';
import { PetCharacter } from '../pet/PetCharacters';
import { safeFetchJson } from '../../lib/safeFetchJson';

interface StudentUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
  alias?: string;
  teacherNote?: string;
  notionStudentKey?: string | null;
  petStats?: {
    points: number;
    totalXP: number;
    highestLevel: number;
    petName: string;
    character: string;
  };
}

interface NotionStudentSummary {
  studentKey: string;
  studentDisplayName: string;
  hasGuardianContact: boolean;
  enrollmentStatus: string;
  linkedFirebaseUid: string | null;
  reportSlug: string | null;
}

interface TeacherRoomProps {
  onNavigate?: (view: any) => void;
}

export default function TeacherRoom({ onNavigate }: TeacherRoomProps) {
  const [legacy, setLegacy] = useState(false);
  return legacy ? <><button type="button" onClick={() => setLegacy(false)} className="mx-4 mt-4 px-4 min-h-[44px] rounded-xl bg-pastel-pink-50 text-pastel-pink-600 text-sm font-bold">← 나의 선생님방</button><LegacyTeacherRoom onNavigate={onNavigate}/></> : <TeacherWorkspace onNavigate={onNavigate} onAccounts={() => setLegacy(true)}/>;
}
function LegacyTeacherRoom({ onNavigate }: TeacherRoomProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'wordbook' | 'grammar' | 'exam' | 'reports'>('students');
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [aliasValue, setAliasValue] = useState('');
  const [noteValue, setNoteValue] = useState('');
  const [selectedStudentUid, setSelectedStudentUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [notionStudents, setNotionStudents] = useState<NotionStudentSummary[]>([]);
  const [notionStudentTab, setNotionStudentTab] = useState<'enrolled' | 'other'>('enrolled');
  const [notionStudentSearch, setNotionStudentSearch] = useState('');
  const filteredNotionStudents = notionStudents.filter(student => {
    const isEnrolled = student.enrollmentStatus === '등록';
    const matchesTab = notionStudentTab === 'enrolled' ? isEnrolled : !isEnrolled;
    const search = notionStudentSearch.trim().toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
    const text = `${student.studentKey} ${student.studentDisplayName}`.toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
    return matchesTab && text.includes(search);
  });
  const [notionStudentsLoading, setNotionStudentsLoading] = useState(false);
  const [linkingStudentUid, setLinkingStudentUid] = useState<string | null>(null);

  // 최고 관리자(지원T) 여부 확인
  const isSuperAdmin = auth.currentUser?.email === 'lizzieshere1@gmail.com';

  const handleUpdateRole = async (targetUid: string, newRole: 'teacher' | 'student') => {
    if (!isSuperAdmin) {
      alert('선생님 권한 승격 및 변경은 최고 관리자(지원T)만 가능합니다.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', targetUid), { role: newRole });
    } catch (e: any) {
      console.error('Failed to change role:', e);
      alert('권한 변경 중 오류가 발생했습니다: ' + e.message);
    }
  };

  // 학부모 고정 주소 (reportSlug) 발급 모달 상태
  const [reportSlugModal, setReportSlugModal] = useState<{
    open: boolean;
    studentKey: string;
    studentName: string;
    reportSlug: string;
    guardianStatus: 'idle' | 'checking' | 'verified' | 'missing' | 'error';
    generatedUrl: string | null;
    copied: boolean;
    loading: boolean;
    errorMsg: string | null;
  }>({
    open: false,
    studentKey: '',
    studentName: '',
    reportSlug: '',
    guardianStatus: 'idle',
    generatedUrl: null,
    copied: false,
    loading: false,
    errorMsg: null,
  });

  const handleOpenReportSlugModal = async (studentKey: string, studentName: string) => {
    setReportSlugModal({
      open: true,
      studentKey,
      studentName,
      reportSlug: '',
      guardianStatus: 'checking',
      generatedUrl: null,
      copied: false,
      loading: false,
      errorMsg: null,
    });

    // 기존 발급된 슬러그가 있는지 조회
    try {
      if (!auth.currentUser) return;
      const idToken = await auth.currentUser.getIdToken();
      const res = await safeFetchJson<{ ok: boolean; reportSlug?: string; shortUrl?: string; reportUrl?: string }>(
        `/api/teacher/report-slug?studentKey=${encodeURIComponent(studentKey)}`,
        {
          headers: { 'Authorization': `Bearer ${idToken}` },
        }
      );
      if (res.ok && res.data?.reportSlug) {
        setReportSlugModal(prev => ({
          ...prev,
          reportSlug: res.data!.reportSlug!,
          guardianStatus: 'verified',
          generatedUrl: `https://jiwont.kr${res.data!.shortUrl || res.data!.reportUrl}`,
        }));
      } else {
        setReportSlugModal(prev => ({ ...prev, guardianStatus: 'idle' }));
      }
    } catch {
      setReportSlugModal(prev => ({ ...prev, guardianStatus: 'idle' }));
    }
  };

  const handleGenerateReportSlug = async () => {
    if (!reportSlugModal.reportSlug.trim()) {
      alert('리포트 고정 주소(영문 소문자/숫자 3~30자)를 입력해 주세요.');
      return;
    }

    setReportSlugModal(prev => ({ ...prev, loading: true, errorMsg: null }));
    try {
      if (!auth.currentUser) throw new Error('로그인이 필요합니다.');
      const idToken = await auth.currentUser.getIdToken();

      const res = await safeFetchJson<{
        ok: boolean;
        reportUrl?: string;
        shortUrl?: string;
        message?: string;
        error?: string;
      }>('/api/teacher/report-slug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          studentKey: reportSlugModal.studentKey,
          reportSlug: reportSlugModal.reportSlug.trim().toLowerCase(),
        }),
      });

      if (res.ok && res.data) {
        const fullUrl = `https://jiwont.kr${res.data.shortUrl || res.data.reportUrl}`;
        setReportSlugModal(prev => ({
          ...prev,
          generatedUrl: fullUrl,
          guardianStatus: 'verified',
          loading: false,
        }));
      } else {
        const errKey = res.data?.error;
        const fallbackMsg = res.userMessage || '고정 주소 발급에 실패했습니다. 다시 시도해 주세요.';
        setReportSlugModal(prev => ({
          ...prev,
          loading: false,
          errorMsg: res.data?.message || fallbackMsg,
          guardianStatus: errKey === 'GUARDIAN_CONTACT_MISSING' ? 'missing' : 'error',
        }));
      }
    } catch {
      setReportSlugModal(prev => ({
        ...prev,
        loading: false,
        errorMsg: '서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        guardianStatus: 'error',
      }));
    }
  };

  const loadNotionStudents = async () => {
    if (!auth.currentUser || !isSuperAdmin) return;
    setNotionStudentsLoading(true);
    const idToken = await auth.currentUser.getIdToken();
    const res = await safeFetchJson<{ ok: boolean; students: NotionStudentSummary[] }>(
      '/api/teacher/notion-students',
      { headers: { 'Authorization': `Bearer ${idToken}` } }
    );
    if (res.ok && Array.isArray(res.data?.students)) setNotionStudents(res.data.students);
    setNotionStudentsLoading(false);
  };

  const handleLinkStudentAccount = async (firebaseUid: string, studentKey: string) => {
    if (!auth.currentUser || !studentKey) return;
    setLinkingStudentUid(firebaseUid);
    const idToken = await auth.currentUser.getIdToken();
    const res = await safeFetchJson<{ ok: boolean; message?: string }>('/api/teacher/student-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ firebaseUid, studentKey }),
    });
    setLinkingStudentUid(null);
    if (!res.ok) {
      alert(res.data?.message || res.userMessage || '학생 계정 연결에 실패했습니다.');
      return;
    }
    await loadNotionStudents();
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch all users (students and teachers)
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => doc.data() as StudentUser);
      // Sort: Teacher first, then students by name/alias
      userData.sort((a, b) => {
        if (a.role === 'teacher') return -1;
        if (b.role === 'teacher') return 1;
        const nameA = a.alias || a.name;
        const nameB = b.alias || b.name;
        return nameA.localeCompare(nameB);
      });
      setStudents(userData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadNotionStudents().catch(() => setNotionStudentsLoading(false));
  }, [isSuperAdmin]);

  const handleUpdateAlias = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        alias: aliasValue.trim()
      });
      setEditingAlias(null);
    } catch (error) {
      console.error('Failed to update alias:', error);
      alert('이름 수정 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateNote = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        teacherNote: noteValue.trim()
      });
      setEditingNote(null);
    } catch (error) {
      console.error('Failed to update note:', error);
      alert('선생님 메모 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteStudent = async (uid: string) => {
    try {
      // Delete user document
      await deleteDoc(doc(db, 'users', uid));
      
      // Delete evaluation if exists
      await deleteDoc(doc(db, 'evaluations', uid));
      
      setConfirmDeleteUid(null);
    } catch (error) {
      console.error('Failed to withdraw student:', error);
      alert('탈퇴 처리 중 오류가 발생했습니다.');
    }
  };

  const navigateToReport = (uid: string) => {
    setSelectedStudentUid(uid);
    setActiveTab('reports');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      <header className="mb-8 md:mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">선생님방</h1>
        </div>
        
        <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 w-full md:w-auto overflow-x-auto no-scrollbar">
          <TabButton active={activeTab === 'students'} onClick={() => setActiveTab('students')} icon={<Users size={18} />} label="수강생 관리" />
          <TabButton active={activeTab === 'wordbook'} onClick={() => setActiveTab('wordbook')} icon={<BookOpen size={18} />} label="단어장 관리" />
          <TabButton active={activeTab === 'grammar'} onClick={() => setActiveTab('grammar')} icon={<Sparkles size={18} />} label="문법 세트 관리" />
          <TabButton active={activeTab === 'exam'} onClick={() => setActiveTab('exam')} icon={<FileText size={18} />} label="시험기간 관리" />
          <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<BarChart3 size={18} />} label="학습 리포트" />
          <div className="w-px h-6 bg-slate-100 mx-2 self-center hidden md:block" />
          {isSuperAdmin && (
            <>
              <button
                onClick={() => onNavigate?.('analyzer')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-blue-500 hover:bg-blue-50 transition-all whitespace-nowrap"
              >
                <Languages size={18} />
                지문 분석기
              </button>
              <button
                onClick={() => onNavigate?.('generator')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-amber-500 hover:bg-amber-50 transition-all whitespace-nowrap"
              >
                <Sparkles size={18} />
                문제 생성기
              </button>
              <button
                onClick={() => onNavigate?.('archive')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-50 transition-all whitespace-nowrap"
              >
                <History size={18} />
                보관소
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        <AnimatePresence mode="wait">
          {activeTab === 'students' && (
            <motion.div
              key="students"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div className="relative w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="학습자 이름/메모 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none transition-all text-sm font-medium"
                  />
                </div>

                <div className="text-xs font-semibold text-slate-500">
                  Notion 학생 {notionStudentsLoading ? '불러오는 중…' : `${notionStudents.length}명 연동 가능`}
                </div>
              </div>

              {isSuperAdmin && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 md:p-6 mb-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-black text-slate-900">Notion 학생 · 학부모 리포트</h3><AcademicImport />
                      <p className="text-xs text-slate-500 mt-1">앱 계정이 없는 학생도 학부모 링크를 발급할 수 있습니다.</p>
                    </div>
                    <button onClick={loadNotionStudents} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">새로고침</button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <div role="tablist" aria-label="Notion 학생 등록 상태" className="flex gap-2">
                      {([['enrolled', '재원생'], ['other', '이외']] as const).map(([tab, label]) => (
                        <button key={tab} type="button" role="tab" aria-selected={notionStudentTab === tab}
                          onClick={() => setNotionStudentTab(tab)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-bold ${notionStudentTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1">
                      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="search" aria-label="Notion 학생 검색" placeholder="학생 이름·학교·학년 검색"
                        value={notionStudentSearch} onChange={event => setNotionStudentSearch(event.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-200" />
                    </div>
                  </div>
                  {!notionStudentsLoading && filteredNotionStudents.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-500">{notionStudentSearch.trim() ? '검색 결과가 없습니다.' : '해당하는 학생이 없습니다.'}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                    {filteredNotionStudents.map(student => (
                      <div key={student.studentKey} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">{student.studentDisplayName}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {student.reportSlug ? `jiwont.kr/${student.reportSlug}` : '학부모 링크 미발급'} · {student.linkedFirebaseUid ? '학생 계정 연결됨' : '앱 계정 없음/미연결'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleOpenReportSlugModal(student.studentKey, student.studentDisplayName)}
                          disabled={!student.hasGuardianContact}
                          className="shrink-0 p-2 rounded-xl bg-indigo-600 text-white disabled:bg-slate-300"
                          title={student.hasGuardianContact ? '학부모 링크 관리' : 'Notion 보호자 연락처가 필요합니다'}
                        >
                          <Link size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 학부모 고정 리포트 주소 발급 모달 */}
              {reportSlugModal.open && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                        <span>🏷️</span> 학부모 고정 주소 발급
                      </h3>
                      <button
                        onClick={() => setReportSlugModal(prev => ({ ...prev, open: false }))}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">대상 수강생</label>
                        <input
                          type="text"
                          value={reportSlugModal.studentName}
                          readOnly
                          className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-700"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          고정 주소 식별자 (Slug)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-400 font-bold">jiwont.kr/</span>
                          <input
                            type="text"
                            value={reportSlugModal.reportSlug}
                            onChange={(e) => setReportSlugModal(prev => ({
                              ...prev,
                              reportSlug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''),
                            }))}
                            placeholder="bokjego1test"
                            className="flex-1 border border-slate-300 rounded-lg p-2 font-mono text-indigo-700 font-bold focus:ring-2 focus:ring-indigo-100 outline-none"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          영문 소문자와 숫자(3~30자)만 가능하며 학부모에게 깔끔한 전용 주소로 제공됩니다.
                        </p>
                      </div>

                      {/* 보호자 연락처 연동 상태 (전화번호 원문은 노출하지 않음) */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600">Notion 보호자 연락처:</span>
                          {reportSlugModal.guardianStatus === 'checking' && (
                            <span className="text-[11px] text-slate-500 font-bold animate-pulse">조회 확인 중...</span>
                          )}
                          {reportSlugModal.guardianStatus === 'verified' && (
                            <span className="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              확인됨 (인증값 자동 연동) ✅
                            </span>
                          )}
                          {reportSlugModal.guardianStatus === 'missing' && (
                            <span className="text-[11px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              연락처 없음 ⚠️
                            </span>
                          )}
                          {reportSlugModal.guardianStatus === 'idle' && (
                            <span className="text-[11px] text-slate-500 font-medium">발급 시 자동 검증</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          학부모는 접속 시 노션에 등록된 전화번호 뒤 4자리를 입력하여 열람하게 됩니다.
                        </p>
                      </div>

                      {reportSlugModal.errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                          {reportSlugModal.errorMsg}
                        </div>
                      )}

                      {reportSlugModal.generatedUrl && (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                          <p className="text-xs font-bold text-indigo-900">학부모 전달용 고정 주소:</p>
                          <input
                            type="text"
                            readOnly
                            value={reportSlugModal.generatedUrl}
                            className="w-full text-xs font-mono font-bold bg-white border border-indigo-200 rounded p-2 text-indigo-800"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(reportSlugModal.generatedUrl || '');
                              setReportSlugModal(prev => ({ ...prev, copied: true }));
                              setTimeout(() => setReportSlugModal(prev => ({ ...prev, copied: false })), 2000);
                            }}
                            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition"
                          >
                            {reportSlugModal.copied ? '복사 완료! ✅' : '주소 복사하기'}
                          </button>
                        </div>
                      )}

                      <div className="pt-2 flex justify-end gap-2">
                        <button
                          onClick={() => setReportSlugModal(prev => ({ ...prev, open: false }))}
                          className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold"
                        >
                          닫기
                        </button>
                        <button
                          onClick={handleGenerateReportSlug}
                          disabled={reportSlugModal.loading || reportSlugModal.reportSlug.length < 3}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg font-bold"
                        >
                          {reportSlugModal.loading ? '발급 처리 중...' : '고정 주소 저장 및 활성화'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-x-auto">
                <table className="w-full text-left min-w-[900px] xl:min-w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 lg:px-6 xl:px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">이름</th>
                      <th className="px-4 lg:px-6 xl:px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">계정</th>
                      <th className="px-4 lg:px-6 xl:px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">펫/포인트</th>
                      <th className="px-4 lg:px-6 xl:px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">메모</th>
                      <th className="px-4 lg:px-6 xl:px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">이메일</th>
                      <th className="px-4 lg:px-6 xl:px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">구분</th>
                      <th className="px-4 lg:px-6 xl:px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students
                      .filter(s => 
                        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (s.alias && s.alias.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (s.teacherNote && s.teacherNote.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        s.email.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map((student) => (
                      <tr key={student.uid} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 lg:px-6 xl:px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-pastel-pink-100 rounded-xl flex items-center justify-center text-pastel-pink-600 font-black overflow-hidden">
                              {student.photoURL && student.photoURL.startsWith('http') ? (
                                <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xl">{student.photoURL || student.name[0]}</span>
                              )}
                            </div>
                            <div>
                              <button 
                                onClick={() => navigateToReport(student.uid)}
                                className="font-bold text-slate-900 hover:text-pastel-pink-500 transition-colors text-left"
                              >
                                {student.alias || student.name}
                              </button>
                              <div className="text-[10px] text-slate-400 font-medium">UID: {student.uid.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 lg:px-6 xl:px-8 py-5 whitespace-nowrap">
                          {editingAlias === student.uid ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={aliasValue}
                                onChange={(e) => setAliasValue(e.target.value)}
                                placeholder="이름 수정..."
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-pastel-pink-200 w-32"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleUpdateAlias(student.uid)}
                                className="p-1.5 bg-pastel-pink-500 text-white rounded-lg hover:bg-pastel-pink-600 transition-colors"
                              >
                                <Save size={14} />
                              </button>
                              <button 
                                onClick={() => setEditingAlias(null)}
                                className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-400 font-medium leading-tight">
                                  {student.name}
                                </span>
                                {student.alias && (
                                  <span className="text-[10px] text-slate-300 font-medium lowercase italic">Account Nickname</span>
                                )}
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingAlias(student.uid);
                                  setAliasValue(student.alias || '');
                                }}
                                className="p-1 text-slate-300 hover:text-pastel-pink-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="학습자 이름 수정"
                              >
                                <MessageSquare size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 xl:px-8 py-5 whitespace-nowrap">
                          {student.petStats ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center overflow-hidden border border-slate-100 flex-shrink-0">
                                <div className="scale-[0.3]">
                                  <PetCharacter 
                                    character={student.petStats.character} 
                                    stage={PetService.getStage(student.petStats.highestLevel)} 
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black px-1 py-0.5 bg-amber-100 text-amber-600 rounded">Lv.{student.petStats.highestLevel}</span>
                                  <span className="text-sm font-bold text-slate-700 leading-tight">{student.petStats.petName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                                  <span className="flex items-center gap-0.5"><Sparkles size={10} className="text-emerald-400" />{student.petStats.points.toLocaleString()}</span>
                                  <span className="flex items-center gap-0.5"><Users size={10} className="text-blue-400" />{PetService.getStage(student.petStats.highestLevel)}</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic font-medium">펫 정보 없음</span>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 xl:px-8 py-5 whitespace-nowrap">
                          {editingNote === student.uid ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                placeholder="메모 입력..."
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-pastel-pink-200 w-40"
                                autoFocus
                              />
                              <button 
                                onClick={() => handleUpdateNote(student.uid)}
                                className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                              >
                                <Save size={12} />
                              </button>
                              <button 
                                onClick={() => setEditingNote(null)}
                                className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium ${student.teacherNote ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                                {student.teacherNote || '메모 없음'}
                              </span>
                              <button 
                                onClick={() => {
                                  setEditingNote(student.uid);
                                  setNoteValue(student.teacherNote || '');
                                }}
                                className="p-1 text-slate-300 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <FileText size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 xl:px-8 py-5 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-500">{student.email}</span>
                        </td>
                        <td className="px-4 lg:px-6 xl:px-8 py-5 whitespace-nowrap">
                          {isSuperAdmin ? (
                            <select
                              value={student.role}
                              onChange={(e) => handleUpdateRole(student.uid, e.target.value as 'teacher' | 'student')}
                              className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full cursor-pointer border border-transparent focus:outline-hidden ${
                                student.role === 'teacher' ? 'bg-indigo-100 text-indigo-600 focus:border-indigo-300' : 'bg-emerald-100 text-emerald-600 focus:border-emerald-300'
                              }`}
                            >
                              <option value="student">수강생</option>
                              <option value="teacher">선생님</option>
                            </select>
                          ) : (
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              student.role === 'teacher' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                              {student.role === 'teacher' ? '선생님' : '수강생'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 xl:px-8 py-5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => navigateToReport(student.uid)}
                              className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                              title="리포트 보기"
                            >
                              <BarChart3 size={18} />
                            </button>
                            <button
                              onClick={() => {
                                const matched = notionStudents.find(item => item.linkedFirebaseUid === student.uid || item.studentKey === student.notionStudentKey);
                                if (matched) handleOpenReportSlugModal(matched.studentKey, matched.studentDisplayName);
                                else alert('먼저 오른쪽의 Notion 학생 연결 목록에서 이 계정을 연결해 주세요.');
                              }}
                              className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                              title="학부모 고정 주소 설정"
                            >
                              <Link size={18} />
                            </button>
                            {isSuperAdmin && student.role === 'student' && (
                              <select
                                value={notionStudents.find(item => item.linkedFirebaseUid === student.uid)?.studentKey || student.notionStudentKey || ''}
                                disabled={linkingStudentUid === student.uid}
                                onChange={(e) => handleLinkStudentAccount(student.uid, e.target.value)}
                                className="max-w-40 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600"
                                title="이 앱 계정과 연결할 Notion 학생"
                              >
                                <option value="">Notion 학생 연결</option>
                                {notionStudents.map(item => (
                                  <option key={item.studentKey} value={item.studentKey} disabled={!!item.linkedFirebaseUid && item.linkedFirebaseUid !== student.uid}>
                                    {item.studentDisplayName}{item.linkedFirebaseUid === student.uid ? ' (연결됨)' : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                            {isSuperAdmin && student.role !== 'teacher' && (
                              confirmDeleteUid === student.uid ? (
                                <div className="flex flex-col items-end gap-1">
                                  <div className="text-[10px] text-red-400 font-medium mb-1 text-right leading-tight">
                                    데이터만 삭제됩니다.<br />로그인 계정은 유지됩니다.
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => handleDeleteStudent(student.uid)}
                                      className="px-2 py-1 bg-red-500 text-white text-[10px] font-black rounded-md"
                                    >
                                      확인
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteUid(null)}
                                      className="px-2 py-1 bg-slate-200 text-slate-500 text-[10px] font-black rounded-md"
                                    >
                                      취소
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => setConfirmDeleteUid(student.uid)}
                                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                  title="학생 삭제"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {students.length === 0 && !loading && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                              <Users className="text-slate-200" size={32} />
                            </div>
                            <p className="text-slate-400 font-medium">등록된 학생이 없습니다.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'wordbook' && (
            <motion.div
              key="wordbook"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager category="word" /></Suspense>
            </motion.div>
          )}

          {activeTab === 'grammar' && (
            <motion.div
              key="grammar"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager category="grammar" /></Suspense>
            </motion.div>
          )}

          {activeTab === 'exam' && (
            <motion.div
              key="exam"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Suspense fallback={<p className="text-sm text-slate-500">세트를 불러오는 중…</p>}><WordbookManager category="exam" /></Suspense>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <StudentReportManager initialStudentUid={selectedStudentUid} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm transition-all whitespace-nowrap flex-1 md:flex-none justify-center ${
        active 
          ? 'bg-pastel-pink-500 text-white shadow-lg shadow-pastel-pink-200' 
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
