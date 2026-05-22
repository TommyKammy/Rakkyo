"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Mock Data for Fallback/Demo Mode
const MOCK_CLASSES = [
  { id: "test-class-id", name: "中1数学特訓クラス", grade: 1 },
  { id: "test-class-id-2", name: "中1数学基礎クラス", grade: 1 }
];

const MOCK_STUDENTS = [
  {
    id: "test-student-id",
    nickname: "ラッキョくん",
    email: "student@rakkyo.com",
    schoolYear: 1,
    level: 2,
    currentXp: 45,
    streakCount: 3,
    stats: { totalAttempts: 10, accuracy: 80 }
  },
  {
    id: "demo-student-2",
    nickname: "タローくん",
    email: "taro@rakkyo.com",
    schoolYear: 1,
    level: 3,
    currentXp: 120,
    streakCount: 5,
    stats: { totalAttempts: 15, accuracy: 93 }
  },
  {
    id: "demo-student-3",
    nickname: "ハナちゃん",
    email: "hana@rakkyo.com",
    schoolYear: 1,
    level: 2,
    currentXp: 80,
    streakCount: 0,
    stats: { totalAttempts: 8, accuracy: 62 }
  }
];

const MOCK_STUDENT_STATS: Record<string, any> = {
  "test-student-id": {
    summary: {
      totalActiveDays: 5,
      totalAttempts: 10,
      correctAttempts: 8,
      accuracyRate: 80,
      totalHintsUsed: 14,
      gritScore: 75,
      totalStudyTimeMinutes: 28,
    },
    dailyActivity: [
      { date: "05-16", attemptsCount: 2, correctCount: 2, hintsCount: 1 },
      { date: "05-17", attemptsCount: 2, correctCount: 1, hintsCount: 5 },
      { date: "05-18", attemptsCount: 2, correctCount: 2, hintsCount: 3 },
      { date: "05-19", attemptsCount: 2, correctCount: 1, hintsCount: 4 },
      { date: "05-20", attemptsCount: 2, correctCount: 2, hintsCount: 1 },
    ],
    topicProgress: [
      { unitName: "正負の数", totalQuestions: 10, attemptsCount: 8, correctCount: 7, accuracyRate: 88, isCompleted: true },
      { unitName: "文字と式", totalQuestions: 10, attemptsCount: 2, correctCount: 1, accuracyRate: 50, isCompleted: false },
    ],
    hintStageUsage: { stage1: 8, stage2: 4, stage3: 2 },
    weakestUnits: [
      {
        unitName: "文字と式",
        weakestScore: 68,
        accuracyRate: 50,
        avgHintsUsed: 1.5,
        retryCount: 1,
        reason: "正答率が 50% と少し低めになっており、文字の代入や計算規則でつまずきがあるかもしれません。"
      },
      {
        unitName: "正負の数",
        weakestScore: 42,
        accuracyRate: 88,
        avgHintsUsed: 1.9,
        retryCount: 2,
        reason: "正答率は高いですが、3段階ヒントを多く活用して慎重に進めている様子が見られます。"
      }
    ]
  },
  "demo-student-2": {
    summary: {
      totalActiveDays: 6,
      totalAttempts: 15,
      correctAttempts: 14,
      accuracyRate: 93,
      totalHintsUsed: 5,
      gritScore: 100,
      totalStudyTimeMinutes: 35,
    },
    dailyActivity: [
      { date: "05-16", attemptsCount: 3, correctCount: 3, hintsCount: 1 },
      { date: "05-17", attemptsCount: 2, correctCount: 2, hintsCount: 0 },
      { date: "05-18", attemptsCount: 4, correctCount: 3, hintsCount: 2 },
      { date: "05-19", attemptsCount: 2, correctCount: 2, hintsCount: 1 },
      { date: "05-20", attemptsCount: 4, correctCount: 4, hintsCount: 1 },
    ],
    topicProgress: [
      { unitName: "正負の数", totalQuestions: 10, attemptsCount: 10, correctCount: 10, accuracyRate: 100, isCompleted: true },
      { unitName: "文字と式", totalQuestions: 10, attemptsCount: 5, correctCount: 4, accuracyRate: 80, isCompleted: true },
    ],
    hintStageUsage: { stage1: 3, stage2: 1, stage3: 1 },
    weakestUnits: []
  },
  "demo-student-3": {
    summary: {
      totalActiveDays: 3,
      totalAttempts: 8,
      correctAttempts: 5,
      accuracyRate: 62,
      totalHintsUsed: 12,
      gritScore: 40,
      totalStudyTimeMinutes: 20,
    },
    dailyActivity: [
      { date: "05-16", attemptsCount: 0, correctCount: 0, hintsCount: 0 },
      { date: "05-17", attemptsCount: 3, correctCount: 2, hintsCount: 4 },
      { date: "05-18", attemptsCount: 2, correctCount: 1, hintsCount: 5 },
      { date: "05-19", attemptsCount: 3, correctCount: 2, hintsCount: 3 },
      { date: "05-20", attemptsCount: 0, correctCount: 0, hintsCount: 0 },
    ],
    topicProgress: [
      { unitName: "正負の数", totalQuestions: 10, attemptsCount: 5, correctCount: 3, accuracyRate: 60, isCompleted: false },
      { unitName: "文字と式", totalQuestions: 10, attemptsCount: 3, correctCount: 2, accuracyRate: 66, isCompleted: false },
    ],
    hintStageUsage: { stage1: 6, stage2: 4, stage3: 2 },
    weakestUnits: [
      {
        unitName: "正負の数",
        weakestScore: 75,
        accuracyRate: 60,
        avgHintsUsed: 2.4,
        retryCount: 0,
        reason: "正答率が 60% と低く、さらにヒントをすべて見ても解法にたどり着けていない様子が見られます。個別の解説が必要です。"
      }
    ]
  }
};

