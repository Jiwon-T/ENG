import React, { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { safeFetchJson } from '../lib/safeFetchJson';
import { readRecentLearning, type RecentLearning } from '../lib/recentLearning';
import type { StudentLessonReportDTO } from '../types/lessonReport';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Languages, BookOpen, History, BarChart3, FileText, Users, ArrowRight, X, Sparkles, Dog } from 'lucide-react';

interface HomeProps {
  onNavigate: (view: 'home' | 'analyzer' | 'generator' | 'vocab' | 'grammar' | 'exam' | 'vocab-mobile' | 'tutor' | 'report' | 'archive' | 'teacher-room' | 'pet') => void;
  userRole?: 'teacher' | 'student' | 'admin';
  userEmail?: string;
  hasNewAssignment?: boolean;
  userUid?: string;
  pendingAssignmentCount?: number | null;
  onResume?: (target: RecentLearning) => void;
}

export default function Home({ onNavigate, userRole, userEmail, hasNewAssignment, userUid, pendingAssignmentCount, onResume }: HomeProps) {
  const recent = userUid ? readRecentLearning(userUid) : null;
  const [lessonPending, setLessonPending] = useState<{ uid: string; count: number } | null>(null);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    if (!userUid) return;
    // Home renders first; this summary never blocks navigation.
    const timer = window.setTimeout(async () => {
      try {
        if (auth.currentUser?.uid !== userUid) return;
        const token = await auth.currentUser.getIdToken();
        const res = await safeFetchJson<{ reports: StudentLessonReportDTO[] }>('/api/student/lesson-reports', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (live && res.ok && Array.isArray(res.data?.reports)) setLessonPending({ uid: userUid, count: res.data.reports.filter(r => r.assignmentContent?.trim() && !r.assignmentCompleted).length });
      } catch { /* Keep the count unknown rather than show zero. */ }
    }, 500);
    return () => { live = false; clearTimeout(timer); controller.abort(); };
  }, [userUid]);
  const pending = typeof pendingAssignmentCount === 'number' && lessonPending?.uid === userUid ? pendingAssignmentCount + lessonPending.count : null;
  const isSuperAdmin = userEmail === 'lizzieshere1@gmail.com';

  const menuItems = [
    {
      id: 'vocab',
      title: '단어 세트',
      description: '객관식, 플래시카드, 매치게임으로 단어장을 학습합니다.',
      icon: <BookOpen className="text-pastel-pink-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-pastel-pink-50',
      borderColor: 'border-pastel-pink-100',
      textColor: 'text-pastel-pink-600',
      show: true
    },
    {
      id: 'grammar',
      title: '문법 세트',
      description: '주요 문법 포인트를 학습합니다.',
      icon: <GraduationCap className="text-purple-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-purple-50',
      borderColor: 'border-purple-100',
      textColor: 'text-purple-600',
      show: true
    },
    {
      id: 'exam',
      title: '시험기간',
      description: '각 학교별 시험기간 대비 단어장을 학습합니다.',
      icon: <FileText className="text-amber-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-amber-50',
      borderColor: 'border-amber-100',
      textColor: 'text-amber-600',
      show: true
    },
    {
      id: 'report',
      title: '학습 리포트',
      description: '과제, 일정과 성적 변화를 확인합니다.',
      icon: <BarChart3 className="text-indigo-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-indigo-50',
      borderColor: 'border-indigo-100',
      textColor: 'text-indigo-600',
      show: true
    },
    {
      id: 'analyzer',
      title: '지문 분석기',
      description: '영어 지문을 분석해 보세요.',
      icon: <Languages className="text-blue-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-blue-50',
      borderColor: 'border-blue-100',
      textColor: 'text-blue-600',
      show: isSuperAdmin
    },
    {
      id: 'generator',
      title: '문제 생성기',
      description: '다양한 유형의 변형 문제를 생성합니다.',
      icon: <Sparkles className="text-amber-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-amber-50',
      borderColor: 'border-amber-100',
      textColor: 'text-amber-600',
      show: isSuperAdmin
    },
    {
      id: 'pet',
      title: '펫 (Beta)',
      description: '학습으로 포인트를 모아 나만의 펫을 키워보세요.',
      icon: <Dog className="text-emerald-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
      textColor: 'text-emerald-600',
      show: true
    }
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 md:px-6 md:py-12">
      <header className="text-center mb-5 md:mb-16">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm mb-0 md:mb-6 border border-pastel-pink-100"
        >
          <span className="text-sm">🏫</span>
          <span className="text-sm font-bold text-pastel-pink-500 uppercase tracking-wider">
            지원T English
          </span>
        </motion.div>
      </header>

      {recent && onResume && <button type="button" onClick={() => onResume(recent)} className="w-full mb-3 md:mb-6 px-4 py-3 rounded-xl bg-white border border-pastel-pink-100 text-left flex justify-between items-center gap-3">
        <span className="min-w-0"><span className="block text-sm font-bold text-pastel-pink-600">최근 학습 이어하기</span><span className="block text-xs text-slate-500 truncate">{recent.title} · 범위 {recent.chunk + 1}</span></span><ArrowRight size={18} className="shrink-0 text-pastel-pink-500" />
      </button>}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {menuItems.filter(item => item.show).map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onNavigate(item.id as any)}
            className={`group min-w-0 p-3 md:p-8 rounded-2xl md:rounded-[2.5rem] border-2 ${item.borderColor} ${item.color} hover:shadow-2xl hover:shadow-pastel-pink-200/30 transition-all duration-300 text-left flex flex-col h-full active:scale-[0.98]`}
          >
            <div className="mb-2 md:mb-6 p-2 md:p-4 bg-white rounded-xl md:rounded-2xl shadow-sm flex items-center gap-2 md:gap-4 group-hover:scale-105 transition-transform duration-300">
              <div className="flex-shrink-0">
                {item.icon}
              </div>
              <h3 className={`text-sm md:text-xl font-black ${item.textColor} flex items-center gap-2`}>
                {item.title}
              </h3>
            </div>
            <p className="text-xs md:text-base text-slate-600 font-medium leading-relaxed break-words">
              {item.description}
              {item.id === 'report' && pending !== null && pending > 0 && <span className="block mt-2 text-xs font-bold text-indigo-700">미완료 과제 {pending}개</span>}
            </p>
            <div className="mt-auto pt-6 hidden md:flex items-center gap-2 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span>바로가기</span>
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <ArrowRight size={12} className={item.textColor} />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <footer className="mt-8 md:mt-24 text-center border-t border-slate-100 pt-5 md:pt-12">
        <p className="text-slate-400 text-sm font-medium">
          © 2026 지원T English. All rights reserved.
        </p>
        <p className="text-slate-400 text-sm font-medium mt-2">
          ✉️ lizywon@naver.com
        </p>
      </footer>
    </div>
  );
}
