import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ParentLessonReportDTO } from '../../types/lessonReport';
import { safeFetchJson } from '../../lib/safeFetchJson';
import {
  formatReportDetailDate,
  formatReportListDate,
  formatAssignedTime,
  sortReportsByDate,
  groupReportsByMonth,
} from '../../lib/reportDateUtils';

interface ParentReportViewProps {
  reportSlug: string;
  onGoHome?: () => void;
}

/**
 * Notion 원문 상태값 보존 함수:
 * - 유효한 문자열이면 trim한 원문을 절대 변환/재해석/축약 없이 그대로 반환
 * - 값이 null, undefined, 비문자열 또는 공백일 때만 '미확인' 반환
 */
export function getDisplayStatus(value: string | null | undefined): string {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return '미확인';
  }
  return value.trim();
}

/**
 * 상태별 배지 색상 매핑:
 * 상태 텍스트는 원문 그대로 유지하며 시각적 스타일만 일관되게 부여
 * - 미확인: 중립 회색
 * - 없는 날: 연한 회색
 * - 미제출: 로즈 또는 붉은색
 * - 최하: 진한 로즈
 * - 하: 연한 로즈
 * - 중하: 주황 / 앰버
 * - 중: 노랑 / 골드
 * - 중상: 하늘색
 * - 상: 청록색
 * - 최상: 에메랄드색
 * - 출석: 에메랄드색
 * - 지각: 앰버색
 * - 결석: 로즈색
 * - 기타 알려지지 않은 새로운 상태값: 중립 회색
 */
export function getStatusBadgeClass(statusRaw: string | null | undefined): string {
  const status = getDisplayStatus(statusRaw);

  switch (status) {
    case '미확인':
      return 'bg-slate-100 text-slate-600 border border-slate-200';
    case '없는 날':
      return 'bg-slate-100 text-slate-500 border border-slate-200';
    case '미제출':
      return 'bg-rose-50 text-rose-700 border border-rose-200 font-bold';
    case '최하':
      return 'bg-rose-100 text-rose-800 border border-rose-300 font-bold';
    case '하':
      return 'bg-rose-50 text-rose-600 border border-rose-200';
    case '중하':
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    case '중':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    case '중상':
      return 'bg-sky-100 text-sky-800 border border-sky-300 font-bold';
    case '상':
      return 'bg-teal-100 text-teal-800 border border-teal-300 font-bold';
    case '최상':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-black';
    default:
      // 출석 관련 키워드 처리
      if (status.includes('출석')) {
        return 'bg-emerald-500 text-white border border-emerald-600 font-bold';
      }
      if (status.includes('지각')) {
        return 'bg-amber-500 text-white border border-amber-600 font-bold';
      }
      if (status.includes('결석')) {
        return 'bg-rose-500 text-white border border-rose-600 font-bold';
      }
      // 그 외 알 수 없는 모든 새로운 상태값: 텍스트는 원문 그대로, 중립 회색 스타일
      return 'bg-slate-100 text-slate-700 border border-slate-200 font-medium';
  }
}

/**
 * 출결 전용 배지 스타일 (상단 날짜 옆 및 목록용 배지)
 */
