import type { TowerGearSlot } from '../../lib/petCatalog';
import { PLUS, PLUS_ORDER, plusBack, plusFx, plusSlot } from './petGearArtPlus';

// 장비 겹쳐 그리기: each worn place is drawn over the pet (120×130 grid), in its own tier's look — 견습 → 이끼 숲 → 수정 동굴 →
// 모래 신전 → 얼음 성채 → 마도사, more detail as it goes up; from 수정 동굴 the gems twinkle, then capes sway, snow falls and
// runes turn (.pg-* classes in index.css, stopped by 움직임 줄이기). 검사 and 마법사 look different; a pet without a job picks one.
// Markup only from these fixed numbers (no user text), drawn as SVG strings.
export type GearArtStyle = 'knight' | 'mage';
export type GearLook = Partial<Record<TowerGearSlot, number>>;

const TIERS = [
  { main: '#c8935c', dark: '#7a4a22', trim: '#a16207' },
  { main: '#7aa83f', dark: '#3f6212', trim: '#a3e635' },
  { main: '#d6dde8', dark: '#475569', trim: '#a78bfa' },
  { main: '#f2c14e', dark: '#92400e', trim: '#fff1b8' },
  { main: '#dbeafe', dark: '#1e40af', trim: '#7dd3fc' },
  { main: '#3b2a5c', dark: '#140b26', trim: '#facc15' },
];
// 6~10단계 (화염 · 심해 · 천공 · 성운 · 용왕) are drawn in petGearArtPlus; their colours here for the set glow.
TIERS.push(...PLUS_ORDER.map(i => ({ main: PLUS[i].main, dark: PLUS[i].dark, trim: PLUS[i].trim })));
const r1 = (n: number) => String(Math.round(n * 10) / 10);
function star(cx: number, cy: number, r: number, fill: string) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 === 0 ? r : r * .45; pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`); }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="none" stroke-width=".6"/>`;
}
const RAYS = (cx: number, cy: number, n: number, stroke: string, w: number) => [[0, -n], [0, n], [-n, 0], [n, 0], [n * .7, n * .7], [-n * .7, n * .7], [n * .7, -n * .7], [-n * .7, -n * .7]].map(([x, y]) => `<path d="M${cx} ${cy} l${r1(x)} ${r1(y)}" stroke="${stroke}" stroke-width="${w}"/>`).join('');

