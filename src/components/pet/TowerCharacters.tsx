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
];
/** 드래곤: horns, spines, folded wings, a long tail; curled up asleep (closed eyes, Zz) or awake and fierce. */
export function TowerDragon({ color = 0, asleep = true, size = 150 }: { color?: number; asleep?: boolean; size?: number }) {
  const c = DRAGON_COLORS[color % DRAGON_COLORS.length];
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
    <g transform="translate(100 112)"><circle r="17" fill={s3} stroke={ln} strokeWidth="2.5" /><path d="M0 -11 L9 6 H-9 Z M0 -4 V4" fill="none" stroke={glow} strokeWidth="3" strokeLinejoin="round" /><circle r="22" fill="none" stroke={glow} strokeWidth="1.2" opacity=".5" /></g>
    <path d="M18 64 Q14 44 40 42 Q64 42 66 66 Q64 86 40 88 Q18 86 18 64Z M182 64 Q186 44 160 42 Q136 42 134 66 Q136 86 160 88 Q182 86 182 64Z" fill={s2} stroke={ln} strokeWidth="3.5" />
    <path d="M22 56 l12 -6 M30 74 l14 4 M170 52 l-10 -4 M168 74 l-12 6" stroke={ln} strokeWidth="2" opacity=".55" />
    <path d="M26 46 Q40 36 58 48 Q48 52 40 50 Q32 50 26 46Z M174 46 Q160 36 142 48 Q152 52 160 50 Q168 50 174 46Z" fill={rune} />
    <path d="M22 86 h34 l-4 46 h-28 Z M144 86 h34 l-2 46 h-28 Z" fill={s1} stroke={ln} strokeWidth="3" strokeLinejoin="round" />
    <path d="M14 128 Q12 116 26 114 H52 Q66 116 62 130 L60 152 Q40 160 20 152 Z M186 128 Q188 116 174 114 H148 Q134 116 138 130 L140 152 Q160 160 180 152 Z" fill={s2} stroke={ln} strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M24 136 h30 M24 145 h28 M146 136 h30 M148 145 h28" stroke={ln} strokeWidth="2" opacity=".5" />
    <path d="M66 54 Q64 22 100 18 Q136 22 134 54 Q132 66 100 68 Q68 66 66 54Z" fill={s1} stroke={ln} strokeWidth="3.5" />
    <path d="M70 36 Q100 26 130 36 L128 44 Q100 36 72 44 Z" fill={s3} stroke={ln} strokeWidth="2" />
    <path d="M78 46 h16 l-2 6 h-12 Z M106 46 h16 l-2 6 h-12 Z" fill={glow} />
    <path d="M76 44 L96 48 M124 44 L104 48" stroke={ln} strokeWidth="3" strokeLinecap="round" />
    <path d="M86 60 h28" stroke={ln} strokeWidth="2.5" strokeLinecap="round" />
    <path d="M68 22 L74 4 L84 16 L92 0 L100 14 L108 0 L116 16 L126 4 L132 22 Z" fill={crown} stroke={crownLn} strokeWidth="2.5" strokeLinejoin="round" />
    <circle cx="100" cy="16" r="3.5" fill={glow} stroke={crownLn} strokeWidth="1.2" />
  </svg>;
}
