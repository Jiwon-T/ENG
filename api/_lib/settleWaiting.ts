// 대기 포인트 모두 넣기 (관리자 설정 › 쿠폰): every linked student's lesson points still waiting — the 수업 일지 give them,
// their pet account doesn't hold them yet (lessons 반영 before rewards were paid on 반영, and no app opened since) — paid
// now, the same way 반영 pays them (writeLessonReward: 놓친 수업 보상 + lessons from LESSON_REWARD_FROM). A student without a
// pet gets the pet account made with the points in it; the student sees them in the popup inbox next time. Admin only; a
// look first (`dryRun`: how many students and points), nothing paid twice (each run counts again from what is held).
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {PET_STATES} from './pet.js';
import {owedPoints} from './petCoupon.js';
import {writeLessonReward} from './lessonRewardOnPublish.js';

function admin(actor: any) { if (!actor?.admin || actor.academyId !== 'main') throw Error('FORBIDDEN'); }
/** Each active linked student with points waiting: uid, the 수업 rows and how many points; `failed`: students whose count
 *  could not be read (told to the admin, never left out silently). */
async function waitingStudents(db: any, now: number) {
  const members = (await db.collection('academyStudentMemberships').where('academyId', '==', 'main').get()).docs.filter((d: any) => !d.data().disabled);
  const out: {uid: string; user: any; rows: any[]; waiting: number}[] = [];
  let failed = 0;
  for (const m of members) {
    let key: string; try { key = uuid(m.id); } catch { continue; }
    let o: Awaited<ReturnType<typeof owedPoints>>;
    try { o = await owedPoints(db, key, now, true); } catch { failed += 1; console.warn('SETTLE_WAITING_READ_FAILED'); continue; }
    if (!o?.linked || !o.uid || !o.rows.length) continue;
    const waiting = Math.max(0, Number(o.all.points || 0) - o.held);
    if (waiting > 0) out.push({uid: o.uid, user: o.user, rows: o.rows, waiting});
  }
  return {list: out, failed};
}
/** How many students and points would be paid now (and how many could not be read). */
export async function readWaitingPoints(db: any, actor: any, now = Date.now()) {
  admin(actor);
  const {list, failed} = await waitingStudents(db, now);
  return {students: list.length, points: list.reduce((a, s) => a + s.waiting, 0), failed};
}
/** Pay them, one student per transaction (the pet read again inside it, so a lesson paid meanwhile is not paid twice). */
export async function settleWaitingPoints(db: any, actor: any, now = Date.now()) {
  admin(actor);
  const found = await waitingStudents(db, now);
  let students = 0, points = 0, failed = found.failed;
  for (const s of found.list) {
    try {
      const change = await db.runTransaction(async (tx: any) => {
        const pet = await tx.get(db.collection(PET_STATES).doc(s.uid));
        return writeLessonReward(tx, db, {uid: s.uid, state: pet.exists ? pet.data() : null, user: s.user, rows: s.rows}, now);
      });
      if (change) { students += 1; points += change; }
    } catch { failed += 1; console.warn('SETTLE_WAITING_FAILED'); }
  }
  return {students, points, failed};
}
