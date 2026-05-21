"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  nickname: string;
  level: number;
  streakCount: number;
}

interface UnitInfo {
  id: number;
  name: string;
  description: string;
  status: "completed" | "active" | "locked";
  lessonId: number;
  badge: string;
  colorTheme: {
    bg: string;
    border: string;
    text: string;
    nodeBg: string;
    nodeText: string;
  };
}

export default function UnitRoadmap() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number>(1);

  // Math Units defined in the static curriculum package
  const units: UnitInfo[] = [
    {
      id: 1,
      name: "正負の数",
      description: "プラスとマイナスの数の世界を冒険しよう！",
      status: "completed",
      lessonId: 1,
      badge: "❄️",
      colorTheme: {
        bg: "bg-pastel-blue",
        border: "border-pastel-blue-border",
        text: "text-pastel-blue-dark",
        nodeBg: "bg-sky-400",
        nodeText: "text-white",
      },
    },
    {
      id: 2,
      name: "文字と式",
      description: "xやyを使って、いろいろな数量を式で表してみよう。",
      status: "active",
      lessonId: 2,
      badge: "🌿",
      colorTheme: {
        bg: "bg-pastel-green",
        border: "border-pastel-green-border",
        text: "text-pastel-green-dark",
        nodeBg: "bg-emerald-500",
        nodeText: "text-white",
      },
    },
    {
      id: 3,
      name: "一次方程式",
      description: "天秤のバランスを使って、わからない数xの正体を突き止めよう！",
      status: "locked",
      lessonId: 3,
      badge: "⚖️",
      colorTheme: {
        bg: "bg-pastel-pink",
        border: "border-pastel-pink-border",
        text: "text-pastel-pink-dark",
        nodeBg: "bg-pink-400",
        nodeText: "text-white",
      },
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("rakkyo_token");
    const userStr = localStorage.getItem("rakkyo_user");

    if (!token || !userStr) {
      router.push("/");
      return;
    }

    try {
      setUser(JSON.parse(userStr));
    } catch (e) {
      router.push("/");
    }
  }, [router]);

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-pastel-blue-border border-t-pastel-blue-dark" />
      </div>
    );
  }

  const activeUnitInfo = units.find((u) => u.id === selectedUnit) || units[0];

  return (
    <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6 select-none relative">
      
      {/* Background SVG grids */}
      <div className="absolute top-[10%] left-[-5%] w-[35%] h-[35%] rounded-full bg-pastel-green opacity-40 blur-3xl -z-10" />
      <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] rounded-full bg-pastel-blue opacity-40 blur-3xl -z-10" />

      {/* 1. Header (Navigation Back) */}
      <header className="flex items-center justify-between bg-white border-3 border-slate-100 rounded-3xl p-4 sm:px-6 bubbly-shadow">
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2.5 bg-slate-50 border-2 border-slate-200 text-slate-600 font-extrabold rounded-2xl text-xs hover:bg-slate-100 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer flex items-center gap-1"
        >
          ◀ ホームにもどる
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 mr-1 hidden sm:inline">
            {user.nickname}ちゃん
          </span>
          <div className="h-8 px-3 bg-pastel-purple border border-pastel-purple-border rounded-xl flex items-center justify-center font-extrabold text-pastel-purple-dark text-xs">
            Lv. {user.level}
          </div>
          <div className="h-8 px-3 bg-pastel-orange border border-pastel-orange-border rounded-xl flex items-center justify-center font-extrabold text-pastel-orange-dark text-xs">
            🔥 {user.streakCount}日連続
          </div>
        </div>
      </header>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
          📐 中1数学の冒険ロードマップ
        </h2>
        <p className="text-xs text-slate-400 font-bold mt-1">
          単元を順番にクリアして、数学マスターになろう！
        </p>
      </div>

      {/* 2. Main Map Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        
        {/* Left Column: Roadmap Visual Path */}
        <div className="md:col-span-2 bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow relative overflow-hidden flex items-center justify-center min-h-[420px]">
          
          {/* SVG Dotted Line Connecting Nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 120 70 Q 280 150 200 240 T 140 370"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="8,8"
            />
            {/* Active stage highlighting overlay */}
            <path
              d="M 120 70 Q 280 150 200 240"
              fill="none"
              stroke="#6366f1"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray="8,8"
              opacity="0.3"
            />
          </svg>

          {/* Interactive Nodes Placed Over SVG */}
          <div className="relative z-10 w-full h-full flex flex-col justify-between items-center py-6 space-y-16">
            
            {/* Unit 1 Node */}
            <div className="flex items-center w-full max-w-[280px] justify-start self-start translate-x-6 sm:translate-x-12">
              <button
                onClick={() => setSelectedUnit(1)}
                className={`w-16 h-16 rounded-full flex items-center justify-center border-4 bubbly-shadow-md cursor-pointer transition-transform duration-300 hover:scale-110 active:translate-y-[2px] ${
                  selectedUnit === 1
                    ? "border-sky-500 scale-105"
                    : "border-sky-200"
                } bg-sky-400 text-white font-extrabold text-xl relative`}
              >
                1
                <span className="absolute bottom-[-10px] right-[-10px] text-lg bg-emerald-100 border border-emerald-300 p-0.5 rounded-full">
                  ✅
                </span>
              </button>
              <div className="ml-4 bg-white border-2 border-sky-100 px-4 py-2 rounded-2xl bubbly-shadow-md">
                <p className="text-xs font-extrabold text-sky-500">第1章：クリア！</p>
                <p className="text-sm font-extrabold text-slate-700">正負の数</p>
              </div>
            </div>

            {/* Unit 2 Node */}
            <div className="flex items-center w-full max-w-[280px] justify-end self-end -translate-x-6 sm:-translate-x-12">
              <div className="mr-4 bg-white border-2 border-emerald-100 px-4 py-2 rounded-2xl bubbly-shadow-md text-right">
                <p className="text-xs font-extrabold text-emerald-500 animate-pulse">挑戦中！</p>
                <p className="text-sm font-extrabold text-slate-700">文字と式</p>
              </div>
              <button
                onClick={() => setSelectedUnit(2)}
                className={`w-16 h-16 rounded-full flex items-center justify-center border-4 bubbly-shadow-md cursor-pointer transition-transform duration-300 hover:scale-110 active:translate-y-[2px] ${
                  selectedUnit === 2
                    ? "border-emerald-600 scale-105 animate-pulse"
                    : "border-emerald-200"
                } bg-emerald-500 text-white font-extrabold text-xl relative`}
              >
                2
                <span className="absolute top-[-8px] right-[-8px] text-md animate-bounce-gentle">
                  🧭
                </span>
              </button>
            </div>

            {/* Unit 3 Node */}
            <div className="flex items-center w-full max-w-[280px] justify-start self-start translate-x-10 sm:translate-x-20">
              <button
                onClick={() => setSelectedUnit(3)}
                className={`w-16 h-16 rounded-full flex items-center justify-center border-4 bubbly-shadow-md cursor-pointer transition-transform duration-300 hover:scale-110 active:translate-y-[2px] ${
                  selectedUnit === 3
                    ? "border-pink-500 scale-105"
                    : "border-slate-200"
                } bg-slate-300 text-slate-400 font-extrabold text-xl relative`}
              >
                3
                <span className="absolute bottom-[-10px] right-[-10px] text-md">
                  🔒
                </span>
              </button>
              <div className="ml-4 bg-white border-2 border-slate-100 px-4 py-2 rounded-2xl bubbly-shadow-md opacity-60">
                <p className="text-xs font-extrabold text-slate-400">第3章：未解放</p>
                <p className="text-sm font-extrabold text-slate-500">一次方程式</p>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Selected Unit Action Card */}
        <div className="flex flex-col justify-between space-y-6">
          
          {/* Mascot cheer box */}
          <div className="bg-pastel-yellow border-3 border-pastel-yellow-border rounded-3xl p-5 bubbly-shadow flex items-start gap-4">
            <div className="w-16 h-16 flex-shrink-0 animate-bounce-gentle">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path
                  d="M50,15 C28,30 25,65 30,80 C34,92 66,92 70,80 C75,65 72,30 50,15 Z"
                  fill="#F7FEE7"
                  stroke="#A3E635"
                  strokeWidth="4"
                />
                <path
                  d="M50,15 Q40,2 43,0 Q47,5 50,15 Z"
                  fill="#4ADE80"
                  stroke="#22C55E"
                  strokeWidth="2.5"
                />
                <path
                  d="M50,15 Q60,2 57,0 Q53,5 50,15 Z"
                  fill="#4ADE80"
                  stroke="#22C55E"
                  strokeWidth="2.5"
                />
                {/* Binoculars on face */}
                <rect x="34" y="50" width="14" height="12" rx="4" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
                <rect x="52" y="50" width="14" height="12" rx="4" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
                <line x1="48" y1="56" x2="52" y2="56" stroke="#0369a1" strokeWidth="3" />
                {/* Cheeks */}
                <circle cx="34" cy="68" r="4" fill="#FBCFE8" />
                <circle cx="66" cy="68" r="4" fill="#FBCFE8" />
                {/* Smiley Mouth */}
                <path
                  d="M48,68 Q50,71 52,68"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            
            <div className="text-xs font-bold text-slate-600 leading-relaxed">
              「冒険用の双眼鏡でのぞいているよ！クリアすると、新しいバッジやたくさんのXPがもらえるんだ！」
            </div>
          </div>

          {/* Unit Detailed Action Card */}
          <div className="flex-1 bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{activeUnitInfo.badge}</span>
                <span className={`text-2xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                  activeUnitInfo.status === "completed"
                    ? "bg-sky-50 border-sky-200 text-sky-500"
                    : activeUnitInfo.status === "active"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse"
                    : "bg-slate-100 border-slate-200 text-slate-400"
                }`}>
                  {activeUnitInfo.status === "completed"
                    ? "クリア済み！"
                    : activeUnitInfo.status === "active"
                    ? "ちょうせん中！"
                    : "ロックされているよ"}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-2xs font-extrabold text-slate-400">第 {activeUnitInfo.id} 章</p>
                <h3 className="text-lg font-extrabold text-slate-800">
                  {activeUnitInfo.name}
                </h3>
                <p className="text-xs font-bold text-slate-500 leading-relaxed">
                  {activeUnitInfo.description}
                </p>
              </div>

              {/* Lesson plan list */}
              <div className="border-t border-slate-100 pt-3.5 space-y-2">
                <p className="text-2xs font-extrabold text-slate-400">レッスン内容</p>
                <div className="bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📝</span>
                    <div>
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
                        基本計算とルール
                      </p>
                      <p className="text-3xs text-slate-400 font-bold">1レッスン（10問）</p>
                    </div>
                  </div>
                  <span className="text-2xs font-extrabold text-slate-400">
                    {activeUnitInfo.status === "completed" ? "完了" : "未完了"}
                  </span>
                </div>
              </div>
            </div>

            {/* Launch Exercise CTA Button */}
            <div className="mt-6">
              {activeUnitInfo.status === "locked" ? (
                <div className="w-full py-4.5 bg-slate-100 border-3 border-slate-200 text-slate-400 font-extrabold rounded-2xl text-sm text-center select-none cursor-not-allowed">
                  🔒 前の章をクリアしてね！
                </div>
              ) : (
                <button
                  onClick={() => router.push(`/lesson/${activeUnitInfo.lessonId}`)}
                  className={`w-full py-4.5 font-extrabold rounded-2xl text-sm transition-all bubbly-shadow cursor-pointer text-center select-none ${
                    activeUnitInfo.status === "completed"
                      ? "bg-pastel-blue border-3 border-pastel-blue-border text-pastel-blue-dark hover:bg-sky-100/50"
                      : "bg-pastel-green border-3 border-pastel-green-border text-pastel-green-dark hover:bg-emerald-100/50"
                  }`}
                >
                  {activeUnitInfo.status === "completed" ? "もう一度べんきょうする！ 🔄" : "レッスンをはじめる！ 🚀"}
                </button>
              )}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
