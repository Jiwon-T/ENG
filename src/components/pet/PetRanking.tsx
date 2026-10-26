import { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PetCharacter } from './PetCharacters';
import PassMark from './PassMark';
import { SCENE, SceneArt } from './PetScenes';
import { MedalLayer } from './PetCoupon';
import AdventureNames, { type NamesView } from './AdventureNames';
import { GEAR_SET_SHORT, PET_JOBS, PET_ROOM, petItem, petStage, type PetGearView, type PetJob, type PetRoomSticker } from '../../lib/petCatalog';

// 순위: 모험가 (each pet) and 원정대 (each student), every academy together, by 원정대 이름·모험가 별칭 only. A row opens that
// pet's room (outfit, background, 금메달) — a visit (방 구경): 다녀간 친구, 응원 스티커, or closing your own room. Teachers can switch their own pets in ('선생님 포함').
// 이달 포인트: every student of the academy (a pet or not) by this month's points — the top 10 and my place, under a 별칭,
// a 닉네임 or the family name only.
type Send = (action: string, payload?: Record<string, unknown>) => Promise<any>;
export interface Look { character: string; level: number; clothing: string | null; accessories: string[]; aura?: 'light' | 'dark' | null; gear?: PetGearView | null }
interface RankRow { rank: number; id: number; label: string; sub: string; job: PetJob | null; pass?: 'pet' | 'premium' | null; value: number; stars: number; looks: Look[]; teacher: boolean; me: boolean }
interface Ranking { at: number; kind: 'pet' | 'guild'; /** 🗼 탑 층순 or ⭐ 원정대 별순 */ sort?: 'floor' | 'stars'; teacherView: boolean; withTeachers: boolean; total: number; rows: RankRow[]; mine: RankRow[] }
interface MonthRow { rank: number; label: string; by: 'alias' | 'pet' | 'nick' | 'name'; sub: string; earned: number; look: Look | null; me: boolean }
interface MonthRanking { at: number; stale?: boolean; kind: 'month'; teacherView: boolean; goal: number; month: string; total: number; rows: MonthRow[]; mine: { rank: number | null; earned: number } | null }
type AnyRanking = (Ranking & { stale?: boolean }) | MonthRanking;
export interface RoomView { today: number; total: number; stickers: Partial<Record<PetRoomSticker, number>>; sticker: PetRoomSticker | null; gift?: string | null }
export interface Wallet { points: number; snacks: Record<string, number>; giftsLeft: number }
export interface Profile { /** a teacher looking: whose pet it is (학생 · 학원 연결 안 된 앱 계정 · 선생님) */ owner?: { kind: 'student' | 'app' | 'teacher' | 'other-academy'; name: string; /** the admin: the app name, when not the real one */ alias?: string }; /** a friend's room closed by its owner */ hidden?: boolean; /** kept as my 이웃 */ neighbor?: boolean; /** what I can give from here (간식 선물) */ wallet?: Wallet | null; room?: RoomView | null; /** my own room is closed */ roomHidden?: boolean; /** the 순위 row it was opened from */ id?: number; /** opened by code, 방명록 or 친구 찾기: the line to leave a sticker by */ ref?: { at: number; id: number }; gear?: PetGearView | null; label: string; guild: string; name: string; character: string; level: number; job: PetJob | null; aura?: 'light' | 'dark' | null; pass?: 'pet' | 'premium' | null; clothing: string | null; accessories: string[]; background: string; decor: { id: string; x: number; y: number }[]; medals: number; /** 은메달 (a month with only a 5천 원 coupon) */ silver?: number; best: number; stars: number; me: boolean }

const MEDAL = ['#ef9f27', '#b4b2a9', '#d85a30'];
export const Portrait = ({ look, size = 30 }: { key?: number; look: Look; size?: number }) => <span className="inline-flex flex-none items-center justify-center overflow-hidden rounded-full border border-[#e4e0f5] bg-[#f7f6fd]" style={{ width: size, height: size }}><PetCharacter character={look.character} stage={petStage(look.level)} clothing={look.clothing} accessory={look.accessories} aura={look.aura} gear={look.gear} portrait size={size - 2} /></span>;

