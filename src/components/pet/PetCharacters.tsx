import React from 'react';
import { PetStage } from '../../lib/petService';

interface CharacterProps {
  stage: PetStage;
  clothing?: string | null;
  accessory?: string | null;
  background?: string | null;
  className?: string;
}

export const PinkRibbonSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 30" className={className} width="40" height="30">
    {/* Ribbon loops */}
    <path d="M20 15 Q10 0 5 15 Q10 30 20 15" fill="#FF80AB" stroke="#F06292" strokeWidth="1" />
    <path d="M20 15 Q30 0 35 15 Q30 30 20 15" fill="#FF80AB" stroke="#F06292" strokeWidth="1" />
    {/* Ribbon center knot */}
    <circle cx="20" cy="15" r="4" fill="#F06292" />
    {/* Ribbon tails */}
    <path d="M18 18 L12 28" stroke="#F06292" strokeWidth="3" strokeLinecap="round" />
    <path d="M22 18 L28 28" stroke="#F06292" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const StarHatSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    {/* Mustard yellow star - centered and slightly simplified for icon feel */}
    <path 
      d="M50 15 L60 40 L85 40 L65 55 L75 80 L50 65 L25 80 L35 55 L15 40 L40 40 Z" 
      fill="#FFD54F" 
      stroke="#FBC02D" 
      strokeWidth="3"
      strokeLinejoin="round"
    />
    {/* Small sparkle on star */}
    <circle cx="42" cy="38" r="4" fill="#FFF9C4" opacity="0.9" />
  </svg>
);

export const CrownSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 60" className={className} width="100" height="60">
    <path 
      d="M10 50 L10 20 L30 40 L50 10 L70 40 L90 20 L90 50 Z" 
      fill="#FFD700" 
      stroke="#D4AF37" 
      strokeWidth="2"
    />
    <circle cx="30" cy="40" r="3" fill="#E57373" />
    <circle cx="50" cy="10" r="4" fill="#64B5F6" />
    <circle cx="70" cy="40" r="3" fill="#81C784" />
  </svg>
);

export const SunglassesSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 40" className={className} width="100" height="40">
    {/* Lenses */}
    <rect x="10" y="10" width="35" height="25" rx="10" fill="#212121" />
    <rect x="55" y="10" width="35" height="25" rx="10" fill="#212121" />
    {/* Bridge */}
    <path d="M45 20 Q50 15 55 20" fill="none" stroke="#212121" strokeWidth="4" />
    {/* Lens reflections */}
    <rect x="15" y="15" width="10" height="4" rx="2" fill="white" opacity="0.3" />
    <rect x="60" y="15" width="10" height="4" rx="2" fill="white" opacity="0.3" />
  </svg>
);

export const SchoolUniformSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 100" className={className} width={120 * scale} height={100 * scale} style={{ opacity: 0.95 }}>
      <path d="M30 20 L90 20 L100 80 L20 80 Z" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="2" />
      <path d="M40 20 L50 35 L70 35 L80 20" fill="#3949AB" stroke="#283593" strokeWidth="2" />
      <path d="M55 20 L65 20 L65 30 L60 60 L55 30 Z" fill="#C62828" stroke="#B71C1C" strokeWidth="1" />
      <path d="M30 25 L15 50 L25 55 L35 40" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="2" />
      <path d="M90 25 L105 50 L95 55 L85 40" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="2" />
    </svg>
  );
};

// 모리걸 (Mori Girl): Earthy forest cottagecore linen & apron dress with lace scallops
export const MoriGirlOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Cream base linen skirt */}
      <path d="M28 25 Q60 22 92 25 L102 78 Q60 84 18 78 Z" fill="#F7F3EB" stroke="#E5DECE" strokeWidth="1.5" />
      {/* Sage green apron overlay */}
      <path d="M36 26 L84 26 L88 70 Q60 75 32 70 Z" fill="#95A78D" opacity="0.9" />
      {/* Delicate lace scallops at hem */}
      <path d="M18 78 Q28 84 38 78 Q48 84 58 78 Q68 84 78 78 Q88 84 98 78 Q103 81 102 78" fill="none" stroke="#EAE3D2" strokeWidth="2" />
      {/* Suspender straps & wooden button */}
      <line x1="42" y1="20" x2="42" y2="40" stroke="#7A8C73" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="78" y1="20" x2="78" y2="40" stroke="#7A8C73" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="42" cy="38" r="2.5" fill="#C4A482" />
      <circle cx="78" cy="38" r="2.5" fill="#C4A482" />
      {/* Small leaf motif */}
      <path d="M60 48 Q64 42 66 48 Q64 54 60 48" fill="#72846A" />
      <path d="M60 48 Q56 42 54 48 Q56 54 60 48" fill="#889C80" />
    </svg>
  );
};

