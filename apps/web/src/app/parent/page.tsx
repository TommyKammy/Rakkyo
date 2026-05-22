"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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

  const handleLogout = () => {
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

  // SVG calculations for daily activity
  const maxAttempts = Math.max(...dailyActivity.map((d) => d.attemptsCount), 4);
  const chartHeight = 150;
  const chartWidth = 500;
  const paddingX = 40;
  const paddingY = 20;
  const graphWidth = chartWidth - paddingX * 2;
  const graphHeight = chartHeight - paddingY * 2;
  const stepX = graphWidth / 6;

  const totalStages = hintStageUsage.stage1Count + hintStageUsage.stage2Count + hintStageUsage.stage3Count;
  const stage1Percent = totalStages > 0 ? (hintStageUsage.stage1Count / totalStages) * 100 : 0;
  const stage2Percent = totalStages > 0 ? (hintStageUsage.stage2Count / totalStages) * 100 : 0;
  const stage3Percent = totalStages > 0 ? (hintStageUsage.stage3Count / totalStages) * 100 : 0;

  const circ = 314.16;
  const strokeDash1 = (stage1Percent / 100) * circ;
  const strokeDash2 = (stage2Percent / 100) * circ;
  const strokeDash3 = (stage3Percent / 100) * circ;

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
        
        {/* 1. Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            {/* Overall Summary Grid */}
            <section className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400">解いた問題数</span>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-black text-slate-800">{summary.totalAttempts}</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">問</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">（正解：{summary.correctAttempts}問）</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400">平均正解率</span>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-black text-emerald-600">{summary.accuracyRate}</span>
                  <span className="text-xs font-semibold text-emerald-500 ml-1">%</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${summary.accuracyRate}%` }}></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400">あきらめない時間</span>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-black text-slate-800">{summary.totalStudyTimeMinutes}</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">分</span>
                </div>
                <p className="text-[10px] text-indigo-500 mt-1 font-semibold">自力でじっくり考えました</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400">学習した日数</span>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-black text-slate-800">{summary.totalActiveDays}</span>
                  <span className="text-xs font-semibold text-slate-400 ml-1">日</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">マイペースに継続中</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <span className="text-xs font-semibold text-slate-400">総ヒント使用</span>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-black text-indigo-600">{summary.totalHintsUsed}</span>
                  <span className="text-xs font-semibold text-indigo-400 ml-1">回</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">AIがお手伝いした回数</p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 rounded-2xl border border-indigo-100 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-800">あきらめない心</span>
                  <span className="text-[10px] text-indigo-600 font-extrabold bg-white px-1.5 py-0.5 rounded-md border border-indigo-200">Grit</span>
                </div>
                <div className="mt-2 flex items-baseline">
                  <span className="text-2xl font-black text-indigo-800">{summary.gritScore}</span>
                  <span className="text-xs font-bold text-indigo-600 ml-1">%</span>
                </div>
                <p className="text-[9px] text-indigo-500/90 leading-tight mt-1 font-medium">
                  ヒントを経て自力正解した割合
                </p>
              </div>
            </section>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-8">
                
                {/* SVG Chart */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">日別学習アクティビティ</h3>
                      <p className="text-xs text-slate-400 font-medium">直近1週間の問題取り組み数とヒント回数</p>
                    </div>
                    <div className="flex items-center space-x-3 text-[10px] font-bold">
                      <div className="flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 bg-slate-300 rounded-xs inline-block"></span>
                        <span className="text-slate-500">解いた問題</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs inline-block"></span>
                        <span className="text-slate-500">正解</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full border border-indigo-600 bg-white inline-block"></span>
                        <span className="text-slate-500">ヒント回数</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full h-[180px] select-none">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                      {/* Grid Lines */}
                      {[0, 1, 2, 3].map((tick) => {
                        const y = paddingY + (graphHeight / 3) * tick;
                        const val = Math.round(maxAttempts - (maxAttempts / 3) * tick);
                        return (
                          <g key={tick}>
                            <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                            <text x={paddingX - 10} y={y + 4} textAnchor="end" fontSize="9" fill="#94A3B8" fontWeight="bold">
                              {val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Columns */}
                      {dailyActivity.map((day, idx) => {
                        const x = paddingX + stepX * idx;
                        const barW = 14;
                        const barH = day.attemptsCount > 0 ? (day.attemptsCount / maxAttempts) * graphHeight : 0;
                        const barY = chartHeight - paddingY - barH;
                        
                        const correctBarH = day.correctCount > 0 ? (day.correctCount / maxAttempts) * graphHeight : 0;
                        const correctBarY = chartHeight - paddingY - correctBarH;

                        return (
                          <g key={idx}>
                            {day.attemptsCount > 0 && (
                              <rect x={x - barW / 2} y={barY} width={barW} height={barH} fill="#E2E8F0" rx="3" />
                            )}
                            {day.correctCount > 0 && (
                              <rect x={x - barW / 2} y={correctBarY} width={barW} height={correctBarH} fill="#10B981" rx="3" />
                            )}
                            <text x={x} y={chartHeight - 4} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="bold">
                              {day.date}
                            </text>
                          </g>
                        );
                      })}

                      {/* Line Chart for Hints */}
                      {(() => {
                        const points = dailyActivity
                          .map((day, idx) => {
                            const x = paddingX + stepX * idx;
                            const y = chartHeight - paddingY - (day.hintsCount / maxAttempts) * graphHeight;
                            return `${x},${y}`;
                          })
                          .join(" ");
                        
                        return (
                          <>
                            <polyline fill="none" stroke="#4F46E5" strokeWidth="2" points={points} />
                            {dailyActivity.map((day, idx) => {
                              const x = paddingX + stepX * idx;
                              const y = chartHeight - paddingY - (day.hintsCount / maxAttempts) * graphHeight;
                              return (
                                <circle key={idx} cx={x} cy={y} r="3.5" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="2" />
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>

                {/* Topic progress */}
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-800 mb-5">単元別の学習進捗</h3>
                  <div className="space-y-5">
                    {topicProgress.map((topic, idx) => (
                      <div key={idx} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${topic.attemptsCount > 0 ? "bg-indigo-500" : "bg-slate-300"}`} />
                            <span className="text-xs font-bold text-slate-700">{topic.unitName}</span>
                            {topic.isCompleted && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">
                                マスター 🎉
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">
                            {topic.attemptsCount} / {topic.totalQuestions} 問クリア
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${(topic.attemptsCount / topic.totalQuestions) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-10 text-right">
                            {topic.attemptsCount > 0 ? topic.accuracyRate : 0}%
                            <span className="text-[8px] text-slate-400 block font-medium">正解率</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sidebar */}
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center text-center">
                  <div className="w-full text-left mb-4">
                    <h3 className="text-sm font-bold text-slate-800">ヒントの活用傾向</h3>
                    <p className="text-xs text-slate-400 font-medium">3段階のAIヒントをどのように使ったか</p>
                  </div>

                  {totalStages > 0 ? (
                    <div className="relative w-40 h-40 flex items-center justify-center my-2">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#4F46E5" strokeWidth="12" strokeDasharray={`${strokeDash1} ${circ - strokeDash1}`} strokeLinecap="round" />
                        {stage2Percent > 0 && (
                          <circle cx="60" cy="60" r="50" fill="none" stroke="#0EA5E9" strokeWidth="12" strokeDasharray={`${strokeDash2} ${circ - strokeDash2}`} strokeDashoffset={-strokeDash1} strokeLinecap="round" />
                        )}
                        {stage3Percent > 0 && (
                          <circle cx="60" cy="60" r="50" fill="none" stroke="#10B981" strokeWidth="12" strokeDasharray={`${strokeDash3} ${circ - strokeDash3}`} strokeDashoffset={-(strokeDash1 + strokeDash2)} strokeLinecap="round" />
                        )}
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-2xl font-black text-slate-800">{summary.totalHintsUsed}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">使用回数</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-xs text-slate-400">
                      ヒント使用データがまだありません
                    </div>
                  )}

                  <div className="w-full text-left space-y-2.5 mt-2">
                    <div className="flex items-start justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-700 block">段階1：言い換え</span>
                        </div>
                      </div>
                      <span className="font-bold text-slate-600">{hintStageUsage.stage1Count}回</span>
                    </div>

                    <div className="flex items-start justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-sky-500 inline-block flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-700 block">段階2：イメージ図</span>
                        </div>
                      </div>
                      <span className="font-bold text-slate-600">{hintStageUsage.stage2Count}回</span>
                    </div>

                    <div className="flex items-start justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-700 block">段階3：手順ガイド</span>
                        </div>
                      </div>
                      <span className="font-bold text-slate-600">{hintStageUsage.stage3Count}回</span>
                    </div>
                  </div>
                </div>

                {/* Educational Banner */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xs">
                  <h4 className="text-xs font-black text-indigo-400 tracking-wider uppercase mb-3">AIチューターからのメッセージ</h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                    数学の学習において「ヒントを借りる」ことは、カンニングではなく<b>「解決策を探索する主体性」</b>の現れです。
                  </p>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-medium mt-2.5">
                    「ヒントを読んで自分で正解できて凄いね！」と、そのあきらめない姿勢を褒めてあげてください。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Weakness analysis Tab */}
        {activeTab === "weakness" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-2">🔍 AI 苦手自動推定レポート</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                正答率・ヒント使用数・同一問題への再挑戦回数の3つの学習プロセスを分析し、現在特につまずきやすいと思われる単元をAIが自動検知しています。
              </p>
            </div>

            {weakestUnits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {weakestUnits.map((unit, idx) => (
                  <div key={idx} className="bg-white border-2 border-rose-100 rounded-3xl p-6 relative overflow-hidden shadow-xs hover:border-rose-200 transition-all">
                    <div className="absolute right-0 top-0 bg-rose-500 text-white font-extrabold text-[10px] px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                      苦手度 {unit.weakestScore}%
                    </div>
                    
                    <span className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-full">
                      優先サポート対象
                    </span>

                    <h4 className="text-lg font-black text-slate-800 mt-3">{unit.unitName}</h4>

                    <div className="grid grid-cols-3 gap-2 mt-4 bg-slate-50 p-3 rounded-2xl text-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">正解率</span>
                        <span className="text-sm font-black text-rose-600">{unit.accuracyRate}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">平均ヒント</span>
                        <span className="text-sm font-black text-slate-700">{unit.avgHintsUsed}回</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block">解き直し</span>
                        <span className="text-sm font-black text-indigo-600">{unit.retryCount}回</span>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="flex items-start space-x-2.5">
                        {/* Little Cute Scallion Hat Icon */}
                        <div className="w-8 h-8 bg-amber-50 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm">
                          🧅
                        </div>
                        <div className="flex-1">
                          <span className="text-xs font-extrabold text-amber-700 block">ラッキョくんからの指導アドバイス</span>
                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-1">
                            {unit.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-12 text-center text-slate-400 rounded-3xl border border-slate-200">
                <span className="text-3xl block mb-2">🎉</span>
                <p className="text-xs font-bold">まだ顕著な苦手単元は見つかっていません！</p>
                <p className="text-[10px] text-slate-400 mt-1">日々の学習にバランスよく取り組めている素晴らしい状態です。</p>
              </div>
            )}
          </div>
        )}

        {/* 3. Weekly comparative Tab */}
        {activeTab === "weekly" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-2">📈 週次成長推移レポート</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                過去4週間分の学習記録を週単位で比較し、習慣の定着や進歩を前向きに可視化します。
              </p>
            </div>

            {/* Custom Interactive Weekly comparison grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {weeklyHistory.map((week, idx) => (
                <div 
                  key={idx} 
                  className={`bg-white border rounded-3xl p-5 shadow-xs flex flex-col justify-between transition-all ${
                    week.label === "今週" 
                      ? "border-2 border-indigo-500 shadow-md ring-4 ring-indigo-50"
                      : "border-slate-200"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-black text-slate-800">{week.label}</span>
                      <span className="text-[9px] font-bold text-slate-400">{week.period}</span>
                    </div>
                    <div className="border-b border-slate-100 pb-2 mb-3">
                      {week.totalAttempts > 0 ? (
                        <span className="text-xs text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          学習記録あり 🌟
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full">
                          おやすみ 💤
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold">解いた問題</span>
                        <span className="text-slate-700 font-black">{week.totalAttempts} 問</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold">正解率</span>
                        <span className="text-slate-700 font-black">{week.accuracyRate}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold">学習時間</span>
                        <span className="text-slate-700 font-black">{week.studyTimeMinutes} 分</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold">Grit スコア</span>
                        <span className="text-indigo-600 font-black">{week.gritScore}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] font-medium text-slate-500 leading-normal">
                    {week.totalAttempts === 0 
                      ? "この週はゆっくりお休みして、エネルギーを充電した期間でした。" 
                      : week.gritScore > 70 
                      ? "ヒントを活用しながら困難な問題から逃げずにやり遂げた証拠です！"
                      : "基礎力の充実に努め、着々とステップアップしています。"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Encouragement Message Tab */}
        {activeTab === "message" && (
          <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
            {/* Notification Toast */}
            {messageToast && (
              <div className="bg-indigo-600 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-lg border border-indigo-500 animate-bounce flex items-center justify-between">
                <span>{messageToast}</span>
                <span className="text-sm">👍</span>
              </div>
            )}

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-base font-bold text-slate-800 mb-2">💌 お子様に応援メッセージを送ろう</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                保護者様から贈る励ましの言葉は、お子様の「やる気」と「粘り強さ」を育む一番の特効薬です。
                送信すると、お子様のホーム画面にラッキョくんが嬉しそうにお手紙として運んでいきます。
              </p>
            </div>

            {/* Post Message Form */}
            <form onSubmit={handleSendMessage} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-500 block mb-1">メッセージ内容</label>
                <textarea
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="例: 今日はヒントを読んで最後まで解けたんだね！あきらめないでやりぬく姿勢、とってもかっこいいよ！"
                  maxLength={150}
                  rows={3}
                  className="w-full border-2 border-slate-100 hover:border-slate-200 focus:border-indigo-500 outline-none rounded-2xl p-4 text-xs font-bold transition-all resize-none"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-bold">
                  <span>※ 150文字以内で、温かく褒める表現がおすすめです。</span>
                  <span>{newMessageText.length} / 150文字</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingMessage || !newMessageText.trim()}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-extrabold rounded-2xl text-xs transition-all cursor-pointer shadow-md active:translate-y-[2px]"
              >
                {isSendingMessage ? "メッセージを送信中..." : "メッセージを届ける 🚀"}
              </button>
            </form>

            {/* Message History */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-500">これまでの応援レター履歴</h4>

              {messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <p className="text-xs font-bold text-slate-700 leading-relaxed">
                          {msg.message}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block mt-2">
                          送信日時: {new Date(msg.createdAt).toLocaleString("ja-JP", { hour12: false })}
                        </span>
                      </div>
                      
                      {msg.isRead ? (
                        <div className="flex flex-col items-center justify-center flex-shrink-0 text-center bg-rose-50 border border-rose-100 rounded-2xl p-2 w-16">
                          <span className="text-sm">❤️</span>
                          <span className="text-[8px] font-black text-rose-500 mt-0.5 leading-none">よんだよ！</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center flex-shrink-0 text-center bg-slate-50 border border-slate-100 rounded-2xl p-2 w-16">
                          <span className="text-sm">✉️</span>
                          <span className="text-[8px] font-bold text-slate-400 mt-0.5 leading-none">未読</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white p-8 text-center text-xs text-slate-400 rounded-3xl border border-slate-200">
                  まだ送信したメッセージはありません。最初の応援を送ってみましょう！
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
