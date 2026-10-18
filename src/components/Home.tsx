import { lazy, Suspense, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { loadStudentResource } from '../lib/studentReportCache';
import { readRecentLearning, type RecentLearning } from '../lib/recentLearning';
import type { StudentLessonReportDTO, StudentScheduleDTO } from '../types/lessonReport';
import { GraduationCap, Languages, BookOpen, BarChart3, FileText, Users, Sparkles, Dog, KeyRound, ChevronRight, Clock, CheckCircle2, PlayCircle, Menu, MessageSquare, ClipboardList } from 'lucide-react';
import LinkCodeDialog from './student/LinkCodeDialog';
import RosyLogo from './RosyLogo';
import { PassBadge, PetPointsChip, RankChip } from './PassBadge';
import { AssignedQuestionRow } from './generator/AssignedQuestions';
import { PetService, type PetSummary } from '../lib/petService';
const PetRanking = lazy(() => import('./pet/PetRanking'));

interface HomeProps {
  studentLinked?: boolean;
  onLinked?: (studentKey: string) => void;
  onNavigate: (view: 'home' | 'analyzer' | 'generator' | 'vocab' | 'grammar' | 'exam' | 'sentence' | 'vocab-mobile' | 'tutor' | 'report' | 'archive' | 'teacher-room' | 'pet' | 'workbook') => void;
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
  /** Pet points (a chip that explains how to earn them) and the AI pass badge. */
  petSummary?: PetSummary | null;
}

export default function Home({ onNavigate, userRole, userEmail, hasNewAssignment, userUid, pendingAssignmentCount, onResume, studentLinked = true, onLinked, displayName, avatar, onOpenMenu, petSummary }: HomeProps) {
  const isEducator = userRole === 'teacher' || userRole === 'principal' || userRole === 'admin';
  const [linkOpen, setLinkOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
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
  // The order students see: study sets, then the pet and the report. 지문 분석기 (beta) and the admin's 문제 생성기
  // come after, as slim rows.
  const tiles = [
    {id: 'vocab', title: '단어 세트', description: '단어 암기와 퀴즈', icon: BookOpen, beta: false},
    {id: 'exam', title: '시험기간', description: '학교별 내신 대비', icon: FileText, beta: false},
    {id: 'sentence', title: '문장 세트', description: '문장 배열과 낭독', icon: MessageSquare, beta: false},
    {id: 'grammar', title: '문법 세트', description: '핵심 문법 연습', icon: GraduationCap, beta: false},
    {id: 'pet', title: '나만의 펫', description: '먹이 주기 · 원정대', icon: Dog, beta: true},
    {id: 'report', title: '학습 리포트', description: '과제 · 일정 · 성적', icon: BarChart3, beta: false},
  ];
  const extras = [
    {id: 'analyzer', title: '지문 분석기', description: '영어 지문 분석', icon: Languages, beta: true, show: true},
    {id: 'generator', title: '변형 문제 만들기', description: '지문으로 문제 만들기', icon: Sparkles, beta: true, show: true},
    // Teachers: 선생님방's 워크북 tab, one tap from home.
    {id: 'workbook', title: '워크북', description: '지문으로 워크북 만들기', icon: ClipboardList, beta: false, show: isEducator},
  ].filter(item => item.show);
  // PC (md and up) uses a wider page and larger type; the phone layout stays compact.
  const row = 'group -mx-2 flex min-h-[44px] w-[calc(100%+1rem)] items-center gap-3 border-t border-[#fbeef0] px-2 py-2.5 text-left text-sm text-slate-700 transition-colors first:border-t-0 hover:bg-[#fff7f8] md:-mx-3 md:w-[calc(100%+1.5rem)] md:gap-4 md:px-3 md:py-3.5 md:text-base';
  const rowArrow = 'text-slate-300 transition-colors group-hover:text-[#e0587a]';
  const rowIcon = 'flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#fef2f3] text-[#8b2f40] md:h-9 md:w-9 md:rounded-xl';
  const rowSvg = 'md:h-5 md:w-5';

  return (
    <div className="mx-auto max-w-3xl pb-6 md:max-w-5xl md:px-6">
      <header className="bg-[#fde3e6] px-5 pt-4 pb-12 text-[#5e1e2a] md:mt-8 md:rounded-[28px] md:px-8 md:pt-6 md:pb-16">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><RosyLogo size={32} /><span className={`whitespace-nowrap text-sm font-black tracking-tight md:text-base ${petSummary && 'rank' in petSummary ? 'max-[409px]:hidden' : ''}`}>지원T English</span></span>
          <span className="relative flex items-center gap-1.5">
          {petSummary && 'rank' in petSummary ? <RankChip rank={petSummary.rank ?? null} onOpen={() => setRankOpen(true)} /> : null}
          {petSummary && <PetPointsChip points={petSummary.points} coupon={petSummary.coupon} onPet={() => onNavigate('pet')} />}
          {onOpenMenu && <button type="button" onClick={onOpenMenu} aria-label="메뉴 열기" className="relative flex items-center gap-1.5 rounded-full border border-[#f6d3d8] bg-white/80 py-1 pl-1 pr-2.5 transition-colors hover:border-[#eaa9b3] hover:bg-white">
            {hasNewAssignment && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" aria-hidden="true" />}
            <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#fef2f3] text-sm">{avatar && avatar.startsWith('http') ? <img src={avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : (avatar || '🙂')}</span>
            <PassBadge pass={petSummary?.pass} />
            {displayName && <span className="hidden max-w-[4.5rem] truncate text-xs md:inline font-bold text-[#5e1e2a]">{displayName}</span>}
            <Menu size={16} className="text-[#8b2f40]" aria-hidden="true" />
          </button>}
          </span>
        </div>
        <h1 className="mt-5 text-xl font-black tracking-tight md:mt-8 md:text-[30px]">{displayName ? `${displayName}님, 안녕하세요` : '안녕하세요'}</h1>
        <p className="mt-0.5 text-xs font-medium text-[#8b2f40] md:mt-1.5 md:text-sm">{today}</p>
      </header>

      <div className="px-4 md:px-6">
        <section aria-label="오늘" className="relative -mt-8 rounded-2xl border border-[#f6e3e6] bg-white px-4 py-3 shadow-sm shadow-[#f5a3a81f] md:-mt-10 md:rounded-3xl md:px-6 md:py-4">
          <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-black text-[#5e1e2a] md:text-base">오늘</h2>{!isEducator && pending !== null && pending > 0 && <span className="rounded-full bg-[#f5a3a8] px-2 py-0.5 text-[11px] font-bold text-[#5e1e2a]">숙제 {pending}</span>}</div>
          {isEducator ? <button type="button" onClick={() => onNavigate('teacher-room')} className={row}><span className={rowIcon}><Users size={15} className={rowSvg} aria-hidden="true" /></span><span className="min-w-0 flex-1"><b className="block font-bold text-[#5e1e2a]">선생님방</b><span className="block text-xs text-slate-500 md:text-sm">수업 일지 · 일정 · 성적 관리</span></span><ChevronRight size={16} className={rowArrow} aria-hidden="true" /></button> : <>
            {nextSchedule?.uid === userUid && nextSchedule.schedule && <button type="button" onClick={() => onNavigate('report')} className={row}><span className={rowIcon}><Clock size={15} className={rowSvg} aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">다음 수업 · {scheduleTime(nextSchedule.schedule.startAt)} {nextSchedule.schedule.title}</span><ChevronRight size={16} className={rowArrow} aria-hidden="true" /></button>}
            <button type="button" onClick={() => onNavigate('report')} className={row}><span className={rowIcon}><CheckCircle2 size={15} className={rowSvg} aria-hidden="true" /></span><span className="min-w-0 flex-1">{pending !== null ? (pending > 0 ? `미완료 수업 숙제 ${pending}개` : '미완료 수업 숙제 없음') : '숙제 · 일정 확인하기'}</span><ChevronRight size={16} className={rowArrow} aria-hidden="true" /></button>
            {studentLinked && <AssignedQuestionRow onOpen={() => onNavigate('report')} rowClass={row} iconClass={rowIcon} svgClass={rowSvg} arrowClass={rowArrow} />}
          </>}
          {recent && onResume && <button type="button" onClick={() => onResume(recent)} className={row}><span className={rowIcon}><PlayCircle size={15} className={rowSvg} aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">이어하기 · {recent.title} · 범위 {recent.chunk + 1}</span><ChevronRight size={16} className={rowArrow} aria-hidden="true" /></button>}
        </section>

        {userRole === 'student' && !studentLinked && onLinked && <button type="button" onClick={() => setLinkOpen(true)} className="mt-3 flex min-h-[48px] w-full items-center gap-2 rounded-2xl bg-[#f5a3a8] px-4 text-left text-sm font-bold text-[#5e1e2a] shadow-sm shadow-[#f5a3a840]"><KeyRound size={17} aria-hidden="true" /><span className="flex-1">학원 연결하고 리포트 받기</span><ChevronRight size={17} aria-hidden="true" /></button>}

        <div className="mt-3 grid grid-cols-2 gap-2.5 md:mt-4 md:grid-cols-4 md:gap-4">
          {tiles.map(item => <button key={item.id} type="button" onClick={() => onNavigate(item.id as any)} className="flex min-h-[92px] flex-col items-start gap-1 rounded-2xl border border-[#f3e6e8] bg-white p-3.5 text-left transition-colors hover:border-[#f5a3a8] active:scale-[0.98] md:min-h-[136px] md:rounded-3xl md:p-5">
            <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-xl bg-[#fef2f3] text-[#8b2f40] md:mb-3 md:h-11 md:w-11 md:rounded-2xl"><item.icon size={17} className="md:h-6 md:w-6" aria-hidden="true" /></span>
            <b className="text-sm font-bold text-[#5e1e2a] md:text-lg">{item.title}{item.beta && <span className="ml-1 text-[11px] font-medium text-slate-400 md:text-xs">Beta</span>}</b>
            <span className="text-xs text-slate-500 md:text-sm">{item.description}{item.id === 'report' && !isEducator && pending !== null && pending > 0 ? ` · 숙제 ${pending}` : ''}</span>
          </button>)}
          {extras.map(item => <button key={item.id} type="button" onClick={() => onNavigate(item.id as any)} className="group col-span-2 flex min-h-[48px] w-full items-center gap-3 rounded-2xl border border-[#f3e6e8] bg-white px-3.5 text-left transition-colors hover:border-[#f5a3a8] md:min-h-[76px] md:gap-4 md:rounded-3xl md:px-5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-[#fef2f3] text-[#8b2f40] md:h-11 md:w-11 md:rounded-2xl"><item.icon size={17} className="md:h-6 md:w-6" aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><b className="block text-sm font-bold text-[#5e1e2a] md:text-lg">{item.title}{item.beta && <span className="ml-1.5 text-[11px] font-medium text-slate-400 md:text-xs">Beta</span>}</b><span className="hidden text-sm text-slate-500 md:block">{item.description}</span></span><ChevronRight size={16} className="text-slate-300 transition-colors group-hover:text-[#e0587a] md:h-5 md:w-5" aria-hidden="true" />
          </button>)}
        </div>
        {linkOpen && onLinked && <LinkCodeDialog onClose={() => setLinkOpen(false)} onLinked={onLinked} />}

        <footer className="mt-8 text-center text-[11px] text-slate-400 md:mt-12 md:text-xs">
          <a href="mailto:lizywon@naver.com" className="hover:text-slate-600">문의 · lizywon@naver.com</a>
          <p className="mt-1">© 2026 지원T English</p>
        </footer>
      </div>
      {rankOpen && <Suspense fallback={null}><PetRanking send={(action, payload) => PetService.act(action, payload)} withTeachers={Boolean(petSummary?.rankTeacher)} onClose={() => setRankOpen(false)} /></Suspense>}
    </div>
  );
}
