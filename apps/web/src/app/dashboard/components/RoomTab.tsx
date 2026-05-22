"use client";

import React from "react";

interface ActiveMember {
  id: string;
  nickname: string;
  avatar: string;
  status: string;
  bubbleMessage: string;
  isOnline: boolean;
}

interface RoomData {
  classId: string;
  roomName: string;
  activeMembers: ActiveMember[];
}

interface RoomTabProps {
  missions: any[];
  roomData: RoomData | null;
  receivedStamps: any[];
  selectedFriendForStamp: string | null;
  setSelectedFriendForStamp: (id: string | null) => void;
  handleSendStamp: (receiverId: string, stampType: string) => Promise<void>;
  fetchRoomData: (token: string) => Promise<void>;
  isLoadingRoom: boolean;
}

export function RoomTab({
  missions,
  roomData,
  receivedStamps,
  selectedFriendForStamp,
  setSelectedFriendForStamp,
  handleSendStamp,
  fetchRoomData,
  isLoadingRoom,
}: RoomTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* クラス協力型ミッション進捗 (液体揺らぎ) */}
      {missions.map((mission) => {
        const percent = Math.min(100, Math.floor((mission.currentMinutes / mission.targetMinutes) * 100));
        return (
          <div key={mission.id} className="bg-gradient-to-r from-indigo-50/50 to-pastel-blue/30 border-3 border-indigo-200 rounded-3xl p-6 bubbly-shadow relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-2xs bg-indigo-600/10 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full font-extrabold tracking-wider">
                  🤝 クラス共習協力ミッション
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-800 mt-2">
                  {mission.title}
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  競争じゃないよ！クラスのみんなのがんばり勉強時間を合計して目標を突破しよう！
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-400 block">現在の達成率</span>
                <strong className="text-lg font-black text-indigo-600">{percent}%</strong>
              </div>
            </div>

            {/* 液体のように揺れるリッチなプログレスバー */}
            <div className="relative w-full h-16 bg-slate-100 border-3 border-indigo-200 rounded-3xl overflow-hidden bubbly-shadow">
              {/* Liquid background fill */}
              <div 
                style={{ height: `${percent}%` }}
                className="absolute bottom-0 left-0 right-0 bg-indigo-500/80 transition-all duration-1000 ease-out overflow-hidden"
              >
                {/* Waves inside fill */}
                <svg className="absolute -top-3 left-0 w-[200%] h-4 fill-indigo-500/90 liquid-wave-slow" viewBox="0 0 1200 120" preserveAspectRatio="none">
                  <path d="M0,60 C150,90 350,30 500,60 C650,90 850,30 1000,60 C1150,90 1350,30 1500,60 L1500,120 L0,120 Z" />
                </svg>
                <svg className="absolute -top-2 left-0 w-[200%] h-4 fill-indigo-400/70 liquid-wave-fast" viewBox="0 0 1200 120" preserveAspectRatio="none">
                  <path d="M0,50 C100,20 250,80 400,50 C550,20 700,80 850,50 C1000,20 1150,80 1300,50 L1300,120 L0,120 Z" />
                </svg>
              </div>
              
              {/* Floating particles inside progress bar */}
              <div className="absolute inset-0 flex items-center justify-between px-6 z-20 font-black text-xs">
                <span className="text-slate-700 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-indigo-100 shadow-2xs">
                  現在: {mission.currentMinutes} 分
                </span>
                <span className="text-slate-700 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-indigo-100 shadow-2xs">
                  目標: {mission.targetMinutes} 分
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* バーチャル学習室「ラッキョ・ルーム」 */}
      <div className="bg-white border-3 border-slate-100 rounded-3xl p-6 bubbly-shadow space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              🏠 {roomData?.roomName || "ラッキョ・ルーム"}
            </h3>
            <p className="text-xs text-slate-400 font-bold">
              クラスメイトをクリックすると、あきらめない姿勢を称える応援スタンプを送れるよ！
            </p>
          </div>
          <button 
            onClick={() => fetchRoomData(localStorage.getItem("rakkyo_token") || "")}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-2xl transition-all cursor-pointer text-xs font-bold"
          >
            🔄 ルームをこうしん
          </button>
        </div>

        {/* アバター浮遊アニメーションエリア */}
        <div className="bg-gradient-to-b from-slate-50 to-slate-100/30 rounded-3xl border-2 border-slate-100 p-6 md:p-8 min-h-[320px] flex flex-wrap items-center justify-center gap-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#6366f1 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }} />

          {roomData?.activeMembers && roomData.activeMembers.length > 0 ? (
            roomData.activeMembers.map((member, idx) => (
              <div key={member.id} className="relative flex flex-col items-center select-none group">
                {/* Animated Bubble Message */}
                <div className="mb-2 bg-white border-2 border-indigo-100 px-3.5 py-2.5 rounded-2xl bubbly-shadow max-w-[200px] text-center relative group-hover:scale-105 transition-transform animate-float-gentle" style={{ animationDelay: `${idx * 0.4}s` }}>
                  <p className="text-2xs text-slate-500 font-bold leading-relaxed">{member.bubbleMessage}</p>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-indigo-100 transform rotate-45" />
                </div>

                {/* Floating Classmate Avatar Wrapper */}
                <div 
                  onClick={() => setSelectedFriendForStamp(selectedFriendForStamp === member.id ? null : member.id)}
                  className={`w-20 h-20 rounded-full border-3 flex items-center justify-center text-4xl cursor-pointer bubbly-shadow transition-all duration-300 relative ${
                    member.isOnline 
                      ? "bg-emerald-50 border-emerald-300 hover:scale-110 ring-4 ring-emerald-100 animate-float"
                      : "bg-slate-100 border-slate-300 hover:scale-105 grayscale animate-bounce-gentle"
                  }`}
                  style={{ animationDelay: `${idx * 0.6}s` }}
                >
                  <span>{member.avatar}</span>
                  
                  {member.isOnline && (
                    <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
                  )}
                </div>

                <span className="mt-2 text-xs font-black text-slate-700">{member.nickname}</span>
                <span className="text-[10px] font-extrabold text-indigo-500">{member.status}</span>

                {/* Stamp Selector Popup */}
                {selectedFriendForStamp === member.id && (
                  <div className="absolute top-[80px] z-30 bg-white border-3 border-indigo-100 rounded-2xl p-3 bubbly-shadow-lg flex flex-col gap-2 w-44 animate-fade-in">
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                      <span className="text-3xs font-black text-slate-400">ピア応援を送る</span>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedFriendForStamp(null); }} className="text-slate-400 hover:text-slate-600 font-bold text-2xs cursor-pointer">❌</button>
                    </div>
                    <button onClick={() => handleSendStamp(member.id, "Grit! 💪")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5 w-full">
                      <span>💪</span> Grit! がんばれ！
                    </button>
                    <button onClick={() => handleSendStamp(member.id, "あきらめないね！ 🧅")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5 w-full">
                      <span>🧅</span> あきらめないね！
                    </button>
                    <button onClick={() => handleSendStamp(member.id, "ナイスひらめき！ 💡")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5 w-full">
                      <span>💡</span> ナイスひらめき！
                    </button>
                    <button onClick={() => handleSendStamp(member.id, "いっしょにがんばろう！ ✨")} className="py-1.5 hover:bg-slate-50 border border-slate-100 rounded-lg text-2xs font-extrabold text-left px-2 flex items-center gap-1.5 w-full">
                      <span>✨</span> いっしょにやろう！
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl">💭</span>
              <p className="text-xs text-slate-400 font-extrabold mt-2">メンバーはまだいません。</p>
            </div>
          )}
        </div>

        {/* 最近もらった応援スタンプ履歴 */}
        <div className="border-t-2 border-slate-100 pt-6">
          <h4 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-1.5">
            💌 届いたばかりの応援スタンプ ({receivedStamps.length})
          </h4>
          <div className="flex flex-wrap gap-3">
            {receivedStamps.length > 0 ? (
              receivedStamps.slice(0, 8).map((stamp, idx) => (
                <div key={stamp.id || idx} className="bg-indigo-50 border-2 border-indigo-100 rounded-2xl px-4 py-2.5 text-xs font-extrabold text-indigo-700 flex items-center gap-2 bubbly-shadow animate-fade-in">
                  <span className="text-base">🎉</span>
                  <span>
                    <strong>{stamp.senderNickname}</strong> から「{stamp.stampType}」スタンプ！
                  </span>
                  <span className="text-3xs text-slate-400 font-bold">
                    {new Date(stamp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 font-bold bg-slate-50 p-4 rounded-xl w-full text-center">
                まだスタンプは届いていません。となりのお友達に先に送ってみよう！🧅
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
