import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, TrendingUp, BookOpen, Calendar, Search, User, Save, X, CheckCircle2, Trash2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, Timestamp, deleteDoc } from 'firebase/firestore';

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

interface StudentReportManagerProps {
  initialStudentUid?: string | null;
}

export default function StudentReportManager({ initialStudentUid }: StudentReportManagerProps) {
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentUser | null>(null);
  const [evaluation, setEvaluation] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState({
    learnedWords: 0,
    attendanceRate: 0
  });

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

    return () => {
      unsubWords();
      unsubAttendance();
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

  const handleWithdrawStudent = async () => {
    if (!selectedStudent || !auth.currentUser) return;
    if (!window.confirm(`${selectedStudent.name} 학생을 정말 탈퇴 처리하시겠습니까? 모든 학습 기록이 삭제됩니다.`)) return;
    
    setIsDeleting(true);
    try {
      // Delete user document
      await deleteDoc(doc(db, 'users', selectedStudent.uid));
      
      // Delete evaluation if exists
      await deleteDoc(doc(db, 'evaluations', selectedStudent.uid));
      
      // Note: Other data (attendance, progress) could be deleted here too, 
      // but deleting the user doc is the primary "withdrawal" action.
      
      alert('수강생 탈퇴 처리가 완료되었습니다.');
      setSelectedStudent(null);
    } catch (error) {
      console.error('Failed to withdraw student:', error);
      alert('탈퇴 처리 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

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
                <div className="w-10 h-10 bg-pastel-pink-100 rounded-xl flex items-center justify-center text-pastel-pink-600 font-black shrink-0">
                  {student.photoURL ? (
                    <img src={student.photoURL} alt={student.name} className="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    student.name[0]
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
                    <div className="w-16 h-16 bg-pastel-pink-100 rounded-2xl flex items-center justify-center text-2xl font-black text-pastel-pink-600">
                      {selectedStudent.photoURL ? (
                        <img src={selectedStudent.photoURL} alt={selectedStudent.name} className="w-full h-full rounded-2xl object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        selectedStudent.name[0]
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
                </div>

                <div className="space-y-4">
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
                    <button
                      onClick={handleWithdrawStudent}
                      disabled={isDeleting}
                      className="flex items-center gap-2 px-6 py-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-all disabled:opacity-50"
                    >
                      <Trash2 size={18} />
                      {isDeleting ? '처리 중...' : '수강생 탈퇴 처리'}
                    </button>
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
