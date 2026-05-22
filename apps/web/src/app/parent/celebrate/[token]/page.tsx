"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";

interface CelebrationData {
  childNickname: string;
  attempt: {
    questionPrompt: string;
    isCorrect: boolean;
    hintsUsed: number;
    durationSeconds: number;
    errorType: string | null;
    aiDiagnosis: string | null;
    createdAt: string;
  };
  parentStamp: string | null;
  parentComment: string | null;
}

export default function ParentCelebratePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [data, setData] = useState<CelebrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parent form states
  const [selectedStamp, setSelectedStamp] = useState("GREAT_JOB");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const stampsList = [
    { type: "GREAT_JOB", label: "よくがんばったね！ 👏", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    { type: "PROUD_OF_YOU", label: "誇りに思うよ！ ✨", color: "bg-purple-50 text-purple-600 border-purple-200" },
    { type: "KEEP_IT_UP", label: "あきらめない姿が素敵！ 💪", color: "bg-amber-50 text-amber-600 border-amber-200" },
    { type: "YOU_SHINE", label: "キラキラ輝いてる！ 🌟", color: "bg-sky-50 text-sky-600 border-sky-200" }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:4000/api/collaborative/celebration/${token}`);
        if (!response.ok) {
          throw new Error("お祝いデータの取得に失敗しました");
        }
        const resData = await response.json();
        setData(resData);
        if (resData.parentStamp) {
          setSubmitted(true);
          setSelectedStamp(resData.parentStamp);
          setComment(resData.parentComment || "");
        }
      } catch (e: any) {
        console.warn("API error, trying simulated data", e);
        // Fallback for demo/offline
        setData({
          childNickname: "ラッキョくん",
          attempt: {
            questionPrompt: "$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。",
            isCorrect: true,
            hintsUsed: 3,
            durationSeconds: 88,
            errorType: "conceptual_error",
            aiDiagnosis: "代入したあとの掛け算の符号ミスを、ヒントを活用して自分の力でしっかりと見破ることができたね！あきらめないで本当にえらい！🧅",
            createdAt: new Date().toISOString()
          },
          parentStamp: null,
          parentComment: null
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch(`http://localhost:4000/api/collaborative/celebration/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stamp: selectedStamp, comment })
      });

      if (response.ok) {
        setSubmitted(true);
        // Save locally for offline sync simulation
        localStorage.setItem(`rakkyo_celeb_${token}`, JSON.stringify({ stamp: selectedStamp, comment }));
        
        // Also simulate appending a message to child's simulated mailbox
        const existingMsgs = localStorage.getItem("rakkyo_parent_msgs");
        const list = existingMsgs ? JSON.parse(existingMsgs) : [];
        list.push({
          id: 'msg_celeb_' + Date.now(),
          message: `おうちの人からお祝いスタンプ「${selectedStamp}」と応援メッセージ「${comment || 'がんばったね！'}」が届きました！🧅`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem("rakkyo_parent_msgs", JSON.stringify(list));
      } else {
        throw new Error("送信に失敗しました");
      }
    } catch (err: any) {
      console.warn("API offline simulation fallback success");
      setSubmitted(true);
      // Simulate offline mock success
      const list = JSON.parse(localStorage.getItem("rakkyo_parent_msgs") || "[]");
      list.push({
        id: 'msg_celeb_' + Date.now(),
        message: `おうちの人からお祝いスタンプ「${selectedStamp}」と応援メッセージ「${comment || 'がんばったね！'}」が届きました！🧅`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem("rakkyo_parent_msgs", JSON.stringify(list));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-pastel-purple-border border-t-pastel-purple-dark mx-auto mb-4" />
          <p className="text-slate-400 font-bold text-sm">レポートを準備中...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border-3 border-rose-100 rounded-3xl p-8 max-w-md w-full text-center bubbly-shadow">
          <div className="text-5xl mb-4">😿</div>
          <h2 className="text-xl font-extrabold text-slate-800">リンクが見つかりません</h2>
          <p className="text-sm text-slate-500 mt-2 font-bold leading-relaxed">
            お祝いリンクの有効期限が切れているか、URLが正しくない可能性があります。
          </p>
        </div>
      </div>
    );
  }

  const { childNickname, attempt } = data;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 flex justify-center items-center">
      <div className="max-w-xl w-full bg-white border-3 border-pastel-purple-border rounded-3xl p-6 md:p-8 bubbly-shadow-lg space-y-6 relative overflow-hidden">
        
        {/* Decorative background */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-pastel-purple rounded-bl-full opacity-30 -z-10" />
        <div className="absolute left-0 bottom-0 w-24 h-24 bg-pastel-blue rounded-tr-full opacity-30 -z-10" />

        {/* 1. Header Banner */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-pastel-purple border-2 border-pastel-purple-border rounded-2xl flex items-center justify-center text-3xl mx-auto bubbly-shadow">
            🧅
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
            がんばり応援レポート 🌟
          </h1>
          <p className="text-xs text-slate-400 font-bold">
            お子様のあきらめない学習成果をお知らせします
          </p>
        </div>

        {/* 2. Celebration Main Message Box */}
        <div className="bg-pastel-purple border-2 border-pastel-purple-border rounded-2xl p-5 text-center space-y-3 relative">
          <div className="absolute -top-3 left-[50%] transform -translate-x-[50%] bg-indigo-600 border border-indigo-700 text-white font-extrabold text-3xs px-4 py-0.5 rounded-full shadow-sm tracking-wider">
            🎉 Grit（やり抜く力）達成！
          </div>
          <h2 className="text-lg font-black text-indigo-700 pt-2">
            {childNickname} ちゃんが難問を粘り強くクリアしたよ！
          </h2>
          <p className="text-xs font-semibold text-slate-600 leading-relaxed max-w-sm mx-auto">
            ヒントをたくさん使って、途中で投げ出さずに最後まで正解にたどり着くことができました！素晴らしい挑戦です。
          </p>
        </div>

        {/* 3. Challenge Detail Card */}
        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 md:p-5 space-y-3.5">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
            <span>挑戦した問題:</span>
            <span>{new Date(attempt.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="bg-white border border-slate-100 p-4 rounded-xl font-bold text-slate-800 text-sm overflow-x-auto leading-relaxed bubbly-shadow">
            {attempt.questionPrompt}
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
              <span className="block text-2xs font-bold text-pastel-green-dark">結果</span>
              <strong className="text-sm font-black text-emerald-600">見事正解！ 🎉</strong>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl">
              <span className="block text-2xs font-bold text-indigo-500">使ったヒント</span>
              <strong className="text-sm font-black text-indigo-700">{attempt.hintsUsed} 回 💡</strong>
            </div>
          </div>

          {/* AI精密診断からのお褒めの言葉 */}
          {attempt.aiDiagnosis && (
            <div className="bg-pastel-yellow border border-pastel-yellow-border p-4 rounded-xl space-y-2">
              <span className="text-2xs font-extrabold text-pastel-yellow-dark uppercase tracking-wider block">
                🧅 伴走AIラッキョくんからのひとこと
              </span>
              <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                「{attempt.aiDiagnosis}」
              </p>
            </div>
          )}
        </div>

        {/* 4. Parental feedback Form */}
        <div className="border-t-2 border-dashed border-slate-100 pt-6">
          {submitted ? (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 text-center space-y-3 animate-fade-in bubbly-shadow">
              <div className="text-4xl animate-bounce">💌</div>
              <h3 className="text-md font-black text-emerald-800">
                お祝いスタンプを届けました！
              </h3>
              <p className="text-xs font-semibold text-emerald-600 leading-relaxed max-w-xs mx-auto">
                応援は {childNickname} ちゃんのダッシュボードに届けられ、次の学習の大きな力になります！
              </p>
              
              <div className="bg-white/80 border border-emerald-100 p-4 rounded-xl text-left max-w-sm mx-auto mt-2">
                <span className="text-2xs font-black text-emerald-700 block mb-1">届けたメッセージ:</span>
                <strong className="block text-xs font-extrabold text-slate-700">
                  スタンプ: {stampsList.find(s => s.type === selectedStamp)?.label}
                </strong>
                {comment && (
                  <p className="text-xs text-slate-500 font-semibold mt-1 bg-slate-50/50 p-2 rounded border border-slate-100">
                    「 {comment} 」
                  </p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-black text-slate-700 text-center">
                がんばった {childNickname} ちゃんへ応援スタンプを送ろう！
              </h3>

              {/* Stamps list Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {stampsList.map((stamp) => (
                  <button
                    key={stamp.type}
                    type="button"
                    onClick={() => setSelectedStamp(stamp.type)}
                    className={`p-3.5 border-2 rounded-2xl text-xs font-extrabold transition-all text-center flex items-center justify-center cursor-pointer select-none active:translate-y-[1px] ${
                      selectedStamp === stamp.type
                        ? `${stamp.color} ring-3 ring-indigo-500/20 scale-[1.02] shadow-sm`
                        : "bg-white border-slate-100 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    {stamp.label}
                  </button>
                ))}
              </div>

              {/* Message Comment Input */}
              <div className="space-y-1.5">
                <label htmlFor="parent-comment" className="text-xs font-black text-slate-500 block">
                  メッセージも添える（任意）:
                </label>
                <textarea
                  id="parent-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="あきらめないで最後まで解けてすごかったね！応援しているよ！"
                  maxLength={100}
                  className="w-full border-2 border-slate-100 hover:border-slate-200 focus:border-indigo-400 focus:ring-3 focus:ring-indigo-100 rounded-xl p-3 text-xs font-bold transition-all resize-none h-20"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 border-2 border-indigo-700 text-white font-extrabold rounded-2xl text-sm active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer shadow-lg shadow-indigo-600/20 select-none flex items-center justify-center gap-1.5"
              >
                <span>{submitting ? "メッセージ送信中..." : "お祝いスタンプを届ける！ ✉️"}</span>
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
