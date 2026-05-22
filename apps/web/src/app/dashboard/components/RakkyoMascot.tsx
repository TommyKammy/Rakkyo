'use client';

import React from 'react';

interface RakkyoMascotProps {
  emotion?: 'normal' | 'correct' | 'incorrect' | 'happy';
  outfit?: string;
  className?: string;
}

export const RakkyoMascot: React.FC<RakkyoMascotProps> = ({
  emotion = 'normal',
  outfit = 'none',
  className = 'h-24 w-24',
}) => {
  // Render emotion-specific eyes and mouth
  const renderFace = () => {
    switch (emotion) {
      case 'correct':
        return (
          <>
            {/* Stars or happy closed eyes */}
            <path d="M34 50 L38 46 L42 50 L38 54 Z" fill="#eab308" stroke="#1e1b4b" strokeWidth="1" />
            <path d="M58 50 L62 46 L66 50 L62 54 Z" fill="#eab308" stroke="#1e1b4b" strokeWidth="1" />
            {/* Blushing cheeks */}
            <circle cx="34" cy="58" r="6" fill="#f43f5e" opacity="0.6" />
            <circle cx="66" cy="58" r="6" fill="#f43f5e" opacity="0.6" />
            {/* Extremely wide joyful mouth */}
            <path d="M42 60 Q50 74 58 60 Z" fill="#e11d48" stroke="#1e1b4b" strokeWidth="2.5" />
            <path d="M46 64 Q50 71 54 64" fill="none" stroke="#fecdd3" strokeWidth="2" />
          </>
        );
      case 'incorrect':
        return (
          <>
            {/* Thoughtful/sad spiral or downcast eyes */}
            <path d="M35 50 Q40 45 42 52" fill="none" stroke="#1e1b4b" strokeWidth="3" strokeLinecap="round" />
            <path d="M58 52 Q60 45 65 50" fill="none" stroke="#1e1b4b" strokeWidth="3" strokeLinecap="round" />
            {/* Thinking sweat drop */}
            <path d="M26 38 C26 38 22 44 26 46 C28 47 28 43 28 43" fill="#3b82f6" stroke="#1e1b4b" strokeWidth="1" />
            {/* Wobbly mouth */}
            <path d="M44 64 Q50 58 56 64" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
          </>
        );
      case 'happy':
        return (
          <>
            {/* Curved joyful eyes */}
            <path d="M33 52 Q40 44 47 52" fill="none" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" />
            <path d="M53 52 Q60 44 67 52" fill="none" stroke="#1e1b4b" strokeWidth="4" strokeLinecap="round" />
            {/* Blushing cheeks */}
            <circle cx="32" cy="59" r="7" fill="#f43f5e" opacity="0.7" />
            <circle cx="68" cy="59" r="7" fill="#f43f5e" opacity="0.7" />
            {/* Heart tongue mouth */}
            <path d="M41 61 Q50 73 59 61 Z" fill="#e11d48" stroke="#1e1b4b" strokeWidth="3" />
            <path d="M47 65 Q50 62 53 65 Q50 70 47 65" fill="#f43f5e" />
          </>
        );
      case 'normal':
      default:
        return (
          <>
            {/* Standard round friendly eyes */}
            <circle cx="38" cy="50" r="4.5" fill="#1e1b4b" />
            <circle cx="62" cy="50" r="4.5" fill="#1e1b4b" />
            {/* Small high-light in eyes */}
            <circle cx="36.5" cy="48.5" r="1.5" fill="#ffffff" />
            <circle cx="60.5" cy="48.5" r="1.5" fill="#ffffff" />
            {/* Blushing cheeks (subtle) */}
            <circle cx="34" cy="57" r="4.5" fill="#f43f5e" opacity="0.4" />
            <circle cx="66" cy="57" r="4.5" fill="#f43f5e" opacity="0.4" />
            {/* Soft smiling mouth */}
            <path d="M44 59 Q50 67 56 59" fill="none" stroke="#1e1b4b" strokeWidth="3" strokeLinecap="round" />
          </>
        );
    }
  };

  // Render outfitted accessories (hats, crowns, ties, glasses) overlay
  const renderOutfit = () => {
    switch (outfit) {
      case 'straw_hat':
        return (
          <g id="straw_hat_accessory">
            {/* Yellow straw hat base */}
            <ellipse cx="50" cy="20" rx="36" ry="6" fill="#eab308" stroke="#1e1b4b" strokeWidth="2.5" />
            {/* Red band */}
            <path d="M26 19 C28 12 72 12 74 19 Z" fill="#ef4444" />
            {/* Crown of the hat */}
            <path d="M28 17 C30 5 70 5 72 17" fill="#eab308" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round" />
            {/* Straw texture line */}
            <path d="M35 12 Q50 15 65 12" fill="none" stroke="#ca8a04" strokeWidth="1.5" />
          </g>
        );
      case 'glasses':
        return (
          <g id="glasses_accessory">
            {/* Left rim */}
            <rect x="25" y="42" width="18" height="15" rx="4" fill="none" stroke="#1e1b4b" strokeWidth="3.5" />
            <line x1="28" y1="44" x2="35" y2="44" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            {/* Right rim */}
            <rect x="57" y="42" width="18" height="15" rx="4" fill="none" stroke="#1e1b4b" strokeWidth="3.5" />
            <line x1="60" y1="44" x2="67" y2="44" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            {/* Bridge */}
            <path d="M43 49 Q50 46 57 49" fill="none" stroke="#1e1b4b" strokeWidth="3.5" />
            {/* Glasses temples */}
            <path d="M25 47 L18 45" fill="none" stroke="#1e1b4b" strokeWidth="3" />
            <path d="M75 47 L82 45" fill="none" stroke="#1e1b4b" strokeWidth="3" />
          </g>
        );
      case 'tie':
        return (
          <g id="tie_accessory" transform="translate(0, 10)">
            {/* Collar wrap */}
            <path d="M40 70 L50 78 L60 70" fill="none" stroke="#f1f5f9" strokeWidth="3.5" strokeLinecap="round" />
            {/* Tie Knot */}
            <polygon points="46,74 54,74 52,79 48,79" fill="#fbbf24" stroke="#1e1b4b" strokeWidth="2" />
            {/* Tie Body */}
            <polygon points="48,79 52,79 55,95 50,100 45,95" fill="#fbbf24" stroke="#1e1b4b" strokeWidth="2" />
            {/* Stripes */}
            <line x1="48" y1="84" x2="52" y2="82" stroke="#d97706" strokeWidth="1.5" />
            <line x1="47" y1="90" x2="53" y2="88" stroke="#d97706" strokeWidth="1.5" />
          </g>
        );
      case 'crown':
        return (
          <g id="crown_accessory" className="animate-bounce" style={{ animationDuration: '3s' }}>
            {/* Golden crown */}
            <path
              d="M26 22 L32 10 L50 17 L68 10 L74 22 Z"
              fill="#fbbf24"
              stroke="#1e1b4b"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {/* Crown band */}
            <rect x="26" y="20" width="48" height="4" fill="#f59e0b" stroke="#1e1b4b" strokeWidth="2.0" />
            {/* Jewels */}
            <circle cx="32" cy="9" r="2.5" fill="#ef4444" stroke="#1e1b4b" strokeWidth="1" />
            <circle cx="50" cy="16" r="2.5" fill="#3b82f6" stroke="#1e1b4b" strokeWidth="1" />
            <circle cx="68" cy="9" r="2.5" fill="#ef4444" stroke="#1e1b4b" strokeWidth="1" />
            
            <circle cx="38" cy="22" r="1.5" fill="#10b981" />
            <circle cx="50" cy="22" r="1.5" fill="#ec4899" />
            <circle cx="62" cy="22" r="1.5" fill="#10b981" />
          </g>
        );
      case 'none':
      default:
        return null;
    }
  };

  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Glow Effect if happy/correct */}
      {(emotion === 'correct' || emotion === 'happy') && (
        <circle cx="50" cy="55" r="38" fill="rgba(251, 191, 36, 0.15)" className="animate-pulse" />
      )}

      {/* Main Mascot Body (Rakkyo Onion) */}
      <path
        d="M50 15 C30 35 23 75 50 85 C77 75 70 35 50 15 Z"
        fill="url(#onionGradient)"
        stroke="#4f46e5"
        strokeWidth="3.0"
        strokeLinejoin="round"
      />

      {/* Textured Onion Lines */}
      <path d="M50 15 C38 38 33 65 40 82" fill="none" stroke="#a5b4fc" strokeWidth="2" opacity="0.6" />
      <path d="M50 15 C62 38 67 65 60 82" fill="none" stroke="#a5b4fc" strokeWidth="2" opacity="0.6" />
      <path d="M50 15 C45 35 43 60 47 84" fill="none" stroke="#c7d2fe" strokeWidth="1.5" opacity="0.4" />
      <path d="M50 15 C55 35 57 60 53 84" fill="none" stroke="#c7d2fe" strokeWidth="1.5" opacity="0.4" />

      {/* Face Expression Layer */}
      <g id="mascot_face">{renderFace()}</g>

      {/* Outfit Accessories Layer */}
      <g id="mascot_accessories">{renderOutfit()}</g>

      <defs>
        {/* Harmonious vibrant color gradient */}
        <linearGradient id="onionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#e0e7ff" />
          <stop offset="70%" stopColor="#c7d2fe" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>
    </svg>
  );
};
