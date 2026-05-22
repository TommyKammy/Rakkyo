import React from "react";

interface WeaknessTabProps {
  weakestUnits: {
    unitName: string;
    weakestScore: number;
    accuracyRate: number;
    avgHintsUsed: number;
    retryCount: number;
    reason: string;
  }[];
}

export function WeaknessTab({ weakestUnits }: WeaknessTabProps) {
  return (
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
  );
}
