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
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ParentStats | null>(null);
  const [studentName, setStudentName] = useState("お子様");
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  // Load stats on mount
  useEffect(() => {
    const token = localStorage.getItem("rakkyo_token");
    const userJson = localStorage.getItem("rakkyo_user");
    
    if (!token) {
      router.push("/");
      return;
    }

    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        setStudentName(user.nickname || "お子様");
      } catch (e) {
        console.error(e);
      }
    }

    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/parent/stats", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) throw new Error("統計の取得に失敗しました。");
        const data = await response.json();
        setStats(data);
        setIsFallback(false);
      } catch (err) {
        console.warn("⚠️ API connection failed. Falling back to dynamic client-side mocked stats.", err);
        
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
        };
        setStats(fallbackData);
        setIsFallback(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("rakkyo_token");
    localStorage.removeItem("rakkyo_user");
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#FAF9F6] p-6 text-slate-500">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-indigo-600 mb-4"></div>
        <p className="text-sm font-medium">学習レポートを集計中... 🧅</p>
      </div>
    );
  }

  if (!stats) return null;

  const { summary, dailyActivity, topicProgress, hintStageUsage } = stats;

  // Calculate SVG charts calculations
  // 1. Daily activity: max height mapping
  const maxAttempts = Math.max(...dailyActivity.map((d) => d.attemptsCount), 4);
  const chartHeight = 150;
  const chartWidth = 500;
  const paddingX = 40;
  const paddingY = 20;
  const graphWidth = chartWidth - paddingX * 2;
  const graphHeight = chartHeight - paddingY * 2;
  const stepX = graphWidth / 6;

  // 2. Hint donut segments
  const totalStages = hintStageUsage.stage1Count + hintStageUsage.stage2Count + hintStageUsage.stage3Count;
  const stage1Percent = totalStages > 0 ? (hintStageUsage.stage1Count / totalStages) * 100 : 0;
  const stage2Percent = totalStages > 0 ? (hintStageUsage.stage2Count / totalStages) * 100 : 0;
  const stage3Percent = totalStages > 0 ? (hintStageUsage.stage3Count / totalStages) * 100 : 0;

  // SVG Donut math (Radius = 50)
  // Circumference = 2 * PI * 50 = 314.16
  const circ = 314.16;
  const strokeDash1 = (stage1Percent / 100) * circ;
  const strokeDash2 = (stage2Percent / 100) * circ;
  const strokeDash3 = (stage3Percent / 100) * circ;

  return (
    <div className="flex-1 bg-[#F8FAFC] pb-16 font-sans select-none">
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
            <p className="text-xs text-slate-400 font-medium">お子様の数学学習の分析レポート</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-100 px-3 py-2 rounded-xl transition-all flex items-center space-x-1"
          >
            <span>学習画面に戻る 🧅</span>
          </button>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition-all"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 mt-8">
        
        {/* Offline Banner if fallback */}
        {isFallback && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center space-x-3 text-indigo-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
            </svg>
            <div className="text-xs">
              <p className="font-bold">💡 ローカルAPIサーバー非接続のため、デモ用学習レポートを表示しています。</p>
              <p className="mt-0.5 opacity-90">APIサーバーを立ち上げると、実際の解いたデータがリアルタイムで反映されます。</p>
            </div>
          </div>
        )}

        {/* Hello Section */}
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
            {studentName} さんは頑張っています！🎉
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-xl font-medium leading-relaxed">
            Rakkyoは、正解をすぐに教えずに「3段階のヒント」でお子様の自学力を育てます。
            ここでは日々の軌跡と、ヒントを通じて自力で乗り越えた「あきらめない心」を視覚的にレポートします。
          </p>
        </div>

        {/* 1. Overall Summary Grid */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">解いた問題数</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-black text-slate-800">{summary.totalAttempts}</span>
              <span className="text-xs font-semibold text-slate-400 ml-1">問</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">（うち正解：{summary.correctAttempts}問）</p>
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
            <span className="text-xs font-semibold text-slate-400">学習した日数</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-black text-slate-800">{summary.totalActiveDays}</span>
              <span className="text-xs font-semibold text-slate-400 ml-1">日</span>
            </div>
            <p className="text-[10px] text-indigo-500 mt-1 font-semibold">コツコツ続けられています！</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400">総ヒント使用</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-black text-indigo-600">{summary.totalHintsUsed}</span>
              <span className="text-xs font-semibold text-indigo-400 ml-1">回</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">AIは {summary.totalHintsUsed} 回寄り添いました</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 p-5 rounded-2xl border border-indigo-100 shadow-xs col-span-2 md:col-span-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800">あきらめない心</span>
              <span className="text-[10px] text-indigo-600 font-extrabold bg-white px-1.5 py-0.5 rounded-md border border-indigo-200">Grit</span>
            </div>
            <div className="mt-2 flex items-baseline">
              <span className="text-2xl font-black text-indigo-800">{summary.gritScore}</span>
              <span className="text-xs font-bold text-indigo-600 ml-1">%</span>
            </div>
            <p className="text-[9px] text-indigo-500/90 leading-tight mt-1 font-medium">
              ヒントを活用して最終的に自力で正解できた割合です。
            </p>
          </div>
        </section>

        {/* 2. Main Analytics Section (2 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Daily Activity Chart & Progression - Col span 2 */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Daily Activity Custom SVG Chart */}
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

              {/* Custom Responsive SVG Chart */}
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

                  {/* Columns & Line plots */}
                  {dailyActivity.map((day, idx) => {
                    const x = paddingX + stepX * idx;
                    
                    // Attempts bars
                    const barW = 14;
                    const barH = day.attemptsCount > 0 ? (day.attemptsCount / maxAttempts) * graphHeight : 0;
                    const barY = chartHeight - paddingY - barH;
                    
                    // Correct bars
                    const correctBarH = day.correctCount > 0 ? (day.correctCount / maxAttempts) * graphHeight : 0;
                    const correctBarY = chartHeight - paddingY - correctBarH;

                    return (
                      <g key={idx}>
                        {/* Attempts bar (background grey-blue) */}
                        {day.attemptsCount > 0 && (
                          <rect
                            x={x - barW / 2}
                            y={barY}
                            width={barW}
                            height={barH}
                            fill="#E2E8F0"
                            rx="3"
                          />
                        )}
                        
                        {/* Correct bar (foreground emerald) */}
                        {day.correctCount > 0 && (
                          <rect
                            x={x - barW / 2}
                            y={correctBarY}
                            width={barW}
                            height={correctBarH}
                            fill="#10B981"
                            rx="3"
                          />
                        )}

                        {/* Date labels */}
                        <text x={x} y={chartHeight - 4} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="bold">
                          {day.date}
                        </text>
                      </g>
                    );
                  })}

                  {/* Line Chart for Hints count */}
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
                        {/* Line */}
                        <polyline
                          fill="none"
                          stroke="#4F46E5"
                          strokeWidth="2"
                          strokeDasharray="1, 0"
                          points={points}
                        />
                        {/* Dots */}
                        {dailyActivity.map((day, idx) => {
                          const x = paddingX + stepX * idx;
                          const y = chartHeight - paddingY - (day.hintsCount / maxAttempts) * graphHeight;
                          return (
                            <circle
                              key={idx}
                              cx={x}
                              cy={y}
                              r="3.5"
                              fill="#FFFFFF"
                              stroke="#4F46E5"
                              strokeWidth="2"
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>

            {/* Topic Progress Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-800 mb-5">単元別の学習進捗</h3>
              
              <div className="space-y-5">
                {topicProgress.map((topic, idx) => {
                  return (
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
                      
                      {/* Custom Progress bar */}
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
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
                  );
                })}
              </div>
            </div>

          </div>

          {/* AI Companion & Hints Stage - Col span 1 */}
          <div className="space-y-8">
            
            {/* Hint Stage Donut Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col items-center text-center">
              <div className="w-full text-left mb-4">
                <h3 className="text-sm font-bold text-slate-800">ヒントの活用傾向</h3>
                <p className="text-xs text-slate-400 font-medium">3段階のAIヒントをどのように使ったか</p>
              </div>

              {totalStages > 0 ? (
                <div className="relative w-40 h-40 flex items-center justify-center my-2">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                    
                    {/* Stage 1 (Indigo) */}
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#4F46E5"
                      strokeWidth="12"
                      strokeDasharray={`${strokeDash1} ${circ - strokeDash1}`}
                      strokeLinecap="round"
                    />
                    
                    {/* Stage 2 (Sky) */}
                    {stage2Percent > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="#0EA5E9"
                        strokeWidth="12"
                        strokeDasharray={`${strokeDash2} ${circ - strokeDash2}`}
                        strokeDashoffset={-strokeDash1}
                        strokeLinecap="round"
                      />
                    )}

                    {/* Stage 3 (Emerald) */}
                    {stage3Percent > 0 && (
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="12"
                        strokeDasharray={`${strokeDash3} ${circ - strokeDash3}`}
                        strokeDashoffset={-(strokeDash1 + strokeDash2)}
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                  
                  {/* Center percentage (Grit Score or total hints) */}
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

              {/* Legend with Stage Explanations */}
              <div className="w-full text-left space-y-2.5 mt-2">
                <div className="flex items-start justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-indigo-600 inline-block flex-shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700 block">段階1：言い換え</span>
                      <span className="text-[9px] text-slate-400 font-medium">問題の整理とフック</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-600">{hintStageUsage.stage1Count}回</span>
                </div>

                <div className="flex items-start justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-sky-500 inline-block flex-shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700 block">段階2：図解・イメージ</span>
                      <span className="text-[9px] text-slate-400 font-medium">数直線や図での視覚ヒント</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-600">{hintStageUsage.stage2Count}回</span>
                </div>

                <div className="flex items-start justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block flex-shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700 block">段階3：解き方のステップ</span>
                      <span className="text-[9px] text-slate-400 font-medium">解法の順序立てガイド</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-600">{hintStageUsage.stage3Count}回</span>
                </div>
              </div>
            </div>

            {/* Parent Educational Tip Card */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xs">
              <h4 className="text-xs font-black text-indigo-400 tracking-wider uppercase mb-3">AIチューターからの温かいアドバイス</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                数学の学習において「ヒントを借りる」ことは、カンニングではなく<b>「解決策を探索する主体性」</b>の現れです。
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium mt-2.5">
                {studentName}さんは<b>「段階1」や「段階2」</b>のヒントをよく読み込んで、自分でひらめくきっかけを掴んでいます。
                お子様が間違えたときは、「ヒントを読んで自分で正解できて凄いね！」と、そのあきらめない姿勢を褒めてあげてください。
              </p>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
