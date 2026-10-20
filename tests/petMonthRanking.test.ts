import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationFirestore} from './helpers/registrationFirestore.js';
import {initialPetState} from '../api/_lib/pet.js';
import {initialGuild} from '../api/_lib/petParty.js';
import {buildMonthRanking, maskedName, monthRankRows, readMonthRanking, type MonthRankSnapshot} from '../api/_lib/petMonthRanking.js';

const OCT22 = Date.parse('2026-10-22T05:00:00Z');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = '33333333-3333-4333-8333-333333333333', D = '44444444-4444-4444-8444-444444444444';

test('이달 포인트 순위 names: the family name only, whatever follows the name', () => {
  assert.deepEqual([maskedName('류지수'), maskedName('김하늘 (평촌고2)'), maskedName('이솔'), maskedName('남궁민수'), maskedName('Jiwon Kim'), maskedName(''), maskedName('학생')], ['류**', '김**', '이*', '남***', 'J***', '학생', '학생']);
});

async function academy() {
  const {hashStudentKey} = await import('../api/_lib/security.js');
  const f = registrationFirestore();
  const student = (key: string, internal: string, name: string, extra: any = {}) => {
    f.rows.set(`academyStudentMemberships/${key}`, {academyId: 'main', ...(extra.disabled ? {disabled: true} : {})});
    f.rows.set(`notionStudentMappings/${hashStudentKey(key)}`, {studentKey: key, notionStudentPageId: key, internalStudentId: internal, studentDisplayName: name, sourceMode: 'firestore', ...(extra.uid ? {firebaseUid: extra.uid} : {})});
  };
  // A: no app account; B: linked with a pet called 몽실이 (별칭 반짝이); C: no app account, a 순위 닉네임; D: not active
  student(A, 'int-a', '류지수'); student(B, 'int-b', '박하늘', {uid: 'b'}); student(C, 'int-c', '김구름'); student(D, 'int-d', '최별', {disabled: true});
  f.rows.set('users/b', {role: 'student', notionStudentKey: B});
  const pet = initialPetState(OCT22); pet.pets[0].chosen = true; pet.pets[0].name = '몽실이'; pet.earned = {month: '2026-10', points: 50}; f.rows.set('petStates/b', pet);
  f.rows.set('petGuild/b', {...initialGuild(OCT22), guildName: '별빛 원정대', aliases: {[pet.pets[0].slot]: '반짝이'}});
  f.rows.set(`petRankNames/${C}`, {nickname: '영어왕', by: 'teacher', at: OCT22});
  const lesson = (who: string, id: string, extra: any = {}) => f.rows.set(`lessonReports/${id}`, {internalStudentId: who, reportIdentity: id, lessonDateStart: '2026-10-21T14:00:00+09:00', attendance: '출석', attitude: '', homework: '', test: '', ...extra});
  lesson('int-a', 'a1', {homework: '최상', attitude: '상'}); lesson('int-b', 'b1'); lesson('int-c', 'c1'); lesson('int-d', 'd1', {homework: '최상'});
  return f;
}

test('이달 포인트 순위: every active student, app or not, by this month\'s points; a pet\'s 별칭, a 닉네임 or the family name', async () => {
  const f = await academy();
  const snap = await buildMonthRanking(f.db, OCT22);
  const by = Object.fromEntries(snap.rows.map(r => [r.label, r]));
  assert.deepEqual(Object.keys(by).sort(), ['류**', '반짝이', '영어왕'], 'the inactive student is left out');
  assert.deepEqual([by['류**'].by, by['류**'].uid, by['류**'].earned, by['류**'].look], ['name', null, 30 + 40 + 15, null]);
  assert.deepEqual([by['반짝이'].by, by['반짝이'].guild, by['반짝이'].earned, by['반짝이'].look?.character], ['alias', '별빛 원정대', 50 + 30, pet(f).pets[0].character]);
  assert.deepEqual([by['영어왕'].by, by['영어왕'].earned], ['nick', 30]);
  assert.equal(f.rows.has('petStates/a'), false, 'nothing is saved for the students');
  const seen: any = await readMonthRanking(f.db, 'b', OCT22);
  assert.deepEqual(seen.rows.map((r: any) => [r.rank, r.label, r.earned, r.me]), [[1, '류**', 85, false], [2, '반짝이', 80, true], [3, '영어왕', 30, false]]);
  assert.deepEqual([seen.kind, seen.goal, seen.month, seen.mine], ['month', 10_000, '2026-10', {rank: 2, earned: 80}]);
  const text = JSON.stringify(seen);
  for (const secret of ['류지수', '박하늘', '김구름', A, B, C, '"b"']) assert.equal(text.includes(secret), false, `no ${secret} in what the student gets`);
  assert.equal(f.rows.get('petRankings/month').month, '2026-10', 'kept as one snapshot');
});
const pet = (f: any) => f.rows.get('petStates/b');