// ── 검사 ──
const knight = {
  cape(L: number) {
    if (L < 3) return '';
    const { dark: d } = TIERS[L], cape = L === 3 ? '#b91c1c' : L === 4 ? '#1e3a8a' : '#4c1d95';
    return `<path class="pg-sway" d="M38 86 Q60 80 82 86 L92 124 Q60 132 28 124Z" fill="${cape}" stroke="${d}" stroke-width="1"/>`;
  },
  boots(L: number) {
    const { dark: d, trim: tr } = TIERS[L];
    return `<ellipse cx="47" cy="121" rx="9.5" ry="5.8" fill="${d}"/><ellipse cx="73" cy="121" rx="9.5" ry="5.8" fill="${d}"/>` + (L >= 2 ? `<path d="M40 119 h14 M66 119 h14" stroke="${tr}" stroke-width="1.4"/>` : '');
  },
  armor(L: number) {
    const { main: m, dark: d, trim: tr } = TIERS[L], g: string[] = [];
    g.push(`<path d="M38 90 Q60 82 82 90 L84 111 Q60 121 36 111Z" fill="${m}" stroke="${d}" stroke-width="1.6"/>`);
    if (L === 0) g.push(`<path d="M44 92 v16 M52 89 v22 M60 88 v24 M68 89 v22 M76 92 v16" stroke="${d}" stroke-width=".8" stroke-dasharray="2 2"/>`);
    if (L === 1) g.push(`<path d="M60 92 q-7 4 -3 12 q7 -4 3 -12z" fill="${tr}" stroke="${d}" stroke-width=".7"/><path d="M60 92 v12" stroke="${d}" stroke-width=".6"/>`);
    if (L >= 2) g.push(`<path d="M60 86 V117" stroke="${d}" stroke-width="1.2" opacity=".6"/><path d="M40 101 Q60 95 80 101" stroke="${d}" stroke-width="1" fill="none" opacity=".5"/>`);
    if (L === 2) g.push('<path class="pg-tw" d="M60 96 l3.5 5 -3.5 5 -3.5 -5z" fill="#a78bfa" stroke="#6d28d9" stroke-width=".8"/>');
    if (L === 3) g.push(`<g class="pg-spin pg-slow"><circle cx="60" cy="100" r="5" fill="${tr}" stroke="${d}" stroke-width=".8"/>${RAYS(60, 100, 8, d, .9)}</g>`);
    if (L === 4) g.push(`<path d="M60 93 v14 M53 96 l14 8 M53 104 l14 -8" stroke="${d}" stroke-width="1.3"/><path d="M38 90 Q60 82 82 90" stroke="#fff" stroke-width="3" fill="none" opacity=".85"/>`);
    if (L === 5) g.push(`<path d="M48 94 q12 -6 24 0 M46 104 q14 6 28 0" stroke="${tr}" stroke-width="1" fill="none"/>${star(60, 99, 5.5, tr)}<circle class="pg-pulse" cx="60" cy="99" r="9" fill="#a78bfa" opacity=".25"/><circle class="pg-spin" cx="60" cy="99" r="12" fill="none" stroke="#facc15" stroke-width=".7" stroke-dasharray="3 2.5"/>`);
    if (L >= 3) g.push(`<path d="M37 111 Q60 121 83 111" stroke="${tr}" stroke-width="1.8" fill="none"/>`);
    return g.join('');
  },
  shoulder(L: number) {
    const { main: m, dark: d, trim: tr } = TIERS[L], pr = 8 + L * .8;
    return `<ellipse cx="36" cy="90" rx="${r1(pr + 2)}" ry="${r1(pr * .7)}" fill="${m}" stroke="${d}" stroke-width="1.4"/><ellipse cx="84" cy="90" rx="${r1(pr + 2)}" ry="${r1(pr * .7)}" fill="${m}" stroke="${d}" stroke-width="1.4"/>`
      + (L >= 2 ? `<path d="M28 90 Q36 86 44 90 M76 90 Q84 86 92 90" stroke="${tr}" stroke-width="1.2" fill="none"/>` : '')
      + (L >= 4 ? `<path d="M30 85 l-4 -8 7 5 M90 85 l4 -8 -7 5" fill="${tr}" stroke="${d}" stroke-width=".8"/>` : '');
  },
  glove(L: number, x: number) { const d = TIERS[L].dark; return `<ellipse cx="${x}" cy="104" rx="7" ry="6.5" fill="${d}" stroke="${d}"/>`; },
  weapon(L: number) {
    const { dark: d, trim: tr } = TIERS[L];
    if (L === 0) return '<path d="M93 104 Q96 70 106 50 Q112 48 110 56 Q102 76 99 106Z" fill="#d6a46c" stroke="#7a4a22" stroke-width="1.2"/>';
    const blade = L < 5 ? '#f1f5f9' : '#1f1534', edge = L < 5 ? d : tr, top = 50 - L * 2, g: string[] = [];
    g.push(`<path d="M95 106 L${r1(109 - L * .4)} ${top} L${r1(113 + L * .3)} ${top + 1} L99 107Z" fill="${blade}" stroke="${edge}" stroke-width="1.3"/>`);
    if (L >= 3) g.push(`<path d="M98 100 L110.5 ${top + 6}" stroke="${tr}" stroke-width="1" opacity=".9"/>`);
    if (L === 4) g.push(`<circle class="pg-pulse" cx="111" cy="${top + 4}" r="5" fill="#bae6fd" opacity=".45"/>`);
    if (L === 5) g.push(`<circle class="pg-pulse" cx="109" cy="${top + 16}" r="9" fill="#a78bfa" opacity=".3"/>`);
    g.push(`<rect x="87" y="101" width="${17 + L}" height="4.5" rx="1.5" transform="rotate(-14 96 103)" fill="${L >= 2 ? tr : d}" stroke="${d}" stroke-width=".8"/>`);
    return g.join('');
  },
  helmet(L: number) {
    const { main: m, dark: d, trim: tr } = TIERS[L];
    if (L === 0) return `<path d="M30 50 Q30 24 60 22 Q90 24 90 50 Q60 40 30 50Z" fill="${m}" stroke="${d}" stroke-width="1.5"/><path d="M34 44 Q60 36 86 44" stroke="${d}" stroke-width=".8" stroke-dasharray="2 2" fill="none"/>`;
    const g = [`<path d="M30 54 Q29 20 60 17 Q91 20 90 54 L84 54 Q83 31 60 29 Q37 31 36 54Z" fill="${m}" stroke="${d}" stroke-width="1.6"/>`,
      `<path d="M31 42 Q60 34 89 42 L89 47 Q60 39 31 47Z" fill="${L >= 3 ? tr : d}" stroke="${d}" stroke-width="1" opacity="${L >= 3 ? 1 : .55}"/>`];
    if (L === 1) g.push(`<path d="M60 17 q-8 -8 -2 -14 q8 6 2 14z" fill="${tr}" stroke="${d}" stroke-width=".7"/>`);
    if (L === 2) g.push('<path d="M60 17 Q65 4 78 6 Q69 10 64 19Z" fill="#e0587a"/><path class="pg-tw pg-d2" d="M60 21 l3.5 4.5 -3.5 4.5 -3.5 -4.5z" fill="#a78bfa" stroke="#6d28d9" stroke-width=".8"/>');
    if (L === 3) g.push(`<path d="M48 20 L52 8 L56 18 L60 4 L64 18 L68 8 L72 20Z" fill="${m}" stroke="${d}" stroke-width="1"/><circle cx="60" cy="24" r="2.6" fill="#ef4444" stroke="${d}" stroke-width=".6"/>`);
    if (L === 4) g.push(`<path d="M44 22 l-3 -12 7 9 M76 22 l3 -12 -7 9 M60 17 l0 -12 3 9 -3 0" fill="${tr}" stroke="${d}" stroke-width=".8"/><path d="M60 22 l2.5 3 -2.5 3 -2.5 -3z" fill="#7dd3fc"/>`);
    if (L === 5) g.push(`<path d="M36 30 Q22 18 26 4 Q32 18 44 24Z M84 30 Q98 18 94 4 Q88 18 76 24Z" fill="#1f1534" stroke="${tr}" stroke-width="1"/>${star(60, 24, 4, tr)}<path d="M36 48 Q60 40 84 48" stroke="#c084fc" stroke-width="1.4" fill="none" opacity=".8"/>`);
    return g.join('');
  },
};

