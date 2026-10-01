import type { StudentScheduleDTO } from '../types/lessonReport';

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
