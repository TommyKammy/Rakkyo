"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

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

interface SubjectMeta {
  title: string;
  icon: string;
  subtitle: string;
  themeColor: {
    bg: string;
    border: string;
    text: string;
    blurBg: string;
  };
  units: {
    id: number;
    name: string;
    description: string;
    lessonId: number;
    badge: string;
    colorTheme: {
      bg: string;
      border: string;
      text: string;
      nodeBg: string;
      nodeText: string;
    };
  }[];
}

const subjectsMetadata: Record<string, SubjectMeta> = {
  math: {
    title: "数学",
    icon: "📐",
    subtitle: "数と方程式の冒険ロードマップ",
    themeColor: {
      bg: "bg-pastel-green",
      border: "border-pastel-green-border",
      text: "text-pastel-green-dark",
      blurBg: "bg-pastel-green"
    },
    units: [
      {
        id: 1,
        name: "正負の数",
        description: "プラスとマイなスの数の世界を冒険しよう！",
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
    ]
  },
  english: {
    title: "英語",
    icon: "🇬🇧",
    subtitle: "アルファベットと言葉の冒険ロードマップ",
    themeColor: {
      bg: "bg-pastel-purple",
      border: "border-pastel-purple-border",
      text: "text-pastel-purple-dark",
      blurBg: "bg-pastel-purple"
    },
    units: [
      {
        id: 1,
        name: "アルファベットと挨拶",
        description: "英語の基本の文字と、はじめての挨拶のパズルを解こう！",
        lessonId: 4,
        badge: "📝",
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
        name: "be動詞のきまり",
        description: "am, is, are の使い方をマスターして、自己紹介をしよう！",
        lessonId: 5,
        badge: "🎒",
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
        name: "一般動詞と基本の文",
        description: "playやlikeなど、いろいろな動きを表す言葉を並べてみよう！",
        lessonId: 6,
        badge: "🌟",
        colorTheme: {
          bg: "bg-pastel-pink",
          border: "border-pastel-pink-border",
          text: "text-pastel-pink-dark",
          nodeBg: "bg-pink-400",
          nodeText: "text-white",
        },
      },
    ]
  },
  science: {
    title: "理科",
    icon: "🧪",
    subtitle: "身のまわりの不思議のなぞ解きロードマップ",
    themeColor: {
      bg: "bg-pastel-blue",
      border: "border-pastel-blue-border",
      text: "text-pastel-blue-dark",
      blurBg: "bg-pastel-blue"
    },
    units: [
      {
        id: 1,
        name: "植物のからだとくらし",
        description: "はっぱ、おはな、ねっこの不思議なつくりを観察しよう！",
        lessonId: 7,
        badge: "🌸",
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
        name: "光と音のせいしつ",
        description: "かがみの反射、虹のひみつ、そして音がつたわる謎に迫る！",
        lessonId: 8,
        badge: "🌈",
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
        name: "物質のすがたと状態変化",
        description: "水がこおりや湯気に変わる、物質の七変化を実験しよう！",
        lessonId: 9,
        badge: "🔥",
        colorTheme: {
          bg: "bg-pastel-pink",
          border: "border-pastel-pink-border",
          text: "text-pastel-pink-dark",
          nodeBg: "bg-pink-400",
          nodeText: "text-white",
        },
      },
    ]
  },
  social: {
    title: "社会",
    icon: "🧭",
    subtitle: "世界の地理と歴史の探検ロードマップ",
    themeColor: {
      bg: "bg-pastel-orange",
      border: "border-pastel-orange-border",
      text: "text-pastel-orange-dark",
      blurBg: "bg-pastel-orange"
    },
    units: [
      {
        id: 1,
        name: "世界の姿と地域のくらし",
        description: "地球儀をもって、大陸や海洋、世界の人々のユニークなくらしを探検！",
        lessonId: 10,
        badge: "🌍",
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
        name: "古代文明と日本のあけぼの",
        description: "四大文明の誕生から、日本の縄文・弥生時代の謎を解き明かそう！",
        lessonId: 11,
        badge: "🏺",
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
        name: "飛鳥から奈良時代の国づくり",
        description: "飛鳥・奈良時代の新しい国づくりの歴史ドラマを追う！",
        lessonId: 12,
        badge: "🏯",
        colorTheme: {
          bg: "bg-pastel-pink",
          border: "border-pastel-pink-border",
          text: "text-pastel-pink-dark",
          nodeBg: "bg-pink-400",
          nodeText: "text-white",
        },
      },
    ]
  },
  japanese: {
    title: "国語",
    icon: "🎌",
    subtitle: "ことばと文章のなぞ解きロードマップ",
    themeColor: {
      bg: "bg-pastel-pink",
      border: "border-pastel-pink-border",
      text: "text-pastel-pink-dark",
      blurBg: "bg-pastel-pink"
    },
    units: [
      {
        id: 1,
        name: "漢字と語彙の世界",
        description: "漢字の組み立てや、日常のことばの豊かな表現をあつめよう！",
        lessonId: 13,
        badge: "✒️",
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
        name: "言葉のきまり（文法）",
        description: "主語と述語、修飾語などのルールを覚えて、文のパズルを解こう！",
        lessonId: 14,
        badge: "🧩",
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
        name: "短い文章の読み解き",
        description: "だれが、なにを、どうした？文章の中から宝探しをするように読み解こう！",
        lessonId: 15,
        badge: "📖",
        colorTheme: {
          bg: "bg-pastel-pink",
          border: "border-pastel-pink-border",
          text: "text-pastel-pink-dark",
          nodeBg: "bg-pink-400",
          nodeText: "text-white",
        },
      },
    ]
  }
};

export default function DynamicUnitRoadmap() {
  const router = useRouter();
  const params = useParams();
  
  // Resolve active subject URL param (defaults to math)
  const subject = (params.subject as string) || "math";
  const meta = subjectsMetadata[subject] || subjectsMetadata.math;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number>(1);
  const [progress, setProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Dynamic status evaluation based on real-time API progression engine
  const getUnitStatus = (id: number) => {
    if (!progress || !progress.units) {
      // Offline fallback defaults
      if (id === 1) return { status: "completed" as const, rate: 100, grade: "S" };
      if (id === 2) return { status: "active" as const, rate: 40, grade: "A" };
      return { status: "locked" as const, rate: 0, grade: "-" };
    }

    const units = progress.units;
    
    // Attempt to match DB unit names with our static layout
    const targetUnitName = meta.units[id - 1]?.name;
    const dbUnit = units.find((u: any) => u.name.includes(targetUnitName) || targetUnitName?.includes(u.name));
    
    if (id === 1) {
      const rate = dbUnit?.completionRate || 0;
      return {
        status: rate === 100 ? ("completed" as const) : ("active" as const),
        rate,
        grade: dbUnit?.understandingLevel || "-"
      };
    }
    
    if (id === 2) {
      const prevUnitName = meta.units[0]?.name;
      const prevDbUnit = units.find((u: any) => u.name.includes(prevUnitName) || prevUnitName?.includes(u.name));
      const prevCleared = prevDbUnit?.completionRate === 100;
      const rate = dbUnit?.completionRate || 0;
      
      if (rate === 100) return { status: "completed" as const, rate, grade: dbUnit?.understandingLevel || "-" };
      return {
        status: prevCleared ? ("active" as const) : ("locked" as const),
        rate,
        grade: dbUnit?.understandingLevel || "-"
      };
    }
    
    // id === 3
    const prevUnitName = meta.units[1]?.name;
    const prevDbUnit = units.find((u: any) => u.name.includes(prevUnitName) || prevUnitName?.includes(u.name));
    const prevCleared = prevDbUnit?.completionRate === 100;
    const rate = dbUnit?.completionRate || 0;
    
    if (rate === 100) return { status: "completed" as const, rate, grade: dbUnit?.understandingLevel || "-" };
    return {
      status: prevCleared ? ("active" as const) : ("locked" as const),
      rate,
      grade: dbUnit?.understandingLevel || "-"
    };
  };

  const u1Info = getUnitStatus(1);
  const u2Info = getUnitStatus(2);
  const u3Info = getUnitStatus(3);

  const units: UnitInfo[] = meta.units.map((unit) => {
    let status: "completed" | "active" | "locked" = "locked";
    if (unit.id === 1) status = u1Info.status;
    else if (unit.id === 2) status = u2Info.status;
    else if (unit.id === 3) status = u3Info.status;

    return {
      ...unit,
      status,
    };
  });

  const fetchProgress = async (token: string) => {
    try {
      const response = await fetch(`http://localhost:4000/api/lessons/progress?subject=${subject}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProgress(data);
      }
    } catch (e) {
      console.warn(`⚠️ Failed to fetch progress for ${subject} from API. Using local default progress.`, e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("rakkyo_token");
    const userStr = localStorage.getItem("rakkyo_user");

    if (!token || !userStr) {
      router.push("/");
      return;
    }

    try {
      setUser(JSON.parse(userStr));
      fetchProgress(token);
    } catch (e) {
      router.push("/");
    }
  }, [router, subject]);

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
      <div className="absolute top-[10%] left-[-5%] w-[35%] h-[35%] rounded-full bg-pastel-blue opacity-30 blur-3xl -z-10" />
      <div className={`absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] rounded-full ${meta.themeColor.blurBg} opacity-30 blur-3xl -z-10`} />

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
          {meta.icon} 中1{meta.title}の冒険ロードマップ
        </h2>
        <p className="text-xs text-slate-400 font-bold mt-1">
          {meta.subtitle}。単元を順番にクリアしてマスターになろう！
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
                {units[0].status === "completed" && (
                  <span className="absolute bottom-[-10px] right-[-10px] text-lg bg-emerald-100 border border-emerald-300 p-0.5 rounded-full">
                    ✅
                  </span>
                )}
              </button>
              <div className="ml-4 bg-white border-2 border-sky-100 px-4 py-2 rounded-2xl bubbly-shadow-md">
                <p className="text-xs font-extrabold text-sky-500">
                  {units[0].status === "completed" ? "第1章：クリア！" : "第1章：ちょうせん！"}
                </p>
                <p className="text-sm font-extrabold text-slate-700">{units[0].name}</p>
              </div>
            </div>

            {/* Unit 2 Node */}
            <div className="flex items-center w-full max-w-[280px] justify-end self-end -translate-x-6 sm:-translate-x-12">
              <div className="mr-4 bg-white border-2 border-emerald-100 px-4 py-2 rounded-2xl bubbly-shadow-md text-right">
                <p className={`text-xs font-extrabold ${units[1].status === "locked" ? "text-slate-400" : "text-emerald-500 animate-pulse"}`}>
                  {units[1].status === "completed" ? "第2章：クリア！" : units[1].status === "active" ? "挑戦中！" : "第2章：ロック中"}
                </p>
                <p className="text-sm font-extrabold text-slate-700">{units[1].name}</p>
              </div>
              <button
                onClick={() => setSelectedUnit(2)}
                disabled={units[1].status === "locked"}
                className={`w-16 h-16 rounded-full flex items-center justify-center border-4 bubbly-shadow-md transition-transform duration-300 ${
                  units[1].status === "locked" ? "cursor-not-allowed" : "cursor-pointer hover:scale-110"
                } active:translate-y-[2px] ${
                  selectedUnit === 2
                    ? "border-emerald-600 scale-105 animate-pulse"
                    : "border-emerald-200"
                } ${units[1].status === "locked" ? "bg-slate-300 text-slate-400" : "bg-emerald-500 text-white"} font-extrabold text-xl relative`}
              >
                2
                {units[1].status === "completed" && (
                  <span className="absolute bottom-[-10px] right-[-10px] text-lg bg-emerald-100 border border-emerald-300 p-0.5 rounded-full">
                    ✅
                  </span>
                )}
                {units[1].status === "active" && (
                  <span className="absolute top-[-8px] right-[-8px] text-md animate-bounce-gentle">
                    🧭
                  </span>
                )}
                {units[1].status === "locked" && (
                  <span className="absolute bottom-[-10px] right-[-10px] text-md">
                    🔒
                  </span>
                )}
              </button>
            </div>

            {/* Unit 3 Node */}
            <div className="flex items-center w-full max-w-[280px] justify-start self-start translate-x-10 sm:translate-x-20">
              <button
                onClick={() => setSelectedUnit(3)}
                disabled={units[2].status === "locked"}
                className={`w-16 h-16 rounded-full flex items-center justify-center border-4 bubbly-shadow-md transition-transform duration-300 ${
                  units[2].status === "locked" ? "cursor-not-allowed" : "cursor-pointer hover:scale-110"
                } active:translate-y-[2px] ${
                  selectedUnit === 3
                    ? "border-pink-500 scale-105"
                    : "border-slate-200"
                } ${units[2].status === "locked" ? "bg-slate-300 text-slate-400" : "bg-pink-400 text-white"} font-extrabold text-xl relative`}
              >
                3
                {units[2].status === "completed" && (
                  <span className="absolute bottom-[-10px] right-[-10px] text-lg bg-emerald-100 border border-emerald-300 p-0.5 rounded-full">
                    ✅
                  </span>
                )}
                {units[2].status === "active" && (
                  <span className="absolute top-[-8px] right-[-8px] text-md animate-bounce-gentle">
                    🧭
                  </span>
                )}
                {units[2].status === "locked" && (
                  <span className="absolute bottom-[-10px] right-[-10px] text-md">
                    🔒
                  </span>
                )}
              </button>
              <div className="ml-4 bg-white border-2 border-slate-100 px-4 py-2 rounded-2xl bubbly-shadow-md opacity-60">
                <p className="text-xs font-extrabold text-slate-400">
                  {units[2].status === "completed" ? "第3章：クリア！" : units[2].status === "active" ? "挑戦中！" : "第3章：ロック中"}
                </p>
                <p className="text-sm font-extrabold text-slate-500">{units[2].name}</p>
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
              「{meta.title}の冒険ロードマップだよ！クリアすると、新しいバッジやたくさんのXPがもらえるんだ！」
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
                      ? `${meta.themeColor.bg} border-3 ${meta.themeColor.border} ${meta.themeColor.text} hover:opacity-90`
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
