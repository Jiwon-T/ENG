import { recordNotionCall } from './notionUsage.js';
import {detailMetadata} from '../../src/lib/academicExamPeriod.js';
import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { normalizeNotionPageId } from './notionPageId.js';
import { lookupStudentByPageId } from './notion.js';
import { migrateStudentMapping } from './studentIdentity.js';
import {coreActive,coreStudentIdentity} from './academyCore.js';

export const GRADE_DATABASE = 'fa6ce5a8-9572-4f4d-80d9-4d1485d44e6f';
import {ENROLLMENT_DATABASE} from './notionAcademicSources.js';
export {ENROLLMENT_DATABASE};
export const SUBJECTS = ['영어', '수학', '국어', '과학', '한국사'];
const text = (p: any) => (p?.title || p?.rich_text || []).map((x: any) => x.plain_text ?? x.text?.content ?? '').join('');
const choice = (p: any) => p?.select?.name || p?.status?.name || '';
const number = (p: any) => typeof p?.number === 'number' && Number.isFinite(p.number) ? p.number : null;
const date = (p: any) => p?.date?.start || null;
export const publicId = (id: string) => crypto.createHash('sha256').update(id).digest('hex').slice(0, 24);

export async function notionRequest(path: string, body?: unknown) {
  const token = process.env.NOTION_INTEGRATION_TOKEN;
  if (!token) throw new Error('SERVER_CONFIG_ERROR');
  recordNotionCall(path);
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
    examDetail:choice(props['세부 종류']),examYear:number(props['시험 연도']),semester:detailMetadata(choice(props['세부 종류'])).semester??(Number(choice(props['학기'])[0])||null),examPeriod:detailMetadata(choice(props['세부 종류'])).examPeriod||choice(props['고사 구분'])||null,sourceUpdatedAt, removed, subject, examType, title: text(props['시험명']), examDate: date(props['시험일']),
    deadline: date(props['제출 기한']), score, maxScore, percentile,
    grade: text(props['예상 등급']), submissionStatus: choice(props['제출 상태']),
  } };
}

async function resolveAcademicStudent(studentPageId: string) {
  const student = await lookupStudentByPageId(studentPageId, '', false);
  return student;
}
export async function syncAcademicPage(db: Firestore, page: any, resolveStudent = resolveAcademicStudent, mapStudent = migrateStudentMapping, app?:{draftId:string;revision:number;academyId:string}) {
  const parsed = parseAcademicPage(page);
  // After the verified switches the app is authoritative: Notion copies never overwrite app grades/enrollments.
  if(!app){
    if(parsed.collection==='academicRecords'){const {academicAppActive}=await import('./academicAuthority.js');if(await academicAppActive(db))return {applied:false,reason:'APP_AUTHORITY',kind:parsed.collection};}
    if(parsed.collection==='studentEnrollments'){const {coreActive}=await import('./academyCore.js');if(await coreActive(db,{academyId:'main'}).catch(()=>true))return {applied:false,reason:'APP_AUTHORITY',kind:parsed.collection};}
  }
  const marker=text(page.properties?.['앱 기록 ID']);const nativeDraft=marker&&/^[a-f0-9-]{36}$/i.test(marker)?(await db.collection('teacherAcademicDrafts').doc(marker).get()).data():null;
  if(parsed.collection==='academicRecords'&&(nativeDraft?.sourceMode==='firestore'||nativeDraft?.archived))return {applied:false,reason:'APP_OWNED',kind:parsed.collection};
  const ref = db.collection(parsed.collection).doc(parsed.id);
  if(parsed.collection==='studentEnrollments'&&(await ref.get()).data()?.appSource==='firestore')return {applied:false,reason:'APP_OWNED',kind:parsed.collection};
  if(parsed.collection==='academicRecords'&&!app){
    const saved=(await ref.get()).data();
    if(saved?.teacherDraftId)return {applied:false,reason:'APP_OWNED',kind:parsed.collection};
    const marker=text(page.properties?.['앱 기록 ID']);
    if(/^[0-9a-f-]{36}$/i.test(marker)){
      const managed=(await db.collection('teacherAcademicDrafts').doc(marker).get()).data();
      if(managed&&(normalizeNotionPageId(managed.notionPageId||managed.notionWrite?.pageId||'')===parsed.id||managed.notionWrite?.attempted&&managed.notionWrite?.database===GRADE_DATABASE))return {applied:false,reason:'APP_OWNED',kind:parsed.collection};
    }
  }
  let internalStudentId: string | null = null;
  if (!parsed.data.removed) {
    const student = await coreActive(db,{academyId:'main'})?await coreStudentIdentity(db,parsed.studentPageId!,false):await resolveStudent(parsed.studentPageId!);
    internalStudentId = (await mapStudent(db, student.notionStudentPageId, student.studentDisplayName)).internalStudentId;
  }
  return db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    if(marker&&/^[a-f0-9-]{36}$/i.test(marker)){const guarded=(await tx.get(db.collection('teacherAcademicDrafts').doc(marker))).data();if(guarded?.sourceMode==='firestore'||guarded?.archived)return {applied:false,reason:'APP_OWNED',kind:parsed.collection};}
    const draftRef=app?db.collection('teacherAcademicDrafts').doc(app.draftId):null;
    const draft=app?(await tx.get(draftRef!)).data():null;
    const membership=app&&parsed.studentPageId?(await tx.get(db.collection('academyStudentMemberships').doc(parsed.studentPageId))).data():null;
    if(parsed.collection==='academicRecords'&&!app&&previous.data()?.teacherDraftId)return {applied:false,reason:'APP_OWNED',kind:parsed.collection};
    if(app){
      if(draft?.sourceMode==='firestore')throw Error('SOURCE_IDENTITY_LOCKED');
      if(!draft||draft.archived||draft.deleteRequested||draft.revision!==app.revision)throw Error('DRAFT_CONFLICT');
      if(!membership||membership.disabled||membership.academyId!==app.academyId)throw Error('ACADEMY_MEMBERSHIP_CONFLICT');
      if(previous.data()?.teacherDraftId&&previous.data()?.teacherDraftId!==app.draftId)throw Error('SOURCE_IDENTITY_LOCKED');
      if(previous.data()?.teacherAppRevision>app.revision)throw Error('DRAFT_CONFLICT');
      if(normalizeNotionPageId(draft.data.studentKey)!==parsed.studentPageId)throw Error('SOURCE_IDENTITY_LOCKED');
    }
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
      serverReceivedAt: previous.data()?.serverReceivedAt || new Date().toISOString(), serverUpdatedAt: new Date().toISOString(),...(app?{teacherDraftId:app.draftId,teacherAppRevision:app.revision}: {}) });
    if(app)tx.update(draftRef!,{academicProjectionDoneRevision:app.revision});
    return { applied: true, kind: parsed.collection };
  });
}

export function academicDTO(id: string, r: any) {
  return { examDetail:r.examDetail||'',examYear:r.examYear??null,semester:r.semester??null,examPeriod:r.examPeriod??null,recordId: publicId(id), title: r.title, subject: r.subject, examType: r.examType, examDate: r.examDate,
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
