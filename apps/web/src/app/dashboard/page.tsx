"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CongratsOverlay } from "./components/CongratsOverlay";
import { ClosetModal } from "./components/ClosetModal";
import { RakkyoMascot } from "./components/RakkyoMascot";
import { useRakkyoVoice } from "../../hooks/useRakkyoVoice";

// Helper to map dynamic/mock lesson IDs into numericカリキュラムIDs for seamless navigation
const getNumericLessonId = (recommendation: { recommendedLessonId: string; recommendedLessonName: string }): number => {
  const idStr = recommendation.recommendedLessonId;
  const nameStr = recommendation.recommendedLessonName || "";
  
  // Try parsing direct integer
  const directInt = parseInt(idStr);
  if (!isNaN(directInt) && directInt >= 1 && directInt <= 15) {
    return directInt;
  }
  
  // Extract number from format like "lesson-1"
  const match = idStr.match(/lesson[-_](\d+)/i);
  if (match) {
    const matchedInt = parseInt(match[1]);
    if (matchedInt >= 1 && matchedInt <= 15) {
      return matchedInt;
    }
  }

  // Fallback map based on name or ID keywords
  const text = (idStr + " " + nameStr).toLowerCase();
  if (text.includes("正負") || text.includes("数")) return 1;
  if (text.includes("文字") || text.includes("式")) return 2;
  if (text.includes("方程式") || text.includes("等式")) return 3;
  if (text.includes("アルファベット") || text.includes("alphabet")) return 4;
  if (text.includes("単語") || text.includes("word") || text.includes("be動詞")) return 5;
  if (text.includes("一般動詞") || text.includes("verb")) return 6;
  if (text.includes("植物") || text.includes("理科") || text.includes("光")) return 7;
  if (text.includes("物質") || text.includes("音")) return 8;
  if (text.includes("力") || text.includes("電気")) return 9;
  if (text.includes("世界") || text.includes("地理")) return 10;
  if (text.includes("歴史") || text.includes("歴史の流れ")) return 11;
  if (text.includes("くらし") || text.includes("社会")) return 12;
  if (text.includes("ことば") || text.includes("国語") || text.includes("漢字")) return 13;
  if (text.includes("きまり") || text.includes("文法")) return 14;
  if (text.includes("読解") || text.includes("文章")) return 15;

  return 1; // absolute fallback
};

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

  // Phase 11 Personalization States
  interface RecommendationResult {
    recommendedLessonId: string;
    recommendedLessonName: string;
    reason: string;
    isMock: boolean;
  }

  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [isLoadingRecommend, setIsLoadingRecommend] = useState(false);
  const { speak, stop } = useRakkyoVoice();

  // Phase 12 Collaboration States
  const [activeTab, setActiveTab] = useState<'adventure' | 'room' | 'hirameki'>('adventure');
  
  // Room state
  const [roomData, setRoomData] = useState<{
    classId: string;
    roomName: string;
    activeMembers: Array<{
      id: string;
      nickname: string;
      avatar: string;
      status: string;
      bubbleMessage: string;
      isOnline: boolean;
    }>;
  } | null>(null);
  const [receivedStamps, setReceivedStamps] = useState<any[]>([]);
  const [sentStamps, setSentStamps] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [isLoadingRoom, setIsLoadingRoom] = useState(false);
  const [selectedFriendForStamp, setSelectedFriendForStamp] = useState<string | null>(null);
  
  // Hirameki state
  const [hiramekiTips, setHiramekiTips] = useState<any[]>([]);
  const [newHiramekiContent, setNewHiramekiContent] = useState("");
  const [isPostingHirameki, setIsPostingHirameki] = useState(false);
  const [isLoadingHirameki, setIsLoadingHirameki] = useState(false);

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
        if (unread) {
          const speakText = "やっほー！おうちの人から、とっても温かい応援メッセージが届いているよ！いっしょに読んでみよう！🧅";
          setMascotMessage(speakText);
          speak(speakText, 'neutral');
        }
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch parent messages. Trying localStorage mock...");
      const localMsgs = localStorage.getItem("rakkyo_parent_msgs");
      if (localMsgs) {
        const msgs = JSON.parse(localMsgs);
        setParentMessages(msgs);
        const unread = msgs.find((m: any) => !m.isRead);
        setLatestUnreadMessage(unread || null);
        if (unread) {
          const speakText = "やっほー！おうちの人から、とっても温かい応援メッセージが届いているよ！いっしょに読んでみよう！🧅";
          setMascotMessage(speakText);
          speak(speakText, 'neutral');
        }
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

  const fetchRecommendations = async (token: string, nickname: string) => {
    setIsLoadingRecommend(true);
    try {
      const response = await fetch("http://localhost:4000/api/lessons/recommendations", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRecommendation(data);
        if (data.reason) {
          setMascotMessage(data.reason);
          speak(data.reason, 'neutral');
        }
      } else {
        throw new Error("Failed to fetch recommendation");
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch recommendations from API. Using local fallback.");
      const mockRecommend: RecommendationResult = {
        recommendedLessonId: "1",
        recommendedLessonName: "正負の数の計算",
        reason: `やっほー！${nickname}ちゃん、今日は「正負の数の計算」でいっしょに遊ぼう！マイナスの魔法をマスターすると、算数の冒険がもっと楽しくなるよ！🧅`,
        isMock: true
      };
      setRecommendation(mockRecommend);
      setMascotMessage(mockRecommend.reason);
      speak(mockRecommend.reason, 'neutral');
    } finally {
      setIsLoadingRecommend(false);
    }
  };

  const fetchRoomData = async (token: string) => {
    setIsLoadingRoom(true);
    try {
      const roomRes = await fetch("http://localhost:4000/api/collaborative/room", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (roomRes.ok) {
        const rData = await roomRes.json();
        setRoomData(rData);
      }
      
      const stampsRes = await fetch("http://localhost:4000/api/collaborative/stamps", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (stampsRes.ok) {
        const sData = await stampsRes.json();
        setReceivedStamps(sData.received || []);
        setSentStamps(sData.sent || []);
      }

      const missionRes = await fetch("http://localhost:4000/api/collaborative/missions", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (missionRes.ok) {
        const mData = await missionRes.json();
        setMissions(mData || []);
      }
    } catch (e) {
      console.warn("⚠️ Room API failed, using mock fallbacks");
      setRoomData({
        classId: "mock-class-id",
        roomName: "ラッキョ・ルーム (中1数学特訓クラス - 体験版)",
        activeMembers: [
          { id: "classmate-1", nickname: "がんばるオニオン", avatar: "🧅", status: "方程式に挑戦中！", bubbleMessage: "今、隣で「等式と不等式」を考えているよ！", isOnline: true },
          { id: "classmate-2", nickname: "あきらめないネギ", avatar: "🥕", status: "じっくり考え中...🤔", bubbleMessage: "今、隣で「植物の体のつくり」をがんばっているよ！", isOnline: true },
          { id: "classmate-3", nickname: "ひらめきニンニク", avatar: "🧄", status: "ヒントをみてひらめいた！✨", bubbleMessage: "今、隣で「文字を使った式」でひらめきを得たよ！", isOnline: false }
        ]
      });
      setMissions([
        { id: "mission-1", classId: "mock-class-id", title: "今週のクラス目標：全員で合計1000分勉強しよう！🔥", currentMinutes: 620, targetMinutes: 1000 }
      ]);
    } finally {
      setIsLoadingRoom(false);
    }
  };

  const fetchHiramekiData = async (token: string) => {
    setIsLoadingHirameki(true);
    try {
      const res = await fetch("http://localhost:4000/api/collaborative/hirameki", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHiramekiTips(data || []);
      }
    } catch (e) {
      console.warn("⚠️ Hirameki API failed, using mock fallback");
      setHiramekiTips([
        { id: "h-1", nickname: "ひらめきラッキョ", content: "マイナスの割り算は、マイナスの数自体が奇数個ならマイナスになるって覚えるとスラスラ解けるよ！💡", createdAt: new Date().toISOString() },
        { id: "h-2", nickname: "がんばるオニオン", content: "等式の性質は、天秤をイメージするとわかりやすい！右と左に同じ重さを乗せても釣り合ったままだよ⚖️", createdAt: new Date().toISOString() }
      ]);
    } finally {
      setIsLoadingHirameki(false);
    }
  };

  const handleSendStamp = async (receiverId: string, stampType: string) => {
    const token = localStorage.getItem("rakkyo_token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:4000/api/collaborative/stamps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ receiverId, stampType })
      });
      if (res.ok) {
        fetchRoomData(token);
        setSelectedFriendForStamp(null);
        
        setCongratsData({
          type: 'badge',
          title: 'スタンプを送ったよ！',
          subtitle: `ともだちに「${stampType}」を届けました！お互いがんばろう！`,
          bonusXp: 0
        });
        setIsCongratsOpen(true);
      }
    } catch (e) {
      console.error("Failed to send stamp", e);
      setSelectedFriendForStamp(null);
      setCongratsData({
        type: 'badge',
        title: 'スタンプを送ったよ！',
        subtitle: `ともだちに「${stampType}」を届けました！(体験版シミュレーション)`,
        bonusXp: 0
      });
      setIsCongratsOpen(true);
    }
  };

  const handlePostHirameki = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHiramekiContent.trim()) return;
    
    const token = localStorage.getItem("rakkyo_token");
    if (!token) return;

    setIsPostingHirameki(true);
    try {
      const res = await fetch("http://localhost:4000/api/collaborative/hirameki", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ content: newHiramekiContent })
      });

      if (res.ok) {
        setNewHiramekiContent("");
        fetchHiramekiData(token);
      } else {
        const errorData = await res.json();
        if (errorData.error === 'abusive_content') {
          const blockMsg = "あれれっ、もう少し優しい言葉を使ってみようかな？みんながポカポカ温かい気持ちになれる言葉で書いてみてね！🧅";
          setMascotMessage(blockMsg);
          setMascotEmotion('incorrect');
          speak(blockMsg, 'neutral');
        } else {
          throw new Error("投稿に失敗しました");
        }
      }
    } catch (e) {
      console.warn("⚠️ Posting offline or simulated abusive check");
      const hasAbusiveWord = newHiramekiContent.includes("ばか") || newHiramekiContent.includes("アホ") || newHiramekiContent.includes("しね") || newHiramekiContent.includes("死ね");
      if (hasAbusiveWord) {
        const blockMsg = "あれれっ、もう少し優しい言葉を使ってみようかな？みんながポカポカ温かい気持ちになれる言葉で書いてみてね！🧅";
        setMascotMessage(blockMsg);
        setMascotEmotion('incorrect');
        speak(blockMsg, 'neutral');
      } else {
        const localTips = [
          { id: "h-offline-" + Date.now(), nickname: "あきらめないネギ", content: newHiramekiContent, createdAt: new Date().toISOString() },
          ...hiramekiTips
        ];
        setHiramekiTips(localTips);
        setNewHiramekiContent("");
      }
    } finally {
      setIsPostingHirameki(false);
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
      
      const outfit = localStorage.getItem("rakkyo_outfit") || "none";
      setCurrentOutfit(outfit);

      fetchReviews(token, parsedUser.id);
      fetchParentMessages(token);
      fetchQuests(token);
      fetchRecommendations(token, parsedUser.nickname);
      
      // Load Collaboration & Hirameki data
      fetchRoomData(token);
      fetchHiramekiData(token);
    } catch (e) {
      localStorage.removeItem("rakkyo_token");
      localStorage.removeItem("rakkyo_user");
      router.push("/");
    }

    return () => {
      stop();
    };
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

  const xpNeeded = user.level * 100;
  const xpPercentage = Math.min(100, Math.floor((user.currentXp / xpNeeded) * 100));

  const userBadges = user.badges && user.badges.length > 0
    ? user.badges
    : ["🎉 冒険のはじまり"];

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
          {user.isMock && (
            <span className="hidden sm:inline-block text-2xs bg-pastel-yellow border border-pastel-yellow-border text-pastel-yellow-dark px-2 py-0.5 rounded-full font-bold">
              体験版（オフライン）
            </span>
          )}

          <div className="flex items-center gap-2">
            <div className="h-10 px-4 bg-pastel-purple border-2 border-pastel-purple-border rounded-2xl flex items-center justify-center font-extrabold text-pastel-purple-dark text-sm bubbly-shadow">
              Lv. {user.level}
            </div>

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
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          <div className="w-28 h-28 animate-bounce-gentle select-none relative cursor-pointer" onClick={() => setIsClosetOpen(true)}>
            {latestUnreadMessage && (
              <span className="absolute -top-2 -right-2 text-2xl animate-bounce">✉️</span>
            )}
            <RakkyoMascot emotion={mascotEmotion} outfit={currentOutfit} className="w-full h-full" />
          </div>
          
          <button
            onClick={() => setIsClosetOpen(true)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-indigo-700 text-white font-extrabold rounded-2xl text-2xs flex items-center gap-1.5 active:translate-y-[1px] transition-all bubbly-shadow cursor-pointer"
          >
            <span>👕 きせかえ</span>
          </button>
        </div>

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

      {/* Dynamic Tab Selectors */}
      <div className="flex border-b-2 border-slate-100 gap-2 pb-1">
        <button
          onClick={() => setActiveTab('adventure')}
          className={`px-5 py-3 rounded-t-2xl font-black text-sm transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'adventure'
              ? 'bg-white border-2 border-b-0 border-slate-100 text-indigo-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>🧭 ひとりで冒険</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('room');
            const token = localStorage.getItem("rakkyo_token");
            if (token) fetchRoomData(token);
          }}
          className={`px-5 py-3 rounded-t-2xl font-black text-sm transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'room'
              ? 'bg-white border-2 border-b-0 border-slate-100 text-indigo-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>🏠 ラッキョ・ルーム</span>
          <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
            みんなの部屋
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('hirameki');
            const token = localStorage.getItem("rakkyo_token");
            if (token) fetchHiramekiData(token);
          }}
          className={`px-5 py-3 rounded-t-2xl font-black text-sm transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'hirameki'
              ? 'bg-white border-2 border-b-0 border-slate-100 text-indigo-600 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span>💡 みんなのひらめき</span>
        </button>
      </div>

      {/* 3. Tab Contents Switch */}
      {activeTab === 'adventure' && (
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
      )}

      {activeTab === 'room' && (
        <div className="space-y-6 animate-fade-in">
          {/* クラス協力型ミッション進捗 (液体揺らぎ) */}
          {missions.map((mission) => {
            const percent = Math.min(100, Math.floor((mission.currentMinutes / mission.targetMinutes) * 100));
            return (
              <div key={mission.id} className="bg-gradient-to-r from-indigo-50/50 to-pastel-blue/30 border-3 border-indigo-200 rounded-3xl p-6 bubbly-shadow relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                  <div>
                    <span className="text-2xs bg-indigo-600/10 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-extrabold tracking-wider">
                      🤝 クラス共習協力ミッション
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-800 mt-2">
                      {mission.title}
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      競争じゃないよ！クラスのみんなのがんばり勉強時間を合計して目標を突破しよう！
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-400 block">現在の達成率</span>
                    <strong className="text-lg font-black text-indigo-600">{percent}%</strong>
                  </div>
                </div>

                {/* 液体のように揺れるリッチなプログレスバー */}
                <div className="relative w-full h-16 bg-slate-100 border-3 border-indigo-200 rounded-3xl overflow-hidden bubbly-shadow">
                  {/* Liquid background fill */}
                  <div 
                    style={{ height: `${percent}%` }}
                    className="absolute bottom-0 left-0 right-0 bg-indigo-500/80 transition-all duration-1000 ease-out overflow-hidden"
                  >
                    {/* Waves inside fill */}
                    <svg className="absolute -top-3 left-0 w-[200%] h-4 fill-indigo-500/90 liquid-wave-slow" viewBox="0 0 1200 120" preserveAspectRatio="none">
                      <path d="M0,60 C150,90 350,30 500,60 C650,90 850,30 1000,60 C1150,90 1350,30 1500,60 L1500,120 L0,120 Z" />
                    </svg>
                    <svg className="absolute -top-2 left-0 w-[200%] h-4 fill-indigo-400/70 liquid-wave-fast" viewBox="0 0 1200 120" preserveAspectRatio="none">
                      <path d="M0,50 C100,20 250,80 400,50 C550,20 700,80 850,50 C1000,20 1150,80 1300,50 L1300,120 L0,120 Z" />
                    </svg>
                  </div>
                  
                  {/* Floating particles inside progress bar */}
                  <div className="absolute inset-0 flex items-center justify-between px-6 z-20 font-black text-xs">
                    <span className="text-slate-700 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-indigo-100 shadow-2xs">
                      現在: {mission.currentMinutes} 分
                    </span>
                    <span className="text-slate-700 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-indigo-100 shadow-2xs">
                      目標: {mission.targetMinutes} 分
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* バーチャル学習室「ラッキョ・ルーム」 */}
          <div className="bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  🏠 {roomData?.roomName || "ラッキョ・ルーム"}
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  クラスメイトをクリックすると、あきらめない姿勢を称える応援スタンプを送れるよ！
                </p>
              </div>
              <button 
                onClick={() => fetchRoomData(localStorage.getItem("rakkyo_token") || "")}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl transition-all cursor-pointer text-xs font-bold"
              >
                🔄 ルームをこうしん
              </button>
            </div>

            {/* アバター浮遊アニメーションエリア */}
            <div className="bg-gradient-to-b from-slate-50 to-slate-100/30 rounded-3xl border-2 border-slate-100 p-6 md:p-8 min-h-[320px] flex flex-wrap items-center justify-center gap-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#6366f1 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }} />

              {roomData?.activeMembers && roomData.activeMembers.length > 0 ? (
                roomData.activeMembers.map((member, idx) => (
                  <div key={member.id} className="relative flex flex-col items-center select-none group">
                    {/* Animated Bubble Message */}
                    <div className="mb-2 bg-white border-2 border-indigo-100 px-3.5 py-2.5 rounded-2xl bubbly-shadow max-w-[200px] text-center relative group-hover:scale-105 transition-transform animate-float-gentle" style={{ animationDelay: `${idx * 0.4}s` }}>
                      <p className="text-2xs text-slate-500 font-bold leading-relaxed">{member.bubbleMessage}</p>
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-indigo-100 transform rotate-45" />
                    </div>

                    {/* Floating Classmate Avatar Wrapper */}
                    <div 
                      onClick={() => setSelectedFriendForStamp(selectedFriendForStamp === member.id ? null : member.id)}
                      className={`w-20 h-20 rounded-full border-3 flex items-center justify-center text-4xl cursor-pointer bubbly-shadow transition-all duration-300 relative ${
                        member.isOnline 
                          ? "bg-emerald-50 border-emerald-300 hover:scale-110 ring-4 ring-emerald-100 animate-float"
                          : "bg-slate-100 border-slate-300 hover:scale-105 grayscale animate-bounce-gentle"
                      }`}
                      style={{ animationDelay: `${idx * 0.6}s` }}
                    >
                      <span>{member.avatar}</span>
                      
                      {member.isOnline && (
                        <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                      )}
                    </div>

                    <span className="mt-2 text-xs font-black text-slate-700">{member.nickname}</span>
                    <span className="text-[10px] font-extrabold text-indigo-500">{member.status}</span>

                    {/* Stamp Selector Popup */}
                    {selectedFriendForStamp === member.id && (
                      <div className="absolute top-[80px] z-30 bg-white border-3 border-indigo-100 rounded-2xl p-3 bubbly-shadow-lg flex flex-col gap-2 w-44 animate-fade-in">
                        <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                          <span className="text-3xs font-black text-slate-400">ピア応援を送る</span>
                          <button onClick={(e) => { e.stopPropagation(); setSelectedFriendForStamp(null); }} className="text-slate-400 hover:text-slate-600 font-bold text-2xs cursor-pointer">❌</button>
                        </div>
                        <button onClick={() => handleSendStamp(member.id, "Grit! 💪")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5">
                          <span>💪</span> Grit! がんばれ！
                        </button>
                        <button onClick={() => handleSendStamp(member.id, "あきらめないね！ 🧅")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5">
                          <span>🧅</span> あきらめないね！
                        </button>
                        <button onClick={() => handleSendStamp(member.id, "ナイスひらめき！ 💡")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5">
                          <span>💡</span> ナイスひらめき！
                        </button>
                        <button onClick={() => handleSendStamp(member.id, "いっしょにがんばろう！ ✨")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5">
                          <span>✨</span> いっしょにやろう！
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <span className="text-4xl">💭</span>
                  <p className="text-xs text-slate-400 font-extrabold mt-2">メンバーはまだいません。</p>
                </div>
              )}
            </div>

            {/* 最近もらった応援スタンプ履歴 */}
            <div className="border-t-2 border-slate-100 pt-6">
              <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-1.5">
                💌 届いたばかりの応援スタンプ ({receivedStamps.length})
              </h4>
              <div className="flex flex-wrap gap-3">
                {receivedStamps.length > 0 ? (
                  receivedStamps.slice(0, 8).map((stamp, idx) => (
                    <div key={stamp.id || idx} className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl px-4 py-2.5 text-xs font-extrabold text-indigo-700 flex items-center gap-2 bubbly-shadow animate-fade-in">
                      <span className="text-base">🎉</span>
                      <span>
                        <strong>{stamp.senderNickname}</strong> から「{stamp.stampType}」スタンプ！
                      </span>
                      <span className="text-3xs text-slate-400 font-bold">
                        {new Date(stamp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 font-bold bg-slate-50 p-4 rounded-xl w-full text-center">
                    まだスタンプは届いていません。となりのお友達に先に送ってみよう！🧅
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'hirameki' && (
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
      )}

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