// ── 마법사 ──
const ROBE = ['#b7a58f', '#4d7c0f', '#7c3aed', '#c2410c', '#2563eb', '#1f1534'], HAT = ['#a68a6d', '#4d7c0f', '#6d28d9', '#9a3412', '#1e3a8a', '#140b26'];
const mage = {
  cape(L: number) { return L >= 3 ? `<path class="pg-sway" d="M38 86 Q60 80 82 86 L94 126 Q60 134 26 126Z" fill="${TIERS[L].dark}" opacity=".9"/>` : ''; },
  boots(L: number) { const d = TIERS[L].dark; return `<ellipse cx="47" cy="122" rx="9" ry="5.5" fill="${d}"/><ellipse cx="73" cy="122" rx="9" ry="5.5" fill="${d}"/>`; },
  weapon(L: number) {
    const g = [`<rect x="18" y="${44 - L}" width="4.5" height="${78 + L}" rx="2" transform="rotate(-6 20 80)" fill="${L < 5 ? '#92400e' : '#2a1d45'}" stroke="#451a03" stroke-width=".8"/>`];
    if (L === 0) g.push('<circle cx="17" cy="44" r="4" fill="#a16207"/>');
    if (L === 1) g.push('<path d="M15 46 q8 6 2 14 q-8 6 -2 14" stroke="#65a30d" stroke-width="1.6" fill="none"/><path d="M17 40 q-7 -4 -4 -10 q7 3 4 10z" fill="#a3e635" stroke="#3f6212" stroke-width=".7"/>');
    if (L === 2) g.push('<circle class="pg-pulse" cx="16" cy="40" r="11" fill="#ede9fe" opacity=".7"/><circle cx="16" cy="40" r="7.5" fill="#c4b5fd" stroke="#6d28d9" stroke-width="1.4"/><circle cx="14" cy="38" r="2" fill="#fff"/>');
    if (L === 3) g.push(`<g class="pg-spin pg-slow">${RAYS(16, 38, 13, '#f59e0b', 1.4)}</g><circle cx="16" cy="38" r="8" fill="#fde047" stroke="#b45309" stroke-width="1.2"/>`);
    if (L === 4) g.push('<path d="M16 24 L22 36 L16 50 L10 36Z" fill="#bae6fd" stroke="#1e40af" stroke-width="1.2"/><path d="M16 24 v26" stroke="#fff" stroke-width=".8"/><circle class="pg-pulse" cx="16" cy="37" r="13" fill="#e0f2fe" opacity=".45"/>');
    if (L === 5) g.push('<circle class="pg-pulse" cx="16" cy="34" r="14" fill="#a78bfa" opacity=".3"/><circle cx="16" cy="34" r="8" fill="#1f1534" stroke="#facc15" stroke-width="1.4"/><circle cx="16" cy="34" r="3.5" fill="#c084fc"/><circle class="pg-spin" cx="16" cy="34" r="11.5" fill="none" stroke="#facc15" stroke-width=".7" stroke-dasharray="2 2"/>');
    return g.join('');
  },
  armor(L: number) {
    const { dark: d, trim: tr } = TIERS[L], g = [`<path d="M36 90 Q60 80 84 90 L90 118 Q60 129 30 118Z" fill="${ROBE[L]}" stroke="${d}" stroke-width="1.6"/>`];
    if (L >= 1) g.push(`<path d="M30 118 Q60 129 90 118" fill="none" stroke="${tr}" stroke-width="${r1(1.4 + L * .3)}"/><path d="M60 84 V125" stroke="${tr}" stroke-width="1.4"/>`);
    if (L === 0) g.push('<path d="M38 104 h44" stroke="#7a4a22" stroke-width="2.4"/>');
    if (L >= 2) g.push(`<circle cx="60" cy="97" r="${r1(3 + L * .4)}" fill="${tr}"/>`);
    if (L === 4) g.push('<path d="M38 90 Q60 82 82 90 Q60 92 38 90Z" fill="#fff" opacity=".95"/>');
    if (L === 5) g.push(`<path d="M42 108 q4 -4 8 0 q4 4 8 0 M62 108 q4 -4 8 0 q4 4 8 0" stroke="${tr}" stroke-width=".9" fill="none"/>`);
    return g.join('');
  },
  shoulder(L: number) {
    const { main: m, dark: d, trim: tr } = TIERS[L], pr = 7 + L * .7, f = L ? m : '#a68a6d';
    return `<ellipse cx="37" cy="89" rx="${r1(pr + 1)}" ry="${r1(pr * .68)}" fill="${f}" stroke="${d}" stroke-width="1.3"/><ellipse cx="83" cy="89" rx="${r1(pr + 1)}" ry="${r1(pr * .68)}" fill="${f}" stroke="${d}" stroke-width="1.3"/>`
      + (L >= 3 ? `<path d="M33 88 l2 2 2 -2 M79 88 l2 2 2 -2" stroke="${tr}" stroke-width="1" fill="none"/>` : '');
  },
  gloves(L: number) { const { main: m, dark: d } = TIERS[L]; return `<ellipse cx="34" cy="104" rx="6.5" ry="6" fill="${m}" stroke="${d}"/><ellipse cx="86" cy="104" rx="6.5" ry="6" fill="${m}" stroke="${d}"/>`; },
  helmet(L: number) {
    const { dark: d, trim: tr } = TIERS[L], hat = HAT[L];
    if (L === 0) return `<path d="M28 58 Q26 18 60 16 Q94 18 92 58 L86 58 Q84 30 60 28 Q36 30 34 58Z" fill="${hat}" stroke="#7a4a22" stroke-width="1.5"/>`;
    const g = [`<ellipse cx="60" cy="37" rx="${r1(33 + L * 1.6)}" ry="7.5" fill="${hat}" stroke="${d}" stroke-width="1.4"/>`,
      `<path d="M38 36 Q50 16 ${57 + L} ${4 - L} Q63 14 82 36Z" fill="${hat}" stroke="${d}" stroke-width="1.4"/>`,
      `<path d="M39 32 Q60 27 81 32 L82 36 Q60 31 38 36Z" fill="${tr}"/>`];
    if (L === 1) g.push('<path d="M70 30 q8 -6 12 -2 q-6 6 -12 2z" fill="#a3e635" stroke="#3f6212" stroke-width=".7"/>');
    if (L === 2) g.push(star(66, 20, 3.5, '#fde68a'));
    if (L === 3) g.push(`<circle cx="60" cy="33" r="3" fill="#ef4444" stroke="#7f1d1d" stroke-width=".6"/>${star(56, 14, 2.6, '#fde68a')}`);
    if (L === 4) g.push('<path d="M30 38 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0" stroke="#fff" stroke-width="2" fill="none"/><path d="M62 14 v8 M58 18 h8 M59 15 l6 6 M65 15 l-6 6" stroke="#bae6fd" stroke-width="1"/>');
    if (L === 5) g.push(`${star(54, 22, 3, '#facc15')}${star(64, 12, 2.4, '#c084fc')}${star(70, 26, 2, '#facc15')}<path d="M36 34 Q60 28 84 34" stroke="#c084fc" stroke-width="1.2" fill="none"/>`);
    return g.join('');
  },
};