// 히피 (Hippie): Boho fringe vest over warm retro sunset tunic
export const HippieOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Retro mustard/terracotta inner tunic */}
      <path d="M30 22 L90 22 L98 72 L22 72 Z" fill="#E67E51" stroke="#D36538" strokeWidth="1.5" />
      <path d="M22 72 Q60 76 98 72" stroke="#F4A261" strokeWidth="3" />
      {/* Suede tan vest left & right */}
      <path d="M28 22 L52 22 L48 64 L24 64 Z" fill="#B38758" stroke="#9A6F42" strokeWidth="1.5" />
      <path d="M92 22 L68 22 L72 64 L96 64 Z" fill="#B38758" stroke="#9A6F42" strokeWidth="1.5" />
      {/* Fringe cuts */}
      <line x1="26" y1="64" x2="26" y2="76" stroke="#9A6F42" strokeWidth="2" strokeLinecap="round" />
      <line x1="34" y1="64" x2="34" y2="76" stroke="#9A6F42" strokeWidth="2" strokeLinecap="round" />
      <line x1="42" y1="64" x2="42" y2="76" stroke="#9A6F42" strokeWidth="2" strokeLinecap="round" />
      <line x1="78" y1="64" x2="78" y2="76" stroke="#9A6F42" strokeWidth="2" strokeLinecap="round" />
      <line x1="86" y1="64" x2="86" y2="76" stroke="#9A6F42" strokeWidth="2" strokeLinecap="round" />
      <line x1="94" y1="64" x2="94" y2="76" stroke="#9A6F42" strokeWidth="2" strokeLinecap="round" />
      {/* Turquoise bead necklace */}
      <path d="M48 26 Q60 38 72 26" fill="none" stroke="#2A9D8F" strokeWidth="2.5" strokeDasharray="2,3" />
      <circle cx="60" cy="34" r="3.5" fill="#E9C46A" />
      <circle cx="60" cy="34" r="1.5" fill="#2A9D8F" />
    </svg>
  );
};

// 페어리 (Fairy): Translucent pastel lilac & mint petals with soft fairy shimmer
export const FairyOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Gossamer fairy wings peek at lower sides */}
      <path d="M24 35 Q10 40 18 55 Q26 50 28 42 Z" fill="#E2F0D9" opacity="0.65" stroke="#C3E6CB" strokeWidth="1" />
      <path d="M96 35 Q110 40 102 55 Q94 50 92 42 Z" fill="#E2F0D9" opacity="0.65" stroke="#C3E6CB" strokeWidth="1" />
      {/* Lilac petal layered skirt */}
      <path d="M32 24 Q60 20 88 24 L96 74 Q60 82 24 74 Z" fill="#EADCF8" stroke="#D6C2EE" strokeWidth="1.5" />
      {/* Overlapping mint chiffon petals */}
      <path d="M30 50 Q45 76 60 52 Q75 76 90 50 L95 72 Q60 80 25 72 Z" fill="#DCFCE7" opacity="0.75" />
      {/* Star sparkles */}
      <circle cx="48" cy="40" r="2" fill="#FEF08A" />
      <circle cx="72" cy="46" r="2.5" fill="#FEF08A" />
      <circle cx="60" cy="64" r="1.5" fill="#FFFFFF" />
      {/* Soft pearl ribbon at waist */}
      <path d="M34 26 Q60 30 86 26" fill="none" stroke="#FDF2F8" strokeWidth="2.5" />
    </svg>
  );
};

