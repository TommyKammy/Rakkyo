"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardTab } from "./components/DashboardTab";
import { WeaknessTab } from "./components/WeaknessTab";
import { WeeklyTab } from "./components/WeeklyTab";
import { MessageTab } from "./components/MessageTab";

interface ParentStats {
  summary: {
    totalActiveDays: number;
    totalAttempts: number;
    correctAttempts: number;
    accuracyRate: number;
    totalHintsUsed: number;
    gritScore: number;
    totalStudyTimeMinutes: number;
  };
  dailyActivity: {
    date: string;
    attemptsCount: number;
    correctCount: number;
    hintsCount: number;
  }[];
  topicProgress: {
    unitName: string;
    totalQuestions: number;
    attemptsCount: number;
    correctCount: number;
    accuracyRate: number;
    isCompleted: boolean;
  }[];
  hintStageUsage: {
    stage1Count: number;
    stage2Count: number;
    stage3Count: number;
  };
  weakestUnits: {
    unitName: string;
    weakestScore: number;
    accuracyRate: number;
    avgHintsUsed: number;
    retryCount: number;
    reason: string;
  }[];
  weeklyHistory: {
    label: string;
    period: string;
    totalAttempts: number;
    accuracyRate: number;
    studyTimeMinutes: number;
    gritScore: number;
  }[];
}

