import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarChart3, TrendingUp, BookOpen, CheckCircle2, Clock, Calendar, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
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
    hasNewAssignment: false
  });
  const [userRole, setUserRole] = useState<string>('student');
  const [assignmentPage, setAssignmentPage] = useState(1);
  const ASSIGNMENTS_PER_PAGE = 5;

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

    return () => {
      unsubWords();
      unsubAttendance();
      unsubEval();
      unsubAssignments();
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