const SNOW = (color: string) => [[20, 30, 0], [100, 24, .9], [30, 60, 1.6], [96, 66, .4], [60, 8, 2.2]].map(([x, y, d]) => `<path class="pg-fall" style="animation-delay:${d}s" d="M${x} ${y} v4 M${x - 2} ${y + 2} h4" stroke="${color}" stroke-width="1"/>`).join('');
/** A full 6-piece set: a soft glow behind, and from 얼음 성채 the snow (마도사: violet snow and stars going round). */
// the animation sets the circle's own opacity, so the wrapper keeps it soft
export function gearSetBack(full: number) { return `<g opacity=".2"><circle class="pg-pulse" cx="60" cy="80" r="52" fill="${TIERS[full].trim}"/></g>`; }
export function gearSetFront(full: number) {
  if (full >= 6) return plusFx(full);
  const stars = full === 5 ? star(18, 30, 3, '#facc15') + star(104, 22, 2.4, '#c084fc') + star(16, 80, 2, '#c084fc') : '';
  if (full === 4) return SNOW('#bae6fd');
  if (full === 5) return stars + SNOW('#c084fc') + `<g class="pg-orbit">${star(112, 70, 2.6, '#facc15')}<circle cx="8" cy="70" r="1.8" fill="#facc15"/><circle cx="60" cy="18" r="1.4" fill="#facc15"/></g>`;
  return '';
}

