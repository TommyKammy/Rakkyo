"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { mathGrade1Curriculum } from "@rakkyo/curriculum";

// Styled Math Text Renderer to parse LaTeX variables dynamically and cleanly
function MathText({ text }: { text: string }) {
  if (!text) return null;
  
  const segments = text.split("$");
  
  return (
    <span className="leading-relaxed">
      {segments.map((segment, idx) => {
        // Odd segments are inside $...$ (math equations)
        if (idx % 2 === 1) {
          // Replace LaTeX operators with nice child-friendly Unicode equivalents
          let formatted = segment
            .replace(/\\times/g, " × ")
            .replace(/\\div/g, " ÷ ")
            .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2") // Simple fractions
            .replace(/\^3/g, "³")
            .replace(/\^2/g, "²")
            .replace(/\\text\{([^{}]+)\}/g, "$1"); // Clear text wrappers
            
          return (
            <span
              key={idx}
              className="font-serif italic font-bold text-pastel-purple-dark bg-pastel-purple px-2 py-0.5 rounded-lg mx-0.5 inline-block border border-pastel-purple-border"
            >
              {formatted}
            </span>
          );
        }
        return <span key={idx}>{segment}</span>;
      })}
    </span>
  );
}

interface UserProfile {
  id: string;
  nickname: string;
  level: number;
  currentXp: number;
  streakCount: number;
  badges?: string[];
  isMock?: boolean;
}

