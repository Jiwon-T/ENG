import { useEffect, useRef, useState } from 'react';
import { Hall } from './TowerHall';
import { ListenButton } from './StageQuestion';

// 채움의 탑 쉬어 가기 놀이 (문 뒤 이벤트): the browser side of api/_lib/towerGames. The server keeps the secrets and judges;
// these screens show what it sends (`game`) and send the moves.
type Send = (move: string, input?: Record<string, unknown>) => Promise<any>;
export interface MiniGameView { type: string; title: string; game: any }

/** 미믹 상자: three chests, one a mimic. One of them seems to breathe… usually the mimic. */
function Mimic({ title, game, busy, send }: { title: string; game: { chests: number; breath: number }; busy: boolean; send: Send }) {
  return <div className="space-y-2">
    <Hall caption={`${title} · 셋 중 하나는 미믹! 어느 상자를 열까요?`}>
      <div className="absolute inset-x-0 top-16 flex justify-center gap-2">{Array.from({ length: game.chests }, (_, i) => {
        const odd = i === game.breath;
        return <button key={i} type="button" disabled={busy} onClick={() => void send('open', { chest: i })} aria-label={`${i + 1}번 상자 열기`} className="rounded-xl transition-transform hover:-translate-y-1 disabled:opacity-60">
          <svg viewBox="0 0 60 52" width="68" className={odd ? 'dx-bob' : ''} aria-hidden="true">
            <rect x="4" y="20" width="52" height="28" rx="4" fill="#92400e" stroke="#451a03" strokeWidth="2" /><path d="M4 22 Q4 6 30 6 Q56 6 56 22Z" fill="#b45309" stroke="#451a03" strokeWidth="2" />
            <rect x="26" y="18" width="8" height="10" rx="2" fill="#fbbf24" stroke="#451a03" /><path d="M4 30 H56" stroke="#fbbf24" strokeWidth="2" /><path d="M10 12 Q30 4 50 12" stroke="#d97706" strokeWidth="1.2" fill="none" />
            {odd && <><circle className="bx-eye" cx="20" cy="14" r="1.6" fill="#fde047" /><circle className="bx-eye" cx="40" cy="14" r="1.6" fill="#fde047" /></>}
          </svg>
        </button>;
      })}</div>
      <p className="absolute inset-x-0 top-[150px] text-center text-[11px] text-[#e7e5e4]">자세히 보면… 하나는 숨을 쉬는 것 같기도 해요</p>
    </Hall>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">진짜 상자면 강화석, 미믹이면 물약 하나를 뺏겨요. 어느 쪽이든 이 층은 지나가요.</p>
  </div>;
}

/** 점쟁이 카드: three cards face down — one lucky, one plain, one unlucky. */
function Fortune({ title, busy, send }: { title: string; busy: boolean; send: Send }) {
  return <div className="space-y-2">
    <Hall caption={`${title} · 마음이 끌리는 카드 한 장을 골라요`}>
      <div className="absolute inset-x-0 top-6 flex justify-center"><span className="text-4xl" aria-hidden="true">🔮</span></div>
      <div className="absolute inset-x-0 top-20 flex justify-center gap-4">{[0, 1, 2].map(i => <button key={i} type="button" disabled={busy} onClick={() => void send('pick', { card: i })} aria-label={`${i + 1}번 카드`} className="rounded-xl transition-transform hover:-translate-y-1 disabled:opacity-60">
        <svg viewBox="0 0 44 64" width="62" aria-hidden="true"><rect x="2" y="2" width="40" height="60" rx="6" fill="#3b0764" stroke="#fde68a" strokeWidth="2" /><rect x="7" y="7" width="30" height="50" rx="4" fill="none" stroke="#a78bfa" strokeWidth="1" /><path d="M22 18 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#fde68a" /><circle className="bx-eye" style={{ animationDelay: `${i * .5}s` }} cx="22" cy="46" r="3" fill="#c4b5fd" /></svg>
      </button>)}</div>
    </Hall>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">🌟 행운: 강화석 2개 · 🌙 보통: 물약 1개 · 🌑 불운: 다음 전투 체력 -10%. 어느 카드든 이 층은 지나가요.</p>
  </div>;
}

