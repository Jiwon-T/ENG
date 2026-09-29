import React, { useState, useEffect } from 'react';
import type { ParentLessonReportDTO } from '../../types/lessonReport';

interface ParentReportViewProps {
  initialToken?: string;
  onGoHome?: () => void;
}

export const ParentReportView: React.FC<ParentReportViewProps> = ({ initialToken, onGoHome }) => {
  const [token, setToken] = useState(initialToken || '');
  const [requiresPin, setRequiresPin] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [loadingReports, setLoadingReports] = useState(false);
  const [reports, setReports] = useState<ParentLessonReportDTO[]>([]);
  const [selectedReport, setSelectedReport] = useState<ParentLessonReportDTO | null>(null);

  // 1. Initial token check from URL
  useEffect(() => {
    // Add meta noindex, nofollow for parent privacy
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');

    if (urlToken) {
      setToken(urlToken);
      checkTokenStatus(urlToken);
    } else {
      // Check if session cookie already exists
      fetchReports();
    }

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const checkTokenStatus = async (tok: string) => {
    try {
      const res = await fetch(`/api/parent/access/${encodeURIComponent(tok)}`);
      const data = await res.json();
      if (data.ok) {
        setRequiresPin(true);
        setStudentName(data.studentName || '학생');
      } else {
        setErrorMsg('유효하지 않거나 만료된 접근 링크입니다. 선생님께 문의해 주세요.');
      }
    } catch (e) {
      setErrorMsg('서버와 통신할 수 없습니다.');
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setErrorMsg('전화번호 뒷 4자리를 정확히 입력해 주세요.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/parent/access/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (data.ok) {
        // Remove token from browser URL for clean security
        window.history.replaceState({}, document.title, '/report');
        setRequiresPin(false);
        setIsAuthenticated(true);
        fetchReports();
      } else {
        if (data.error === 'TEMPORARILY_LOCKED') {
          setErrorMsg('보안을 위해 조회가 일시적으로 잠겼습니다. 15분 후 다시 시도해 주세요.');
        } else {
          setErrorMsg(`인증번호가 일치하지 않습니다. (남은 횟수: ${data.remainingAttempts ?? '확인 요망'})`);
        }
      }
    } catch (e) {
      setErrorMsg('인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/parent/lesson-reports');
      const data = await res.json();
      if (data.ok) {
        setIsAuthenticated(true);
        setReports(data.reports || []);
        if (data.reports?.length > 0) {
          setSelectedReport(data.reports[0]);
        }
      } else {
        // Need verification
        if (!token) {
          setErrorMsg('학부모 전용 접속 링크를 통해 접속해 주세요.');
        }
      }
    } catch (e) {
      setErrorMsg('리포트를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingReports(false);
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
      {/* Header */}
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
              학생 로그인
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        {/* PIN Verification Modal / Card */}
        {requiresPin && !isAuthenticated && (
          <div className="max-w-md mx-auto my-12 bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                🔒
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-1">{studentName} 학부모 안심 확인</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                학생 정보 보호를 위해 등록된 <span className="font-semibold text-slate-700">보호자 전화번호 뒤 4자리</span>를 입력해 주세요.
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="전화번호 뒤 4자리"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full text-center text-2xl tracking-widest font-mono py-3 px-4 border-2 border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-hidden transition"
                  autoFocus
                />
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 text-center font-medium">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={pin.length !== 4 || isVerifying}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition shadow-md"
              >
                {isVerifying ? '보안 확인 중...' : '학습 리포트 열람하기'}
              </button>
            </form>
          </div>
        )}

        {/* Global Error if not PIN required */}
        {!requiresPin && errorMsg && !isAuthenticated && (
          <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-2xl border border-rose-200 text-center shadow-sm">
            <div className="text-3xl mb-3">⚠️</div>
            <h3 className="font-bold text-slate-900 mb-2">접근 권한이 필요합니다</h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">{errorMsg}</p>
            {onGoHome && (
              <button
                onClick={onGoHome}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
              >
                홈으로 돌아가기
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loadingReports && (
          <div className="text-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs">학습 리포트를 불러오는 중입니다...</p>
          </div>
        )}

        {/* Verified Parent Report View */}
        {isAuthenticated && (
          <div className="space-y-6">
            {reports.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
                <div className="text-4xl mb-3">📝</div>
                <h3 className="font-bold text-slate-900 mb-1">등록된 최근 수업 일지가 없습니다</h3>
                <p className="text-xs text-slate-500">선생님이 수업 일지를 등록하면 여기에 자동으로 브리핑 카드가 생성됩니다.</p>
              </div>
            ) : (
              <>
                {/* 1. Recent Lesson Featured Card */}
                {selectedReport && (
                  <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
                    {/* Header line */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 mr-2">
                          {selectedReport.category}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {new Date(selectedReport.lessonDateStart).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'short',
                          })}
                        </span>
                        {selectedReport.lessonTime && (
                          <span className="text-xs text-slate-500 ml-2 font-mono">({selectedReport.lessonTime})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getAttendanceBadge(selectedReport.attendance)}`}>
                          {selectedReport.attendance}
                        </span>
                      </div>
                    </div>

                    {/* Quick Metric Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <p className="text-[11px] text-slate-500 mb-0.5">수업 태도</p>
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-md border ${getAttitudeColor(selectedReport.attitude)}`}>
                          {selectedReport.attitude}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <p className="text-[11px] text-slate-500 mb-0.5">숙제 검사</p>
                        <span className="text-xs font-bold text-slate-800">{selectedReport.homework}</span>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <p className="text-[11px] text-slate-500 mb-0.5">단어 시험</p>
                        <p className="text-sm font-bold text-indigo-600">
                          {selectedReport.vocabularyScore !== null ? `${selectedReport.vocabularyScore}점` : '미응시'}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                        <p className="text-[11px] text-slate-500 mb-0.5">내신 대비 점수</p>
                        <p className="text-sm font-bold text-emerald-600">
                          {selectedReport.schoolExamScore !== null ? `${selectedReport.schoolExamScore}점` : '-'}
                        </p>
                      </div>
                    </div>

                    {/* Self Study Time if present */}
                    {selectedReport.selfStudyTime && (
                      <div className="flex items-center gap-2 text-xs bg-amber-50/70 border border-amber-200/70 p-3 rounded-xl text-amber-900 font-medium">
                        <span>⏳</span>
                        <span>자습 기록: {selectedReport.selfStudyTime}</span>
                      </div>
                    )}

                    {/* Detailed Teacher Feedback */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>💬</span> 수업 내용 및 지도 피드백
                      </h4>
                      <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                        {selectedReport.feedback || '등록된 수업 코멘트가 없습니다.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Previous Lessons List */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span>📚 지난 수업 기록 목록 ({reports.length}회차)</span>
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {reports.map((r) => {
                      const isSelected = selectedReport?.reportId === r.reportId;
                      return (
                        <div
                          key={r.reportId}
                          onClick={() => setSelectedReport(r)}
                          className={`py-3 px-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                            isSelected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {new Date(r.lessonDateStart).toLocaleDateString('ko-KR', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  weekday: 'short',
                                })}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">{r.lessonTime}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-medium">
                                {r.category}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1 max-w-md">
                              {r.feedback || '수업 코멘트 완료'}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 text-right">
                            <div className="text-xs font-bold">
                              {r.vocabularyScore !== null ? (
                                <span className="text-indigo-600 font-mono">{r.vocabularyScore}점</span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getAttendanceBadge(r.attendance)}`}>
                              {r.attendance}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
