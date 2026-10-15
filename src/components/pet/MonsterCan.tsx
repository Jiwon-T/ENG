// 탈진 회복 간식 '몬스터': a pink can with a little monster face and a tiny '채움 몬스터' label (our own design).
export function MonsterCan({ size = 28 }: { size?: number }) {
  return <svg viewBox="0 0 60 86" width={size * 60 / 86} height={size} role="img" aria-label="채움 몬스터">
    <rect x="13" y="6" width="34" height="5" rx="2" fill="#b4b2a9" />
    <rect x="11" y="10" width="38" height="70" rx="7" fill="#d4537e" stroke="#72243e" strokeWidth="1.5" />
    <rect x="11" y="28" width="38" height="30" fill="#fff" />
    <path d="M19 47l4-12 5 8 4-8 5 12" fill="none" stroke="#72243e" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    <circle cx="24" cy="40" r="1.4" fill="#72243e" /><circle cx="36" cy="40" r="1.4" fill="#72243e" />
    <text x="30" y="55" textAnchor="middle" fontSize="5" fontWeight="700" fill="#72243e">채움 몬스터</text>
    <rect x="16" y="66" width="28" height="6" rx="3" fill="#fbeaf0" />
    <text x="30" y="70.6" textAnchor="middle" fontSize="4" fontWeight="700" fill="#72243e">+50</text>
    <rect x="14" y="13" width="3" height="60" rx="1.5" fill="#fff" opacity=".35" />
  </svg>;
}