// 러블리 (Lovely): Sweet blush pink sweetheart ruffles & heart buttons
export const LovelyOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Pink ruffle dress base */}
      <path d="M30 24 Q60 20 90 24 L100 76 Q60 82 20 76 Z" fill="#FDE2E4" stroke="#F8B4B9" strokeWidth="1.5" />
      {/* Sweetheart scallop collar */}
      <path d="M40 24 Q50 32 60 26 Q70 32 80 24" fill="#FFFFFF" stroke="#F8B4B9" strokeWidth="1.5" />
      {/* Heart buttons */}
      <path d="M60 38 Q58 35 56 38 Q56 41 60 44 Q64 41 64 38 Q62 35 60 38 Z" fill="#FF6584" />
      <path d="M60 52 Q58 49 56 52 Q56 55 60 58 Q64 55 64 52 Q62 49 60 52 Z" fill="#FF6584" />
      {/* Flounce hem ruffle */}
      <path d="M20 76 Q30 82 40 76 Q50 82 60 76 Q70 82 80 76 Q90 82 100 76" fill="#FFF0F3" stroke="#F8B4B9" strokeWidth="1.5" />
      {/* Mini satin ribbon bow */}
      <path d="M57 65 Q54 62 51 65 Q54 68 57 65 Z" fill="#FF8FA3" />
      <path d="M63 65 Q66 62 69 65 Q66 68 63 65 Z" fill="#FF8FA3" />
      <circle cx="60" cy="65" r="2" fill="#FF4D6D" />
    </svg>
  );
};

// 스포티 (Sporty): Retro baby-blue & crisp white varsity zip windbreaker
export const SportyOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Main jacket body - retro powder blue */}
      <path d="M26 22 L94 22 L100 74 L20 74 Z" fill="#64B5F6" stroke="#42A5F5" strokeWidth="1.5" />
      {/* Crisp white chevron/center block */}
      <path d="M42 22 L78 22 L72 74 L48 74 Z" fill="#FFFFFF" opacity="0.95" />
      {/* Contrast athletic dual stripes on sleeves */}
      <line x1="22" y1="40" x2="36" y2="34" stroke="#FFFFFF" strokeWidth="2.5" />
      <line x1="20" y1="46" x2="34" y2="40" stroke="#FFFFFF" strokeWidth="2.5" />
      <line x1="98" y1="40" x2="84" y2="34" stroke="#FFFFFF" strokeWidth="2.5" />
      <line x1="100" y1="46" x2="86" y2="40" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Zip track & silver puller */}
      <line x1="60" y1="22" x2="60" y2="74" stroke="#1E88E5" strokeWidth="2" strokeDasharray="3,2" />
      <rect x="58" y="32" width="4" height="6" rx="1.5" fill="#B0BEC5" />
      {/* Ribbed varsity hem */}
      <path d="M20 74 L100 74 L98 80 L22 80 Z" fill="#1E88E5" />
    </svg>
  );
};

// 오네갸루 (Onee Gyaru): Chic camel wrap trench with leopard print accent lapel
export const OneeGyaruOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Sleek camel coat body */}
      <path d="M28 22 L92 22 L98 76 L22 76 Z" fill="#C99E75" stroke="#AB7E52" strokeWidth="1.5" />
      {/* Chic leopard fur collar lapel left */}
      <path d="M30 22 L52 48 L38 52 L26 26 Z" fill="#E6D3B3" stroke="#9C7A58" strokeWidth="1" />
      {/* Leopard rosette spots */}
      <ellipse cx="36" cy="30" rx="2.5" ry="1.5" fill="#4A3423" />
      <ellipse cx="44" cy="40" rx="3" ry="2" fill="#4A3423" />
      <ellipse cx="33" cy="44" rx="2" ry="1.5" fill="#4A3423" />
      {/* Lapel right */}
      <path d="M90 22 L68 48 L82 52 L94 26 Z" fill="#E6D3B3" stroke="#9C7A58" strokeWidth="1" />
      <ellipse cx="84" cy="30" rx="2.5" ry="1.5" fill="#4A3423" />
      <ellipse cx="76" cy="40" rx="3" ry="2" fill="#4A3423" />
      <ellipse cx="87" cy="44" rx="2" ry="1.5" fill="#4A3423" />
      {/* Gold buckled belt */}
      <rect x="23" y="58" width="74" height="6" fill="#8D5B32" />
      <rect x="54" y="56" width="12" height="10" rx="2" fill="#F4D06F" stroke="#D4AF37" strokeWidth="1" />
      <rect x="57" y="58" width="6" height="6" fill="#8D5B32" />
    </svg>
  );
};

