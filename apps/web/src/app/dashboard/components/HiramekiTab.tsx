"use client";

import React from "react";

interface HiramekiTip {
  id: string;
  nickname: string;
  content: string;
  createdAt: string;
}

interface HiramekiTabProps {
  hiramekiTips: HiramekiTip[];
  newHiramekiContent: string;
  setNewHiramekiContent: (val: string) => void;
  handlePostHirameki: (e: React.FormEvent) => Promise<void>;
  isPostingHirameki: boolean;
  isLoadingHirameki: boolean;
}

export function HiramekiTab({
  hiramekiTips,
  newHiramekiContent,
  setNewHiramekiContent,
  handlePostHirameki,
  isPostingHirameki,
  isLoadingHirameki,
}: HiramekiTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ひらめきボードのヘッドライン */}
      <div className="bg-gradient-to-r from-amber-50 to-pastel-yellow/30 border-3 border-pastel-yellow-border rounded-3xl p-6 bubbly-shadow flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-2xs bg-amber-500/10 text-pastel-yellow-dark border border-pastel-yellow-border px-3 py-1 rounded-full font-extrabold tracking-wider">
            💡 匿名つまずき共有ボード「みんなのひらめき」
          </span>
          <h3 className="text-base sm:text-lg font-black text-slate-800 mt-2">
            みんながつまずいたところ＆乗りこえたヒントを匿名で共有しよう！
          </h3>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            お名前は自動的に「がんばるオニオン」や「ひらめきラッキョ」などの可愛いニックネームに置き換わるよ。
            お互いをリスペクトする優しい言葉づかいで投稿してね🧅
          </p>
        </div>
        <div className="text-5xl select-none animate-float-gentle">💡</div>
      </div>

      {/* 新規ひらめき投稿フォーム */}
      <div className="bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow space-y-4">
        <h4 className="text-sm font-black text-slate-700">
          あなたのひらめき💡やつまずきをみんなにシェアしよう！
        </h4>
        <form onSubmit={handlePostHirameki} className="space-y-3">
          <textarea
            value={newHiramekiContent}
            onChange={(e) => setNewHiramekiContent(e.target.value)}
            placeholder="例: 方程式のマイナスを移行するときに、符号を変え忘れないように『符号チェンジ！』って心の中で唱えるとミスが減ったよ！💡"
            maxLength={200}
            className="w-full border-2 border-slate-100 hover:border-slate-200 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 rounded-2xl p-4 text-xs font-bold transition-all resize-none h-24"
          />
          <div className="flex justify-between items-center">
            <span className="text-3xs text-slate-400 font-bold">
              残り {200 - newHiramekiContent.length} 文字
            </span>
            <button
              type="submit"
              disabled={isPostingHirameki || !newHiramekiContent.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 border-2 border-indigo-700 text-white font-extrabold rounded-2xl text-xs active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
            >
              {isPostingHirameki ? "チェック中..." : "ひらめきを投稿する！ ✨"}
            </button>
          </div>
        </form>
      </div>

      {/* ひらめき付箋のグリッド */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {isLoadingHirameki ? (
          <div className="col-span-full text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-bold">ひらめきを読み込み中...</p>
          </div>
        ) : hiramekiTips.length > 0 ? (
          hiramekiTips.map((tip, idx) => {
            const colors = [
              "bg-amber-50 border-pastel-yellow-border text-slate-800",
              "bg-pastel-pink border-pastel-pink-border text-slate-800",
              "bg-pastel-blue border-pastel-blue-border text-slate-800",
              "bg-pastel-purple border-pastel-purple-border text-slate-800",
              "bg-pastel-green border-pastel-green-border text-slate-800"
            ];
            const color = colors[idx % colors.length];
            
            const rotations = ["rotate-0", "rotate-1", "-rotate-1", "rotate-2", "-rotate-2"];
            const rot = rotations[idx % rotations.length];

            return (
              <div 
                key={tip.id} 
                className={`${color} ${rot} border-2 rounded-3xl p-5 bubbly-shadow hover:scale-102 hover:rotate-0 transition-all duration-300 relative overflow-hidden flex flex-col justify-between min-h-[160px] animate-fade-in`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-black/5">
                    <span className="text-[10px] font-black tracking-wider uppercase opacity-60">
                      👤 {tip.nickname}
                    </span>
                    <span className="text-[9px] opacity-40 font-bold">
                      {new Date(tip.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed whitespace-pre-wrap">
                    {tip.content}
                  </p>
                </div>
                <div className="absolute top-1.5 right-4 text-xs opacity-35 select-none">📌</div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center text-slate-400 font-bold">
            まだひらめきの投稿はありません。最初のひらめきを投稿してみよう！💡
          </div>
        )}
      </div>
    </div>
  );
}
