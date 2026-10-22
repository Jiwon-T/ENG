import type { ReactNode } from 'react';

// 탑 장식 그림 (60×76, centred at 30·40): the ten zone bosses' room decorations. Their moving parts (dx-*, bx-*, pg-*, px-*
// in index.css) stop with 움직임 줄이기; glows keep their softness on a wrapping <g opacity>.
const spark = (x: number, y: number, d: number, c = '#fde68a', r = 2.2) => <path className="bx-eye" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - r} Q${x + r * .2} ${y - r * .2} ${x + r} ${y} Q${x + r * .2} ${y + r * .2} ${x} ${y + r} Q${x - r * .2} ${y + r * .2} ${x - r} ${y} Q${x - r * .2} ${y - r * .2} ${x} ${y - r}Z`} fill={c} />;
const gem = (x: number, y: number, r: number, a: string, b: string) => <><path d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y}Z`} fill={a} /><path d={`M${x} ${y - r} L${x + r} ${y} L${x} ${y}Z`} fill={b} /></>;
const flowers = (pts: number[][]) => pts.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="1.6" fill={['#f9a8d4', '#fde68a', '#c4b5fd'][i % 3]} /><circle cx={x} cy={y} r=".6" fill="#fff" /></g>);

export const DECOR_ART: Record<string, ReactNode> = {
  moss_pot: <g transform="translate(30 40)">
    <path d="M-17 6 L-13 32 Q0 35 13 32 L17 6Z" fill="#c2410c" stroke="#7c2d12" strokeWidth="1" />
    <path d="M-15 16 Q0 19 15 16" stroke="#fdba74" strokeWidth="1.4" fill="none" /><path d="M-11 22 l3 3 3 -3 3 3 3 -3 3 3 3 -3" stroke="#9a3412" strokeWidth="1" fill="none" />
    <rect x="-20" y="1" width="40" height="7" rx="2.5" fill="#ea580c" stroke="#7c2d12" strokeWidth="1" /><path d="M-17 3 h20" stroke="#fed7aa" strokeWidth="1.2" strokeLinecap="round" />
    <ellipse cy="0" rx="19" ry="6" fill="#3f6212" />
    <g className="dx-leaf"><path d="M-6 -2 Q-18 -10 -16 -26 Q-8 -18 -4 -4Z" fill="#65a30d" stroke="#365314" strokeWidth=".7" /><path d="M-7 -4 Q-13 -14 -15 -22" stroke="#a3e635" strokeWidth=".7" fill="none" /></g>
    <g className="dx-leaf" style={{ animationDelay: '1.2s' }}><path d="M4 -2 Q16 -12 12 -30 Q4 -18 2 -4Z" fill="#84cc16" stroke="#365314" strokeWidth=".7" /><path d="M4 -4 Q10 -16 11 -26" stroke="#d9f99d" strokeWidth=".7" fill="none" /></g>
    <circle cx="-10" cy="-4" r="7" fill="#4d7c0f" /><circle cx="9" cy="-5" r="6" fill="#65a30d" /><circle cy="-8" r="7" fill="#84cc16" />
    <path d="M10 -6 v-6 M8 -12 q2 -4 4 0z" stroke="#fef3c7" strokeWidth="1.4" fill="#ef4444" /><circle cx="9" cy="-13" r=".6" fill="#fff" />
    <circle cx="-4" cy="-14" r="2.4" fill="#f9a8d4" /><circle cx="-4" cy="-14" r="1" fill="#fde047" />
    {spark(-20, -20, 0, '#d9f99d', 1.8)}{spark(18, -28, 1.1, '#d9f99d', 1.6)}
  </g>,
  crystal_lamp: <g transform="translate(30 42)">
    <g opacity=".3"><circle className="pg-pulse" cy="-20" r="20" fill="#c4b5fd" /></g>
    <ellipse cy="29" rx="15" ry="4.5" fill="#4b5563" stroke="#1f2937" strokeWidth=".8" /><path d="M-10 27 Q0 22 10 27" stroke="#9ca3af" strokeWidth="1" fill="none" />
    <path d="M-2.5 -4 V26 M2.5 -4 V26" stroke="#6b7280" strokeWidth="2" /><path d="M-4 6 Q0 2 4 6 M-4 14 Q0 10 4 14" stroke="#d1d5db" strokeWidth="1" fill="none" />
    <path d="M-8 -4 Q0 2 8 -4 L6 -8 H-6Z" fill="#a16207" stroke="#713f12" strokeWidth=".8" />
    <path d="M-10 -10 L-14 -22 L-8 -18Z M10 -10 L14 -24 L8 -18Z" fill="#a78bfa" stroke="#6d28d9" strokeWidth=".7" />
    <path d="M0 -38 L11 -16 L0 -6 L-11 -16Z" fill="#c4b5fd" stroke="#6d28d9" strokeWidth="1" />
    <path d="M0 -38 L11 -16 L0 -18Z" fill="#ddd6fe" /><path d="M-11 -16 L0 -18 L0 -6Z" fill="#8b5cf6" /><path d="M0 -38 L0 -6" stroke="#ede9fe" strokeWidth=".8" />
    {spark(-14, -34, 0, '#ede9fe')}{spark(14, -38, .7, '#ffffff', 1.8)}{spark(16, -8, 1.4, '#ede9fe', 1.6)}
  </g>,
  hourglass: <g transform="translate(30 38)">
    <rect x="-18" y="-31" width="36" height="6" rx="2.5" fill="#92400e" stroke="#451a03" strokeWidth=".8" /><rect x="-18" y="25" width="36" height="6" rx="2.5" fill="#92400e" stroke="#451a03" strokeWidth=".8" />
    <path d="M-14 -29 h28 M-14 29 h28" stroke="#fbbf24" strokeWidth="1" />
    <path d="M-15 -25 V25 M15 -25 V25" stroke="#78350f" strokeWidth="2.4" /><circle cx="-15" cy="0" r="2" fill="#fbbf24" /><circle cx="15" cy="0" r="2" fill="#fbbf24" />
    <path d="M-11 -25 Q-11 -6 0 0 Q-11 6 -11 25 H11 Q11 6 0 0 Q11 -6 11 -25Z" fill="#fef9c3" opacity=".9" stroke="#b45309" strokeWidth="1" />
    <path d="M-7 -21 Q-5 -9 0 -3 Q5 -9 7 -21Z" fill="#f59e0b" /><path d="M-9 24 Q0 10 9 24Z" fill="#f59e0b" />
    <circle className="dx-drip" cx="0" cy="6" r="1" fill="#d97706" /><circle className="dx-drip" style={{ animationDelay: '.45s' }} cx="0" cy="6" r="1" fill="#d97706" /><circle className="dx-drip" style={{ animationDelay: '.9s' }} cx="0" cy="6" r=".9" fill="#d97706" />
    <path d="M-8 -22 Q-7 -12 -4 -7" stroke="#fff" strokeWidth="1" fill="none" opacity=".8" />
    <path d="M-4 -34 h8 l-2 -3 h-4z" fill="#fbbf24" />
  </g>,
  ice_statue: <g transform="translate(30 40)">
    <rect x="-18" y="22" width="36" height="9" rx="2" fill="#93c5fd" stroke="#3b82f6" strokeWidth=".8" /><path d="M-15 25 h30" stroke="#dbeafe" strokeWidth="1" />
    <path d="M-12 22 Q-16 8 -6 2 Q-14 -6 -8 -16 Q-2 -24 6 -20 Q4 -12 -2 -10 Q10 -6 12 6 Q14 18 8 22Z" fill="#e0f2fe" stroke="#60a5fa" strokeWidth="1" />
    <path d="M6 -20 Q14 -26 18 -18 Q12 -18 10 -14Z" fill="#bfdbfe" stroke="#60a5fa" strokeWidth=".8" />
    <path d="M-6 6 L4 14 M2 4 L-4 16 M-8 -12 L-2 -6" stroke="#ffffff" strokeWidth="1.2" />
    <path d="M10 6 Q20 0 24 -10 Q18 -4 12 -2Z" fill="#dbeafe" stroke="#60a5fa" strokeWidth=".8" />
    <circle cx="3" cy="-17" r="1.2" fill="#1e40af" />
    {spark(-18, -22, 0, '#ffffff')}{spark(20, -28, .8, '#bae6fd')}{spark(-20, 12, 1.5, '#ffffff', 1.6)}
    {[[-14, -34, 0], [10, -36, 1.2]].map(([x, y, d], i) => <path key={i} className="pg-fall" style={{ animationDelay: `${d}s` }} d={`M${x} ${y} v4 M${x - 2} ${y + 2} h4`} stroke="#bae6fd" strokeWidth="1" />)}
  </g>,
  spellbook_shelf: <g transform="translate(30 40)">
    <path d="M-24 -34 h48 l-2 4 h-44z" fill="#92400e" stroke="#451a03" strokeWidth=".8" />
    <rect x="-22" y="-30" width="44" height="60" rx="2" fill="#78350f" stroke="#451a03" strokeWidth="1" />
    <rect x="-19" y="-27" width="38" height="54" fill="#451a03" opacity=".45" />
    <rect x="-19" y="-10" width="38" height="3" fill="#92400e" /><rect x="-19" y="10" width="38" height="3" fill="#92400e" />
    {[[-17, -26, 5, 16, '#7c3aed'], [-11, -24, 5, 14, '#db2777'], [-5, -26, 6, 16, '#2563eb'], [2, -23, 5, 13, '#ca8a04']].map(([x, y, w, h, c], i) => <g key={i}><rect x={Number(x)} y={Number(y)} width={Number(w)} height={Number(h)} fill={String(c)} /><path d={`M${Number(x)} ${Number(y) + 3} h${Number(w)} M${Number(x)} ${Number(y) + Number(h) - 3} h${Number(w)}`} stroke="#fde68a" strokeWidth=".8" /></g>)}
    <path d="M8 -12 L18 -24 L19 -22 L10 -11Z" fill="#059669" />
    {[[-16, -6, 5, 16, '#059669'], [-10, -8, 7, 18, '#4c1d95']].map(([x, y, w, h, c], i) => <g key={i}><rect x={Number(x)} y={Number(y)} width={Number(w)} height={Number(h)} fill={String(c)} /><path d={`M${Number(x)} ${Number(y) + 3} h${Number(w)}`} stroke="#fde68a" strokeWidth=".8" /></g>)}
    <g opacity=".5"><circle className="pg-pulse" cx="10" cy="2" r="7" fill="#c4b5fd" /></g><circle cx="10" cy="2" r="5" fill="#c4b5fd" stroke="#6d28d9" strokeWidth=".7" /><circle cx="8.6" cy=".6" r="1.4" fill="#fff" /><rect x="7" y="7" width="6" height="2" fill="#a16207" />
    <rect x="-16" y="16" width="10" height="9" fill="#92400e" /><path d="M-2 25 V18" stroke="#fef3c7" strokeWidth="3" /><path className="px-flick" d="M-2 17 Q-4 14 -2 11 Q0 14 -2 17Z" fill="#fbbf24" />
    <g className="dx-bob"><path d="M4 -42 Q10 -46 16 -42 Q22 -46 28 -42 L28 -36 Q22 -40 16 -36 Q10 -40 4 -36Z" fill="#fef3c7" stroke="#92400e" strokeWidth=".8" /><path d="M16 -42 V-36" stroke="#92400e" strokeWidth=".6" />
      <path className="bx-eye" d="M7 -40 h5 M19 -40 h6 M8 -38 h3" stroke="#7c3aed" strokeWidth=".8" />{spark(22, -48, .4, '#c4b5fd', 1.6)}</g>
  </g>,
  // 용암 화로: a stone pedestal with glowing coals, a black iron bowl with ring handles and a lava-glow grate, three flames
  lava_brazier: <g transform="translate(30 40)">
    <path d="M-16 26 H16 L20 34 H-20Z" fill="#57534e" stroke="#292524" strokeWidth="1" /><path d="M-14 29 h8 M2 30 h10" stroke="#78716c" strokeWidth="1" />
    {[[-12, 24, 3], [-4, 25, 2.4], [6, 24, 3.2], [13, 25, 2.2]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#44403c" stroke="#ea580c" strokeWidth=".6" />)}
    <circle className="bx-eye" cx="-4" cy="25" r="1" fill="#fb923c" /><circle className="bx-eye" style={{ animationDelay: '.8s' }} cx="6" cy="24" r="1.2" fill="#fb923c" />
    <path d="M-10 8 L-14 22 M10 8 L14 22 M0 10 L0 22" stroke="#292524" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M-23 -4 Q-21 14 0 14 Q21 14 23 -4Z" fill="#292524" stroke="#0c0a09" strokeWidth="1.2" />
    <path d="M-18 2 Q0 8 18 2 M-14 8 Q0 13 14 8" stroke="#ea580c" strokeWidth="1.2" fill="none" opacity=".9" />
    <circle cx="-25" cy="2" r="3.4" fill="none" stroke="#57534e" strokeWidth="1.6" /><circle cx="25" cy="2" r="3.4" fill="none" stroke="#57534e" strokeWidth="1.6" />
    <path d="M-23 -4 Q0 2 23 -4" stroke="#78716c" strokeWidth="2.4" fill="none" />
    <ellipse cy="-5" rx="21" ry="5" fill="#ea580c" /><ellipse cy="-5" rx="15" ry="3.2" fill="#fde047" /><path d="M-8 -5 q3 2 6 0 q3 -2 6 0" stroke="#fb923c" strokeWidth="1" fill="none" />
    <g className="px-flick"><path d="M-12 -6 Q-17 -18 -9 -26 Q-9 -17 -5 -20 Q-3 -11 -12 -6Z" fill="#f97316" /><path d="M2 -6 Q-3 -24 8 -36 Q8 -23 13 -27 Q16 -12 2 -6Z" fill="#fb923c" /><path d="M12 -6 Q12 -16 18 -20 Q17 -12 20 -12 Q19 -6 12 -6Z" fill="#f97316" /></g>
    <path d="M-4 -6 Q-7 -16 0 -23 Q2 -14 5 -16 Q7 -9 -4 -6Z" fill="#fde047" /><path d="M-1 -7 Q-2 -12 1 -15 Q2 -11 3 -11 Q3 -8 -1 -7Z" fill="#fffbeb" />
    {[[-9, -12, 0], [7, -18, .8], [0, -10, 1.6], [14, -12, 2.2]].map(([x, y, d], i) => <circle key={i} className="bx-rise" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r="1.2" fill="#fdba74" />)}
  </g>,
  // 진주 조개 침대: a big scallop with a fluffy pillow and a little blanket, a glowing pearl, a pearl string, a starfish, seaweed and bubbles
  pearl_bed: <g transform="translate(30 40)">
    <ellipse cy="31" rx="28" ry="4" fill="#99f6e4" opacity=".55" />
    <path className="dx-leaf" d="M-29 30 Q-25 18 -30 8 Q-26 2 -28 -6" stroke="#14b8a6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <path className="dx-leaf" style={{ animationDelay: '1s' }} d="M29 30 Q34 20 28 10 Q32 4 30 -2" stroke="#0d9488" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    <path d="M-26 0 Q-26 -31 0 -33 Q26 -31 26 0Z" fill="#fbcfe8" stroke="#db2777" strokeWidth="1.2" />
    {[-18, -9, 0, 9, 18].map(x => <path key={x} d={`M0 0 L${x} -31`} stroke="#f472b6" strokeWidth=".9" />)}
    <path d="M-24 -6 Q0 -10 24 -6" stroke="#fdf2f8" strokeWidth="1" fill="none" />
    <path d="M-28 2 Q0 -6 28 2 L24 17 Q0 25 -24 17Z" fill="#f9a8d4" stroke="#db2777" strokeWidth="1.2" />
    <path d="M-18 -2 Q-18 -10 -8 -10 Q2 -10 2 -3 Q-8 1 -18 -2Z" fill="#ffffff" stroke="#fbcfe8" strokeWidth=".8" />
    <path d="M-2 4 Q10 -2 22 2 L20 10 Q8 12 -2 10Z" fill="#a5f3fc" stroke="#22d3ee" strokeWidth=".8" /><path d="M2 6 h16 M3 8.5 h14" stroke="#ecfeff" strokeWidth=".7" />
    <g opacity=".45"><circle className="pg-pulse" cx="10" cy="-8" r="9" fill="#ffffff" /></g>
    <circle cx="10" cy="-8" r="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".8" /><circle cx="8" cy="-10" r="2" fill="#fff" />
    {[-20, -14, -8, -2, 4, 10, 16].map((x, i) => <circle key={x} cx={x} cy={18 + Math.sin(i / 1.4) * 1.5} r="1.3" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".3" />)}
    <path d="M-22 26 l2 -4 2 4 4 0 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3z" fill="#fb923c" stroke="#c2410c" strokeWidth=".5" />
    {spark(18, -26, .4, '#ffffff', 1.8)}
    {[[-14, -12, 0], [16, -16, 1], [4, -22, 1.8]].map(([x, y, d], i) => <circle key={i} className="bx-rise" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r="1.6" fill="none" stroke="#67e8f9" strokeWidth=".7" />)}
  </g>,
  // 구름 그네: a cloud with a little rainbow, flower vines down the ropes, a heart cushion on the seat, a bluebird, twinkling stars
  cloud_swing: <g transform="translate(30 40)">
    <path d="M-34 -12 A34 34 0 0 1 34 -12" stroke="#fca5a5" strokeWidth="2" fill="none" /><path d="M-31 -12 A31 31 0 0 1 31 -12" stroke="#fde68a" strokeWidth="2" fill="none" /><path d="M-28 -12 A28 28 0 0 1 28 -12" stroke="#93c5fd" strokeWidth="2" fill="none" />
    <path d="M-26 -22 Q-28 -34 -16 -34 Q-12 -42 -2 -38 Q6 -44 14 -36 Q26 -38 26 -26 Q32 -20 24 -16 H-22 Q-30 -16 -26 -22Z" fill="#f8fafc" stroke="#bae6fd" strokeWidth="1.2" />
    <path d="M-18 -30 Q-12 -34 -6 -32 M6 -36 Q12 -38 16 -34" stroke="#ffffff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    {spark(22, -42, 0)}{spark(-26, -40, 1, '#fde68a', 1.6)}{spark(30, -14, 1.7, '#bae6fd', 1.6)}
    <path d="M18 -36 q3 -3 6 0 q-3 1 -3 3 q-2 -1 -3 -3z" fill="#60a5fa" /><circle cx="22" cy="-36" r=".5" fill="#1e293b" /><path d="M24 -36 l1.6 .6" stroke="#f59e0b" strokeWidth=".8" />
    <g className="bx-sway" style={{ transformOrigin: '30px 24px', transformBox: 'view-box' }}>
      <path d="M-12 -16 V20 M12 -16 V20" stroke="#a16207" strokeWidth="1.4" />
      <path d="M-12 -12 q-3 3 0 6 q3 3 0 6 q-3 3 0 6 q3 3 0 6 M12 -12 q3 3 0 6 q-3 3 0 6 q3 3 0 6 q-3 3 0 6" stroke="#4ade80" strokeWidth=".9" fill="none" />
      {flowers([[-12, -8], [-12, 2], [-12, 12], [12, -4], [12, 6], [12, 16]])}
      <rect x="-16" y="18" width="32" height="6" rx="3" fill="#fde68a" stroke="#a16207" strokeWidth="1" /><path d="M-13 20.5 h26" stroke="#fef3c7" strokeWidth="1" />
      <path d="M0 18 Q-6 12 -3 9 Q0 8 0 11 Q0 8 3 9 Q6 12 0 18Z" fill="#fb7185" stroke="#e11d48" strokeWidth=".6" />
    </g>
    <ellipse cy="34" rx="18" ry="2.5" fill="#000" opacity=".08" />
  </g>,
  // 별자리 망원경: a brass telescope with rings and a lens glint, a star globe on the tripod, a crescent moon and a constellation
  star_telescope: <g transform="translate(30 40)">
    <path d="M0 4 L-15 32 M0 4 L15 32 M0 4 L0 30" stroke="#78350f" strokeWidth="2.4" strokeLinecap="round" /><path d="M-9 20 H9" stroke="#92400e" strokeWidth="1.4" />
    <circle cx="-15" cy="32" r="1.6" fill="#ca8a04" /><circle cx="15" cy="32" r="1.6" fill="#ca8a04" /><circle cx="0" cy="31" r="1.6" fill="#ca8a04" />
    <g transform="translate(0 22)"><circle r="5.5" fill="#1e3a8a" stroke="#ca8a04" strokeWidth="1" /><path d="M-5.5 0 H5.5 M0 -5.5 V5.5" stroke="#93c5fd" strokeWidth=".5" /><ellipse rx="5.5" ry="2" fill="none" stroke="#93c5fd" strokeWidth=".5" /><circle cx="-2" cy="-2" r=".7" fill="#fde68a" /><circle cx="2" cy="1" r=".6" fill="#fde68a" /></g>
    <g transform="rotate(-35 0 2)">
      <rect x="-18" y="-4" width="40" height="10" rx="3" fill="#ca8a04" stroke="#713f12" strokeWidth="1" />
      <path d="M-18 -1 H22" stroke="#fde68a" strokeWidth="1.4" opacity=".8" />
      <rect x="-6" y="-5" width="3" height="12" fill="#a16207" /><rect x="8" y="-5" width="3" height="12" fill="#a16207" />
      <rect x="18" y="-6" width="8" height="14" rx="2" fill="#fde68a" stroke="#713f12" strokeWidth="1" /><ellipse cx="26" cy="1" rx="1.4" ry="6" fill="#bae6fd" />
      <path className="bx-eye" d="M25.5 -3 v3" stroke="#ffffff" strokeWidth="1" />
      <rect x="-24" y="-2" width="7" height="6" rx="1.5" fill="#a16207" />
    </g>
    <circle cy="3" r="3.2" fill="#713f12" /><circle cy="3" r="1.2" fill="#fde68a" />
    <path d="M-20 -34 A7 7 0 1 0 -14 -24 A5 5 0 1 1 -20 -34Z" fill="#fde68a" />
    <path d="M8 -30 L16 -22 L24 -32 L22 -14 L30 -18" stroke="#c4b5fd" strokeWidth=".6" fill="none" />
    {[[8, -30, 0], [16, -22, .5], [24, -32, 1], [22, -14, 1.5], [30, -18, .2], [-26, -14, .8]].map(([x, y, d], i) => spark(x, y, d, '#fde68a', 2.2))}
  </g>,
  // 용왕의 왕좌: on a red-carpeted dais with gold coins; dragon wings, dragon-head armrests, gem studs, a crowned back and a glow
  dragon_throne: <g transform="translate(30 40)">
    <g opacity=".22"><circle className="pg-pulse" cy="-10" r="26" fill="#f59e0b" /></g>
    <path d="M-26 28 H26 L28 34 H-28Z" fill="#78350f" stroke="#451a03" strokeWidth="1" /><path d="M-22 24 H22 L24 28 H-24Z" fill="#92400e" stroke="#451a03" strokeWidth="1" />
    <path d="M-8 24 H8 L12 34 H-12Z" fill="#b91c1c" /><path d="M-8 26 h16" stroke="#fde68a" strokeWidth=".7" />
    {[[-22, 30], [-18, 31.5], [20, 30], [24, 31]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2.4" ry="1.2" fill="#fde047" stroke="#a16207" strokeWidth=".5" />)}
    <g className="bx-flap l" style={{ transformOrigin: '100% 100%' }}><path d="M-12 -6 L-28 -38 L-30 -18 L-37 -24 L-33 0Z" fill="#111827" stroke="#f59e0b" strokeWidth="1" /><path d="M-14 -6 L-28 -38 M-28 -38 L-31 -10" stroke="#f59e0b" strokeWidth=".6" /></g>
    <g className="bx-flap r" style={{ transformOrigin: '0% 100%' }}><path d="M12 -6 L28 -38 L30 -18 L37 -24 L33 0Z" fill="#111827" stroke="#f59e0b" strokeWidth="1" /><path d="M14 -6 L28 -38 M28 -38 L31 -10" stroke="#f59e0b" strokeWidth=".6" /></g>
    <path d="M-14 12 V-24 Q-14 -34 0 -36 Q14 -34 14 -24 V12Z" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />
    <path d="M-10 8 V-22 Q-10 -30 0 -31 Q10 -30 10 -22 V8Z" fill="#b91c1c" /><path d="M-6 -20 Q0 -26 6 -20 M-6 -10 Q0 -16 6 -10 M-6 0 Q0 -6 6 0" stroke="#dc2626" strokeWidth="1" fill="none" />
    {[[-12, -18], [12, -18], [-12, -4], [12, -4], [-12, 8], [12, 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.2" fill="#dc2626" stroke="#fde68a" strokeWidth=".4" />)}
    <path d="M-8 -38 L-6 -46 L-3 -40 L0 -48 L3 -40 L6 -46 L8 -38Z" fill="#fde68a" stroke="#92400e" strokeWidth=".8" />
    {gem(0, -40, 2.4, '#dc2626', '#fca5a5')}<circle className="bx-eye" cy="-40" r="3.4" fill="none" stroke="#fca5a5" strokeWidth=".6" />
    <rect x="-20" y="10" width="40" height="8" rx="2" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" /><rect x="-16" y="12" width="32" height="5" rx="2" fill="#dc2626" /><path d="M-14 13.5 h28" stroke="#fca5a5" strokeWidth=".7" />
    <path d="M-18 18 V24 M18 18 V24" stroke="#78350f" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M-22 4 Q-26 10 -20 14 L-16 12" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" /><path d="M22 4 Q26 10 20 14 L16 12" stroke="#f59e0b" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M-24 2 l-3 -3 4 0z M24 2 l3 -3 -4 0z" fill="#f59e0b" /><circle cx="-23" cy="4" r=".7" fill="#dc2626" /><circle cx="23" cy="4" r=".7" fill="#dc2626" />
    {gem(0, -18, 2.6, '#fde68a', '#fff7cc')}
    {spark(-24, -42, .3)}{spark(26, -40, 1.2)}
  </g>,
  // 특별 소품 (상점 특별, 목표 물건): drawn with more care than the rest — they cost the most.
  fountain: <g transform="translate(30 40)">
    <ellipse cy="31" rx="27" ry="5" fill="#000" opacity=".12" />
    <path d="M-26 22 Q0 32 26 22 L26 27 Q0 37 -26 27Z" fill="#94a3b8" stroke="#475569" strokeWidth=".8" />
    {[-20, -10, 0, 10, 20].map(x => <path key={x} d={`M${x} ${25 - Math.abs(x) * .08} v4`} stroke="#64748b" strokeWidth=".6" />)}
    <ellipse cy="22" rx="26" ry="6.5" fill="#e2e8f0" stroke="#475569" strokeWidth=".9" /><ellipse cy="22" rx="22.5" ry="4.8" fill="#38bdf8" />
    <ellipse cy="22.6" rx="20" ry="3.6" fill="#7dd3fc" /><path d="M-14 22 q3 -1.4 6 0 M4 23 q3 -1.4 6 0" stroke="#e0f2fe" strokeWidth=".7" fill="none" />
    <circle cx="-12" cy="23" r="1.5" fill="#fbbf24" stroke="#b45309" strokeWidth=".4" /><circle cx="13" cy="22" r="1.3" fill="#fde047" stroke="#b45309" strokeWidth=".4" /><circle cx="6" cy="24" r="1.1" fill="#fbbf24" stroke="#b45309" strokeWidth=".4" />
    <path d="M-5 21 L-3.5 0 H3.5 L5 21Z" fill="#f1f5f9" stroke="#475569" strokeWidth=".8" /><path d="M-3 18 h6 M-2.6 10 h5.2 M-2.2 3 h4.4" stroke="#cbd5e1" strokeWidth=".7" />
    <path d="M-4.6 6 q4.6 2 9.2 0" stroke="#94a3b8" strokeWidth=".6" fill="none" />
    <ellipse cy="0" rx="14" ry="3.8" fill="#e2e8f0" stroke="#475569" strokeWidth=".8" /><ellipse cy="0" rx="11.5" ry="2.6" fill="#38bdf8" /><ellipse cy=".4" rx="9.5" ry="1.8" fill="#bae6fd" />
    {[-11, -5.5, 0, 5.5, 11].map(x => <path key={x} d={`M${x} 2.4 q-.6 1.6 0 3`} stroke="#94a3b8" strokeWidth=".5" fill="none" />)}
    <path d="M-1.8 -1 L-1.2 -12 H1.2 L1.8 -1Z" fill="#f1f5f9" stroke="#475569" strokeWidth=".6" />
    <ellipse cy="-13" rx="5.5" ry="1.8" fill="#e2e8f0" stroke="#475569" strokeWidth=".6" /><ellipse cy="-13" rx="4" ry="1.1" fill="#7dd3fc" />
    <circle cy="-17" r="2.6" fill="#f8fafc" stroke="#475569" strokeWidth=".6" /><path d="M-1 -18 q1 -1 2 0" stroke="#cbd5e1" strokeWidth=".5" fill="none" />
    <path d="M0 -19.6 Q-9 -32 -16 -1 M0 -19.6 Q9 -32 16 -1" stroke="#38bdf8" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    <path d="M0 -19.6 Q-5 -27 -8 -13 M0 -19.6 Q5 -27 8 -13" stroke="#bae6fd" strokeWidth=".8" fill="none" strokeLinecap="round" />
    <path d="M0 -19.6 V-28" stroke="#7dd3fc" strokeWidth="1.2" strokeLinecap="round" />
    {[[-16, -1, 0], [16, -1, .5], [-8, -13, .25], [8, -13, .8], [-21, 18, 1.1], [21, 18, .35], [0, -29, .6]].map(([x, y, d], i) => <circle key={i} className="dx-drip" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r={i > 4 ? .9 : 1.1} fill="#38bdf8" />)}
    {spark(-22, -16, 0, '#e0f2fe')}{spark(22, -22, 1, '#ffffff', 1.8)}{spark(-6, -32, .5, '#e0f2fe', 1.4)}
    <path d="M-27 24 q-4 -2 -3 -6 q3 1 3 6 M27 24 q4 -3 2 -7 q-3 2 -2 7" fill="#65a30d" /><circle cx="-29" cy="18" r="1.3" fill="#f9a8d4" /><circle cx="29" cy="17" r="1.3" fill="#fde68a" />
  </g>,
  grand_piano: <g transform="translate(30 40)">
    <ellipse cy="33" rx="27" ry="3.5" fill="#000" opacity=".14" />
    <path d="M-25 2 L-21 -16 Q-19 -26 -8 -26 Q8 -26 20 -14 Q27 -6 25 2Z" fill="#111827" stroke="#030712" strokeWidth=".9" />
    <path d="M-21 -16 Q-19 -24 -8 -24 Q7 -24 18 -13" stroke="#374151" strokeWidth="1.2" fill="none" />
    <path d="M-17 -12 Q2 -18 20 -6" stroke="#d4a017" strokeWidth=".6" fill="none" /><path d="M-15 -8 Q2 -14 18 -3" stroke="#a16207" strokeWidth=".5" fill="none" />
    <path d="M-21 -16 L-12 -36 L-5 -25Z" fill="#1f2937" stroke="#030712" strokeWidth=".7" /><path d="M-12 -36 L-8 -25" stroke="#6b7280" strokeWidth=".6" />
    <path d="M-14 -31 L-9 -26" stroke="#374151" strokeWidth=".5" /><path d="M-11 -25 L-14 -14" stroke="#9ca3af" strokeWidth=".7" />
    <rect x="-25" y="2" width="50" height="11" rx="1.6" fill="#0b0f19" stroke="#030712" strokeWidth=".7" /><path d="M-24 3 h48" stroke="#374151" strokeWidth=".6" />
    <rect x="-23" y="4" width="46" height="6.4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".4" />
    {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${-23 + (i + 1) * 46 / 16} 4 v6.4`} stroke="#cbd5e1" strokeWidth=".35" />)}
    {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14].map(i => <rect key={i} x={-23 + (i + 1) * 46 / 16 - .9} y="4" width="1.8" height="3.8" rx=".3" fill="#111827" />)}
    <rect x="-6" y="-2" width="12" height="4" rx=".8" fill="#fef3c7" stroke="#a16207" strokeWidth=".5" /><path d="M-4 -.6 h3 M-4 .8 h5 M2 -.6 h2" stroke="#78350f" strokeWidth=".4" />
    <path d="M-22 13 V30 M22 13 V30 M4 13 V25" stroke="#111827" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M-23.5 29.5 h3 M20.5 29.5 h3" stroke="#d4a017" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M0 26 h8 M2 26 v2 M6 26 v2" stroke="#d4a017" strokeWidth="1" />
    <rect x="-12" y="22" width="16" height="3.4" rx="1.2" fill="#7f1d1d" stroke="#450a0a" strokeWidth=".5" /><path d="M-10 25.4 v4.6 M2 25.4 v4.6" stroke="#450a0a" strokeWidth="1.2" />
    <path d="M14 -10 Q16 -6 20 -6" stroke="#fde68a" strokeWidth=".6" fill="none" opacity=".7" />
    <g className="dx-bob"><path d="M20 -30 v-7 l5 -1.5 v7" stroke="#f472b6" strokeWidth="1" fill="none" /><ellipse cx="19" cy="-30" rx="1.6" ry="1.2" fill="#f472b6" /><ellipse cx="24" cy="-31.5" rx="1.6" ry="1.2" fill="#f472b6" /></g>
    <g className="dx-bob" style={{ animationDelay: '1.2s' }}><path d="M-25 -32 v-6" stroke="#a78bfa" strokeWidth="1" /><ellipse cx="-26" cy="-32" rx="1.6" ry="1.2" fill="#a78bfa" /><path d="M-25 -38 q3 1 2 4" stroke="#a78bfa" strokeWidth=".9" fill="none" /></g>
    {spark(6, -32, .4, '#fde68a', 1.6)}{spark(26, -20, 1.3, '#ffffff', 1.4)}
  </g>,
  star_tent: <g transform="translate(30 40)">
    <ellipse cy="31" rx="29" ry="4" fill="#000" opacity=".14" />
    <g opacity=".35"><circle className="pg-pulse" cy="14" r="14" fill="#fde68a" /></g>
    <path d="M0 -34 L28 30 H-28Z" fill="#4338ca" stroke="#1e1b4b" strokeWidth="1" />
    <path d="M0 -34 L13 30 H0Z" fill="#3730a3" /><path d="M0 -34 L-14 30" stroke="#6366f1" strokeWidth=".6" />
    <path d="M-28 30 Q-14 26 0 30 Q14 26 28 30" stroke="#a5b4fc" strokeWidth=".9" fill="none" />
    {[-22, -15, -8, 8, 15, 22].map((x, i) => <path key={i} d={`M${x} 30 l1.6 3 -3.2 0z`} fill={i % 2 ? '#f9a8d4' : '#fde68a'} />)}
    <path d="M0 -6 L-11 30 H11Z" fill="#fde68a" /><path d="M0 -6 L-6 30 H6Z" fill="#fef3c7" />
    <path d="M0 -6 L-11 30 M0 -6 L11 30" stroke="#1e1b4b" strokeWidth=".8" />
    <path d="M0 -6 Q-9 6 -15 30" stroke="#6366f1" strokeWidth="2" fill="none" /><path d="M0 -6 Q9 6 15 30" stroke="#6366f1" strokeWidth="2" fill="none" />
    <circle cx="-13" cy="18" r="1.1" fill="#facc15" stroke="#a16207" strokeWidth=".4" /><circle cx="13" cy="18" r="1.1" fill="#facc15" stroke="#a16207" strokeWidth=".4" />
    <g transform="translate(0 22)"><path d="M-3.5 4 L-2.5 -2 H2.5 L3.5 4Z" fill="#f59e0b" stroke="#78350f" strokeWidth=".5" /><circle cy="-3.5" r="2.4" fill="#fffbeb" /><g opacity=".6"><circle className="pg-pulse" cy="-3.5" r="4" fill="#fde68a" /></g></g>
    <path d="M-22 0 q2 -1 3 1 M18 -4 q2 -1 3 1" stroke="#a5b4fc" strokeWidth=".6" fill="none" />
    {[[-14, -2, 0, 2], [10, -16, .6, 2.2], [17, 6, 1.2, 1.8], [-7, -20, 1.6, 1.6], [-19, 14, .9, 1.6]].map(([x, y, d, r], i) => <path key={i} className="pg-tw" style={{ animationDelay: `${d}s` }} d={`M${x} ${y - r} L${x + r * .35} ${y - r * .3} L${x + r} ${y} L${x + r * .35} ${y + r * .3} L${x} ${y + r} L${x - r * .35} ${y + r * .3} L${x - r} ${y} L${x - r * .35} ${y - r * .3}Z`} fill="#fde047" />)}
    <path d="M0 -34 V-44" stroke="#1e1b4b" strokeWidth="1" /><path className="pg-sway" d="M0 -44 L9 -41.5 L0 -39Z" fill="#f472b6" stroke="#9d174d" strokeWidth=".4" />
    <path d="M-28 30 L-33 34 M28 30 L33 34" stroke="#78350f" strokeWidth="1" /><circle cx="-33" cy="34" r=".9" fill="#78350f" /><circle cx="33" cy="34" r=".9" fill="#78350f" />
    <path d="M-30 31 q-2 -3 0 -5 q2 2 0 5 M30 31 q2 -3 0 -5 q-2 2 0 5" fill="#4d7c0f" />
    {spark(-24, -26, .2, '#e0e7ff')}{spark(24, -30, 1, '#ffffff', 1.8)}
  </g>,
};