// 히메갸루 (Hime Gyaru): Extravagant princess gyaru layered rose & lace ballgown
export const HimeGyaruOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Wide princess ballgown skirt */}
      <path d="M32 24 Q60 20 88 24 L104 78 Q60 86 16 78 Z" fill="#FFCCD5" stroke="#FFA6B8" strokeWidth="1.5" />
      {/* Tier 1 Lace ruffles */}
      <path d="M22 62 Q60 70 98 62 L104 78 Q60 86 16 78 Z" fill="#FFF0F3" opacity="0.9" stroke="#FFCCD5" strokeWidth="1" />
      {/* Tier 2 delicate lace scallops */}
      <path d="M16 78 Q26 84 36 78 Q46 84 56 78 Q66 84 76 78 Q86 84 96 78 Q101 81 104 78" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
      {/* Pearl chain garland */}
      <path d="M34 40 Q60 52 86 40" fill="none" stroke="#FFF9EB" strokeWidth="2.5" strokeDasharray="3,3" />
      {/* Mini pink tea rose appliqué */}
      <circle cx="60" cy="30" r="5" fill="#FF4D6D" />
      <circle cx="60" cy="30" r="3" fill="#FF758F" />
      <circle cx="60" cy="30" r="1.5" fill="#FFF0F3" />
      {/* Side pearls */}
      <circle cx="34" cy="40" r="2.5" fill="#FFFDF0" stroke="#FFCCD5" strokeWidth="0.5" />
      <circle cx="86" cy="40" r="2.5" fill="#FFFDF0" stroke="#FFCCD5" strokeWidth="0.5" />
    </svg>
  );
};

// 라떼갸루 (Latte Gyaru): Warm mocha/caramel knit with golden tropical hibiscus
export const LatteGyaruOutfitSVG = ({ stage, className }: { stage: PetStage, className?: string }) => {
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  return (
    <svg viewBox="0 0 120 90" className={className} width={120 * scale} height={90 * scale} style={{ opacity: 0.95 }}>
      {/* Warm caramel knit sweater */}
      <path d="M26 22 L94 22 L100 74 L20 74 Z" fill="#A47148" stroke="#875630" strokeWidth="1.5" />
      {/* Ribbed knit texture lines */}
      <line x1="38" y1="24" x2="34" y2="72" stroke="#8F5E36" strokeWidth="1.5" strokeDasharray="4,3" />
      <line x1="50" y1="24" x2="48" y2="72" stroke="#8F5E36" strokeWidth="1.5" strokeDasharray="4,3" />
      <line x1="62" y1="24" x2="62" y2="72" stroke="#8F5E36" strokeWidth="1.5" strokeDasharray="4,3" />
      <line x1="74" y1="24" x2="76" y2="72" stroke="#8F5E36" strokeWidth="1.5" strokeDasharray="4,3" />
      <line x1="86" y1="24" x2="90" y2="72" stroke="#8F5E36" strokeWidth="1.5" strokeDasharray="4,3" />
      {/* Wide off-shoulder latte cream ribbed trim */}
      <path d="M24 22 Q60 26 96 22 L94 32 Q60 36 26 32 Z" fill="#F4EAE0" stroke="#E6D3C2" strokeWidth="1" />
      {/* Gold chain necklace */}
      <path d="M42 34 Q60 48 78 34" fill="none" stroke="#F4A261" strokeWidth="2.5" strokeDasharray="2,2" />
      {/* Golden Hibiscus bloom motif */}
      <circle cx="60" cy="46" r="3" fill="#E76F51" />
      <circle cx="56" cy="44" r="2.5" fill="#F4A261" opacity="0.9" />
      <circle cx="64" cy="44" r="2.5" fill="#F4A261" opacity="0.9" />
      <circle cx="58" cy="50" r="2.5" fill="#F4A261" opacity="0.9" />
      <circle cx="62" cy="50" r="2.5" fill="#F4A261" opacity="0.9" />
    </svg>
  );
};

export const PetClothingRenderer = ({ clothing, stage }: { clothing?: string | null; stage: PetStage }) => {
  if (!clothing) return null;
  switch (clothing) {
    case 'uniform':
      return <SchoolUniformSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10 opacity-90" />;
    case 'muji_cape':
      return <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 opacity-20 rounded-full z-0" />;
    case 'mori_girl':
      return <MoriGirlOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    case 'hippie':
      return <HippieOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    case 'fairy':
      return <FairyOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    case 'lovely':
      return <LovelyOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    case 'sporty':
      return <SportyOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    case 'onee_gyaru':
      return <OneeGyaruOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    case 'hime_gyaru':
      return <HimeGyaruOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    case 'latte_gyaru':
      return <LatteGyaruOutfitSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-10" />;
    default:
      return null;
  }
};

