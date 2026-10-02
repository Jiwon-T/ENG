import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { normalizeNotionPageId } from './notionPageId.js';
import { lookupStudentByPageId } from './notion.js';
import { migrateStudentMapping } from './studentIdentity.js';

export const GRADE_DATABASE = 'fa6ce5a8-9572-4f4d-80d9-4d1485d44e6f';
export const ENROLLMENT_DATABASE = '3ec0d0f1-c79a-80b2-bb52-ea162888fe9a';
export const SUBJECTS = ['영어', '수학', '국어', '과학', '한국사'];
const text = (p: any) => (p?.title || p?.rich_text || []).map((x: any) => x.plain_text ?? x.text?.content ?? '').join('');
const choice = (p: any) => p?.select?.name || p?.status?.name || '';
const number = (p: any) => typeof p?.number === 'number' && Number.isFinite(p.number) ? p.number : null;
const date = (p: any) => p?.date?.start || null;
export const publicId = (id: string) => crypto.createHash('sha256').update(id).digest('hex').slice(0, 24);

export async function notionRequest(path: string, body?: unknown) {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  if (!token) throw new Error('SERVER_CONFIG_ERROR');
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`NOTION_UPSTREAM_${response.status}`);
  return response.json();
}

export function parseAcademicPage(page: any) {
  const parent = normalizeNotionPageId(page.parent?.database_id || '');
  if (![GRADE_DATABASE, ENROLLMENT_DATABASE].includes(parent)) throw new Error('SOURCE_NOT_ALLOWED');
  const id = normalizeNotionPageId(page.id);
  const removed = Boolean(page.archived || page.in_trash);
  const props = page.properties || {};
  const relations = props['학생']?.relation || [];
  if (!removed && (relations.length !== 1 || props['학생']?.has_more)) throw new Error('EXACTLY_ONE_STUDENT_REQUIRED');
  const studentPageId = relations.length === 1 ? normalizeNotionPageId(relations[0].id) : null;
  const sourceUpdatedAt = page.last_edited_time;
  if (typeof sourceUpdatedAt !== 'string' || !Number.isFinite(Date.parse(sourceUpdatedAt))) throw new Error('INVALID_SOURCE_TIME');
  if (parent === ENROLLMENT_DATABASE) {
    const subjects = SUBJECTS.filter(s => Boolean(choice(props[s]))).map(subject => ({
      subject, status: choice(props[subject]), startAt: date(props[`${subject} 시작일`]), endAt: date(props[`${subject} 중단일`]),
    }));
    return { id, studentPageId, collection: 'studentEnrollments', data: { sourceUpdatedAt, removed, subjects } };
  }
  const subject = choice(props['과목']);
  const sourceExamType = choice(props['시험 종류']);
  const examType = sourceExamType === '학력평가' ? '모의고사' : sourceExamType;
  if (!removed && (!SUBJECTS.includes(subject) || !['학교 내신', '모의고사'].includes(examType))) throw new Error('INVALID_EXAM_SUBJECT_OR_TYPE');
  const score = number(props['원점수']), maxScore = number(props['만점']);
  if (score !== null && score < 0 || maxScore !== null && maxScore <= 0 || score !== null && maxScore !== null && score > maxScore) throw new Error('INVALID_SCORE');
  // A formula named 백분위 is a score ratio, not an official mock-exam percentile.
  const percentile = props['백분위']?.type === 'number' ? number(props['백분위']) : null;
  if (percentile !== null && (percentile < 0 || percentile > 100)) throw new Error('INVALID_PERCENTILE');
  return { id, studentPageId, collection: 'academicRecords', data: {
    sourceUpdatedAt, removed, subject, examType, title: text(props['시험명']), examDate: date(props['시험일']),
    deadline: date(props['제출 기한']), score, maxScore, percentile,
    grade: text(props['예상 등급']), submissionStatus: choice(props['제출 상태']),
  } };
}

