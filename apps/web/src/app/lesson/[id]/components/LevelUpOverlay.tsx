"use client";

import React from "react";

interface LevelUpOverlayProps {
  isOpen: boolean;
  levelUpTo: number;
  onClose: () => void;
}

export function LevelUpOverlay({ isOpen, levelUpTo, onClose }: LevelUpOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none animate-fade-in">
      <div className="bg-white border-4 border-pastel-purple-border rounded-3xl p-8 max-w-sm w-full text-center bubbly-shadow-lg relative overflow-hidden animate-wiggle-once">
        {/* Ribbon Background Sparkles */}
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-pastel-purple-dark via-pastel-pink-dark to-pastel-blue-dark" />
        
        <span className="text-6xl inline-block mb-4 animate-bounce-gentle">👑</span>
        
        <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          レベルアップ！
        </h3>
        
        <div className="my-6 inline-flex items-center gap-3 bg-pastel-purple border-2 border-pastel-purple-border px-5 py-2.5 rounded-2xl text-pastel-purple-dark font-extrabold text-xl bubbly-shadow-md">
          Lv. {levelUpTo - 1} ➔ Lv. {levelUpTo}
        </div>

        <p className="text-xs font-bold text-slate-500 leading-relaxed mb-6">
          すごいよ！どんどん算数マスターに近づいてる！ラッキョくんも大よろこび！
        </p>

        <button
          onClick={onClose}
          className="w-full py-3.5 bg-pastel-purple border-3 border-pastel-purple-border text-pastel-purple-dark font-extrabold rounded-2xl text-sm hover:bg-indigo-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
        >
          冒険をつづける！ ✨
        </button>
      </div>
    </div>
  );
}