function Row({ r, onOpen, byStars = false }: { key?: string; r: RankRow; onOpen: () => void; byStars?: boolean }) {
  return <div className={`flex items-center gap-1.5 border-t border-[#f1eff8] pr-1.5 first:border-t-0 ${r.me ? 'rounded-xl bg-[#fffaf0]' : ''}`}><button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-2 text-left">
    <span className="w-6 flex-none text-center text-sm font-black" style={{ color: r.rank <= 3 ? MEDAL[r.rank - 1] : '#94a3b8' }}>{r.rank}</span>
    <span className="flex flex-none -space-x-2">{r.looks.map((l, i) => <Portrait key={i} look={l} />)}</span>
    <span className="min-w-0 flex-1"><b className="block truncate text-sm font-black text-[#26215c]">{r.label}{r.pass && <span className="ml-1 inline-flex align-middle"><PassMark plan={r.pass} /></span>}{r.me && <span className="ml-1 rounded bg-[#ef9f27] px-1 text-[10px] font-bold text-white">나</span>}{r.teacher && <span className="ml-1 rounded bg-[#3c3489] px-1 text-[10px] font-bold text-white">선생님</span>}</b>
      <span className="block truncate text-[11px] text-slate-500">{r.sub}{r.job ? ` · ${PET_JOBS[r.job]?.label || ''}` : ''}</span></span>
    <span className="flex-none text-right">{byStars ? <><b className="block text-sm font-black text-[#854f0b]">★ {r.stars}</b><span className="text-[10px] text-[#3c3489]">{r.value}층</span></> : <><b className="block text-sm font-black text-[#3c3489]">{r.value}층</b><span className="text-[10px] text-[#854f0b]">★ {r.stars}</span></>}</span>
  </button>
  <button type="button" onClick={onOpen} aria-label={`${r.label} ${r.me ? '내 방 보기' : '방문하기'}`} className="flex-none rounded-full border border-[#cecbf6] px-2 py-1 text-[11px] font-bold text-[#3c3489] hover:bg-[#f4f2fc]">{r.me ? '내 방' : '방문'}</button></div>;
}

