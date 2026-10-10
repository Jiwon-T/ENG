import React, { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { loadStudentResource } from '../lib/studentReportCache';
import { readRecentLearning, type RecentLearning } from '../lib/recentLearning';
import type { StudentLessonReportDTO, StudentScheduleDTO } from '../types/lessonReport';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Languages, BookOpen, History, BarChart3, FileText, Users, ArrowRight, X, Sparkles, Dog, KeyRound } from 'lucide-react';
import LinkCodeDialog from './student/LinkCodeDialog';

interface HomeProps {
  studentLinked?: boolean;
  onLinked?: (studentKey: string) => void;
  onNavigate: (view: 'home' | 'analyzer' | 'generator' | 'vocab' | 'grammar' | 'exam' | 'vocab-mobile' | 'tutor' | 'report' | 'archive' | 'teacher-room' | 'pet') => void;
  userRole?: 'teacher' | 'student' | 'admin' | 'principal';
  userEmail?: string;
  hasNewAssignment?: boolean;
  userUid?: string;
  pendingAssignmentCount?: number | null;
  onResume?: (target: RecentLearning) => void;
}

export default function Home({ onNavigate, userRole, userEmail, hasNewAssignment, userUid, pendingAssignmentCount, onResume, studentLinked = true, onLinked }: HomeProps) {
  const isEducator = userRole === 'teacher' || userRole === 'principal' || userRole === 'admin';
  const [linkOpen, setLinkOpen] = useState(false);
  const recent = userUid ? readRecentLearning(userUid) : null;
  const [nextSchedule, setNextSchedule] = useState<{ uid: string; schedule: StudentScheduleDTO | null } | null>(null);
  const [lessonPending, setLessonPending] = useState<{ uid: string; count: number } | null>(null);
  useEffect(() => {
    let live = true;
    if (!userUid || isEducator || auth.currentUser?.uid !== userUid) return;
    const user = auth.currentUser, token = () => user.getIdToken();
    loadStudentResource<{reports: StudentLessonReportDTO[]}>(userUid, 'lesson-reports', token).then(result => {
      if (live && auth.currentUser?.uid === userUid) setLessonPending({uid: userUid, count: result.reports.filter(r => r.assignmentContent?.trim() && !r.assignmentCompleted).length});
    }).catch(() => {});
    loadStudentResource<{schedules: StudentScheduleDTO[]}>(userUid, 'schedules', token).then(result => {
      if (!live || auth.currentUser?.uid !== userUid) return;
      const upcoming = result.schedules.filter(s => s.status === '예정' && new Date(s.endAt || s.startAt).getTime() >= Date.now()).sort((a,b) => Date.parse(a.startAt)-Date.parse(b.startAt));
      setNextSchedule({uid: userUid, schedule: upcoming[0] || null});
    }).catch(() => {});
    return () => { live = false; };
  }, [userUid, isEducator]);
  const pending = typeof pendingAssignmentCount === 'number' && lessonPending?.uid === userUid ? pendingAssignmentCount + lessonPending.count : null;
  const isSuperAdmin = userEmail === 'lizzieshere1@gmail.com';

  const menuItems = [
    {
      id: 'vocab',
      title: '단어 세트',
      description: '단어 암기와 퀴즈',
      icon: <BookOpen className="text-pastel-pink-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-pastel-pink-50',
      borderColor: 'border-pastel-pink-100',
      textColor: 'text-pastel-pink-600',
      show: true
    },
    {
      id: 'grammar',
      title: '문법 세트',
      description: '핵심 문법 연습',
      icon: <GraduationCap className="text-purple-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-purple-50',
      borderColor: 'border-purple-100',
      textColor: 'text-purple-600',
      show: true
    },
    {
      id: 'exam',
      title: '시험기간',
      description: '학교별 내신 대비',
      icon: <FileText className="text-amber-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-amber-50',
      borderColor: 'border-amber-100',
      textColor: 'text-amber-600',
      show: true
    },
    {
      id: 'report',
      title: '학습 리포트',
      description: '과제 · 일정 · 성적',
      icon: <BarChart3 className="text-indigo-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-indigo-50',
      borderColor: 'border-indigo-100',
      textColor: 'text-indigo-600',
      show: true
    },
    {id: 'teacher-room', title: '선생님방', description: '수업 일지 · 일정 · 성적 관리', icon: <Users className="text-pastel-pink-500 w-4 h-4 md:w-8 md:h-8"/>, color: 'bg-white', borderColor: 'border-pastel-pink-100', textColor: 'text-pastel-pink-600', show: userRole === 'teacher' || userRole === 'admin' || userRole === 'principal'},
    {
      id: 'analyzer',
      title: '지문 분석기',
      description: '영어 지문 분석',
      icon: <Languages className="text-blue-500 w-4 h-4 md:w-8 md:h-8" />,
      color: 'bg-blue-50',
      borderColor: 'border-blue-100',
      textColor: 'text-blue-600',
      show: isSuperAdmin
    },
    {
      id: 'generator',
      title: '문제 생성기',
      description: '변형 문제 만들기',
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

      <section aria-label="오늘 할 일" className="mb-4 rounded-2xl border border-slate-100 bg-white p-4">
        <button type="button" onClick={() => onNavigate(isEducator ? 'teacher-room' : 'report')} className="min-h-[44px] w-full text-left flex justify-between items-center gap-2 text-sm rounded-xl -mx-2 px-2 py-1 hover:bg-slate-50 transition-colors">
          <span className="min-w-0"><span className="block text-sm font-bold text-slate-800 mb-1">오늘 할 일</span><span className="block text-slate-600">{isEducator ? '수업 일지·일정 관리하기' : pending !== null ? (pending > 0 ? `미완료 과제 ${pending}개` : '미완료 과제 없음') : '과제·일정 확인하기'}</span></span><ArrowRight size={16} className="shrink-0 text-slate-400" />
        </button>
        {nextSchedule?.uid === userUid && nextSchedule.schedule && <button type="button" onClick={() => onNavigate('report')} className="min-h-[44px] w-full text-left text-xs text-violet-700 leading-relaxed">다음 일정 · {nextSchedule.schedule.title}<span className="block text-slate-500">{new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(nextSchedule.schedule.startAt))}</span></button>}
        {recent && onResume && <button type="button" onClick={() => onResume(recent)} className="min-h-[44px] w-full pt-2 border-t border-slate-100 text-left flex justify-between items-center gap-3">
          <span className="min-w-0"><span className="block text-sm font-bold text-pastel-pink-600">최근 학습 이어하기</span><span className="block text-xs text-slate-500 truncate">{recent.title} · 범위 {recent.chunk + 1}</span></span><ArrowRight size={16} className="shrink-0 text-pastel-pink-500" />
        </button>}
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
        {menuItems.filter(item => item.show && item.id !== 'pet' && item.id !== 'teacher-room').map((item, index) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onNavigate(item.id as any)}
            className={`group min-w-0 p-4 md:p-6 rounded-2xl border ${item.borderColor} ${item.color} hover:shadow-2xl hover:shadow-pastel-pink-200/30 transition-all duration-300 text-left flex flex-col h-full active:scale-[0.98]`}
          >
            <div className="mb-2 md:mb-3 flex items-center gap-2 md:gap-3">
              <div className="flex-shrink-0">
                {item.icon}
              </div>
              <h3 className={`text-sm md:text-xl font-black ${item.textColor} flex items-center gap-2`}>
                {item.title}
              </h3>
            </div>
            <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed">
              {item.description}
              {item.id === 'report' && pending !== null && pending > 0 && <span className="block mt-2 text-xs font-bold text-indigo-700">미완료 과제 {pending}개</span>}
            </p>
            <div className="mt-auto pt-3 hidden md:flex items-center gap-2 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span>바로가기</span>
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                <ArrowRight size={12} className={item.textColor} />
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onNavigate('pet')} className="min-h-[44px] px-4 py-2 rounded-xl border border-emerald-100 bg-emerald-50 flex items-center gap-2 text-sm font-semibold text-emerald-700"><Dog size={18}/> 나만의 펫 <span className="text-[10px] font-normal">Beta</span></button>
        {userRole === 'student' && !studentLinked && onLinked && <button type="button" onClick={() => setLinkOpen(true)} className="relative min-h-[44px] px-4 py-2 rounded-xl border border-pastel-pink-200 bg-gradient-to-r from-pastel-pink-50 to-violet-50 flex items-center gap-2 text-sm font-semibold text-pastel-pink-600"><KeyRound size={18}/> 학원 연결<span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-pastel-pink-400 ring-2 ring-white" aria-hidden="true"/><span className="sr-only">(아직 연결 안 됨)</span></button>}
        {isEducator && <button type="button" onClick={() => onNavigate('teacher-room')} className="min-h-[44px] px-4 py-2 rounded-xl border border-pink-100 bg-white flex items-center gap-2 text-sm font-semibold text-pink-600"><Users size={18}/> 선생님방</button>}
      </div>
      {linkOpen && onLinked && <LinkCodeDialog onClose={() => setLinkOpen(false)} onLinked={onLinked} />}
      <footer className="mt-6 md:mt-12 text-center border-t border-slate-100 pt-3 md:pt-4">
        <p className="text-slate-400 text-[10px] md:text-xs font-normal">
          © 2026 지원T English. All rights reserved.
        </p>
        <p className="text-slate-400 text-[10px] md:text-xs font-normal mt-2">
          <a href="mailto:lizywon@naver.com" className="hover:text-slate-600 transition-colors">문의 · lizywon@naver.com</a>
        </p>
      </footer>
    </div>
  );
}
