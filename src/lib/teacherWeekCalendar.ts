export const koreanDay = (value: Date | string = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(value));
export function addCalendarDays(date: string, amount: number) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); }
export function mondayOfWeek(date: string) { const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); return addCalendarDays(date, -((weekday + 6) % 7)); }
export function calendarWeek(date: string) { const monday = mondayOfWeek(date); return Array.from({ length: 7 }, (_, index) => addCalendarDays(monday, index)); }
export function weeklyBoardEvents(date: string, schedules: any[], classes: any[], reflected: any[] = []) {
    const days = calendarWeek(date), sources = new Set(schedules.map(s => (s.notionPageId || '').replace(/-/g, '')));
    return days.map(day => ({ day, events: [
            ...schedules.filter(s => s.data.date === day).map(s => ({ id: s.id, type: 'schedule', title: s.data.title, start: s.data.start, end: s.data.end, subject: s.data.subject, students: s.data.students, kind: s.data.kind === '시험' ? '테스트' : s.data.kind, status: s.data.status, stage: s.stage, record: s })),
            ...reflected.filter(s => s.date === day && !sources.has(s.notionPageId.replace(/-/g, ''))).map(s => ({ ...s, type: 'reflected', stage: 'published' })),
            ...classes.flatMap(c => c.slots.filter((slot: any) => slot.weekday === new Date(`${day}T00:00:00Z`).getUTCDay()).map((slot: any, index: number) => ({ id: `regular-${c.id}-${index}`, type: 'regular', title: c.name, start: slot.start, end: slot.end, subject: c.subject, students: slot.students?.length ? slot.students : c.students, kind: slot.kind === 'test' ? '테스트' : '정규', status: '', stage: 'regular', record: c }))),
        ].sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title)) }));
}
