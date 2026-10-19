// 선생님 학습 리포트 › 변형 문제: one student's question attempts (own sets and sets a teacher gave), newest first, with
// the 풀이 기록 시간 (visits by server time) and each question's answer once graded. Same reach as the online learning
// view: English scope for the student, their linked app account (checked again after reading), read only.
import { readStudentMapping } from './studentIdentity.js';
import { reviewSubjects } from './teacherReportReview.js';
import { linkedStudentAccount } from './teacherOnlineLearning.js';
import { normalizeNotionPageId as uuid } from './notionPageId.js';
import { QUESTION_ATTEMPTS, questionReward } from './questionAttempts.js';
import { PET_STATES, awardCapped, petSummary, rollDay, type ServerPetState } from './pet.js';
import { CIRCLED, WRITTEN_TYPES, typeLabel } from '../../src/lib/questionMaker.js';

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
    results: (x.results || []).map((r: any, k: number) => ({ n: k + 1, index: r.index, label: typeLabel(r.type), ok: r.ok,
      // 서술형: the teacher may change the verdict (judgeQuestionAttempt); `judged`: it is the teacher's now
      ...(WRITTEN_TYPES.includes(r.type) && x.status === 'submitted' ? { written: true, judged: r.check?.by === 'teacher' } : {}),
      given: r.pairs ? r.pairs.map((p: any, i: number) => (p.ok ? null : `${p.label || LETTERS[i]} ${p.given || '-'} → ${p.right}`)).filter(Boolean).join(', ') : answerText(r.given),
      // 서술형 영작: how it was checked (the AI's reason, shown as 자동 확인, or that it could not be checked)
      ...(r.check && r.check.by !== 'same' ? { check: r.check.by === 'ai' ? `자동 확인: ${r.check.reason}` : r.check.reason } : {}),
      ...(WRITTEN_TYPES.includes(r.type) && x.status === 'submitted' ? { answer: Array.isArray(r.given) ? r.given.join(', ') : '' } : {}),
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

/** The student's attempts are this teacher's to see (English, the linked account): the same reach as reading them. */
async function reachableUid(db: any, actor: any, keyInput: unknown) {
  let key: string; try { key = uuid(String(keyInput || '')); } catch { throw Error('INVALID_INPUT'); }
  const subjects = reviewSubjects(actor, key);
  if (subjects && !subjects.has('영어')) throw Error('FORBIDDEN');
  const link = await linkedStudentAccount(db, key, { readStudentMapping });
  if ('reason' in link) throw Error('FORBIDDEN');
  return link.uid as string;
}
/**
 * 판정 바꾸기 (서술형 only, after 채점): the teacher marks an answer right or wrong; the score follows. For a set a teacher
 * gave, a higher score pays the difference in points now (inside today's study cap); a lower one takes nothing back
 * (the points stay). Points are never paid twice for the same question (`peakWanted`: the most ever owed).
 */
export async function judgeQuestionAttempt(db: any, actor: any, input: any, now = Date.now()) {
  const uid = await reachableUid(db, actor, input?.studentKey), index = Number(input?.index), ok = input?.ok;
  if (!Number.isInteger(index) || typeof ok !== 'boolean') throw Error('INVALID_INPUT');
  const ref = db.collection(QUESTION_ATTEMPTS).doc(String(input?.attemptId || '').slice(0, 64));
  const petRef = db.collection(PET_STATES).doc(uid), userRef = db.collection('users').doc(uid);
  const next = await db.runTransaction(async (tx: any) => {
    const [snap, petSnap, userSnap] = await Promise.all([tx.get(ref), tx.get(petRef), tx.get(userRef)]);
    const x = snap.data();
    if (!x || x.uid !== uid || x.status !== 'submitted') throw Error('FORBIDDEN');
    const at = (x.results || []).findIndex((r: any) => r.index === index), r = x.results?.[at];
    if (!r || !WRITTEN_TYPES.includes(r.type)) throw Error('INVALID_INPUT');
    if (r.ok === ok && r.check?.by === 'teacher') return x; // already so
    const results = x.results.map((y: any, k: number) => k !== at ? y : { ...y, ok, check: { by: 'teacher', reason: ok ? '선생님이 맞음으로 확인했어요.' : '선생님이 틀림으로 확인했어요.', at: now, before: y.check?.by === 'teacher' ? y.check.before : y.check || null } });
    const score = { correct: results.filter((y: any) => y.ok).length, total: results.length };
    let reward = x.reward || null;
    if (reward && !reward.noPet) {
      const owed = questionReward(score.correct, score.total, Boolean(reward.late)), peak = Number(reward.peakWanted ?? reward.wanted) || 0;
      const extra = Math.max(0, owed.points - peak);
      if (extra > 0 && petSnap.exists) {
        // XP in the same share as the points owed
        const pet: ServerPetState = rollDay(petSnap.data(), now), paid = awardCapped(pet, extra, owed.points > 0 ? Math.round(extra * owed.xp / owed.points) : 0);
        pet.updatedAt = now; tx.set(petRef, pet);
        if (userSnap.exists) tx.set(userRef, { petStats: petSummary(pet) }, { merge: true });
        reward = { ...reward, points: (reward.points || 0) + paid.points, xp: (reward.xp || 0) + paid.xp, capped: Boolean(reward.capped || paid.capped) };
      }
      reward = { ...reward, wanted: owed.points, peakWanted: Math.max(peak, owed.points) };
    }
    const out = { ...x, results, score, reward, judgedAt: now, updatedAt: now };
    tx.set(ref, out);
    return out;
  });
  return { attempt: teacherRow(next) };
}
