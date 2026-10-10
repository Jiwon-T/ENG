import { z } from 'zod';
import { DIRECTORY_ROWS, directoryRowKey } from './academyDirectorySource.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
// 관리자 설정 › 관리 기록: one list of who changed what, read from the history records the app already keeps.
// Admin and principal only (it includes pay shares, tuition and account changes).
const groups = {
    account: [['appUserRoleHistory', 'role'], ['appUserRemovals', 'removal']],
    tuition: [['studentTuitionHistory', 'price'], ['tuitionMonthHistory', 'sheet']],
    payroll: [['payrollRateHistory', 'share'], ['payrollMonthHistory', 'adjust']],
    class: [['academyManagedHistory', 'managed']],
} as const;
type Group = keyof typeof groups;
const won = (n: any) => typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '없음';
const titleOf = (p: any) => { const t = p?.['학생'] || p?.['학생 이름'] || Object.values(p || {}).find((v: any) => v?.type === 'title'); return (t?.title || []).map((v: any) => v.plain_text ?? v.text?.content ?? '').join(''); };

export async function readAdminHistory(db: any, actor: any, groupInput: unknown) {
    if (actor.academyId !== 'main' || !(actor.admin || actor.principal)) throw Error('FORBIDDEN');
    const group = z.enum(['all', 'account', 'tuition', 'payroll', 'class']).parse(groupInput || 'all');
    const sources = (group === 'all' ? Object.values(groups).flat() : groups[group as Group]) as readonly (readonly [string, string])[];
    const lists = await Promise.all(sources.map(async ([name, kind]) => { try { const q = await db.collection(name).orderBy('at', 'desc').limit(40).get(); return q.docs.map((d: any) => ({ id: d.id, kind, ...d.data() })); } catch { return []; } }));
    const rows = lists.flat().filter((r: any) => typeof r.at === 'number').sort((a: any, b: any) => b.at - a.at).slice(0, 120);
    // Names for the people involved (staff and accounts) and for students.
    const uids = new Set<string>(), students = new Set<string>();
    for (const r of rows) {
        if (r.by) uids.add(r.by);
        if (r.kind === 'role' && r.uid) uids.add(r.uid);
        if (r.kind === 'share') for (const uid of Object.keys({ ...(r.before?.shares || {}), ...(r.after?.shares || {}) })) uids.add(uid);
        if (r.kind === 'adjust') for (const uid of Object.keys({ ...(r.before || {}), ...(r.after || {}) })) uids.add(uid);
        if (r.kind === 'price' && r.studentKey) students.add(uuid(r.studentKey));
    }
    const getAll = async (refs: any[]) => !refs.length ? [] : typeof db.getAll === 'function' ? db.getAll(...refs) : Promise.all(refs.map(r => r.get()));
    const [people, kids] = await Promise.all([getAll([...uids].map(uid => db.collection('users').doc(uid))), getAll([...students].map(key => db.collection(DIRECTORY_ROWS).doc(directoryRowKey('students', key))))]);
    const name = new Map<string, string>(people.map((d: any) => [d.id, String(d.data()?.alias || d.data()?.name || d.data()?.email || '').trim()]));
    if (process.env.ADMIN_UID && !name.get(process.env.ADMIN_UID)) name.set(process.env.ADMIN_UID, '관리자');
    const student = new Map<string, string>([...students].map((key, i) => [key, kids[i]?.data()?.summaryOverride?.studentDisplayName || titleOf(kids[i]?.data()?.fields?.properties) || '학생']));
    const who = (uid: string) => name.get(uid) || '알 수 없음';
    const describe = (r: any): { area: string; text: string } => {
        switch (r.kind) {
            case 'role': return { area: '회원', text: `${who(r.uid)} · ${r.to === 'teacher' ? '선생님 권한 주기' : '학생으로 되돌리기'}` };
            case 'removal': return { area: '회원', text: `${r.user?.alias || r.user?.name || r.user?.email || '계정'} · 탈퇴${r.signInBlocked ? ' (로그인 막힘)' : ''}` };
            case 'price': { const before = r.before || {}, after = r.after || {}; const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => before[k] !== after[k]).map(k => `${k} ${won(before[k])} → ${won(after[k])}`); return { area: '수강료', text: `${student.get(uuid(r.studentKey || '')) || '학생'} · ${changes.join(', ') || '변경 없음'}${r.source === 'tuition-sheet' ? ' (수강료 계산 표)' : r.source === 'profile' ? ' (학생 정보 수정)' : r.source === 'registration' ? ' (입학 원서)' : ''}` }; }
            case 'sheet': return { area: '수강료', text: r.confirm ? `${r.month} 수강료 확정` : `${r.month} 수강료 표 수정 ${Object.keys(r.after || {}).length}줄` };
            case 'share': { const b = r.before || {}, a = r.after || {}; const parts = [b.defaultShare !== a.defaultShare ? `기본 ${b.defaultShare}% → ${a.defaultShare}%` : '', ...Object.entries(a.shares || {}).map(([uid, v]: any) => `${who(uid)} ${b.shares?.[uid] ?? '기본'} → ${v ?? '기본'}${v == null ? '' : '%'}`)].filter(Boolean); return { area: '정산', text: `정산 비율 · ${parts.join(', ') || '변경 없음'}` }; }
            case 'adjust': { const month = String(r.id || '').split(':')[0]; const keys = [...new Set([...Object.keys(r.before || {}), ...Object.keys(r.after || {})])]; return { area: '정산', text: `${month} 정산 조정 · ${keys.map(uid => `${who(uid)} ${won(r.after?.[uid]?.amount ?? 0)}`).join(', ')}` }; }
            case 'managed': { const row = r.after || r.before || {}; const what = r.id?.startsWith('teacherCurricula') ? '커리큘럼' : '반'; const action = !r.before ? '추가' : row.archived ? '삭제' : '수정'; return { area: '반·커리큘럼', text: `${what} ‘${row.name || row.title || '이름 없음'}’ ${action}` }; }
        }
        return { area: '기타', text: r.kind };
    };
    return { group, entries: rows.map((r: any) => ({ id: `${r.kind}:${r.id}`, at: r.at, by: r.by ? who(r.by) : '시스템', ...describe(r) })) };
}
