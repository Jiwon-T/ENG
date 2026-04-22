import React from 'react';
import { PetStage } from '../../lib/petService';

interface CharacterProps {
  stage: PetStage;
  outfit?: string | null;
  className?: string;
}

export const KuromiSVG = ({ stage, outfit, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
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
      {outfit === 'pink_ribbon' && <div className="absolute top-0 right-0 text-xl">🎀</div>}
      {outfit === 'star_hat' && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">⭐</div>}
      {outfit === 'crown' && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">👑</div>}
    </div>
  );
};

export const MyMelodySVG = ({ stage, outfit, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
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
      {outfit === 'pink_ribbon' && <div className="absolute top-4 right-4 text-xl">🎀</div>}
      {outfit === 'crown' && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">👑</div>}
    </div>
  );
};

export const CinnamorollSVG = ({ stage, outfit, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
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
      {outfit === 'star_hat' && <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">⭐</div>}
      {outfit === 'crown' && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">👑</div>}
    </div>
  );
};

export const MolangSVG = ({ stage, outfit, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
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
      {outfit === 'pink_ribbon' && <div className="absolute top-1/2 left-0 text-xl">🎀</div>}
      {outfit === 'crown' && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">👑</div>}
    </div>
  );
};

export const MangBearSVG = ({ stage, outfit, className }: CharacterProps) => {
  const size = stage === 'baby' ? 60 : stage === 'child' ? 90 : stage === 'teen' ? 120 : 150;
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
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
      {outfit === 'muji_cape' && <div className="absolute inset-0 bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 opacity-30 rounded-full" />}
      {outfit === 'crown' && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">👑</div>}
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