test('이달 포인트 순위 rows: the top 10, equal points share a place, my place below when lower, no place without points', () => {
  const row = (i: number, earned: number, uid: string | null = `u${i}`) => ({uid, earned, label: `학생${i}`, by: 'name' as const, guild: '', look: null});
  const snap: MonthRankSnapshot = {builtAt: OCT22, month: '2026-10', rows: [...Array.from({length: 12}, (_, i) => row(i, 1000 - i * 50)), row(20, 1000), row(21, 0, 'zero'), row(22, 10, null)]};
  const out = monthRankRows(snap, 'u11');
  assert.deepEqual(out.rows.slice(0, 3).map(r => r.rank), [1, 1, 3], 'equal points share a place');
  assert.deepEqual([out.rows.length, out.total, out.mine], [10, 14, {rank: 13, earned: 450}]);
  assert.deepEqual(monthRankRows(snap, 'zero').mine, {rank: null, earned: 0}, 'listed but no points yet: no place');
  assert.equal(monthRankRows(snap, 'teacher').mine, null);
  assert.equal(monthRankRows(snap, '').rows.some(r => r.me), false, 'a student without an account is never "me"');
});

test('이달 포인트 순위: a 별칭, pet name, 원정대 이름 or 닉네임 holding the real name is not used', async () => {
  const {keepsNameHidden} = await import('../api/_lib/petMonthRanking.js');
  assert.deepEqual([keepsNameHidden('지수짱', '류지수'), keepsNameHidden('류 지수', '류지수 (평촌중2)'), keepsNameHidden('수지', '류지수'), keepsNameHidden('솔솔', '이솔'), keepsNameHidden('이솔이네', '이솔'), keepsNameHidden('', '류지수')], [false, false, true, true, false, false]);
  const f = await academy();
  const g = f.rows.get('petGuild/b'); g.aliases = {}; g.guildName = '하늘 원정대'; f.rows.set('petGuild/b', g);
  const s = pet(f); s.pets[0].name = '박하늘펫'; f.rows.set('petStates/b', s);
  f.rows.set(`petRankNames/${C}`, {nickname: '김구름짱', by: 'teacher', at: OCT22});
  const snap = await buildMonthRanking(f.db, OCT22);
  const b = snap.rows.find(r => r.uid === 'b')!, c = snap.rows.find(r => r.uid === null && r.earned === 30)!;
  assert.deepEqual([b.label, b.by, b.guild, c.label, c.by], ['박**', 'name', '', '김**', 'name']);
});

