import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { loadStudentResource } from '../lib/studentReportCache';
import { readRecentLearning, type RecentLearning } from '../lib/recentLearning';
import type { StudentLessonReportDTO, StudentScheduleDTO } from '../types/lessonReport';
import { GraduationCap, Languages, BookOpen, BarChart3, FileText, Users, Sparkles, Dog, KeyRound, ChevronRight, Clock, CheckCircle2, PlayCircle, Menu } from 'lucide-react';
import LinkCodeDialog from './student/LinkCodeDialog';
import RosyLogo from './RosyLogo';

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
  /** Header: the app name the person chose, their icon (emoji or photo URL) and the side menu. */
  displayName?: string;
  avatar?: string;
  onOpenMenu?: () => void;
}

export default function Home({ onNavigate, userRole, userEmail, hasNewAssignment, userUid, pendingAssignmentCount, onResume, studentLinked = true, onLinked, displayName, avatar, onOpenMenu }: HomeProps) {
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

  const today = new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long'}).format(new Date());
  const scheduleTime = (at: string) => new Intl.DateTimeFormat('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(at));
  // One look for every menu: white card, rosy icon box (the app's point colour).
  const tiles = [
    {id: 'report', title: '학습 리포트', description: '과제 · 일정 · 성적', icon: BarChart3, show: true},
    {id: 'vocab', title: '단어 세트', description: '단어 암기와 퀴즈', icon: BookOpen, show: true},
    {id: 'grammar', title: '문법 세트', description: '핵심 문법 연습', icon: GraduationCap, show: true},
    {id: 'exam', title: '시험기간', description: '학교별 내신 대비', icon: FileText, show: true},
    {id: 'analyzer', title: '지문 분석기', description: '영어 지문 분석', icon: Languages, show: isSuperAdmin},
    {id: 'generator', title: '문제 생성기', description: '변형 문제 만들기', icon: Sparkles, show: isSuperAdmin},
  ].filter(item => item.show);
  const row = 'flex min-h-[44px] w-full items-center gap-3 border-t border-[#fbeef0] py-2.5 text-left text-sm text-slate-700 first:border-t-0';
  const rowIcon = 'flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#fef2f3] text-[#8b2f40]';

  return (
    <div className="mx-auto max-w-3xl pb-6">
      <header className="bg-[#fde3e6] px-5 pt-4 pb-12 text-[#5e1e2a] md:mt-6 md:rounded-3xl">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><RosyLogo size={32} /><span className="text-sm font-black tracking-tight">지원T English</span></span>
          {onOpenMenu && <button type="button" onClick={onOpenMenu} aria-label="메뉴 열기" className="relative flex items-center gap-1.5 rounded-full border border-[#f6d3d8] bg-white/80 py-1 pl-1 pr-2.5">
            {hasNewAssignment && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" aria-hidden="true" />}
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#fef2f3] text-sm">{avatar && avatar.startsWith('http') ? <img src={avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (avatar || '🙂')}</span>
            <Menu size={16} className="text-[#8b2f40]" aria-hidden="true" />
          </button>}
        </div>
        <h1 className="mt-5 text-xl font-black tracking-tight">{displayName ? `${displayName}님, 안녕하세요` : '안녕하세요'}</h1>
        <p className="mt-0.5 text-xs font-medium text-[#8b2f40]">{today}</p>
      </header>

      <div className="px-4">
        <section aria-label="오늘" className="relative -mt-8 rounded-2xl border border-[#f6e3e6] bg-white px-4 py-3 shadow-sm shadow-[#f5a3a81f]">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-black text-[#5e1e2a]">오늘</h2>{!isEducator && pending !== null && pending > 0 && <span className="rounded-full bg-[#f5a3a8] px-2 py-0.5 text-[11px] font-bold text-[#5e1e2a]">과제 {pending}</span>}</div>
          {isEducator ? <button type="button" onClick={() => onNavigate('teacher-room')} className={row}><span className={rowIcon}><Users size={15} aria-hidden="true" /></span><span className="min-w-0 flex-1"><b className="block font-bold text-[#5e1e2a]">선생님방</b><span className="block text-xs text-slate-500">수업 일지 · 일정 · 성적 관리</span></span><ChevronRight size={16} className="text-slate-300" aria-hidden="true" /></button> : <>
            {nextSchedule?.uid === userUid && nextSchedule.schedule && <button type="button" onClick={() => onNavigate('report')} className={row}><span className={rowIcon}><Clock size={15} aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">다음 수업 · {scheduleTime(nextSchedule.schedule.startAt)} {nextSchedule.schedule.title}</span><ChevronRight size={16} className="text-slate-300" aria-hidden="true" /></button>}
            <button type="button" onClick={() => onNavigate('report')} className={row}><span className={rowIcon}><CheckCircle2 size={15} aria-hidden="true" /></span><span className="min-w-0 flex-1">{pending !== null ? (pending > 0 ? `미완료 과제 ${pending}개` : '미완료 과제 없음') : '과제 · 일정 확인하기'}</span><ChevronRight size={16} className="text-slate-300" aria-hidden="true" /></button>
          </>}
          {recent && onResume && <button type="button" onClick={() => onResume(recent)} className={row}><span className={rowIcon}><PlayCircle size={15} aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">이어하기 · {recent.title} · 범위 {recent.chunk + 1}</span><ChevronRight size={16} className="text-slate-300" aria-hidden="true" /></button>}
        </section>

        {userRole === 'student' && !studentLinked && onLinked && <button type="button" onClick={() => setLinkOpen(true)} className="mt-3 flex min-h-[48px] w-full items-center gap-2 rounded-2xl bg-[#f5a3a8] px-4 text-left text-sm font-bold text-[#5e1e2a] shadow-sm shadow-[#f5a3a840]"><KeyRound size={17} aria-hidden="true" /><span className="flex-1">학원 연결하고 리포트 받기</span><ChevronRight size={17} aria-hidden="true" /></button>}

        <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {tiles.map(item => <button key={item.id} type="button" onClick={() => onNavigate(item.id as any)} className="flex min-h-[92px] flex-col items-start gap-1 rounded-2xl border border-[#f3e6e8] bg-white p-3.5 text-left transition-colors hover:border-[#f5a3a8] active:scale-[0.98]">
            <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-[#fef2f3] text-[#8b2f40]"><item.icon size={17} aria-hidden="true" /></span>
            <b className="text-sm font-bold text-[#5e1e2a]">{item.title}</b>
            <span className="text-xs text-slate-500">{item.description}{item.id === 'report' && !isEducator && pending !== null && pending > 0 ? ` · 과제 ${pending}` : ''}</span>
          </button>)}
        </div>

        <button type="button" onClick={() => onNavigate('pet')} className="mt-2.5 flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-[#f3e6e8] bg-white px-3.5 text-left">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fef2f3] text-[#8b2f40]"><Dog size={17} aria-hidden="true" /></span>
          <b className="flex-1 text-sm font-bold text-[#5e1e2a]">나만의 펫 <span className="ml-1 text-[11px] font-medium text-slate-400">Beta</span></b><ChevronRight size={16} className="text-slate-300" aria-hidden="true" />
        </button>
        {linkOpen && onLinked && <LinkCodeDialog onClose={() => setLinkOpen(false)} onLinked={onLinked} />}

        <footer className="mt-8 text-center text-[11px] text-slate-400">
          <a href="mailto:lizywon@naver.com" className="hover:text-slate-600">문의 · lizywon@naver.com</a>
          <p className="mt-1">© 2026 지원T English</p>
        </footer>
      </div>
    </div>
  );
}
