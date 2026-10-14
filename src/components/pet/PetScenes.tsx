import React from 'react';

// 원정대 보상 배경: a whole room scene drawn behind the pet (the shop backgrounds stay small props next to the pet).
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
};

export const hasSceneArt = (id: string | null | undefined) => Boolean(id && SCENES[id]);
/** Fills its (relative) parent; the bottom of the drawing stays at the bottom so the pet stands on the ground. */
export function SceneArt({ id, className = '' }: { id: string; className?: string }) {
  if (!SCENES[id]) return null;
  return <svg viewBox="0 0 230 190" preserveAspectRatio="xMidYMax slice" className={`absolute inset-0 h-full w-full ${className}`} aria-hidden="true">{SCENES[id]}</svg>;
}
