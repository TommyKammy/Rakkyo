"use client";

import React from "react";

interface ClearOverlayProps {
  isOpen: boolean;
  isReview: boolean;
  questionsCount: number;
  latestAttemptId: string | null;
  isGeneratingShareLink: boolean;
  handleGenerateParentCelebrationLink: () => void;
  handleCloseClearModal: () => void;
}

export function ClearOverlay({
  isOpen,
  isReview,
  questionsCount,
  latestAttemptId,
  isGeneratingShareLink,
  handleGenerateParentCelebrationLink,
  handleCloseClearModal,
}: ClearOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
      <div className="bg-white border-4 border-pastel-green-border rounded-3xl p-8 max-w-sm w-full text-center bubbly-shadow-lg relative overflow-hidden animate-bounce-gentle">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-pastel-green-dark via-pastel-yellow-dark to-pastel-blue-dark" />
        
        <span className="text-6xl inline-block mb-4">{isReview ? "🔥" : "🏆"}</span>
        
        <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          {isReview ? "復習ミッションクリア！" : "レッスンクリア！"}
        </h3>
        
        <p className="text-xs font-bold text-slate-500 leading-relaxed my-4">
          {isReview
            ? "すごい！苦手な問題をみごとにやっつけたよ！ラッキョくんも大いばり！"
            : `おめでとう！単元すべての問題（${questionsCount}問）をみごとにクリアしたよ！`}
        </p>

        <div className="bg-pastel-green border-2 border-pastel-green-border rounded-2xl p-4 flex flex-col items-center justify-center mb-6 bubbly-shadow-md">
          <span className="text-2xs font-extrabold text-pastel-green-dark tracking-wide">
            クリア報酬
          </span>
          <span className="text-xl font-extrabold text-slate-700 mt-1">
            {isReview ? "+15 XP ボーナス獲得！" : "+100 XP 獲得！"}
          </span>
        </div>

        {latestAttemptId && (
          <button
            onClick={handleGenerateParentCelebrationLink}
            disabled={isGeneratingShareLink}
            className="w-full py-3 mb-3 bg-pastel-purple border-3 border-pastel-purple-border text-pastel-purple-dark font-extrabold rounded-2xl text-xs hover:bg-indigo-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none flex items-center justify-center gap-1.5"
          >
            <span>{isGeneratingShareLink ? "リンクを作成中..." : "✉️ おうちの人にがんばりを伝える！"}</span>
          </button>
        )}

        <button
          onClick={handleCloseClearModal}
          className="w-full py-4 bg-pastel-green border-3 border-pastel-green-border text-pastel-green-dark font-extrabold rounded-2xl text-base hover:bg-emerald-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
        >
          {isReview ? "ダッシュボードにもどる 🏠" : "地図にもどる 🗺️"}
        </button>
      </div>
    </div>
  );
}
