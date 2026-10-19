import React from 'react';
import { accessorySlot, type PetGearView, type PetStage } from '../../lib/petCatalog';
import { gearArt, gearSetBack, gearSetFront } from './petGearArt'; // its moving parts: .pg-* in index.css

// 펫 그림: every character is one SVG on the same 120×130 grid (head + small body), so outfits follow the body shape and
// accessories sit at each character's own head points. Order: outfit back → tail → body → outfit → head → accessory.
interface CharacterProps {
  stage: PetStage;
  clothing?: string | null;
  /** One id, or everything worn (one per place: 머리·눈·목·손). */
  accessory?: string | string[] | null;
  background?: string | null;
  className?: string;
  /** Head only (small icons in the teacher screens). */
  portrait?: boolean;
  /** Width in px instead of the stage size (small friends in the room, the switcher). */
  size?: number;
  /** 장비 (👁 on): drawn over the pet; armor covers the outfit and neck things, the helmet head things, the weapon hand things. */
  gear?: PetGearView | null;
}

const BODY = 'M36 92 Q60 80 84 92 L86 112 Q60 124 34 112 Z';
const arms = (fill: string, stroke: string) => <><ellipse cx="34" cy="100" rx="6" ry="8" fill={fill} stroke={stroke} /><ellipse cx="86" cy="100" rx="6" ry="8" fill={fill} stroke={stroke} /></>;
const Eyes = ({ y, color = '#3a2a30' }: { y: number; color?: string }) => <>
  <ellipse cx="49" cy={y} rx="3" ry="3.6" fill={color} /><ellipse cx="71" cy={y} rx="3" ry="3.6" fill={color} />
  <circle cx="50" cy={y - 1.3} r="1.1" fill="#fff" /><circle cx="72" cy={y - 1.3} r="1.1" fill="#fff" />