export const PinkCushionSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 40" className={className} width="160" height="60">
    {/* Main cushion body - soft and puffy */}
    <path 
      d="M10 20 Q50 5 90 20 Q95 35 50 38 Q5 35 10 20" 
      fill="#FCE4EC" 
      stroke="#F8BBD0" 
      strokeWidth="2" 
    />
    {/* Soft embroidery/stiching details instead of dots */}
    <path d="M25 22 Q50 18 75 22" fill="none" stroke="#F8BBD0" strokeWidth="1" strokeDasharray="2,2" opacity="0.6" />
    <path d="M30 15 Q50 12 70 15" fill="none" stroke="#F8BBD0" strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
  </svg>
);

export const SmallBedSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 120 60" className={className} width="180" height="90">
    {/* Bed frame */}
    <rect x="10" y="10" width="100" height="45" rx="8" fill="#BCAAA4" stroke="#8D6E63" strokeWidth="2" />
    {/* Mattress/Blanket */}
    <rect x="15" y="15" width="90" height="35" rx="4" fill="#BBDEFB" />
    <path d="M70 15 L105 15 L105 50 L70 50 Z" fill="#90CAF9" />
    {/* Pillow */}
    <rect x="15" y="20" width="20" height="25" rx="4" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="1" />
  </svg>
);

export const MiniDeskSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 60" className={className} width="160" height="100">
    {/* Desk top */}
    <rect x="10" y="20" width="80" height="8" rx="2" fill="#A1887F" stroke="#795548" strokeWidth="2" />
    {/* Desk legs */}
    <rect x="15" y="28" width="4" height="30" fill="#795548" />
    <rect x="81" y="28" width="4" height="30" fill="#795548" />
    {/* Drawer */}
    <rect x="30" y="28" width="40" height="15" rx="2" fill="#D7CCC8" stroke="#A1887F" strokeWidth="1" />
    <circle cx="50" cy="35" r="2" fill="#8D6E63" />
    {/* Notebook on desk */}
    <rect x="35" y="15" width="20" height="8" fill="white" stroke="#E0E0E0" />
  </svg>
);

