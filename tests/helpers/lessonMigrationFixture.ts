import { lessonMigrationCutoff } from '../../api/_lib/lessonMigration.js';
// These fixtures predate the 2026-09-20 cutoff; the cutoff itself is covered in lessonMigrationCutoff.test.ts.
lessonMigrationCutoff.since = '2000-01-01';
import { templateFirestore } from './templateFirestore.js';
import { hashStudentKey } from '../../api/_lib/security.js';
import { DEFAULT_SOURCE } from '../../api/_lib/teacherNotionWorkspace.js';
import { runLessonMigration } from '../../api/_lib/lessonMigration.js';

export const DB = DEFAULT_SOURCE.lessonDatabaseId, STUDENT = '11111111-1111-4111-8111-111111111111', TEACHER_PAGE = '22222222-2222-4222-8222-222222222222';
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const admin = { uid: 'admin', admin: true, principal: false, academyId: 'main', scopes: [] };
const rel = (...ids: string[]) => ({ relation: ids.map(v => ({ id: v })), has_more: false });
const rich = (v: string) => ({ rich_text: v ? [{ plain_text: v }] : [] });
export function page(n: number, o: any = {}) {
    return { id: id(n), object: 'page', archived: false, parent: { database_id: DB }, last_edited_time: o.edited || `2026-09-0${(n % 9) + 1}T00:00:00.000Z`,
        properties: { '학생': rel(...(o.students ?? [STUDENT])), '담당 선생님': rel(TEACHER_PAGE), '작성자 선생님': rel(...(o.authors ?? [TEACHER_PAGE])), '과목': { select: { name: '영어' } }, '학원': rich('main'),
            '전송 완료': { select: o.sent === false ? null : { name: '완료' } }, '앱 기록 ID': rich(o.marker || ''), '타임 슬롯': { date: { start: o.date || '2026-09-01T14:00:00+09:00' } },
            '배정 시간': { title: [{ plain_text: o.time || '14:00 ~ 15:20' }] }, '회차': { number: o.round ?? n }, '수업 내용': rich(o.content ?? `수업 내용 ${n}\n\n과제: 복습`), '출석': { select: { name: '출석' } } } };
}
export function fakeNotion(pages: any[]) {
    const calls: string[] = []; let failures: string[] = [];
    const notion = async (path: string, method = 'GET', body?: any) => {
        calls.push(path);
        if (failures.length) throw Error(failures.shift());
        if (path === `databases/${DB}/query`) {
            const since = body?.filter?.last_edited_time?.on_or_after;
            const rows = pages.filter(p => !p.archived && (!since || Date.parse(p.last_edited_time) >= Date.parse(since))).sort((a, b) => a.last_edited_time.localeCompare(b.last_edited_time) || a.id.localeCompare(b.id));
            const start = Number(body?.start_cursor || 0), slice = rows.slice(start, start + body.page_size);
            return { results: structuredClone(slice), has_more: start + body.page_size < rows.length, next_cursor: start + body.page_size < rows.length ? String(start + body.page_size) : null };
        }
        if (path.startsWith('pages/')) { const p = pages.find(v => v.id === path.slice(6)); if (!p) throw Error('NOTION_404'); return structuredClone(p); }
        throw Error('UNEXPECTED_' + path);
    };
    return { notion, calls, fail: (...codes: string[]) => { failures = codes; } };
}
export function fixture(pages: any[]) {
    process.env.ADMIN_UID = 'admin';
    const f = templateFirestore();
    f.rows.set('academyNotionConfig/main', { mode: 'shared' });
    f.rows.set('teacherWorkspaceAccess/teacher', { academyId: 'main', notionTeacherPageId: TEACHER_PAGE, scopes: [] });
    f.rows.set('academyStudentMemberships/' + STUDENT, { academyId: 'main', internalStudentId: 'internal' });
    f.rows.set('notionStudentMappings/' + hashStudentKey(STUDENT), { studentKey: STUDENT, internalStudentId: 'internal' });
    const n = fakeNotion(pages);
    return { ...f, ...n };
}
export async function drain(f: any, actor: any = admin, extra: any = {}) {
    for (let i = 0; i < 50; i++) { const job = await runLessonMigration(f.db, actor, { notion: f.notion, budgetMs: 60000, ...extra }); if (job.status !== 'running') return job; }
    throw Error('NOT_FINISHED');
}
export const snapshot = (f: any, prefix: string) => JSON.stringify([...f.rows].filter(([k]) => k.startsWith(prefix)).sort());
export const report = (n: number, o: any = {}) => ({ internalStudentId: 'internal', notionPageId: id(n), lessonDateStart: '2026-09-01T14:00:00+09:00', subject: '영어', attendance: '출석', feedback: `수업 내용 ${n}\n\n과제: 복습`, reportIdentity: 'public-' + n, ...o });

