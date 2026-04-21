import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, TrendingUp, BookOpen, Calendar, Search, User, Save, X, CheckCircle2, Trash2, MessageSquare, ClipboardList, Gamepad2, Clock, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType, saveAssignment, updateAssignment, deleteAssignment } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, Timestamp, deleteDoc, orderBy } from 'firebase/firestore';

interface StudentUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
  alias?: string;
}

interface Evaluation {
  evaluation: string;
  updatedAt: any;
}

interface StudySession {
  uid: string;
  wordbookId: string;
  wordbookTitle: string;
  type: string;
  category: string;
  duration: number;
  score?: number;
  totalItems?: number;
  createdAt: any;
}

interface StudentReportManagerProps {
  initialStudentUid?: string | null;
}

export default function StudentReportManager({ initialStudentUid }: StudentReportManagerProps) {
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);
  const [evaluation, setEvaluation] = useState('');
  const [assignment, setAssignment] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    learnedWords: 0,
    attendanceRate: 0,
    totalPlayTime: 0, // in seconds
    gameCountsCount: {} as Record<string, number>
  });
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<any[]>([]);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false);
  const ASSIGNMENTS_PER_PAGE = 5;

  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isDeletingAssignment, setIsDeletingAssignment] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all users (students and teachers)
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => doc.data() as StudentUser);
      // Sort: Teacher first, then students by name/alias
      studentData.sort((a, b) => {
        if (a.role === 'teacher') return -1;
        if (b.role === 'teacher') return 1;
        const nameA = a.alias || a.name;
        const nameB = b.alias || b.name;
        return nameA.localeCompare(nameB);
      });
      setStudents(studentData);
      setLoading(false);

      // Handle initial selection
      if (initialStudentUid) {
        const initial = studentData.find(s => s.uid === initialStudentUid);
        if (initial) setSelectedStudent(initial);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => unsubscribe();
  }, [initialStudentUid]);

  useEffect(() => {
    if (!selectedStudent) return;

    // Fetch evaluation
    const evalRef = doc(db, 'evaluations', selectedStudent.uid);
    getDoc(evalRef).then(docSnap => {
      if (docSnap.exists()) {
        setEvaluation(docSnap.data().evaluation || '');
      } else {
        setEvaluation('');
      }
    });

    // Fetch stats for selected student
    const qWords = query(collection(db, 'wordProgress'), where('uid', '==', selectedStudent.uid));
    const unsubWords = onSnapshot(qWords, (snapshot) => {
      const learned = snapshot.docs.filter(doc => doc.data().status === 'learned').length;
      setStats(prev => ({ ...prev, learnedWords: learned }));
    });

    const qAttendance = query(collection(db, 'attendance'), where('studentId', '==', selectedStudent.uid));
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const total = snapshot.docs.length;
      const present = snapshot.docs.filter(doc => doc.data().status === 'present').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      setStats(prev => ({ ...prev, attendanceRate: rate }));
    });

    const qSessions = query(collection(db, 'studySessions'), where('uid', '==', selectedStudent.uid));
    const unsubSessions = onSnapshot(qSessions, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as StudySession);
      
      const totalTime = sessions.reduce((sum: number, s: StudySession) => sum + (s.duration || 0), 0);
      const counts: Record<string, number> = {};
      sessions.forEach(s => {
        counts[s.type] = (counts[s.type] || 0) + 1;
      });

      setStats(prev => ({ ...prev, totalPlayTime: totalTime, gameCountsCount: counts }));
      setSessionHistory(sessions.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
    });

    const qAssignments = query(
      collection(db, 'assignments'),
      where('studentUid', '==', selectedStudent.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubAssignments = onSnapshot(qAssignments, (snapshot) => {
      const assignments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudentAssignments(assignments);
    });

    return () => {
      unsubWords();
      unsubAttendance();
      unsubSessions();
      unsubAssignments();
    };
  }, [selectedStudent]);

  const handleSaveEvaluation = async () => {
    if (!selectedStudent || !auth.currentUser) return;
    setSaving(true);

    try {
      await setDoc(doc(db, 'evaluations', selectedStudent.uid), {
        evaluation,
        teacherUid: auth.currentUser.uid,
        updatedAt: Timestamp.now()
      });
      alert('평가가 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save evaluation:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedStudent || !auth.currentUser || !assignment.trim()) return;
    setSavingAssignment(true);

    try {
      await saveAssignment(selectedStudent.uid, auth.currentUser.uid, assignment);
      setAssignment('');
      alert('과제 메모가 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save assignment:', error);
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleWithdrawStudent = async () => {
    if (!selectedStudent || !auth.currentUser) return;
    
    setIsDeleting(true);
    try {
      // Delete user document
      await deleteDoc(doc(db, 'users', selectedStudent.uid));
      
      // Delete evaluation if exists
      await deleteDoc(doc(db, 'evaluations', selectedStudent.uid));
      
      setSelectedStudent(null);
      setIsConfirmingWithdraw(false);
    } catch (error) {
      console.error('Failed to withdraw student:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignmentId || !editingContent.trim()) return;
    try {
      setSavingAssignment(true);
      await updateAssignment(editingAssignmentId, editingContent);
      setEditingAssignmentId(null);
      setEditingContent('');
    } catch (error) {
      console.error('Failed to update assignment:', error);
    } finally {
      setSavingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      setIsDeletingAssignment(id);
      await deleteAssignment(id);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('Failed to delete assignment:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeletingAssignment(null);
    }
  };

  const formatDateWithDay = (date: Date) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const day = days[date.getDay()];
    return `${yyyy}-${mm}-${dd} (${day})`;
  };

  const totalAssignmentPages = Math.ceil(studentAssignments.length / ASSIGNMENTS_PER_PAGE);
  const paginatedAssignments = studentAssignments.slice((assignmentPage - 1) * ASSIGNMENTS_PER_PAGE, assignmentPage * ASSIGNMENTS_PER_PAGE);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Student List */}
      <div className="lg:col-span-1 space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="학생 검색 (이름, 이메일)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-pastel-pink-100 outline-none transition-all text-sm font-medium"
          />
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50">
            <h3 className="font-black text-slate-900 flex items-center gap-2">
              <User size={18} className="text-pastel-pink-500" />
              연결된 학생 목록
            </h3>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filteredStudents.map((student) => (
              <button
                key={student.uid}
                onClick={() => setSelectedStudent(student)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${
                  selectedStudent?.uid === student.uid ? 'bg-pastel-pink-50' : ''
                }`}
              >
                <div className="w-10 h-10 bg-pastel-pink-100 rounded-xl flex items-center justify-center text-pastel-pink-600 font-black shrink-0 overflow-hidden">
                  {student.photoURL && student.photoURL.startsWith('http') ? (
                    <img src={student.photoURL} alt={student.alias || student.name} className="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xl">{student.photoURL || student.name[0]}</span>
                  )}
                </div>
                <div className="text-left overflow-hidden">
                  <div className="font-bold text-slate-900 truncate">
                    {student.alias || student.name}
                    {student.role === 'teacher' && <span className="ml-2 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">선생님</span>}
                  </div>
                  <div className="text-xs text-slate-400 truncate">{student.email}</div>
                </div>
              </button>
            ))}
            {filteredStudents.length === 0 && !loading && (
              <div className="p-10 text-center text-slate-400 font-medium">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Report View & Evaluation */}
      <div className="lg:col-span-2">
        <AnimatePresence mode="wait">
          {selectedStudent ? (
            <motion.div
              key={selectedStudent.uid}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-pastel-pink-100 rounded-2xl flex items-center justify-center text-2xl font-black text-pastel-pink-600 overflow-hidden">
                      {selectedStudent.photoURL && selectedStudent.photoURL.startsWith('http') ? (
                        <img src={selectedStudent.photoURL} alt={selectedStudent.alias || selectedStudent.name} className="w-full h-full rounded-2xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="text-3xl">{selectedStudent.photoURL || selectedStudent.name[0]}</span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">{selectedStudent.alias || selectedStudent.name} {selectedStudent.role === 'teacher' ? '선생님' : '학생'}의 리포트</h2>
                      <p className="text-slate-500 font-medium">{selectedStudent.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                  >
                    <X size={24} className="text-slate-300" />
                  </button>
                </div>

                {/* 1. 과제 및 공지 메모 남기기 */}
                <div className="pt-6 border-t border-slate-100">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
                    <ClipboardList className="text-blue-500" size={20} />
                    과제 및 공지 메모 남기기
                  </h3>
                  <div className="space-y-4">
                    <textarea
                      value={assignment}
                      onChange={(e) => setAssignment(e.target.value)}
                      placeholder="학생에게 남길 과제나 공지사항을 입력해주세요. (최대 10개까지 보관되며, 학생 리포트에 알림이 표시됩니다.)"
                      className="w-full h-32 p-6 bg-blue-50/30 border-2 border-blue-100 rounded-3xl focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all resize-none font-medium text-slate-700"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveAssignment}
                        disabled={savingAssignment || !assignment.trim()}
                        className="flex items-center gap-2 px-8 py-4 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                      >
                        <Save size={18} />
                        {savingAssignment ? '저장 중...' : '과제 메모 저장'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. 과제 수행 현황 */}
                <div className="pt-8 border-t border-slate-100">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-6">
                    <ClipboardList className="text-emerald-500" size={20} />
                    과제 수행 현황
                  </h3>
                  
                  <div className="space-y-4 mb-8">
                    {paginatedAssignments.map((item) => (
                      <div key={item.id} className={`p-5 rounded-3xl border transition-all ${item.isDone ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${item.isDone ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {item.createdAt && formatDateWithDay(item.createdAt.toDate())} {item.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {confirmDeleteId === item.id ? (
                               <div className="flex items-center gap-1">
                                 <button
                                   onClick={() => handleDeleteAssignment(item.id)}
                                   disabled={isDeletingAssignment === item.id}
                                   className="px-2 py-1 bg-red-500 text-white text-[10px] font-black rounded-md hover:bg-red-600 transition-all disabled:opacity-50"
                                 >
                                   {isDeletingAssignment === item.id ? '...' : '확인'}
                                 </button>
                                 <button
                                   onClick={() => setConfirmDeleteId(null)}
                                   className="px-2 py-1 bg-slate-200 text-slate-500 text-[10px] font-black rounded-md hover:bg-slate-300 transition-all"
                                 >
                                   취소
                                 </button>
                               </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingAssignmentId(item.id);
                                    setEditingContent(item.content);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                                  title="수정"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              {item.isDone ? '완료' : '미완료'}
                            </div>
                          </div>
                        </div>
                        {editingAssignmentId === item.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full p-3 text-sm bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all resize-none min-h-[80px]"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingAssignmentId(null)}
                                className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-100 rounded-lg transition-all"
                              >
                                취소
                              </button>
                              <button
                                onClick={handleUpdateAssignment}
                                disabled={savingAssignment || !editingContent.trim()}
                                className="px-3 py-1.5 text-xs font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50"
                              >
                                {savingAssignment ? '저장 중...' : '수정 완료'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap ${item.isDone ? 'opacity-50' : ''}`}>
                            {item.content}
                          </p>
                        )}
                      </div>
                    ))}

                    {studentAssignments.length === 0 && (
                      <div className="py-10 text-center text-slate-300 italic text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        등록된 과제가 없습니다.
                      </div>
                    )}

                    {totalAssignmentPages > 1 && (
                      <div className="flex justify-center items-center gap-4 pt-2">
                        <button
                          onClick={() => setAssignmentPage(prev => Math.max(1, prev - 1))}
                          disabled={assignmentPage === 1}
                          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-bold text-slate-400">{assignmentPage} / {totalAssignmentPages}</span>
                        <button
                          onClick={() => setAssignmentPage(prev => Math.min(totalAssignmentPages, prev + 1))}
                          disabled={assignmentPage === totalAssignmentPages}
                          className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-all"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. 학습 성취도 평가 */}
                <div className="pt-8 border-t border-slate-100 space-y-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <TrendingUp className="text-pastel-pink-500" size={20} />
                    학습 성취도 평가
                  </h3>
                  <textarea
                    value={evaluation}
                    onChange={(e) => setEvaluation(e.target.value)}
                    placeholder="학생의 학습 성취도에 대한 평가를 입력해주세요. (예: 매우 우수함, 단어 복습이 필요함 등)"
                    className="w-full h-40 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-pastel-pink-100 focus:border-pastel-pink-300 outline-none transition-all resize-none font-medium text-slate-700"
                  />
                  <div className="flex justify-between items-center">
                    {isConfirmingWithdraw ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-red-500">정말 탈퇴 처리하시겠습니까?</span>
                        <button
                          onClick={handleWithdrawStudent}
                          disabled={isDeleting}
                          className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-all disabled:opacity-50"
                        >
                          {isDeleting ? '처리 중...' : '확인'}
                        </button>
                        <button
                          onClick={() => setIsConfirmingWithdraw(false)}
                          className="px-4 py-2 bg-slate-200 text-slate-500 rounded-xl font-bold text-sm hover:bg-slate-300 transition-all"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsConfirmingWithdraw(true)}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-6 py-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                        수강생 탈퇴 처리
                      </button>
                    )}
                    <button
                      onClick={handleSaveEvaluation}
                      disabled={saving}
                      className="flex items-center gap-2 px-8 py-4 bg-pastel-pink-500 text-white rounded-2xl font-bold hover:bg-pastel-pink-600 shadow-lg shadow-pastel-pink-200 transition-all disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? '저장 중...' : '평가 저장하기'}
                    </button>
                  </div>
                </div>

                {/* 4. 학습 리포트 부분 (통계) */}
                <div className="pt-8 border-t border-slate-100">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-6">
                    <BarChart3 className="text-amber-500" size={20} />
                    학습 리포트 상세
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <BookOpen className="text-blue-500" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-600 mb-1">학습한 단어</div>
                        <div className="text-2xl font-black text-slate-900">{stats.learnedWords}개</div>
                      </div>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <Calendar className="text-emerald-500" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-600 mb-1">출석률</div>
                        <div className="text-2xl font-black text-slate-900">{stats.attendanceRate}%</div>
                      </div>
                    </div>
                    <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <Clock className="text-amber-500" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-600 mb-1">총 학습 시간</div>
                        <div className="text-2xl font-black text-slate-900">
                          {Math.floor(stats.totalPlayTime / 60)}분 {stats.totalPlayTime % 60}초
                        </div>
                      </div>
                    </div>
                    <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <Gamepad2 className="text-indigo-500" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-600 mb-1">총 게임 횟수</div>
                        <div className="text-2xl font-black text-slate-900">
                          {(Object.values(stats.gameCountsCount) as number[]).reduce((a, b) => a + b, 0)}회
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <TrendingUp size={16} className="text-pastel-pink-500" />
                      학습 활동 로그
                    </h3>
                    <div className="space-y-3">
                      {sessionHistory.length > 0 ? (
                        sessionHistory.slice(0, 10).map((session, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                                {session.type === 'quiz' && <CheckCircle2 size={20} />}
                                {session.type === 'flashcard' && <BookOpen size={20} />}
                                {session.type === 'match' && <Gamepad2 size={20} />}
                                {session.type === 'conjugation' && <TrendingUp size={20} />}
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
                                   {session.score}/{session.totalItems}
                                 </div>
                               )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-slate-300 italic text-sm bg-white rounded-2xl border border-dashed border-slate-200">
                          기록된 게임 학습 내역이 아직 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-slate-100 border-dashed p-10 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <BarChart3 className="text-slate-200" size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">학습 리포트 관리</h3>
              <p className="text-slate-400 font-medium max-w-xs">
                왼쪽 목록에서 학생을 선택하여<br />
                학습 현황을 확인하고 평가를 입력하세요.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
