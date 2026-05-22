import React from "react";

interface DashboardTabProps {
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
}

export function DashboardTab({ summary, dailyActivity, topicProgress, hintStageUsage }: DashboardTabProps) {
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
  );
}
