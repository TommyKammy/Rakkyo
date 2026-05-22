"use client";

import { useRouter } from "next/navigation";

export default function TermsPage() {
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
              Rakkyo 利用規約 🧅
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              さいごまでなかよく、あんぜんに使うためのお約束
            </p>
          </div>
        </div>

        {/* Scrollable Terms Content */}
        <div className="space-y-6 text-slate-600 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <p className="font-semibold text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            この利用規約（以下「本規約」）は、AI伴走型学習アプリ「Rakkyo」（以下「本サービス」）を利用するすべてのユーザー（以下「ユーザー」）と、本サービス運営との間のお約束を定めるものです。
            <br />
            <span className="text-red-500 font-bold">※ 中学生のみなさんは、保護者（お父さん・お母さんなど）といっしょに読んで、同意をもらってから使い始めてね！</span>
          </p>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-green-dark">◆</span> 1. 保護者の同意について
            </h2>
            <p className="pl-4">
              本サービスは中学生向けの学習支援を目的としています。未成年のユーザーがアカウント登録を行う際は、必ず保護者の方の同意を得たうえで登録してください。同意がない場合の利用はできません。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-pink-dark">◆</span> 2. AI学習アシスタント（AIチューター）の利用
            </h2>
            <p className="pl-4">
              本サービスでは、AI（人工知能）を活用した「AIヒント機能」を提供しています。
            </p>
            <ul className="list-disc pl-8 space-y-1">
              <li>AIには、個人情報（本名、住所、電話番号、学校名、メールアドレスなど）を絶対に入力しないでください。</li>
              <li>AIは学習をサポートするためのヒントを提供するものであり、常に100%正確な回答や結果を保証するものではありません。</li>
              <li>AIの回答を盲信せず、解説や教科書の内容もよく確認して学習を進めましょう。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-blue-dark">◆</span> 3. 禁止事項について
            </h2>
            <p className="pl-4">
              みんなが気持ちよく安全にお勉強できるように、以下の行為を禁止します。
            </p>
            <ul className="list-disc pl-8 space-y-1">
              <li>AIに対する罵倒、暴力的な言葉、性的な表現、その他不適切なメッセージの送信。</li>
              <li>お勉強に関係のないおしゃべりやゲームの要求、宿題の完全な代行を求める行為。</li>
              <li>短時間での大量の連投リクエストによる、システムへ大きな負荷を与える行為。</li>
              <li>他人のアカウントを無断で使ったり、不当にサービスを操作しようとする行為。</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-pastel-yellow-dark">◆</span> 4. AIリクエスト制限（コスト管理）
            </h2>
            <p className="pl-4">
              安定したサービス提供と適切な運営コスト維持のため、AIヒント機能の呼び出しには1ユーザーあたり1日あたりの回数制限（上限）を設けています。上限を超えた場合は、AIによる動的な会話の代わりに、問題にあらかじめ用意された「静的なヒント」が表示されます。日付が変わると再度AIヒントが使えるようになります。
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-extrabold text-base text-slate-800 flex items-center gap-1.5">
              <span className="text-slate-500">◆</span> 5. 免責事項
            </h2>
            <p className="pl-4">
              運営は本サービスにおいて発生した不具合の修正に努めますが、本サービスの利用による学習結果の向上を法的に保証するものではありません。また、本サービスに起因してユーザーに生じた損害について、運営の過失による場合を除き、一切の責任を負いません。
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
