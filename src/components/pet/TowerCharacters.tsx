import { useId, type ReactNode } from 'react';
// 채움의 탑 characters drawn in the pets' style (soft colours, thin same-colour outlines, big shiny eyes, blush, ω mouth):
// the 떠돌이 상인 (a raccoon peddler) and the 잠든 드래곤 (its colour differs by floor and student).
const Eyes = ({ y, dx, closed = false, color = '#3b2a2f' }: { y: number; dx: number; closed?: boolean; color?: string }) => closed
  ? <path d={`M${60 - dx - 5} ${y} q5 4 10 0 M${60 + dx - 5} ${y} q5 4 10 0`} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  : <>{[-1, 1].map(s => <g key={s}><ellipse cx={60 + s * dx} cy={y} rx="4.6" ry="5.6" fill={color} /><circle cx={60 + s * dx + 1.6} cy={y - 2} r="1.8" fill="#fff" /><circle cx={60 + s * dx - 1.4} cy={y + 2.2} r=".9" fill="#fff" /></g>)}</>;

/** 떠돌이 상인: a raccoon with a wide feathered hat, a travelling cloak, a backpack hung with potions and a scroll, a lantern. */
export function TowerMerchant({ size = 140 }: { size?: number }) {
  return <svg viewBox="0 0 120 140" width={size * 120 / 140} height={size} role="img" aria-label="떠돌이 상인">
    {/* tail and backpack behind */}
    <path d="M86 112 Q110 104 108 84 Q106 74 98 78 Q100 96 82 102Z" fill="#a39486" stroke="#7d6e62" strokeWidth="1.2" />
    <path d="M101 80 l6 -2 M104 90 l5 1 M100 99 l4 3" stroke="#5c5049" strokeWidth="3" strokeLinecap="round" />
    <rect x="70" y="70" width="34" height="38" rx="7" fill="#b98352" stroke="#8a5a2b" strokeWidth="1.4" />
    <rect x="70" y="80" width="34" height="5" fill="#8a5a2b" /><rect x="84" y="72" width="7" height="12" rx="2" fill="#e6c27a" stroke="#a87a32" />
    <rect x="96" y="58" width="8" height="18" rx="3" fill="#f3e3c3" stroke="#c9a87a" transform="rotate(16 100 67)" /><path d="M97 60 h7" stroke="#c9a87a" transform="rotate(16 100 67)" />
    <g transform="translate(102 96)"><path d="M-4 0 h8 l-1 3 q5 3 4 9 q-3 6 -7 6 q-4 0 -7 -6 q-1 -6 4 -9z" fill="#cfe8f8" stroke="#8fc3e6" /><path d="M-4 7 q4 3 8 0 v4 q-4 4 -8 0z" fill="#ff8fb1" /></g>
    {/* body in a cloak */}
    <path d="M30 132 Q28 92 60 88 Q92 92 90 132 Z" fill="#6c67a8" stroke="#55508e" strokeWidth="1.4" />
    <path d="M60 90 L52 132 M60 90 L68 132" stroke="#55508e" strokeWidth="1" opacity=".6" />
    <path d="M44 96 Q60 106 76 96 L74 102 Q60 112 46 102Z" fill="#f2c94c" stroke="#d9a930" strokeWidth="1" />
    <circle cx="60" cy="104" r="2.6" fill="#e76f51" />
    <ellipse cx="46" cy="133" rx="9" ry="4" fill="#7d6e62" /><ellipse cx="74" cy="133" rx="9" ry="4" fill="#7d6e62" />
    {/* lantern in the left hand */}
    <path d="M26 112 Q22 100 30 96" fill="none" stroke="#7d6e62" strokeWidth="4" strokeLinecap="round" />
    <path d="M18 106 v-4 h12 v4" fill="none" stroke="#5f5e5a" strokeWidth="1.4" />
    <rect x="17" y="106" width="14" height="17" rx="3" fill="#fff3c4" stroke="#b98a32" strokeWidth="1.4" /><ellipse cx="24" cy="115" rx="3" ry="4.2" fill="#ffb84d" />
    {/* head */}
    <ellipse cx="38" cy="38" rx="9" ry="10" fill="#a39486" stroke="#7d6e62" /><ellipse cx="82" cy="38" rx="9" ry="10" fill="#a39486" stroke="#7d6e62" />
    <ellipse cx="38" cy="39" rx="4.5" ry="5.5" fill="#5c5049" /><ellipse cx="82" cy="39" rx="4.5" ry="5.5" fill="#5c5049" />
    <path d="M26 66 Q24 36 60 34 Q96 36 94 66 Q94 90 60 90 Q26 90 26 66Z" fill="#c9bbad" stroke="#a39486" />
    <path d="M30 60 Q38 52 50 58 Q52 68 44 72 Q34 72 30 60Z M90 60 Q82 52 70 58 Q68 68 76 72 Q86 72 90 60Z" fill="#6f625a" />
    <path d="M44 74 Q60 64 76 74 Q76 88 60 88 Q44 88 44 74Z" fill="#fbf4ec" />
    <Eyes y={63} dx={13} color="#2f2522" />
    <ellipse cx="60" cy="74" rx="3.6" ry="2.6" fill="#3b2a2f" />
    <path d="M54 78 q3 3.4 6 0 q3 3.4 6 0" fill="none" stroke="#3b2a2f" strokeWidth="1.5" strokeLinecap="round" />
    <ellipse cx="38" cy="76" rx="5" ry="3" fill="#ffadc2" opacity=".75" /><ellipse cx="82" cy="76" rx="5" ry="3" fill="#ffadc2" opacity=".75" />
    {/* wide hat with a feather */}
    <ellipse cx="60" cy="36" rx="44" ry="9" fill="#55508e" stroke="#403c73" strokeWidth="1.2" />
    <path d="M38 36 Q40 10 60 8 Q80 10 82 36 Z" fill="#6c67a8" stroke="#55508e" strokeWidth="1.2" />
    <path d="M39 30 Q60 36 81 30 L81 35 Q60 41 39 35Z" fill="#f2c94c" />
    <path d="M78 30 Q94 8 102 4 Q98 18 84 30Z" fill="#ff8fb1" stroke="#e56e98" strokeWidth="1" /><path d="M80 29 Q92 14 100 6" stroke="#e56e98" strokeWidth=".8" fill="none" />
  </svg>;
}