export function getAttendanceBadgeClass(statusRaw: string | null | undefined): string {
  const status = getDisplayStatus(statusRaw);
  if (status === '미확인') {
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
  if (status === '없는 날') {
    return 'bg-slate-100 text-slate-500 border border-slate-200';
  }
  if (status.includes('출석')) {
    return 'bg-emerald-500 text-white';
  }
  if (status.includes('지각')) {
    return 'bg-amber-500 text-white';
  }
  if (status.includes('결석')) {
    return 'bg-rose-500 text-white';
  }
  return getStatusBadgeClass(status);
}

const PAGE_SIZE = 10;

export const ParentReportView: React.FC<ParentReportViewProps> = ({ reportSlug, onGoHome }) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInvalidSlug, setIsInvalidSlug] = useState(false);
  const [isServerDown, setIsServerDown] = useState(false);
  const [studentDisplayName, setStudentDisplayName] = useState('');

  const [loadingReports, setLoadingReports] = useState(false);
  const [reports, setReports] = useState<ParentLessonReportDTO[]>([]);
  const [selectedReport, setSelectedReport] = useState<ParentLessonReportDTO | null>(null);

  // 모바일·태블릿 화면 상태: 'list' (목록만 표시) | 'detail' (상세만 표시)
  // 1024px 미만 환경에서는 인증 직후 'list'로 시작합니다.
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // 페이징: 10개씩 더 보기
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // 목록 화면 스크롤 위치 보존
  const listScrollYRef = useRef<number>(0);

  // 화면 폭 1024px 이상 여부 감지 (SSR-safe 기본값 false)
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1024;
      setIsDesktop(desktop);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // 개인정보 보호 및 검색엔진 색인 방지 (noindex, nofollow)
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    // 1단계: 공개 상태 확인 (슬러그 존재 및 활성 여부 검증)
    checkReportStatus();

    // 슬러그가 변경되면 상태를 'list'로 초기화
    setMobileView('list');
    setVisibleCount(PAGE_SIZE);

    return () => {
      if (document.head.contains(meta)) {
        document.head.removeChild(meta);
      }
    };
  }, [reportSlug]);

  // 브라우저 뒤로 가기 (popstate) 안전 지원
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      // popstate 발생 시 모바일 화면이 detail 상태였다면 list로 안전하게 복귀
      if (state && state.parentReportView === 'detail') {
        setMobileView('detail');
      } else {
        setMobileView('list');
        // 복귀 시 저장된 스크롤 위치 복원
        setTimeout(() => {
          window.scrollTo({ top: listScrollYRef.current, behavior: 'instant' });
        }, 10);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const checkReportStatus = async () => {
    setLoadingReports(true);
    const result = await safeFetchJson<{ ok: boolean; active: boolean }>(
      `/api/parent/report-status?reportSlug=${encodeURIComponent(reportSlug)}`
    );

    if (result.status === 500 || result.error === 'NETWORK_ERROR') {
      setIsServerDown(true);
      setLoadingReports(false);
      return;
    }

    if (!result.data || !result.data.active) {
      setIsInvalidSlug(true);
      setLoadingReports(false);
      return;
    }

    // 활성 슬러그인 경우 기존 세션 검증
    checkExistingSession();
  };

  const checkExistingSession = async () => {
    try {
      const res = await safeFetchJson<{
        ok: boolean;
        student?: { studentDisplayName: string };
        reports?: ParentLessonReportDTO[];
      }>(`/api/parent/lesson-reports?reportSlug=${encodeURIComponent(reportSlug)}`);

      if (res.ok && res.data) {
        setIsAuthenticated(true);
        setStudentDisplayName(res.data.student?.studentDisplayName || '');

        // 원본 reports를 mutate하지 않고 최신순으로 정렬
        const rawReports = res.data.reports || [];
        const sorted = sortReportsByDate(rawReports);
        setReports(sorted);

        // 데스크톱(>=1024px)에서는 최신 회차를 기본 선택, 모바일에서는 선택해두되 화면은 list 유지
        if (sorted.length > 0) {
          setSelectedReport(sorted[0]);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setErrorMsg('보호자 전화번호 뒷 4자리를 정확히 입력해 주세요.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    const res = await safeFetchJson<{
      ok: boolean;
      studentDisplayName?: string;
      remainingAttempts?: number;
      message?: string;
      error?: string;
    }>('/api/parent/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportSlug,
        pin: pin.trim(),
      }),
    });

    setIsVerifying(false);

    if (res.ok && res.data) {
      setIsAuthenticated(true);
      setStudentDisplayName(res.data.studentDisplayName || '');
      setPin('');
      // 인증 직후 모바일은 반드시 'list' 화면으로 시작
      setMobileView('list');
      setVisibleCount(PAGE_SIZE);
      await checkExistingSession();
    } else {
      if (res.data?.error === 'INVALID_OR_INACTIVE_REPORT') {
        setIsInvalidSlug(true);
      } else if (res.data?.error === 'TEMPORARILY_LOCKED') {
        setErrorMsg('보안을 위해 조회가 15분간 잠겼습니다. 잠시 후 다시 시도해 주세요.');
      } else {
        const remaining = res.data?.remainingAttempts !== undefined ? ` (남은 횟수: ${res.data.remainingAttempts}회)` : '';
        setErrorMsg((res.data?.message || res.userMessage) + remaining);
      }
    }
  };

  /**
   * 모바일/태블릿에서 회차 선택 시:
   * 1) 현재 window.scrollY 스크롤 위치 저장
   * 2) selectedReport 설정
   * 3) mobileView를 'detail'로 전환
   * 4) history.pushState로 브라우저 뒤로 가기 상태 안전하게 추가
   * 5) 상세 화면 맨 위로 스크롤
   */
  const handleSelectReport = (rep: ParentLessonReportDTO) => {
    if (!isDesktop) {
      listScrollYRef.current = window.scrollY;
      setSelectedReport(rep);
      setMobileView('detail');

      try {
        window.history.pushState(
          { parentReportView: 'detail', reportId: rep.reportId },
          '',
          window.location.href
        );
      } catch {
        // history API 미지원 환경 무시
      }

      window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      setSelectedReport(rep);
    }
  };

  /**
   * 모바일/태블릿에서 '수업 회차 목록' 뒤로 가기 버튼 클릭 시:
   * 1) mobileView를 'list'로 복귀
   * 2) 브라우저 히스토리 상태 되돌리기 (detail 상태였다면 history.back())
   * 3) 기존 목록의 스크롤 위치 복원
   */
  const handleBackToList = () => {
    setMobileView('list');

    try {
      if (window.history.state && window.history.state.parentReportView === 'detail') {
        window.history.back();
      }
    } catch {
      // 무시
    }

    setTimeout(() => {
      window.scrollTo({ top: listScrollYRef.current, behavior: 'instant' });
    }, 10);
  };

  const isValidNumberScore = (score: number | null | undefined): boolean => {
    return score !== null && score !== undefined && typeof score === 'number' && !isNaN(score);
  };

  // 10개씩 더 보기 적용된 목록
  const visibleReports = useMemo(() => {
    return reports.slice(0, visibleCount);
  }, [reports, visibleCount]);

  // 월별 그룹화 (Asia/Seoul 기준)
  const monthGroups = useMemo(() => {
    return groupReportsByMonth(visibleReports);
  }, [visibleReports]);

  const remainingCount = Math.max(0, reports.length - visibleCount);
  const nextAddCount = Math.min(PAGE_SIZE, remainingCount);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16 overflow-x-hidden">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 shrink-0 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              JW
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 leading-tight truncate">
                지원T 수업 리포트
              </h1>
            </div>
          </div>
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="shrink-0 min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition active:scale-[0.98]"
            >
              메인 홈으로
            </button>
          )}
        </div>
      </header>

      {/* 1. 서버 장애 화면 */}
      {isServerDown && (
        <main className="max-w-md mx-auto px-4 pt-20 text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-bold text-slate-900">현재 리포트를 불러올 수 없습니다</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              서버 연결이 원활하지 않습니다.<br />
              잠시 후 다시 시도해 주세요.
            </p>
          </div>
        </main>
      )}

      {/* 2. 유효하지 않은 주소일 때 표준 404 안내 화면 */}
      {!isServerDown && isInvalidSlug && (
        <main className="max-w-md mx-auto px-4 pt-20 text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 space-y-4">
            <div className="text-4xl">🔍</div>
            <h2 className="text-lg font-bold text-slate-900">페이지를 찾을 수 없습니다 (404)</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              요청하신 학부모 리포트 주소가 유효하지 않거나 비활성화되었습니다.<br />
              선생님께 올바른 주소를 다시 안내받아 주세요.
            </p>
            {onGoHome && (
              <button
                onClick={onGoHome}
                className="mt-4 min-h-[44px] px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                메인 홈으로 이동
              </button>
            )}
          </div>
        </main>
      )}

      {/* 3. 보호자 전화번호 뒤 4자리 인증 모달 */}
      {!isServerDown && !isInvalidSlug && !isAuthenticated && (
        <main className="max-w-md mx-auto px-4 pt-16">
          <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-xl border border-slate-200 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl shadow-xs">
                🔒
              </div>
              <h2 className="text-lg font-bold text-slate-900">학부모 안심 본인 확인</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                학생의 수업 기록과 상세 피드백 보호를 위해<br />
                등록된 <strong className="text-slate-700 font-semibold">보호자 전화번호 뒷 4자리</strong>를 입력해 주세요.
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  보호자 연락처 뒷 4자리
                </label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="\d{4}"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full text-center tracking-[1em] text-2xl font-mono py-3.5 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition"
                  autoFocus
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || pin.length !== 4}
                className="w-full min-h-[44px] py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition shadow-sm active:scale-[0.99]"
              >
                {isVerifying ? '인증 확인 중...' : '리포트 열람하기'}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                5회 이상 실패 시 안전을 위해 15분간 열람이 제한됩니다.<br />
                문의사항은 지원T에게 전달해 주세요.
              </p>
            </div>
          </div>
        </main>
      )}

      {/* 4. 인증 성공 후 화면 */}
      {!isInvalidSlug && isAuthenticated && (
        <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
          {/* 상단 타이틀 카드 */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md inline-block mb-1.5">
              열람 권한 인증 완료
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 break-words leading-tight">
              {studentDisplayName || '학생'} 수업 일지
            </h2>
          </div>

          {loadingReports ? (
            <div className="py-20 text-center text-slate-400 text-sm animate-pulse font-medium">
              리포트 데이터를 불러오는 중입니다...
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <p className="text-slate-500 text-sm font-medium">아직 등록된 수업 일지가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* ============================================================== */}
              {/* [A] 모바일/태블릿 뷰 (< 1024px): 목록-상세 2단계 완전 분리 구조 */}
              {/* ============================================================== */}
              <div className="lg:hidden">
                {/* 1단계: 모바일 목록 화면 (mobileView === 'list') */}
                {mobileView === 'list' && (
                  <div className="space-y-4">
                    <div className="flex items-baseline justify-between px-1">
                      <div>
                        <h3 className="text-base font-black text-slate-900">수업 회차</h3>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                          총 {reports.length}회의 수업 기록이 있습니다.
                        </p>
                      </div>
                    </div>

                    {/* 월별 구분 및 세로 카드 목록 */}
                    <div className="space-y-6">
                      {monthGroups.map((group) => (
                        <div key={`m-group-${group.groupKey}`} className="space-y-2.5">
                          {/* 월별 헤더 (Asia/Seoul 기준) */}
                          <div className="flex items-center gap-2 px-1 pt-1">
                            <span className="text-xs font-black text-indigo-900 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100/60">
                              {group.groupLabel}
                            </span>
                            <div className="h-px bg-slate-200 flex-1"></div>
                          </div>

                          {/* 해당 월의 회차 카드 목록 */}
                          <div className="space-y-2.5">
                            {group.reports.map((rep) => {
                              const isSelected = selectedReport?.reportId === rep.reportId;
                              const listDate = formatReportListDate(rep.lessonDateStart);
                              const actualTime = rep.lessonTime ? rep.lessonTime.trim() : null;
                              const attendanceDisplay = getDisplayStatus(rep.attendance);
                              const attitudeDisplay = rep.attitude ? getDisplayStatus(rep.attitude) : null;

                              // 단어 점수 또는 내신 대비 점수 중 존재하는 점수 확인
                              const hasVocab = isValidNumberScore(rep.vocabularyScore);
                              const hasExam = isValidNumberScore(rep.schoolExamScore);

                              return (
                                <button
                                  key={`m-card-${rep.reportId}`}
                                  type="button"
                                  onClick={() => handleSelectReport(rep)}
                                  aria-label={`${listDate} 수업 리포트 열람하기`}
                                  className={`w-full min-h-[72px] text-left p-4 rounded-2xl border transition-all active:scale-[0.99] flex flex-col justify-between gap-2 shadow-2xs ${
                                    isSelected
                                      ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-200'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {/* 상단: 날짜 + 출결 배지 + 범주 배지 */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                                        {listDate}
                                      </span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                                        {rep.category || '수업'}
                                      </span>
                                    </div>
                                    <span
                                      className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold shrink-0 ${getAttendanceBadgeClass(
                                        rep.attendance
                                      )}`}
                                    >
                                      {attendanceDisplay}
                                    </span>
                                  </div>

                                  {/* 중간: 수업 시간 (lessonTime이 있을 때만 표시, 배정 시간은 상세 화면에서 확인) */}
                                  {actualTime && (
                                    <div className="text-xs text-indigo-950 font-medium truncate">
                                      <span className="text-indigo-600 font-bold mr-1">수업 시간</span>
                                      {actualTime}
                                    </div>
                                  )}

                                  {/* 하단: 선택 표시 (태도 배지, 단어/내신 점수) */}
                                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100/80 gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {attitudeDisplay && attitudeDisplay !== '미확인' && (
                                        <span className="text-[11px] text-slate-500 font-medium truncate">
                                          태도 <strong className="text-slate-700 font-bold">{attitudeDisplay}</strong>
                                        </span>
                                      )}
                                      {hasVocab && (
                                        <span className="text-[11px] text-indigo-600 font-bold truncate">
                                          단어 {rep.vocabularyScore}점
                                        </span>
                                      )}
                                      {!hasVocab && hasExam && (
                                        <span className="text-[11px] text-indigo-600 font-bold truncate">
                                          내신 {rep.schoolExamScore}점
                                        </span>
                                      )}
                                    </div>

                                    <span className="text-xs font-bold text-indigo-600 shrink-0 flex items-center gap-0.5">
                                      상세보기 →
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 10개씩 더 보기 버튼 */}
                    {remainingCount > 0 && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={handleLoadMore}
                          className="w-full min-h-[44px] py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition active:scale-[0.99] shadow-2xs"
                        >
                          이전 수업 {nextAddCount}개 더 보기 (남은 기록 {remainingCount}개)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 2단계: 모바일 상세 화면 (mobileView === 'detail') */}
                {mobileView === 'detail' && selectedReport && (
                  <div className="space-y-4">
                    {/* 최상단 뒤로 가기 버튼 (최소 44px 터치 영역 확보) */}
                    <div>
                      <button
                        type="button"
                        onClick={handleBackToList}
                        className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition active:scale-[0.98] shadow-2xs"
                      >
                        <span className="text-sm">←</span>
                        <span>수업 회차 목록</span>
                      </button>
                    </div>

                    {/* 선택된 회차 상세 리포트 카드 */}
                    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-6">
                      {/* 날짜, 출결, 범주 */}
                      <div className="border-b border-slate-100 pb-5 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-500 block mb-0.5">수업 날짜</span>
                            <h4 className="text-xl font-black text-slate-900 break-words leading-tight">
                              {formatReportDetailDate(selectedReport.lessonDateStart)}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-lg font-bold shadow-2xs ${getAttendanceBadgeClass(
                                selectedReport.attendance
                              )}`}
                            >
                              {getDisplayStatus(selectedReport.attendance)}
                            </span>
                            <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-slate-100 text-slate-700">
                              {selectedReport.category || '수업'}
                            </span>
                          </div>
                        </div>

                        {/* 시간 영역 (배정 시간, 수업 시간, 자습 시간) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                          {formatAssignedTime(selectedReport.lessonDateStart, selectedReport.lessonDateEnd) && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
                              <span className="text-[11px] font-bold text-slate-500 block mb-0.5">배정 시간</span>
                              <span className="text-sm font-bold text-slate-800 break-words">
                                {formatAssignedTime(selectedReport.lessonDateStart, selectedReport.lessonDateEnd)}
                              </span>
                            </div>
                          )}

                          {selectedReport.lessonTime && selectedReport.lessonTime.trim() && (
                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 min-w-0">
                              <span className="text-[11px] font-bold text-indigo-700 block mb-0.5">수업 시간</span>
                              <span className="text-sm font-black text-indigo-950 break-words">
                                {selectedReport.lessonTime.trim()}
                              </span>
                            </div>
                          )}

                          {selectedReport.selfStudyTime && selectedReport.selfStudyTime.trim() && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0 sm:col-span-2">
                              <span className="text-[11px] font-bold text-slate-500 block mb-0.5">자습 시간</span>
                              <span className="text-sm font-bold text-slate-800 break-words">
                                {selectedReport.selfStudyTime.trim()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 학습 평가 지표 그리드 (태도, 숙제, 테스트 상시 표시) */}
                      <div>
                        <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5 px-0.5">
                          학습 평가
                        </h5>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-center">
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                            <div className="text-[11px] font-bold text-slate-500 mb-1.5">태도</div>
                            <div
                              className={`text-xs font-black inline-block px-2.5 py-1 rounded-lg break-words max-w-full ${getStatusBadgeClass(
                                selectedReport.attitude
                              )}`}
                            >
                              {getDisplayStatus(selectedReport.attitude)}
                            </div>
                          </div>

                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                            <div className="text-[11px] font-bold text-slate-500 mb-1.5">숙제</div>
                            <div
                              className={`text-xs font-black inline-block px-2.5 py-1 rounded-lg break-words max-w-full ${getStatusBadgeClass(
                                selectedReport.homework
                              )}`}
                            >
                              {getDisplayStatus(selectedReport.homework)}
                            </div>
                          </div>

                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center col-span-2 sm:col-span-1">
                            <div className="text-[11px] font-bold text-slate-500 mb-1.5">테스트</div>
                            <div
                              className={`text-xs font-black inline-block px-2.5 py-1 rounded-lg break-words max-w-full ${getStatusBadgeClass(
                                selectedReport.test
                              )}`}
                            >
                              {getDisplayStatus(selectedReport.test)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 성취 점수 (단어 점수, 내신 대비 점수) */}
                      {(isValidNumberScore(selectedReport.vocabularyScore) ||
                        isValidNumberScore(selectedReport.schoolExamScore)) && (
                        <div>
                          <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5 px-0.5">
                            성취 점수
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-center">
                            {isValidNumberScore(selectedReport.vocabularyScore) && (
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                                <div className="text-[11px] font-bold text-slate-500 mb-1">단어 점수</div>
                                <div className="text-base sm:text-lg font-black text-indigo-600">
                                  {selectedReport.vocabularyScore}점
                                </div>
                              </div>
                            )}

                            {isValidNumberScore(selectedReport.schoolExamScore) && (
                              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                                <div className="text-[11px] font-bold text-slate-500 mb-1">내신 대비 점수</div>
                                <div className="text-base sm:text-lg font-black text-indigo-600">
                                  {selectedReport.schoolExamScore}점
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 수업 내용 및 피드백 */}
                      <div className="space-y-2 pt-1">
                        <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <span>📝</span>
                          <span>수업 내용 및 피드백</span>
                        </h5>
                        <div className="p-4 sm:p-5 bg-indigo-50/40 border border-indigo-100/80 rounded-2xl text-sm sm:text-[15px] text-slate-800 leading-[1.65] whitespace-pre-wrap break-words font-medium">
                          {selectedReport.feedback && selectedReport.feedback.trim()
                            ? selectedReport.feedback.trim()
                            : '등록된 피드백 내용이 없습니다.'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ============================================================== */}
              {/* [B] 데스크톱 뷰 (>= 1024px): 좌측 회차 목록 + 우측 상세 브리핑 */}
              {/* ============================================================== */}
              <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6">
                {/* 좌측: 회차 목록 (최신순 세로 스크롤 및 월별 그룹, 10개씩 더 보기) */}
                <div className="lg:col-span-1 space-y-3">
                  <div className="flex items-baseline justify-between px-1">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">
                      수업 회차 ({reports.length}회)
                    </h3>
                  </div>

                  <div className="space-y-4 max-h-[720px] overflow-y-auto pr-1">
                    {monthGroups.map((group) => (
                      <div key={`d-group-${group.groupKey}`} className="space-y-2">
                        {/* 월별 헤더 */}
                        <div className="text-[11px] font-black text-indigo-900 bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/50 inline-block">
                          {group.groupLabel}
                        </div>

                        {/* 해당 월 회차 카드 */}
                        <div className="space-y-2">
                          {group.reports.map((rep) => {
                            const isSelected = selectedReport?.reportId === rep.reportId;
                            const listDate = formatReportListDate(rep.lessonDateStart);
                            const actualTime = rep.lessonTime ? rep.lessonTime.trim() : null;
                            const attendanceDisplay = getDisplayStatus(rep.attendance);
                            const attitudeDisplay = rep.attitude ? getDisplayStatus(rep.attitude) : null;
                            const hasVocab = isValidNumberScore(rep.vocabularyScore);
                            const hasExam = isValidNumberScore(rep.schoolExamScore);

                            return (
                              <button
                                key={`d-card-${rep.reportId}`}
                                type="button"
                                aria-pressed={isSelected}
                                onClick={() => setSelectedReport(rep)}
                                aria-label={`${listDate} 수업 리포트 선택`}
                                className={`w-full min-h-[72px] text-left p-3.5 rounded-xl border transition-all ${
                                  isSelected
                                    ? 'bg-indigo-50/90 border-indigo-500 shadow-xs ring-2 ring-indigo-200'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span
                                      className={`text-sm ${
                                        isSelected ? 'font-black text-indigo-950' : 'font-bold text-slate-900'
                                      } truncate`}
                                    >
                                      {listDate}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold shrink-0">
                                      {rep.category || '수업'}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0 ${getAttendanceBadgeClass(
                                      rep.attendance
                                    )}`}
                                  >
                                    {attendanceDisplay}
                                  </span>
                                </div>

                                {actualTime && (
                                  <div className="text-xs text-indigo-950 font-medium truncate mb-1">
                                    <span className="text-indigo-600 font-bold mr-1">수업 시간</span>
                                    {actualTime}
                                  </div>
                                )}

                                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                  <span className="truncate">
                                    {attitudeDisplay && attitudeDisplay !== '미확인' ? `태도: ${attitudeDisplay}` : ''}
                                  </span>
                                  {hasVocab && (
                                    <span className="text-indigo-600 font-bold shrink-0">단어 {rep.vocabularyScore}점</span>
                                  )}
                                  {!hasVocab && hasExam && (
                                    <span className="text-indigo-600 font-bold shrink-0">내신 {rep.schoolExamScore}점</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* 10개씩 더 보기 버튼 */}
                    {remainingCount > 0 && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={handleLoadMore}
                          className="w-full min-h-[44px] py-2.5 px-3 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition active:scale-[0.99] shadow-2xs"
                        >
                          이전 수업 {nextAddCount}개 더 보기 (남은 기록 {remainingCount}개)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 우측: 선택된 회차 상세 브리핑 카드 */}
                {selectedReport && (
                  <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
                    {/* 날짜, 출결, 범주 */}
                    <div className="border-b border-slate-100 pb-5 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-500 block mb-0.5">수업 날짜</span>
                          <h4 className="text-2xl font-black text-slate-900 break-words leading-tight">
                            {formatReportDetailDate(selectedReport.lessonDateStart)}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-lg font-bold shadow-2xs ${getAttendanceBadgeClass(
                              selectedReport.attendance
                            )}`}
                          >
                            {getDisplayStatus(selectedReport.attendance)}
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-slate-100 text-slate-700">
                            {selectedReport.category || '수업'}
                          </span>
                        </div>
                      </div>

                      {/* 시간 영역 (배정 시간, 수업 시간, 자습 시간) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {formatAssignedTime(selectedReport.lessonDateStart, selectedReport.lessonDateEnd) && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0">
                            <span className="text-[11px] font-bold text-slate-500 block mb-0.5">배정 시간</span>
                            <span className="text-sm font-bold text-slate-800 break-words">
                              {formatAssignedTime(selectedReport.lessonDateStart, selectedReport.lessonDateEnd)}
                            </span>
                          </div>
                        )}

                        {selectedReport.lessonTime && selectedReport.lessonTime.trim() && (
                          <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 min-w-0">
                            <span className="text-[11px] font-bold text-indigo-700 block mb-0.5">수업 시간</span>
                            <span className="text-sm font-black text-indigo-950 break-words">
                              {selectedReport.lessonTime.trim()}
                            </span>
                          </div>
                        )}

                        {selectedReport.selfStudyTime && selectedReport.selfStudyTime.trim() && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 min-w-0 sm:col-span-2">
                            <span className="text-[11px] font-bold text-slate-500 block mb-0.5">자습 시간</span>
                            <span className="text-sm font-bold text-slate-800 break-words">
                              {selectedReport.selfStudyTime.trim()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 학습 평가 지표 그리드 (태도, 숙제, 테스트 상시 표시) */}
                    <div>
                      <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5 px-0.5">
                        학습 평가
                      </h5>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                          <div className="text-[11px] font-bold text-slate-500 mb-1.5">태도</div>
                          <div
                            className={`text-xs font-black inline-block px-2.5 py-1 rounded-lg break-words max-w-full ${getStatusBadgeClass(
                              selectedReport.attitude
                            )}`}
                          >
                            {getDisplayStatus(selectedReport.attitude)}
                          </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                          <div className="text-[11px] font-bold text-slate-500 mb-1.5">숙제</div>
                          <div
                            className={`text-xs font-black inline-block px-2.5 py-1 rounded-lg break-words max-w-full ${getStatusBadgeClass(
                              selectedReport.homework
                            )}`}
                          >
                            {getDisplayStatus(selectedReport.homework)}
                          </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                          <div className="text-[11px] font-bold text-slate-500 mb-1.5">테스트</div>
                          <div
                            className={`text-xs font-black inline-block px-2.5 py-1 rounded-lg break-words max-w-full ${getStatusBadgeClass(
                              selectedReport.test
                            )}`}
                          >
                            {getDisplayStatus(selectedReport.test)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 성취 점수 */}
                    {(isValidNumberScore(selectedReport.vocabularyScore) ||
                      isValidNumberScore(selectedReport.schoolExamScore)) && (
                      <div>
                        <h5 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2.5 px-0.5">
                          성취 점수
                        </h5>
                        <div className="grid grid-cols-2 gap-3 text-center">
                          {isValidNumberScore(selectedReport.vocabularyScore) && (
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                              <div className="text-[11px] font-bold text-slate-500 mb-1">단어 점수</div>
                              <div className="text-lg font-black text-indigo-600">
                                {selectedReport.vocabularyScore}점
                              </div>
                            </div>
                          )}

                          {isValidNumberScore(selectedReport.schoolExamScore) && (
                            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-center items-center">
                              <div className="text-[11px] font-bold text-slate-500 mb-1">내신 대비 점수</div>
                              <div className="text-lg font-black text-indigo-600">
                                {selectedReport.schoolExamScore}점
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 수업 내용 및 피드백 */}
                    <div className="space-y-2 pt-1">
                      <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <span>📝</span>
                        <span>수업 내용 및 피드백</span>
                      </h5>
                      <div className="p-5 bg-indigo-50/40 border border-indigo-100/80 rounded-2xl text-[15px] text-slate-800 leading-[1.65] whitespace-pre-wrap break-words font-medium">
                        {selectedReport.feedback && selectedReport.feedback.trim()
                          ? selectedReport.feedback.trim()
                          : '등록된 피드백 내용이 없습니다.'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
};
