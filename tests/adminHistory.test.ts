import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { readAdminHistory } from '../api/_lib/adminHistory.js';
const K = '11111111-1111-4111-8111-111111111111';
test('관리 기록: one newest-first list in plain words, admin and principal only', async () => {
    process.env.ADMIN_UID = 'admin';
    const f = templateFirestore(), put = (p: string, v: any) => f.rows.set(p, v);
    put('users/admin', { name: '지원T' }); put('users/t1', { name: '김선생' });
    put('appUserRoleHistory/t1:1', { uid: 't1', from: 'student', to: 'teacher', by: 'admin', at: 1000 });
    put('studentTuitionHistory/k:2', { studentKey: K, before: { 영어: 300000 }, after: { 영어: 320000 }, by: 'admin', at: 3000, source: 'tuition-sheet' });
    put('tuitionMonthHistory/2026-10:1', { month: '2026-10', before: {}, after: {}, by: 'admin', at: 2000, confirm: true });
    put('payrollRateHistory/4000', { before: { defaultShare: 60, shares: { t1: null } }, after: { defaultShare: 60, shares: { t1: 50 } }, by: 'admin', at: 4000 });
    const r = await readAdminHistory(f.db, { uid: 'p', principal: true, admin: false, academyId: 'main' }, 'all');
    assert.deepEqual(r.entries.map((e: any) => [e.area, e.text, e.by]), [
        ['정산', '정산 비율 · 김선생 기본 → 50%', '지원T'],
        ['수강료', '학생 · 영어 300,000원 → 320,000원 (수강료 계산 표)', '지원T'],
        ['수강료', '2026-10 수강료 확정', '지원T'],
        ['회원', '김선생 · 선생님 권한 주기', '지원T'],
    ]);
    assert.deepEqual((await readAdminHistory(f.db, { uid: 'p', principal: true, admin: false, academyId: 'main' }, 'account')).entries.length, 1);
    await assert.rejects(readAdminHistory(f.db, { uid: 't1', admin: false, principal: false, academyId: 'main' }, 'all'), /FORBIDDEN/);
});
