// 수업 보상 on 반영: when a 일지 is published (or deleted), everything waiting for that student is settled in the same
// transaction — this lesson to what its 일지 says now (the last 반영 counts, see settleLessonReward), earlier lessons not yet
// paid (놓친 수업 보상), and lessons gone. The student needs neither the app nor a pet: a linked student without one gets
// the pet account made here, with the points in it (the first pet is still chosen in the app). Only a student whose app
// account is not linked waits (nothing to pay into).
import { applyCouponExtras, claimStudyRewards, initialPetState, noteInbox, pendingStudyRewards, PET_STATES, petSummary, rollDay, settleLessons, type ServerPetState } from './pet.js';
import { studyReports } from './lessonRewardRows.js';

/** Reads (the pet and account in the transaction, the student's lessons beside it), before any write. `report`: the 일지
 *  as it is being published, or the one being deleted (`deleted`). */
export async function readLessonReward(tx: any, db: any, mapping: any, report: any, deleted = false) {
  const uid = mapping?.firebaseUid;
  if (!uid || !report || !(report.reportIdentity || report.notionPageId)) return null;
  const [pet, user] = await Promise.all([tx.get(db.collection(PET_STATES).doc(uid)), tx.get(db.collection('users').doc(uid))]);
  const u = user.data();
  if (!u || u.role !== 'student' || u.disabled || !u.notionStudentKey) return null;
  const rows = await studyReports(db, uid, u, { report, deleted });
  if (!rows.length) return null;
  return { uid, state: pet.exists ? pet.data() as ServerPetState : null, user: u, rows };
}

const settled = (s: ServerPetState) => JSON.stringify([s.points, s.rewarded, s.lessonPaid || {}, s.couponExtra || {}]);
/** Writes: settle everything for the student. Returns the points change, or null when nothing changed (no account made). */
export function writeLessonReward(tx: any, db: any, read: Awaited<ReturnType<typeof readLessonReward>>, now: number) {
  if (!read) return null;
  const s = rollDay(read.state ?? initialPetState(now, read.user.petStats), now), before = settled(s), ledger = structuredClone(s.ledger || []);
  const change = claimStudyRewards(s, pendingStudyRewards(s, read.rows, now)).points + settleLessons(s, read.rows, now);
  applyCouponExtras(s, read.rows, now);
  if (settled(s) === before) return null;
  noteInbox(s, ledger); // shown once when the student next opens the app
  s.updatedAt = now;
  tx.set(db.collection(PET_STATES).doc(read.uid), s);
  tx.set(db.collection('users').doc(read.uid), { petStats: petSummary(s) }, { merge: true });
  return change;
}