function ExerciseScreenContent() {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const isReview = searchParams?.get("review") === "true";
  const lessonIdStr = Array.isArray(id) ? id[0] : id;
  const lessonIndex = parseInt(lessonIdStr || "1") - 1;

  // Retrieve matching unit & lesson questions from the curriculum package
  const subject = mathGrade1Curriculum;
  const unit = subject.units[lessonIndex];
  const lesson = unit?.lessons[0];
  const questions = lesson?.questions || [];

  // User details
  const [user, setUser] = useState<UserProfile | null>(null);

  // Exercise states
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpTo, setLevelUpTo] = useState(0);

  // Timer state
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Progressive Hint states (S-007)
  const [showHintPanel, setShowHintPanel] = useState(false);
  const [hintStage, setHintStage] = useState<1 | 2 | 3>(1);
  const [showFinalAnswer, setShowFinalAnswer] = useState(false);
  const [aiHints, setAiHints] = useState<{ [key: number]: string }>({});
  const [isLoadingHint, setIsLoadingHint] = useState(false);

  const fetchHint = async (stageNum: 1 | 2 | 3) => {
    if (aiHints[stageNum]) return; // Already fetched

    const token = localStorage.getItem("rakkyo_token");
    if (!token || !questions[currentQIdx]) return;

    setIsLoadingHint(true);
    try {
      const q = questions[currentQIdx];
      const response = await fetch("http://localhost:4000/api/lessons/hint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          questionId: q.id || q.prompt,
          hintsUsed: stageNum - 1
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiHints(prev => ({ ...prev, [stageNum]: data.hintText }));
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch AI hint. Falling back to static curriculum hints.", e);
    } finally {
      setIsLoadingHint(false);
    }
  };

  useEffect(() => {
    if (showHintPanel) {
      fetchHint(hintStage);
    }
  }, [showHintPanel, hintStage, currentQIdx]);

  useEffect(() => {
    // Reset timer when question index changes
    setStartTime(Date.now());
  }, [currentQIdx]);

  useEffect(() => {
    const token = localStorage.getItem("rakkyo_token");
    const userStr = localStorage.getItem("rakkyo_user");

    if (!token || !userStr || !unit || !lesson) {
      router.push("/math");
      return;
    }

    try {
      setUser(JSON.parse(userStr));
    } catch (e) {
      router.push("/");
    }
  }, [router, lessonIndex, unit, lesson]);

  if (!user || questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-pastel-blue-border border-t-pastel-blue-dark" />
      </div>
    );
  }

  const currentQuestion = questions[currentQIdx];

  const handleCheckAnswer = async () => {
    if (isChecked) return;

    let submitted = "";
    if (currentQuestion.type === "MULTIPLE_CHOICE" || currentQuestion.type === "SINGLE_CHOICE") {
      if (!selectedOption) return;
      submitted = selectedOption.trim();
    } else {
      if (!textAnswer.trim()) return;
      submitted = textAnswer.trim();
    }

    const token = localStorage.getItem("rakkyo_token");
    const hintsUsed = showHintPanel ? hintStage : 0;
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    // Check locally first for instant evaluation/fallback
    const isAnsCorrect = currentQuestion.answers.some(
      (ans) => ans.toLowerCase().trim() === submitted.toLowerCase().trim()
    );

    setIsCorrect(isAnsCorrect);
    setIsChecked(true);

    if (token) {
      try {
        const response = await fetch("http://localhost:4000/api/lessons/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            questionId: currentQuestion.id || currentQuestion.prompt,
            answerSubmitted: submitted,
            hintsUsed,
            durationSeconds,
            isReview
          })
        });

        if (response.ok) {
          const data = await response.json();
          setIsCorrect(data.isCorrect);

          if (data.leveledUp) {
            setLevelUpTo(data.user.level);
            setShowLevelUpModal(true);
          }

          setUser(data.user);
          localStorage.setItem("rakkyo_user", JSON.stringify(data.user));
          return;
        }
      } catch (error) {
        console.warn("⚠️ API submission failed. Falling back to offline client-side evaluation.", error);
      }
    }

    // Local fallback evaluation (offline mode)
    if (isAnsCorrect) {
      // Award XP (+25 XP for review, +10 XP normally)
      const xpAwarded = isReview ? 25 : 10;
      const updatedUser = { ...user };
      updatedUser.currentXp += xpAwarded;

      // Check level up: Level * 100 XP threshold
      let xpNeeded = updatedUser.level * 100;
      while (updatedUser.currentXp >= xpNeeded) {
        updatedUser.currentXp -= xpNeeded;
        updatedUser.level += 1;
        setLevelUpTo(updatedUser.level);
        setShowLevelUpModal(true);
        xpNeeded = updatedUser.level * 100;
      }

      setUser(updatedUser);
      localStorage.setItem("rakkyo_user", JSON.stringify(updatedUser));
    }
  };

  const handleNextQuestion = () => {
    // Clear question states
    setSelectedOption(null);
    setTextAnswer("");
    setIsChecked(false);
    setIsCorrect(false);
    setShowHintPanel(false);
    setHintStage(1);
    setShowFinalAnswer(false);
    setAiHints({});

    if (currentQIdx + 1 < questions.length) {
      setCurrentQIdx(currentQIdx + 1);
    } else {
      // Cleared entire unit lesson!
      setShowClearModal(true);
    }
  };

  const handleCloseClearModal = () => {
    setShowClearModal(false);
    router.push("/math");
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6 select-none relative">
      
      {/* Background blobs */}
      <div className="absolute top-[20%] left-[-5%] w-[30%] h-[30%] rounded-full bg-pastel-pink opacity-30 blur-3xl -z-10" />
      <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-pastel-blue opacity-30 blur-3xl -z-10" />

      {/* 1. Header (Navigation & Progress tracker) */}
      <header className="bg-white border-3 border-slate-100 rounded-3xl p-4 flex items-center justify-between gap-4 bubbly-shadow">
        <button
          onClick={() => router.push("/math")}
          className="px-4 py-2 bg-slate-50 border-2 border-slate-200 text-slate-500 font-extrabold rounded-2xl text-xs hover:bg-slate-100 active:translate-y-[2px] transition-all cursor-pointer bubbly-shadow"
        >
          ◀ 地図にもどる
        </button>

        {/* Progress Tracker bar */}
        <div className="flex-1 max-w-md mx-6 space-y-1 hidden sm:block">
          <div className="flex items-center justify-between text-2xs font-extrabold text-slate-400">
            <span>単元のしんちょく</span>
            <span>{currentQIdx + 1} / {questions.length} 問</span>
          </div>
          <div className="h-4 w-full bg-slate-100 border border-slate-200 rounded-full p-0.5 overflow-hidden">
            <div
              style={{ width: `${((currentQIdx + 1) / questions.length) * 100}%` }}
              className="h-full bg-pastel-green-dark rounded-full transition-all duration-300"
            />
          </div>
        </div>

        <div className="h-8 px-3 bg-pastel-purple border border-pastel-purple-border text-pastel-purple-dark font-extrabold rounded-xl flex items-center text-xs">
          Lv. {user.level}
        </div>
      </header>

      {/* 2. Main Area (Question vs Hint Panel side-by-side) */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left 2 Columns: Solving Board */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border-3 border-slate-100 rounded-3xl p-6 sm:p-8 bubbly-shadow space-y-6 relative overflow-hidden">
            
            {/* Corner visual sticker */}
            <div className="absolute top-0 right-0 bg-pastel-pink border-b-3 border-l-3 border-slate-100 px-4 py-1.5 rounded-bl-2xl text-2xs font-extrabold text-pastel-pink-dark">
              もんだい {currentQIdx + 1}
            </div>

            {/* Question Text */}
            <div className="pt-2 text-base sm:text-lg font-bold text-slate-700 tracking-wide leading-relaxed">
              <MathText text={currentQuestion.prompt} />
            </div>

            {/* Answer Input Cards */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              
              {/* MULTIPLE CHOICE GRID */}
              {(currentQuestion.type === "MULTIPLE_CHOICE" || currentQuestion.type === "SINGLE_CHOICE") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentQuestion.options.map((opt, idx) => (
                    <button
                      key={idx}
                      disabled={isChecked}
                      onClick={() => setSelectedOption(opt)}
                      className={`p-4 border-3 rounded-2xl text-sm font-extrabold text-left transition-all bubbly-shadow flex items-center gap-3 select-none ${
                        selectedOption === opt
                          ? "bg-pastel-blue border-pastel-blue-dark text-pastel-blue-dark scale-[1.01]"
                          : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100/50 cursor-pointer"
                      } ${isChecked ? "opacity-75 cursor-not-allowed" : ""}`}
                    >
                      <span className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-400 font-extrabold">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* NUMBER INPUT / FILL IN BLANK */}
              {currentQuestion.type !== "MULTIPLE_CHOICE" && currentQuestion.type !== "SINGLE_CHOICE" && (
                <div>
                  <label className="block text-2xs font-extrabold text-slate-400 mb-2 ml-1">
                    こたえをここに入力してね
                  </label>
                  <input
                    type="text"
                    disabled={isChecked}
                    placeholder={
                      currentQuestion.type === "NUMBER_INPUT" || currentQuestion.type === "NUMERIC"
                        ? "例: -2 (半角で入力してね)"
                        : "例: -4x-3 (文字と式のルールを守って入力してね)"
                    }
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    className="w-full max-w-md px-4 py-4.5 rounded-2xl border-3 border-slate-100 bg-slate-50/50 text-base font-bold focus:border-pastel-blue-border focus:outline-none transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                </div>
              )}

            </div>

            {/* Response Alerts after validation */}
            {isChecked && (
              <div className={`border-3 p-5 rounded-3xl flex items-center gap-4 ${
                isCorrect
                  ? "bg-pastel-green border-pastel-green-border text-pastel-green-dark"
                  : "bg-pastel-pink border-pastel-pink-border text-pastel-pink-dark"
              }`}>
                <span className="text-3xl select-none">{isCorrect ? "🎉" : "😭"}</span>
                <div>
                  <h4 className="font-extrabold text-sm">
                    {isCorrect ? "正解！すごすぎる！" : "おしい！ちがうみたい..."}
                  </h4>
                  <p className="text-xs font-semibold mt-1 opacity-90 leading-relaxed">
                    {isCorrect
                      ? "この調子で次の問題もクリアして、XPをたくさん集めよう！"
                      : "大丈夫だよ！となりのラッキョくんにヒントを聞いてみよう！"}
                  </p>
                </div>
              </div>
            )}

            {/* Control Panel Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-6">
              
              {/* Helper trigger */}
              <button
                onClick={() => setShowHintPanel(true)}
                className="w-full sm:w-auto px-6 py-3.5 bg-pastel-purple border-2 border-pastel-purple-border text-pastel-purple-dark font-extrabold rounded-2xl text-xs hover:bg-indigo-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                🤖 ラッキョくんにヒントを聞く
              </button>

              <div className="flex w-full sm:w-auto gap-4">
                {isChecked ? (
                  <button
                    onClick={handleNextQuestion}
                    className="w-full sm:w-40 py-3.5 bg-pastel-blue border-3 border-pastel-blue-border text-pastel-blue-dark font-extrabold rounded-2xl text-sm hover:bg-sky-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
                  >
                    次の問題へ 🚀
                  </button>
                ) : (
                  <button
                    onClick={handleCheckAnswer}
                    disabled={
                      currentQuestion.type === "MULTIPLE_CHOICE" || currentQuestion.type === "SINGLE_CHOICE"
                        ? !selectedOption
                        : !textAnswer.trim()
                    }
                    className="w-full sm:w-40 py-3.5 bg-pastel-green border-3 border-pastel-green-border text-pastel-green-dark font-extrabold rounded-2xl text-sm hover:bg-emerald-100/50 active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed transition-all bubbly-shadow cursor-pointer select-none"
                  >
                    できた！答え合わせ ✨
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Right 1 Column: S-007 AI Hint Panel */}
        <div className="space-y-6">
          {showHintPanel ? (
            <div className="bg-white border-3 border-pastel-purple-border rounded-3xl p-6 bubbly-shadow space-y-5 animate-wiggle-once relative">
              
              {/* Top title */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-extrabold text-pastel-purple-dark tracking-tight flex items-center gap-1.5">
                  🤖 ラッキョくんのヒント
                </h3>
                <button
                  onClick={() => setShowHintPanel(false)}
                  className="text-xs text-slate-400 font-bold hover:text-slate-600 cursor-pointer"
                >
                  とじる
                </button>
              </div>

              {/* Character widget */}
              <div className="flex items-center gap-3 bg-pastel-purple border border-pastel-purple-border p-3.5 rounded-2xl">
                <div className="w-12 h-12 flex-shrink-0 animate-bounce-gentle">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <path
                      d="M50,15 C28,30 25,65 30,80 C34,92 66,92 70,80 C75,65 72,30 50,15 Z"
                      fill="#F7FEE7"
                      stroke="#A3E635"
                      strokeWidth="4"
                    />
                    <path
                      d="M50,15 Q40,2 43,0 Q47,5 50,15 Z"
                      fill="#4ADE80"
                      stroke="#22C55E"
                      strokeWidth="2.5"
                    />
                    <path
                      d="M50,15 Q60,2 57,0 Q53,5 50,15 Z"
                      fill="#4ADE80"
                      stroke="#22C55E"
                      strokeWidth="2.5"
                    />
                    {/* Little study hat */}
                    <path d="M40,24 L60,24 L50,12 Z" fill="#7C3AED" stroke="#4C1D95" strokeWidth="2" />
                    {/* Shiny Eyes */}
                    <circle cx="40" cy="58" r="4.5" fill="#1E293B" />
                    <circle cx="38.5" cy="56.5" r="1.5" fill="#FFFFFF" />
                    <circle cx="60" cy="58" r="4.5" fill="#1E293B" />
                    <circle cx="58.5" cy="56.5" r="1.5" fill="#FFFFFF" />
                    <circle cx="34" cy="66" r="4" fill="#FBCFE8" />
                    <circle cx="66" cy="66" r="4" fill="#FBCFE8" />
                    {/* Smile */}
                    <path
                      d="M48,68 Q50,71 52,68"
                      fill="none"
                      stroke="#1E293B"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="text-2xs font-extrabold text-pastel-purple-dark leading-relaxed">
                  「あきらめないで！ヒントを順番に見ていくと、ひらめくかも！」
                </div>
              </div>

              {/* Progressive Hint Drawer (Strict 3 Stages) */}
              <div className="space-y-4">
                
                {/* Stage 1 Block */}
                {hintStage >= 1 && (
                  <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl space-y-1.5">
                    <p className="text-3xs bg-pastel-blue text-pastel-blue-dark border border-pastel-blue-border font-extrabold rounded-full px-2 py-0.5 inline-block">
                      ヒント①：問題のいいかえ
                    </p>
                    {hintStage === 1 && isLoadingHint && !aiHints[1] ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold py-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-pastel-blue-border border-t-pastel-blue-dark" />
                        <span>ラッキョくんが考え中... 🧅</span>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-600 leading-relaxed">
                        {aiHints[1] || currentQuestion.hints[0]}
                      </p>
                    )}
                  </div>
                )}

                {/* Stage 2 Block */}
                {hintStage >= 2 && (
                  <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl space-y-1.5">
                    <p className="text-3xs bg-pastel-green text-pastel-green-dark border border-pastel-green-border font-extrabold rounded-full px-2 py-0.5 inline-block">
                      ヒント②：考え方の図解
                    </p>
                    {hintStage === 2 && isLoadingHint && !aiHints[2] ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold py-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-pastel-green-border border-t-pastel-green-dark" />
                        <span>ラッキョくんが考え中... 🧅</span>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-600 leading-relaxed">
                        {aiHints[2] || currentQuestion.hints[1]}
                      </p>
                    )}
                  </div>
                )}

                {/* Stage 3 Block */}
                {hintStage >= 3 && (
                  <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl space-y-1.5">
                    <p className="text-3xs bg-pastel-pink text-pastel-pink-dark border border-pastel-pink-border font-extrabold rounded-full px-2 py-0.5 inline-block">
                      ヒント③：解き方のステップ
                    </p>
                    {hintStage === 3 && isLoadingHint && !aiHints[3] ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-bold py-2">
                        <span className="animate-spin rounded-full h-4 w-4 border-2 border-pastel-pink-border border-t-pastel-pink-dark" />
                        <span>ラッキョくんが考え中... 🧅</span>
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-slate-600 leading-relaxed">
                        {aiHints[3] || currentQuestion.hints[2]}
                      </p>
                    )}
                  </div>
                )}

                {/* Progressive unlocks */}
                <div className="flex gap-2">
                  {hintStage === 1 && (
                    <button
                      onClick={() => setHintStage(2)}
                      className="flex-1 py-3 bg-pastel-green border-2 border-pastel-green-border text-pastel-green-dark font-extrabold rounded-2xl text-2xs cursor-pointer hover:bg-emerald-100/50 transition-all text-center"
                    >
                      次のヒントをみる 🔍
                    </button>
                  )}
                  {hintStage === 2 && (
                    <button
                      onClick={() => setHintStage(3)}
                      className="flex-1 py-3 bg-pastel-pink border-2 border-pastel-pink-border text-pastel-pink-dark font-extrabold rounded-2xl text-2xs cursor-pointer hover:bg-pink-100/50 transition-all text-center"
                    >
                      さいごのヒントをみる 📚
                    </button>
                  )}
                  {hintStage === 3 && !showFinalAnswer && (
                    <button
                      onClick={() => setShowFinalAnswer(true)}
                      className="flex-1 py-3 bg-pastel-yellow border-2 border-pastel-yellow-border text-pastel-yellow-dark font-extrabold rounded-2xl text-2xs cursor-pointer hover:bg-yellow-100/50 transition-all text-center animate-pulse"
                    >
                      解説と答えをすべてみる 💡
                    </button>
                  )}
                </div>

                {/* Final Explanation Spoiler Reveal Block */}
                {showFinalAnswer && (
                  <div className="bg-pastel-yellow border-2 border-pastel-yellow-border p-4 rounded-2xl space-y-2.5">
                    <p className="text-3xs bg-amber-500 text-white font-extrabold rounded-full px-2.5 py-0.5 inline-block">
                      ていねいな解説・解答
                    </p>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                      <MathText text={currentQuestion.explanation} />
                    </p>
                    <div className="text-xs font-extrabold text-amber-700 border-t border-amber-200/50 pt-2 flex items-center gap-1">
                      <span>🔑 正しい答え:</span>
                      <span className="bg-white border border-amber-300 px-2 py-0.5 rounded-lg">
                        {currentQuestion.answers.join(" または ")}
                      </span>
                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="bg-pastel-purple/50 border-3 border-dashed border-pastel-purple-border rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px] select-none">
              <span className="text-5xl animate-bounce-gentle">🤖</span>
              <div>
                <h4 className="font-extrabold text-sm text-pastel-purple-dark">
                  ラッキョくんがお手伝い！
                </h4>
                <p className="text-xs font-semibold text-slate-400 mt-1 leading-relaxed max-w-[200px]">
                  問題がわからなくて困ったら、「ヒントを聞く」ボタンを押してね！
                </p>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* 3. Level Up Congratulatory Modal Animation Overlay */}
      {showLevelUpModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
          <div className="bg-white border-4 border-pastel-purple-border rounded-3xl p-8 max-w-sm w-full text-center bubbly-shadow-lg relative overflow-hidden animate-wiggle-once">
            {/* Ribbon Background Sparkles */}
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-pastel-purple-dark via-pastel-pink-dark to-pastel-blue-dark" />
            
            <span className="text-6xl inline-block mb-4 animate-bounce-gentle">👑</span>
            
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              レベルアップ！
            </h3>
            
            <div className="my-6 inline-flex items-center gap-3 bg-pastel-purple border-2 border-pastel-purple-border px-5 py-2.5 rounded-2xl text-pastel-purple-dark font-extrabold text-xl bubbly-shadow-md">
              Lv. {levelUpTo - 1} ➔ Lv. {levelUpTo}
            </div>

            <p className="text-xs font-bold text-slate-500 leading-relaxed mb-6">
              すごいよ！どんどん算数マスターに近づいてる！ラッキョくんも大よろこび！
            </p>

            <button
              onClick={() => setShowLevelUpModal(false)}
              className="w-full py-3.5 bg-pastel-purple border-3 border-pastel-purple-border text-pastel-purple-dark font-extrabold rounded-2xl text-sm hover:bg-indigo-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
            >
              冒険をつづける！ ✨
            </button>
          </div>
        </div>
      )}

      {/* 4. Lesson Complete Congratulatory Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none">
          <div className="bg-white border-4 border-pastel-green-border rounded-3xl p-8 max-w-sm w-full text-center bubbly-shadow-lg relative overflow-hidden animate-bounce-gentle">
            <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-pastel-green-dark via-pastel-yellow-dark to-pastel-blue-dark" />
            
            <span className="text-6xl inline-block mb-4">{isReview ? "🔥" : "🏆"}</span>
            
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              {isReview ? "復習ミッションクリア！" : "レッスンクリア！"}
            </h3>
            
            <p className="text-xs font-bold text-slate-500 leading-relaxed my-4">
              {isReview
                ? "すごい！苦手な問題をみごとにやっつけたよ！ラッキョくんも大いばり！"
                : `おめでとう！単元すべての問題（${questions.length}問）をみごとにクリアしたよ！`}
            </p>

            <div className="bg-pastel-green border-2 border-pastel-green-border rounded-2xl p-4 flex flex-col items-center justify-center mb-6 bubbly-shadow-md">
              <span className="text-2xs font-extrabold text-pastel-green-dark tracking-wide">
                クリア報酬
              </span>
              <span className="text-xl font-extrabold text-slate-700 mt-1">
                {isReview ? "+15 XP ボーナス獲得！" : "+100 XP 獲得！"}
              </span>
            </div>

            <button
              onClick={handleCloseClearModal}
              className="w-full py-4 bg-pastel-green border-3 border-pastel-green-border text-pastel-green-dark font-extrabold rounded-2xl text-base hover:bg-emerald-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
            >
              {isReview ? "ダッシュボードにもどる 🏠" : "地図にもどる 🗺️"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ExerciseScreen() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-pastel-blue-border border-t-pastel-blue-dark" />
        </div>
      }
    >
      <ExerciseScreenContent />
    </Suspense>
  );
}
