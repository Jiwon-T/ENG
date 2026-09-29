import React, { useState, useEffect } from 'react';
import type { ParentLessonReportDTO } from '../../types/lessonReport';
import { safeFetchJson } from '../../lib/safeFetchJson';

interface ParentReportViewProps {
  reportSlug: string;
  onGoHome?: () => void;
}

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

  useEffect(() => {
    // 개인정보 보호 및 검색엔진 색인 방지 (noindex, nofollow)
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    // 1단계: 공개 상태 확인 (슬러그 존재 및 활성 여부 검증)
    checkReportStatus();

    return () => {
      if (document.head.contains(meta)) {
        document.head.removeChild(meta);
      }
    };
  }, [reportSlug]);

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
        setReports(res.data.reports || []);
        if (res.data.reports && res.data.reports.length > 0) {
          setSelectedReport(res.data.reports[0]);
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

  const getAttitudeColor = (att: string) => {
    switch (att) {
      case '최상':
      case '상':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case '중상':
      case '중':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-amber-100 text-amber-800 border-amber-300';
    }
  };

  const getAttendanceBadge = (att: string) => {
    if (att.includes('출석')) return 'bg-emerald-500 text-white';
    if (att.includes('지각')) return 'bg-amber-500 text-white';
    if (att.includes('결석')) return 'bg-rose-500 text-white';
    return 'bg-gray-400 text-white';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* 상단 헤더 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
              JW
            </span>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">지원T 영어 수업 리포트</h1>
              <p className="text-xs text-slate-500">학부모 안심 브리핑</p>
            </div>
          </div>
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
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
              잠시 후 다시 접속을 시도해 주세요.
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
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
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
          <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl">
                🔒
              </div>
              <h2 className="text-lg font-bold text-slate-900">학부모 안심 본인 확인</h2>
              <p className="text-xs text-slate-500">
                학생의 수업 기록과 상세 피드백 보호를 위해<br />
                등록된 <strong className="text-slate-700">보호자 전화번호 뒤 4자리</strong>를 입력해 주세요.
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  className="w-full text-center tracking-[1em] text-2xl font-mono py-3 border border-slate-300 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none transition"
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
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition shadow-sm"
              >
                {isVerifying ? '인증 확인 중...' : '리포트 열람하기'}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                5회 이상 실패 시 안전을 위해 15분간 열람이 제한됩니다.<br />
                문의사항은 지원T 카카오톡 채널로 연락해 주세요.
              </p>
            </div>
          </div>
        </main>
      )}

      {/* 3. 인증 성공 후: 상세 수업 리포트 화면 */}
      {!isInvalidSlug && isAuthenticated && (
        <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                열람 권한 인증 완료
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-1">
                {studentDisplayName || '학생'} 수업 일지 & 리포트
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              안심 세션이 유지되는 동안 본 기기에서 바로 열람 가능합니다.
            </div>
          </div>

          {loadingReports ? (
            <div className="py-20 text-center text-slate-400 text-sm animate-pulse">
              수업 리포트 데이터를 불러오는 중입니다...
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
              <p className="text-slate-500 text-sm font-medium">아직 등록된 수업 일지가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 왼쪽: 회차 목록 리스트 */}
              <div className="md:col-span-1 space-y-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">
                  수업 회차 목록 ({reports.length}회차)
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {reports.map((rep) => {
                    const isSelected = selectedReport?.reportId === rep.reportId;
                    return (
                      <button
                        key={rep.reportId}
                        onClick={() => setSelectedReport(rep)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 shadow-xs ring-2 ring-indigo-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-900">{rep.lessonDateStart}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${getAttendanceBadge(rep.attendance)}`}>
                            {rep.attendance || '출석'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 line-clamp-1">
                          {rep.lessonTime ? `수업: ${rep.lessonTime}` : rep.category}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 오른쪽: 선택된 회차 상세 브리핑 카드 */}
              {selectedReport && (
                <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-xs font-bold text-slate-400">수업 일시</span>
                      <h4 className="text-lg font-black text-slate-900">
                        {selectedReport.lessonDateStart} {selectedReport.lessonTime && `(${selectedReport.lessonTime})`}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${getAttendanceBadge(selectedReport.attendance)}`}>
                        {selectedReport.attendance || '출석 확인'}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-lg font-bold bg-slate-100 text-slate-700">
                        {selectedReport.category}
                      </span>
                    </div>
                  </div>

                  {/* 학습 태도 및 평가 지표 그리드 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[11px] font-bold text-slate-400 mb-1">수업 태도</div>
                      <div className={`text-xs font-black inline-block px-2 py-0.5 rounded border ${getAttitudeColor(selectedReport.attitude)}`}>
                        {selectedReport.attitude || '확인'}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[11px] font-bold text-slate-400 mb-1">과제 수행</div>
                      <div className="text-xs font-black text-slate-800">
                        {selectedReport.homework || '완료'}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[11px] font-bold text-slate-400 mb-1">단어 점수</div>
                      <div className="text-xs font-black text-indigo-600">
                        {selectedReport.vocabularyScore !== null ? `${selectedReport.vocabularyScore}점` : '—'}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[11px] font-bold text-slate-400 mb-1">내신 대비 점수</div>
                      <div className="text-xs font-black text-indigo-600">
                        {selectedReport.schoolExamScore !== null ? `${selectedReport.schoolExamScore}점` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* 자습시간 및 테스트 정보 */}
                  {(selectedReport.selfStudyTime || selectedReport.test) && (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                      {selectedReport.selfStudyTime && (
                        <p><strong className="text-slate-700">자습 진행 시간:</strong> {selectedReport.selfStudyTime}</p>
                      )}
                      {selectedReport.test && (
                        <p><strong className="text-slate-700">테스트 진행:</strong> {selectedReport.test}</p>
                      )}
                    </div>
                  )}

                  {/* 선생님 맞춤 상세 피드백 */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>📝</span>
                      <span>지원T 맞춤 학습 피드백 & 코멘트</span>
                    </h5>
                    <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedReport.feedback || '등록된 피드백 내용이 없습니다.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
};
