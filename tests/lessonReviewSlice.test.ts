import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWorkspace } from '../api/teacher/workspace.js';
import { teacherReadCache, teacherReadKey } from '../api/_lib/teacherReadCache.js';
import { templateFirestore } from './helpers/templateFirestore.js';
import { STUDENT, id, admin, sourceRecord, fixture, report } from './helpers/lessonAppFixture.js';

const S2 = '33333333-3333-4333-8333-333333333333';
const lesson = (date: string, o: any = {}) => ({ studentKey: STUDENT, subject: '영어', date, start: '14:00', end: '15:20', classSession: '있음', content: '수업 ' + date, ...o });
async function call(db: any, actor: any, query: Record<string, string>) {
    let body: any; const res: any = { statusCode: 200, setHeader() {}, end(v: string) { body = JSON.parse(v); } };
    await handleWorkspace({ method: 'GET', url: '/api/teacher/workspace?' + new URLSearchParams(query), headers: {} } as any, res, async () => ({ ...actor, db }));
    return { status: res.statusCode, ...body };
}
const ids = (rows: any[]) => rows.map((r: any) => r.id + ':' + r.data.date).sort();

/** Legacy mode: drafts in Firestore, Notion rows from the (cached) source reader. */
function legacy() {
    const f = templateFirestore(), actor = { uid: 'admin', admin: true, principal: false, academyId: 'main', scopes: [], teachingScopes: [] };
    const N = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const notionRows = [
        { id: N(1), notionPageId: N(1), appRecordId: '', data: lesson('2026-10-01'), ownerUid: 't1', academyId: 'main', stage: 'published', revision: 0, source: 'notion' },
        { id: N(2), notionPageId: N(2), appRecordId: '', data: lesson('2026-10-01', { start: '17:00' }), ownerUid: 't1', academyId: 'main', stage: 'published', revision: 0, source: 'notion' },
        { id: N(3), notionPageId: N(3), appRecordId: N(903), data: lesson('2026-10-03'), ownerUid: 't1', academyId: 'main', stage: 'published', revision: 0, source: 'notion' },
        { id: N(4), notionPageId: N(4), appRecordId: '', data: lesson('2026-10-04', { studentKey: S2 }), ownerUid: 't2', academyId: 'main', stage: 'published', revision: 0, source: 'notion' },
    ];
    // N(1)'s app copy moved to 10-02 (pending edit); N(2)'s app copy is archived; N(903) is linked only by marker.
    f.rows.set('teacherLessonDrafts/' + N(901), { ownerUid: 't1', academyId: 'main', notionPageId: N(1), revision: 2, stage: 'draft', data: lesson('2026-10-02') });
    f.rows.set('teacherLessonDrafts/' + N(902), { ownerUid: 't1', academyId: 'main', notionPageId: N(2), revision: 3, stage: 'published', archived: true, data: lesson('2026-10-01', { start: '17:00' }) });
    f.rows.set('teacherLessonDrafts/' + N(903), { ownerUid: 't1', academyId: 'main', revision: 1, stage: 'draft', data: lesson('2026-10-03', { content: '앱 초안' }) });
    for (let i = 0; i < 40; i++) f.rows.set('teacherLessonDrafts/' + N(1000 + i), { ownerUid: 't2', academyId: 'main', revision: 1, stage: 'published', lastSubmittedRevision: 1, data: lesson(`2026-09-${String(1 + (i % 28)).padStart(2, '0')}`, { studentKey: S2 }) });
    for (const uid of ['t1', 't2', 't3']) { f.rows.set('users/' + uid, { name: uid + ' 선생님' }); f.rows.set('teacherWorkspaceAccess/' + uid, { academyId: 'main' }); }
    teacherReadCache.clear();
    const prime = () => teacherReadCache.get(teacherReadKey(actor, 'academy-source'), async () => structuredClone(notionRows));
    return { ...f, actor, prime, N };
}

test('a date or student slice returns exactly what the full read returns, with far fewer document reads', async () => {
    const f = legacy(); await f.prime();
    f.resetMetrics(); const full = await call(f.db, f.actor, { action: 'academy-lessons' }); const fullReads = f.metrics.readDocuments;
    assert.equal(full.ok, true);
    for (const day of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-09-05']) {
        await f.prime(); f.resetMetrics();
        const slice = await call(f.db, f.actor, { action: 'academy-lessons', page: '1', day });
        assert.deepEqual(ids(slice.records), ids(full.records.filter((r: any) => r.data.date === day)), day);
        assert.ok(f.metrics.readDocuments < fullReads, `${day}: ${f.metrics.readDocuments} < ${fullReads}`);
    }
    const oct1 = await call(f.db, f.actor, { action: 'academy-lessons', page: '1', day: '2026-10-01' });
    assert.equal(oct1.records.length, 0, 'moved and archived app copies still win over their Notion rows');
    const oct3 = await call(f.db, f.actor, { action: 'academy-lessons', page: '1', day: '2026-10-03' });
    assert.equal(oct3.records[0].data.content, '앱 초안', 'marker-linked app draft still replaces its Notion row');
    const byStudent = await call(f.db, f.actor, { action: 'academy-lessons', page: '1', student: S2, period: 'all' });
    assert.equal(byStudent.total, full.records.filter((r: any) => r.data.studentKey === S2).length);
    assert.deepEqual(oct1.teachers.map((t: any) => t.uid).sort(), ['t1', 't2', 't3'], 'teacher filter still lists every teacher');
});