test('실명 이름: asked first (NAME_REAL); said yes, the name is kept for the rankings; a 닉네임 the teacher agreed to shows too', async () => {
  const {handlePet} = await import('../api/_lib/student/pet.js');
  const f = await academy();
  const deps: any = {db: () => f.db, generate: async () => '{}', now: () => OCT22, verify: async (t: string) => ({uid: t})};
  const call = async (body: any) => { let status = 0, out: any; const res: any = {setHeader() {}, end(v: string) { out = JSON.parse(v); }, set statusCode(v: number) { status = v; }, get statusCode() { return status; }};
    await handlePet({method: 'POST', headers: {authorization: 'Bearer b'}, body} as any, res, deps); return {status, out}; };
  const slot = pet(f).pets[0].slot;
  const asked = await call({action: 'guild-alias', slot, name: '하늘이'});
  assert.deepEqual([asked.status, asked.out.error], [409, 'NAME_REAL']);
  assert.equal(f.rows.get('petGuild/b').aliases[slot], '반짝이', 'nothing saved before the yes');
  const yes = await call({action: 'guild-alias', slot, name: '하늘이', realName: true});
  assert.equal(yes.out.guild?.names.pets[0].alias, '하늘이', JSON.stringify(yes.out).slice(0, 300));
  assert.deepEqual(f.rows.get('petGuild/b').realNameOk, ['하늘이']);
  assert.equal((await call({action: 'guild-name', name: '별빛 원정대'})).status, 200, 'a name without it is not asked');
  // a pet renamed (the real name's yes taken back): both ranking snapshots are made again, so the old name leaves them
  f.rows.set('petRankings/current', {builtAt: OCT22, pets: []}); f.rows.set('petRankings/month', {builtAt: OCT22, rows: []});
  assert.equal((await call({action: 'rename', name: '구름빵'})).status, 200);
  assert.deepEqual([f.rows.get('petRankings/current').builtAt, f.rows.get('petRankings/month').builtAt], [0, 0]);
  f.rows.set(`petRankNames/${C}`, {nickname: '구름이', by: 'teacher', at: OCT22, realNameOk: true});
  const snap = await buildMonthRanking(f.db, OCT22);
  assert.deepEqual([snap.rows.find(r => r.uid === 'b')!.label, snap.rows.find(r => r.by === 'nick')!.label], ['하늘이', '구름이']);
});

test('순위 닉네임 (선생님): the admin, the principal or the student\'s teacher; a real name asked first; empty removes it', async () => {
  const {listRankNames, setRankNickname} = await import('../api/_lib/petMonthRanking.js');
  const f = await academy();
  const admin = {admin: true, academyId: 'main', uid: 'adm'}, principal = {principal: true, academyId: 'main', uid: 'pr'}, teacher = {academyId: 'main', uid: 't1', scopes: [{studentKey: A}]};
  await assert.rejects(setRankNickname(f.db, teacher, {studentKey: C, nickname: '별님'}, OCT22), /FORBIDDEN/, 'not their student');
  await assert.rejects(setRankNickname(f.db, {academyId: 'main', uid: 't2', scopes: []}, {studentKey: A, nickname: '별님'}, OCT22), /FORBIDDEN/);
  await assert.rejects(setRankNickname(f.db, teacher, {studentKey: A, nickname: '010-0000-1234'}, OCT22), /RANK_NICK_BAD/);
  assert.deepEqual(await setRankNickname(f.db, teacher, {studentKey: A, nickname: '지수왕'}, OCT22), {needsConfirm: 'real-name', nickname: '지수왕'});
  assert.equal(f.rows.has(`petRankNames/${A}`), false, 'nothing saved before the yes');
  assert.deepEqual(await setRankNickname(f.db, teacher, {studentKey: A, nickname: '지수왕', realName: true}, OCT22), {nickname: '지수왕'});
  assert.deepEqual([f.rows.get(`petRankNames/${A}`).realNameOk, f.rows.get(`petRankNames/${A}`).by], [true, 't1']);
  assert.deepEqual(await setRankNickname(f.db, principal, {studentKey: C, nickname: '별사탕'}, OCT22), {nickname: '별사탕'});
  assert.deepEqual((await listRankNames(f.db, teacher)).names, {[A]: {nickname: '지수왕', realNameOk: true}}, 'a teacher sees their students only');
  assert.deepEqual(Object.keys((await listRankNames(f.db, admin)).names).sort(), [A, C].sort());
  const snap = await buildMonthRanking(f.db, OCT22);
  assert.deepEqual(snap.rows.filter(r => r.by === 'nick').map(r => r.label).sort(), ['별사탕', '지수왕']);
  assert.deepEqual(await setRankNickname(f.db, admin, {studentKey: A, nickname: ''}, OCT22), {nickname: ''});
  assert.equal(f.rows.get(`petRankNames/${A}`).nickname, '', 'empty clears it');
  assert.deepEqual(Object.keys((await listRankNames(f.db, admin)).names), [C]);
  assert.equal(f.rows.get('petRankings/month').builtAt, 0, 'the ranking is made again on its next look');
});

