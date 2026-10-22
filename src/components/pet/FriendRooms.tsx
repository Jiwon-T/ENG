import { useEffect, useState } from 'react';
import { Copy, Search, X } from 'lucide-react';
import { PET_ROOM, petItem } from '../../lib/petCatalog';
import { Portrait, Room, type Look, type Profile } from './PetRanking';

// 친구 방 (the pet screen): my 방 코드 to tell friends, today's 방명록 (who came, the sticker, 답방), my 이웃 (rooms I keep),
// 이번 주 인기 방, and 친구 찾기 by 모험가 별칭 · 원정대 이름 (초성 too) or a 방 코드. A room opens as in the 순위, with 응원 스티커.
type Send = (action: string, payload?: Record<string, unknown>) => Promise<any>;
interface Line { /** a line on the 순위 snapshot, or a 방 코드 (someone newer than it) */ at?: number; id?: number; code?: string; label: string; guild: string; level: number; best: number; look: Look; me: boolean }
interface Guest extends Partial<Line> { label: string; guild: string; sticker: string | null; gift?: string | null }
interface Neighbor extends Line { cameToday: boolean; stuckToday: boolean }
const stickerLabel = (id: string) => PET_ROOM.stickers.find(x => x.id === id)?.label || id;

export default function FriendRooms({ send, onClose }: { send: Send; onClose: () => void }) {
  const [home, setHome] = useState<{ code: string; today: { visits: number; stickers: number; gifts?: number }; guestbook: Guest[]; neighbors: Neighbor[]; popular: (Line & { stickers: number })[] } | null>(null);
  const [q, setQ] = useState(''), [found, setFound] = useState<Line[] | null>(null), [profile, setProfile] = useState<Profile | null>(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState(false);
  const fail = (e: any) => setNotice(e?.message || '잠시 후 다시 해 주세요.');
  const load = () => send('room-home').then(r => setHome(r.result)).catch(fail);
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (target: Record<string, unknown>) => { setNotice(''); return send('room-open', target).then(r => setProfile(r.profile)).catch(fail); };
  const search = async () => {
    const text = q.trim(); if (!text) { setNotice('원정대 이름, 별칭이나 방 코드를 써 주세요.'); return; }
    setBusy(true); setNotice('');
    try { setFound((await send('room-search', { q: text })).result.rows); } catch (e) { fail(e); } finally { setBusy(false); }
  };
  const renew = () => send('room-code-new').then(r => setHome(h => h && { ...h, code: r.result.code })).catch(fail);
  const copy = async () => { try { await navigator.clipboard.writeText(home?.code || ''); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* the code stays on screen */ } };
  const visitButton = (l: Partial<Line>) => l.at === undefined && !l.code ? null : <button type="button" onClick={() => void open(l.code ? { code: l.code } : { at: l.at, id: l.id })} className="flex-none rounded-full border border-[#cecbf6] px-2 py-1 text-[11px] font-bold text-[#3c3489] hover:bg-[#f4f2fc]">{l.me ? '내 방' : '방문'}</button>;
  return <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="friend-rooms-title" className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-white sm:rounded-3xl" onClick={e => e.stopPropagation()}>
      <header className="flex items-center gap-2 px-4 pt-3"><h2 id="friend-rooms-title" className="text-base font-black text-[#26215c]">🏡 친구 방</h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="ml-auto rounded-full p-1 text-slate-400 hover:bg-slate-100"><X size={18} aria-hidden="true" /></button></header>
      {notice && <p role="alert" className="px-4 pt-1 text-xs font-bold text-[#b04a5a]">{notice}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 rounded-2xl bg-[#f7f6fd] px-3 py-2">
          <span className="min-w-0 flex-1 text-xs text-[#3c3489]">내 방 코드 <b className="ml-1 text-lg font-black tracking-[0.2em]">{home?.code || '····'}</b><span className="block text-[10px] text-slate-500">친구에게 알려 주면 바로 놀러 와요</span></span>
          <button type="button" onClick={() => void copy()} disabled={!home} className="flex-none rounded-lg border border-[#cecbf6] bg-white px-2 py-1 text-[11px] font-bold text-[#3c3489]"><Copy size={12} className="mr-0.5 inline" aria-hidden="true" />{copied ? '복사됨' : '복사'}</button>
          <button type="button" onClick={() => void renew()} disabled={!home} className="flex-none rounded-lg border border-[#cecbf6] bg-white px-2 py-1 text-[11px] font-bold text-[#3c3489]">새 코드</button>
        </div>
        <h3 className="mt-3 flex items-baseline justify-between text-sm font-black text-[#5e1e2a]">오늘 다녀간 친구<span className="text-[11px] font-bold text-slate-500">{home ? `${home.today.visits}명 · 응원 ${home.today.stickers}${home.today.gifts ? ` · 선물 ${home.today.gifts}` : ''}` : ''}</span></h3>
        {!home ? <p className="py-3 text-center text-xs text-slate-400">불러오는 중…</p> : !home.guestbook.length ? <p className="py-3 text-center text-xs text-slate-400">오늘은 아직 다녀간 친구가 없어요. 내 방 코드를 알려 줘 보세요!</p>
          : <ul>{home.guestbook.map((g, i) => <li key={i} className="flex items-center gap-2 border-b border-[#f1eff8] py-1.5 last:border-0">
            {g.look ? <Portrait look={g.look} size={26} /> : <span className="h-[26px] w-[26px] flex-none rounded-full bg-slate-100" />}
            <span className="min-w-0 flex-1 truncate text-xs"><b className="font-bold text-[#26215c]">{g.label}</b> <span className="text-slate-400">{g.guild}</span></span>
            <span className={`flex-none text-[11px] ${g.sticker || g.gift ? 'font-bold text-[#993556]' : 'text-slate-400'}`}>{[g.sticker && stickerLabel(g.sticker), g.gift && `선물 ${petItem(g.gift)?.name || ''}`].filter(Boolean).join(' · ') || '구경만'}</span>
            {visitButton(g)}</li>)}</ul>}
        <h3 className="mt-3 flex items-baseline justify-between text-sm font-black text-[#5e1e2a]">내 이웃<span className="text-[11px] font-bold text-slate-500">{home ? `${home.neighbors.length}명` : ''}</span></h3>
        {home && (!home.neighbors.length ? <p className="py-2 text-center text-xs text-slate-400">친구 방에서 '☆ 이웃 추가'를 누르면 여기 모여요</p>
          : <ul>{home.neighbors.map(n => <li key={`${n.at}-${n.id}`} className="flex items-center gap-2 border-b border-[#f1eff8] py-1.5 last:border-0">
            <Portrait look={n.look} size={26} />
            <span className="min-w-0 flex-1 truncate text-xs"><b className="font-bold text-[#26215c]">{n.label}</b> <span className="text-slate-400">{n.guild}</span></span>
            {n.cameToday && <span className="flex-none text-[11px] font-bold text-[#993556]">오늘 왔어요</span>}
            {n.stuckToday && <span className="flex-none text-[11px] text-slate-400">응원함</span>}
            {visitButton(n)}</li>)}</ul>)}
        {home && home.popular.length > 0 && <>
          <h3 className="mt-3 text-sm font-black text-[#5e1e2a]">이번 주 인기 방</h3>
          <ul>{home.popular.map((l, i) => <li key={`${l.at}-${l.id}`} className="flex items-center gap-2 border-b border-[#f1eff8] py-1.5 last:border-0">
            <span className="w-4 flex-none text-center text-xs font-black" style={{ color: ['#ef9f27', '#b4b2a9', '#d85a30'][i] }}>{i + 1}</span>
            <Portrait look={l.look} size={26} />
            <span className="min-w-0 flex-1 truncate text-xs"><b className="font-bold text-[#26215c]">{l.label}</b> <span className="text-slate-400">{l.guild} · 응원 {l.stickers}</span></span>
            {visitButton(l)}</li>)}</ul></>}
        <h3 className="mt-3 text-sm font-black text-[#5e1e2a]">친구 찾기</h3>
        <form className="mt-1 flex gap-1.5" onSubmit={e => { e.preventDefault(); void search(); }}>
          <input value={q} onChange={e => { setQ(e.target.value); setNotice(''); }} maxLength={20} placeholder="원정대 이름 · 별칭 · 방 코드 (초성도 돼요)" aria-label="친구 찾기" className="h-9 min-w-0 flex-1 rounded-xl border border-[#e4e0f5] px-3 text-sm outline-none focus:ring-2 focus:ring-[#eeedfe]" />
          <button type="submit" disabled={busy} className="flex flex-none items-center gap-1 rounded-xl bg-[#534ab7] px-3 text-xs font-bold text-white disabled:opacity-60"><Search size={13} aria-hidden="true" />찾기</button>
        </form>
        {found && (!found.length ? <p className="py-3 text-center text-xs text-slate-400">찾는 친구가 없어요. 방 코드로도 찾아 보세요.</p>
          : <ul className="mt-1">{found.map(l => <li key={`${l.at}-${l.id}`} className="flex items-center gap-2 border-b border-[#f1eff8] py-1.5 last:border-0">
            <Portrait look={l.look} size={26} />
            <span className="min-w-0 flex-1 truncate text-xs"><b className="font-bold text-[#26215c]">{l.label}</b> <span className="text-slate-400">{l.guild} · Lv.{l.level} · 탑 {l.best}층</span></span>
            {visitButton(l)}</li>)}</ul>)}
      </div>
    </section>
    {profile && <Room p={profile} onClose={() => { setProfile(null); void load(); }}
      onSticker={sticker => send('room-sticker', { via: 'room', ...profile.ref, sticker }).then(x => x.result)}
      onHide={hidden => send('room-hide', { hidden }).then(x => Boolean(x.result?.roomHidden))}
      onNeighbor={keep => send('room-neighbor', { via: 'room', ...profile.ref, keep }).then(x => Boolean(x.result?.neighbor))}
      onGift={(item, fromBag) => send('room-gift', { via: 'room', ...profile.ref, item, fromBag }).then(x => x.result)} />}
  </div>;
}
