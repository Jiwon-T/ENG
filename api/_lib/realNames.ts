// Names other students see (별칭, 원정대 이름, pet names, 순위 닉네임) never hold a student's real name unless that student
// said yes to it when setting the name (asked with a popup); the rankings fall back to the next name, or the family name.
import {normalizeNotionPageId as uuid} from './notionPageId.js';
import {displayName} from './petCoupon.js';
import {norm} from './petParty.js';
import {keepsNameHidden} from '../../src/lib/rankNames.js';

/** The real name of the student linked to `uid` ('' for anyone else: a teacher, or no student record). */
export async function studentRealName(db: any, uid: string) {
  const user = (await db.collection('users').doc(uid).get()).data();
  if (user?.role !== 'student' || typeof user.notionStudentKey !== 'string') return '';
  try { return await displayName(db, uuid(user.notionStudentKey)); } catch { return ''; }
}
/** `x` as it may be shown ('' when it holds the real name and was not agreed to; `agreed`: normalized names said yes to). */
export const shownName = (x: unknown, real: string, agreed: string[] = []) => { const v = String(x ?? '').trim(); return v && (keepsNameHidden(v, real) || agreed.includes(norm(v))) ? v : ''; };