/** 연잎 점프: a lily pad drifts back and forth; jump when it is right in front of you. Three hops (faster each time); a miss is a splash. */
function Lilypad({ title, busy, send }: { title: string; busy: boolean; send: Send }) {
  const [made, setMade] = useState(0), [splash, setSplash] = useState(false), start = useRef(Date.now()), sent = useRef(false);
  const ms = [1600, 1250, 950][Math.min(made, 2)], // one way across (back and forth: twice that)
    at = () => { const p = ((Date.now() - start.current) / ms) % 2; return p < 1 ? p : 2 - p; };
  const finish = (n: number) => { if (sent.current) return; sent.current = true; window.setTimeout(() => void send('hop', { made: n }), 700); };
  const jump = () => {
    if (busy || splash || sent.current) return;
    if (Math.abs(at() - 0.5) <= 0.12) { const n = made + 1; setMade(n); start.current = Date.now(); if (n === 3) finish(3); }
    else { setSplash(true); finish(made); }
  };
  return <div className="space-y-2">
    <Hall caption={`${title} · 연잎이 바로 앞에 올 때 점프! (${made}/3)`}>
      <div className="absolute inset-x-0 bottom-16 h-24 bg-[#14532d]"><div className="h-1 bg-[#86efac] opacity-40" /></div>
      <div className="absolute bottom-[150px] left-1/2 -translate-x-1/2 text-center"><span className="text-3xl" aria-hidden="true">{splash ? '💦' : made === 3 ? '🎉' : '🐸'}</span></div>
      <div className="absolute bottom-[120px] left-1/2 h-1 w-14 -translate-x-1/2 rounded bg-[#fde68a]/70" aria-hidden="true" />
      {made < 3 && !splash && <div key={made} className="absolute bottom-[92px] left-[10%] right-[10%]" aria-hidden="true">
        <div className="lily-drift absolute bottom-0" style={{ animation: `lily-drift ${ms}ms linear infinite alternate` }}><svg viewBox="0 0 60 24" width="64"><ellipse cx="30" cy="12" rx="28" ry="10" fill="#4ade80" stroke="#166534" strokeWidth="1.6" /><path d="M30 12 L54 6" stroke="#166534" strokeWidth="1.4" /><circle cx="18" cy="10" r="3" fill="#fbcfe8" /></svg></div>
      </div>}
      <style>{'@keyframes lily-drift{from{left:0}to{left:calc(100% - 64px)}}@media (prefers-reduced-motion:reduce){.lily-drift{animation-duration:3000ms!important}}'}</style>
    </Hall>
    <button type="button" disabled={busy || splash || made === 3} onClick={jump} className="w-full rounded-xl bg-[#4ade80] py-3 text-sm font-black text-[#14532d] disabled:opacity-50">점프!</button>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">세 번 건너면 물약 하나. 빠지면 💧 물에 젖은 채(방어 -15%) 다음 전투를 시작해요. 이 층은 지나가요.</p>
  </div>;
}

/** 버섯 징검다리: a meaning, three word mushrooms — step on the right one, three times. */
function Mushrooms({ title, game, busy, send }: { title: string; game: { step: number; steps: number; prompt: string; choices: string[] }; busy: boolean; send: Send }) {
  const caps = ['#ef4444', '#f97316', '#a855f7'];
  return <div className="space-y-2">
    <Hall caption={`${title} · 뜻: ${game.prompt} — 맞는 단어 버섯을 밟아요 (${game.step + 1}/${game.steps})`}>
      <div className="absolute inset-x-0 bottom-16 h-20 bg-[#1e3a5f]"><div className="h-1 bg-[#7dd3fc] opacity-40" /></div>
      <div className="absolute bottom-[104px] left-1" style={{ transform: `translateX(${game.step * 6}px)` }}><span className="text-3xl" aria-hidden="true">🐾</span></div>
      <div className="absolute inset-x-10 bottom-[84px] flex justify-around">{game.choices.map((w, i) => <button key={`${game.step}-${i}`} type="button" disabled={busy} onClick={() => void send('step', { choice: i })} className="flex flex-col items-center transition-transform hover:-translate-y-1 disabled:opacity-60">
        <svg viewBox="0 0 60 40" width="58" aria-hidden="true"><path d="M4 22 Q6 2 30 2 Q54 2 56 22Z" fill={caps[i % 3]} stroke="#7f1d1d" strokeWidth="1.4" /><circle cx="18" cy="12" r="3" fill="#fff" /><circle cx="38" cy="9" r="4" fill="#fff" /><rect x="22" y="22" width="16" height="16" rx="5" fill="#fef3c7" stroke="#a16207" /></svg>
        <span className="-mt-1 rounded-lg bg-white px-2 py-0.5 text-xs font-black text-[#26215c]">{w}</span></button>)}</div>
      <div className="absolute inset-x-0 top-4 flex justify-center gap-1.5" aria-hidden="true">{Array.from({ length: game.steps }, (_, i) => <span key={i} className={`h-2 w-6 rounded-full ${i < game.step ? 'bg-[#4ade80]' : 'bg-white/25'}`} />)}</div>
    </Hall>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">세 번 모두 맞히면 물약 하나. 틀리면 풍덩 빠지지만 이 층은 지나가요 (틀린 단어는 오답 복습으로).</p>
  </div>;
}