async function resolveAcademicStudent(studentPageId: string) {
  const student = await lookupStudentByPageId(studentPageId, '', false);
  return student;
}
export async function syncAcademicPage(db: Firestore, page: any, resolveStudent = resolveAcademicStudent, mapStudent = migrateStudentMapping) {
  const parsed = parseAcademicPage(page);
  const ref = db.collection(parsed.collection).doc(parsed.id);
  let internalStudentId: string | null = null;
  if (!parsed.data.removed) {
    const student = await resolveStudent(parsed.studentPageId!);
    internalStudentId = (await mapStudent(db, student.notionStudentPageId, student.studentDisplayName)).internalStudentId;
  }
  return db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    const legacyRef = parsed.collection === 'academicRecords' ? db.collection('examResults').doc(parsed.id) : null;
    const legacyGrade = legacyRef ? await tx.get(legacyRef) : null;
    const legacyOwners = parsed.collection === 'studentEnrollments'
      ? await tx.get(db.collection('studentAcademicProfiles').where('sourceId', '==', parsed.id)) : null;
    const currentOwners = parsed.collection === 'studentEnrollments' && internalStudentId
      ? await tx.get(db.collection('studentEnrollments').where('internalStudentId', '==', internalStudentId)) : null;
    const legacyProfile = parsed.collection === 'studentEnrollments' && internalStudentId
      ? await tx.get(db.collection('studentAcademicProfiles').doc(internalStudentId)) : null;
    if (currentOwners?.docs.some(d => d.id !== parsed.id && !d.data().removed)
      || legacyProfile?.exists && !legacyProfile.data()?.archived && legacyProfile.data()?.sourceId !== parsed.id) throw new Error('DUPLICATE_ENROLLMENT');
    if ((legacyGrade?.data()?.sourceUpdatedAt || '') > parsed.data.sourceUpdatedAt
      || legacyOwners?.docs.some(d => (d.data().sourceUpdatedAt || '') > parsed.data.sourceUpdatedAt)) return { applied: false, reason: 'OLDER_SOURCE', kind: parsed.collection };
    if (previous.exists && previous.data()!.sourceUpdatedAt > parsed.data.sourceUpdatedAt) return { applied: false, reason: 'OLDER_SOURCE', kind: parsed.collection };
    if (parsed.data.removed && !previous.exists && !legacyGrade?.exists && !legacyOwners?.docs.length) return { applied: false, reason: 'ALREADY_ABSENT', kind: parsed.collection };
    if (legacyGrade?.exists) tx.update(legacyRef!, { archived: true, sourceUpdatedAt: parsed.data.sourceUpdatedAt });
    for (const owner of legacyOwners?.docs || []) tx.update(owner.ref, { archived: true, activeSubjects: [], sourceUpdatedAt: parsed.data.sourceUpdatedAt });
    tx.set(ref, { ...parsed.data, internalStudentId: internalStudentId || previous.data()?.internalStudentId || legacyGrade?.data()?.internalStudentId || legacyOwners?.docs[0]?.data()?.internalStudentId,
      serverReceivedAt: previous.data()?.serverReceivedAt || new Date().toISOString(), serverUpdatedAt: new Date().toISOString() });
    return { applied: true, kind: parsed.collection };
  });
}

export function academicDTO(id: string, r: any) {
  return { recordId: publicId(id), title: r.title, subject: r.subject, examType: r.examType, examDate: r.examDate,
    score: r.score, maxScore: r.maxScore, percentile: r.percentile, grade: r.grade, submissionStatus: r.submissionStatus };
}
export async function loadSubjectEnrollments(db: Firestore, studentId: string) {
  const current = await db.collection('studentEnrollments').where('internalStudentId', '==', studentId).get();
  if (current.docs.length) return current.docs.filter(d => !d.data().removed).flatMap(d => d.data().subjects || []);
  const legacy = await db.collection('studentAcademicProfiles').doc(studentId).get();
  if (!legacy.exists || legacy.data()?.archived) return [];
  return Object.entries(legacy.data()?.subjects || {}).map(([subject, value]: [string, any]) => ({
    subject, status: value.status, startAt: value.startDate || null, endAt: value.endDate || null,
  }));
}
export async function loadAcademicData(db: Firestore, studentId: string) {
  const [grades, legacyGrades, subjects, lessons] = await Promise.all([
    db.collection('academicRecords').where('internalStudentId', '==', studentId).get(),
    db.collection('examResults').where('internalStudentId', '==', studentId).get(),
    loadSubjectEnrollments(db, studentId),
    db.collection('lessonReports').where('internalStudentId', '==', studentId)
      .select('notionPageId', 'subject', 'lessonDateStart', 'vocabularyScore', 'schoolExamScore').get(),
  ]);
  // The first interrupted ZIP used examResults/studentAcademicProfiles. Preserve any
  // data imported from that version; a current source row overrides its legacy copy.
  const currentSources = new Set(grades.docs.map(d => d.id));
  const legacyRecords = legacyGrades.docs.filter(d => !d.data().archived && !currentSources.has(d.data().sourceId || d.id)).map(d => {
    const r = d.data();
    return academicDTO(r.sourceId || d.id, { ...r, examType: r.kind, submissionStatus: r.status });
  });
  const records = [...legacyRecords, ...grades.docs.filter(d => !d.data().removed).map(d => academicDTO(d.id, d.data()))];
  const academyScores = lessons.docs.map(d => { const r = d.data(); return { recordId: publicId(d.id), subject: r.subject || '영어',
    examDate: r.lessonDateStart, vocabularyScore: r.vocabularyScore ?? null, schoolExamScore: r.schoolExamScore ?? null }; });
  return { records, subjects, academyScores };
}
