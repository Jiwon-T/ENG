import { z } from 'zod';
import { readTuitionMonth } from './tuitionMonth.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
// 선생님 정산: each tuition row's charge goes to the student's teacher for that subject, times that teacher's share.
// Shares are for the admin and the principal only (teachers must not see anyone's rate): payrollSettings/main.defaultShare + payrollRates/{uid}.
export const DEFAULT_TEACHER_SHARE = 60;
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const share = z.number().int().min(0).max(100);
function adminOnly(actor: any) { if (actor.academyId !== 'main' || !(actor.admin || actor.principal)) throw Error('FORBIDDEN'); }
const settingsRef = (db: any) => db.collection('payrollSettings').doc('main');
const monthRef = (db: any, m: string) => db.collection('payrollMonths').doc(`main:${m}`);

/** Split one row's charge by each teacher's sessions (weights); with no sessions at all, evenly. */
export function splitRow(amount: number, teachers: string[], writers: Record<string, number> = {}) {
    if (!teachers.length) return [];
    const weights = teachers.map(uid => writers[uid] || 0), sum = weights.reduce((a, b) => a + b, 0);
    const parts = teachers.map((uid, i) => ({ uid, part: sum ? weights[i] / sum : 1 / teachers.length }));
    let left = amount;
    return parts.map((p, i) => { const value = i === parts.length - 1 ? left : Math.round(amount * p.part); left -= value; return { uid: p.uid, part: p.part, amount: value }; });
}

export async function readTeacherPayroll(db: any, actor: any, monthInput: unknown, now = Date.now()) {
    adminOnly(actor);
    const m = month.parse(monthInput);
    const [sheet, access, users, settings, rates, saved] = await Promise.all([
        readTuitionMonth(db, actor, m, now), db.collection('teacherWorkspaceAccess').get(), db.collection('users').where('role', 'in', ['teacher', 'principal']).get(),
        settingsRef(db).get(), db.collection('payrollRates').get(), monthRef(db, m).get(),
    ]);
    const defaultShare = typeof settings.data()?.defaultShare === 'number' ? settings.data().defaultShare : DEFAULT_TEACHER_SHARE;
    const rate = new Map<string, number>(rates.docs.filter((d: any) => typeof d.data().share === 'number').map((d: any) => [d.id, d.data().share]));
    const names = new Map<string, string>(users.docs.map((d: any) => [d.id, String(d.data().alias || d.data().name || '선생님')]));
    const staff = access.docs.map((d: any) => ({ uid: d.id, ...d.data() })).filter((p: any) => p.academyId === 'main');
    const nameOf = (uid: string) => { const p = staff.find((s: any) => s.uid === uid); return p?.workspaceLabel || names.get(uid) || '선생님'; };
    const adjust = saved.data()?.adjust || {};
    const teachers = new Map<string, any>(), unassigned: any[] = [];
    const card = (uid: string) => {
        if (!teachers.has(uid)) teachers.set(uid, { uid, name: nameOf(uid), disconnected: Boolean(staff.find((s: any) => s.uid === uid)?.disabled), share: rate.get(uid) ?? defaultShare, customShare: rate.has(uid), rows: [], revenue: 0, pay: 0 });
        return teachers.get(uid);
    };
    for (const r of sheet.rows) {
        const assigned = staff.filter((p: any) => !p.disabled && (p.scopes || []).some((s: any) => uuid(s.studentKey || '') === r.studentKey && s.subject === r.subject)).map((p: any) => p.uid);
        // Who gets paid follows the month's 일지, not today's assignment: a teacher who taught part of the month
        // (even if since replaced or disconnected) is paid for the lessons they wrote. Sessions still ahead on the
        // timetable belong to the teacher(s) assigned now.
        const sessions: Record<string, number> = { ...(r.writers || {}) };
        if (r.planned > 0 && assigned.length) for (const uid of assigned) sessions[uid] = (sessions[uid] || 0) + r.planned / assigned.length;
        if (!Object.keys(sessions).length) for (const uid of assigned) sessions[uid] = 0;
        const payees = Object.keys(sessions);
        if (!payees.length || r.amount == null) { unassigned.push({ key: r.key, name: r.name, subject: r.subject, amount: r.amount, reason: r.amount == null ? 'no-price' : 'no-teacher' }); continue; }
        for (const part of splitRow(r.amount, payees, sessions)) {
            const t = card(part.uid), pay = Math.round(part.amount * t.share / 100);
            t.rows.push({ key: r.key, name: r.name, subject: r.subject, charged: r.charged, amount: r.amount, part: part.part, revenue: part.amount, pay, shared: payees.length > 1, written: r.writers?.[part.uid] || 0, planned: assigned.includes(part.uid) && r.planned > 0 ? Math.round(r.planned / assigned.length * 10) / 10 : 0, assigned: assigned.includes(part.uid) });
            t.revenue += part.amount; t.pay += pay;
        }
    }
    for (const uid of Object.keys(adjust)) card(uid); // an adjustment alone still shows the teacher
    const list = [...teachers.values()].map(t => { const a = adjust[t.uid] || {}, extra = typeof a.amount === 'number' ? a.amount : 0; return { ...t, adjust: extra, adjustNote: String(a.note || ''), total: t.pay + extra }; }).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    const revenue = sheet.rows.reduce((n: number, r: any) => n + (r.amount || 0), 0), teacherTotal = list.reduce((n, t) => n + t.total, 0);
    return {
        month: m, defaultShare, sheetConfirmedAt: sheet.confirmedAt, revision: saved.data()?.revision || 0, teachers: list, unassigned, revenue, teacherTotal, academy: revenue - teacherTotal,
        staff: staff.filter((p: any) => !p.disabled).map((p: any) => ({ uid: p.uid, name: nameOf(p.uid), share: rate.get(p.uid) ?? null })).sort((a: any, b: any) => a.name.localeCompare(b.name, 'ko')),
    };
}

