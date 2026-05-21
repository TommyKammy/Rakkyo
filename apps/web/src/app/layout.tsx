import type { Metadata } from "next";
import { Quicksand } from "next/font/google";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Rakkyo | ゲーム感覚で学ぶAI伴走型学習アプリ",
  description: "中学生がゲーム感覚で問題に取り組み、分からないところをAIにやさしく聞ける、音声・図解対応のAI伴走型学習アプリ。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${quicksand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF9F6] text-slate-800 font-sans">
        {children}
      </body>
    </html>
  );
}