const MOCK_ASSIGNMENTS = [
  { id: "assign-1", title: "週末の宿題（正負の数・計算問題）", lessonId: "lesson-1", dueDate: "2026-05-25T15:00:00.000Z", completedCount: 2, totalCount: 3 },
  { id: "assign-2", title: "文字と式：文字の代入特訓", lessonId: "lesson-2", dueDate: "2026-05-28T15:00:00.000Z", completedCount: 0, totalCount: 3 }
];

const CURRICULUM_LESSONS = [
  { id: "lesson-1", name: "正負の数 - 導入と絶対値" },
  { id: "lesson-2", name: "正負の数 - 加法と減法" },
  { id: "lesson-3", name: "正負の数 - 乗法と除法" },
  { id: "lesson-4", name: "文字と式 - 数量の表し方" },
  { id: "lesson-5", name: "文字と式 - 式の計算と簡略化" },
  { id: "lesson-6", name: "一次方程式 - 等式の性質と方程式の解法" }
];

export default function TeacherPage() {
  const router = useRouter();

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  // Login Form States
  const [tenantCode, setTenantCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard Data States
  const [classes, setClasses] = useState<any[]>(MOCK_CLASSES);
  const [selectedClassId, setSelectedClassId] = useState<string>("test-class-id");
  const [students, setStudents] = useState<any[]>(MOCK_STUDENTS);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentStats, setSelectedStudentStats] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<any[]>(MOCK_ASSIGNMENTS);

  // Form States for Assignment Delivery
  const [assignTitle, setAssignTitle] = useState("");
  const [assignLessonId, setAssignLessonId] = useState("lesson-1");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [isDelivering, setIsDelivering] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  // Loading States
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingStudentStats, setIsLoadingStudentStats] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("rakkyo_token");
    const savedUserJson = localStorage.getItem("rakkyo_user");
    const savedRole = localStorage.getItem("rakkyo_role");

    if (savedToken && savedUserJson && (savedRole === "TEACHER" || savedRole === "TENANT_ADMIN")) {
      setToken(savedToken);
      setUser(JSON.parse(savedUserJson));
      setIsLoggedIn(true);
      fetchDashboardData(savedToken);
    } else {
      // Allow demo bypass if no token
      setIsLoggedIn(false);
    }
  }, []);

  // Fetch all classes, students and assignments
  const fetchDashboardData = async (activeToken: string) => {
    setIsLoadingDashboard(true);
    try {
      // 1. Fetch Classes
      const classRes = await fetch("http://localhost:4000/api/teacher/classes", {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (!classRes.ok) throw new Error();
      const classData = await classRes.json();
      setClasses(classData.classes || []);

      const defaultClassId = classData.classes?.[0]?.id || "test-class-id";
      setSelectedClassId(defaultClassId);

      // 2. Fetch Students for default class
      fetchClassStudents(defaultClassId, activeToken);

      // 3. Fetch Assignments for default class
      fetchClassAssignments(defaultClassId, activeToken);

      setIsFallback(false);
    } catch (err) {
      console.warn("⚠️ API failed. Falling back to robust demo data.");
      setIsFallback(true);
      setClasses(MOCK_CLASSES);
      setStudents(MOCK_STUDENTS);
      setAssignments(MOCK_ASSIGNMENTS);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const fetchClassStudents = async (classId: string, activeToken: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/teacher/classes/${classId}/students`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      setStudents(MOCK_STUDENTS);
    }
  };

  const fetchClassAssignments = async (classId: string, activeToken: string) => {
    try {
      const res = await fetch(`http://localhost:4000/api/teacher/assignments?classId=${classId}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (err) {
      setAssignments(MOCK_ASSIGNMENTS);
    }
  };

  const fetchStudentStats = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsLoadingStudentStats(true);

    if (isFallback || !token) {
      // Mock stats
      setTimeout(() => {
        setSelectedStudentStats(MOCK_STUDENT_STATS[studentId] || MOCK_STUDENT_STATS["test-student-id"]);
        setIsLoadingStudentStats(false);
      }, 300);
      return;
    }

    try {
      const res = await fetch(`http://localhost:4000/api/teacher/students/${studentId}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSelectedStudentStats(data);
    } catch (err) {
      setSelectedStudentStats(MOCK_STUDENT_STATS[studentId] || MOCK_STUDENT_STATS["test-student-id"]);
    } finally {
      setIsLoadingStudentStats(false);
    }
  };

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const response = await fetch("http://localhost:4000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          tenantCode: tenantCode || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ログインに失敗しました。");
      }

      if (data.user.role !== "TEACHER" && data.user.role !== "TENANT_ADMIN") {
        throw new Error("指導者（教師）アカウントのみログイン可能です。");
      }

      localStorage.setItem("rakkyo_token", data.token);
      localStorage.setItem("rakkyo_user", JSON.stringify(data.user));
      localStorage.setItem("rakkyo_role", data.user.role);

      setToken(data.token);
      setUser(data.user);
      setIsLoggedIn(true);
      setIsFallback(false);
      fetchDashboardData(data.token);
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || "接続に失敗しました。ローカルサーバーが起動しているか確認してね 🧅");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoBypass = () => {
    setIsLoggedIn(true);
    setIsFallback(true);
    setUser({ nickname: "ラッキョ先生 (デモ)", role: "TEACHER", email: "teacher@rakkyo.com" });
    setClasses(MOCK_CLASSES);
    setStudents(MOCK_STUDENTS);
    setAssignments(MOCK_ASSIGNMENTS);
  };

  const handleLogout = () => {
    localStorage.removeItem("rakkyo_token");
    localStorage.removeItem("rakkyo_user");
    localStorage.removeItem("rakkyo_role");
    setToken(null);
    setUser(null);
    setIsLoggedIn(false);
    setSelectedStudentId(null);
    setSelectedStudentStats(null);
  };

  // Handle homework assignment delivery
  const handleDeliverAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim() || !assignDueDate) {
      alert("すべての項目を入力してください！");
      return;
    }

    setIsDelivering(true);

    if (isFallback || !token) {
      // Mock Delivery
      setTimeout(() => {
        const newAssignment = {
          id: "assign_" + Math.random().toString(36).substr(2, 9),
          title: assignTitle,
          lessonId: assignLessonId,
          dueDate: new Date(assignDueDate).toISOString(),
          completedCount: 0,
          totalCount: students.length
        };
        setAssignments([newAssignment, ...assignments]);
        setAssignTitle("");
        setSuccessToast("宿題を配信しました！🧅（デモモード）");
        setIsDelivering(false);
        setTimeout(() => setSuccessToast(""), 4000);
      }, 500);
      return;
    }

    try {
      const response = await fetch("http://localhost:4000/api/teacher/assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          classId: selectedClassId,
          title: assignTitle,
          lessonId: assignLessonId,
          dueDate: new Date(assignDueDate).toISOString()
        })
      });

      if (!response.ok) throw new Error("宿題の配信に失敗しました。");
      
      setAssignTitle("");
      setSuccessToast("宿題をクラス全員に配信しました！🧅✨");
      fetchClassAssignments(selectedClassId, token);
      setTimeout(() => setSuccessToast(""), 4000);
    } catch (err) {
      alert("配信エラーが発生しました。");
    } finally {
      setIsDelivering(false);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedStudentId(null);
    setSelectedStudentStats(null);
    if (token && !isFallback) {
      fetchClassStudents(classId, token);
      fetchClassAssignments(classId, token);
    }
  };

  // ----------------------------------------------------
  // RENDER LOGIN SCREEN (IF NOT LOGGED IN)
  // ----------------------------------------------------
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-radial from-[#1E293B] via-[#0F172A] to-[#020617] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="absolute top-6 left-6 flex items-center space-x-3 text-white">
          <div className="p-2 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/20 backdrop-blur-md">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-indigo-200 via-indigo-100 to-indigo-300 bg-clip-text text-transparent">Rakkyo Multi-Tenant</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Teacher Administration Portal</p>
          </div>
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mt-6">
          <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-3xl bg-indigo-600/10 border border-indigo-500/20 backdrop-blur-md shadow-2xl relative overflow-hidden group">
            <span className="text-4xl filter drop-shadow-[0_4px_6px_rgba(99,102,241,0.4)] animate-bounce duration-1000">🧅</span>
            <div className="absolute inset-0 bg-indigo-500/5 group-hover:scale-110 transition-transform duration-300"></div>
          </div>
          <h2 className="mt-6 text-3xl font-black text-white tracking-tight bg-gradient-to-r from-white via-indigo-100 to-slate-300 bg-clip-text text-transparent">
            指導者用ダッシュボード
          </h2>
          <p className="mt-2 text-sm text-slate-400 font-medium">
            塾・学校の指導者アカウントでサインインして、生徒のつまずきを分析・指導支援 ✏️
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
          <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl border border-slate-800/80 sm:px-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
            
            {loginError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold leading-relaxed flex items-start space-x-2">
                <span className="text-base leading-none">⚠️</span>
                <span>{loginError}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  塾・学校コード <span className="text-indigo-400 font-normal">(個人利用時は空欄)</span>
                </label>
                <div className="mt-1.5 relative">
                  <input
                    type="text"
                    placeholder="e.g. rakkyo-juku"
                    value={tenantCode}
                    onChange={(e) => setTenantCode(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  />
                  <span className="absolute right-3.5 top-3.5 text-slate-700 text-xs">🏢</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  メールアドレス
                </label>
                <div className="mt-1.5 relative">
                  <input
                    type="email"
                    required
                    placeholder="teacher@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  />
                  <span className="absolute right-3.5 top-3.5 text-slate-700 text-xs">✉️</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  パスワード
                </label>
                <div className="mt-1.5 relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-all"
                  />
                  <span className="absolute right-3.5 top-3.5 text-slate-700 text-xs">🔒</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-indigo-500 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isLoggingIn ? "認証キー照合中... 🧅" : "指導員用ログイン"}
                </button>
              </div>
            </form>

            <div className="mt-6 flex flex-col space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-[#0d1527] text-slate-500 font-semibold uppercase tracking-wider">OR</span>
                </div>
              </div>

              <button
                onClick={handleDemoBypass}
                className="w-full flex justify-center py-3.5 px-4 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-sm font-bold text-slate-200 rounded-2xl transition-all cursor-pointer"
              >
                🚀 オフライン・デモモードで起動
              </button>

              <button
                onClick={() => router.push("/")}
                className="text-xs font-semibold text-slate-500 hover:text-indigo-400 text-center mt-2 transition-colors cursor-pointer"
              >
                ← 個人向け学習画面へ戻る 🧅
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER TEACHER DASHBOARD (IF LOGGED IN)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans select-none text-slate-700">
      {/* Sleek Top Navbar */}
      <header className="sticky top-0 bg-white border-b border-slate-200 z-50 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800 tracking-tight">Rakkyo 指導者ダッシュボード</h1>
            <p className="text-xs text-slate-400 font-medium">塾・学校向けマルチテナント機能 & 指導支援ツール</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Class Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">対象クラス:</span>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200"></div>

          <span className="text-xs font-bold text-slate-600 bg-indigo-50 px-3 py-2 rounded-xl flex items-center gap-1.5">
            🧅 {user?.nickname}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition-all cursor-pointer"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* Offline Banner if fallback */}
        {isFallback && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center space-x-3 text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
            </svg>
            <div className="text-xs">
              <p className="font-bold">💡 デモ用オフラインモードで動作しています。</p>
              <p className="mt-0.5 opacity-90">APIサーバー（ポート4000）を起動すると、本物のデータベースに基づいたマルチテナント制御、リアルタイムな生徒データ連携、および宿題配信が有効化されます。</p>
            </div>
          </div>
        )}

        {successToast && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center space-x-3 text-indigo-800 animate-pulse">
            <span>✨</span>
            <div className="text-xs font-bold">{successToast}</div>
          </div>
        )}

        {/* Hello Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 md:p-8 text-white mb-8 shadow-md relative overflow-hidden">
          <div className="absolute right-[-5%] bottom-[-20%] opacity-10">
            <svg viewBox="0 0 100 100" className="w-64 h-64 fill-white">
              <path d="M50,15 C28,30 25,65 30,80 C34,92 66,92 70,80 C75,65 72,30 50,15 Z" />
            </svg>
          </div>
          
          <span className="text-xs uppercase font-bold tracking-widest text-indigo-300 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full">
            指導員ポータル
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3 tracking-tight">
            中1数学の指導・つまずきアナリティクス 📈
          </h2>
          <p className="text-sm text-slate-300 mt-2 max-w-2xl font-medium leading-relaxed">
            このダッシュボードでは、単なる正答率だけでなく、生徒たちが「どの段階のヒントを使い」、「どれくらい解き直して自力解決に達したか」の<strong>プロセス（Gritスコア）</strong>を可視化します。
          </p>
        </div>

        {/* Loading Spinner */}
        {isLoadingDashboard ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-slate-200 text-slate-400">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-indigo-600 mb-4"></div>
            <p className="text-sm font-medium">クラスデータを構築中... 🧅</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* COLUMN 1 & 2: Students List & Analysis */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Class Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">所属生徒</span>
                  <div className="mt-3 flex items-baseline space-x-1.5">
                    <span className="text-3xl font-black text-slate-800">{students.length}</span>
                    <span className="text-xs text-slate-400 font-bold">名</span>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">クラス平均正答率</span>
                  <div className="mt-3 flex items-baseline space-x-1.5">
                    <span className="text-3xl font-black text-indigo-600">
                      {Math.round(students.reduce((acc, s) => acc + (s.stats?.accuracy || 0), 0) / (students.length || 1))}%
                    </span>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">配信中の宿題</span>
                  <div className="mt-3 flex items-baseline space-x-1.5">
                    <span className="text-3xl font-black text-emerald-600">{assignments.length}</span>
                    <span className="text-xs text-slate-400 font-bold">件</span>
                  </div>
                </div>
              </div>

              {/* Students Table */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">生徒一覧・進捗状況</h3>
                    <p className="text-xs text-slate-400 font-medium">生徒を選択するとつまずき状況のグラフとAI分析が表示されます</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-55/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-left">
                      <tr>
                        <th className="px-6 py-4">生徒</th>
                        <th className="px-6 py-4">レベル</th>
                        <th className="px-6 py-4">直近の解答数</th>
                        <th className="px-6 py-4">平均正答率</th>
                        <th className="px-6 py-4 text-right">詳細</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-600">
                      {students.map((student) => (
                        <tr
                          key={student.id}
                          className={`hover:bg-slate-50/50 transition-colors ${
                            selectedStudentId === student.id ? "bg-indigo-50/20" : ""
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <span className="text-xl">👤</span>
                              <div>
                                <p className="font-bold text-slate-800">{student.nickname}</p>
                                <p className="text-xs text-slate-400 font-medium">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-lg font-bold">
                              Lv. {student.level}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {student.stats?.totalAttempts || 0} 問
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    (student.stats?.accuracy || 0) >= 80 ? "bg-emerald-500" : (student.stats?.accuracy || 0) >= 60 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${student.stats?.accuracy || 0}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-slate-700">
                                {student.stats?.accuracy || 0}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => fetchStudentStats(student.id)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                                selectedStudentId === student.id
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              分析 🧅
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detailed Student Analytics Panel */}
              {selectedStudentId && (
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm transition-all animate-fadeIn">
                  <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        {students.find((s) => s.id === selectedStudentId)?.nickname} さんのつまずきアナリティクス
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">学習の粘り強さ（Gritスコア）とつまずいている要素の分析</p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedStudentId(null);
                        setSelectedStudentStats(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      閉じる ✕
                    </button>
                  </div>

                  {isLoadingStudentStats ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-indigo-600 mb-3"></div>
                      <p className="text-xs font-medium">生徒の学習ログを解析中... 🧅</p>
                    </div>
                  ) : selectedStudentStats ? (
                    <div className="p-6 space-y-8">
                      {/* Summary Metrics */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">粘り強さ (Grit)</p>
                          <p className="text-2xl font-black text-indigo-600 mt-1">
                            {selectedStudentStats.summary?.gritScore || 0}%
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium mt-1">ヒントを読んで自力解決できた比率</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">合計学習時間</p>
                          <p className="text-2xl font-black text-slate-800 mt-1">
                            {selectedStudentStats.summary?.totalStudyTimeMinutes || 0} <span className="text-xs font-bold text-slate-400">分</span>
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium mt-1">ラッキョくんでの解答計測時間</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">利用ヒント回数</p>
                          <p className="text-2xl font-black text-emerald-600 mt-1">
                            {selectedStudentStats.summary?.totalHintsUsed || 0} <span className="text-xs font-bold text-slate-400">回</span>
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium mt-1">3段階ヒントを活用した総数</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">直近の解答数</p>
                          <p className="text-2xl font-black text-slate-800 mt-1">
                            {selectedStudentStats.summary?.totalAttempts || 0} <span className="text-xs font-bold text-slate-400">問</span>
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium mt-1">正誤問わず取り組んだ問題数</p>
                        </div>
                      </div>

                      {/* Weakness & AI Advice Box */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Weakness List */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <span>🔍</span> つまずき検知ポイント
                          </h4>
                          {selectedStudentStats.weakestUnits?.length > 0 ? (
                            <div className="space-y-3">
                              {selectedStudentStats.weakestUnits.map((w: any, idx: number) => (
                                <div key={idx} className="bg-rose-50/30 border border-rose-100 rounded-xl p-4">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800 text-sm">{w.unitName}</span>
                                    <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-lg">
                                      つまずき度: {w.weakestScore}
                                    </span>
                                  </div>
                                  <p className="text-xs text-rose-700/80 font-medium mt-2 leading-relaxed">
                                    {w.reason}
                                  </p>
                                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400 font-bold">
                                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                                      正答率: {w.accuracyRate}%
                                    </div>
                                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                                      平均ヒント: {w.avgHintsUsed}回
                                    </div>
                                    <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                                      解き直し: {w.retryCount}回
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-emerald-50/20 border border-emerald-100 rounded-xl p-4 text-emerald-800 text-xs font-semibold leading-relaxed">
                              ✨ 現在、検出された明確な「つまずき（苦手要素）」はありません。順調に学習が進んでいます！
                            </div>
                          )}
                        </div>

                        {/* Hint Stage Usage Visualizer & Advisor */}
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <span>💡</span> ヒント活用ステージ割合
                          </h4>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                <span>第1段階：ヒント（考え方の手がかり）</span>
                                <span>{selectedStudentStats.hintStageUsage?.stage1Count || selectedStudentStats.hintStageUsage?.stage1 || 0}回</span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${Math.min(100, ((selectedStudentStats.hintStageUsage?.stage1Count || selectedStudentStats.hintStageUsage?.stage1 || 0) / (selectedStudentStats.summary?.totalAttempts || 1)) * 100)}%` }}></div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                <span>第2段階：ステップ（解法のロードマップ）</span>
                                <span>{selectedStudentStats.hintStageUsage?.stage2Count || selectedStudentStats.hintStageUsage?.stage2 || 0}回</span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div className="bg-purple-400 h-full rounded-full" style={{ width: `${Math.min(100, ((selectedStudentStats.hintStageUsage?.stage2Count || selectedStudentStats.hintStageUsage?.stage2 || 0) / (selectedStudentStats.summary?.totalAttempts || 1)) * 100)}%` }}></div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                <span>第3段階：答え（詳細な解説と答え）</span>
                                <span>{selectedStudentStats.hintStageUsage?.stage3Count || selectedStudentStats.hintStageUsage?.stage3 || 0}回</span>
                              </div>
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div className="bg-rose-400 h-full rounded-full" style={{ width: `${Math.min(100, ((selectedStudentStats.hintStageUsage?.stage3Count || selectedStudentStats.hintStageUsage?.stage3 || 0) / (selectedStudentStats.summary?.totalAttempts || 1)) * 100)}%` }}></div>
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Instructor AI Advisor */}
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">🧅</span>
                          <h4 className="font-bold text-indigo-900 text-sm">ラッキョ先生用AI指導アドバイス</h4>
                        </div>
                        <p className="text-xs text-indigo-950/80 font-medium leading-relaxed mt-2.5">
                          {selectedStudentStats.summary?.gritScore >= 70 ? (
                            "この生徒はヒントを非常によく活用し、間違えた後も答えをすぐ書き写すのではなく、第2段階ヒント等を読みながら「自力で解き直そう」という姿勢（Grit）が極めて高いです！授業では、正答率そのものより『ヒントを読んで自力で解き直した姿勢』を大いに褒めてあげてください。"
                          ) : (
                            "正答率に比べてヒントの利用回数やGritスコアがやや低めです。間違えた際に、じっくりヒントを読まずに勘で何度も答えを入力している、または投げ出している可能性があります。ヒントの読み方や、数直線などの図をノートに手書きで描くよう、授業でやさしくアプローチしてあげてください🧅"
                          )}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

            </div>

            {/* COLUMN 3: Deliver Homework & History */}
            <div className="space-y-8">
              
              {/* Deliver Homework Form */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                  <span>✏️</span> 宿題を一括配信
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">選択中のクラスの全生徒へレッスン課題を配信します</p>

                <form className="mt-5 space-y-4" onSubmit={handleDeliverAssignment}>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">宿題タイトル</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 週末の正負の数特訓！"
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      className="mt-1.5 appearance-none block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs font-bold transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">配信対象レッスン</label>
                    <select
                      value={assignLessonId}
                      onChange={(e) => setAssignLessonId(e.target.value)}
                      className="mt-1.5 w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      {CURRICULUM_LESSONS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">提出期限</label>
                    <input
                      type="date"
                      required
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="mt-1.5 appearance-none block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs font-bold transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isDelivering}
                    className="w-full mt-2 flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-xs text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all cursor-pointer"
                  >
                    {isDelivering ? "配信中... 🧅" : "宿題を一括配信する"}
                  </button>
                </form>
              </div>

              {/* Assignments History */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                  <span>📋</span> 配信済みの宿題
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">現在までにこのクラスへ配信した課題の一覧</p>

                <div className="mt-5 space-y-3">
                  {assignments.map((assign) => (
                    <div key={assign.id} className="border border-slate-100 bg-slate-50/50 rounded-2xl p-4 flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{assign.title}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1">
                          対象: {CURRICULUM_LESSONS.find((l) => l.id === assign.lessonId)?.name || assign.lessonId}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-lg">
                          期限: {new Date(assign.dueDate).toLocaleDateString("ja-JP")}
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${(assign.completedCount / (assign.totalCount || 1)) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-black text-slate-600">
                            {assign.completedCount}/{assign.totalCount}人
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
