import React from "react";

interface WeeklyTabProps {
  weeklyHistory: {
    label: string;
    period: string;
    totalAttempts: number;
    accuracyRate: number;
    studyTimeMinutes: number;
    gritScore: number;
  }[];
}

export function WeeklyTab({ weeklyHistory }: WeeklyTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <h3 className="text-base font-bold text-slate-800 mb-2">📈 週次成長推移レポート</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          過去4週間分の学習記録を週単位で比較し、習慣の定着や進歩を前向きに可視化します。
        </p>
      </div>

      {/* Weekly comparison grid */}
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
  );
}
