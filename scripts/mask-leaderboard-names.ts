/**
 * 단어 매칭 TOP 10(matchLeaderboard)에 예전 코드가 저장한 실명을 가린 이름(김*원)으로 바꾸는 스크립트.
 *
 * 안전 규칙:
 * - 기본은 읽기만 합니다(건수만 출력). --apply를 붙였을 때만 name 칸 하나를 바꿉니다.
 * - 이름이나 문서 내용은 출력하지 않습니다. 건수만 출력합니다.
 * - 문서를 지우거나 합치지 않습니다. 이미 가린 이름('익명' 포함)은 건드리지 않습니다.
 *
 * 실행: tsx scripts/mask-leaderboard-names.ts            (건수 확인)
 *       tsx scripts/mask-leaderboard-names.ts --apply    (바꾸기, 사용자 승인 후)
 */
import { getFirebaseAdmin } from '../api/_lib/firebaseAdmin.ts';
import { maskName, isMaskedName } from '../src/lib/maskName.ts';

export function planLeaderboardMasking(docs: { id: string; name: unknown }[]) {
  const changes = docs.filter(d => !isMaskedName(d.name)).map(d => ({ id: d.id, name: maskName(d.name) }));
  return { total: docs.length, alreadyMasked: docs.length - changes.length, changes };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { db } = getFirebaseAdmin();
  const snap = await db.collection('matchLeaderboard').get();
  const plan = planLeaderboardMasking(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', total: plan.total, alreadyMasked: plan.alreadyMasked, toMask: plan.changes.length }));
  if (!apply) return;
  let written = 0;
  for (let i = 0; i < plan.changes.length; i += 400) {
    const batch = db.batch();
    for (const c of plan.changes.slice(i, i + 400)) batch.update(db.collection('matchLeaderboard').doc(c.id), { name: c.name });
    await batch.commit(); written += Math.min(400, plan.changes.length - i);
  }
  console.log(JSON.stringify({ written }));
}
if (process.argv[1] && /mask-leaderboard-names/.test(process.argv[1])) main().catch(e => { console.error('MASK_LEADERBOARD_FAILED', { code: String(e?.code || 'unknown') }); process.exit(1); });
