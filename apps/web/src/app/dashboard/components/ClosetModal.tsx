'use client';

import React from 'react';

export interface OutfitItem {
  id: string;
  name: string;
  emoji: string;
  requiredLevel: number;
  description: string;
}

export const OUTFIT_ITEMS: OutfitItem[] = [
  { id: 'none', name: 'いつもの姿', emoji: '🧅', requiredLevel: 1, description: 'ありのままのラッキョくん' },
  { id: 'straw_hat', name: '麦わら帽子', emoji: '👒', requiredLevel: 2, description: 'さわやかな夏スタイル' },
  { id: 'glasses', name: 'インテリメガネ', emoji: '👓', requiredLevel: 3, description: '数学が得意そうに見えるかも' },
  { id: 'tie', name: '黄金のネクタイ', emoji: '👔', requiredLevel: 4, description: 'びしっと決めたビジネススタイル' },
  { id: 'crown', name: '高貴な王冠', emoji: '👑', requiredLevel: 5, description: '算数王国のキングになろう！' },
];

interface ClosetModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLevel: number;
  currentOutfit: string;
  onSelectOutfit: (id: string) => void;
}

export const ClosetModal: React.FC<ClosetModalProps> = ({
  isOpen,
  onClose,
  userLevel,
  currentOutfit,
  onSelectOutfit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <style>{`
        @keyframes pop {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop {
          animation: pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <div className="relative w-full max-w-md mx-4 rounded-3xl bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 text-white border border-indigo-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-pop">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 flex items-center justify-center transition"
        >
          ✕
        </button>

        {/* Title */}
        <div className="text-center mb-6">
          <span className="text-3xl">👕</span>
          <h2 className="text-xl font-black mt-2 bg-clip-text bg-gradient-to-r from-indigo-200 to-indigo-100">
            ラッキョくんのクローゼット
          </h2>
          <p className="text-xs text-indigo-300 mt-1">
            レベルを上げてオシャレな衣装をアンロックしよう！
          </p>
        </div>

        {/* Items list */}
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {OUTFIT_ITEMS.map((item) => {
            const isUnlocked = userLevel >= item.requiredLevel;
            const isEquipped = currentOutfit === item.id;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isUnlocked) {
                    onSelectOutfit(item.id);
                  }
                }}
                className={`relative flex items-center gap-4 p-3.5 rounded-2xl border transition duration-200 ${
                  isEquipped
                    ? 'bg-indigo-600/40 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                    : isUnlocked
                    ? 'bg-indigo-950/40 border-indigo-500/20 hover:border-indigo-400/50 hover:bg-indigo-900/30 cursor-pointer'
                    : 'bg-slate-950/30 border-slate-800/40 opacity-50 select-none'
                }`}
              >
                {/* Outfit Preview */}
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-3xl border ${
                  isEquipped ? 'bg-indigo-500/30 border-indigo-300' : 'bg-slate-900/60 border-indigo-950'
                }`}>
                  {item.emoji}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm">{item.name}</span>
                    {isEquipped && (
                      <span className="text-[10px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                        そうび中
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-indigo-300/80 mt-0.5">{item.description}</p>
                </div>

                {/* Status / Lock */}
                <div>
                  {isUnlocked ? (
                    !isEquipped && (
                      <span className="text-xs text-indigo-400 hover:text-indigo-300 font-bold px-2 py-1">
                        そうび
                      </span>
                    )
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="text-sm">🔒</span>
                      <span className="text-[9px] font-bold text-rose-400/90 mt-0.5">Lv.{item.requiredLevel}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-indigo-600 py-3 font-extrabold text-sm text-white hover:bg-indigo-500 active:scale-98 transition"
          >
            クローゼットを閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