/** The colours a sleeping dragon can have (chosen per floor and student by the server). */
export const DRAGON_COLORS = [
  { body: '#e24b4a', dark: '#a32d2d', belly: '#fac775', wing: '#f09595' }, { body: '#378add', dark: '#185fa5', belly: '#d6ecfb', wing: '#85b7eb' },
  { body: '#639922', dark: '#3b6d11', belly: '#eaf3de', wing: '#97c459' }, { body: '#7f77dd', dark: '#534ab7', belly: '#eeedfe', wing: '#afa9ec' },
  { body: '#2c2c2a', dark: '#111110', belly: '#888780', wing: '#5f5e5a' }, { body: '#ba7517', dark: '#854f0b', belly: '#fac775', wing: '#ef9f27' },
  // 서리 용 (the 40층 boss), not among the sleeping dragon's random looks.
  { body: '#b5d4f4', dark: '#378add', belly: '#ffffff', wing: '#e6f1fb' },
];
export const FROST_DRAGON_COLOR = 6;
/** 드래곤: horns, spines, folded wings, a long tail; curled up asleep (closed eyes, Zz) or awake and fierce. */
export function TowerDragon({ color = 0, asleep = true, size = 150 }: { color?: number; asleep?: boolean; size?: number }) {
  const c = DRAGON_COLORS[color] || DRAGON_COLORS[color % DRAGON_COLORS.length];
  return <svg viewBox="0 0 160 110" width={size} height={size * 110 / 160} role="img" aria-label={asleep ? '잠든 드래곤' : '깨어난 드래곤'}>
    <ellipse cx="80" cy="104" rx="64" ry="5" fill="#000" opacity=".25" />
    <path d="M118 92 Q150 90 152 70 Q154 56 142 60 Q146 78 120 82Z" fill={c.body} stroke={c.dark} strokeWidth="1.6" />
    <path d="M146 58 l8 -6 l-2 10z" fill={c.dark} />
    <path d="M60 44 Q64 8 92 14 Q84 26 96 34 Q80 30 76 46Z" fill={c.wing} stroke={c.dark} strokeWidth="1.4" />
    <path d="M70 40 L84 18 M76 44 L92 26" stroke={c.dark} strokeWidth="1" opacity=".6" />
    <path d="M36 98 Q30 56 76 50 Q124 50 124 90 Q124 102 100 102 H52 Q38 102 36 98Z" fill={c.body} stroke={c.dark} strokeWidth="1.8" />
    <path d="M56 100 Q58 70 84 68 Q110 70 110 100Z" fill={c.belly} opacity=".9" />
    <path d="M62 74 h40 M60 82 h46 M60 90 h48" stroke={c.dark} strokeWidth=".8" opacity=".35" />
    {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${64 + i * 11} ${52 - Math.sin(i / 1.3) * 3} l5 -9 l4 9z`} fill={c.dark} />)}
    <ellipse cx="56" cy="101" rx="9" ry="4" fill={c.dark} /><ellipse cx="104" cy="101" rx="9" ry="4" fill={c.dark} />
    {/* head resting on the floor */}
    <path d="M8 90 Q6 64 34 62 Q56 62 58 82 Q58 98 36 100 Q12 100 8 90Z" fill={c.body} stroke={c.dark} strokeWidth="1.8" />
    <path d="M24 64 Q18 46 28 40 Q28 52 34 62Z M42 63 Q44 46 56 44 Q50 54 48 64Z" fill={c.belly} stroke={c.dark} strokeWidth="1.2" />
    <ellipse cx="14" cy="88" rx="2" ry="1.4" fill={c.dark} /><ellipse cx="22" cy="90" rx="2" ry="1.4" fill={c.dark} />
    {asleep ? <><path d="M26 78 q5 4 10 0 M42 78 q5 4 10 0" fill="none" stroke={c.dark} strokeWidth="2.2" strokeLinecap="round" /><path d="M14 94 q10 4 20 0" stroke={c.dark} strokeWidth="1.6" fill="none" strokeLinecap="round" /></>
      : <><path d="M24 72 l12 4 M54 72 l-12 4" stroke={c.dark} strokeWidth="2.4" strokeLinecap="round" /><ellipse cx="31" cy="80" rx="4" ry="4.6" fill="#fac775" /><ellipse cx="47" cy="80" rx="4" ry="4.6" fill="#fac775" /><rect x="30" y="77" width="2" height="7" rx="1" fill="#26215c" /><rect x="46" y="77" width="2" height="7" rx="1" fill="#26215c" />
        <path d="M14 92 q12 6 26 0 l-3 4 l-3 -3 l-3 4 l-3 -4 l-3 4 l-3 -4 l-3 3z" fill="#fff" stroke={c.dark} strokeWidth="1" /></>}
  </svg>;
}

/** 10층 보스 고대 수문장 골렘 (the obsidian look): huge boulder shoulders (its treasure is the 돌 견갑), a heavy brow over glowing
 *  eyes, a rune on the chest, stone-pillar legs, fists on the ground and a crystal crown. */
export function TowerBossGolem({ size = 130 }: { size?: number }) {
  const s1 = '#4a4740', s2 = '#3a3832', s3 = '#2a2824', ln = '#141311', glow = '#afa9ec', rune = '#534ab7', crown = '#7f77dd', crownLn = '#26215c';
  return <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="고대 수문장 골렘">
    <ellipse cx="100" cy="190" rx="70" ry="7" fill="#000" opacity=".35" />
    <path d="M62 150 h26 v36 h-30 Z M112 150 h26 l4 36 h-30 Z" fill={s2} stroke={ln} strokeWidth="3" strokeLinejoin="round" />
    <path d="M54 182 h38 v8 h-40 Z M108 182 h38 l2 8 h-40 Z" fill={s3} stroke={ln} strokeWidth="2.5" />
    <path d="M50 80 Q48 60 70 58 H130 Q152 60 150 80 L146 150 Q100 162 54 150 Z" fill={s1} stroke={ln} strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M60 96 h30 M110 96 h30 M64 126 h24 M112 126 h24 M100 64 v20 M76 64 l-4 16 M124 64 l4 16" stroke={ln} strokeWidth="2" opacity=".55" />
    <path d="M58 140 Q70 130 84 142 Q76 152 60 150Z M120 146 Q134 134 144 144 L144 150 Q130 154 120 146Z" fill={rune} />
    <g transform="translate(100 112)"><circle r="17" fill={s3} stroke={ln} strokeWidth="2.5" /><path d="M0 -11 L9 6 H-9 Z M0 -4 V4" fill="none" stroke={glow} strokeWidth="3" strokeLinejoin="round" /><g opacity=".5"><circle className="bx-glow" r="22" fill="none" stroke={glow} strokeWidth="1.2" /></g></g>
    <path d="M18 64 Q14 44 40 42 Q64 42 66 66 Q64 86 40 88 Q18 86 18 64Z M182 64 Q186 44 160 42 Q136 42 134 66 Q136 86 160 88 Q182 86 182 64Z" fill={s2} stroke={ln} strokeWidth="3.5" />
    <path d="M22 56 l12 -6 M30 74 l14 4 M170 52 l-10 -4 M168 74 l-12 6" stroke={ln} strokeWidth="2" opacity=".55" />
    <path d="M26 46 Q40 36 58 48 Q48 52 40 50 Q32 50 26 46Z M174 46 Q160 36 142 48 Q152 52 160 50 Q168 50 174 46Z" fill={rune} />
    <path d="M22 86 h34 l-4 46 h-28 Z M144 86 h34 l-2 46 h-28 Z" fill={s1} stroke={ln} strokeWidth="3" strokeLinejoin="round" />
    <path d="M14 128 Q12 116 26 114 H52 Q66 116 62 130 L60 152 Q40 160 20 152 Z M186 128 Q188 116 174 114 H148 Q134 116 138 130 L140 152 Q160 160 180 152 Z" fill={s2} stroke={ln} strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M24 136 h30 M24 145 h28 M146 136 h30 M148 145 h28" stroke={ln} strokeWidth="2" opacity=".5" />
    <path d="M66 54 Q64 22 100 18 Q136 22 134 54 Q132 66 100 68 Q68 66 66 54Z" fill={s1} stroke={ln} strokeWidth="3.5" />
    <path d="M70 36 Q100 26 130 36 L128 44 Q100 36 72 44 Z" fill={s3} stroke={ln} strokeWidth="2" />
    <path className="bx-eye" d="M78 46 h16 l-2 6 h-12 Z M106 46 h16 l-2 6 h-12 Z" fill={glow} />
    <path d="M76 44 L96 48 M124 44 L104 48" stroke={ln} strokeWidth="3" strokeLinecap="round" />
    <path d="M86 60 h28" stroke={ln} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M68 22 L74 4 L84 16 L92 0 L100 14 L108 0 L116 16 L126 4 L132 22 Z" fill={crown} stroke={crownLn} strokeWidth="2.5" strokeLinejoin="round" />
    <circle className="bx-eye" cx="100" cy="16" r="3.5" fill={glow} stroke={crownLn} strokeWidth="1.2" />
  </svg>;
}

/** 20층 수정 여왕 거미: a big violet queen — jointed legs with dark tips, a crystal cluster glowing on her back, a crystal
 *  tiara, six glowing eyes and fangs, a faint web behind her. */
export function TowerBossSpider({ size = 150 }: { size?: number }) {
  const legs = [[-1, 30], [-1, 50], [-1, 66], [-1, 80], [1, 30], [1, 50], [1, 66], [1, 80]] as const;
  return <svg viewBox="0 0 160 110" width={size} height={size * 110 / 160} role="img" aria-label="수정 여왕 거미">
    <g stroke="#cecbf6" strokeWidth=".8" fill="none" opacity=".7"><path d="M80 4 V40 M40 8 L80 40 L120 8 M20 30 L80 40 L140 30" /><path d="M56 14 Q80 24 104 14 M44 24 Q80 36 116 24" /></g>
    <ellipse cx="80" cy="104" rx="60" ry="5" fill="#000" opacity=".22" />
    {legs.map(([d, y], i) => { const x0 = 80 + d * 16, kx = 80 + d * (46 + (i % 4) * 4), ky = y - 18, fx = 80 + d * (64 + (i % 4) * 5), fy = y + 22;
      return <g key={i}><path d={`M${x0} ${y + 12} L${kx} ${ky} L${fx} ${fy}`} fill="none" stroke="#26215c" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" /><path d={`M${x0} ${y + 12} L${kx} ${ky} L${fx} ${fy}`} fill="none" stroke="#534ab7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={kx} cy={ky} r="2.6" fill="#7f77dd" /><path d={`M${fx} ${fy} l${d * 4} 6`} stroke="#111110" strokeWidth="3" strokeLinecap="round" /></g>; })}
    <ellipse cx="80" cy="74" rx="30" ry="24" fill="#3c3489" stroke="#26215c" strokeWidth="2.4" />
    <path d="M80 56 l6 10 -6 10 -6 -10z M80 78 l5 8 -5 8 -5 -8z" fill="#e24b4a" opacity=".85" />
    <g className="bx-eye" stroke="#185fa5" strokeWidth="1.4" strokeLinejoin="round"><path d="M60 62 l5 -22 7 20z" fill="#b5e3f4" /><path d="M70 58 l6 -30 8 28z" fill="#e6f7fd" /><path d="M84 58 l8 -26 6 26z" fill="#b5e3f4" /><path d="M94 62 l9 -16 3 18z" fill="#85b7eb" /></g>
    <circle className="bx-flick" cx="75" cy="40" r="2" fill="#ffffff" /><circle className="bx-flick" style={{ animationDelay: '.5s' }} cx="90" cy="46" r="1.5" fill="#ffffff" />
    <ellipse cx="80" cy="44" rx="16" ry="14" fill="#534ab7" stroke="#26215c" strokeWidth="2.2" transform="translate(0 4)" />
    <g stroke="#185fa5" strokeWidth="1.2" strokeLinejoin="round"><path d="M68 38 l3 -9 4 8z M76 35 l4 -12 4 12z M85 37 l4 -9 3 9z" fill="#e6f7fd" /></g>
    <circle cx="80" cy="25" r="2.2" fill="#e24b4a" />
    <g className="bx-eye" fill="#e24b4a"><circle cx="73" cy="46" r="3" /><circle cx="87" cy="46" r="3" /><circle cx="69" cy="52" r="2" /><circle cx="91" cy="52" r="2" /><circle cx="76" cy="40" r="1.6" /><circle cx="84" cy="40" r="1.6" /></g>
    <g fill="#fff"><circle cx="74" cy="45" r="1" /><circle cx="88" cy="45" r="1" /></g>
    <path d="M74 58 Q72 66 76 68 Q76 62 78 60 Z M86 58 Q88 66 84 68 Q84 62 82 60 Z" fill="#f1efe8" stroke="#26215c" strokeWidth="1" />
  </svg>;
}

/** 30층 스핑크스: a great golden lion lying with paws forward under a sun disk — a striped blue-gold headdress with the
 *  royal cobra, kohl-lined eyes looking straight ahead, a jewelled collar and a braided beard. */
export function TowerBossSphinx({ size = 150 }: { size?: number }) {
  return <svg viewBox="0 0 160 110" width={size} height={size * 110 / 160} role="img" aria-label="스핑크스">
    <g opacity=".35"><circle className="bx-glow" cx="66" cy="34" r="30" fill="#fac775" /></g><circle cx="66" cy="34" r="24" fill="none" stroke="#ef9f27" strokeWidth="1.4" opacity=".6" />
    <ellipse cx="82" cy="104" rx="66" ry="5" fill="#000" opacity=".22" />
    <path d="M150 96 Q158 80 148 74" fill="none" stroke="#ba7517" strokeWidth="4" strokeLinecap="round" /><path d="M146 72 l6 -4 1 7z" fill="#854f0b" />
    <path d="M60 100 Q58 66 96 62 H130 Q152 66 150 100 Z" fill="#ef9f27" stroke="#854f0b" strokeWidth="2" />
    <path d="M100 74 Q120 70 138 76 M98 84 Q120 80 142 86" stroke="#ba7517" strokeWidth="1.4" fill="none" opacity=".7" />
    <path d="M14 100 Q12 90 26 88 H62 V100 Z M30 92 h4 M40 92 h4 M50 92 h4" fill="#ef9f27" stroke="#854f0b" strokeWidth="2" />
    <path d="M40 54 Q42 20 66 16 Q90 20 92 54 L96 82 H36 Z" fill="#378add" stroke="#0c447c" strokeWidth="2.2" />
    <g stroke="#fac775" strokeWidth="3.4"><path d="M43 40 H89 M41 50 H91 M39 60 H93 M38 70 H94" /></g>
    <path d="M36 82 Q66 96 96 82 L92 76 Q66 88 40 76 Z" fill="#fac775" stroke="#854f0b" strokeWidth="1.4" />
    <g fill="#e24b4a"><circle cx="50" cy="83" r="1.6" /><circle cx="66" cy="87" r="1.8" /><circle cx="82" cy="83" r="1.6" /></g><g fill="#378add"><circle cx="58" cy="85.5" r="1.4" /><circle cx="74" cy="85.5" r="1.4" /></g>
    <path d="M50 30 Q52 22 66 22 Q80 22 82 30 L82 62 Q74 72 66 72 Q58 72 50 62 Z" fill="#fac775" stroke="#854f0b" strokeWidth="1.8" />
    <path d="M62 16 Q66 8 70 16 Q72 22 66 24 Q60 22 62 16 Z" fill="#e24b4a" stroke="#791f1f" strokeWidth="1.2" /><circle cx="66" cy="14" r="1.2" fill="#fac775" />
    <path d="M54 40 H62 M70 40 H78" stroke="#0c447c" strokeWidth="2" strokeLinecap="round" />
    <path d="M53 46 Q58 42 63 46 Q58 49 53 46 Z M69 46 Q74 42 79 46 Q74 49 69 46 Z" fill="#ffffff" stroke="#26215c" strokeWidth="1.4" />
    <circle cx="58" cy="46" r="2" fill="#26215c" /><circle cx="74" cy="46" r="2" fill="#26215c" />{[[22, 96, 0], [110, 98, .9], [140, 94, 1.7], [96, 100, 2.3]].map(([x, y, d], i) => <circle key={i} className="bx-rise" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r="1.3" fill="#fac775" />)}
    <path d="M52 47 l-3 2 M80 47 l3 2" stroke="#26215c" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M66 48 V56 Q64 58 62 57 M66 56 Q68 58 70 57" fill="none" stroke="#854f0b" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M60 62 Q66 65 72 62" fill="none" stroke="#633806" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M62 70 h8 v12 q-4 3 -8 0 Z" fill="#378add" stroke="#0c447c" strokeWidth="1.2" /><path d="M62 74 h8 M62 78 h8" stroke="#fac775" strokeWidth="1" />
  </svg>;
}

/** 40층 서리 용: an ice dragon rearing up — a crystal crown, ice spikes down its back, frost-edged wings with icicles,
 *  glowing eyes and an icy breath with snowflakes. */
export function TowerBossFrostDragon({ size = 150 }: { size?: number }) {
  const c = { body: '#b5d4f4', dark: '#185fa5', belly: '#ffffff', wing: '#e6f1fb', ice: '#85f0ff' };
  return <svg viewBox="0 0 160 110" width={size} height={size * 110 / 160} role="img" aria-label="서리 용">
    <ellipse cx="84" cy="104" rx="64" ry="5" fill="#000" opacity=".22" />
    <path d="M120 94 Q152 92 154 70 Q156 54 142 58 Q148 78 122 84Z" fill={c.body} stroke={c.dark} strokeWidth="1.6" /><path d="M146 56 l8 -8 l-1 12z" fill={c.ice} stroke={c.dark} strokeWidth="1" />
    <g className="bx-flap r"><path d="M70 46 Q66 2 106 6 Q96 22 112 30 Q100 30 102 42 Q90 36 84 50Z" fill={c.wing} stroke={c.dark} strokeWidth="1.6" />
    <path d="M78 42 L96 12 M84 46 L104 24 M90 48 L106 38" stroke={c.dark} strokeWidth="1" opacity=".55" />
    <path d="M96 12 l-2 8 3 -3z M104 26 l-1 7 3 -4z M108 32 l0 7 2 -5z" fill={c.ice} stroke={c.dark} strokeWidth=".6" /></g>
    <path d="M46 98 Q38 56 84 50 Q128 52 126 92 Q126 102 104 102 H60 Q48 102 46 98Z" fill={c.body} stroke={c.dark} strokeWidth="2" />
    <path d="M64 100 Q66 70 90 68 Q114 70 112 100Z" fill={c.belly} opacity=".95" /><path d="M68 76 h40 M66 84 h46 M66 92 h46" stroke={c.dark} strokeWidth=".8" opacity=".3" />
    {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${72 + i * 10} ${52 - Math.sin(i / 1.3) * 3} l4 -12 l5 12z`} fill={c.ice} stroke={c.dark} strokeWidth=".8" />)}
    <ellipse cx="64" cy="101" rx="9" ry="4" fill={c.dark} /><ellipse cx="108" cy="101" rx="9" ry="4" fill={c.dark} />
    <path d="M44 74 Q34 60 34 46" fill="none" stroke={c.body} strokeWidth="14" strokeLinecap="round" /><path d="M44 74 Q34 60 34 46" fill="none" stroke={c.dark} strokeWidth="1.6" opacity=".5" />
    <path d="M10 40 Q8 20 30 18 Q50 18 52 34 Q52 50 32 52 Q12 52 10 40Z" fill={c.body} stroke={c.dark} strokeWidth="2" />
    <path d="M22 20 Q16 4 26 0 Q26 10 32 18Z M40 19 Q44 4 54 2 Q48 12 46 20Z" fill={c.belly} stroke={c.dark} strokeWidth="1.2" />
    <path d="M24 18 l3 -10 4 8 4 -11 4 11 4 -8 2 10z" fill={c.ice} stroke={c.dark} strokeWidth="1" strokeLinejoin="round" />
    <path d="M22 30 l11 3 M48 30 l-11 3" stroke={c.dark} strokeWidth="2.4" strokeLinecap="round" />
    <ellipse className="bx-eye" cx="28" cy="36" rx="3.6" ry="4" fill={c.ice} /><ellipse className="bx-eye" cx="42" cy="36" rx="3.6" ry="4" fill={c.ice} /><rect x="27" y="33" width="2" height="6.5" rx="1" fill="#042c53" /><rect x="41" y="33" width="2" height="6.5" rx="1" fill="#042c53" />
    <path d="M12 44 q10 6 22 0 l-3 4 -3 -3 -3 4 -3 -4 -3 4 -3 -4z" fill="#fff" stroke={c.dark} strokeWidth="1" />
    <g opacity=".55"><path className="bx-glow" d="M10 46 Q-2 52 2 64 Q8 56 14 60 Q8 50 14 48Z" fill={c.ice} /></g>
    <g className="bx-flick" stroke={c.ice} strokeWidth="1.2" strokeLinecap="round"><path d="M4 70 v8 M0 74 h8 M1.2 71.2 l5.6 5.6 M6.8 71.2 l-5.6 5.6" /><path d="M14 80 v6 M11 83 h6" /></g>
  </svg>;
}