</>;
const Blush = ({ y }: { y: number }) => <><ellipse cx="42" cy={y} rx="4.5" ry="2.6" fill="#f7b3c0" opacity=".7" /><ellipse cx="78" cy={y} rx="4.5" ry="2.6" fill="#f7b3c0" opacity=".7" /></>;
const UNI = { m1: '#c9a8f0', m2: '#f7a1c9', m3: '#e6d8ff', line: '#b393e6' };
const Heart = ({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 0 q-3 -4 -6 0 q0 3 6 7 q6 -4 6 -7 q-3 -4 -6 0z" fill={fill} />;
/** Bigger, double-sparkle eyes for the extra-cute pets. */
const BigEyes = ({ y, dx = 11 }: { y: number; dx?: number }) => <>
  <ellipse cx={60 - dx} cy={y} rx="4.8" ry="5.8" fill="#2f2228" /><ellipse cx={60 + dx} cy={y} rx="4.8" ry="5.8" fill="#2f2228" />
  <circle cx={61.6 - dx} cy={y - 2.2} r="1.9" fill="#fff" /><circle cx={61.6 + dx} cy={y - 2.2} r="1.9" fill="#fff" />
  <circle cx={58.6 - dx} cy={y + 2} r=".9" fill="#fff" /><circle cx={58.6 + dx} cy={y + 2} r=".9" fill="#fff" />
</>;
const Mouth = ({ y }: { y: number }) => <path d={`M56 ${y} Q60 ${y + 3.5} 64 ${y}`} fill="none" stroke="#7a4b55" strokeWidth="1.6" strokeLinecap="round" />;

interface Look { body: [string, string, string?]; head: React.ReactNode; tail?: React.ReactNode; front?: React.ReactNode; crownAt?: string; eyeY: number; top: number; side: [number, number] }
const LOOKS: Record<string, Look> = {
  // 다롱: 유니콘 — long wavy lavender hair gathered into two bunches (no visible tie: the ribbon is a shop item), spiral horn, big purple eyes, heart on the hip.
  unicorn: { body: ['#fffdfd', '#efdfe5'], eyeY: 60, top: 18, side: [84, 34], crownAt: 'translate(-15 6) rotate(-16 60 14)', tail: <>
    <path d="M82 106 Q104 100 108 116 Q110 126 98 126 Q104 118 96 114 Q92 112 84 114Z" fill={UNI.m1} /><path d="M86 110 Q100 106 104 116" fill="none" stroke={UNI.m2} strokeWidth="4" strokeLinecap="round" />
    <path d="M24 62 Q16 26 60 16 Q104 26 96 62Z" fill={UNI.m1} />
    {[1, -1].map(d => <g key={d} transform={d < 0 ? 'translate(120 0) scale(-1 1)' : undefined}>
      <path d="M27 44 Q8 50 10 70 Q12 82 6 92 Q2 106 14 112 Q24 116 26 106 Q16 104 18 96 Q24 86 20 74 Q18 62 31 54Z" fill={UNI.m1} />
      <path d="M14 58 Q10 72 14 82 Q16 90 10 100" fill="none" stroke={d > 0 ? UNI.m2 : UNI.m3} strokeWidth="3" strokeLinecap="round" />
      <path d="M12 106 Q16 110 21 108" fill="none" stroke={UNI.line} strokeWidth="1.3" strokeLinecap="round" />
    </g>)}</>,
    front: <path d="M80 104 q-2 -3 -4 0 q0 2 4 5 q4 -3 4 -5 q-2 -3 -4 0z" fill={UNI.m2} />, head: <>
    <path d="M30 34 L32 18 L44 28Z" fill="#fffdfd" stroke="#efdfe5" strokeLinejoin="round" /><path d="M90 34 L88 18 L76 28Z" fill="#fffdfd" stroke="#efdfe5" strokeLinejoin="round" />
    <path d="M33 31 L34 23 L40 28Z" fill="#ffc8d8" /><path d="M87 31 L86 23 L80 28Z" fill="#ffc8d8" />
    <ellipse cx="60" cy="58" rx="34" ry="30" fill="#fffdfd" stroke="#efdfe5" />
    <path d="M60 4 L66 26 L54 26Z" fill="#fff8fb" stroke="#e9cfd9" strokeLinejoin="round" />
    <path d="M56 21 L65 17 M57.5 15 L63.5 12 M58.5 9.5 L62 8" stroke={UNI.m2} strokeWidth="2" strokeLinecap="round" />
    <path d="M27 54 Q24 24 60 21 Q96 24 93 54 Q88 44 80 47 Q77 37 69 43 Q64 33 57 42 Q50 35 45 45 Q37 41 33 50 Q30 48 27 54Z" fill={UNI.m1} />
    <path d="M57 42 Q60 30 69 43 Q64 36 60 38Z" fill={UNI.m2} /><path d="M36 34 Q46 24 58 24" fill="none" stroke={UNI.m3} strokeWidth="3" strokeLinecap="round" />
    <path d="M45 45 Q48 38 52 37 M80 47 Q78 40 74 38" fill="none" stroke={UNI.line} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M28 50 Q24 62 30 72 Q33 70 33 62Z" fill={UNI.m1} /><path d="M92 50 Q96 62 90 72 Q87 70 87 62Z" fill={UNI.m1} />
    <ellipse cx="49" cy="60" rx="6.6" ry="8" fill="#6b3fa0" /><ellipse cx="71" cy="60" rx="6.6" ry="8" fill="#6b3fa0" />
    <ellipse cx="49" cy="63" rx="5" ry="4.6" fill="#b07fe0" /><ellipse cx="71" cy="63" rx="5" ry="4.6" fill="#b07fe0" />
    <circle cx="46.6" cy="56.6" r="2.8" fill="#fff" /><circle cx="68.6" cy="56.6" r="2.8" fill="#fff" />
    <circle cx="51.5" cy="64" r="1.3" fill="#fff" /><circle cx="73.5" cy="64" r="1.3" fill="#fff" /><circle cx="47.5" cy="64.5" r=".8" fill="#fff" /><circle cx="69.5" cy="64.5" r=".8" fill="#fff" />
    <path d="M42 54 l-3 -2 M78 54 l3 -2 M42.5 57 l-3.2 -.6 M77.5 57 l3.2 -.6" stroke="#4a2c5c" strokeWidth="1.3" strokeLinecap="round" />
    <ellipse cx="40" cy="70" rx="5.2" ry="3" fill="#ffadc2" opacity=".85" /><ellipse cx="80" cy="70" rx="5.2" ry="3" fill="#ffadc2" opacity=".85" />
    <path d="M56.5 70 Q60 76.5 63.5 70Z" fill="#e8798f" /><path d="M58 73.5 Q60 75.5 62 73.5" fill="#ffb3c4" /></> },
  // 아롱: 쫑긋 토끼 — one ear folded with deep-pink tips, a tuft on top, heart blush, eyelashes, a front tooth, heart on the cotton tail.
  mymelody: { body: ['#ffc9d9', '#f3a9c0', '#fff3f6'], eyeY: 56, top: 26, side: [82, 33], tail: <>
    <circle cx="86" cy="114" r="8" fill="#fff" stroke="#f2d4dd" /><Heart x={86} y={113} s={0.55} fill="#ff9db6" /></>, head: <>
    <g transform="translate(0 6)">
    <path d="M44 34 Q32 -6 46 2 Q56 8 54 30Z" fill="#ffc9d9" stroke="#f3a9c0" /><path d="M45 28 Q38 6 46 8 Q51 12 50 28Z" fill="#fff0f4" />
    <path d="M68 30 Q74 0 88 6 Q100 14 82 22 Q74 26 76 34Z" fill="#ffc9d9" stroke="#f3a9c0" /><path d="M73 28 Q78 8 86 10 Q92 14 80 20Z" fill="#fff0f4" />
    <path d="M38 6 Q42 -1 47 3 Q43 6 40 10Z" fill="#f49bb8" /><path d="M90 8 Q96 12 92 17 Q89 13 85 12Z" fill="#f49bb8" />
    </g>
    <ellipse cx="60" cy="57" rx="35" ry="31" fill="#ffc9d9" stroke="#f3a9c0" /><ellipse cx="60" cy="68" rx="15" ry="11" fill="#fff3f6" />
    <path d="M56 27 Q58 18 64 20 Q60 22 61 27" fill="#ffc9d9" stroke="#f3a9c0" />
    <BigEyes y={56} />
    <path d="M44 52 l-2.6 -1.8 M44.2 54.6 l-3 -.4 M76 52 l2.6 -1.8 M75.8 54.6 l3 -.4" stroke="#2f2228" strokeWidth="1.3" strokeLinecap="round" />
    <Heart x={39} y={63} s={0.9} fill="#ff9db6" /><Heart x={81} y={63} s={0.9} fill="#ff9db6" />
    <path d="M57.5 63 Q60 61 62.5 63 Q60 66 57.5 63Z" fill="#f07a98" />
    <path d="M60 65 L60 68 M60 68 Q57 71 54.5 69 M60 68 Q63 71 65.5 69" fill="none" stroke="#8a4a5c" strokeWidth="1.4" strokeLinecap="round" />
    <rect x="58" y="68.5" width="4" height="3.4" rx="1" fill="#fff" stroke="#efd3dc" strokeWidth=".6" /></> },
  // 해미: 찹쌀떡 햄스터 (no stripe) — big sparkly eyes, ω mouth, a sunflower seed held in front of any outfit.
  haemi: { body: ['#fffdf9', '#ece3d8'], eyeY: 55, top: 27, side: [85, 34], front: <>
    <path d="M55 99 Q60 88 65 99 Q60 108 55 99Z" fill="#7b6556" /><path d="M58 96 Q60 93 62 96" stroke="#e9dcc8" strokeWidth="1.2" fill="none" />
    <ellipse cx="54" cy="100" rx="3.5" ry="3" fill="#fffdf9" stroke="#ece3d8" /><ellipse cx="66" cy="100" rx="3.5" ry="3" fill="#fffdf9" stroke="#ece3d8" /></>, head: <>
    <ellipse cx="38" cy="30" rx="8" ry="7" fill="#fffdf9" stroke="#ece3d8" /><ellipse cx="82" cy="30" rx="8" ry="7" fill="#fffdf9" stroke="#ece3d8" />
    <ellipse cx="38" cy="31" rx="4.5" ry="3.8" fill="#ffc4cf" /><ellipse cx="82" cy="31" rx="4.5" ry="3.8" fill="#ffc4cf" />
    <ellipse cx="60" cy="58" rx="39" ry="31" fill="#fffdf9" stroke="#ece3d8" />
    <BigEyes y={55} dx={13} />
    <ellipse cx="37" cy="65" rx="5.5" ry="3.2" fill="#ffb3c4" opacity=".8" /><ellipse cx="83" cy="65" rx="5.5" ry="3.2" fill="#ffb3c4" opacity=".8" />
    <ellipse cx="60" cy="62" rx="2.4" ry="1.8" fill="#f08aa0" />
    <path d="M54 64 q3 3.4 6 0 q3 3.4 6 0" fill="none" stroke="#6e3f4c" strokeWidth="1.6" strokeLinecap="round" /></> },
  molang: { body: ['#fff', '#e6d8dc'], eyeY: 57, top: 26, side: [83, 33], head: <>
    <ellipse cx="50" cy="25" rx="5" ry="10" fill="#fff" stroke="#e6d8dc" transform="rotate(-8 50 25)" /><ellipse cx="70" cy="25" rx="5" ry="10" fill="#fff" stroke="#e6d8dc" transform="rotate(8 70 25)" />
    <ellipse cx="50" cy="26" rx="2.4" ry="6" fill="#ffd6e0" transform="rotate(-8 50 26)" /><ellipse cx="70" cy="26" rx="2.4" ry="6" fill="#ffd6e0" transform="rotate(8 70 26)" />
    <path d="M24 62 Q22 28 60 26 Q98 28 96 62 Q96 88 60 88 Q24 88 24 62Z" fill="#fff" stroke="#e6d8dc" />
    <BigEyes y={57} dx={12} />
    <ellipse cx="38" cy="67" rx="5.5" ry="3.2" fill="#ffadc2" opacity=".8" /><ellipse cx="82" cy="67" rx="5.5" ry="3.2" fill="#ffadc2" opacity=".8" />
    <path d="M36 65.5 l-2 3 M40 65.5 l-2 3 M80 65.5 l2 3 M84 65.5 l2 3" stroke="#f08aa0" strokeWidth="1" strokeLinecap="round" />
    <path d="M54 66 q3 3.4 6 0 q3 3.4 6 0" fill="none" stroke="#6e3f4c" strokeWidth="1.6" strokeLinecap="round" /></> },
  mang_bear: { body: ['#c99a7c', '#ad7f62', '#f3e0d0'], eyeY: 55, top: 26, side: [83, 33], head: <>
    <circle cx="32" cy="30" r="12" fill="#c99a7c" stroke="#ad7f62" /><circle cx="88" cy="30" r="12" fill="#c99a7c" stroke="#ad7f62" />
    <circle cx="32" cy="30" r="6.5" fill="#ffc9d4" /><circle cx="88" cy="30" r="6.5" fill="#ffc9d4" />
    <ellipse cx="60" cy="57" rx="36" ry="31" fill="#c99a7c" stroke="#ad7f62" /><ellipse cx="60" cy="69" rx="13" ry="9.5" fill="#f3e0d0" />
    <BigEyes y={55} dx={13} />
    <ellipse cx="37" cy="67" rx="5.5" ry="3.2" fill="#ffadc2" opacity=".8" /><ellipse cx="83" cy="67" rx="5.5" ry="3.2" fill="#ffadc2" opacity=".8" />
    <path d="M60 67 q-2.6 -3.4 -5 -.4 q0 2.4 5 5.4 q5 -3 5 -5.4 q-2.4 -3 -5 .4z" fill="#5a3a2e" />
    <path d="M60 72.5 L60 74 M60 74 Q57.5 76.5 55.5 75 M60 74 Q62.5 76.5 64.5 75" fill="none" stroke="#5a3a2e" strokeWidth="1.3" strokeLinecap="round" /></> },
  hodu: { body: ['#f8cf94', '#e8b06a', '#fff6e8'], eyeY: 54, top: 22, side: [82, 29], tail: <path d="M84 110 Q104 108 100 90 Q98 82 92 86" fill="none" stroke="#f0b56a" strokeWidth="7" strokeLinecap="round" />, head: <>
    <path d="M30 40 L32 14 L52 26Z" fill="#f8cf94" stroke="#e8b06a" strokeLinejoin="round" /><path d="M90 40 L88 14 L68 26Z" fill="#f8cf94" stroke="#e8b06a" strokeLinejoin="round" />
    <path d="M34 34 L35 20 L46 27Z" fill="#f7b3c0" /><path d="M86 34 L85 20 L74 27Z" fill="#f7b3c0" />
    <ellipse cx="60" cy="54" rx="35" ry="32" fill="#f8cf94" stroke="#e8b06a" />
    <path d="M54 24 L55 32 M60 23 L60 32 M66 24 L65 32" stroke="#e9a35a" strokeWidth="2.4" strokeLinecap="round" />
    <ellipse cx="60" cy="65" rx="13" ry="9" fill="#fff6e8" /><path d="M57 62 L63 62 L60 65Z" fill="#e88a9a" />
    <path d="M60 65 Q57 69 54 67 M60 65 Q63 69 66 67" fill="none" stroke="#7a4b55" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M30 62 L42 63 M30 68 L42 66 M90 62 L78 63 M90 68 L78 66" stroke="#c9905a" strokeWidth="1.1" strokeLinecap="round" />
    <Eyes y={54} /><Blush y={62} /></> },
};

/** Outfits drawn on the body: `back` goes behind the body (cape, wings), `front` over it and under the head. */
const STAR = 'M0 -8 L2.4 -2.5 L8 -2.4 L3.6 1.2 L5 7 L0 3.6 L-5 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.5Z';
/** `top` (hats) goes over the head, before accessories. */
const OUTFITS: Record<string, { back?: React.ReactNode; front: React.ReactNode; top?: (look: Look) => React.ReactNode }> = {
  baby_bib: { front: <>
    <path d="M44 88 Q60 84 76 88 Q78 104 60 108 Q42 104 44 88Z" fill="#fff" stroke="#f2c6d3" />
    <path d="M44 88 Q52 92 60 90 Q68 92 76 88" fill="none" stroke="#f2a7b8" strokeWidth="1.6" />
    <path d="M60 98 q-3 -4 -6 0 q0 3 6 7 q6 -4 6 -7 q-3 -4 -6 0z" fill="#f7b8c9" /></> },
  bakery_apron: { front: <>
    <path d="M44 92 L76 92 L80 116 Q60 122 40 116Z" fill="#fff" stroke="#e8dcd0" />
    <path d="M44 92 Q38 90 36 96 M76 92 Q82 90 84 96" stroke="#f2a7b8" strokeWidth="2" fill="none" />
    <rect x="52" y="102" width="16" height="9" rx="2" fill="#ffe3ea" stroke="#f2a7b8" /><path d="M57 106 q3 -3 6 0" stroke="#d98a5a" strokeWidth="1.4" fill="none" /></> },
  stripe_tee: { front: <>
    <path d={BODY} fill="#fff" stroke="#dfe4ec" />
    {[94, 101, 108, 115].map(y => <path key={y} d={`M35 ${y} Q60 ${y + 5} 85 ${y}`} fill="none" stroke="#7fa7e0" strokeWidth="3" />)}
    {arms('#fff', '#dfe4ec')}<path d="M29 98 L39 97 M81 97 L91 98" stroke="#7fa7e0" strokeWidth="3" /></> },
  star_pajama: { front: <>
    <path d={BODY} fill="#cfe0fb" stroke="#b1c8ef" />
    {[[46, 98], [66, 96], [56, 108], [74, 110], [42, 110]].map(([x, y]) => <path key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(.4)`} d={STAR} fill="#fff3a8" />)}
    <path d="M50 89 Q60 96 70 89" fill="none" stroke="#fff" strokeWidth="2" />{arms('#cfe0fb', '#b1c8ef')}</>,
    top: look => <g transform={`translate(0 ${look.top - 16})`}><path d="M30 34 Q40 6 74 14 Q92 20 96 6 Q104 24 88 30 Q70 22 30 34Z" fill="#cfe0fb" stroke="#b1c8ef" /><circle cx="98" cy="6" r="4" fill="#fff" /></g> },
  raincoat: { front: <>
    <path d="M22 62 Q18 14 60 12 Q102 14 98 62 Q100 80 88 88 L32 88 Q20 80 22 62Z" fill="#ffd95a" stroke="#ebbf2e" />
    <path d="M33 90 Q60 78 87 90 L91 117 Q60 126 29 117Z" fill="#ffd95a" stroke="#ebbf2e" />
    <path d="M60 88 L60 118" stroke="#ebbf2e" strokeWidth="1.2" /><circle cx="57" cy="98" r="1.6" fill="#ebbf2e" /><circle cx="57" cy="106" r="1.6" fill="#ebbf2e" />
    {arms('#ffd95a', '#ebbf2e')}</> },
  overalls: { front: <>
    <path d="M36 100 L84 100 L86 114 Q60 124 34 114Z" fill="#7aa4d8" stroke="#5f89c0" />
    <rect x="48" y="92" width="24" height="12" rx="2" fill="#7aa4d8" stroke="#5f89c0" />
    <path d="M44 86 L48 94 M76 86 L72 94" stroke="#5f89c0" strokeWidth="3" strokeLinecap="round" />
    <circle cx="50" cy="95" r="1.6" fill="#f2d16b" /><circle cx="70" cy="95" r="1.6" fill="#f2d16b" /><rect x="56" y="96" width="8" height="5" rx="1" fill="#6b95cc" /></> },
  uniform: { front: <>
    <path d={BODY} fill="#fbfbfd" stroke="#d9dbe6" /><path d="M42 89 L60 102 L78 89 L74 86 L60 95 L46 86Z" fill="#3f4f9a" />
    <path d="M57 99 L63 99 L66 110 L60 114 L54 110Z" fill="#d6455a" />{arms('#fbfbfd', '#d9dbe6')}</> },
  lovely: { front: <>
    <path d="M38 90 Q60 82 82 90 L90 114 Q60 126 30 114 Z" fill="#fde0e6" stroke="#f3aebc" />
    <path d="M30 114 Q37 119 45 116 Q52 121 60 117 Q68 121 75 116 Q83 119 90 114" fill="none" stroke="#f3aebc" strokeWidth="2" />
    <path d="M48 88 Q54 95 60 90 Q66 95 72 88" fill="#fff" stroke="#f3aebc" />
    <path d="M60 102 q-3 -4 -6 0 q0 3 6 7 q6 -4 6 -7 q-3 -4 -6 0z" fill="#ec6f8c" /></> },
  sporty: { front: <>
    <path d={BODY} fill="#6fb2ef" stroke="#4d97da" /><path d="M60 88 L60 118" stroke="#fff" strokeWidth="2" strokeDasharray="2.5 2" />
    <path d="M34 112 Q60 124 86 112 L86 116 Q60 128 34 116Z" fill="#2f7fd0" />{arms('#6fb2ef', '#4d97da')}
    <path d="M30 97 L38 95 M30 101 L38 99 M90 97 L82 95 M90 101 L82 99" stroke="#fff" strokeWidth="1.6" /></> },
  fairy: {
    back: <><path d="M38 96 Q14 80 16 104 Q24 112 38 104Z" fill="#e3f3e6" stroke="#bfe2c6" /><path d="M82 96 Q106 80 104 104 Q96 112 82 104Z" fill="#e3f3e6" stroke="#bfe2c6" /></>,
    front: <>
      <path d="M40 90 Q60 84 80 90 L90 116 Q60 126 30 116 Z" fill="#ece0fa" stroke="#d3c0ee" />
      <path d="M33 108 Q46 120 60 108 Q74 120 87 108 L90 116 Q60 126 30 116Z" fill="#dcf7e6" opacity=".9" />
      <circle cx="50" cy="100" r="1.8" fill="#f5d76e" /><circle cx="70" cy="104" r="2" fill="#f5d76e" /></> },
  muji_cape: {
    back: <><path d="M42 88 Q12 106 18 125 L102 125 Q108 106 78 88Z" fill="#ffb3c1" stroke="#f08ca2" />
      <path d="M24 108 Q60 98 96 108" fill="none" stroke="#ffe08a" strokeWidth="4" /><path d="M20 116 Q60 106 100 116" fill="none" stroke="#a8e0c5" strokeWidth="4" /><path d="M19 122 Q60 113 101 122" fill="none" stroke="#a9cdf5" strokeWidth="3" /></>,
    front: <><path d="M52 88 L60 93 L68 88 L68 95 L60 92 L52 95Z" fill="#f08ca2" /><circle cx="60" cy="92" r="2.4" fill="#e56e8a" /></> },
  // 모리걸: cream lace dress, camel knit cardigan, tiny flower embroidery.
  mori_girl: { front: <>
    <path d="M38 90 Q60 82 82 90 L91 116 Q60 126 29 116 Z" fill="#faf5ea" stroke="#e5dcc7" />
    <path d="M29 116 Q33 121 37 117 Q41 122 45 118 Q49 123 53 119 Q57 124 61 119 Q65 124 69 119 Q73 123 77 118 Q81 122 85 117 Q89 121 91 116" fill="#fff" stroke="#e5dcc7" />
    <path d="M36 92 Q44 86 50 90 L48 116 Q40 116 33 112Z" fill="#c99b6d" stroke="#ad7f52" /><path d="M84 92 Q76 86 70 90 L72 116 Q80 116 87 112Z" fill="#c99b6d" stroke="#ad7f52" />
    <path d="M38 98 L46 97 M37 104 L46 103 M37 110 L46 109 M82 98 L74 97 M83 104 L74 103 M83 110 L74 109" stroke="#b5875a" strokeWidth="1" strokeDasharray="1.5 1.2" />
    {[[56, 100, '#f2a7b8'], [64, 106, '#f7d27a'], [57, 110, '#b9d6f2']].map(([x, y, c]) => <g key={String(c)}><circle cx={x} cy={y} r="1.8" fill={String(c)} /><circle cx={Number(x) + 2} cy={Number(y) + 1.5} r=".9" fill="#9fb293" /></g>)}
    <path d="M52 89 Q56 94 60 90 Q64 94 68 89" fill="#fff" stroke="#e5dcc7" />{arms('#c99b6d', '#ad7f52')}</> },
  hippie: { front: <>
    <path d={BODY} fill="#e67e51" stroke="#d36538" />
    <path d="M36 92 L50 88 L48 112 L35 110Z" fill="#b38758" /><path d="M84 92 L70 88 L72 112 L85 110Z" fill="#b38758" />
    <path d="M37 110 L37 117 M42 111 L42 118 M47 112 L47 119 M73 112 L73 119 M78 111 L78 118 M83 110 L83 117" stroke="#9a6f42" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M50 90 Q60 100 70 90" fill="none" stroke="#2a9d8f" strokeWidth="2" strokeDasharray="2 2.5" /><circle cx="60" cy="97" r="2.6" fill="#e9c46a" />
    {arms('#e67e51', '#d36538')}</> },
  // 오네갸루: black off-shoulder knit with cream fur trim, leopard mini skirt, gold chain, tiny bag.
  onee_gyaru: { front: <>
    <path d="M36 92 Q60 82 84 92 L85 104 L35 104Z" fill="#2b2629" />
    <path d="M34 104 L86 104 L90 116 Q60 124 30 116Z" fill="#e9c58d" stroke="#c99a52" />
    {[[38, 108], [48, 112], [58, 107], [68, 113], [78, 108], [84, 114], [44, 117], [66, 118]].map(([x, y]) => <g key={`${x}-${y}`}><ellipse cx={x} cy={y} rx="2.6" ry="1.8" fill="none" stroke="#5a3a20" strokeWidth="1.2" /><circle cx={x} cy={y} r=".8" fill="#5a3a20" /></g>)}
    <path d="M35 104 Q60 108 85 104" fill="none" stroke="#e8c15a" strokeWidth="1.8" strokeDasharray="2 1.5" />
    <path d="M38 90 Q60 84 82 90 Q78 96 60 94 Q42 96 38 90Z" fill="#f4ede6" />
    <path d="M48 92 Q60 100 72 92" fill="none" stroke="#e8c15a" strokeWidth="1.3" /><circle cx="60" cy="97" r="1.6" fill="#e8c15a" />
    {arms('#2b2629', '#1d191b')}
    <rect x="80" y="104" width="10" height="8" rx="2" fill="#f4ede6" stroke="#cbbfb3" /><path d="M82 104 Q85 99 88 104" fill="none" stroke="#e8c15a" strokeWidth="1" /></> },
  hime_gyaru: { front: <>
    <path d="M40 90 Q60 82 80 90 L94 116 Q60 128 26 116 Z" fill="#ffccd5" stroke="#ffa6b8" />
    <path d="M30 108 Q60 116 90 108 L94 116 Q60 128 26 116Z" fill="#fff0f3" stroke="#ffccd5" />
    <path d="M26 116 Q34 121 42 117 Q50 122 60 118 Q70 122 78 117 Q86 121 94 116" fill="none" stroke="#fff" strokeWidth="2" />
    <path d="M44 98 Q60 106 76 98" fill="none" stroke="#fff9eb" strokeWidth="2" strokeDasharray="2.5 2.5" />
    <circle cx="60" cy="92" r="4" fill="#ff4d6d" /><circle cx="60" cy="92" r="2.2" fill="#ff8fa3" /></> },
  latte_gyaru: { front: <>
    <path d={BODY} fill="#a47148" stroke="#875630" />
    <path d="M44 96 L43 114 M52 94 L52 117 M60 93 L60 118 M68 94 L68 117 M76 96 L77 114" stroke="#8f5e36" strokeWidth="1.2" strokeDasharray="3 2.5" />
    <path d="M36 92 Q60 82 84 92 L84 97 Q60 88 36 97Z" fill="#f4eae0" />
    <path d="M50 92 Q60 102 70 92" fill="none" stroke="#f4a261" strokeWidth="1.8" strokeDasharray="2 2" /><circle cx="60" cy="98" r="2.4" fill="#e76f51" />
    {arms('#a47148', '#875630')}</> },
};

/** Neck items go under the chin (drawn before the head); everything else sits on the head. */
const NECK = new Set(['scarf', 'bow_tie']);
/** 원정대 무기, held in the right hand (the arm ends at 86,100 on every character); the blade or staff rises beside the head. */
const WEAPONS: Record<string, React.ReactNode> = {
  // 채움의 탑 견습 몽둥이 (tower gear, shown in the hand in battle): light wood, a thick rounded head, a wrapped grip.
  apprentice_club: <g transform="translate(92 100) rotate(16)"><path d="M-3.4 -36 Q0 -40 3.4 -36 Q5.6 -30 4.4 -18 L2.6 -6 H-2.6 L-4.4 -18 Q-5.6 -30 -3.4 -36Z" fill="#e3a65a" stroke="#6b3d08" strokeWidth="1.1" strokeLinejoin="round" /><path d="M-1.4 -33 Q-2 -25 -1 -14" stroke="#f5cf95" strokeWidth="1.2" fill="none" strokeLinecap="round" /><circle cx="1.8" cy="-22" r=".9" fill="#b9761c" /><rect x="-2.6" y="-7" width="5.2" height="11" rx="1.4" fill="#8a5a2b" stroke="#4a2a08" strokeWidth=".8" /><path d="M-2.6 -3.5 H2.6 M-2.6 0 H2.6" stroke="#4a2a08" strokeWidth=".7" /></g>,
  wood_sword: <g transform="translate(92 98) rotate(14)"><rect x="-3" y="-34" width="6" height="30" rx="3" fill="#d8b48a" stroke="#b58a5c" /><rect x="-8" y="-4" width="16" height="3.5" rx="1.75" fill="#a07a5a" /><rect x="-1.8" y="-0.5" width="3.6" height="9" rx="1.8" fill="#8a5a44" /></g>,
  wood_staff: <g transform="translate(91 104) rotate(10)"><rect x="-2.2" y="-44" width="4.4" height="52" rx="2.2" fill="#b58a5c" /><path d="M0 -44 q-8 -4 -6 -10 q6 2 6 10 q0 -8 6 -10 q2 6 -6 10" fill="#8fcf98" stroke="#6fb57c" strokeWidth=".6" /></g>,
  ice_sword: <g transform="translate(92 98) rotate(14)"><path d="M0 -38 L4.5 -31 L4.5 -4 L-4.5 -4 L-4.5 -31Z" fill="#cfe8f8" stroke="#8fc3e6" /><path d="M0 -34 L0 -6" stroke="#fff" strokeWidth="1.3" /><path d="M-9 -4 h18 l-2.5 3.5 h-13z" fill="#9cc7e6" /><rect x="-1.8" y="-0.5" width="3.6" height="9" rx="1.8" fill="#6f8fb8" /><circle cy="10" r="2" fill="#cfe8f8" /></g>,
  ice_staff: <g transform="translate(91 104) rotate(10)"><rect x="-2.2" y="-40" width="4.4" height="48" rx="2.2" fill="#9cc7e6" /><path d="M0 -54 l6 7 l-6 7 l-6 -7z" fill="#cfe8f8" stroke="#8fc3e6" /><path d="M0 -51 l0 8" stroke="#fff" strokeWidth="1.2" /></g>,
  star_sword: <g transform="translate(92 98) rotate(14)"><path d="M0 -38 L4.5 -31 L4.5 -4 L-4.5 -4 L-4.5 -31Z" fill="#e8e3ff" stroke="#a99be6" /><path d="M0 -26 l1.3 2.8 l2.8 .4 l-2 1.9 l.5 2.8 l-2.6 -1.5 l-2.6 1.5 l.5 -2.8 l-2 -1.9 l2.8 -.4z" fill="#ffd166" /><path d="M-10 -4 h20 l-3.5 4 h-13z" fill="#6c67a8" /><rect x="-1.8" y="0" width="3.6" height="8.5" rx="1.8" fill="#4c4882" /><circle cy="10" r="2.2" fill="#ffd166" /></g>,
  moon_staff: <g transform="translate(91 104) rotate(10)"><rect x="-2.2" y="-40" width="4.4" height="48" rx="2.2" fill="#6c67a8" /><path d="M-1 -58 A8 8 0 1 0 7 -45 A6.5 6.5 0 1 1 -1 -58Z" fill="#ffd166" stroke="#e6a92e" strokeWidth=".8" strokeLinejoin="round" /><circle cx="7" cy="-55" r="1.4" fill="#fff3c4" /></g>,
  dream_sword: <g transform="translate(92 98) rotate(14)"><path d="M0 -40 L5.5 -32 L5.5 -4 L-5.5 -4 L-5.5 -32Z" fill="#fff0f6" stroke="#f49bb8" /><path d="M-2.6 -30 L-2.6 -6" stroke="#a8dcf2" strokeWidth="1.4" /><path d="M0 -34 L0 -6" stroke="#f7b8d4" strokeWidth="1.4" /><path d="M2.6 -30 L2.6 -6" stroke="#fff0a8" strokeWidth="1.4" /><path d="M-12 -4 q12 -5 24 0 l-3.5 4.5 h-17z" fill="#f49bb8" /><circle cx="-12" cy="-4" r="2" fill="#ffd166" /><circle cx="12" cy="-4" r="2" fill="#ffd166" /><rect x="-1.8" y="0.5" width="3.6" height="8.5" rx="1.8" fill="#c96a8e" /><path d="M0 9 l2.2 2.6 l-2.2 2.6 l-2.2 -2.6z" fill="#c9b8f0" /></g>,
  // 2차 전직 weapons: 빛의 성검 (white blade, gold guard, a soft glow), 흑요 마검 (black blade, red edge line),
  // 새벽빛 홀 (pale rod, gold diamond in a glow), 그믐달 지팡이 (indigo rod, a lilac crescent).
  // 40층 서리 용's treasures: a wide icy greatsword and a staff with a frozen orb.
  frost_greatsword: <g transform="translate(92 98) rotate(14)"><path d="M0 -44 L7 -34 L6 -4 L-6 -4 L-7 -34Z" fill="#e6f1fb" stroke="#378add" strokeWidth="1.1" /><path d="M0 -40 V-7" stroke="#ffffff" strokeWidth="1.6" /><path d="M-12 -4 l4 -4 h16 l4 4z" fill="#85b7eb" stroke="#185fa5" strokeWidth="1" /><rect x="-2" y="-1" width="4" height="10" rx="2" fill="#185fa5" /><path d="M0 9 l2.4 2.6 -2.4 2.6 -2.4 -2.6z" fill="#b5e3f4" /></g>,
  frost_staff: <g transform="translate(91 104) rotate(10)"><rect x="-2.2" y="-40" width="4.4" height="48" rx="2.2" fill="#85b7eb" /><circle cy="-48" r="8" fill="#e6f7fd" stroke="#378add" strokeWidth="1.4" /><path d="M0 -54 v12 M-5 -48 h10 M-3.6 -51.6 l7.2 7.2 M3.6 -51.6 l-7.2 7.2" stroke="#378add" strokeWidth="1" /></g>,
  holy_sword: <g transform="translate(92 98) rotate(14)"><circle cy="-24" r="11" fill="#fef9c3" opacity=".75" /><path d="M0 -40 L5 -32 L5 -4 L-5 -4 L-5 -32Z" fill="#ffffff" stroke="#ca8a04" strokeWidth="1.1" /><path d="M0 -36 V-6" stroke="#fde68a" strokeWidth="1.3" /><path d="M-11 -4 H11" stroke="#ca8a04" strokeWidth="3.2" strokeLinecap="round" /><rect x="-1.8" y="-1" width="3.6" height="9.5" rx="1.8" fill="#a16207" /><circle cy="10" r="2.2" fill="#fde047" /></g>,
  obsidian_sword: <g transform="translate(92 98) rotate(14)"><path d="M0 -41 L5.5 -31 L3.5 -4 L-3.5 -4 L-5.5 -31Z" fill="#1f2937" stroke="#7f1d1d" strokeWidth="1.1" /><path d="M0 -36 V-7" stroke="#dc2626" strokeWidth="1.1" /><path d="M-11 -2 Q0 -8 11 -2" stroke="#111827" strokeWidth="3.6" fill="none" strokeLinecap="round" /><rect x="-1.8" y="-1" width="3.6" height="10" rx="1.8" fill="#111827" /><circle cy="10.5" r="2.2" fill="#dc2626" /></g>,
  dawn_scepter: <g transform="translate(91 104) rotate(10)"><rect x="-2" y="-40" width="4" height="48" rx="2" fill="#f3f4f6" stroke="#ca8a04" strokeWidth=".6" /><circle cy="-50" r="9" fill="#fef9c3" opacity=".8" /><path d="M0 -59 L4.5 -50 L0 -41 L-4.5 -50Z" fill="#ffffff" stroke="#ca8a04" strokeWidth="1" strokeLinejoin="round" /><path d="M-7 -41 Q0 -36 7 -41" stroke="#ca8a04" strokeWidth="1.4" fill="none" /></g>,
  crescent_staff: <g transform="translate(91 104) rotate(10)"><rect x="-2.2" y="-40" width="4.4" height="48" rx="2.2" fill="#312e81" /><path d="M-1 -55 A9 9 0 1 0 8 -41 A7 7 0 1 1 -1 -55Z" fill="#a78bfa" stroke="#4c1d95" strokeWidth=".9" strokeLinejoin="round" /><circle cx="7" cy="-52" r="1.4" fill="#ede9fe" /><path d="M-6 -36 Q0 -32 6 -36" stroke="#4c1d95" strokeWidth="1.3" fill="none" /></g>,
  dream_staff: <g transform="translate(91 104) rotate(10)"><rect x="-2.2" y="-40" width="4.4" height="48" rx="2.2" fill="#f49bb8" /><path d="M0 -58 l2.4 5 l5.6 .8 l-4 3.8 l1 5.4 l-5 -2.6 l-5 2.6 l1 -5.4 l-4 -3.8 l5.6 -.8z" fill="#ffd166" stroke="#f0b429" strokeLinejoin="round" /><circle cx="-7.5" cy="-46" r="1.5" fill="#a8dcf2" /><circle cx="7.5" cy="-44" r="1.5" fill="#f7b8d4" /></g>,
  // 3차 전직 weapons: 천공의 성창 (a long white spear, gold head, sky glow), 심연의 대검 (a black greatsword with violet edges),
  // 여명의 지팡이 (a sunburst on a pale rod), 그믐달 마도서 (an indigo book with a lilac crescent, held open).
  sky_spear: <g transform="translate(92 100) rotate(14)"><circle cy="-34" r="10" fill="#e0f2fe" opacity=".8" /><path d="M0 -58 L2.4 -48 L1.6 6 L-1.6 6 L-2.4 -48Z" fill="#ffffff" stroke="#0ea5e9" strokeWidth=".9" /><path d="M-5.5 -48 L0 -58 L5.5 -48 L0 -45Z" fill="#fde68a" stroke="#ca8a04" strokeWidth=".7" strokeLinejoin="round" /><path d="M-7 -4 Q0 -7 7 -4" stroke="#ca8a04" strokeWidth="2.4" fill="none" strokeLinecap="round" /><path d="M-5 -38 l-3 -2.4 M5 -38 l3 -2.4" stroke="#bae6fd" strokeWidth="1.2" strokeLinecap="round" /></g>,
  abyss_greatsword: <g transform="translate(92 98) rotate(14)"><path d="M0 -44 L7 -33 L5.5 -4 L-5.5 -4 L-7 -33Z" fill="#111827" stroke="#4c1d95" strokeWidth="1.1" /><path d="M-2.6 -36 V-7 M2.6 -36 V-7" stroke="#a855f7" strokeWidth=".9" /><path d="M-11 -2 Q0 -8 11 -2" stroke="#1f2937" strokeWidth="3.4" fill="none" strokeLinecap="round" /><circle cx="-11" cy="-2" r="1.8" fill="#a855f7" /><circle cx="11" cy="-2" r="1.8" fill="#a855f7" /><rect x="-1.8" y="-1" width="3.6" height="10" rx="1.8" fill="#111827" /></g>,
  dawn_staff: <g transform="translate(91 104) rotate(10)"><rect x="-2" y="-40" width="4" height="48" rx="2" fill="#fff7ed" stroke="#f59e0b" strokeWidth=".6" /><circle cy="-50" r="10" fill="#fef3c7" opacity=".85" /><circle cy="-50" r="5.2" fill="#fbbf24" /><path d="M0 -61 V-57.5 M0 -42.5 V-39 M-11 -50 H-7.5 M7.5 -50 H11 M-7.8 -57.8 l2.4 2.4 M5.4 -44.6 l2.4 2.4 M7.8 -57.8 l-2.4 2.4 M-5.4 -44.6 l-2.4 2.4" stroke="#f59e0b" strokeWidth="1.1" strokeLinecap="round" /></g>,
  dusk_tome: <g transform="translate(96 96) rotate(-8)"><rect x="-11" y="-14" width="22" height="26" rx="2.5" fill="#312e81" stroke="#1e1b4b" strokeWidth="1.1" /><rect x="-9" y="-12" width="18" height="22" rx="2" fill="none" stroke="#a78bfa" strokeWidth=".7" /><path d="M-1 -6 A5 5 0 1 0 4.5 1.5 A4 4 0 1 1 -1 -6Z" fill="#c4b5fd" /><circle cx="-5" cy="6" r=".9" fill="#ede9fe" /><rect x="-12.5" y="-12" width="2.4" height="22" rx="1.2" fill="#4c1d95" /></g>,
};

/** `top` is the highest point of the head (hair for 다롱) and `side` a point on the upper-right outline, so hats and pins sit on the head, never above it. */
function Accessory({ id, look }: { id: string; look: Look }) {
  const [sx, sy] = look.side;
  if (id === 'pink_ribbon') return <g transform={`translate(${sx} ${sy}) rotate(18)`}><path d="M0 0 Q-11 -9 -13 1 Q-11 10 0 0Z M0 0 Q11 -9 13 1 Q11 10 0 0Z" fill="#f48fb1" stroke="#e56e98" /><circle r="3.4" fill="#e56e98" /></g>;
  if (id === 'star_hat') return <path transform={`translate(${sx} ${sy})`} d="M0 -8 L2.4 -2.5 L8 -2.4 L3.6 1.2 L5 7 L0 3.6 L-5 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.5Z" fill="#ffd54f" stroke="#f0b429" strokeLinejoin="round" />;
  if (id === 'flower') return <g transform={`translate(${sx} ${sy})`}>{[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-4.5" rx="3.2" ry="4.5" fill="#f9b8cc" transform={`rotate(${a})`} />)}<circle r="2.6" fill="#ffd166" /></g>;
  if (id === 'crown') return <g transform={look.crownAt || `translate(0 ${look.top - 18})`}><path d="M46 22 L46 10 L53 16 L60 6 L67 16 L74 10 L74 22Z" fill="#f6d365" stroke="#d9a930" strokeLinejoin="round" /><circle cx="60" cy="9" r="2" fill="#6fa8e6" /><circle cx="50" cy="18" r="1.5" fill="#e57373" /><circle cx="70" cy="18" r="1.5" fill="#81c784" /></g>;
  if (id === 'sunglasses') { const y = look.eyeY; return <><rect x="40" y={y - 6} width="17" height="11" rx="5" fill="#2e2a2d" /><rect x="63" y={y - 6} width="17" height="11" rx="5" fill="#2e2a2d" /><path d={`M57 ${y - 2} Q60 ${y - 5} 63 ${y - 2}`} stroke="#2e2a2d" strokeWidth="2" fill="none" /><rect x="43" y={y - 4} width="5" height="2" rx="1" fill="#fff" opacity=".35" /><rect x="66" y={y - 4} width="5" height="2" rx="1" fill="#fff" opacity=".35" /></>; }
  const e = look.eyeY, t = look.top - 3;
  if (id === 'round_glasses') return <><circle cx="48" cy={e} r="8" fill="#fff" fillOpacity=".25" stroke="#8a5a44" strokeWidth="2" /><circle cx="72" cy={e} r="8" fill="#fff" fillOpacity=".25" stroke="#8a5a44" strokeWidth="2" /><path d={`M56 ${e} Q60 ${e - 3} 64 ${e}`} stroke="#8a5a44" strokeWidth="2" fill="none" /></>;
  if (id === 'heart_sunglasses') return <><Heart x={48} y={e - 3} s={1.45} fill="#ff6f96" /><Heart x={72} y={e - 3} s={1.45} fill="#ff6f96" /><path d={`M54 ${e - 1} Q60 ${e - 4} 66 ${e - 1}`} stroke="#e0507a" strokeWidth="2" fill="none" /></>;
  if (id === 'flower_crown') return <><path d={`M34 ${t + 16} Q44 ${t + 6} 52 ${t + 6} M68 ${t + 6} Q76 ${t + 6} 86 ${t + 16}`} stroke="#8cc47c" strokeWidth="2" fill="none" />
    {[[38, t + 12, '#ffb3c6'], [48, t + 5, '#fff1a8'], [60, t + 2, '#ffc9e0'], [72, t + 5, '#c9e4ff'], [82, t + 12, '#ffb3c6']].map(([x, y, c]) => <g key={String(x)} transform={`translate(${x} ${y})`}>{[0, 72, 144, 216, 288].map(r => <ellipse key={r} cx="0" cy="-3" rx="2.4" ry="3.2" fill={String(c)} transform={`rotate(${r})`} />)}<circle r="1.8" fill="#ffd166" /></g>)}</>;
  if (id === 'beret') return <><path d={`M34 ${t + 14} Q36 ${t - 6} 66 ${t - 4} Q94 ${t - 2} 88 ${t + 14} Q60 ${t + 20} 34 ${t + 14}Z`} fill="#e2535f" stroke="#c63f4b" /><path d={`M62 ${t - 4} l2 -5`} stroke="#c63f4b" strokeWidth="2.4" strokeLinecap="round" /></>;
  if (id === 'headphones') return <><path d={`M26 ${e + 2} Q24 ${t - 2} 60 ${t - 4} Q96 ${t - 2} 94 ${e + 2}`} fill="none" stroke="#9aa6c9" strokeWidth="4.5" strokeLinecap="round" /><rect x="18" y={e - 6} width="12" height="16" rx="5" fill="#c8d0ea" stroke="#9aa6c9" /><rect x="90" y={e - 6} width="12" height="16" rx="5" fill="#c8d0ea" stroke="#9aa6c9" /></>;
  if (id === 'strawberry_pin') return <g transform={`translate(${sx} ${sy}) rotate(15)`}><path d="M-6 -2 Q0 12 6 -2 Q0 -6 -6 -2Z" fill="#ff5f7a" /><path d="M-6 -2 Q-3 -6 0 -4 Q3 -6 6 -2 Q3 -3 0 -1 Q-3 -3 -6 -2Z" fill="#6fbf63" /><circle cx="-2" cy="2" r=".7" fill="#fff3a8" /><circle cx="2" cy="3" r=".7" fill="#fff3a8" /><circle cx="0" cy="6" r=".7" fill="#fff3a8" /></g>;
  if (id === 'bow_tie') return <><path d="M60 92 L49 86 L49 98Z M60 92 L71 86 L71 98Z" fill="#6c7fd8" stroke="#5266c4" /><circle cx="60" cy="92" r="3" fill="#5266c4" /></>;
  if (id === 'scarf') return <><path d="M36 88 Q60 96 84 88 L84 95 Q60 103 36 95Z" fill="#f08a6a" stroke="#d96f50" /><path d="M44 90 L44 98 M52 92 L52 100 M68 92 L68 100 M76 90 L76 98 M36 91.5 Q60 99.5 84 91.5" stroke="#ffe0c8" strokeWidth="1.2" fill="none" /><path d="M70 94 L74 112 L66 112 L64 96Z" fill="#f08a6a" stroke="#d96f50" /></>;
  return null;
}

const Sparkle = ({ x, y, s }: { x: number; y: number; s: number }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -6 Q1 -1 6 0 Q1 1 0 6 Q-1 1 -6 0 Q-1 -1 0 -6Z" fill="#f6c94c" />;

// 핑크 쿠션·작은 침대·미니 책상 are whole room scenes now (PetScenes.tsx), drawn behind the pet like the other rooms.

const SIZE: Record<PetStage, number> = { baby: 84, child: 100, teen: 116, adult: 132, master: 140 };

/** `aura`: the 3차 전직 glow behind the pet (light: gold and sky; dark: violet). */
/** The helmet sits higher on taller heads (다롱's hair and horn, 호두's ears). */
const HELMET_Y: Record<string, number> = { unicorn: -6, hodu: -3 };

export const PetCharacter = ({ character, stage, clothing, accessory, background, className = '', portrait, size: fixedSize, aura, gear }: CharacterProps & { character: string; aura?: 'light' | 'dark' | null }) => {
  // Small faces (portrait): only the helmet, under the head things worn (a friend's 소품 always shows); no set glow.
  const face = portrait && gear?.look.helmet != null ? { ...gear, look: { helmet: gear.look.helmet }, full: null } : null;
  const on = !portrait && gear && Object.keys(gear.look).length ? gear : null, covers = (s: 'helmet' | 'armor' | 'weapon') => on?.look[s] != null;
  const hidden = (id: string) => { const at = accessorySlot(id); return (at === 'head' && covers('helmet')) || (at === 'neck' && covers('armor')) || (at === 'hand' && covers('weapon')); };
  const worn = (Array.isArray(accessory) ? accessory : accessory ? [accessory] : []).filter(Boolean).filter(id => !hidden(String(id))) as string[];
  const look = LOOKS[character] || LOOKS.molang, outfit = clothing && !covers('armor') ? OUTFITS[clothing] : undefined, [fill, stroke, belly] = look.body;
  const size = fixedSize || SIZE[stage] || SIZE.baby;
  const art = <svg viewBox={portrait ? '14 8 92 88' : '0 0 120 130'} width={size} height={portrait ? size : size * 130 / 120} className="relative z-10" aria-hidden="true">
    {aura && <g aria-hidden="true"><circle cx="60" cy="78" r="56" fill={aura === 'light' ? '#fef9c3' : '#ede9fe'} opacity=".55" /><circle cx="60" cy="80" r="44" fill={aura === 'light' ? '#e0f2fe' : '#ddd6fe'} opacity=".55" /><circle cx="14" cy="50" r="2" fill={aura === 'light' ? '#fde68a' : '#c4b5fd'} /><circle cx="108" cy="62" r="1.7" fill={aura === 'light' ? '#bae6fd' : '#a78bfa'} /><circle cx="98" cy="118" r="1.8" fill={aura === 'light' ? '#fde68a' : '#c4b5fd'} /></g>}
    {on?.full != null && <g dangerouslySetInnerHTML={{ __html: gearSetBack(on.full) }} />}
    {outfit?.back}{look.tail}
    <ellipse cx="47" cy="121" rx="8" ry="5" fill={fill} stroke={stroke} /><ellipse cx="73" cy="121" rx="8" ry="5" fill={fill} stroke={stroke} />
    <path d={BODY} fill={fill} stroke={stroke} />{belly && <ellipse cx="60" cy="104" rx="13" ry="10" fill={belly} />}{arms(fill, stroke)}
    {outfit?.front}{worn.filter(id => NECK.has(id)).map(id => <React.Fragment key={id}><Accessory id={id} look={look} /></React.Fragment>)}{look.front}{look.head}{!covers('helmet') && !face && outfit?.top?.(look)}{face && <g dangerouslySetInnerHTML={{ __html: gearArt(face.style, face.look, HELMET_Y[character] || 0) }} />}{worn.filter(id => !NECK.has(id) && !WEAPONS[id]).map(id => <React.Fragment key={id}><Accessory id={id} look={look} /></React.Fragment>)}
    {worn.filter(id => WEAPONS[id]).map(id => <React.Fragment key={id}>{WEAPONS[id]}</React.Fragment>)}
    {on && <g dangerouslySetInnerHTML={{ __html: gearArt(on.style, on.look, HELMET_Y[character] || 0) + (on.full != null ? gearSetFront(on.full) : '') }} />}
    {stage === 'master' && <><Sparkle x={16} y={30} s={1} /><Sparkle x={104} y={44} s={0.8} /><Sparkle x={100} y={14} s={0.6} /></>}
  </svg>;
  if (portrait) return <div className={className}>{art}</div>;
  return (
    <div className={`relative flex flex-col items-center justify-end ${className}`}>
      {art}
    </div>
  );
};
