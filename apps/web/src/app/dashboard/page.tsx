"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CongratsOverlay } from "./components/CongratsOverlay";
import { ClosetModal } from "./components/ClosetModal";
import { RakkyoMascot } from "./components/RakkyoMascot";

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

interface ParentMessage {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
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

const ALL_BADGES = [
  { name: "冒険のはじまり", emoji: "🎉", desc: "最初の第一歩を踏み出した証" },
  { name: "数学マスターの卵", emoji: "📐", desc: "問題を5問正解した証" },
  { name: "あきらめない心", emoji: "🔥", desc: "3日連続で勉強を続けた証" },
  { name: "Gritの達人", emoji: "🔥", desc: "Gritスコア90%以上（5問以上解答）" },
  { name: "無限の探求者", emoji: "⌛", desc: "総学習時間 10時間以上" },
  { name: "ストリークの鬼", emoji: "⚡", desc: "7日連続で勉強を続けた証" },
  { name: "完璧主義者", emoji: "🌟", desc: "10問連続で正解した証" },
];

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mascotMessage, setMascotMessage] = useState("");
  const [mascotEmotion, setMascotEmotion] = useState<'normal' | 'correct' | 'incorrect' | 'happy'>('normal');
  const [reviews, setReviews] = useState<any[]>([]);
  const [parentMessages, setParentMessages] = useState<ParentMessage[]>([]);
  const [latestUnreadMessage, setLatestUnreadMessage] = useState<ParentMessage | null>(null);
  
  // Phase 10 Gamification States
  const [quests, setQuests] = useState<QuestProgress[]>([]);
  const [currentOutfit, setCurrentOutfit] = useState("none");
  const [isClosetOpen, setIsClosetOpen] = useState(false);
  const [isCongratsOpen, setIsCongratsOpen] = useState(false);
  const [congratsData, setCongratsData] = useState<{
    type: 'levelUp' | 'streak' | 'quest' | 'badge';
    title?: string;
    subtitle?: string;
    bonusXp?: number;
    badgeName?: string;
    streakCount?: number;
    level?: number;
  } | null>(null);

  const fetchParentMessages = async (token: string) => {
    try {
      const response = await fetch("http://localhost:4000/api/parent/message", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        const msgs = data.messages || [];
        setParentMessages(msgs);
        const unread = msgs.find((m: any) => !m.isRead);
        setLatestUnreadMessage(unread || null);
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch parent messages. Trying localStorage mock...");
      const localMsgs = localStorage.getItem("rakkyo_parent_msgs");
      if (localMsgs) {
        const msgs = JSON.parse(localMsgs);
        setParentMessages(msgs);
        const unread = msgs.find((m: any) => !m.isRead);
        setLatestUnreadMessage(unread || null);
      }
    }
  };

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

  const fetchQuests = async (token: string) => {
    try {
      const response = await fetch("http://localhost:4000/api/lessons/quests", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setQuests(data);
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch quests from API. Loading default local fallback...");
      // Local simulated quest fallback
      setQuests([
        {
          id: "adventure",
          name: "本日の大冒険 🧮",
          description: "算数の問題を3問解こう！",
          current: 0,
          target: 3,
          isCompleted: false,
          bonusXp: 50,
        },
        {
          id: "grit",
          name: "粘り強さの達人 🧅",
          description: "ヒントを1回以上使って正解しよう！",
          current: 0,
          target: 1,
          isCompleted: false,
          bonusXp: 50,
        },
        {
          id: "intuition",
          name: "直感マスター ⚡",
          description: "ヒントを使わずに正解しよう！",
          current: 0,
          target: 1,
          isCompleted: false,
          bonusXp: 50,
        }
      ]);
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
      const parsedUser: UserProfile = JSON.parse(userStr);
      setUser(parsedUser);
      
      // Load current equipped outfit
      const outfit = localStorage.getItem("rakkyo_outfit") || "none";
      setCurrentOutfit(outfit);

      fetchReviews(token, parsedUser.id);
      fetchParentMessages(token);
      fetchQuests(token);

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
    localStorage.removeItem("rakkyo_outfit");
    router.push("/");
  };

  const handleReadMessage = async (msgId: string) => {
    const token = localStorage.getItem("rakkyo_token");
    setMascotEmotion('happy');
    
    try {
      if (token) {
        const response = await fetch(`http://localhost:4000/api/parent/message/${msgId}/read`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (response.ok) {
          setLatestUnreadMessage(null);
          setParentMessages(prev => prev.map(m => m.id === msgId ? { ...m, isRead: true } : m));
        }
      } else {
        const localMsgs = localStorage.getItem("rakkyo_parent_msgs");
        if (localMsgs) {
          const msgs = JSON.parse(localMsgs);
          const updated = msgs.map((m: any) => m.id === msgId ? { ...m, isRead: true } : m);
          localStorage.setItem("rakkyo_parent_msgs", JSON.stringify(updated));
          setParentMessages(updated);
        }
        setLatestUnreadMessage(null);
      }
    } catch (e) {
      console.error("Failed to read message", e);
    }
    
    // Trigger celebration modal for getting parent's lovely message
    setCongratsData({
      type: 'badge',
      title: '保護者からのエール！',
      subtitle: 'おうちの人ががんばりを見守ってメッセージを送ってくれたよ！',
      bonusXp: 0
    });
    setIsCongratsOpen(true);
    
    setTimeout(() => {
      setMascotEmotion('normal');
    }, 4000);
  };

  const handleSelectOutfit = (outfitId: string) => {
    localStorage.setItem("rakkyo_outfit", outfitId);
    setCurrentOutfit(outfitId);
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
    : ["🎉 冒険のはじまり"];

  // Helper to extract clean badge names (handling emojis if they are embedded like '🎉 冒険のはじまり')
  const cleanUserBadgeNames = userBadges.map(b => {
    const parts = b.split(" ");
    return parts.length > 1 ? parts.slice(1).join(" ") : b;
  });

  return (
    <div className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* 1. Header Row (Bubbly Navigation) */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-white border-3 border-slate-100 rounded-3xl p-4 sm:px-6 bubbly-shadow">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-pastel-blue rounded-2xl flex items-center justify-center font-extrabold text-pastel-blue-dark border-2 border-pastel-blue-border text-lg bubbly-shadow">
            🧅
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
            <div className="h-10 px-4 bg-gradient-to-r from-amber-500 to-orange-500 border-2 border-amber-300 rounded-2xl flex items-center justify-center font-extrabold text-white text-sm bubbly-shadow gap-1.5 animate-pulse">
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
      <section className={`bg-white border-3 rounded-3xl p-6 bubbly-shadow flex flex-col md:flex-row items-center gap-6 transition-all duration-300 ${latestUnreadMessage ? "border-pastel-pink-border" : "border-slate-100"}`}>
        
        {/* Animated Mascot Layer with Outfit rendering */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-28 h-28 animate-bounce-gentle select-none relative cursor-pointer" onClick={() => setIsClosetOpen(true)}>
            {latestUnreadMessage && (
              <span className="absolute -top-2 -right-2 text-2xl animate-bounce">✉️</span>
            )}
            <RakkyoMascot emotion={mascotEmotion} outfit={currentOutfit} className="w-full h-full" />
          </div>
          
          {/* Closet Button */}
          <button
            onClick={() => setIsClosetOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-indigo-700 text-white font-extrabold rounded-2xl text-2xs flex items-center gap-1.5 active:translate-y-[1px] transition-all bubbly-shadow cursor-pointer"
          >
            <span>👕 きせかえ</span>
          </button>
        </div>

        {/* Talk Bubble */}
        <div className="flex-1 space-y-4 w-full">
          {latestUnreadMessage ? (
            <div className="bg-pastel-pink border-2 border-pastel-pink-border rounded-3xl p-5 relative shadow-sm animate-fade-in w-full">
              <div className="absolute left-[50%] md:left-[-8px] top-[-8px] md:top-[50%] transform -translate-x-[50%] md:translate-x-0 md:-translate-y-[50%] w-0 h-0 border-b-8 border-b-pastel-pink-border md:border-b-transparent border-l-8 border-l-transparent md:border-r-8 md:border-r-pastel-pink-border border-r-8 border-r-transparent md:border-l-transparent" />
              
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">🧅</span>
                <span className="text-xs font-black text-pastel-pink-dark uppercase tracking-wider">
                  おうちのひとから ぽかぽかメッセージが とどいているよ！
                </span>
              </div>
              
              <p className="text-sm sm:text-base font-extrabold text-slate-800 tracking-wide leading-relaxed bg-white/70 border border-pastel-pink-border/40 p-4 rounded-2xl">
                「 {latestUnreadMessage.message} 」
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleReadMessage(latestUnreadMessage.id)}
                  className="px-6 py-2.5 bg-pastel-pink-dark hover:bg-rose-600 border-2 border-rose-700 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer animate-bounce"
                >
                  <span>よんだよ！ 👍</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-pastel-blue border-2 border-pastel-blue-border rounded-2xl p-4 relative">
              <div className="absolute left-[50%] md:left-[-8px] top-[-8px] md:top-[50%] transform -translate-x-[50%] md:translate-x-0 md:-translate-y-[50%] w-0 h-0 border-b-8 border-b-pastel-blue-border md:border-b-transparent border-l-8 border-l-transparent md:border-r-8 md:border-r-pastel-blue-border border-r-8 border-r-transparent md:border-l-transparent" />
              <p className="text-sm sm:text-base font-bold text-slate-700 tracking-wide leading-relaxed">
                {mascotMessage}
              </p>
            </div>
          )}

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

                  {/* Progress Gauge */}
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
            
            {/* Shelf Grid */}
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

      {/* Gamification Interactive Modals */}
      <ClosetModal
        isOpen={isClosetOpen}
        onClose={() => setIsClosetOpen(false)}
        userLevel={user.level}
        currentOutfit={currentOutfit}
        onSelectOutfit={handleSelectOutfit}
      />

      <CongratsOverlay
        isOpen={isCongratsOpen}
        onClose={() => setIsCongratsOpen(false)}
        type={congratsData?.type || 'quest'}
        title={congratsData?.title}
        subtitle={congratsData?.subtitle}
        bonusXp={congratsData?.bonusXp}
        badgeName={congratsData?.badgeName}
        streakCount={congratsData?.streakCount}
        level={congratsData?.level}
      />
    </div>
  );
}