test('실명 이름 everywhere: a pet name is asked first too; the 모험가·원정대 rankings show a real name only when agreed to', async () => {
  const {renamePet} = await import('../api/_lib/pet.js');
  const {buildRankings} = await import('../api/_lib/petRanking.js');
  const s = initialPetState(OCT22); s.pets[0].chosen = true; s.pets[0].name = '몽실이';
  assert.deepEqual(renamePet(s, '하늘이', '박하늘'), {needsConfirm: 'real-name', name: '하늘이'});
  assert.equal(s.pets[0].name, '몽실이', 'nothing changes before the yes');
  assert.deepEqual([renamePet(s, '하늘이', '박하늘', true), s.pets[0].realNameOk], [{name: '하늘이'}, true]);
  assert.deepEqual([renamePet(s, '구름이', '박하늘'), s.pets[0].realNameOk], [{name: '구름이'}, undefined], 'another name: the yes is not carried over');
  const f = await academy();
  const g = f.rows.get('petGuild/b'); g.aliases = {[s.pets[0].slot]: '하늘짱'}; g.guildName = '하늘 원정대'; g.realNameOk = ['하늘짱']; f.rows.set('petGuild/b', g);
  const st = pet(f); st.pets[0].name = '박하늘펫'; f.rows.set('petStates/b', st);
  const p = (await buildRankings(f.db, OCT22)).pets.find(x => x.uid === 'b')!;
  assert.deepEqual([p.alias, p.guild, p.name], ['하늘짱', '', '박**'], 'the agreed 별칭 stays; the 원정대 이름 and pet name are hidden');
});

test('학생 목록 쿠폰 %: the snapshot keeps each student key (never sent to students); the card a % opens counts a student without the app from the 수업 일지', async () => {
  const {teacherStudentCoupon} = await import('../api/_lib/petCoupon.js');
  const f = await academy();
  const snap = await buildMonthRanking(f.db, OCT22);
  assert.deepEqual(snap.rows.map(r => r.key).sort(), [A, B, C].sort());
  assert.equal(JSON.stringify(monthRankRows(snap, 'b')).includes(A), false, 'no key in what a student gets');
  const card: any = await teacherStudentCoupon(f.db, {admin: true, academyId: 'main'}, A, OCT22);
  assert.deepEqual([card.linked, card.offline, card.earned, card.requested], [false, true, 30 + 40 + 15, false]);
  assert.ok(card.ledger.length > 0, 'the 내역 the % is made of');
  assert.equal(f.rows.has('petStates/a'), false, 'nothing saved');
  const src = (await import('node:fs')).readFileSync(new URL('../src/components/teacher/StudentMasterPanel.tsx', import.meta.url), 'utf8');
  assert.match(src, /\{typeof s\.couponPoints==='number'&&onCouponCard&&<span className="smr-gauge"/, 'the list gauge reads couponPoints (pet summary or the snapshot)');
});
test('학생 목록 쿠폰 %: a snapshot over 10 minutes old (or marked stale) is made again, not reused', async () => {
  const {listSnapshotFresh} = await import('../api/_lib/petMonthRanking.js');
  const f = await academy(), snap = await buildMonthRanking(f.db, OCT22);
  assert.equal(listSnapshotFresh(snap, OCT22 + 9 * 60_000), true, 'under 10 minutes');
  assert.equal(listSnapshotFresh(snap, OCT22 + 10 * 60_000), false, '10 minutes old');
  assert.equal(listSnapshotFresh({...snap, builtAt: 0}, OCT22), false, 'marked stale after a name change');
  assert.equal(listSnapshotFresh({...snap, rows: snap.rows.map(({key, ...r}) => r)}, OCT22), false, 'no student keys');
  const src = (await import('node:fs')).readFileSync(new URL('../api/teacher/workspace.ts', import.meta.url), 'utf8');
  assert.match(src, /const snap=listSnapshotFresh\(plain,now\)\?plain:await monthRankingSnapshot\(db,now\)/);
});