/** Wings and fins (6~10단계 armor) drawn behind the pet. */
export function gearBack(look: GearLook, id = '') {
  const a = look.armor; if (typeof a !== 'number' || a < 6 || a >= TIERS.length) return '';
  const b = plusBack(a); return b.behind ? b.svg.replaceAll('__ID__', id) : '';
}

/** Everything worn, in drawing order. `helmetY`: moves the helmet to the character's head (다롱's hair, 호두's ears);
 *  `id`: this picture's own, for the clip shapes of 6~10단계. */
export function gearArt(style: GearArtStyle, look: GearLook, helmetY = 0, id = '') {
  const at = (s: TowerGearSlot) => { const L = look[s]; return typeof L === 'number' && L >= 0 && L < TIERS.length ? L : null; };
  const w = at('weapon'), h = at('helmet'), a = at('armor'), sh = at('shoulder'), gl = at('gloves'), b = at('boots'), out: string[] = [];
  const helmet = (svg: string) => helmetY ? `<g transform="translate(0 ${helmetY})">${svg}</g>` : svg;
  const plus = (L: number) => L >= 6, cape = (L: number) => plus(L) ? (plusBack(L).behind ? '' : plusBack(L).svg) : style === 'knight' ? knight.cape(L) : mage.cape(L);
  const piece = (slot: TowerGearSlot, L: number, own: () => string) => plus(L) ? plusSlot(style, L, slot) : own();
  if (style === 'knight') {
    if (a !== null) out.push(cape(a));
    if (b !== null) out.push(piece('boots', b, () => knight.boots(b)));
    if (a !== null) out.push(piece('armor', a, () => knight.armor(a)));
    if (sh !== null) out.push(piece('shoulder', sh, () => knight.shoulder(sh)));
    if (gl !== null) out.push(piece('gloves', gl, () => knight.glove(gl, 34)));
    if (w !== null) out.push(piece('weapon', w, () => knight.weapon(w)));
    if (gl !== null && !plus(gl)) out.push(knight.glove(gl, 86));
    if (h !== null) out.push(helmet(piece('helmet', h, () => knight.helmet(h))));
  } else {
    if (a !== null) out.push(cape(a));
    if (b !== null) out.push(piece('boots', b, () => mage.boots(b)));
    if (w !== null) out.push(piece('weapon', w, () => mage.weapon(w)));
    if (a !== null) out.push(piece('armor', a, () => mage.armor(a)));
    if (sh !== null) out.push(piece('shoulder', sh, () => mage.shoulder(sh)));
    if (gl !== null) out.push(piece('gloves', gl, () => mage.gloves(gl)));
    if (h !== null) out.push(helmet(piece('helmet', h, () => mage.helmet(h))));
  }
  return out.join('').replaceAll('__ID__', id);
}

const PIECE_BOX: Record<GearArtStyle, Record<TowerGearSlot, string>> = {
  // pairs (견갑·장갑·신발): the left one, close up
  knight: { weapon: '80 34 40 76', helmet: '24 0 72 58', armor: '26 78 68 54', shoulder: '19 72 34 30', gloves: '25 95 18 18', boots: '35 112 24 17' },
  mage: { weapon: '0 18 36 106', helmet: '22 0 76 48', armor: '24 78 72 56', shoulder: '22 78 30 22', gloves: '25 95 18 18', boots: '35 113 24 16' },
};
/** One piece on its own (the gear icon): its drawing and the box around it. */
export function gearPiece(style: GearArtStyle, slot: TowerGearSlot, tier: number, id = `ic${style}${slot}${tier}`) {
  const art = slot === 'gloves' && style === 'knight' && tier < 6 ? knight.glove(tier, 34) : gearArt(style, { [slot]: tier }, 0, id);
  return { svg: art, box: PIECE_BOX[style][slot] };
}