/* ---------------------------------------------- 51~100층 보스 (moving parts: bx-* in index.css) */

const Svg = ({ label, size, children }: { label: string; size: number; children: ReactNode }) =>
  <svg viewBox="0 0 160 110" width={size} height={size * 110 / 160} role="img" aria-label={label} style={{ overflow: 'visible' }}>{children}</svg>;
const embers = (pts: number[][], fill: string) => pts.map(([x, y, d], i) => <circle key={i} className="bx-rise" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r={1.6} fill={fill} />);

/** 60층 화염 드레이크: a red dragon rearing over a lava pool — flame-veined wings, horns, molten belly, burning eyes, a fire breath. */
export function BossFireDrake({ size = 150 }: { size?: number }) {
  return <Svg label="화염 드레이크" size={size}>
    <g opacity=".1"><ellipse className="bx-glow" cx="86" cy="58" rx="70" ry="48" fill="#f97316" /></g>
    <path d="M30 104 Q80 94 150 104 Q80 112 30 104Z" fill="#f97316" /><path d="M44 104 q10 -4 20 0 M90 102 q12 -4 24 0" stroke="#fde047" strokeWidth="1.6" fill="none" />
    <g className="bx-flap l"><path d="M70 50 Q40 4 4 10 Q20 20 14 30 Q28 28 26 40 Q40 36 40 50 Q54 44 62 58Z" fill="#b91c1c" stroke="#f97316" strokeWidth="1.6" /><path d="M66 50 L10 12 M62 54 L24 32 M60 56 L40 46" stroke="#f97316" strokeWidth="1.2" /><path d="M14 30 Q22 22 20 14 M26 40 Q34 32 30 24" stroke="#fde047" strokeWidth=".8" fill="none" /></g>
    <g className="bx-flap r"><path d="M104 46 Q126 0 158 6 Q144 18 152 28 Q138 28 142 40 Q128 36 126 50 Q114 44 108 58Z" fill="#b91c1c" stroke="#f97316" strokeWidth="1.6" /><path d="M108 48 L154 8 M110 52 L146 30 M112 56 L130 46" stroke="#f97316" strokeWidth="1.2" /></g>
    <path d="M120 96 Q150 94 152 74 Q154 60 140 64 Q146 82 122 86Z" fill="#b91c1c" stroke="#2a0a0a" strokeWidth="1.6" /><path className="bx-flick" d="M140 62 Q136 50 144 44 Q144 52 150 50 Q150 60 140 62Z" fill="#fb923c" />
    <path d="M52 100 Q44 58 86 52 Q128 54 126 94 Q126 102 106 102 H64 Q54 102 52 100Z" fill="#dc2626" stroke="#2a0a0a" strokeWidth="2" />
    <path d="M70 100 Q72 72 92 70 Q112 72 110 100Z" fill="#fdba74" /><path className="bx-flick" d="M76 78 l6 6 -4 6 6 6 M104 78 l-5 7 4 5 -5 7" stroke="#facc15" strokeWidth="1.6" fill="none" />
    {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${74 + i * 10} ${54 - Math.sin(i / 1.3) * 3} l4 -11 l5 11z`} fill="#fbbf24" stroke="#78350f" strokeWidth=".8" />)}
    <ellipse cx="68" cy="101" rx="9" ry="4" fill="#450a0a" /><ellipse cx="108" cy="101" rx="9" ry="4" fill="#450a0a" />
    <path d="M50 76 Q38 62 38 48" fill="none" stroke="#dc2626" strokeWidth="14" strokeLinecap="round" />
    <path d="M14 42 Q12 22 34 20 Q54 20 56 36 Q56 52 36 54 Q16 54 14 42Z" fill="#ef4444" stroke="#2a0a0a" strokeWidth="2" />
    <path d="M26 22 Q14 2 26 -4 Q26 10 34 20Z M44 21 Q50 2 62 0 Q54 12 50 22Z" fill="#fde68a" stroke="#78350f" strokeWidth="1.2" />
    <path d="M26 32 l11 3 M52 32 l-11 3" stroke="#2a0a0a" strokeWidth="2.6" strokeLinecap="round" />
    <ellipse className="bx-eye" cx="32" cy="38" rx="3.8" ry="4" fill="#fde047" /><ellipse className="bx-eye" cx="46" cy="38" rx="3.8" ry="4" fill="#fde047" /><rect x="31" y="35" width="2" height="6.5" rx="1" fill="#2a0a0a" /><rect x="45" y="35" width="2" height="6.5" rx="1" fill="#2a0a0a" />
    <path d="M16 46 q10 6 22 0 l-3 4 -3 -3 -3 4 -3 -4 -3 4 -3 -4z" fill="#fff" stroke="#2a0a0a" strokeWidth="1" />
    <g className="bx-flick"><path d="M14 48 Q-6 50 -10 64 Q0 58 4 66 Q6 56 14 54Z" fill="#f97316" /><path d="M12 50 Q0 54 -2 62 Q6 58 8 62 Q8 56 12 54Z" fill="#fde047" /></g>
    {embers([[40, 100, 0], [96, 98, .7], [130, 100, 1.4], [70, 96, 2], [150, 90, .4]], '#fb923c')}
  </Svg>;
}

/** 70층 크라켄: a giant rising from the sea — eight curling tentacles, glowing slit eyes, a coral crown, waves and bubbles. */
export function BossKraken({ size = 150 }: { size?: number }) {
  const t = (d: string, cls = 'bx-sway', delay = 0) => <path className={cls} style={{ animationDelay: `${delay}s` }} d={d} fill="none" stroke="#7e22ce" strokeWidth="9" strokeLinecap="round" />;
  return <Svg label="크라켄" size={size}>
    <g opacity=".16"><ellipse className="bx-glow" cx="80" cy="50" rx="72" ry="46" fill="#a855f7" /></g>
    {t('M30 96 Q6 80 14 56 Q20 40 8 30', 'bx-sway', 0)}{t('M130 96 Q154 80 146 56 Q140 40 152 30', 'bx-sway', .8)}
    {t('M44 98 Q24 70 34 50 Q40 38 30 26', 'bx-sway', 1.4)}{t('M116 98 Q136 70 126 50 Q120 38 130 26', 'bx-sway', .4)}
    <path d="M28 70 l0 0 M16 52 l0 0" stroke="#e9d5ff" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M38 76 Q34 26 80 18 Q126 26 122 76 Q112 92 80 92 Q48 92 38 76Z" fill="#9333ea" stroke="#3b0764" strokeWidth="2.2" />
    <ellipse cx="62" cy="36" rx="6" ry="4" fill="#c084fc" /><ellipse cx="100" cy="32" rx="4" ry="3" fill="#c084fc" /><ellipse cx="80" cy="28" rx="3" ry="2" fill="#c084fc" />
    <path d="M56 22 L60 8 L66 18 L72 2 L78 16 L80 0 L82 16 L88 2 L94 18 L100 8 L104 22Z" fill="#fb7185" stroke="#9f1239" strokeWidth="1.2" />
    {[[60, 8], [72, 2], [80, 0], [88, 2], [100, 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth=".5" />)}
    <path d="M54 50 l16 5 M106 50 l-16 5" stroke="#3b0764" strokeWidth="3" strokeLinecap="round" />
    <ellipse className="bx-eye" cx="64" cy="60" rx="9" ry="8" fill="#fef08a" stroke="#3b0764" strokeWidth="1.6" /><ellipse className="bx-eye" cx="96" cy="60" rx="9" ry="8" fill="#fef08a" stroke="#3b0764" strokeWidth="1.6" />
    <ellipse cx="64" cy="61" rx="2.4" ry="6" fill="#1e1b4b" /><ellipse cx="96" cy="61" rx="2.4" ry="6" fill="#1e1b4b" />
    <path d="M66 76 Q80 84 94 76" fill="none" stroke="#3b0764" strokeWidth="2.4" />
    {t('M58 92 Q50 104 60 108', '', 0)}{t('M80 92 Q80 106 86 108', '', 0)}{t('M102 92 Q110 104 100 108', '', 0)}
    <path d="M0 98 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0 V110 H0Z" fill="#0e7490" opacity=".85" />
    <path d="M0 98 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0 q10 -6 20 0 q10 6 20 0" stroke="#a5f3fc" strokeWidth="1.4" fill="none" />
    {[[20, 92, 0], [140, 90, .9], [46, 86, 1.7], [118, 84, 2.2], [80, 96, 1.1]].map(([x, y, d], i) => <circle key={i} className="bx-rise" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r="2.2" fill="none" stroke="#a5f3fc" strokeWidth=".9" />)}
  </Svg>;
}

/** 80층 폭풍의 그리핀: wings spread wide over storm clouds, a feathered crest, glowing blue eyes, talons, lightning. */
export function BossStormGriffin({ size = 150 }: { size?: number }) {
  return <Svg label="폭풍의 그리핀" size={size}>
    <path d="M10 30 Q14 14 34 18 Q42 4 62 10 Q80 0 98 10 Q118 4 128 18 Q150 14 152 32 Q140 40 120 36 Q100 44 80 38 Q60 46 40 38 Q20 42 10 30Z" fill="#475569" opacity=".55" />
    <path className="bx-flick" d="M30 34 l-6 14 6 0 -8 16 M132 34 l6 12 -6 0 8 16" stroke="#fde047" strokeWidth="2.4" fill="none" strokeLinejoin="round" />
    <g className="bx-flap l"><path d="M70 60 Q40 20 2 26 Q12 34 6 42 Q20 42 16 52 Q30 50 28 60 Q42 56 46 66 Q58 60 66 70Z" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1.8" />{[0, 1, 2, 3].map(i => <path key={i} d={`M${8 + i * 10} ${32 + i * 8} q10 2 16 8`} stroke="#93c5fd" strokeWidth="1" fill="none" />)}</g>
    <g className="bx-flap r"><path d="M90 60 Q120 20 158 26 Q148 34 154 42 Q140 42 144 52 Q130 50 132 60 Q118 56 114 66 Q102 60 94 70Z" fill="#1e3a8a" stroke="#0f172a" strokeWidth="1.8" />{[0, 1, 2, 3].map(i => <path key={i} d={`M${152 - i * 10} ${32 + i * 8} q-10 2 -16 8`} stroke="#93c5fd" strokeWidth="1" fill="none" />)}</g>
    <path d="M52 104 Q46 70 80 64 Q114 70 108 104Z" fill="#334155" stroke="#0f172a" strokeWidth="2" /><path d="M64 80 q16 8 32 0 M62 90 q18 8 36 0" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
    <path d="M56 104 l-4 4 M60 104 l0 5 M64 104 l4 4 M96 104 l-4 4 M100 104 l0 5 M104 104 l4 4" stroke="#facc15" strokeWidth="2" strokeLinecap="round" />
    <path d="M58 48 Q58 22 80 20 Q102 22 102 48 Q100 66 80 68 Q60 66 58 48Z" fill="#f1f5f9" stroke="#0f172a" strokeWidth="2" />
    <path d="M62 24 L54 4 L68 18 L72 0 L78 16 L84 0 L88 18 L102 4 L98 24" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M70 6 L74 -4 L80 4 L86 -4 L90 6Z" fill="#facc15" stroke="#a16207" strokeWidth="1" />
    <path d="M64 38 l10 3 M96 38 l-10 3" stroke="#0f172a" strokeWidth="2.6" strokeLinecap="round" />
    <ellipse className="bx-eye" cx="70" cy="45" rx="4.4" ry="4.6" fill="#38bdf8" /><ellipse className="bx-eye" cx="90" cy="45" rx="4.4" ry="4.6" fill="#38bdf8" /><circle cx="70" cy="45" r="1.6" fill="#0f172a" /><circle cx="90" cy="45" r="1.6" fill="#0f172a" />
    <path d="M80 48 L70 60 Q80 66 90 60 Z" fill="#fbbf24" stroke="#78350f" strokeWidth="1.4" /><path d="M76 60 L80 66 L84 60" fill="#f59e0b" />
    <g className="bx-spin"><path d="M18 84 q8 -10 18 -4 q-8 2 -6 8 M128 82 q10 -8 18 0 q-8 0 -8 6" stroke="#bae6fd" strokeWidth="1.6" fill="none" strokeLinecap="round" /></g>
  </Svg>;
}

/** 90층 성운 고래: a cosmic whale crossing the night — a galaxy on its body, stars inside, a halo, planets going round. */
export function BossNebulaWhale({ size = 150 }: { size?: number }) {
  const clip = `bxw${useId().replace(/:/g, '')}`; // its own id: the 도감 and the battle can show it at once
  return <Svg label="성운 고래" size={size}>
    <g opacity=".16"><ellipse className="bx-glow" cx="80" cy="56" rx="76" ry="44" fill="#7c3aed" /></g>
    <g className="bx-spin"><ellipse cx="62" cy="10" rx="18" ry="4.5" fill="none" stroke="#fde68a" strokeWidth="1.4" strokeDasharray="4 3" /></g>
    <path d="M6 62 Q8 22 62 18 Q116 18 124 48 Q138 34 140 18 Q150 30 148 44 Q160 40 158 54 Q146 56 134 62 Q128 92 74 96 Q12 96 6 62Z" fill="#312e81" stroke="#1e1b4b" strokeWidth="2.2" />
    <clipPath id={clip}><path d="M6 62 Q8 22 62 18 Q116 18 124 48 Q128 92 74 96 Q12 96 6 62Z" /></clipPath>
    <g clipPath={`url(#${clip})`}>
      <ellipse cx="48" cy="46" rx="26" ry="14" fill="#7c3aed" opacity=".6" /><ellipse cx="88" cy="62" rx="24" ry="12" fill="#db2777" opacity=".45" /><ellipse cx="70" cy="40" rx="14" ry="6" fill="#38bdf8" opacity=".35" />
      <g className="bx-spin"><path d="M80 52 m-12 0 a12 6 0 1 0 24 0 a8 4 0 1 0 -16 0" stroke="#f5d0fe" strokeWidth="1.2" fill="none" /></g>
      {[[24, 44, 0], [40, 32, .5], [58, 54, 1], [76, 34, 1.5], [96, 46, .3], [110, 60, .8], [44, 64, 1.2], [70, 72, .6]].map(([x, y, d], i) => <circle key={i} className="bx-eye" style={{ animationDelay: `${d}s` }} cx={x} cy={y} r="1.2" fill="#fff" />)}
    </g>
    <path d="M12 72 Q70 92 130 72 Q74 106 12 72Z" fill="#c7d2fe" stroke="#1e1b4b" strokeWidth="1.2" /><path d="M30 80 v6 M44 84 v7 M58 86 v7 M72 87 v7 M86 86 v6 M100 83 v6" stroke="#818cf8" strokeWidth="1" />
    <path d="M60 86 Q66 100 82 100 Q72 92 72 84Z" fill="#312e81" stroke="#1e1b4b" strokeWidth="1.4" />
    <circle cx="30" cy="58" r="5.6" fill="#fff" /><circle cx="31" cy="58" r="2.8" fill="#1e1b4b" /><circle cx="29" cy="56.6" r="1" fill="#fff" />
    <path d="M60 18 Q54 4 60 -4 M66 18 Q66 2 74 -6 M72 18 Q78 6 88 4" stroke="#f0abfc" strokeWidth="2" fill="none" strokeLinecap="round" />
    {[[60, -4], [74, -6], [88, 4]].map(([x, y], i) => <path key={i} className="bx-eye" style={{ animationDelay: `${i * .5}s` }} d={`M${x} ${y - 4} l1.2 3 3 .2 -2.4 2 .8 3 -2.6 -1.6 -2.6 1.6 .8 -3 -2.4 -2 3 -.2z`} fill="#fde68a" />)}
    <g className="bx-orbit"><circle cx="152" cy="52" r="5" fill="#f9a8d4" /><ellipse cx="152" cy="52" rx="9" ry="2.2" fill="none" stroke="#fde68a" strokeWidth=".9" /><circle cx="8" cy="52" r="3.4" fill="#a5b4fc" /><circle cx="80" cy="104" r="2.6" fill="#fde68a" /></g>
  </Svg>;
}

/** 100층 태초의 용왕: the last boss — a black-and-gold dragon on its throne of rock, wings across the sky, a crown with red
 *  gems, six horns, burning red eyes, golden flames behind and gems going round. */
export function BossDragonKing({ size = 150 }: { size?: number }) {
  return <Svg label="태초의 용왕" size={size}>
    <g className="bx-glow">{[18, 42, 66, 94, 118, 142].map((x, i) => <path key={i} d={`M${x} 92 Q${x - 8} 70 ${x} 52 Q${x + 4} 66 ${x + 8} 60 Q${x + 12} 76 ${x} 92Z`} fill="#f59e0b" opacity=".35" />)}</g>
    <g className="bx-flap l"><path d="M66 56 L28 4 L2 18 Q14 26 8 38 Q20 36 18 48 Q30 46 30 58 Q44 54 50 66Z" fill="#111827" stroke="#f59e0b" strokeWidth="1.8" /><path d="M64 58 L28 4 M28 4 L18 48 M28 4 L30 58 M28 4 L8 38" stroke="#f59e0b" strokeWidth="1" /></g>
    <g className="bx-flap r"><path d="M94 56 L132 4 L158 18 Q146 26 152 38 Q140 36 142 48 Q130 46 130 58 Q116 54 110 66Z" fill="#111827" stroke="#f59e0b" strokeWidth="1.8" /><path d="M96 58 L132 4 M132 4 L142 48 M132 4 L130 58 M132 4 L152 38" stroke="#f59e0b" strokeWidth="1" /></g>
    <path d="M28 108 L38 92 L56 96 L66 86 L94 86 L104 96 L122 92 L132 108Z" fill="#374151" stroke="#111827" strokeWidth="1.6" /><path d="M66 86 h28 v-4 h-28z" fill="#f59e0b" />
    <path d="M50 100 Q44 62 80 56 Q116 62 110 100Z" fill="#1f2937" stroke="#f59e0b" strokeWidth="2" />
    {[66, 74, 82].map((y, r) => Array.from({ length: 5 }, (_, i) => <path key={`${r}-${i}`} d={`M${60 + i * 8 + (r % 2) * 4} ${y} q4 5 8 0`} stroke="#f59e0b" strokeWidth="1.1" fill="none" />))}
    <path d="M66 96 Q80 88 94 96" stroke="#fde68a" strokeWidth="2" fill="none" />
    <path d="M58 32 Q58 14 80 12 Q102 14 102 32 Q102 54 80 56 Q58 54 58 32Z" fill="#111827" stroke="#f59e0b" strokeWidth="2.2" />
    <path d="M60 22 Q42 6 46 -10 Q54 6 66 14Z M100 22 Q118 6 114 -10 Q106 6 94 14Z" fill="#f59e0b" stroke="#78350f" strokeWidth="1.2" />
    <path d="M58 32 Q46 26 44 14 Q52 22 60 24Z M102 32 Q114 26 116 14 Q108 22 100 24Z" fill="#d97706" stroke="#78350f" strokeWidth="1" />
    <path d="M66 14 L68 0 L73 8 L80 -6 L87 8 L92 0 L94 14Z" fill="#fde68a" stroke="#92400e" strokeWidth="1.2" />
    <circle cx="80" cy="4" r="2.6" fill="#dc2626" stroke="#7f1d1d" strokeWidth=".6" /><circle cx="70" cy="8" r="1.6" fill="#dc2626" /><circle cx="90" cy="8" r="1.6" fill="#dc2626" />
    <path d="M64 30 l11 3 M96 30 l-11 3" stroke="#f59e0b" strokeWidth="2.6" strokeLinecap="round" />
    <path className="bx-eye" d="M66 36 L76 37 L68 42Z M94 36 L84 37 L92 42Z" fill="#ef4444" />
    <path d="M66 46 q14 8 28 0 l-3 4 -3 -3 -3 4 -2 -4 -2 4 -3 -4 -3 4 -3 -4 -3 3z" fill="#fff" stroke="#111827" strokeWidth=".8" />
    <path d="M72 54 L80 62 L88 54" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
    <g className="bx-orbit">{[[150, 52, '#dc2626'], [10, 52, '#f59e0b'], [80, 108, '#dc2626']].map(([x, y, c], i) => <path key={i} d={`M${x} ${Number(y) - 4} l3 4 -3 4 -3 -4z`} fill={String(c)} stroke="#fde68a" strokeWidth=".6" />)}</g>
    {embers([[30, 90, 0], [130, 92, .8], [56, 94, 1.5], [104, 94, 2.1]], '#fde68a')}
  </Svg>;
}
