import type { TowerMonsterKind } from '../../lib/petCatalog';

// 채움의 탑 monsters: flat, friendly shapes (a boss is bigger and wears a crown).
const GOLEMS = {
  golem: { s1: '#a8a496', s2: '#8f8b80', ln: '#3e3b35', moss: '#639922', eye: '#fac775', eyeLn: '#ba7517' },
  obsidian_golem: { s1: '#4a4740', s2: '#3a3832', ln: '#141311', moss: '#534ab7', eye: '#afa9ec', eyeLn: '#534ab7' },
  gold_golem: { s1: '#e8c46a', s2: '#c9a24a', ln: '#633806', moss: '#ba7517', eye: '#e24b4a', eyeLn: '#a32d2d' },
};
export function TowerMonster({ kind, boss = false, size = 84, asleep = false }: { kind: TowerMonsterKind; boss?: boolean; size?: number; asleep?: boolean }) {
  const eyes = (y: number, gap = 10) => asleep ? <path d={`M${44 - gap} ${y} q6 4 12 0 M${44 + gap} ${y} q6 4 12 0`} fill="none" stroke="#26215c" strokeWidth="2.4" strokeLinecap="round" /> : <><circle cx={50 - gap} cy={y} r="4" fill="#26215c" /><circle cx={50 + gap} cy={y} r="4" fill="#26215c" /><circle cx={51 - gap} cy={y - 1.5} r="1.3" fill="#fff" /><circle cx={51 + gap} cy={y - 1.5} r="1.3" fill="#fff" /></>;
  // 골렘 (a floor monster): a smaller cousin of the 수문장 — rounded stone blocks, moss, round eyes, little fists. The same
  // shape comes in obsidian (floor 11+) and gold (floor 21+).
  const golemArt = (P: typeof GOLEMS.golem) => <><path d="M38 70 h9 v10 h-11 Z M53 70 h9 l1 10 h-11 Z" fill={P.s2} stroke={P.ln} strokeWidth="1.8" /><path d="M26 46 Q26 36 36 35 H64 Q74 36 74 46 L72 72 Q50 78 28 72 Z" fill={P.s1} stroke={P.ln} strokeWidth="2" strokeLinejoin="round" /><path d="M32 58 h12 M56 58 h12 M50 38 v8" stroke={P.ln} strokeWidth="1.2" opacity=".5" /><path d="M30 68 Q36 62 44 69 Q38 73 30 72Z" fill={P.moss} /><path d="M14 46 Q12 38 22 37 Q32 37 32 47 Q31 55 22 56 Q14 55 14 46Z M86 46 Q88 38 78 37 Q68 37 68 47 Q69 55 78 56 Q86 55 86 46Z" fill={P.s2} stroke={P.ln} strokeWidth="2" /><path d="M16 39 Q22 34 30 40 Q24 42 16 39Z" fill={P.moss} /><path d="M16 56 h12 l-1 12 h-11 Z M72 56 h12 l-1 12 h-11 Z" fill={P.s1} stroke={P.ln} strokeWidth="1.8" /><path d="M36 34 Q35 18 50 16 Q65 18 64 34 Q63 40 50 41 Q37 40 36 34Z" fill={P.s1} stroke={P.ln} strokeWidth="2" /><path d="M39 22 Q50 18 61 22" stroke={P.ln} strokeWidth="1.2" fill="none" opacity=".5" /><path d="M40 18 Q46 13 54 17 Q48 20 40 18Z" fill={P.moss} />{asleep ? <path d="M41 29 q4 3 8 0 M51 29 q4 3 8 0" fill="none" stroke={P.ln} strokeWidth="2" strokeLinecap="round" /> : <><circle cx="44" cy="29" r="3.6" fill={P.eye} stroke={P.eyeLn} strokeWidth="1" /><circle cx="56" cy="29" r="3.6" fill={P.eye} stroke={P.eyeLn} strokeWidth="1" /><circle cx="45" cy="28" r="1.2" fill="#fff" /><circle cx="57" cy="28" r="1.2" fill="#fff" /></>}<path d="M46 36 h8" stroke={P.ln} strokeWidth="1.6" strokeLinecap="round" /></>;
  const body = {
    slime: <><path d="M18 78 Q14 40 50 30 Q86 40 82 78 Z" fill="#97c459" stroke="#3b6d11" strokeWidth="2" /><ellipse cx="38" cy="46" rx="6" ry="4" fill="#fff" opacity=".5" />{eyes(58)}<path d="M44 68 q6 4 12 0" fill="none" stroke="#3b6d11" strokeWidth="2" strokeLinecap="round" /></>,
    bat: <><path d="M50 40 L14 30 Q22 50 18 62 Q30 52 38 60 Z M50 40 L86 30 Q78 50 82 62 Q70 52 62 60 Z" fill="#7f77dd" stroke="#3c3489" strokeWidth="2" strokeLinejoin="round" /><circle cx="50" cy="52" r="17" fill="#534ab7" stroke="#3c3489" strokeWidth="2" /><path d="M38 38 l4 -10 4 8 M62 38 l-4 -10 -4 8" fill="#534ab7" stroke="#3c3489" strokeWidth="2" />{eyes(50, 7)}<path d="M45 60 l2 4 2 -4 M51 60 l2 4 2 -4" fill="#fff" /></>,
    mushroom: <><rect x="36" y="52" width="28" height="28" rx="10" fill="#f1efe8" stroke="#888780" strokeWidth="2" /><path d="M14 56 Q16 22 50 20 Q84 22 86 56 Z" fill="#e24b4a" stroke="#a32d2d" strokeWidth="2" /><circle cx="34" cy="38" r="5" fill="#fff" /><circle cx="60" cy="32" r="6" fill="#fff" /><circle cx="70" cy="46" r="4" fill="#fff" />{eyes(64, 7)}</>,
    fairy: <><path d="M50 50 Q28 26 20 40 Q18 56 46 56 Z M50 50 Q72 26 80 40 Q82 56 54 56 Z" fill="#cecbf6" stroke="#7f77dd" strokeWidth="1.6" opacity=".9" /><circle cx="50" cy="44" r="12" fill="#fbeaf0" stroke="#d4537e" strokeWidth="2" /><path d="M38 40 Q50 26 62 40" fill="#ed93b1" stroke="#d4537e" strokeWidth="1.5" /><path d="M44 56 L50 80 L56 56 Z" fill="#d4537e" />{eyes(46, 5)}<circle cx="68" cy="22" r="2" fill="#fac775" /><circle cx="30" cy="20" r="1.5" fill="#fac775" /></>,
    shadow: <><ellipse cx="50" cy="56" rx="24" ry="26" fill="#2c2c2a" opacity=".85" /><circle cx="42" cy="50" r="3.5" fill="#e24b4a" /><circle cx="58" cy="50" r="3.5" fill="#e24b4a" /></>,
    golem: golemArt(GOLEMS.golem),
    obsidian_golem: golemArt(GOLEMS.obsidian_golem),
    gold_golem: golemArt(GOLEMS.gold_golem),
    gatekeeper: <></>,
  }[kind];
  return <svg viewBox="0 0 100 90" width={boss ? size * 1.25 : size} height={(boss ? size * 1.25 : size) * 0.9} role="img" aria-label={boss ? '보스 몬스터' : '몬스터'}>
    <ellipse cx="50" cy="84" rx="30" ry="4" fill="#000" opacity=".12" />
    {body}
    {boss && <path d="M34 26 l4 -12 6 8 6 -10 6 10 6 -8 4 12 z" fill="#fac775" stroke="#ba7517" strokeWidth="1.5" strokeLinejoin="round" />}
  </svg>;
}
