import test from 'node:test';
import assert from 'node:assert/strict';
import { templateFirestore } from './helpers/templateFirestore.js';
import { handleStudentDirectory } from '../api/teacher/notion-students.js';
import { directoryRowKey, directorySourceKey, DIRECTORY_STATE } from '../api/_lib/academyDirectorySource.js';

const app = '11111111-1111-4111-8111-111111111111', legacy = '22222222-2222-4222-8222-222222222222';
async function call(f: any, listNotionStudents: any) {
    let body: any; const res: any = { statusCode: 0, setHeader() {}, end(v: string) { body = JSON.parse(v); } };
    await handleStudentDirectory({ method: 'GET', headers: {} } as any, res, { verifyAdminAuth: async () => ({}), getFirebaseAdmin: () => ({ db: f.db }), listNotionStudents } as any);
    return { status: res.statusCode, ...body };
}

test('account-link roster uses Notion before the core cutover and the app directory (with app-registered students) after it', async () => {
    const f = templateFirestore(); let notionCalls = 0;
    const listNotionStudents = async () => { notionCalls++; return [{ studentKey: legacy, studentDisplayName: '노션 학생', hasGuardianContact: true, enrollmentStatus: '재원' }]; };
    const before = await call(f, listNotionStudents);
    assert.equal(before.status, 200); assert.deepEqual(before.students.map((s: any) => s.studentKey), [legacy]); assert.equal(notionCalls, 1);
    f.rows.set('academyCoreAuthority/main', { active: true });
    f.rows.set(DIRECTORY_STATE + '/' + directorySourceKey('students'), { ready: true, approved: true, runVersion: 1, leaseUntil: 0 });
    for (const [key, name, origin] of [[app, '앱 학생', 'app'], [legacy, '노션 학생', 'notion']])
        f.rows.set('academyDirectorySources/' + directoryRowKey('students', key), { sourceKey: directorySourceKey('students'), academyId: 'main', kind: 'students', entityId: key, notionPageId: key, origin, fields: { properties: { 학생: { title: [{ plain_text: name }] }, 보호자연락처: { phone_number: '01012345678' } } } });
    for (const key of [app, legacy]) f.rows.set('academyStudentMemberships/' + key, { academyId: 'main' });
    f.rows.set('notionStudentMappings/x', { studentKey: app, internalStudentId: 'internal-app', firebaseUid: 'student-uid' });
    const after = await call(f, listNotionStudents);
    assert.equal(after.status, 200); assert.equal(notionCalls, 1, 'no Notion call after cutover');
    assert.deepEqual(after.students.map((s: any) => s.studentKey).sort(), [app, legacy].sort());
    assert.equal(after.students.find((s: any) => s.studentKey === app).studentDisplayName, '앱 학생');
});