/** 메아리 동굴: a word echoes in the cave (heard, not shown) — pick its meaning, three times. */
function Echo({ title, game, busy, send }: { title: string; game: { step: number; steps: number; word: string; choices: string[] }; busy: boolean; send: Send }) {
  return <div className="space-y-2">
    <Hall caption={`${title} · 들리는 단어의 뜻을 골라요 (${game.step + 1}/${game.steps})`}>
      <div className="absolute inset-x-0 top-6 flex justify-center gap-1.5" aria-hidden="true">{Array.from({ length: game.steps }, (_, i) => <span key={i} className={`h-2 w-6 rounded-full ${i < game.step ? 'bg-[#a78bfa]' : 'bg-white/25'}`} />)}</div>
      <div className="absolute inset-x-0 top-16 flex flex-col items-center gap-2">
        <div className="relative flex h-24 w-24 items-center justify-center" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} className="pg-pulse absolute rounded-full border-2 border-[#c4b5fd]" style={{ width: 40 + i * 24, height: 40 + i * 24, animationDelay: `${i * .4}s` }} />)}<span className="text-3xl">🔊</span></div>
        <div key={game.step}><ListenButton word={game.word} revealed={false} /></div>
      </div>
    </Hall>
    <div className="grid grid-cols-2 gap-2">{game.choices.map((c, i) => <button key={`${game.step}-${i}`} type="button" disabled={busy} onClick={() => void send('step', { choice: i })} className="min-h-[44px] rounded-xl border border-[#d6d2ee] bg-white px-2 py-2 text-sm font-bold text-[#26215c] hover:bg-[#f5f4fd]">{c}</button>)}</div>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">세 번 모두 맞히면 강화석 하나. 틀리면 동굴을 빠져나와 다음 층으로 가요 (틀린 단어는 오답 복습으로).</p>
  </div>;
}

/** 수정 불빛 퍼즐: a press flips the crystal and its neighbours (up, down, left, right). Light all nine within the presses given. */
const flip = (cells: boolean[], i: number) => { const r = Math.floor(i / 3), c = i % 3; return cells.map((v, k) => { const kr = Math.floor(k / 3), kc = k % 3; return Math.abs(kr - r) + Math.abs(kc - c) <= 1 ? !v : v; }); };
function Crystals({ title, game, busy, send }: { title: string; game: { cells: boolean[]; limit: number }; busy: boolean; send: Send }) {
  const [cells, setCells] = useState(game.cells), [presses, setPresses] = useState<number[]>([]), sent = useRef(false);
  const done = (list: number[]) => { if (sent.current) return; sent.current = true; window.setTimeout(() => void send('solve', { presses: list }), 600); };
  const press = (i: number) => {
    if (busy || sent.current) return;
    const next = flip(cells, i), list = [...presses, i]; setCells(next); setPresses(list);
    if (next.every(Boolean) || list.length >= game.limit) done(list);
  };
  return <div className="space-y-2">
    <Hall caption={`${title} · 누르면 이웃 수정도 바뀌어요 · ${cells.filter(Boolean).length}/9 켜짐 · 남은 횟수 ${game.limit - presses.length}`}>
      <div className="absolute inset-x-0 top-6 mx-auto grid w-52 grid-cols-3 gap-2">{cells.map((on, i) => <button key={i} type="button" disabled={busy} onClick={() => press(i)} aria-label={`수정 ${i + 1} ${on ? '켜짐' : '꺼짐'}`} className="flex justify-center">
        <svg viewBox="0 0 40 48" width="54" aria-hidden="true"><g opacity={on ? .5 : 0}><circle className="pg-pulse" cx="20" cy="22" r="18" fill="#c4b5fd" /></g><path d="M20 2 L34 20 L20 44 L6 20Z" fill={on ? '#c4b5fd' : '#3f3f46'} stroke={on ? '#6d28d9' : '#18181b'} strokeWidth="2" /><path d="M20 2 L34 20 L20 22Z" fill={on ? '#ede9fe' : '#52525b'} /></svg>
      </button>)}</div>
    </Hall>
    <button type="button" disabled={busy || sent.current} onClick={() => done(presses)} className="w-full rounded-xl border border-[#d6d2ee] bg-white py-2 text-xs font-bold text-slate-500">그만하고 지나가기</button>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">9개를 모두 켜면 강화석 하나. 못 켜도 이 층은 지나가요.</p>
  </div>;
}

