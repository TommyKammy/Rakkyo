"use client";

import React from "react";
import { RakkyoEmotion } from "../../../hooks/useRakkyoVoice";


interface RecommendationResult {
  recommendedLessonId: string;
  recommendedLessonName: string;
  reason: string;
  isMock: boolean;
}

interface QuestProgress {
  id: string;
  name: string;
  description: string;
  current: number;
  target: number;
  isCompleted: boolean;
  bonusXp: number;
}

interface AdventureTabProps {
  recommendation: RecommendationResult | null;
  reviews: any[];
  quests: QuestProgress[];
  ALL_BADGES: Array<{ name: string; emoji: string; desc: string }>;
  cleanUserBadgeNames: string[];
  speak: (text: string, emotion?: RakkyoEmotion) => void;
  stop: () => void;
  getNumericLessonId: (recommendation: { recommendedLessonId: string; recommendedLessonName: string }) => number;
  router: any;
}

export function AdventureTab({
  recommendation,
  reviews,
  quests,
  ALL_BADGES,
  cleanUserBadgeNames,
  speak,
  stop,
  getNumericLessonId,
  router,
}: AdventureTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Today's Recommended Lesson Card (Hyper-Personalized AI) */}
      {recommendation && (
        <section className="bg-gradient-to-r from-indigo-50 to-pastel-purple/20 border-3 border-pastel-purple-border rounded-3xl p-6 bubbly-shadow relative overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="absolute right-4 top-4 text-3xl opacity-20 animate-pulse">✨</div>
          <div className="absolute left-1/3 bottom-2 text-2xl opacity-10 animate-bounce">🧅</div>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs bg-indigo-600/10 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-extrabold tracking-wider flex items-center gap-1">
                  🌟 AIがえらんだ今日のおすすめ
                </span>
                {recommendation.isMock && (
                  <span className="text-3xs bg-pastel-yellow border border-pastel-yellow-border text-pastel-yellow-dark px-2 py-0.5 rounded-full font-bold">
                    体験版おすすめ
                  </span>
                )}
              </div>
              
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                🧅 {recommendation.recommendedLessonName}
              </h3>
              
              <p className="text-sm font-semibold text-slate-600 bg-white/60 backdrop-blur-sm border border-slate-100/50 p-4 rounded-2xl leading-relaxed">
                {recommendation.reason}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto flex-shrink-0">
              <button
                onClick={() => speak(recommendation.reason, 'neutral')}
                className="px-6 py-3.5 bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-700 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 active:translate-y-[1px] transition-all bubbly-shadow cursor-pointer select-none"
              >
                <span>🔊 もう一回きく</span>
              </button>
              
              <button
                onClick={() => {
                  stop();
                  const targetId = getNumericLessonId(recommendation);
                  router.push(`/lesson/${targetId}`);
                }}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-indigo-700 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer shadow-lg shadow-indigo-600/20 select-none font-black"
              >
                <span>冒険へ出発する！ 🧅</span>
              </button>
            </div>
          </div>
        </section>
      )}

      <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Columns: Subject Adventure Cards */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow space-y-4">
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              🧭 ぼうけんする教科をえらぼう！
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Mathematics (ACTIVE) */}
              <div className="bg-pastel-green border-3 border-pastel-green-border rounded-3xl p-5 bubbly-shadow flex flex-col justify-between h-48 hover:scale-[1.02] transition-transform select-none relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-7xl font-bold">
                  📐
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-emerald-500/10 text-pastel-green-dark border border-pastel-green-border px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      中1数学
                    </span>
                    <span className="text-xs text-slate-400 font-extrabold">
                      問題数 30問
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-800">
                    数と方程式の冒険
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                    正負の数、文字式、方程式のパズルを解いて魔王をたおそう！
                  </p>
                </div>
                
                <button
                  onClick={() => router.push("/math")}
                  className="w-full py-3 bg-pastel-green-dark border-2 border-emerald-700 text-white font-extrabold rounded-2xl text-sm active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer text-center select-none"
                >
                  冒険をはじめる！ 🗺️
                </button>
              </div>

              {/* English (ACTIVE) */}
              <div className="bg-pastel-purple border-3 border-pastel-purple-border rounded-3xl p-5 bubbly-shadow flex flex-col justify-between h-48 hover:scale-[1.02] transition-transform select-none relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-7xl font-bold">
                  🇬🇧
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-purple-500/10 text-pastel-purple-dark border border-pastel-purple-border px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      中1英語
                    </span>
                    <span className="text-xs text-slate-400 font-extrabold">
                      問題数 30問
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-800">
                    アルファベットと言葉
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                    英単語のスペルや挨拶、be動詞と一般動詞の会話パズル！
                  </p>
                </div>
                <button
                  onClick={() => router.push("/english")}
                  className="w-full py-3 bg-pastel-purple-dark border-2 border-purple-700 text-white font-extrabold rounded-2xl text-sm active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer text-center select-none"
                >
                  冒険をはじめる！ 🗺️
                </button>
              </div>

              {/* Science (ACTIVE) */}
              <div className="bg-pastel-blue border-3 border-pastel-blue-border rounded-3xl p-5 bubbly-shadow flex flex-col justify-between h-48 hover:scale-[1.02] transition-transform select-none relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-7xl font-bold">
                  🧪
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-sky-500/10 text-pastel-blue-dark border border-pastel-blue-border px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      中1理科
                    </span>
                    <span className="text-xs text-slate-400 font-extrabold">
                      問題数 30問
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-800">
                    身のまわりの不思議
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                    身のまわりの植物、光や音、物質のなぞを解き明かそう！
                  </p>
                </div>
                <button
                  onClick={() => router.push("/science")}
                  className="w-full py-3 bg-pastel-blue-dark border-2 border-sky-700 text-white font-extrabold rounded-2xl text-sm active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer text-center select-none"
                >
                  冒険をはじめる！ 🗺️
                </button>
              </div>

              {/* Social Studies (ACTIVE) */}
              <div className="bg-pastel-orange border-3 border-pastel-orange-border rounded-3xl p-5 bubbly-shadow flex flex-col justify-between h-48 hover:scale-[1.02] transition-transform select-none relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-7xl font-bold">
                  🧭
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-amber-500/10 text-pastel-orange-dark border border-pastel-orange-border px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      中1社会
                    </span>
                    <span className="text-xs text-slate-400 font-extrabold">
                      問題数 30問
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-800">
                    世界の地理と歴史
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                    世界の国々や歴史の流れ、くらしの工夫を発見する旅へ！
                  </p>
                </div>
                <button
                  onClick={() => router.push("/social")}
                  className="w-full py-3 bg-pastel-orange-dark border-2 border-amber-700 text-white font-extrabold rounded-2xl text-sm active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer text-center select-none"
                >
                  冒険をはじめる！ 🗺️
                </button>
              </div>

              {/* Japanese (ACTIVE) */}
              <div className="bg-pastel-pink border-3 border-pastel-pink-border rounded-3xl p-5 bubbly-shadow flex flex-col justify-between h-48 hover:scale-[1.02] transition-transform select-none relative overflow-hidden sm:col-span-2">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-15 text-7xl font-bold">
                  🎌
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-rose-500/10 text-pastel-pink-dark border border-pastel-pink-border px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      中1国語
                    </span>
                    <span className="text-xs text-slate-400 font-extrabold">
                      問題数 30問
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-800">
                    ことばと言葉の冒険
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
                    漢字や語彙、言葉のきまり、文章の正しい読み解き方をマスターしよう！
                  </p>
                </div>
                <button
                  onClick={() => router.push("/japanese")}
                  className="w-full py-3 bg-pastel-pink-dark border-2 border-rose-700 text-white font-extrabold rounded-2xl text-sm active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer text-center select-none mt-2"
                >
                  冒険をはじめる！ 🗺️
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Right 1 Column: Daily Mission & Badges Panel */}
        <div className="space-y-6">
          
          {/* Review Mission Card */}
          {reviews.length > 0 && (
            <div className="bg-pastel-pink border-3 border-pastel-pink-border rounded-3xl p-6 bubbly-shadow space-y-4">
              <h3 className="text-md font-extrabold text-pastel-pink-dark tracking-tight flex items-center gap-1.5 animate-pulse">
                🔥 にがて克服ミッション！
              </h3>
              <div className="bg-white border-2 border-pastel-pink-border rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
                <div className="flex gap-3 items-start">
                  <div className="text-2xl mt-0.5">🧅</div>
                  <div className="flex-1">
                    <h5 className="font-extrabold text-sm text-slate-800 leading-tight">
                      {reviews[0].unitName || "数と方程式"}
                    </h5>
                    <p className="text-2xs text-slate-400 font-semibold mt-0.5">
                      復習候補：{reviews.length} 問
                    </p>
                    <p className="text-xs font-bold text-slate-600 mt-2 leading-relaxed">
                      過去に間違えたり、ヒントを沢山使った問題だよ！再挑戦で <strong className="text-indigo-600 font-black">+30 XP</strong> 克服ボーナス！
                    </p>
                  </div>
                </div>
                
                <div className="text-3xs bg-pastel-yellow border border-pastel-yellow-border text-pastel-yellow-dark px-2.5 py-1 rounded-full font-extrabold self-start flex items-center gap-1">
                  <span>💎 報酬:</span>
                  <span>克服クリアで計 +30 XP 獲得！</span>
                </div>

                <button
                  onClick={() => {
                    const getLessonUrlId = (unitName: string) => {
                      if (!unitName) return 1;
                      if (unitName.includes("正負")) return 1;
                      if (unitName.includes("文字")) return 2;
                      if (unitName.includes("方程式")) return 3;
                      return 1;
                    };
                    const firstReview = reviews[0];
                    const urlId = getLessonUrlId(firstReview.unitName || firstReview.unitId || "");
                    router.push(`/lesson/${urlId}?review=true`);
                  }}
                  className="w-full py-3 bg-pastel-pink-dark border-2 border-rose-700 text-white font-extrabold rounded-2xl text-xs active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer text-center select-none"
                >
                  にがてを克服する！ 💪
                </button>
              </div>
            </div>
          )}

          {/* Phase 10: Daily Quests Panel */}
          <div className="bg-pastel-yellow border-3 border-pastel-yellow-border rounded-3xl p-6 bubbly-shadow space-y-4">
            <h3 className="text-md font-extrabold text-pastel-yellow-dark tracking-tight flex items-center gap-1.5">
              🎯 本日のデイリークエスト
            </h3>
            
            <div className="space-y-3.5">
              {quests.map((quest) => (
                <div key={quest.id} className={`bg-white border-2 rounded-2xl p-4 flex flex-col gap-2 relative overflow-hidden transition-all ${
                  quest.isCompleted ? 'border-amber-400 bg-amber-50/20' : 'border-pastel-yellow-border'
                }`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h5 className="font-extrabold text-sm text-slate-800 leading-tight">
                        {quest.name}
                      </h5>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        {quest.description}
                      </p>
                    </div>
                    {quest.isCompleted ? (
                      <span className="text-lg animate-bounce">✅</span>
                    ) : (
                      <span className="text-[10px] font-black text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded-md">
                        +{quest.bonusXp} XP
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] text-slate-400 font-extrabold">
                      <span>進みぐあい</span>
                      <span>{quest.current} / {quest.target}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 border border-slate-200 rounded-full overflow-hidden p-[1px]">
                      <div
                        style={{ width: `${Math.min(100, Math.floor((quest.current / quest.target) * 100))}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          quest.isCompleted ? 'bg-amber-400' : 'bg-yellow-300'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 10: Dynamic Badge Collection Shelf */}
          <div className="bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow space-y-4">
            <h3 className="text-md font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              🏆 マイバッジコレクション ({cleanUserBadgeNames.length} / {ALL_BADGES.length})
            </h3>
            
            <div className="grid grid-cols-2 gap-3.5 bg-gradient-to-b from-slate-50 to-slate-100/60 p-3.5 rounded-2xl border-2 border-slate-100">
              {ALL_BADGES.map((badge, idx) => {
                const isEarned = cleanUserBadgeNames.includes(badge.name);
                
                return (
                  <div
                    key={idx}
                    className={`relative p-3 rounded-2xl flex flex-col items-center justify-center text-center transition-all bubbly-shadow border-2 ${
                      isEarned 
                        ? "bg-white border-indigo-100 scale-100 hover:scale-105 shadow-[0_4px_10px_rgba(99,102,241,0.08)]"
                        : "bg-slate-200/50 border-slate-300/30 scale-95 grayscale opacity-45"
                    }`}
                    title={badge.desc}
                  >
                    <div className="text-3xl mb-1 select-none animate-float-gentle">
                      {badge.emoji}
                    </div>
                    <span className="text-[10px] font-black text-slate-700 tracking-tight truncate w-full">
                      {badge.name}
                    </span>
                    {!isEarned && (
                      <span className="absolute bottom-1 right-2 text-[8px] font-bold text-slate-400">未</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