test('export and bad filters', async () => {
    const f = legacy(); await f.prime();
    await teacherReadCache.get(teacherReadKey(f.actor, 'students'), async () => [{ studentKey: STUDENT, studentDisplayName: '학생' }]);
    const exp = await call(f.db, f.actor, { action: 'academy-lessons-export', day: '2026-10-02', teacher: 't1' });
    assert.deepEqual(exp.records.map((r: any) => r.data.date), ['2026-10-02']);
    assert.equal((await call(f.db, f.actor, { action: 'academy-lessons', page: '1', day: '2026/10/02' })).status, 400);
    assert.equal((await call(f.db, f.actor, { action: 'academy-lessons', page: '1', student: 'x' })).status, 400);
    const teacher = { uid: 't2', admin: false, principal: false, academyId: 'main', scopes: [{ studentKey: S2, subject: '영어' }], teachingScopes: [] };
    teacherReadCache.clear(); await teacherReadCache.get(teacherReadKey(teacher, 'academy-source'), async () => []);
    const own = await call(f.db, teacher, { action: 'academy-lessons', page: '1', day: '2026-09-05' });
    assert.ok(own.records.every((r: any) => r.ownerUid === 't2'));
});

test('app mode slices migrated rows by date too', async () => {
    const f = fixture([sourceRecord(1, { date: '2026-09-01T14:00:00+09:00' }), sourceRecord(2, { date: '2026-09-08T14:00:00+09:00' })]);
    f.rows.set('lessonReports/' + id(1), report(1)); f.rows.set('lessonReports/' + id(2), report(2, { lessonDateStart: '2026-09-08T14:00:00+09:00' }));
    f.rows.set('academyCoreAuthority/main', { active: true });
    teacherReadCache.clear();
    const actor = { ...admin, scopes: [], teachingScopes: [] };
    const slice = await call(f.db, actor, { action: 'academy-lessons', page: '1', day: '2026-09-08' });
    assert.deepEqual(slice.records.map((r: any) => r.id), [id(2)]);
});
import { recentLessonDays, dayChunks, validLessonSliceFilter } from '../api/_lib/lessonReviewSlice.js';
test('review defaults to the last 7 days; 전체 keeps the full list; the quick first paint is narrowed too', async () => {
    const f = templateFirestore(), actor = { uid: 'admin', admin: true, principal: false, academyId: 'main', scopes: [], teachingScopes: [] };
    const days = recentLessonDays(40); // [today, yesterday, ...]
    [0, 3, 6, 7, 20, 35].forEach((back, i) => f.rows.set(`teacherLessonDrafts/00000000-0000-4000-8000-00000000010${i}`, { ownerUid: 't1', academyId: 'main', revision: 1, stage: 'published', lastSubmittedRevision: 1, data: lesson(days[back]) }));
    f.rows.set('users/t1', { name: '선생님' }); f.rows.set('teacherWorkspaceAccess/t1', { academyId: 'main' });
    teacherReadCache.clear(); await teacherReadCache.get(teacherReadKey(actor, 'academy-source'), async () => []);
    const week = await call(f.db, actor, { action: 'academy-lessons', page: '1' });
    assert.deepEqual(week.records.map((r: any) => r.data.date), [days[0], days[3], days[6]]); assert.deepEqual(week.range, { from: days[6], to: days[0] });
    assert.equal((await call(f.db, actor, { action: 'academy-lessons', page: '1', period: '31' })).total, 5);
    const all = await call(f.db, actor, { action: 'academy-lessons', page: '1', period: 'all' });
    assert.equal(all.total, 6); assert.equal(all.range, null);
    f.resetMetrics(); const fast = await call(f.db, actor, { action: 'academy-lessons-fast', page: '1' });
    assert.equal(fast.total, 3); assert.ok(f.metrics.readDocuments <= 6, 'quick paint reads only the week: ' + f.metrics.readDocuments);
    assert.equal((await call(f.db, actor, { action: 'academy-lessons', page: '1', period: '5' })).status, 400);
    assert.equal((await call(f.db, actor, { action: 'academy-lessons', page: '1', day: days[20], period: '7' })).total, 1, 'a chosen day wins over the period');
});
test('Korean day boundary and query chunking', () => {
    assert.equal(recentLessonDays(1, Date.parse('2026-10-09T15:30:00Z'))[0], '2026-10-10');
    assert.equal(recentLessonDays(1, Date.parse('2026-10-09T14:59:00Z'))[0], '2026-10-09');
    assert.deepEqual(recentLessonDays(3, Date.parse('2026-03-01T03:00:00Z')), ['2026-03-01', '2026-02-28', '2026-02-27']);
    assert.deepEqual(dayChunks(recentLessonDays(92)).map(c => c.length), [30, 30, 30, 2]);
    assert.equal(validLessonSliceFilter('', '', 'all').days, undefined);
});
