import React from 'react';

// Room scenes drawn behind the pet: 원정대 보상 배경 and the shop rooms (핑크 쿠션·작은 침대·미니 책상).
// 230×190 grid; the pet stands on the ground strip at the bottom.
const Star = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -5 l1.5 3.5 l3.5 .6 l-2.6 2.2 l.7 3.6 l-3.1 -1.8 l-3.1 1.8 l.7 -3.6 l-2.6 -2.2 l3.5 -.6z" fill="#ffd166" />;

const SCENES: Record<string, React.ReactNode> = {
  forest_cabin: <>
    <rect width="230" height="190" fill="#eef6ea" /><rect y="150" width="230" height="40" fill="#dcebd3" />
    <path d="M18 150 L34 104 L50 150Z" fill="#9cc58f" /><path d="M24 128 L34 96 L44 128Z" fill="#b4d6a8" /><rect x="32" y="150" width="4" height="8" fill="#a07a5a" />
    <path d="M190 150 L204 112 L218 150Z" fill="#9cc58f" /><rect x="202" y="150" width="4" height="7" fill="#a07a5a" />
    <rect x="148" y="104" width="44" height="46" rx="3" fill="#e8c9a3" stroke="#cfa77c" /><path d="M142 106 L170 82 L198 106Z" fill="#d9776d" />
    <rect x="164" y="124" width="12" height="26" rx="5" fill="#b58358" /><rect x="152" y="112" width="9" height="9" rx="2" fill="#fff6c8" stroke="#cfa77c" /><rect x="180" y="112" width="9" height="9" rx="2" fill="#fff6c8" stroke="#cfa77c" />
    <circle cx="60" cy="40" r="2" fill="#fff7b0" /><circle cx="96" cy="58" r="1.6" fill="#fff7b0" /><circle cx="130" cy="34" r="2" fill="#fff7b0" />
    <ellipse cx="66" cy="158" rx="9" ry="4" fill="#f2a7b8" /><ellipse cx="62" cy="155" rx="4" ry="3" fill="#ffd166" />
  </>,
  coral_sea: <>
    <rect width="230" height="190" fill="#e6f2fb" /><path d="M0 40 Q30 32 60 40 T120 40 T180 40 T230 40" fill="none" stroke="#cfe5f6" strokeWidth="3" /><rect y="156" width="230" height="34" fill="#f6ead2" />
    <path d="M26 158 Q22 130 30 120 M30 140 Q38 128 44 126 M26 146 Q16 138 14 128" fill="none" stroke="#f49bb0" strokeWidth="5" strokeLinecap="round" />
    <path d="M196 158 Q200 132 192 118 M196 140 Q206 132 210 124" fill="none" stroke="#f7b267" strokeWidth="5" strokeLinecap="round" />
    <path d="M168 158 Q164 146 170 138 Q176 146 172 158" fill="#8fd1b4" /><path d="M52 158 Q48 148 54 140 Q60 148 56 158" fill="#8fd1b4" />
    <circle cx="70" cy="70" r="5" fill="none" stroke="#bfe0f5" strokeWidth="1.5" /><circle cx="80" cy="54" r="3" fill="none" stroke="#bfe0f5" strokeWidth="1.5" /><circle cx="160" cy="80" r="4" fill="none" stroke="#bfe0f5" strokeWidth="1.5" />
    <g transform="translate(140 60)"><ellipse cx="0" cy="0" rx="9" ry="6" fill="#ffc46b" /><path d="M8 0 L15 -5 L15 5Z" fill="#ffc46b" /><circle cx="-4" cy="-1" r="1.2" fill="#2f2228" /></g>
    <path d="M108 160 l4 -8 l4 8z M118 160 l4 -6 l4 6z" fill="#f2a7b8" />
  </>,
  cloud_castle: <>
    <rect width="230" height="190" fill="#f1eefb" />
    <g fill="#fff"><ellipse cx="40" cy="160" rx="40" ry="16" /><ellipse cx="110" cy="166" rx="60" ry="16" /><ellipse cx="196" cy="160" rx="40" ry="16" /></g>
    <rect x="150" y="84" width="46" height="66" fill="#e6defa" stroke="#cdbff0" /><rect x="144" y="70" width="14" height="80" fill="#efe9fc" stroke="#cdbff0" /><rect x="188" y="70" width="14" height="80" fill="#efe9fc" stroke="#cdbff0" />
    <path d="M142 70 L151 52 L160 70Z M186 70 L195 52 L204 70Z" fill="#f49bb8" /><path d="M166 84 L173 66 L180 84Z" fill="#f49bb8" /><rect x="166" y="120" width="14" height="30" rx="7" fill="#b9a6ea" />
    <rect x="148" y="90" width="6" height="8" rx="3" fill="#fff6c8" /><rect x="192" y="90" width="6" height="8" rx="3" fill="#fff6c8" />
    <Star x={40} y={44} s={1.4} /><Star x={110} y={30} />
    <path d="M20 100 Q60 70 100 100" fill="none" stroke="#f7b8d4" strokeWidth="4" /><path d="M20 106 Q60 76 100 106" fill="none" stroke="#fff0a8" strokeWidth="4" /><path d="M20 112 Q60 82 100 112" fill="none" stroke="#a8dcf2" strokeWidth="4" />
  </>,
  pink_cushion: <>
    <rect width="230" height="190" fill="#fff4f6" /><rect y="138" width="230" height="52" fill="#fde3e8" /><path d="M0 138 H230" stroke="#f6cdd5" strokeWidth="2" />
    <g fill="#ffd6de"><circle cx="30" cy="30" r="3" /><circle cx="80" cy="20" r="2.4" /><circle cx="150" cy="34" r="3" /><circle cx="205" cy="22" r="2.4" /><circle cx="60" cy="70" r="2" /><circle cx="185" cy="66" r="2" /></g>
    <rect x="160" y="44" width="46" height="40" rx="6" fill="#fff" stroke="#f6cdd5" strokeWidth="2" /><path d="M183 44 v40 M160 64 h46" stroke="#f6cdd5" strokeWidth="2" /><path d="M156 46 q8 18 0 40 M210 46 q-8 18 0 40" fill="#fbd3dc" />
    <ellipse cx="115" cy="160" rx="62" ry="16" fill="#f7a8ba" /><ellipse cx="115" cy="155" rx="56" ry="12" fill="#fbc3d0" /><path d="M70 155 q45 10 90 0" fill="none" stroke="#f7a8ba" strokeWidth="1.5" strokeDasharray="3 3" />
    <g transform="translate(36 148)"><ellipse rx="14" ry="9" fill="#fbc3d0" /><circle cy="-2" r="3" fill="#f49bb8" /></g><path transform="translate(198 150)" d="M0 -10 q6 0 6 6 q0 6 -6 10 q-6 -4 -6 -10 q0 -6 6 -6z" fill="#f49bb8" />
  </>,
  bed: <>
    <rect width="230" height="190" fill="#eef4fb" /><rect y="140" width="230" height="50" fill="#e6d6c6" /><path d="M0 140 H230" stroke="#d8c3ae" strokeWidth="2" />
    <rect x="18" y="34" width="40" height="44" rx="4" fill="#fff" stroke="#c9d8ea" strokeWidth="2" /><path d="M38 34 v44 M18 56 h40" stroke="#c9d8ea" strokeWidth="2" /><circle cx="48" cy="44" r="5" fill="#fff3c4" />
    <rect x="132" y="96" width="88" height="40" rx="8" fill="#b9d3ee" /><rect x="132" y="80" width="14" height="60" rx="5" fill="#a07a5a" /><rect x="132" y="104" width="88" height="10" fill="#fff" /><rect x="150" y="90" width="26" height="14" rx="6" fill="#fff" stroke="#c9d8ea" /><path d="M180 104 q20 -6 40 0 v32 h-40z" fill="#9cc2e6" /><rect x="214" y="96" width="8" height="44" rx="3" fill="#a07a5a" />
    <circle cx="96" cy="60" r="12" fill="#fff6c8" /><path d="M90 76 h12 v26 h-12z" fill="#e8c9a3" /><path d="M86 66 h20 l-4 -14 h-12z" fill="#f7b8d4" />
    <rect x="12" y="150" width="70" height="22" rx="11" fill="#f2c6d1" opacity=".7" />
  </>,
  desk: <>
    <rect width="230" height="190" fill="#fffaf1" /><rect y="140" width="230" height="50" fill="#efe1c9" /><path d="M0 140 H230" stroke="#e2cfae" strokeWidth="2" />
    <rect x="20" y="30" width="56" height="40" rx="4" fill="#e9f3e3" stroke="#cfe0c4" strokeWidth="2" /><path d="M28 60 l10 -12 l8 8 l6 -6 l14 10" fill="none" stroke="#9cc58f" strokeWidth="2" /><circle cx="62" cy="40" r="4" fill="#ffd166" />
    <rect x="138" y="62" width="76" height="6" rx="2" fill="#c49a6c" /><rect x="146" y="40" width="10" height="22" fill="#f49bb8" /><rect x="157" y="44" width="9" height="18" fill="#a8dcf2" /><rect x="167" y="38" width="11" height="24" fill="#fff0a8" /><rect x="179" y="46" width="8" height="16" fill="#c9b8f0" />
    <rect x="126" y="108" width="96" height="8" rx="3" fill="#c49a6c" /><rect x="132" y="116" width="6" height="26" fill="#a87d52" /><rect x="210" y="116" width="6" height="26" fill="#a87d52" /><rect x="150" y="96" width="30" height="12" rx="2" fill="#fff" stroke="#e2cfae" /><path d="M165 96 v12" stroke="#e2cfae" />
    <g transform="translate(200 92)"><path d="M0 16 h-8 l2 -8 h4z" fill="#f49bb8" /><path d="M-4 8 l-6 -10" stroke="#8b2f40" strokeWidth="2" /><circle cx="-11" cy="-4" r="4" fill="#fff3c4" /></g>
    <rect x="196" y="128" width="12" height="4" rx="2" fill="#ffd166" />
  </>,
  oasis: <>
    <rect width="230" height="190" fill="#fdf3e1" /><circle cx="186" cy="38" r="16" fill="#ffd98a" /><circle cx="186" cy="38" r="22" fill="none" stroke="#ffe9b8" strokeWidth="3" />
    <path d="M0 118 Q40 100 80 116 T160 112 T230 116 L230 190 L0 190Z" fill="#f6e2bd" /><path d="M0 140 Q60 126 120 140 T230 138 L230 190 L0 190Z" fill="#f1d7a6" />
    <ellipse cx="72" cy="160" rx="34" ry="8" fill="#9fd8e6" /><ellipse cx="72" cy="158" rx="22" ry="4" fill="#c4ebf3" />
    <path d="M40 158 Q42 128 38 108" fill="none" stroke="#b58a5c" strokeWidth="4" strokeLinecap="round" /><path d="M38 108 Q22 100 14 108 M38 108 Q30 92 20 92 M38 108 Q50 94 60 98 M38 108 Q56 104 62 114" fill="none" stroke="#7cc08a" strokeWidth="5" strokeLinecap="round" />
    <path d="M104 160 Q106 138 102 124" fill="none" stroke="#b58a5c" strokeWidth="3.5" strokeLinecap="round" /><path d="M102 124 Q90 118 84 124 M102 124 Q112 114 120 118 M102 124 Q116 122 118 130" fill="none" stroke="#8fcf98" strokeWidth="4" strokeLinecap="round" />
    <path d="M160 152 l0 -22 M160 136 l-7 0 l0 -6 M160 140 l7 0 l0 -8" fill="none" stroke="#9ccf8a" strokeWidth="5" strokeLinecap="round" />
    <path d="M196 150 q4 -10 10 -6 q2 -8 8 -4" fill="none" stroke="#e8b97a" strokeWidth="2" /><circle cx="150" cy="70" r="1.6" fill="#fff" /><circle cx="60" cy="50" r="1.4" fill="#fff" />
  </>,
  snow_cabin: <>
    <rect width="230" height="190" fill="#eef4fb" /><path d="M0 120 L50 60 L90 104 L130 50 L180 108 L210 80 L230 100 L230 190 L0 190Z" fill="#dfe8f5" /><path d="M50 60 L40 72 L50 70 L58 78 L66 68Z M130 50 L118 64 L130 62 L140 70 L146 60Z" fill="#fff" />
    <rect y="150" width="230" height="40" fill="#fff" /><path d="M0 150 Q60 142 120 150 T230 148" fill="none" stroke="#e3ebf6" strokeWidth="3" />
    <rect x="150" y="106" width="46" height="44" rx="3" fill="#d9b48f" stroke="#c39a72" /><path d="M142 110 L173 84 L204 110Z" fill="#fff" stroke="#dfe8f5" /><path d="M146 110 L173 88 L200 110" fill="none" stroke="#b97a6a" strokeWidth="3" />
    <rect x="166" y="124" width="12" height="26" rx="5" fill="#a9744f" /><rect x="154" y="114" width="9" height="9" rx="2" fill="#ffe7a6" stroke="#c39a72" /><rect x="183" y="114" width="9" height="9" rx="2" fill="#ffe7a6" stroke="#c39a72" />
    <path d="M30 150 L40 120 L50 150Z" fill="#9cc2b0" /><path d="M33 134 L40 114 L47 134Z" fill="#fff" /><path d="M206 150 L214 128 L222 150Z" fill="#9cc2b0" />
    <g fill="#fff"><circle cx="20" cy="30" r="2" /><circle cx="70" cy="20" r="1.6" /><circle cx="104" cy="40" r="2" /><circle cx="160" cy="24" r="1.6" /><circle cx="210" cy="44" r="2" /><circle cx="88" cy="80" r="1.4" /></g>
    <g transform="translate(96 156)"><circle r="9" fill="#fff" stroke="#e3ebf6" /><circle cy="-13" r="6" fill="#fff" stroke="#e3ebf6" /><path d="M-6 -9 L6 -9" stroke="#f49bb0" strokeWidth="2.5" /><circle cx="-2" cy="-14" r=".9" fill="#2f2228" /><circle cx="2" cy="-14" r=".9" fill="#2f2228" /></g>
  </>,
  galaxy: <>
    <rect width="230" height="190" fill="#3d3a6b" /><path d="M-10 120 Q60 60 120 70 T240 20" fill="none" stroke="#6c67a8" strokeWidth="26" opacity=".55" /><path d="M-10 120 Q60 60 120 70 T240 20" fill="none" stroke="#9d97d6" strokeWidth="8" opacity=".5" />
    <g fill="#fff"><circle cx="30" cy="30" r="1.4" /><circle cx="80" cy="50" r="1" /><circle cx="140" cy="30" r="1.6" /><circle cx="200" cy="70" r="1.2" /><circle cx="60" cy="90" r="1" /><circle cx="170" cy="100" r="1.4" /><circle cx="110" cy="110" r="1" /></g>
    <Star x={150} y={45} /><Star x={50} y={64} s={0.8} />
    <path d="M180 20 L140 52" stroke="#fff6c8" strokeWidth="2" strokeLinecap="round" /><circle cx="180" cy="20" r="3" fill="#fff6c8" />
    <path d="M0 150 Q70 130 140 148 T230 142 L230 190 L0 190Z" fill="#5b5794" /><path d="M0 166 Q80 156 160 166 T230 164 L230 190 L0 190Z" fill="#4c4882" />
    <circle cx="38" cy="38" r="12" fill="#fff3c4" /><circle cx="44" cy="34" r="11" fill="#3d3a6b" />
    <g transform="translate(186 150)"><rect x="-1.5" y="-26" width="3" height="26" fill="#8a84c4" /><path d="M0 -26 l-8 6 h16z" fill="#f7b8d4" /><circle cy="-30" r="3" fill="#ffd166" /></g>
  </>,
  dream_garden: <>
    <rect width="230" height="190" fill="#fdf0f5" /><path d="M30 130 Q115 20 200 130" fill="none" stroke="#f7b8d4" strokeWidth="7" /><path d="M40 130 Q115 34 190 130" fill="none" stroke="#fff0a8" strokeWidth="7" /><path d="M50 130 Q115 48 180 130" fill="none" stroke="#a8dcf2" strokeWidth="7" /><path d="M60 130 Q115 62 170 130" fill="none" stroke="#c9b8f0" strokeWidth="7" />
    <g fill="#fff"><ellipse cx="34" cy="132" rx="22" ry="10" /><ellipse cx="196" cy="132" rx="22" ry="10" /></g>
    <rect y="150" width="230" height="40" fill="#e3f2dc" />
    <g transform="translate(115 104)"><rect x="-22" y="0" width="44" height="46" rx="22" fill="none" stroke="#e6a3c0" strokeWidth="3" /><circle r="4" fill="#f49bb8" /><circle cx="-16" cy="8" r="3" fill="#ffd166" /><circle cx="16" cy="8" r="3" fill="#ffd166" /></g>
    <circle cx="24" cy="158" r="5" fill="#f49bb8" /><circle cx="24" cy="158" r="2" fill="#ffd166" /><circle cx="46" cy="164" r="4" fill="#c9b8f0" /><circle cx="46" cy="164" r="1.6" fill="#fff" /><circle cx="186" cy="160" r="5" fill="#a8dcf2" /><circle cx="186" cy="160" r="2" fill="#fff" /><circle cx="208" cy="166" r="4" fill="#f49bb8" />
    <g transform="translate(160 60)"><path d="M0 0 q-8 -8 -12 0 q4 8 12 0 q8 -8 12 0 q-4 8 -12 0" fill="#f7b8d4" /><path d="M0 -4 v8" stroke="#8b2f40" strokeWidth="1.2" /></g>
    <Star x={70} y={45} />
  </>,
};

export const hasSceneArt = (id: string | null | undefined) => Boolean(id && SCENES[id]);
/** Fills its (relative) parent; the bottom of the drawing stays at the bottom so the pet stands on the ground. */
export function SceneArt({ id, className = '' }: { id: string; className?: string }) {
  if (!SCENES[id]) return null;
  return <svg viewBox="0 0 230 190" preserveAspectRatio="xMidYMax slice" className={`absolute inset-0 h-full w-full ${className}`} aria-hidden="true">{SCENES[id]}</svg>;
}
