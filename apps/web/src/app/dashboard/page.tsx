"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CongratsOverlay } from "./components/CongratsOverlay";
import { ClosetModal } from "./components/ClosetModal";
import { RakkyoMascot } from "./components/RakkyoMascot";
import { useRakkyoVoice } from "../../hooks/useRakkyoVoice";
import { AdventureTab } from "./components/AdventureTab";
import { RoomTab } from "./components/RoomTab";
import { HiramekiTab } from "./components/HiramekiTab";

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
        <AdventureTab
          recommendation={recommendation}
          reviews={reviews}
          quests={quests}
          ALL_BADGES={ALL_BADGES}
          cleanUserBadgeNames={cleanUserBadgeNames}
          speak={speak}
          stop={stop}
          getNumericLessonId={getNumericLessonId}
          router={router}
        />
      )}

      {activeTab === 'room' && (
        <RoomTab
          missions={missions}
          roomData={roomData}
          receivedStamps={receivedStamps}
          selectedFriendForStamp={selectedFriendForStamp}
          setSelectedFriendForStamp={setSelectedFriendForStamp}
          handleSendStamp={handleSendStamp}
          fetchRoomData={fetchRoomData}
          isLoadingRoom={isLoadingRoom}
        />
      )}

      {activeTab === 'hirameki' && (
        <HiramekiTab
          hiramekiTips={hiramekiTips}
          newHiramekiContent={newHiramekiContent}
          setNewHiramekiContent={setNewHiramekiContent}
          handlePostHirameki={handlePostHirameki}
          isPostingHirameki={isPostingHirameki}
          isLoadingHirameki={isLoadingHirameki}
        />
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
