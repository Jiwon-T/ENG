import { schoolExamDetails, assessmentDetails, detailMetadata } from './academicExamPeriod';
export function academicBatchPayload(common: any, row: any) { return { studentKey: row.studentKey, subject: common.subject, examType: common.examType, examDetail: common.examDetail || '', examYear: common.examYear ?? null, ...detailMetadata(common.examDetail || ''), title: common.title.trim(), examDate: common.examDate, deadline: common.deadline || null, score: row.submissionStatus === '제출 완료' ? row.score : null, maxScore: common.maxScore, grade: row.grade || '', submissionStatus: row.submissionStatus, note: row.note || '' }; }
export function academicBatchError(value: any) { const date = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s; if (!value.title || value.title.length > 200)
    return '시험명을 입력해 주세요.'; if (!date(value.examDate) || value.deadline && !date(value.deadline))
    return '시험일과 제출 기한을 확인해 주세요.'; if (value.examYear !== null && (!Number.isInteger(value.examYear) || value.examYear < 1900 || value.examYear > 2200))
    return '연도를 확인해 주세요.'; if (value.examDetail && !(value.examType === '학교 내신' ? schoolExamDetails : assessmentDetails).includes(value.examDetail as never))
    return '세부 종류를 확인해 주세요.'; if (value.maxScore !== null && (!Number.isFinite(value.maxScore) || value.maxScore <= 0))
    return '만점은 0보다 커야 합니다.'; if (value.score !== null && (!Number.isFinite(value.score) || value.score < 0 || value.maxScore !== null && value.score > value.maxScore))
    return '점수가 만점을 넘거나 잘못 입력되었습니다.'; if (value.submissionStatus === '제출 완료' && (value.score === null || value.maxScore === null))
    return '점수와 만점을 입력해 주세요.'; if (value.grade.length > 50 || value.note.length > 5000)
    return '등급이나 비고가 너무 깁니다.'; return ''; }
const stable = (value: any): string => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
export const sameAcademicPayload = (a: any, b: any) => stable(a) === stable(b);
/** Per-row immutable identities survive partial failure; no group server endpoint. */
export async function saveAcademicBatchRow(request: (action: string, body: any) => Promise<any>, row: any) { try {
    const result = await request('save-academic', { id: row.id, revision: row.revision, ...(row.notionEditedAt ? { notionEditedAt: row.notionEditedAt } : {}), data: row.payload });
    if (!result.record)
        throw Error('저장 결과를 확인해야 합니다.');
    return result.record;
}
catch (original) {
    try {
        const result = await request('read:managed-record', { kind: 'academic', id: row.id });
        if (result.record && !result.record.archived && !result.record.deleteRequested && sameAcademicPayload(result.record.data, row.payload))
            return result.record;
    }
    catch { }
    throw original;
} }
export async function applyAcademicBatch(request: (action: string, body: any) => Promise<any>, rows: any[], publish: boolean, changed: (id: string, value: any) => void) { const results = []; for (const row of rows) {
    changed(row.id, { phase: publish ? 'publishing' : 'saving', payload: row.payload, error: '' });
    let stored = Boolean(row.revision);
    try {
        let record: any;
        if (['new', 'failed-save'].includes(row.phase)) {
            record = await saveAcademicBatchRow(request, row);
            stored = true;
            changed(row.id, { phase: 'saved', revision: record.revision });
        }
        else
            record = { id: row.id, revision: row.revision };
        if (publish) {
            record = (await request('publish-academic', { id: row.id, revision: record.revision })).record;
            if (!record || record.stage !== 'published')
                throw Error('반영 결과를 확인해야 합니다.');
        }
        const result = { id: row.id, phase: publish ? 'published' : 'saved', revision: record.revision, error: '' };
        changed(row.id, result);
        results.push(result);
    }
    catch (error) {
        const result = { id: row.id, phase: publish && stored ? 'failed-publish' : 'failed-save', error: error instanceof Error ? error.message : '처리 결과를 확인해야 합니다.' };
        changed(row.id, result);
        results.push(result);
    }
} return results; }
/** Small chunks bound server duration and avoid per-student authentication requests. */
export async function applyAcademicBatchChunks(request: (action: string, body: any) => Promise<any>, rows: any[], reflect: boolean, changed: (id: string, value: any) => void) { const results = []; for (let offset = 0; offset < rows.length; offset += 20) {
    const chunk = rows.slice(offset, offset + 20);
    for (const row of chunk)
        changed(row.id, { phase: reflect ? 'publishing' : 'saving', payload: row.payload, error: '' });
    try {
        const result = await request('academic-batch', { reflect, rows: chunk.map(row => ({ id: row.id, revision: row.revision, saveFirst: ['new', 'failed-save'].includes(row.phase), data: row.payload })) });
        if (!Array.isArray(result.rows) || result.rows.length !== chunk.length)
            throw Error('처리 결과를 확인해야 합니다.');
        for (const row of chunk) {
            const value = result.rows.find((r: any) => r.id === row.id);
            if (!value)
                throw Error('처리 결과를 확인해야 합니다.');
            const update = { id: row.id, phase: value.phase, revision: value.record?.revision ?? value.revision ?? row.revision, error: value.ok ? '' : value.message || '결과를 확인해 주세요.' };
            changed(row.id, update);
            results.push(update);
        }
    }
    catch (error) {
        for (const row of chunk) {
            let update: any = { id: row.id, phase: row.revision ? 'failed-publish' : 'failed-save', error: error instanceof Error ? error.message : '결과를 확인해 주세요.' };
            try {
                const stored = (await request('read:managed-record', { kind: 'academic', id: row.id })).record;
                if (stored && !stored.archived && !stored.deleteRequested && sameAcademicPayload(stored.data, row.payload))
                    update = { id: row.id, phase: reflect ? (stored.stage === 'published' ? 'published' : 'failed-publish') : 'saved', revision: stored.revision, error: reflect && stored.stage !== 'published' ? '저장됨 · 반영 결과 확인 필요' : '' };
            }
            catch { }
            changed(row.id, update);
            results.push(update);
        }
    }
} return results; }
