import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PET_TOWER, towerGear, towerGearFor, type PetJob } from '../../lib/petCatalog';
import { gearPiece } from './petGearArt';
import './towerHall.css';

// 채움의 탑 inside: a dark stone hall lit by torches. The gate opens first; on floor 1 a lone treasure chest waits; every
// floor then shows three old doors (a boss floor: one great door). What is behind a door is decided by the server.
/** Each door's heraldry (the wood is old oak on all of them). */
const CRESTS = [{ crest: '#534ab7', gem: '#afa9ec' }, { crest: '#3b6d11', gem: '#97c459' }, { crest: '#a32d2d', gem: '#f09595' }, { crest: '#185fa5', gem: '#85b7eb' }, { crest: '#5f5e5a', gem: '#d3d1c7' }];
/** Three of the five crests, different on each floor. */
const doorsFor = (floor: number) => [0, 1, 2].map(i => CRESTS[(floor * 2 + i * 3) % CRESTS.length]);

/** Tower gear pictures. The 견습 몽둥이: a beginner's wooden club in a classic RPG style (light wood, a thick rounded
 *  head tapering to a wrapped grip); our own drawing. */
export function TowerGearIcon({ id, size = 22, job }: { key?: string; id: string; size?: number; job?: PetJob | null }) {
  const set = towerGear(id);
  if (set?.set !== undefined) { const p = gearPiece(job === 'wizard' ? 'mage' : 'knight', set.slot, set.set); return <svg viewBox={p.box} width={size} height={size} role="img" aria-label={towerGearFor(id, job)?.name} dangerouslySetInnerHTML={{ __html: p.svg }} />; }
  if (id === 'apprentice_club') return <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="견습 몽둥이">
    <g transform="rotate(-40 24 24)">
      <path d="M19.5 4 Q24 1 28.5 4 Q31 9 29.5 22 L27 34 H21 L18.5 22 Q17 9 19.5 4 Z" fill="#e3a65a" stroke="#6b3d08" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M22 7 Q21 15 22.5 26" fill="none" stroke="#f5cf95" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M26.5 9 Q27 14 26 18" fill="none" stroke="#b9761c" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="26.5" cy="21" rx="1.2" ry="1.6" fill="#b9761c" />
      <rect x="20.5" y="33" width="7" height="11" rx="2" fill="#8a5a2b" stroke="#4a2a08" strokeWidth="1.6" />
      <path d="M20.5 36 H27.5 M20.5 39.5 H27.5" stroke="#4a2a08" strokeWidth="1.2" />
      <rect x="19.8" y="43" width="8.4" height="3" rx="1.5" fill="#6b3d08" />
    </g>
  </svg>;
  if (id === 'golem_pauldron') return <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label="수문장의 돌 견갑">
    <path d="M6 30 Q6 12 24 10 Q42 12 42 30 Q34 26 24 26 Q14 26 6 30Z" fill="#b4b2a9" stroke="#444441" strokeWidth="2" strokeLinejoin="round" />
    <path d="M10 34 Q24 28 38 34 L36 40 Q24 35 12 40Z" fill="#888780" stroke="#444441" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M16 18 l4 3 M30 15 l-3 4" stroke="#5f5e5a" strokeWidth="1.6" strokeLinecap="round" /><circle cx="24" cy="19" r="3" fill="#ba7517" stroke="#633806" strokeWidth="1.2" />
  </svg>;
  return <span style={{ fontSize: size * 0.8 }} aria-hidden="true">{towerGearFor(id)?.icon}</span>;
}

/** A pointed (gothic) oak leaf: planks, wrought-iron strap hinges with studs, a ring knocker and a painted shield.
 *  `half` crops it for the two leaves of a double door. */
