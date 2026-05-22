'use client';

import React, { useEffect, useState } from 'react';

interface CongratsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'levelUp' | 'streak' | 'quest' | 'badge';
  title?: string;
  subtitle?: string;
  bonusXp?: number;
  badgeName?: string;
  streakCount?: number;
  level?: number;
}

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  color: string;
  size: number;
  rotation: number;
}

export const CongratsOverlay: React.FC<CongratsOverlayProps> = ({
  isOpen,
  onClose,
  type,
  title,
  subtitle,
  bonusXp,
  badgeName,
  streakCount,
  level,
}) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Generate 80 random confetti pieces
      const colors = ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
      const newPieces = Array.from({ length: 80 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100, // percentage
        delay: Math.random() * 4, // seconds delay
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 12 + 8, // px
        rotation: Math.random() * 360,
      }));
      setPieces(newPieces);

      // Auto close after 6 seconds (or keep it open until click)
    } else {
      setPieces([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine sound effect or details based on type
  const getHeaderIcon = () => {
    switch (type) {
      case 'levelUp':
        return '👑';
      case 'streak':
        return '🔥';
      case 'quest':
        return '🧮';
      case 'badge':
        return '🎉';
      default:
        return '✨';
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'levelUp':
        return `レベル ${level} にあがったよ！`;
      case 'streak':
        return `${streakCount}日れんぞく達成！`;
      case 'quest':
        return 'デイリークエスト達成！';
      case 'badge':
        return 'あたらしいバッジ獲得！';
      default:
        return 'おめでとう！';
    }
  };

  const getCelebrationMessage = () => {
    switch (type) {
      case 'levelUp':
        return 'どんどんレベルがあがっていくね！この調子でがんばろう🧅✨';
      case 'streak':
        return '毎日こつこつ続けられて本当にすごい！あきらめない心が燃えているよ！🔥';
      case 'quest':
        return '本日の特別なミッションをクリアしたよ！ボーナス経験値をプレゼント！🎁';
      case 'badge':
        return `アチーブメント「${badgeName}」をアンロックしたよ！自慢しちゃおう！🌟`;
      default:
        return '素晴らしいがんばりだね！素晴らしいプロセスだよ！';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* CSS Styles injection for high-performance 60fps animations */}
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(-5vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0.3;
          }
        }
        @keyframes pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(3deg); }
        }
        @keyframes onion-joy {
          0%, 100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-30px) scale(0.9, 1.15); }
          50% { transform: translateY(-35px) rotate(15deg) scale(1.05, 0.95); }
          70% { transform: translateY(-20px) rotate(-15deg) scale(1); }
          85% { transform: translateY(0) scale(1.1, 0.85); }
        }
        .confetti-piece {
          position: absolute;
          top: -20px;
          animation: fall 4s linear infinite;
          will-change: transform, opacity;
        }
        .animate-pop {
          animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-onion-joy {
          animation: onion-joy 1.2s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Confetti Container */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {pieces.map((p) => (
          <div
            key={p.id}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              backgroundColor: p.color,
              width: `${p.size}px`,
              height: `${p.size * 0.6}px`,
              transform: `rotate(${p.rotation}deg)`,
              borderRadius: p.id % 3 === 0 ? '50%' : '2px',
            }}
          />
        ))}
      </div>

      {/* Celebration Card */}
      <div className="relative w-full max-w-md mx-4 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-8 text-center text-white border-2 border-indigo-400/50 shadow-[0_0_50px_rgba(99,102,241,0.5)] animate-pop">
        {/* Colorful Glow Backgrounds */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />

        {/* Big Badge Icon */}
        <div className="relative mb-6 flex justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-indigo-500/20 text-6xl border border-indigo-300/30 shadow-lg animate-float">
            {getHeaderIcon()}
          </div>
          <div className="absolute -top-1 right-12 h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center text-xs animate-ping" />
        </div>

        {/* Title */}
        <h2 className="mb-2 text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200">
          {title || getDefaultTitle()}
        </h2>

        {/* Subtitle / Description */}
        <p className="mb-6 text-sm text-indigo-200 font-medium leading-relaxed px-2">
          {subtitle || getCelebrationMessage()}
        </p>

        {/* Mascot / Happy Onion Animation */}
        <div className="mb-6 flex justify-center items-center h-28">
          <svg className="h-24 w-24 animate-onion-joy" viewBox="0 0 100 100">
            {/* Body */}
            <path
              d="M50 15 C30 35 25 75 50 85 C75 75 70 35 50 15 Z"
              fill="url(#onionGrad)"
              stroke="#6366f1"
              strokeWidth="2.5"
            />
            {/* Inner Stripes */}
            <path d="M50 15 C40 38 35 65 42 80" fill="none" stroke="#a5b4fc" strokeWidth="1.5" opacity="0.6" />
            <path d="M50 15 C60 38 65 65 58 80" fill="none" stroke="#a5b4fc" strokeWidth="1.5" opacity="0.6" />
            {/* Happy Eyes */}
            <path d="M38 52 Q43 47 48 52" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M52 52 Q57 47 62 52" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
            {/* Blushing cheeks */}
            <circle cx="34" cy="59" r="5" fill="#f43f5e" opacity="0.7" />
            <circle cx="66" cy="59" r="5" fill="#f43f5e" opacity="0.7" />
            {/* Wide Joyful Mouth */}
            <path d="M42 62 Q50 72 58 62" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
            
            <defs>
              <linearGradient id="onionGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e7ff" />
                <stop offset="50%" stopColor="#c7d2fe" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Bonus indicator */}
        {(bonusXp && bonusXp > 0) ? (
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 border border-amber-400/40 text-amber-300 font-extrabold text-sm shadow-inner">
            <span>🎉 ボーナス獲得</span>
            <span className="text-amber-200 bg-amber-600/60 px-2 py-0.5 rounded-full text-xs">+{bonusXp} XP</span>
          </div>
        ) : null}

        {/* OK Button */}
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-500 py-3.5 px-6 text-base font-black text-white shadow-lg transition duration-200 hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
        >
          やったね！
        </button>
      </div>
    </div>
  );
};
