/**
 * 학부모 리포트 날짜 및 배정 시간 포맷 헬퍼
 * 
 * - Asia/Seoul (한국 표준시) 기준 계산
 * - 사용자 화면에 T, 초, +09:00, ISO 원문 노출 원천 차단
 * - 잘못된 입력이 들어와도 raw ISO 대신 안전한 대체 문구 반환
 */

const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * ISO 8601 문자열을 Asia/Seoul 기준 날짜 컴포넌트로 파싱
 */
function parseSeoulDateParts(isoString: string | null | undefined): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: string;
  hour: number;
  minute: number;
} | null {
  if (!isoString || typeof isoString !== 'string') return null;

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;

    // Intl.DateTimeFormat with Asia/Seoul
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10);
    const day = parseInt(partMap.day, 10);
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);

    // Day of week in Korean
    // formatter weekday is "Sun", "Mon", etc.
    const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(partMap.weekday);
    const dayOfWeek = dayIndex >= 0 ? KOREAN_DAY_NAMES[dayIndex] : '';

    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    return { year, month, day, dayOfWeek, hour, minute };
  } catch {
    return null;
  }
}

/**
 * 24시간 형식의 hour, minute을 한국어 "오전/오후 h:mm" 형식으로 변환
 */
function formatKoreanTime(hour: number, minute: number): string {
  const period = hour < 12 ? '오전' : '오후';
  let displayHour = hour % 12;
  if (displayHour === 0) displayHour = 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${period} ${displayHour}:${displayMinute}`;
}

/**
 * 1. 상세 리포트용 전체 날짜 포맷
 * 예: 2026년 9월 29일 (화)
 */
export function formatReportDetailDate(lessonDateStart: string | null | undefined): string {
  const parts = parseSeoulDateParts(lessonDateStart);
  if (!parts) return '수업 날짜 확인 중';
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 (${parts.dayOfWeek})`;
}

/**
 * 2. 회차 목록 카드용 축약 날짜 포맷
 * 예: 9월 29일 (화)
 */
export function formatReportListDate(lessonDateStart: string | null | undefined): string {
  const parts = parseSeoulDateParts(lessonDateStart);
  if (!parts) return '날짜 확인 중';
  return `${parts.month}월 ${parts.day}일 (${parts.dayOfWeek})`;
}

/**
 * 3. 배정 시간 포맷 (lessonDateStart ~ lessonDateEnd)
 * 예: 오후 6:00 ~ 오후 7:30
 * lessonDateEnd가 없으면 시작 시간만 표시: 오후 6:00
 */
export function formatAssignedTime(
  lessonDateStart: string | null | undefined,
  lessonDateEnd: string | null | undefined
): string | null {
  const startParts = parseSeoulDateParts(lessonDateStart);
  if (!startParts) return null;

  const startTimeStr = formatKoreanTime(startParts.hour, startParts.minute);

  if (!lessonDateEnd) {
    return startTimeStr;
  }

  const endParts = parseSeoulDateParts(lessonDateEnd);
  if (!endParts) {
    return startTimeStr;
  }

  const endTimeStr = formatKoreanTime(endParts.hour, endParts.minute);
  return `${startTimeStr} ~ ${endTimeStr}`;
}

/**
 * 4. 회차 목록용 배정 시간 간략 포맷
 * 예: 오후 6:00 ~ 7:30 (시작과 종료 period가 같을 경우 또는 표준)
 */
export function formatAssignedTimeShort(
  lessonDateStart: string | null | undefined,
  lessonDateEnd: string | null | undefined
): string | null {
  return formatAssignedTime(lessonDateStart, lessonDateEnd);
}
