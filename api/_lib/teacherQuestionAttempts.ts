// 선생님 학습 리포트 › 변형 문제: one student's question attempts (own sets and sets a teacher gave), newest first, with
// the 풀이 기록 시간 (visits by server time) and each question's answer once graded. Same reach as the online learning
// view: English scope for the student, their linked app account (checked again after reading), read only.
import { readStudentMapping } from './studentIdentity.js';
import { reviewSubjects } from './teacherReportReview.js';
import { linkedStudentAccount } from './teacherOnlineLearning.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { QUESTION_ATTEMPTS } from './questionAttempts.js';
import { CIRCLED, typeLabel } from '../../src/lib/questionMaker.js';

const LETTERS = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ', 'ⓕ', 'ⓖ', 'ⓗ', 'ⓘ', 'ⓙ', 'ⓚ', 'ⓛ'];
const answerText = (v: any) => typeof v === 'number' ? CIRCLED[v - 1] || '?' : Array.isArray(v) ? v.join(' · ') : '';

/** One attempt as the teacher sees it. */
function teacherRow(x: any) {
  const total = x.results?.length ?? null, sessions = (x.sessions || []).map((s: any) => ({ start: s.start, end: s.end }));
  const ms = sessions.reduce((sum: number, s: any) => sum + Math.max(0, s.end - s.start), 0) + Number(x.folded?.ms || 0);
  return { id: x.id, kind: x.kind, title: x.title || '변형 문제', status: x.status, dueAt: x.dueAt ?? null, createdAt: x.createdAt, submittedAt: x.submittedAt || null,
    score: x.score || null, reward: x.reward ? { points: x.reward.points, late: Boolean(x.reward.late), capped: Boolean(x.reward.capped) } : null,
    answered: Object.keys(x.answers || {}).length, total,
    visits: { sessions, folded: Number(x.folded?.count || 0), minutes: Math.round(ms / 60000) },
    results: (x.results || []).map((r: any, k: number) => ({ n: k + 1, label: typeLabel(r.type), ok: r.ok,
      given: r.pairs ? r.pairs.map((p: any, i: number) => (p.ok ? null : `${LETTERS[i]} ${p.given || '-'} → ${p.right}`)).filter(Boolean).join(', ') : answerText(r.given),
      right: r.pairs ? '' : answerText(r.right) })) };
}

export async function loadStudentQuestionAttempts(db: any, actor: any, keyInput: unknown) {
  let key: string; try { key = uuid(String(keyInput || '')); } catch { throw Error('INVALID_INPUT'); }
  const subjects = reviewSubjects(actor, key);
  if (subjects && !subjects.has('영어')) return { attempts: [], reason: 'subject-not-available' };
  const link = await linkedStudentAccount(db, key, { readStudentMapping });
  if ('reason' in link) return { attempts: [], reason: link.reason };
  // Newest 20 from the query itself (index: uid + updatedAt desc); until that index is built, up to 300 of the student's
  // attempts are read and sorted here (a stopgap: the log line says when it is still used).
  const mine = db.collection(QUESTION_ATTEMPTS).where('uid', '==', link.uid);
  const snap = await mine.orderBy('updatedAt', 'desc').limit(20).get().catch((error: any) => {
    if (error?.code !== 9 && !/FAILED_PRECONDITION|index/i.test(String(error?.message || ''))) throw error;
    console.warn('QUESTION_ATTEMPTS_INDEX_MISSING'); return mine.limit(300).get();
  });
  // the link checked again after reading (an account unlinked meanwhile shows nothing)
  const again = await readStudentMapping(db, key);
  if (again?.firebaseUid !== link.uid || again?.internalStudentId !== link.mapping.internalStudentId) return { attempts: [], reason: 'account-link-mismatch' };
  const rows = snap.docs.map((d: any) => d.data()).filter((x: any) => x.uid === link.uid).sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 20);
  return { attempts: rows.map(teacherRow) };
}
