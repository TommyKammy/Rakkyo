"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  schoolYear: number;
  currentXp: number;
  level: number;
  streakCount: number;
  badges?: string[];
  isMock?: boolean;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mascotMessage, setMascotMessage] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);

  const fetchReviews = async (token: string, userId: string) => {
    try {
      const response = await fetch("http://localhost:4000/api/lessons/reviews", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setReviews(data.questions || []);
        return;
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch reviews from API. Falling back to local attempt logic.");
    }

    // Local fallback review questions
    setReviews([
      {
        id: "attempt_seed_8",
        prompt: "$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。",
        type: "NUMBER_INPUT",
        unitName: "文字の式",
        lessonName: "文字を使った式",
      }
    ]);
  };

  useEffect(() => {
    const token = localStorage.getItem("rakkyo_token");
    const userStr = localStorage.getItem("rakkyo_user");

    if (!token || !userStr) {
      router.push("/");
      return;
    }

    try {
      const parsedUser: UserProfile = JSON.parse(userStr);
      setUser(parsedUser);
      
      fetchReviews(token, parsedUser.id);

      // Mascot dynamic messages based on current states
      const messages = [
        `ようこそ、${parsedUser.nickname}ちゃん！今日もいっしょに算数を大冒険しよう！`,
        `🔥 ${parsedUser.streakCount}日連続で勉強できてるよ！すごすぎる！`,
        `あと少しのXPでレベルアップできそうだよ！がんばろう！`,
        `今日は「方程式」のレッスンがおすすめだよ！天秤のパズルを解いてみよう！`,
      ];
      setMascotMessage(messages[0]);
    } catch (e) {
      localStorage.removeItem("rakkyo_token");
      localStorage.removeItem("rakkyo_user");
      router.push("/");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("rakkyo_token");
    localStorage.removeItem("rakkyo_user");
    router.push("/");
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-pastel-blue-border border-t-pastel-blue-dark mx-auto mb-4" />
          <p className="text-slate-400 font-bold text-sm">ぼうけんの準備中...</p>
        </div>
      </div>
    );
  }

  // XP Target logic: Level 1 = 100XP, Level 2 = 200XP, etc.
  const xpNeeded = user.level * 100;
  const xpPercentage = Math.min(100, Math.floor((user.currentXp / xpNeeded) * 100));

  // Default badges list if none is set
  const userBadges = user.badges && user.badges.length > 0
    ? user.badges
    : ["🎉 冒険のはじまり", "🐣 算数ひよこ"];

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* 1. Header Row (Bubbly Navigation) */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-white border-3 border-slate-100 rounded-3xl p-4 sm:px-6 bubbly-shadow">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pastel-blue rounded-2xl flex items-center justify-center font-extrabold text-pastel-blue-dark border-2 border-pastel-blue-border text-lg bubbly-shadow">
            📐
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
              Rakkyo
            </h2>
            <p className="text-xs text-slate-400 font-bold">
              中学1年生 算数ファンタジー
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Offline/Mock indicator */}
          {user.isMock && (
            <span className="hidden sm:inline-block text-2xs bg-pastel-yellow border border-pastel-yellow-border text-pastel-yellow-dark px-2 py-0.5 rounded-full font-bold">
              体験版（オフライン）
            </span>
          )}

          <div className="flex items-center gap-2">
            {/* Level Icon */}
            <div className="h-10 px-4 bg-pastel-purple border-2 border-pastel-purple-border rounded-2xl flex items-center justify-center font-extrabold text-pastel-purple-dark text-sm bubbly-shadow">
              Lv. {user.level}
            </div>

            {/* Streak Counter */}
            <div className="h-10 px-4 bg-pastel-orange border-2 border-pastel-orange-border rounded-2xl flex items-center justify-center font-extrabold text-pastel-orange-dark text-sm bubbly-shadow gap-1">
              🔥 {user.streakCount}日連続
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* 2. Welcome Mascot Bubble Section */}
      <section className="bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow flex flex-col md:flex-row items-center gap-6">
        
        {/* Animated Mascot */}
        <div className="w-28 h-28 flex-shrink-0 animate-bounce-gentle select-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Scallion Body */}
            <path
              d="M50,15 C28,30 25,65 30,80 C34,92 66,92 70,80 C75,65 72,30 50,15 Z"
              fill="#F7FEE7"
              stroke="#A3E635"
              strokeWidth="4"
            />
            {/* Top Sprouts */}
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
            {/* Cute mini adventurer hat */}
            <path
              d="M32,32 Q50,22 68,32 L64,28 Q50,18 36,28 Z"
              fill="#F43F5E"
              stroke="#BE123C"
              strokeWidth="2"
            />
            {/* Rosy Cheeks */}
            <circle cx="38" cy="66" r="6" fill="#FBCFE8" />
            <circle cx="62" cy="66" r="6" fill="#FBCFE8" />
            {/* Happy Eyes */}
            <path d="M35,58 Q40,54 45,58" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
            <path d="M55,58 Q60,54 65,58" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
            {/* Smiling Mouth */}
            <path
              d="M47,68 Q50,73 53,68"
              fill="none"
              stroke="#1E293B"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Talk Bubble */}
        <div className="flex-1 space-y-4">
          <div className="bg-pastel-blue border-2 border-pastel-blue-border rounded-2xl p-4 relative">
            <div className="absolute left-[50%] md:left-[-8px] top-[-8px] md:top-[50%] transform -translate-x-[50%] md:translate-x-0 md:-translate-y-[50%] w-0 h-0 border-b-8 border-b-pastel-blue-border md:border-b-transparent border-l-8 border-l-transparent md:border-r-8 md:border-r-pastel-blue-border border-r-8 border-r-transparent md:border-l-transparent" />
            <p className="text-sm sm:text-base font-bold text-slate-700 tracking-wide leading-relaxed">
              {mascotMessage}
            </p>
          </div>

          {/* XP Progress Bar */}
          <div className="space-y-1.5 px-1">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-500">
              <span>レベルアップまで</span>
              <span>{user.currentXp} / {xpNeeded} XP ({xpPercentage}%)</span>
            </div>
            <div className="h-6 w-full bg-slate-100 border-2 border-slate-200 rounded-full overflow-hidden p-0.5">
              <div
                style={{ width: `${xpPercentage}%` }}
                className="h-full bg-gradient-to-r from-pastel-purple-dark to-pastel-pink-dark rounded-full transition-all duration-500 ease-out relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Dashboard Content Grid */}
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
                {/* Background SVG grid */}
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

              {/* English (COMING SOON) */}
              <div className="bg-slate-50 border-3 border-slate-200/60 rounded-3xl p-5 flex flex-col justify-between h-48 select-none relative overflow-hidden opacity-75">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-7xl font-bold">
                  🇬🇧
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-slate-200 text-slate-400 border border-slate-300 px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      中1英語 🔒
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-400">
                    アルファベットと言葉
                  </h4>
                  <p className="text-xs text-slate-300 font-semibold mt-1">
                    文法や会話のスペルパズル。準備中なのでお楽しみに！
                  </p>
                </div>
                <div className="w-full py-3 bg-slate-200 border-2 border-slate-300 text-slate-400 font-extrabold rounded-2xl text-sm text-center select-none cursor-not-allowed">
                  Coming Soon...
                </div>
              </div>

              {/* Science (COMING SOON) */}
              <div className="bg-slate-50 border-3 border-slate-200/60 rounded-3xl p-5 flex flex-col justify-between h-48 select-none relative overflow-hidden opacity-75">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-7xl font-bold">
                  🧪
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-slate-200 text-slate-400 border border-slate-300 px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      中1理科 🔒
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-400">
                    身のまわりの不思議
                  </h4>
                  <p className="text-xs text-slate-300 font-semibold mt-1">
                    光や音、物質のなぞを科学の力で解き明かそう！
                  </p>
                </div>
                <div className="w-full py-3 bg-slate-200 border-2 border-slate-300 text-slate-400 font-extrabold rounded-2xl text-sm text-center select-none cursor-not-allowed">
                  Coming Soon...
                </div>
              </div>

              {/* Japanese/Social Studies Combined (COMING SOON) */}
              <div className="bg-slate-50 border-3 border-slate-200/60 rounded-3xl p-5 flex flex-col justify-between h-48 select-none relative overflow-hidden opacity-75">
                <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-7xl font-bold">
                  🎌
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs bg-slate-200 text-slate-400 border border-slate-300 px-2.5 py-0.5 rounded-full font-extrabold tracking-wider">
                      国語・社会 🔒
                    </span>
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-400">
                    ことばと言葉の歴史
                  </h4>
                  <p className="text-xs text-slate-300 font-semibold mt-1">
                    感じ方や歴史探検。次のアップデートまで待っててね！
                  </p>
                </div>
                <div className="w-full py-3 bg-slate-200 border-2 border-slate-300 text-slate-400 font-extrabold rounded-2xl text-sm text-center select-none cursor-not-allowed">
                  Coming Soon...
                </div>
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
                      まちがえた問題や、ヒントをたくさん使った問題だよ！完璧にマスターしよう！
                    </p>
                  </div>
                </div>
                
                <div className="text-3xs bg-pastel-yellow border border-pastel-yellow-border text-pastel-yellow-dark px-2.5 py-1 rounded-full font-extrabold self-start flex items-center gap-1">
                  <span>💎 報酬:</span>
                  <span>クリア時に +15 XP ボーナス！</span>
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

          {/* Daily Mission Card */}
          <div className="bg-pastel-yellow border-3 border-pastel-yellow-border rounded-3xl p-6 bubbly-shadow space-y-4">
            <h3 className="text-md font-extrabold text-pastel-yellow-dark tracking-tight flex items-center gap-1.5">
              🎯 今日のミッション
            </h3>
            
            <div className="bg-white border-2 border-pastel-yellow-border rounded-2xl p-4 flex gap-3 items-start relative overflow-hidden">
              <div className="text-2xl mt-0.5">🌟</div>
              <div>
                <h5 className="font-extrabold text-sm text-slate-800 leading-tight">
                  中1数学：一次方程式
                </h5>
                <p className="text-2xs text-slate-400 font-semibold mt-0.5">
                  解き方と天秤のルール
                </p>
                <p className="text-xs font-bold text-slate-600 mt-2">
                  方程式のレッスンを1つクリアしよう！
                </p>
                <div className="mt-2.5 text-3xs bg-pastel-pink border border-pastel-pink-border text-pastel-pink-dark px-2 py-0.5 rounded-full font-extrabold inline-block">
                  報酬: +20 XP
                </div>
              </div>
            </div>
          </div>

          {/* Badges Panel */}
          <div className="bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow space-y-4">
            <h3 className="text-md font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              🏆 あつめたバッジ ({userBadges.length})
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {userBadges.map((badgeName, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border-2 border-slate-100 p-2.5 rounded-2xl flex flex-col items-center justify-center text-center bubbly-shadow hover:scale-105 transition-transform"
                >
                  <div className="text-2xl mb-1.5 select-none">
                    {badgeName.split(" ")[0]}
                  </div>
                  <span className="text-3xs font-extrabold text-slate-600 tracking-wide truncate w-full">
                    {badgeName.split(" ").slice(1).join(" ")}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
