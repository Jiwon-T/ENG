import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { PET_TOWER, TOWER_ENHANCE, TOWER_EVENTS, petStage, towerGear, wornAccessories, type PetCharacterType } from '../../lib/petCatalog';
import { PetCharacter } from './PetCharacters';
import { TowerMonster } from './TowerMonster';
import { Hall, TowerGearIcon } from './TowerHall';
import { TowerDragon, TowerMerchant } from './TowerCharacters';

// What waits behind a door when it isn't a plain battle: the 떠돌이 상인, the 길 잃은 요정, the 수수께끼 석상, the 함정 바닥 and
// the 잠든 몬스터 (a drag mini-game). Every result is decided by the server; these screens only ask.
type Send = (move: string, input?: Record<string, unknown>) => Promise<any>;
export interface TowerEventView { id: string; floor: number; type: 'merchant' | 'riddle' | 'sleeping' | 'trap' | 'fairy'; stock: { stone: number; potion: number } | null; q: { kind: string; prompt: string; choices: string[]; msLeft: number | null } | null; color?: number | null }
interface PetLook { character: string; level: number; clothing: string | null; accessories?: Record<string, string> }
const won = (n: number) => n.toLocaleString('ko-KR');
const Box = ({ children }: { children: ReactNode }) => <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-sm font-medium text-[#2c2c2a]">{children}</p>;

export function TowerEventScreen({ event, busy, points, stones, potions, gear, levels, pet, send }: { event: TowerEventView; busy: boolean; points: number; stones: number; potions: number; gear: string[]; levels: Record<string, number>; pet: PetLook; send: Send }) {
  const title = `${event.floor}층 · ${TOWER_EVENTS[event.type].name}`;
  if (event.type === 'merchant') return <Merchant {...{ event, busy, points, stones, potions, gear, levels, send, title }} />;
  if (event.type === 'fairy') return <div className="space-y-2">
    <Hall caption={title}><div className="absolute inset-x-0 top-14 flex justify-center tower-float"><TowerMonster kind="fairy" size={110} /></div></Hall>
    <Box>“도와주세요… 길을 잃었어요. 출구까지 데려다주실래요?”</Box>
    <div className="grid grid-cols-2 gap-2 text-xs font-bold">
      <button type="button" disabled={busy} onClick={() => void send('save')} className="rounded-xl bg-[#e1f5ee] px-2 py-3 text-[#085041]">구해 주기<span className="block font-medium">물약 1개</span></button>
      <button type="button" disabled={busy} onClick={() => void send('fight')} className="rounded-xl bg-[#fcebeb] px-2 py-3 text-[#791f1f]">수상해! 싸우기<span className="block font-medium">이기면 물약 2개</span></button>
    </div>
  </div>;
  if (event.type === 'riddle' || event.type === 'trap') return <Question {...{ event, busy, send, title }} />;
  return <Sleeping {...{ busy, pet, send, title }} color={event.color ?? 0} />;
}

function Merchant({ event, busy, points, stones, potions, gear, levels, send, title }: { event: TowerEventView; busy: boolean; points: number; stones: number; potions: number; gear: string[]; levels: Record<string, number>; send: Send; title: string }) {
  const [note, setNote] = useState('');
  const act = async (move: string, input: Record<string, unknown> = {}) => {
    const r = await send(move, input); const x = r?.result; if (!x) return;
    if (x.bought) setNote(x.bought === 'stone' ? `강화석을 샀어요 (-${x.price}P)` : `물약을 샀어요 (-${x.price}P)`);
    if ('enhanced' in x) setNote(x.enhanced ? `강화 성공! ${towerGear(x.gearId)?.name} +${x.level}` : `강화 실패… 강화석 ${x.stones}개만 사라졌어요. 장비는 그대로예요.`);
  };
  const stock = event.stock || { stone: 0, potion: 0 };
  return <div className="space-y-2">
    <Hall caption={title}><div className="absolute inset-x-0 bottom-[38px] flex justify-center"><TowerMerchant size={146} /></div></Hall>
    <Box>떠돌이 상인: “좋은 물건이 있지. 포인트만 있으면 뭐든!”</Box>
    <div className="rounded-2xl border border-[#d3d1c7] bg-white px-3 py-2 text-sm">
      <div className="flex items-center justify-between text-xs text-slate-500"><span>내 포인트 {won(points)}P</span><span>강화석 {stones} · 물약 {potions}</span></div>
      {([['stone', '💎 강화석', PET_TOWER.stonePrice, stock.stone], ['potion', '🧪 물약', PET_TOWER.potionPrice, stock.potion]] as const).map(([id, name, price, left]) => <div key={id} className="mt-1.5 flex items-center gap-2"><span className="flex-1 font-bold">{name}</span><span className="text-xs text-slate-500">{price}P · 남은 {left}</span>
        <button type="button" disabled={busy || left <= 0 || points < price} onClick={() => void act('buy', { item: id })} className="rounded-lg bg-[#534ab7] px-3 py-1 text-xs font-bold text-white disabled:opacity-40">사기</button></div>)}
      <b className="mt-3 block text-xs font-black text-[#3c3489]">장비 강화 (실패해도 장비는 안 깨져요)</b>
      {gear.length ? gear.map(id => { const g = towerGear(id); if (!g) return null; const level = levels[id] || 0, step = TOWER_ENHANCE[level];
        return <div key={id} className="mt-1.5 flex items-center gap-2"><TowerGearIcon id={id} size={20} /><span className="flex-1 text-xs font-bold">{g.name} +{level}{step ? ` → +${step.to}` : ''}</span>
          {step ? <><span className="text-[11px] text-slate-500">강화석 {step.stones} · {Math.round(step.rate * 100)}%</span><button type="button" disabled={busy || stones < step.stones} onClick={() => void act('enhance', { gearId: id })} className="rounded-lg bg-[#ba7517] px-3 py-1 text-xs font-bold text-white disabled:opacity-40">강화</button></> : <span className="text-[11px] font-bold text-[#ba7517]">최고 강화</span>}
        </div>; }) : <p className="mt-1 text-xs text-slate-400">아직 장비가 없어요.</p>}
      {note && <p role="status" className="mt-2 rounded-lg bg-[#f7f6fd] px-2 py-1.5 text-xs font-bold text-[#3c3489]">{note}</p>}
    </div>
    <button type="button" disabled={busy} onClick={() => void send('leave')} className="w-full rounded-2xl bg-[#2c2c2a] py-2.5 text-sm font-black text-[#fac775]">인사하고 다음 층으로</button>
  </div>;
}

function Question({ event, busy, send, title }: { event: TowerEventView; busy: boolean; send: Send; title: string }) {
  const q = event.q, trap = event.type === 'trap', [left, setLeft] = useState<number | null>(null), sent = useRef(false);
  useEffect(() => {
    sent.current = false;
    if (!q || q.msLeft === null) { setLeft(null); return; }
    const end = Date.now() + q.msLeft; setLeft(q.msLeft);
    const id = window.setInterval(() => { const ms = Math.max(0, end - Date.now()); setLeft(ms); if (ms === 0 && !sent.current) { sent.current = true; window.clearInterval(id); void send('answer', { choice: -1 }); } }, 100);
    return () => window.clearInterval(id);
  }, [event.id, q?.prompt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!q) return null;
  return <div className="space-y-2">
    <Hall caption={title} tall>
      <div className="absolute inset-x-0 bottom-[30px] flex justify-center text-[88px] leading-none" aria-hidden="true">{trap ? <span className="tower-shake">🕳️</span> : <svg viewBox="0 0 80 104" width="100" height="130" className="block"><rect x="14" y="88" width="52" height="16" rx="2" fill="#5f5e5a" /><path d="M20 88 V40 Q20 14 40 12 Q60 14 60 40 V88 Z" fill="#888780" stroke="#444441" strokeWidth="2" /><rect x="28" y="36" width="8" height="5" rx="1" fill="#2c2c2a" /><rect x="44" y="36" width="8" height="5" rx="1" fill="#2c2c2a" /><path d="M32 60 H48" stroke="#2c2c2a" strokeWidth="3" /><path d="M24 70 L30 64 M56 50 L50 56" stroke="#5f5e5a" strokeWidth="1.5" /></svg>}</div>
    </Hall>
    <Box>{trap ? <>발밑이 흔들려요! {PET_TOWER.trapSeconds}초 안에 뜻을 골라요: <b className="font-black">{q.prompt}</b></> : <>석상: “이 뜻을 가진 단어의 올바른 철자는?” <b className="font-black">“{q.prompt}”</b></>}</Box>
    {left !== null && <div className="h-1.5 overflow-hidden rounded-full bg-[#fcebeb]"><div className="h-full rounded-full bg-[#e24b4a]" style={{ width: `${(left / (PET_TOWER.trapSeconds * 1000)) * 100}%` }} /></div>}
    <div className="grid grid-cols-2 gap-2">{q.choices.map((c, i) => <button key={i} type="button" disabled={busy} onClick={() => { sent.current = true; void send('answer', { choice: i }); }} className="min-h-[44px] rounded-xl border border-[#d3d1c7] bg-white px-2 py-2 text-sm font-bold text-[#2c2c2a]">{c}</button>)}</div>
  </div>;
}

/** 잠든 드래곤: drag the pet along the U path that dips under the dragon, slowly (at least 3 seconds); too fast, or a big
 *  jump, wakes it. The path is reported to the server, which checks the time and the pace before letting the pet past. */
const SNEAK_SPEED = 0.28; // progress per second the browser allows (the server allows a little more)
const pathX = (p: number) => 4 + 88 * p, dipAt = (p: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, (p - 0.22) / 0.56)));
function Sleeping({ busy, pet, color, send, title }: { busy: boolean; pet: PetLook; color: number; send: Send; title: string }) {
  const track = useRef<HTMLDivElement>(null), last = useRef<{ p: number; t: number } | null>(null), start = useRef(0), samples = useRef<number[][]>([]), done = useRef(false);
  const [p, setP] = useState(0), [state, setState] = useState<'ready' | 'drag' | 'woke' | 'out'>('ready'), [off, setOff] = useState(false);
  const FLOOR = 34, DIP = 30, bottomAt = (q: number) => FLOOR - DIP * dipAt(q);
  const finish = (ok: boolean) => { if (done.current) return; done.current = true; setState(ok ? 'out' : 'woke'); window.setTimeout(() => void send('sneak', ok ? { ok, samples: samples.current } : { ok }), 700); };
  const move = (e: ReactPointerEvent) => {
    if (state !== 'drag' || !track.current || done.current) return;
    const r = track.current.getBoundingClientRect(), np = Math.max(0, Math.min(1, ((e.clientX - r.left) / r.width * 100 - 4) / 88)), now = performance.now();
    // Keep to the path: the finger has to stay near the dotted line (it dips under the dragon).
    const pathY = r.bottom - bottomAt(np) - 30; if (Math.abs(e.clientY - pathY) > 70) { setOff(true); return; } setOff(false);
    if (np <= p) { setP(np); return; }
    const l = last.current!; if (np - l.p > 0.12) return finish(false);
    if (now - l.t > 120) { if ((np - l.p) / ((now - l.t) / 1000) > SNEAK_SPEED) return finish(false); last.current = { p: np, t: now }; }
    setP(np); samples.current.push([Math.round(now - start.current), Math.round(np * 1000) / 1000]);
    if (np >= 0.94) finish(true);
  };
  const path = Array.from({ length: 41 }, (_, i) => { const q = i / 40; return `${i ? 'L' : 'M'}${pathX(q)} ${100 - (bottomAt(q) - 1) / 1.5}`; }).join(' ');
  return <div className="space-y-2">
    <Hall caption={title} tall>
      <div className="absolute bottom-[64px] left-1/2 -translate-x-1/2"><TowerDragon color={color} asleep={state !== 'woke'} size={176} />{state !== 'woke' ? <span className="absolute right-2 top-0 animate-pulse text-sm font-black text-[#cecbf6]">Zz</span> : <span className="absolute right-2 top-0 text-xl">❗</span>}</div>
      <div ref={track} className="absolute inset-x-4 bottom-[30px] h-[150px] touch-none" onPointerMove={move} onPointerUp={() => { if (state === 'drag') setState('ready'); }}>
        <svg className="pointer-events-none absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={path} fill="none" stroke="#fac775" strokeWidth="0.8" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" opacity=".7" /></svg>
        <span className="absolute bottom-[30px] right-0 rounded-md bg-[#3b6d11] px-1.5 py-0.5 text-[11px] font-bold text-white">출구 →</span>
        <button type="button" disabled={busy || done.current} aria-label="펫을 길을 따라 천천히 끌어서 출구로" onPointerDown={e => { if (done.current) return; (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId); const now = performance.now(); if (!start.current) start.current = now; last.current = { p, t: now }; setState('drag'); }}
          className="absolute -translate-x-1/2 cursor-grab touch-none active:cursor-grabbing" style={{ left: `${pathX(p)}%`, bottom: bottomAt(p) - 30 }}>
          <PetCharacter character={pet.character as PetCharacterType} stage={petStage(pet.level)} clothing={pet.clothing} accessory={wornAccessories(pet as any)} size={58} />
        </button>
      </div>
    </Hall>
    <Box>{state === 'woke' ? '앗! 드래곤이 깼어요. 엄청나게 강한 상대예요!' : state === 'out' ? '휴, 드래곤 몰래 지나갔어요!' : off ? '점선 길을 따라가요. 드래곤 앞에서는 몸을 낮춰 아래로 지나가요.' : '드래곤이 자고 있어요. 펫을 점선 길을 따라 아주 천천히 끌어서 출구로 데려가요. 서두르면 깨요!'}</Box>
  </div>;
}