function LeafArt({ w, h, crest, gold = false, half, double = false }: { w: number; h: number; crest?: string; gold?: boolean; half?: 'left' | 'right'; double?: boolean }) {
  const arch = `M0 ${h} V${h * 0.34} Q0 ${h * 0.08} ${w / 2} 0 Q${w} ${h * 0.08} ${w} ${h * 0.34} V${h} Z`, id = `leaf${useId().replace(/:/g, '')}`; // one per drawn leaf
  const iron = gold ? '#ba7517' : '#2c2c2a', stud = gold ? '#fac775' : '#888780', bands = [h * 0.3, h * 0.72];
  const strap = (y: number, fromRight: boolean) => { const len = double ? w * 0.42 : w * 0.72, x0 = fromRight ? w : 0, dir = fromRight ? -1 : 1, tip = x0 + dir * len;
    return <g key={`${y}${fromRight}`}><path d={`M${x0} ${y - 2.6} L${tip} ${y - 1.4} Q${tip + dir * 5} ${y} ${tip} ${y + 1.4} L${x0} ${y + 2.6} Z`} fill={iron} />
      {[0.15, 0.4, 0.65, 0.88].map(f => <circle key={f} cx={x0 + dir * len * f} cy={y} r={1.3} fill={stud} />)}</g>; };
  return <svg viewBox={half === 'left' ? `0 0 ${w / 2} ${h}` : half === 'right' ? `${w / 2} 0 ${w / 2} ${h}` : `0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true">
    <defs><clipPath id={id}><path d={arch} /></clipPath></defs>
    <g clipPath={`url(#${id})`}>
      <rect width={w} height={h} fill="#5c3a12" />
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x={(w / 6) * i} width={w / 6 - 0.8} height={h} fill={i % 2 ? '#6b4416' : '#62401a'} />)}
      {double && <rect x={w / 2 - 0.8} width="1.6" height={h} fill="#2a1a08" />}
      {bands.map(y => double ? [strap(y, false), strap(y, true)] : strap(y, false))}
      {!double && <><circle cx={w * 0.76} cy={h * 0.52} r={w * 0.08} fill="none" stroke={iron} strokeWidth="1.8" /><rect x={w * 0.73} y={h * 0.44} width={w * 0.06} height={h * 0.04} rx="1" fill={iron} /></>}
      {double && <><circle cx={w * 0.43} cy={h * 0.52} r={w * 0.045} fill="none" stroke={iron} strokeWidth="1.8" /><circle cx={w * 0.57} cy={h * 0.52} r={w * 0.045} fill="none" stroke={iron} strokeWidth="1.8" /></>}
      {crest && <path d={`M${w / 2 - 7} ${h * 0.14} H${w / 2 + 7} V${h * 0.14 + 9} Q${w / 2 + 7} ${h * 0.14 + 15} ${w / 2} ${h * 0.14 + 18} Q${w / 2 - 7} ${h * 0.14 + 15} ${w / 2 - 7} ${h * 0.14 + 9} Z`} fill={crest} stroke="#fac775" strokeWidth="1.2" />}
    </g>
    <path d={arch} fill="none" stroke="#2a1a08" strokeWidth="2" />
  </svg>;
}
/** The stone arch around a door: dressed blocks (a dashed thick line over dark mortar), a keystone with a gem, a step. */
function ArchFrame({ w, h, gem, gold = false }: { w: number; h: number; gem: string; gold?: boolean }) {
  const t = 9, cl = `M${t / 2 + 1} ${h} V${h * 0.39} Q${t / 2 + 1} ${h * 0.12} ${w / 2} ${t / 2 + 1} Q${w - t / 2 - 1} ${h * 0.12} ${w - t / 2 - 1} ${h * 0.39} V${h}`;
  return <svg className="absolute inset-0" viewBox={`0 0 ${w} ${h + 6}`} width="100%" height="100%" aria-hidden="true">
    <path d={cl} fill="none" stroke="#1b1a18" strokeWidth={t + 2} />
    <path d={cl} fill="none" stroke={gold ? '#a8a294' : '#8f8b82'} strokeWidth={t} strokeDasharray="9 1.6" />
    <path d={`M${w / 2 - 7} 0 H${w / 2 + 7} L${w / 2 + 5} ${t + 7} H${w / 2 - 5} Z`} fill={gold ? '#ba7517' : '#a8a294'} stroke="#1b1a18" strokeWidth="1" />
    <rect x={w / 2 - 3.5} y="3" width="7" height="7" transform={`rotate(45 ${w / 2} 6.5)`} fill={gem} stroke="#2c2c2a" strokeWidth="1" />
    <rect x="-2" y={h} width={w + 4} height="6" fill="#4a4741" />
  </svg>;
}

export function Hall({ children, caption, tall = false }: { children: ReactNode; caption: string; tall?: boolean }) {
  return <div className={`tower-hall relative ${tall ? 'h-[300px]' : 'h-[330px]'} overflow-hidden rounded-3xl bg-[#232220]`}>
    <div className="absolute inset-x-0 bottom-0 h-16 bg-[#34322e]" aria-hidden="true" />
    {[12, 36, 60, 84].map(x => <span key={x} aria-hidden="true" className="absolute top-0 h-[264px] w-px bg-[#2f2d2a]" style={{ left: `${x}%` }} />)}
    <span className="tower-torch absolute bottom-[150px] left-5" aria-hidden="true" /><span className="tower-torch absolute bottom-[150px] right-5" aria-hidden="true" />
    {children}
    <p role="status" aria-live="polite" className="absolute inset-x-3 bottom-2 text-center text-xs font-medium text-[#f1efe8]">{caption}</p>
  </div>;
}

/** The great gate: tap and its two leaves swing inwards. */
export function TowerGate({ floor, onOpen }: { floor: number; onOpen: () => void }) {
  const [opening, setOpening] = useState(false), timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const open = () => { if (opening) return; setOpening(true); timer.current = window.setTimeout(onOpen, 1500); };
  return <Hall caption={opening ? '끼이익… 성문이 열려요' : '성문을 눌러 탑에 들어가요'}>
    <p className="absolute inset-x-0 top-3 text-center text-sm font-black tracking-wider text-[#fac775]">{PET_TOWER.name}{floor > 1 ? ` · ${floor}층부터` : ''}</p>
    <button type="button" onClick={open} aria-label="성문 열기" className={`tower-gate absolute left-1/2 top-10 h-[236px] w-[220px] -translate-x-1/2 ${opening ? 'is-open' : ''}`}>
      <ArchFrame w={220} h={230} gem="#fac775" gold />
      <span className="tower-gate-leaf is-left"><LeafArt w={196} h={212} half="left" double gold crest="#a32d2d" /></span>
      <span className="tower-gate-leaf is-right"><LeafArt w={196} h={212} half="right" double gold crest="#a32d2d" /></span>
    </button>
  </Hall>;
}

