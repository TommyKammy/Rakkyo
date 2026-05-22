"use client";

import React from "react";

interface ParentShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareLink: string;
}

export function ParentShareModal({ isOpen, onClose, shareLink }: ParentShareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6 select-none animate-fade-in">
      <div className="bg-white border-4 border-pastel-purple-border rounded-3xl p-6 sm:p-8 max-w-md w-full text-center bubbly-shadow-lg relative overflow-hidden animate-bounce-gentle">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-pastel-purple-dark via-pastel-pink-dark to-pastel-blue-dark" />
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 font-bold hover:text-slate-600 cursor-pointer text-sm"
        >
          ✕
        </button>

        <span className="text-5xl inline-block mb-4">💌</span>
        
        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
          おうちの人へがんばりを伝えよう！
        </h3>
        
        <p className="text-xs font-bold text-slate-500 leading-relaxed my-3">
          がんばった記録とお褒めAIメッセージをパパやママに送ろう！スタンプやお祝いコメントがダッシュボードに返ってくるよ！🧅
        </p>

        <div className="bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl flex flex-col gap-2 mb-6">
          <span className="text-[10px] font-black text-slate-400 block text-left">コピーしてLINEやメールで送ってね：</span>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareLink}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-2xs font-mono font-bold focus:outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                alert("お祝いリンクをコピーしたよ！LINEやメールでおうちの人に送ってね！🧅");
              }}
              className="px-4 py-2 bg-pastel-purple border border-pastel-purple-border text-pastel-purple-dark font-extrabold rounded-xl text-xs active:translate-y-[1px] transition-all cursor-pointer hover:bg-indigo-50/50"
            >
              コピー
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-pastel-purple border-3 border-pastel-purple-border text-pastel-purple-dark font-extrabold rounded-2xl text-xs hover:bg-indigo-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
        >
          とじる
        </button>
      </div>
    </div>
  );
}