/** 신전 미로: walk from the top-left to the exit; snakes lie in two dead ends. Arrows (or the keyboard) move one cell. */
const STEP: Record<string, [number, number, number]> = { U: [-1, 0, 1], R: [0, 1, 2], D: [1, 0, 4], L: [0, -1, 8] };
const ARROWS: Record<string, string> = { ArrowUp: 'U', ArrowRight: 'R', ArrowDown: 'D', ArrowLeft: 'L' };
const PADS: [string, string, string][] = [['', '', ''], ['U', '⬆️', '위'], ['', '', ''], ['L', '⬅️', '왼쪽'], ['D', '⬇️', '아래'], ['R', '➡️', '오른쪽']];
function Maze({ title, game, busy, send }: { title: string; game: { size: number; walls: number[]; traps: number[] }; busy: boolean; send: Send }) {
  const n = game.size, exit = n * n - 1, [path, setPath] = useState<string[]>([]), [at, setAt] = useState(0), sent = useRef(false);
  const walk = (dir: string) => {
    if (busy || sent.current) return;
    const [dr, dc, wall] = STEP[dir], r = Math.floor(at / n) + dr, c = at % n + dc;
    if (game.walls[at] & wall || r < 0 || r >= n || c < 0 || c >= n) return;
    const to = r * n + c, list = [...path, dir]; setAt(to); setPath(list);
    if (to === exit || game.traps.includes(to)) { sent.current = true; window.setTimeout(() => void send('walk', { path: list }), 500); }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const d = ARROWS[e.key]; if (d) { e.preventDefault(); walk(d); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  const edge = (on: boolean) => on ? '3px solid #78350f' : '1px solid #fde68a40';
  return <div className="space-y-2">
    <Hall caption={`${title} · 뱀을 피해 출구🚪까지 · ${path.length}걸음`}>
      <div className="absolute inset-x-0 top-5 mx-auto grid w-[220px] rounded-md bg-[#fef3c7]" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>{game.walls.map((w, i) => <div key={i} className="flex h-11 items-center justify-center text-xl"
        style={{ borderTop: edge(Boolean(w & 1)), borderRight: edge(Boolean(w & 2)), borderBottom: edge(Boolean(w & 4)), borderLeft: edge(Boolean(w & 8)) }}>{i === at ? '🐾' : game.traps.includes(i) ? '🐍' : i === exit ? '🚪' : ''}</div>)}</div>
    </Hall>
    <div className="mx-auto grid w-40 grid-cols-3 gap-1.5 text-lg">{PADS.map(([d, icon, label], i) => d ? <button key={i} type="button" disabled={busy} onClick={() => walk(d)} aria-label={label} className="rounded-xl border border-[#d6d2ee] bg-white py-1.5">{icon}</button> : <span key={i} />)}</div>
    <button type="button" disabled={busy || sent.current} onClick={() => { sent.current = true; void send('walk', { path }); }} className="w-full rounded-xl border border-[#d6d2ee] bg-white py-2 text-xs font-bold text-slate-500">그만하고 지나가기</button>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">출구까지 가면 강화석 하나. 뱀을 밟거나 그만둬도 이 층은 지나가요.</p>
  </div>;
}

/** 황금 저울: nine coins, one a lighter fake. Put coins on each pan (same number) and weigh — twice — then point to the fake. */
type Pan = 'left' | 'right' | null;
function Scale({ title, game, busy, send }: { title: string; game: { coins: number; history: { left: number[]; right: number[]; heavier: 'left' | 'right' | 'even' }[]; left: number }; busy: boolean; send: Send }) {
  const [pans, setPans] = useState<Pan[]>(() => Array(game.coins).fill(null)), [guessing, setGuessing] = useState(false);
  const last = game.history[game.history.length - 1], tilt = !last ? 0 : last.heavier === 'left' ? -8 : last.heavier === 'right' ? 8 : 0;
  const on = (p: Pan) => pans.map((x, i) => x === p ? i : -1).filter(i => i >= 0), L = on('left'), R = on('right');
  const tap = (i: number) => {
    if (busy) return;
    if (guessing || game.left === 0) { void send('guess', { coin: i }); return; }
    setPans(list => list.map((x, k) => k !== i ? x : x === null ? 'left' : x === 'left' ? 'right' : null));
  };
  const weigh = async () => { await send('weigh', { left: L, right: R }); setPans(Array(game.coins).fill(null)); };
  const says = (h: typeof last) => h.heavier === 'even' ? '평평해요' : `${h.heavier === 'left' ? '왼쪽' : '오른쪽'}이 무거워요`;
  const coinRow = (list: number[]) => list.map(i => <circle key={i} cx={0} cy={0} r="5" fill="#fde047" stroke="#a16207" />);
  return <div className="space-y-2">
    <Hall caption={`${title} · 가벼운 가짜 금화 하나 · 남은 저울질 ${game.left}번`}>
      <svg className="absolute left-1/2 top-4 -translate-x-1/2" viewBox="0 0 200 130" width="230" aria-hidden="true">
        <path d="M100 22 V118 M70 124 H130" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '100px 28px', transition: 'transform .6s' }}>
          <path d="M30 28 H170" stroke="#ca8a04" strokeWidth="4" /><path d="M30 28 L16 66 H44Z M170 28 L156 66 H184Z" fill="none" stroke="#ca8a04" strokeWidth="1.4" />
          <ellipse cx="30" cy="68" rx="20" ry="5" fill="#fbbf24" /><ellipse cx="170" cy="68" rx="20" ry="5" fill="#fbbf24" />
          {(last ? last.left : L).map((_, k) => <g key={`l${k}`} transform={`translate(${18 + (k % 3) * 12} ${60 - Math.floor(k / 3) * 9})`}>{coinRow([0])}</g>)}
          {(last ? last.right : R).map((_, k) => <g key={`r${k}`} transform={`translate(${158 + (k % 3) * 12} ${60 - Math.floor(k / 3) * 9})`}>{coinRow([0])}</g>)}
        </g><circle cx="100" cy="22" r="6" fill="#fde047" stroke="#a16207" strokeWidth="2" />
      </svg>
      {last && <p className="absolute inset-x-0 top-[160px] text-center text-xs font-bold text-[#fde68a]">⚖️ {says(last)}</p>}
      <div className="absolute inset-x-0 top-[190px] flex justify-center gap-0.5">{pans.map((p, i) => <button key={i} type="button" disabled={busy} onClick={() => tap(i)} aria-label={`${i + 1}번 금화`} className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-black ${guessing || game.left === 0 ? 'border-[#fca5a5] bg-[#fde047] text-[#713f12]' : p === 'left' ? 'border-[#2563eb] bg-[#fde047] text-[#1e3a8a]' : p === 'right' ? 'border-[#dc2626] bg-[#fde047] text-[#7f1d1d]' : 'border-[#a16207] bg-[#fef3c7] text-[#713f12]'}`}>{i + 1}</button>)}</div>
    </Hall>
    {game.history.length > 0 && <ul className="rounded-xl border border-[#e4e0f5] bg-white px-3 py-1.5 text-[11px] text-[#26215c]">{game.history.map((h, k) => <li key={k}>{k + 1}번째: {h.left.map(i => i + 1).join('·')} ⚖️ {h.right.map(i => i + 1).join('·')} → {says(h)}</li>)}</ul>}
    {guessing || game.left === 0 ? <p className="rounded-xl bg-[#fef9c3] px-3 py-2 text-center text-xs font-bold text-[#854d0e]">가짜라고 생각하는 금화를 눌러요</p>
      : <div className="grid grid-cols-2 gap-2 text-xs font-bold">
        <button type="button" disabled={busy || !L.length || L.length !== R.length} onClick={() => void weigh()} className="rounded-xl bg-[#fde047] py-2.5 text-[#713f12] disabled:opacity-50">저울에 달기 (왼쪽 {L.length} · 오른쪽 {R.length})</button>
        <button type="button" disabled={busy} onClick={() => setGuessing(true)} className="rounded-xl border border-[#d6d2ee] bg-white py-2.5 text-[#26215c]">가짜 고르기</button></div>}
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">금화를 한 번 누르면 왼쪽(파랑), 두 번 오른쪽(빨강) 접시에 올라가요. 양쪽 개수가 같아야 해요. 맞히면 강화석 2개, 틀려도 이 층은 지나가요.</p>
  </div>;
}

/** 짝 맞추기 항아리: eight jars hide four words and their meanings. Open two at a time; a pair stays open. */
function Jars({ title, game, busy, send }: { title: string; game: { jars: number; open: { i: number; text: string }[]; found: number; pairs: number; triesLeft: number }; busy: boolean; send: Send }) {
  const [first, setFirst] = useState<number | null>(null), [peek, setPeek] = useState<{ a: number; b: number; texts: string[]; match: boolean } | null>(null);
  const shown = (i: number) => game.open.find(o => o.i === i)?.text ?? (peek && (peek.a === i ? peek.texts[0] : peek.b === i ? peek.texts[1] : null)) ?? (first === i ? '…' : null);
  const tap = async (i: number) => {
    if (busy || peek || game.open.some(o => o.i === i)) return;
    if (first === null) { setFirst(i); return; }
    if (first === i) return;
    const a = first; setFirst(null);
    const r = await send('flip', { a, b: i }), p = r?.result?.game?.peek;
    if (p) { setPeek(p); window.setTimeout(() => setPeek(null), p.match ? 600 : 1300); }
  };
  return <div className="space-y-2">
    <Hall caption={`${title} · 찾은 짝 ${game.found}/${game.pairs} · 남은 기회 ${game.triesLeft}`}>
      <div className="absolute inset-x-4 top-6 grid grid-cols-4 gap-2">{Array.from({ length: game.jars }, (_, i) => { const text = shown(i), open = game.open.some(o => o.i === i);
        return <button key={i} type="button" disabled={busy} onClick={() => void tap(i)} className={`flex h-[72px] items-center justify-center rounded-2xl border-2 px-1 text-center text-[12px] font-black leading-tight ${text !== null && text !== '…' ? open || peek?.match ? 'border-[#639922] bg-[#eaf3de] text-[#27500a]' : 'border-[#d97706] bg-[#fffbeb] text-[#78350f]' : first === i ? 'border-[#fde68a] bg-[#f59e0b]' : 'border-[#b45309] bg-[#f59e0b]'}`}>
          {text !== null && text !== '…' ? text : <svg viewBox="0 0 40 48" width="30" aria-hidden="true"><path d="M12 4 h16 v6 Q36 16 34 30 Q32 44 20 44 Q8 44 6 30 Q4 16 12 10Z" fill="#c2410c" stroke="#7c2d12" strokeWidth="1.4" /><path d="M8 24 h24 M9 30 h22" stroke="#fde68a" strokeWidth="1.6" /></svg>}</button>; })}</div>
    </Hall>
    <p className="rounded-xl border-2 border-[#5f5e5a] bg-[#f1efe8] px-3 py-2 text-xs text-[#2c2c2a]">항아리 두 개를 열어 영어 단어와 그 뜻을 짝지어요. 4쌍을 다 찾으면 강화석과 물약! 기회가 끝나도 이 층은 지나가요.</p>
  </div>;
}

export function MiniGameScreen({ view, busy, send }: { view: MiniGameView; busy: boolean; send: Send }) {
  if (view.type === 'mimic') return <Mimic title={view.title} game={view.game} busy={busy} send={send} />;
  if (view.type === 'fortune') return <Fortune title={view.title} busy={busy} send={send} />;
  if (view.type === 'lilypad') return <Lilypad title={view.title} busy={busy} send={send} />;
  if (view.type === 'mushroom') return <Mushrooms title={view.title} game={view.game} busy={busy} send={send} />;
  if (view.type === 'echo') return <Echo title={view.title} game={view.game} busy={busy} send={send} />;
  if (view.type === 'crystal') return <Crystals title={view.title} game={view.game} busy={busy} send={send} />;
  if (view.type === 'maze') return <Maze title={view.title} game={view.game} busy={busy} send={send} />;
  if (view.type === 'scale') return <Scale title={view.title} game={view.game} busy={busy} send={send} />;
  if (view.type === 'jars') return <Jars title={view.title} game={view.game} busy={busy} send={send} />;
  return null;
}