interface ParentMessage {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ParentStats | null>(null);
  const [messages, setMessages] = useState<ParentMessage[]>([]);
  const [studentName, setStudentName] = useState("お子様");
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "weakness" | "weekly" | "message">("dashboard");
  const [newMessageText, setNewMessageText] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageToast, setMessageToast] = useState("");

  // Load stats and messages on mount
  useEffect(() => {
    const token = localStorage.getItem("rakkyo_token");
    const userJson = localStorage.getItem("rakkyo_user");

    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        setStudentName(user.nickname || "お子様");
      } catch (e) {
        console.error(e);
      }
    } else {
      setStudentName("体験版のお子様");
    }

    const loadMockData = () => {
      // Dynamic offline fallback with realistic JST dates
      const now = new Date();
      const getPastDateStr = (daysAgo: number) => {
        const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        const jstTime = d.getTime() + (9 * 60 * 60 * 1000);
        const jstDate = new Date(jstTime);
        const parts = jstDate.toISOString().split("T")[0].split("-");
        return `${parts[1]}-${parts[2]}`; // MM-DD
      };

      const fallbackData: ParentStats = {
        summary: {
          totalActiveDays: 5,
          totalAttempts: 10,
          correctAttempts: 8,
          accuracyRate: 80,
          totalHintsUsed: 14,
          gritScore: 75,
          totalStudyTimeMinutes: 28,
        },
        dailyActivity: [
          { date: getPastDateStr(6), attemptsCount: 0, correctCount: 0, hintsCount: 0 },
          { date: getPastDateStr(5), attemptsCount: 0, correctCount: 0, hintsCount: 0 },
          { date: getPastDateStr(4), attemptsCount: 2, correctCount: 2, hintsCount: 1 },
          { date: getPastDateStr(3), attemptsCount: 2, correctCount: 1, hintsCount: 5 },
          { date: getPastDateStr(2), attemptsCount: 2, correctCount: 2, hintsCount: 3 },
          { date: getPastDateStr(1), attemptsCount: 2, correctCount: 1, hintsCount: 4 },
          { date: getPastDateStr(0), attemptsCount: 2, correctCount: 2, hintsCount: 1 },
        ],
        topicProgress: [
          { unitName: "正負の数", totalQuestions: 10, attemptsCount: 8, correctCount: 7, accuracyRate: 88, isCompleted: true },
          { unitName: "文字と式", totalQuestions: 10, attemptsCount: 2, correctCount: 1, accuracyRate: 50, isCompleted: false },
          { unitName: "一次方程式", totalQuestions: 10, attemptsCount: 0, correctCount: 0, accuracyRate: 0, isCompleted: false },
        ],
        hintStageUsage: {
          stage1Count: 8,
          stage2Count: 4,
          stage3Count: 2,
        },
        weakestUnits: [
          {
            unitName: "文字と式",
            weakestScore: 68,
            accuracyRate: 50,
            avgHintsUsed: 1.5,
            retryCount: 1,
            reason: "正答率が 50% と少し低めになっており、文字の代入や計算規則でつまずきがあるかもしれません。"
          },
          {
            unitName: "正負の数",
            weakestScore: 42,
            accuracyRate: 88,
            avgHintsUsed: 1.9,
            retryCount: 2,
            reason: "正答率は高いですが、3段階ヒントを多く活用して慎重に進めている様子が見られます。"
          }
        ],
        weeklyHistory: [
          { label: "3週間前", period: "05-01 〜 05-07", totalAttempts: 0, accuracyRate: 0, studyTimeMinutes: 0, gritScore: 0 },
          { label: "2週間前", period: "05-08 〜 05-14", totalAttempts: 4, accuracyRate: 75, studyTimeMinutes: 12, gritScore: 50 },
          { label: "先週", period: "05-15 〜 05-21", totalAttempts: 4, accuracyRate: 75, studyTimeMinutes: 10, gritScore: 66 },
          { label: "今週", period: "05-22 〜 05-28", totalAttempts: 2, accuracyRate: 100, studyTimeMinutes: 6, gritScore: 100 }
        ]
      };

      const localMsgs = localStorage.getItem("rakkyo_parent_msgs");
      if (localMsgs) {
        setMessages(JSON.parse(localMsgs));
      } else {
        const defaultMsgs = [
          { id: "demo_1", message: "ヒントを読んで自分で解けて凄いね！その調子だよ🧅", isRead: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
          { id: "demo_2", message: "今日の問題もよくがんばりました！", isRead: false, createdAt: new Date().toISOString() }
        ];
        setMessages(defaultMsgs);
        localStorage.setItem("rakkyo_parent_msgs", JSON.stringify(defaultMsgs));
      }

      setStats(fallbackData);
      setIsFallback(true);
      setIsLoading(false);
    };

    if (!token) {
      loadMockData();
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch stats
        const response = await fetch("http://localhost:4000/api/parent/stats", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) throw new Error("統計の取得に失敗しました。");
        const data = await response.json();
        setStats(data);

        // Fetch messages
        const msgResponse = await fetch("http://localhost:4000/api/parent/message", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          setMessages(msgData.messages || []);
        }
        
        setIsFallback(false);
      } catch (err) {
        console.warn("⚠️ API connection failed. Falling back to dynamic client-side mocked stats & messages.", err);
        loadMockData();
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    // P2: Route through user-isolation.handleLogout so a shared device also
    // wipes any offline OPFS DB + AES-GCM key for this account (RTBF-local),
    // not just the session tokens. Loaded dynamically to avoid pulling the
    // sqlite-wasm dependency into the parent page's initial bundle.
    try {
      const userStr = localStorage.getItem("rakkyo_user");
      const userId = userStr ? JSON.parse(userStr)?.id : null;
      if (userId) {
        const { handleLogout: wipeLocalUserData } = await import(
          "@/lib/offline/user-isolation"
        );
        await wipeLocalUserData(userId);
      }
    } catch (e) {
      console.error("Failed to wipe local offline data on logout:", e);
    }
    localStorage.removeItem("rakkyo_token");
    localStorage.removeItem("rakkyo_user");
    router.push("/");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    setIsSendingMessage(true);
    const token = localStorage.getItem("rakkyo_token");

    try {
      if (isFallback || !token) {
        // Offline Mock Send
        const newMsg: ParentMessage = {
          id: "local_msg_" + Math.random().toString(36).substr(2, 9),
          message: newMessageText,
          isRead: false,
          createdAt: new Date().toISOString()
        };
        const updatedMsgs = [newMsg, ...messages];
        setMessages(updatedMsgs);
        localStorage.setItem("rakkyo_parent_msgs", JSON.stringify(updatedMsgs));
        setMessageToast("メッセージを送信しました！（デモモード）");
      } else {
        const response = await fetch("http://localhost:4000/api/parent/message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ message: newMessageText })
        });
        if (!response.ok) throw new Error("メッセージ送信失敗");
        const data = await response.json();
        setMessages((prev) => [data.message, ...prev]);
        setMessageToast("メッセージをお子様に届けました！🧅");
      }
      setNewMessageText("");
      setTimeout(() => setMessageToast(""), 4000);
    } catch (err) {
      console.error(err);
      alert("メッセージの送信に失敗しました。");
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#FAF9F6] p-6 text-slate-500 min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-indigo-600 mb-4"></div>
        <p className="text-sm font-medium">学習レポートを集計中... 🧅</p>
      </div>
    );
  }

  if (!stats) return null;

  const { summary, dailyActivity, topicProgress, hintStageUsage, weakestUnits, weeklyHistory } = stats;

  return (
    <div className="flex-1 bg-[#F8FAFC] pb-24 font-sans select-none min-h-screen">
      {/* Sleek Top Navbar */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-50 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">Rakkyo 保護者ページ</h1>
            <p className="text-xs text-slate-400 font-medium">お子様の学習分析 & 応援コミュニケーション</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              const token = typeof window !== "undefined" ? localStorage.getItem("rakkyo_token") : null;
              if (token) {
                router.push("/dashboard");
              } else {
                router.push("/");
              }
            }}
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-100 px-3 py-2 rounded-xl transition-all cursor-pointer"
          >
            <span>{typeof window !== "undefined" && localStorage.getItem("rakkyo_token") ? "学習画面に戻る 🧅" : "ログイン画面へ戻る 🧅"}</span>
          </button>
          {typeof window !== "undefined" && localStorage.getItem("rakkyo_token") && (
            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition-all cursor-pointer"
            >
              ログアウト
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 mt-8">
        
        {/* Offline Banner if fallback */}
        {isFallback && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center space-x-3 text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
            </svg>
            <div className="text-xs">
              <p className="font-bold">💡 デモ用学習レポートを表示しています。</p>
              <p className="mt-0.5 opacity-90">APIサーバーを立ち上げると、実際の解いたデータや応援メッセージがリアルタイムで反映されます。</p>
            </div>
          </div>
        )}

        {/* Hello Banner */}
        <div className="bg-gradient-to-r from-slate-800 to-indigo-950 rounded-3xl p-6 md:p-8 text-white mb-8 shadow-md relative overflow-hidden">
          <div className="absolute right-[-5%] bottom-[-20%] opacity-10">
            <svg viewBox="0 0 100 100" className="w-64 h-64 fill-white">
              <path d="M50,15 C28,30 25,65 30,80 C34,92 66,92 70,80 C75,65 72,30 50,15 Z" />
            </svg>
          </div>
          
          <span className="text-xs uppercase font-bold tracking-widest text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full">
            お子様の学習状況
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight">
            {studentName} さんの成長記録 🌟
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-xl font-medium leading-relaxed">
            結果だけを見るのではなく、ヒントを活用して最終的に自力で乗り越えた「あきらめないプロセス（Grit）」を温かく応援してあげましょう。
          </p>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto whitespace-nowrap scrollbar-none gap-2">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "dashboard"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span>📊 ダッシュボード</span>
          </button>
          
          <button
            onClick={() => setActiveTab("weakness")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "weakness"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span>🔍 苦手推定レポート</span>
            {weakestUnits.length > 0 && (
              <span className="bg-rose-100 text-rose-600 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">
                {weakestUnits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("weekly")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "weekly"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span>📈 週次推移レポート</span>
          </button>

          <button
            onClick={() => setActiveTab("message")}
            className={`py-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === "message"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <span>💌 応援メッセージ</span>
            {messages.filter(m => !m.isRead).length > 0 && (
              <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold">
                {messages.filter(m => !m.isRead).length}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === "dashboard" && (
          <DashboardTab
            summary={summary}
            dailyActivity={dailyActivity}
            topicProgress={topicProgress}
            hintStageUsage={hintStageUsage}
          />
        )}
        
        {activeTab === "weakness" && (
          <WeaknessTab weakestUnits={weakestUnits} />
        )}

        {activeTab === "weekly" && (
          <WeeklyTab weeklyHistory={weeklyHistory} />
        )}

        {activeTab === "message" && (
          <MessageTab
            messages={messages}
            newMessageText={newMessageText}
            setNewMessageText={setNewMessageText}
            isSendingMessage={isSendingMessage}
            handleSendMessage={handleSendMessage}
            messageToast={messageToast}
          />
        )}

      </main>
    </div>
  );
}