/** Floor 1: a lone chest in the dark; tapping opens it and the 견습 장비 rises out. */
export function TowerChest({ busy, loot, onOpen, onNext, job }: { busy: boolean; loot: { gear: string[]; potions: number } | null; onOpen: () => void; onNext: () => void; job?: PetJob | null }) {
  return <Hall caption={loot ? `${loot.gear.map(id => towerGearFor(id, job)?.name).join(', ')}${loot.potions ? ` · 물약 ${loot.potions}개` : ''}를 얻었어요!` : '어둠 속에 보물상자가 하나 놓여 있어요'}>
    {loot && <div className="absolute inset-x-0 top-10 flex justify-center"><div className="tower-loot flex items-end gap-4 text-4xl" aria-hidden="true">{loot.gear.map(id => <TowerGearIcon key={id} id={id} size={64} />)}{loot.potions > 0 && <span className="pb-1">🧪</span>}</div></div>}
    <button type="button" disabled={busy || Boolean(loot)} onClick={onOpen} aria-label="보물상자 열기" className={`absolute bottom-[30px] left-1/2 -translate-x-1/2 ${loot ? 'is-open' : 'tower-chest-idle'} tower-chest`}>
      <svg viewBox="0 0 120 89" width="132" height="98" className="block">
        <rect x="14" y="44" width="92" height="44" rx="5" fill="#854f0b" stroke="#412402" strokeWidth="2.5" />
        <rect x="14" y="56" width="92" height="7" fill="#ba7517" /><rect x="54" y="44" width="12" height="44" fill="#ba7517" />
        <rect x="52" y="54" width="16" height="13" rx="2" fill="#fac775" stroke="#633806" strokeWidth="1.5" />
        <g className="tower-chest-lid"><path d="M14 46 Q14 16 60 16 Q106 16 106 46 Z" fill="#a0620f" stroke="#412402" strokeWidth="2.5" /><rect x="54" y="18" width="12" height="28" fill="#ba7517" /></g>
      </svg>
    </button>
    {loot && <button type="button" onClick={onNext} className="absolute left-1/2 top-[118px] -translate-x-1/2 rounded-xl bg-[#fac775] px-4 py-1.5 text-xs font-black text-[#412402]">더 살펴보기 ›</button>}
  </Hall>;
}

/** Three doors (one great door on a boss floor). The chosen door swings open, then `onPick` starts what is behind it. */
export function TowerDoors({ floor, boss, busy, onPick }: { floor: number; boss: boolean; busy: boolean; onPick: (door: number) => Promise<boolean> }) {
  const [opened, setOpened] = useState<number | null>(null), timer = useRef<number>();
  useEffect(() => { setOpened(null); }, [floor]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const pick = (i: number) => { if (busy || opened !== null) return; setOpened(i); timer.current = window.setTimeout(async () => { if (!await onPick(i)) setOpened(null); }, 950); };
  const colors = doorsFor(floor), list = boss ? [0] : [0, 1, 2];
  return <Hall caption={opened !== null ? '문이 열려요…' : boss ? `${floor}층 · 보스의 문이에요. 각오는 됐나요?` : `${floor}층 · 세 개의 문 중 하나를 골라요`}>
    <p className="absolute inset-x-0 top-3 text-center text-sm font-black tracking-wider text-[#fac775]">{floor}층</p>
    <div className="absolute inset-x-0 bottom-[56px] flex items-end justify-center gap-4">
      {list.map(i => { const c = boss ? { crest: '#412402', gem: '#fac775' } : colors[i], w = boss ? 128 : 80, h = boss ? 182 : 146;
        return <button key={i} type="button" disabled={busy} onClick={() => pick(i)} aria-label={boss ? '보스의 문 열기' : `${i + 1}번 문 열기`}
          className={`tower-door ${opened === i ? 'is-open' : opened !== null ? 'opacity-30' : 'hover:-translate-y-1'} transition-all`} style={{ width: w, height: h }}>
          <span className="tower-door-dark" aria-hidden="true" />
          {boss ? <><span className="tower-door-leaf is-left"><LeafArt w={w - 20} h={h - 12} half="left" double gold crest="#2c2c2a" /></span><span className="tower-door-leaf is-right"><LeafArt w={w - 20} h={h - 12} half="right" double gold crest="#2c2c2a" /></span></>
            : <span className="tower-door-leaf is-single"><LeafArt w={w - 20} h={h - 12} crest={c.crest} /></span>}
          <ArchFrame w={w} h={h - 6} gem={c.gem} gold={boss} />
        </button>; })}
    </div>
  </Hall>;
}
