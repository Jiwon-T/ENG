/** 수강료 is the price of 8 sessions. Only 8 sessions a month are charged; the 9th and later are free. */
export const TUITION_SESSIONS = 8;
export function tuitionCharge(tuition: number | null, sessions: number, free = 0) {
    const charged = Math.min(Math.max(sessions - free, 0), TUITION_SESSIONS);
    return { charged, amount: tuition == null ? null : Math.round(tuition * charged / TUITION_SESSIONS) };
}
/** CSV for Excel (UTF-8 BOM). Cells that start like a formula are kept as text. */
export function tuitionCsv(rows: (string | number | null)[][]) {
    const cell = (v: string | number | null) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
