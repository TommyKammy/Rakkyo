"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden select-none">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-10%] w-[35%] h-[35%] rounded-full bg-pastel-pink opacity-40 blur-3xl -z-10" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-pastel-blue opacity-40 blur-3xl -z-10" />

      <div className="w-full max-w-2xl bg-white border-4 border-slate-100 rounded-3xl p-8 md:p-10 bubbly-shadow-lg relative z-10">
        
        {/* Mascot & Title */}
        <div className="flex items-center gap-4 mb-6 border-b-2 border-slate-50 pb-6">
          <div className="w-16 h-16 flex-shrink-0">
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
              <circle cx="38" cy="66" r="6" fill="#FBCFE8" />
              <circle cx="62" cy="66" r="6" fill="#FBCFE8" />
              <circle cx="40" cy="58" r="4.5" fill="#1E293B" />
              <circle cx="38.5" cy="56.5" r="1.5" fill="#FFFFFF" />
              <circle cx="60" cy="58" r="4.5" fill="#1E293B" />
              <circle cx="58.5" cy="56.5" r="1.5" fill="#FFFFFF" />
              <path
                d="M47,67 Q50,71 53,67"
                fill="none"
                stroke="#1E293B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              プライバシーポリシー 🧅
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              お預かりする大切な情報と、安全管理についてのお知らせ
            </p>
          </div>
        </div>

        {/* Scrollable Privacy Content */}
        <div className="space-y-6 text-slate-600 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <p className="font-semibold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            本サービスは、ユーザーおよび保護者の方からお預かりする個人情報について、個人情報保護法その他の関係法令を遵守し、以下の方針に従って適切に取り扱います。
          </p>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-green-dark">◆</span> 1. 取得する情報
            </h2>
            <p className="pl-4">
              本サービスでは、以下の情報を取得し、記録します。
            </p>
            <ul className="list-disc pl-8 space-y-1">
              <li>アカウント登録情報（メールアドレス、パスワード、ニックネーム、学年）</li>
              <li>学習履歴情報（問題の解答状況、正誤、解答にかかった時間、ヒントの使用回数）</li>
              <li>AI対話情報（AIヒントを呼び出す際に入力された任意の質問テキスト）</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-pink-dark">◆</span> 2. 情報の利用目的
            </h2>
            <p className="pl-4">
              取得した情報は、以下の目的のためにのみ利用いたします。
            </p>
            <ul className="list-disc pl-8 space-y-1">
              <li>本サービスを通じた学習支援および問題演習機能の提供。</li>
              <li>保護者用レポート画面（学習進捗、得意・苦手傾向の可視化）の作成・提供。</li>
              <li>AIによる質問応答の最適化、キャラクター対話の質向上。</li>
              <li>サービスの改善、不具合の調査、および不正利用（いたずら等の連投）の防止。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-blue-dark">◆</span> 3. AI連携時における個人情報の保護（PII除去）
            </h2>
            <p className="pl-4">
              AI（人工知能）へ学習の質問を送信する際、ユーザーのプライバシーを保護するため、送信前にシステム側で自動的な安全フィルターを適用します。
              ユーザーが入力した質問文に名前、メールアドレス、電話番号などの個人を特定できる情報が含まれる場合は、AIへ送信される前に **自動的に黒塗り（Redact）され、匿名化** されます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-yellow-dark">◆</span> 4. データの保存期間と削除について
            </h2>
            <p className="pl-4">
              取得した学習履歴およびアカウント情報は、本サービスの提供期間中、安全に保存されます。保護者の方は、運営にお申し出いただくことで、いつでもお子様のアカウント情報およびこれに関連する学習データを完全に削除（退会処理）することができます。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-slate-500">◆</span> 5. 安全管理措置
            </h2>
            <p className="pl-4">
              私たちは、お預かりしたデータの漏洩、滅失、または毀損を防ぐため、アクセス制御やデータの暗号化を含む必要かつ適切な安全管理措置を講じています。
            </p>
          </section>
        </div>

        {/* Back button */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center">
          <button
            onClick={() => router.push("/")}
            className="px-8 py-3.5 bg-pastel-blue border-3 border-pastel-blue-border text-pastel-blue-dark font-extrabold rounded-2xl text-sm hover:bg-sky-100/50 active:translate-y-[2px] transition-all bubbly-shadow cursor-pointer select-none"
          >
            ログイン画面へ戻る 🧅
          </button>
        </div>
      </div>
    </div>
  );
}
