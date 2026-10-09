import { koreanDay } from '../../src/lib/teacherWeekCalendar.js';
import { canTeach } from './teacherWorkspacePolicy.js';
export function teacherReflectedSchedules(records: any[], mappings: Map<string, any>, actor: any) {
    const students = new Map<string, string>();
    for (const [key, mapping] of mappings)
        students.set(mapping.internalStudentId, key);
    const grouped = new Map<string, any>();
    for (const r of records) {
        const studentKey = students.get(r.internalStudentId), subject = r.subject || '영어';
        if (!studentKey || !(actor.principal ? actor.scopes.some((s:any)=>s.studentKey===studentKey && s.subject===subject) : canTeach(actor, studentKey, subject)) || !(r.notionScheduleId||r.appScheduleId) || !Number.isFinite(Date.parse(r.startAt)))
            continue;
        const start = new Date(r.startAt), end = r.endAt && Number.isFinite(Date.parse(r.endAt)) ? new Date(r.endAt) : null;
        const time = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
        // Excluded recipients retain cancelled copies; do not make an active group look cancelled.
        const id = `${(r.notionScheduleId||r.appScheduleId).replace(/-/g, '')}:${r.status === '취소' ? 'cancelled' : 'active'}`;
        const existing = grouped.get(id);
        if (existing) {
            if (!existing.students.includes(studentKey))
                existing.students.push(studentKey);
            continue;
        }
        grouped.set(id, { id, notionPageId: r.notionScheduleId||null, appScheduleId:r.appScheduleId||null, title: r.title, date: koreanDay(start), start: time(start), end: end ? time(end) : '', subject, students: [studentKey], kind: r.scheduleType, status: r.status, notice: r.notice });
    }
    return [...grouped.values()];
}