/** Default share and per-teacher shares (null = back to the default). */
export async function saveTeacherShares(db: any, actor: any, input: unknown, now = Date.now()) {
    adminOnly(actor);
    const v = z.object({ defaultShare: share.optional(), shares: z.record(z.string().min(1).max(200), share.nullable()).default({}) }).strict().parse(input);
    if (Object.keys(v.shares).length > 200) throw Error('PAYROLL_TOO_MANY');
    return db.runTransaction(async (tx: any) => {
        const old = await Promise.all(Object.keys(v.shares).map(async uid => [uid, (await tx.get(db.collection('payrollRates').doc(uid))).data()?.share ?? null] as const));
        const oldDefault = (await tx.get(settingsRef(db))).data()?.defaultShare ?? DEFAULT_TEACHER_SHARE;
        if (v.defaultShare !== undefined) tx.set(settingsRef(db), { academyId: 'main', defaultShare: v.defaultShare, updatedAt: now, updatedBy: actor.uid });
        for (const [uid, value] of Object.entries(v.shares)) { const ref = db.collection('payrollRates').doc(uid); if (value === null) tx.delete(ref); else tx.set(ref, { academyId: 'main', share: value, updatedAt: now, updatedBy: actor.uid }); }
        tx.set(db.collection('payrollRateHistory').doc(String(now)), { before: { defaultShare: oldDefault, shares: Object.fromEntries(old) }, after: { defaultShare: v.defaultShare ?? oldDefault, shares: v.shares }, by: actor.uid, at: now });
        return { saved: true };
    });
}

/** Per-teacher extra or deduction for one month (e.g. 수당, 교재비), with a note. */
export async function savePayrollAdjust(db: any, actor: any, input: unknown, now = Date.now()) {
    adminOnly(actor);
    const entry = z.object({ amount: z.number().int().min(-100_000_000).max(100_000_000), note: z.string().max(200).default('') }).strict().nullable();
    const v = z.object({ month, revision: z.number().int().min(0), adjust: z.record(z.string().min(1).max(200), entry) }).strict().parse(input);
    const ref = monthRef(db, v.month);
    return db.runTransaction(async (tx: any) => {
        const old = (await tx.get(ref)).data() || { adjust: {}, revision: 0 };
        if ((old.revision || 0) !== v.revision) throw Error('PAYROLL_CONFLICT');
        const adjust: Record<string, any> = { ...(old.adjust || {}) };
        for (const [uid, a] of Object.entries(v.adjust)) { if (a === null || a.amount === 0 && !a.note) delete adjust[uid]; else adjust[uid] = a; }
        const next = { academyId: 'main', month: v.month, adjust, revision: (old.revision || 0) + 1, updatedAt: now, updatedBy: actor.uid };
        tx.set(ref, next);
        tx.set(db.collection('payrollMonthHistory').doc(`${v.month}:${next.revision}`), { before: old.adjust || {}, after: adjust, by: actor.uid, at: now });
        return { revision: next.revision };
    });
}