export const KuromiSVG = ({ stage, clothing, accessory, background, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {background === 'pink_cushion' && (
        <PinkCushionSVG className="absolute -bottom-4 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'bed' && (
        <SmallBedSVG className="absolute -bottom-10 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'desk' && (
        <MiniDeskSVG className="absolute -bottom-12 -right-8 z-0 opacity-90" />
      )}
      <div className="relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Ears */}
          <path d="M20 30 Q10 10 30 25" fill="#333" />
          <path d="M80 30 Q90 10 70 25" fill="#333" />
          {/* Main Head/Hood */}
          <circle cx="50" cy="50" r="40" fill="#333" />
          {/* Face area */}
          <ellipse cx="50" cy="55" rx="30" ry="25" fill="#fff" />
          {/* Skull emblem */}
          <circle cx="50" cy="25" r="5" fill="#FF80AB" />
          {/* Eyes */}
          <circle cx="40" cy="55" r="3" fill="#000" />
          <circle cx="60" cy="55" r="3" fill="#000" />
          {/* Blushing */}
          <circle cx="35" cy="62" r="2" fill="#FFB2CC" opacity="0.6" />
          <circle cx="65" cy="62" r="2" fill="#FFB2CC" opacity="0.6" />
          {/* Master Sparkle */}
          {stage === 'master' && <circle cx="50" cy="15" r="10" fill="gold" opacity="0.3" />}
        </svg>
        {accessory === 'pink_ribbon' && <PinkRibbonSVG className="absolute top-0 right-0 scale-75 origin-top-right z-20" />}
        {accessory === 'star_hat' && <StarHatSVG className="absolute top-0 right-1 w-6 h-6 z-20" />}
        {accessory === 'crown' && <CrownSVG className="absolute -top-13 left-1/2 -translate-x-1/2 scale-50 origin-bottom z-20" />}
        {accessory === 'sunglasses' && <SunglassesSVG className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-75 z-20" />}
        {accessory === 'flower' && <div className="absolute top-0 right-1 text-xl scale-110 z-20">🌸</div>}
        
        <PetClothingRenderer clothing={clothing} stage={stage} />
      </div>
    </div>
  );
};

export const MyMelodySVG = ({ stage, clothing, accessory, background, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {background === 'pink_cushion' && (
        <PinkCushionSVG className="absolute -bottom-4 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'bed' && (
        <SmallBedSVG className="absolute -bottom-10 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'desk' && (
        <MiniDeskSVG className="absolute -bottom-12 -right-8 z-0 opacity-90" />
      )}
      <div className="relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Droopy Ear */}
          <path d="M25 35 Q10 0 15 35" fill="#FF80AB" />
          <path d="M75 35 Q90 0 85 35" fill="#FF80AB" transform="rotate(10, 75, 35)" />
          {/* Head */}
          <circle cx="50" cy="55" r="35" fill="#FF80AB" />
          {/* Face */}
          <circle cx="50" cy="60" r="25" fill="#fff" />
          {/* Nose */}
          <circle cx="50" cy="62" r="2" fill="#FFD54F" />
          {/* Eyes */}
          <circle cx="42" cy="60" r="2" fill="#000" />
          <circle cx="58" cy="60" r="2" fill="#000" />
          {/* Master Sparkle */}
          {stage === 'master' && <circle cx="50" cy="20" r="10" fill="gold" opacity="0.3" />}
        </svg>
        {accessory === 'pink_ribbon' && <PinkRibbonSVG className="absolute top-2 right-2 scale-75 origin-top-right z-20" />}
        {accessory === 'star_hat' && <StarHatSVG className="absolute top-4 right-0 w-6 h-6 z-20" />}
        {accessory === 'crown' && <CrownSVG className="absolute -top-10 left-1/2 -translate-x-1/2 scale-50 origin-bottom z-20" />}
        {accessory === 'sunglasses' && <SunglassesSVG className="absolute bottom-2 left-1/2 -translate-x-1/2 scale-75 z-20" />}
        {accessory === 'flower' && <div className="absolute top-2 right-0 text-xl scale-110 z-20">🌸</div>}
        
        <PetClothingRenderer clothing={clothing} stage={stage} />
      </div>
    </div>
  );
};

export const CinnamorollSVG = ({ stage, clothing, accessory, background, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {background === 'pink_cushion' && (
        <PinkCushionSVG className="absolute -bottom-4 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'bed' && (
        <SmallBedSVG className="absolute -bottom-10 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'desk' && (
        <MiniDeskSVG className="absolute -bottom-12 -right-8 z-0 opacity-90" />
      )}
      <div className="relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Floppy Long Ears */}
          <ellipse cx="15" cy="50" rx="15" ry="25" fill="#fff" stroke="#f0f0f0" strokeWidth="1" />
          <ellipse cx="85" cy="50" rx="15" ry="25" fill="#fff" stroke="#f0f0f0" strokeWidth="1" />
          {/* Head */}
          <circle cx="50" cy="50" r="35" fill="#fff" stroke="#f0f0f0" strokeWidth="1" />
          {/* Eyes - Blue */}
          <circle cx="40" cy="50" r="3" fill="#B3E5FC" />
          <circle cx="60" cy="50" r="3" fill="#B3E5FC" />
          {/* Mouth */}
          <path d="M48 55 Q50 58 52 55" fill="none" stroke="#ffcccc" strokeWidth="1.5" />
          {/* Master Sparkle */}
          {stage === 'master' && <circle cx="50" cy="15" r="10" fill="gold" opacity="0.3" />}
        </svg>
        {accessory === 'pink_ribbon' && <PinkRibbonSVG className="absolute top-0 right-1/4 scale-75 origin-top z-20" />}
        {accessory === 'star_hat' && <StarHatSVG className="absolute top-0 left-2/3 w-6 h-6 z-20" />}
        {accessory === 'crown' && <CrownSVG className="absolute -top-11 left-1/2 -translate-x-1/2 scale-50 origin-bottom z-20" />}
        {accessory === 'sunglasses' && <SunglassesSVG className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-75 z-20" />}
        {accessory === 'flower' && <div className="absolute top-0 left-2/3 text-xl scale-110 z-20">🌸</div>}
        
        <PetClothingRenderer clothing={clothing} stage={stage} />
      </div>
    </div>
  );
};

export const MolangSVG = ({ stage, clothing, accessory, background, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {background === 'pink_cushion' && (
        <PinkCushionSVG className="absolute -bottom-4 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'bed' && (
        <SmallBedSVG className="absolute -bottom-10 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'desk' && (
        <MiniDeskSVG className="absolute -bottom-12 -right-8 z-0 opacity-90" />
      )}
      <div className="relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Tiny Ears */}
          <ellipse cx="43" cy="25" rx="4" ry="8" fill="#fff" />
          <ellipse cx="57" cy="25" rx="4" ry="8" fill="#fff" />
          {/* Body */}
          <ellipse cx="50" cy="60" rx="35" ry="32" fill="#fff" />
          {/* Eyes - Simple Dots */}
          <circle cx="40" cy="55" r="1.5" fill="#000" />
          <circle cx="60" cy="55" r="1.5" fill="#000" />
          {/* Cheeks */}
          <circle cx="35" cy="58" r="4" fill="#FFEBEE" />
          <circle cx="65" cy="58" r="4" fill="#FFEBEE" />
          {/* Arms/Feet are tiny */}
          <circle cx="20" cy="70" r="5" fill="#fff" />
          <circle cx="80" cy="70" r="5" fill="#fff" />
          {/* Master Sparkle */}
          {stage === 'master' && <circle cx="50" cy="25" r="10" fill="gold" opacity="0.3" />}
        </svg>
        {accessory === 'pink_ribbon' && <PinkRibbonSVG className="absolute top-4 right-2 scale-50 origin-top-right z-20" />}
        {accessory === 'star_hat' && <StarHatSVG className="absolute top-4 right-1 w-5 h-5 z-20" />}
        {accessory === 'crown' && <CrownSVG className="absolute -top-8 left-1/2 -translate-x-1/2 scale-40 origin-bottom z-20" />}
        {accessory === 'sunglasses' && <SunglassesSVG className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/3 scale-50 z-20" />}
        {accessory === 'flower' && <div className="absolute top-2 right-1 text-xl scale-90 z-20">🌸</div>}
        
        <PetClothingRenderer clothing={clothing} stage={stage} />
      </div>
    </div>
  );
};

export const MangBearSVG = ({ stage, clothing, accessory, background, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {background === 'pink_cushion' && (
        <PinkCushionSVG className="absolute -bottom-4 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'bed' && (
        <SmallBedSVG className="absolute -bottom-10 translate-y-1/4 z-0 opacity-90" />
      )}
      {background === 'desk' && (
        <MiniDeskSVG className="absolute -bottom-12 -right-8 z-0 opacity-90" />
      )}
      <div className="relative z-10 flex items-center justify-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Ears */}
          <circle cx="30" cy="30" r="12" fill="#A1887F" />
          <circle cx="70" cy="30" r="12" fill="#A1887F" />
          {/* Head */}
          <circle cx="50" cy="50" r="35" fill="#A1887F" />
          {/* Snout */}
          <circle cx="50" cy="55" r="10" fill="#D7CCC8" />
          {/* Nose */}
          <circle cx="50" cy="52" r="3" fill="#3E2723" />
          {/* Eyes */}
          <circle cx="40" cy="45" r="2.5" fill="#000" />
          <circle cx="60" cy="45" r="2.5" fill="#000" />
          {/* Master Sparkle */}
          {stage === 'master' && <circle cx="50" cy="15" r="10" fill="gold" opacity="0.3" />}
        </svg>
        {accessory === 'pink_ribbon' && <PinkRibbonSVG className="absolute top-2 right-2 scale-50 origin-top-right z-20" />}
        {accessory === 'star_hat' && <StarHatSVG className="absolute top-0 right-0 w-5 h-5 z-20" />}
        {accessory === 'crown' && <CrownSVG className="absolute -top-11 left-1/2 -translate-x-1/2 scale-40 origin-bottom z-20" />}
        {accessory === 'sunglasses' && <SunglassesSVG className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-50 z-20" />}
        {accessory === 'flower' && <div className="absolute -top-2 right-0 text-xl scale-90 z-20">🌸</div>}
        
        <PetClothingRenderer clothing={clothing} stage={stage} />
      </div>
    </div>
  );
};

export const PetCharacter = (props: CharacterProps & { character: string }) => {
  switch (props.character) {
    case 'kuromi': return <KuromiSVG {...props} />;
    case 'mymelody': return <MyMelodySVG {...props} />;
    case 'cinnamoroll': return <CinnamorollSVG {...props} />;
    case 'molang': return <MolangSVG {...props} />;
    case 'mang_bear': return <MangBearSVG {...props} />;
    default: return <MolangSVG {...props} />;
  }
};
