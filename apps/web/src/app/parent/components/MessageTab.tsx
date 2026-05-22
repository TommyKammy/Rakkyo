import React from "react";

interface ParentMessage {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface MessageTabProps {
  messages: ParentMessage[];
  newMessageText: string;
  setNewMessageText: (text: string) => void;
  isSendingMessage: boolean;
  handleSendMessage: (e: React.FormEvent) => Promise<void>;
  messageToast: string;
}

export function MessageTab({
  messages,
  newMessageText,
  setNewMessageText,
  isSendingMessage,
  handleSendMessage,
  messageToast,
}: MessageTabProps) {
  return (
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
  );
}
