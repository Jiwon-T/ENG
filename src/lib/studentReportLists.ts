import type { StudentScheduleDTO } from '../types/lessonReport';

/** Parent history stays visible; pending rows first, then distance from today in Korea. */
export function sortParentSchedules(schedules: StudentScheduleDTO[], now = Date.now()): StudentScheduleDTO[] {
  const dayMs = 86_400_000;
  const koreaOffset = 9 * 60 * 60 * 1000;
  const today = Math.floor((now + koreaOffset) / dayMs);
  const day = (value: string) => {
    // Date-only Notion values denote a local calendar day, not a UTC timestamp.
    const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : value);
    return Number.isFinite(parsed) ? Math.floor((parsed + koreaOffset) / dayMs) : null;
  };
  return [...schedules].sort((a, b) => {
    const priority = Number(b.status === '예정') - Number(a.status === '예정');
    if (priority) return priority;
    const aDay = day(a.startAt), bDay = day(b.startAt);
    if (aDay === null || bDay === null) return aDay === bDay ? 0 : aDay === null ? 1 : -1;
    const distance = Math.abs(aDay - today) - Math.abs(bDay - today);
    if (distance) return distance;
    // On equal distance show the future day first; same-day rows use start time.
    return bDay - aDay || Date.parse(a.startAt) - Date.parse(b.startAt);
  });
}

export function visibleStudentSchedules(schedules: StudentScheduleDTO[], now = Date.now()): StudentScheduleDTO[] {
  const cutoff = now - 14 * 24 * 60 * 60 * 1000;
  const time = (value: string | null | undefined) => {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return schedules.filter(schedule => schedule.status !== '완료'
    || time(schedule.completedAt || schedule.endAt || schedule.startAt) > cutoff)
    .sort((a, b) => {
      if (a.status === '예정' && b.status !== '예정') return -1;
      if (b.status === '예정' && a.status !== '예정') return 1;
      if (a.status === '예정' && b.status === '예정') {
        const aTime = time(a.startAt), bTime = time(b.startAt);
        const aUpcoming = aTime >= now, bUpcoming = bTime >= now;
        if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
        return aUpcoming ? aTime - bTime : bTime - aTime;
      }
      return time(b.startAt) - time(a.startAt);
    });
}
