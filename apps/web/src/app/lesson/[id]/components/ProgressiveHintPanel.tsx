"use client";

import React from "react";
import { RakkyoMascot } from "../../../dashboard/components/RakkyoMascot";
import { MathText } from "./MathText";
import { MathDiagram } from "./MathDiagram";

interface ProgressiveHintPanelProps {
  showHintPanel: boolean;
  setShowHintPanel: (show: boolean) => void;
  hintStage: 1 | 2 | 3;
  setHintStage: (stage: 1 | 2 | 3) => void;
  showFinalAnswer: boolean;
  setShowFinalAnswer: (show: boolean) => void;
  aiHints: { [key: number]: string };
  currentQuestion: any;
  isPlayingTts: string | null;
  speakText: (text: string, id: string) => void;
  isLoadingHint: boolean;
  subjectCode: string;
  mascotEmotion: 'normal' | 'correct' | 'incorrect' | 'happy';
  currentOutfit: string;
  chatHistory: Array<{ sender: "user" | "ai"; text: string }>;
  isSubmittingSpeech: boolean;
  isListening: boolean;
  speechText: string;
  setSpeechText: (text: string) => void;
  startListening: () => void;
  stopListening: () => void;
  submitVoiceQuestion: () => void;
}

export function ProgressiveHintPanel({
  showHintPanel,
  setShowHintPanel,
  hintStage,
  setHintStage,
  showFinalAnswer,
  setShowFinalAnswer,
  aiHints,
  currentQuestion,
  isPlayingTts,
  speakText,
  isLoadingHint,
  subjectCode,
  mascotEmotion,
  currentOutfit,
  chatHistory,
  isSubmittingSpeech,
  isListening,
  speechText,
  setSpeechText,
  startListening,
  stopListening,
  submitVoiceQuestion,
}: ProgressiveHintPanelProps) {
  if (!showHintPanel) {
    return (
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
    );
  }

  return (
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
          <RakkyoMascot emotion={mascotEmotion === 'normal' ? 'happy' : mascotEmotion} outfit={currentOutfit} className="w-full h-full" />
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
            <div className="flex items-center justify-between">
              <p className="text-3xs bg-pastel-blue text-pastel-blue-dark border border-pastel-blue-border font-extrabold rounded-full px-2 py-0.5 inline-block">
                ヒント①：問題のいいかえ
              </p>
              {aiHints[1] || currentQuestion.hints[0] ? (
                <button
                  onClick={() => speakText(aiHints[1] || currentQuestion.hints[0], "hint1")}
                  className={`text-3xs font-extrabold hover:underline cursor-pointer flex items-center gap-0.5 ${
                    isPlayingTts === "hint1" ? "text-pastel-pink-dark font-black animate-pulse" : "text-slate-400"
                  }`}
                >
                  {isPlayingTts === "hint1" ? "⏹️ とめる" : "🔊 きく"}
                </button>
              ) : null}
            </div>
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
            <div className="flex items-center justify-between">
              <p className="text-3xs bg-pastel-green text-pastel-green-dark border border-pastel-green-border font-extrabold rounded-full px-2 py-0.5 inline-block">
                ヒント②：考え方の図解
              </p>
              {aiHints[2] || currentQuestion.hints[1] ? (
                <button
                  onClick={() => speakText(aiHints[2] || currentQuestion.hints[1], "hint2")}
                  className={`text-3xs font-extrabold hover:underline cursor-pointer flex items-center gap-0.5 ${
                    isPlayingTts === "hint2" ? "text-pastel-pink-dark font-black animate-pulse" : "text-slate-400"
                  }`}
                >
                  {isPlayingTts === "hint2" ? "⏹️ とめる" : "🔊 きく"}
                </button>
              ) : null}
            </div>
            {hintStage === 2 && isLoadingHint && !aiHints[2] ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 font-bold py-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-pastel-green-border border-t-pastel-green-dark" />
                <span>ラッキョくんが考え中... 🧅</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-600 leading-relaxed">
                  {aiHints[2] || currentQuestion.hints[1]}
                </p>
                <div className="mt-2 animate-wiggle-once">
                  {subjectCode === "math" && <MathDiagram prompt={currentQuestion.prompt} explanation={currentQuestion.explanation} />}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage 3 Block */}
        {hintStage >= 3 && (
          <div className="bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-3xs bg-pastel-pink text-pastel-pink-dark border border-pastel-pink-border font-extrabold rounded-full px-2 py-0.5 inline-block">
                ヒント③：解き方のステップ
              </p>
              {aiHints[3] || currentQuestion.hints[2] ? (
                <button
                  onClick={() => speakText(aiHints[3] || currentQuestion.hints[2], "hint3")}
                  className={`text-3xs font-extrabold hover:underline cursor-pointer flex items-center gap-0.5 ${
                    isPlayingTts === "hint3" ? "text-pastel-pink-dark font-black animate-pulse" : "text-slate-400"
                  }`}
                >
                  {isPlayingTts === "hint3" ? "⏹️ とめる" : "🔊 きく"}
                </button>
              ) : null}
            </div>
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
              className="flex-1 py-3 bg-pastel-green border-2 border-pastel-green-border text-pastel-green-dark font-extrabold rounded-2xl text-2xs cursor-pointer hover:bg-emerald-100/50 transition-all text-center animate-wiggle-once"
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
            <div className="flex items-center justify-between">
              <p className="text-3xs bg-amber-500 text-white font-extrabold rounded-full px-2.5 py-0.5 inline-block">
                ていねいな解説・解答
              </p>
              <button
                onClick={() => speakText(currentQuestion.explanation, "explanation")}
                className={`text-3xs font-extrabold hover:underline cursor-pointer flex items-center gap-0.5 ${
                  isPlayingTts === "explanation" ? "text-pastel-pink-dark font-black animate-pulse" : "text-amber-600"
                }`}
              >
                {isPlayingTts === "explanation" ? "⏹️ とめる" : "🔊 きく"}
              </button>
            </div>
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

      {/* STT / Text Freeform Chat Area */}
      <div className="border-t border-slate-100 pt-4 mt-4 space-y-3">
        <h4 className="text-3xs font-extrabold text-slate-400 tracking-wider uppercase flex items-center gap-1">
          <span>🎙️</span> ラッキョくんとフリートーク
        </h4>
        
        {/* Chat dialogues log */}
        {chatHistory.length > 0 && (
          <div className="max-h-[160px] overflow-y-auto space-y-2 p-2 bg-slate-50 border border-slate-100 rounded-xl">
            {chatHistory.map((chat, idx) => (
              <div
                key={idx}
                className={`flex flex-col max-w-[85%] rounded-2xl p-2.5 text-2xs font-bold leading-relaxed ${
                  chat.sender === "user"
                    ? "bg-pastel-blue text-pastel-blue-dark ml-auto rounded-tr-none"
                    : "bg-white border border-pastel-purple-border text-slate-700 mr-auto rounded-tl-none bubbly-shadow-sm"
                }`}
              >
                <p>{chat.text}</p>
                {chat.sender === "ai" && (
                  <button
                    onClick={() => speakText(chat.text, `chat-${idx}`)}
                    className={`text-4xs font-extrabold mt-1 hover:underline text-left cursor-pointer inline-flex items-center gap-0.5 ${
                      isPlayingTts === `chat-${idx}` ? "text-pastel-pink-dark" : "text-slate-400"
                    }`}
                  >
                    {isPlayingTts === `chat-${idx}` ? "⏹️ とめる" : "🔊 きく"}
                  </button>
                )}
              </div>
            ))}
            {isSubmittingSpeech && (
              <div className="bg-white border border-slate-200 text-slate-400 rounded-2xl mr-auto rounded-tl-none p-2.5 text-2xs font-bold animate-pulse max-w-[85%]">
                ラッキョくんが回答を入力中... 🧅
              </div>
            )}
          </div>
        )}

        {/* Voice recording input & send forms */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={isListening ? stopListening : startListening}
              className={`p-3 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer bubbly-shadow text-2xs font-extrabold ${
                isListening
                  ? "bg-pastel-pink border-pastel-pink-border text-pastel-pink-dark animate-pulse scale-95"
                  : "bg-pastel-purple border-pastel-purple-border text-pastel-purple-dark hover:scale-[1.02]"
              }`}
              title={isListening ? "録音をとめる" : "こえで質問する"}
            >
              {isListening ? "⏹️ とめる" : "🎙️ こえで質問"}
            </button>
            <input
              type="text"
              value={speechText}
              onChange={(e) => setSpeechText(e.target.value)}
              placeholder={isListening ? "お話し中..." : "こえで話すか、ここに入力してね"}
              className="flex-1 px-3 py-2.5 border-2 border-slate-100 bg-slate-50/50 rounded-2xl text-2xs font-bold focus:border-pastel-purple-border focus:outline-none transition-all"
            />
          </div>

          {speechText.trim() && (
            <button
              onClick={submitVoiceQuestion}
              disabled={isSubmittingSpeech}
              className="w-full py-2 bg-pastel-blue border-2 border-pastel-blue-border text-pastel-blue-dark font-extrabold rounded-2xl text-2xs cursor-pointer hover:bg-sky-100/50 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed bubbly-shadow"
            >
              質問を送信する 🚀
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