function MonthLine({ r }: { key?: string; r: MonthRow }) {
  return <div className={`flex w-full items-center gap-2.5 border-t border-[#f1eff8] px-2 py-2 first:border-t-0 ${r.me ? 'rounded-xl bg-[#fffaf0]' : ''}`}>
    <span className="w-6 flex-none text-center text-sm font-black" style={{ color: r.rank <= 3 ? MEDAL[r.rank - 1] : '#94a3b8' }}>{r.rank}</span>
    {r.look ? <Portrait look={r.look} /> : <span aria-hidden="true" className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-[#ece9f5] bg-[#f8f7fb] text-xs font-bold text-slate-500">{[...r.label][0]}</span>}
    <span className="min-w-0 flex-1"><b className="block truncate text-sm font-black text-[#26215c]">{r.label}{r.me && <span className="ml-1 rounded bg-[#ef9f27] px-1 text-[10px] font-bold text-white">나</span>}</b>
      {r.sub && <span className="block truncate text-[11px] text-slate-500">{r.sub}</span>}</span>
    <b className="flex-none text-sm font-black text-[#3c3489]">{r.earned.toLocaleString()}P</b>
  </div>;
}

const STICKER_TONE: Record<string, string> = { best: 'bg-[#fbeaf0] text-[#72243e]', together: 'bg-[#e1f5ee] text-[#085041]', medal: 'bg-[#faeeda] text-[#633806]', tower: 'bg-[#e6f1fb] text-[#0c447c]', cute: 'bg-[#eeedfe] text-[#3c3489]', cheer: 'bg-[#eaf3de] text-[#27500a]' };
const stickerLabel = (id: string) => PET_ROOM.stickers.find(x => x.id === id)?.label || id;
/** `onSticker`: leave a 응원 스티커 here (the server answers with the room again); `onHide`: close or open my own room;
 *  `onNeighbor`: keep this room as my 이웃 or not; `onGift`: give a snack (bought, or from my 가방). */
export function Room({ p, onClose, onSticker, onHide, onNeighbor, onGift }: { p: Profile; onClose: () => void; onSticker: (id: PetRoomSticker) => Promise<{ room: RoomView; xp: number }>; onHide: (hidden: boolean) => Promise<boolean>; onNeighbor: (keep: boolean) => Promise<boolean>; onGift: (item: string, fromBag: boolean) => Promise<{ gift: string; xp: number; points: number; giftsLeft: number; snacks: Record<string, number> }> }) {
  const [room, setRoom] = useState(p.room || null), [hiddenMine, setHiddenMine] = useState(Boolean(p.roomHidden)), [busy, setBusy] = useState(false), [note, setNote] = useState('');
  const got = PET_ROOM.stickers.filter(x => (room?.stickers[x.id] || 0) > 0);
  const [error, setError] = useState('');
  const run = async (f: () => Promise<void>) => { setBusy(true); setNote(''); setError(''); try { await f(); } catch (e: any) { setError(e?.message || '잠시 후 다시 해 주세요.'); } finally { setBusy(false); } };
  const stick = (id: PetRoomSticker) => run(async () => { const r = await onSticker(id); setRoom(r.room); setNote(r.xp ? `응원했어요! 내 펫 경험치 +${r.xp}` : '응원했어요!'); });
  const hide = () => run(async () => setHiddenMine(await onHide(!hiddenMine)));
  const [neighbor, setNeighbor] = useState(Boolean(p.neighbor));
  const [wallet, setWallet] = useState(p.wallet || null), [pick, setPick] = useState<string | null>(null);
  const bagged = (id: string) => wallet?.snacks[id] || 0;
  const give = () => pick && run(async () => { const r = await onGift(pick, bagged(pick) > 0); setRoom(x => x && { ...x, gift: r.gift }); setWallet({ points: r.points, giftsLeft: r.giftsLeft, snacks: r.snacks }); setPick(null); setNote(`선물했어요! 내 펫 경험치 +${r.xp}`); });
  const keep = () => run(async () => { const on = await onNeighbor(!neighbor); setNeighbor(on); setNote(on ? '이웃이 되었어요! 친구 방에서 바로 찾아와요' : '이웃에서 뺐어요'); });
  return <div className="fixed inset-0 z-[88] flex items-center justify-center bg-slate-900/50 p-4" onClick={e => { e.stopPropagation(); onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={`${p.label}의 방`} className="w-full max-w-xs overflow-hidden rounded-3xl bg-white" onClick={e => e.stopPropagation()}>
      <div className={`relative flex h-48 items-end justify-center ${SCENE[p.background] || SCENE.default}`}>
        <SceneArt id={p.background} />
        <MedalLayer spots={p.decor} editing={false} onMove={() => undefined} />
        <div className="relative z-10 mb-2"><PetCharacter character={p.character} stage={petStage(p.level)} clothing={p.clothing} accessory={p.accessories} aura={p.aura} gear={p.gear} size={96} /></div>
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-2 top-2 z-20 rounded-full bg-white/90 p-1 text-slate-500"><X size={16} aria-hidden="true" /></button>
      </div>
      <div className="px-4 pb-4 pt-3">
        <b className="block text-base font-black text-[#26215c]">{p.label}{p.pass && <span className="ml-1 inline-flex align-middle"><PassMark plan={p.pass} /></span>}{p.me && <span className="ml-1 rounded bg-[#ef9f27] px-1 text-[10px] font-bold text-white">나</span>}
          {!p.me && <button type="button" disabled={busy} aria-pressed={neighbor} onClick={() => void keep()} className={`float-right rounded-full border px-2 py-0.5 text-[11px] font-bold ${neighbor ? 'border-[#ef9f27] bg-[#fff6e6] text-[#854f0b]' : 'border-[#cecbf6] text-[#3c3489]'}`}>{neighbor ? '★ 이웃' : '☆ 이웃 추가'}</button>}</b>
        {p.owner && <span className="mb-0.5 flex w-fit items-center gap-1 rounded-full bg-[#eeedfe] px-2 py-0.5 text-[11px] font-bold text-[#3c3489]" title="선생님에게만 보여요">👤 {p.owner.kind === 'other-academy' ? '다른 학원' : p.owner.kind === 'student' ? `${p.owner.name} 학생` : p.owner.kind === 'teacher' ? `${p.owner.name || '선생님'} (선생님)` : `${p.owner.name || '이름 없음'}${p.owner.alias ? ` (앱 이름 ${p.owner.alias})` : ''} · 학원 연결 안 된 계정`}</span>}
        <span className="text-xs text-slate-500">{p.guild} · Lv.{p.level}{p.job ? ` · ${PET_JOBS[p.job]?.label || ''}` : ''}{p.gear?.full != null ? ` · ${GEAR_SET_SHORT[p.gear.full]} 세트 6/6` : ''}</span>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">{[`탑 ${p.best}층`, `원정대 별 ${p.stars}`, `금메달 ${p.medals}`, ...(p.silver ? [`은메달 ${p.silver}`] : [])].map(t => <span key={t} className="rounded-lg border border-[#e4e0f5] px-2 py-0.5 text-[#3c3489]">{t}</span>)}</div>
        {p.hidden ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">방을 닫아 둔 친구예요. 펫만 볼 수 있어요.</p> : room && <div className="mt-3 border-t border-[#f1eff8] pt-2">
          <p className="flex justify-between text-[11px] text-slate-500"><span>다녀간 친구</span><span className="font-bold text-[#3c3489]">오늘 {room.today} · 전체 {room.total}</span></p>
          {got.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{got.map(x => <span key={x.id} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STICKER_TONE[x.id]}`}>{x.label} {room.stickers[x.id]}</span>)}</div>}
          {!p.me && (room.sticker ? <p className="mt-2 text-[11px] text-slate-500">오늘 '{stickerLabel(room.sticker)}' 스티커를 붙였어요</p> : <>
            <p className="mt-2 text-[11px] font-bold text-slate-600">응원 스티커 붙이기 <span className="font-normal text-slate-400">(하루 1장)</span></p>
            <div className="mt-1 grid grid-cols-3 gap-1">{PET_ROOM.stickers.map(x => <button key={x.id} type="button" disabled={busy} onClick={() => void stick(x.id)} className={`rounded-lg px-1 py-1.5 text-[11px] font-bold disabled:opacity-50 ${STICKER_TONE[x.id]}`}>{x.label}</button>)}</div></>)}
          {!p.me && wallet && (room.gift ? <p className="mt-2 text-[11px] text-slate-500">오늘 '{petItem(room.gift)?.name}'을(를) 선물했어요</p> : <>
            <p className="mt-2 text-[11px] font-bold text-slate-600">🎁 간식 선물 <span className="font-normal text-slate-400">(내 {wallet.points.toLocaleString()}P · 오늘 {wallet.giftsLeft}번 더)</span></p>
            <div className="mt-1 grid grid-cols-3 gap-1">{PET_ROOM.gifts.map(id => { const it = petItem(id)!, bag = bagged(id), poor = !bag && wallet.points < it.price; return <button key={id} type="button" disabled={busy || poor || !wallet.giftsLeft} aria-pressed={pick === id} onClick={() => setPick(pick === id ? null : id)}
              className={`rounded-lg border px-0.5 py-1 text-center text-[10px] font-bold disabled:opacity-40 ${pick === id ? 'border-2 border-[#d4537e] text-[#72243e]' : 'border-[#f3e6e8] text-[#5e1e2a]'}`}><span className="block text-base" aria-hidden="true">{it.icon}</span>{it.name}<span className={`block font-normal ${bag ? 'text-[#0f6e56]' : 'text-slate-400'}`}>{bag ? `가방 ${bag}` : `${it.price}P`}</span></button>; })}</div>
            {pick && <button type="button" disabled={busy} onClick={() => void give()} className="mt-1.5 w-full rounded-lg bg-[#d4537e] py-1.5 text-xs font-bold text-white disabled:opacity-60">{bagged(pick) ? `가방에서 ${petItem(pick)?.name} 선물하기` : `${petItem(pick)?.name} 선물하기 · ${petItem(pick)?.price}P`}</button>}</>)}
          {note && <p role="status" className="mt-1.5 text-[11px] font-bold text-[#3b6d11]">{note}</p>}
        </div>}
        {error && <p role="alert" className="mt-1.5 text-[11px] font-bold text-[#b04a5a]">{error}</p>}
        {p.me && <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-[#f7f6fd] px-3 py-2 text-[11px] text-[#3c3489]"><span>{hiddenMine ? '내 방을 닫아 뒀어요 (친구가 펫만 봐요)' : '친구들이 내 방에 놀러 올 수 있어요'}</span>
          <button type="button" disabled={busy} onClick={() => void hide()} className="flex-none rounded-lg border border-[#cecbf6] bg-white px-2 py-1 font-bold">{hiddenMine ? '방 열기' : '방 닫기'}</button></div>}
      </div>
    </section>
  </div>;
}

/** `withTeachers`: open on the ranking with the teachers (a teacher's home chip shows their place there). */
export default function PetRanking({ send, onClose, withTeachers = false }: { send: Send; onClose: () => void; withTeachers?: boolean }) {
  const [kind, setKind] = useState<'pet' | 'guild' | 'month'>('pet'), [teachers, setTeachers] = useState(withTeachers);
  // 🗼 탑 층순 / ⭐ 원정대 별순 (모험가·원정대): the order rides in the kind the server reads ('pet-stars', 'guild-stars')
  const [sort, setSort] = useState<'floor' | 'stars'>('floor'), byStars = sort === 'stars' && kind !== 'month', kindParam = byStars ? `${kind}-stars` : kind;
  const [ranking, setRanking] = useState<AnyRanking | null>(null), [notice, setNotice] = useState(''), [profile, setProfile] = useState<Profile | null>(null), [names, setNames] = useState<NamesView | null>(null);
  // Each view read is kept, so switching 모험가 · 원정대 back shows at once. A ranking older than 10 minutes is shown
  // straight away; the rebuild is asked for after it, and the list is read again when that is done.
  // `refreshAt`: when the last rebuild was asked for (another try only after 30 s, whether it failed or the rebuild lock
  // returned the same snapshot), so a stale answer never asks again and again.
  const cache = useRef(new Map<string, AnyRanking>()), refreshAt = useRef(0), shown = useRef(''), retry = useRef<number>();
  useEffect(() => () => window.clearTimeout(retry.current), []);
  const load = () => {
    setNotice(''); const key = `${kindParam}:${teachers}`, kept = cache.current.get(key); shown.current = key; setRanking(kept || null);
    send('rank-board', { kind: kindParam, teachers }).then(r => {
      cache.current.set(key, r.ranking); if (shown.current === key) setRanking(r.ranking); // a late answer for a view left is only kept
      if (r.ranking?.stale && Date.now() - refreshAt.current > 30_000) {
        refreshAt.current = Date.now();
        // rebuilt: read again; not yet (failed, or another request holds the rebuild): try once more in 30 s
        const again = () => { window.clearTimeout(retry.current); retry.current = window.setTimeout(() => { if (shown.current === key) load(); }, 31_000); };
        send('rank-refresh', { kind }).then(x => { if (x?.at && x.at !== r.ranking.at) { cache.current.clear(); return send('rank-board', { kind: kindParam, teachers }).then(y => { cache.current.set(key, y.ranking); if (shown.current === key) setRanking(y.ranking); }); } again(); }).catch(again);
      }
    }).catch(e => setNotice(e?.message || '순위를 불러오지 못했어요.'));
  };
  useEffect(load, [kind, teachers, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const board = ranking && ranking.kind !== 'month' ? ranking : null, month = ranking?.kind === 'month' ? ranking : null;
  const open = (r: RankRow) => send('rank-profile', { at: ranking?.at, id: r.id, kind: kindParam, teachers }).then(x => setProfile({ ...x.profile, id: r.id })).catch(e => { setNotice(e?.message || '잠시 후 다시 해 주세요.'); if (e?.code === 'RANK_STALE') load(); });
  const openNames = () => send('guild-state').then(r => setNames(r.guild?.names || null)).catch(e => setNotice(e?.message || '잠시 후 다시 해 주세요.'));
  return <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="pet-ranking-title" className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-white sm:rounded-3xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center gap-2 px-4 pt-3">
        <h2 id="pet-ranking-title" className="text-base font-black text-[#26215c]">🏅 순위</h2>
        <button type="button" onClick={() => void openNames()} className="ml-auto rounded-lg border border-[#e4e0f5] px-2 py-1 text-[11px] font-bold text-[#3c3489]">내 이름 정하기</button>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} aria-hidden="true" /></button>
      </header>
      <div className="flex items-center gap-1.5 px-4 pt-2">
        <div role="tablist" aria-label="순위 종류" className="flex gap-1 rounded-full bg-[#f4f2fc] p-0.5">{([['pet', '모험가'], ['guild', '원정대'], ['month', '이달 포인트']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)} className={`rounded-full px-3 py-1 text-xs font-bold ${kind === id ? 'bg-white text-[#3c3489] shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</div>
        {ranking?.teacherView && kind !== 'month' && <button type="button" aria-pressed={teachers} onClick={() => setTeachers(!teachers)} className={`ml-auto rounded-full border px-2.5 py-1 text-[11px] font-bold ${teachers ? 'border-[#3c3489] bg-[#3c3489] text-white' : 'border-[#cecbf6] text-[#3c3489]'}`}>선생님 포함</button>}
      </div>
      {kind !== 'month' && <div role="group" aria-label="순위 기준" className="flex gap-1.5 px-4 pt-2">{([['floor', '🗼 탑 층순'], ['stars', '⭐ 원정대 별순']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={sort === id} onClick={() => setSort(id)} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${sort === id ? 'border-[#7f77dd] bg-[#eeedfe] text-[#3c3489]' : 'border-[#e4e0f5] text-slate-500'}`}>{label}</button>)}</div>}
      <p className="px-4 pt-1.5 text-[11px] text-slate-500">{kind === 'month' ? `학생마다 · ${month ? Number(month.month.slice(5)) : new Date().getMonth() + 1}월에 모은 포인트 · 상위 10명` : kind === 'pet' ? (byStars ? '펫마다 · 원정대 별 → 탑 최고 층 → 레벨' : '펫마다 · 탑 최고 층 → 원정대 별 → 레벨') : (byStars ? '학생마다 · 펫들의 원정대 별을 모두 더해요' : '학생마다 · 펫들의 탑 최고 층을 모두 더해요')}{kind === 'month' ? '' : ' · 모든 학원 함께'} · 10분마다 새로 계산해요</p>
      {notice && <p role="alert" className="px-4 pt-1 text-xs font-bold text-[#b04a5a]">{notice}</p>}
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {!ranking ? <p role="status" className="py-8 text-center text-sm text-slate-500">순위를 불러오는 중…</p>
          : month ? <>{month.rows.length ? month.rows.map(r => <MonthLine key={`${r.rank}-${r.label}`} r={r} />) : <p className="py-8 text-center text-sm text-slate-500">이번 달에는 아직 포인트를 모은 친구가 없어요</p>}
            {month.mine && <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#fef2f3] px-3 py-2 text-xs text-[#8b2f40]"><b className="font-black">나</b>
              <span className="flex-1">{month.mine.rank ? `${month.mine.rank}위 · ${month.mine.earned.toLocaleString()}P` : '포인트가 쌓이면 순위에 올라요'}</span>
              <span className="text-[11px]">{month.mine.earned >= month.goal ? `${(month.goal / 10_000).toLocaleString()}만P 달성!` : `${(month.goal / 10_000).toLocaleString()}만P까지 ${(month.goal - month.mine.earned).toLocaleString()}P`}</span></div>}
            <p className="pt-2 text-center text-[10px] text-slate-400">모두 {month.total}명 · 이름은 별칭·닉네임·펫 이름으로, 없으면 성만 보여요</p></>
          : !board ? null : !board.rows.length ? <p className="py-8 text-center text-sm text-slate-500">아직 순위에 오른 모험가가 없어요</p>
          : <>{board.rows.map(r => <Row key={`${r.rank}-${r.id}`} r={r} byStars={byStars} onOpen={() => void open(r)} />)}
            {board.mine.length > 0 && <><p className="py-1 text-center text-xs text-slate-300" aria-hidden="true">⋯</p>{board.mine.map(r => <Row key={`m${r.id}`} r={r} byStars={byStars} onOpen={() => void open(r)} />)}</>}
            {kind === 'pet' && ![...board.rows, ...board.mine].some(r => r.me) && <p className="mx-auto mt-2 w-fit rounded-full bg-[#fef2f3] px-3 py-1 text-[11px] font-bold text-[#8b2f40]">펫을 키우고 탑에 오르면 순위에 올라요</p>}
            <p className="pt-2 text-center text-[10px] text-slate-400">모두 {board.total}{kind === 'pet' ? '마리' : '팀'} · '방문'을 누르면 그 펫의 방에 놀러 가요</p></>}
      </div>
    </section>
    {profile && <Room p={profile} onClose={() => setProfile(null)}
      onSticker={sticker => send('room-sticker', { at: ranking?.at, id: profile.id, kind: kindParam, teachers, sticker }).then(x => x.result)}
      onHide={hidden => send('room-hide', { hidden }).then(x => Boolean(x.result?.roomHidden))}
      onNeighbor={keep => send('room-neighbor', { at: ranking?.at, id: profile.id, kind: kindParam, teachers, keep }).then(x => Boolean(x.result?.neighbor))}
      onGift={(item, fromBag) => send('room-gift', { at: ranking?.at, id: profile.id, kind: kindParam, teachers, item, fromBag }).then(x => x.result)} />}
    {names && <AdventureNames names={names} send={send} onSaved={r => { if (r.guild?.names) setNames(r.guild.names); }} onClose={() => { setNames(null); load(); }} />}
  </div>;
}
