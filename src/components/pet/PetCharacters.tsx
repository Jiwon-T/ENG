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
  // Scale factor based on stage
  const scale = stage === 'baby' ? 0.6 : stage === 'child' ? 0.8 : stage === 'teen' ? 1.0 : 1.2;
  
  return (
    <svg viewBox="0 0 120 100" className={className} width={120 * scale} height={100 * scale} style={{ opacity: 0.95 }}>
      {/* Shirt body */}
      <path d="M30 20 L90 20 L100 80 L20 80 Z" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="2" />
      {/* Collar */}
      <path d="M40 20 L50 35 L70 35 L80 20" fill="#3949AB" stroke="#283593" strokeWidth="2" />
      {/* Tie */}
      <path d="M55 20 L65 20 L65 30 L60 60 L55 30 Z" fill="#C62828" stroke="#B71C1C" strokeWidth="1" />
      {/* Sleeves (abstract) */}
      <path d="M30 25 L15 50 L25 55 L35 40" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="2" />
      <path d="M90 25 L105 50 L95 55 L85 40" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="2" />
    </svg>
  );
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
        
        {clothing === 'uniform' && <SchoolUniformSVG stage={stage} className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-0 opacity-80" />}
        {clothing === 'muji_cape' && <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 opacity-20 rounded-full z-0" />}
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
        
        {clothing === 'uniform' && <SchoolUniformSVG stage={stage} className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-0 opacity-80" />}
        {clothing === 'muji_cape' && <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 opacity-20 rounded-full z-0" />}
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
        
        {clothing === 'uniform' && <SchoolUniformSVG stage={stage} className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-0 opacity-80" />}
        {clothing === 'muji_cape' && <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 opacity-20 rounded-full z-0" />}
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
        
        {clothing === 'uniform' && <SchoolUniformSVG stage={stage} className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-0 opacity-80" />}
        {clothing === 'muji_cape' && <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 opacity-20 rounded-full z-0" />}
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
        
        {clothing === 'uniform' && <SchoolUniformSVG stage={stage} className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-0 opacity-80" />}
        {clothing === 'muji_cape' && <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 opacity-20 rounded-full z-0" />}
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
