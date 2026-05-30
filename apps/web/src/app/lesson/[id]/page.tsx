"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { 
  mathGrade1Curriculum,
  englishGrade1Curriculum,
  scienceGrade1Curriculum,
  socialGrade1Curriculum,
  japaneseGrade1Curriculum
} from "@rakkyo/curriculum";
import { RakkyoMascot } from "../../dashboard/components/RakkyoMascot";
import { CongratsOverlay } from "../../dashboard/components/CongratsOverlay";
import { useRakkyoVoice } from "../../../hooks/useRakkyoVoice";
import { MathText } from "./components/MathText";
import { LevelUpOverlay } from "./components/LevelUpOverlay";
import { ClearOverlay } from "./components/ClearOverlay";
import { ParentShareModal } from "./components/ParentShareModal";
import { ProgressiveHintPanel } from "./components/ProgressiveHintPanel";
import { OfflineHintBadge } from "@/components/OfflineHintBadge/OfflineHintBadge";

interface UserProfile {
  id: string;
  nickname: string;
  level: number;
  currentXp: number;
  streakCount: number;
  badges?: string[];
  isMock?: boolean;
}

const subjectThemes: Record<string, {
  bg: string;
  border: string;
  text: string;
  darkText: string;
  btnBg: string;
  btnBorder: string;
  btnText: string;
  btnHover: string;
  progressBg: string;
}> = {
  math: {
    bg: "bg-pastel-green",
    border: "border-pastel-green-border",
    text: "text-pastel-green-dark",
    darkText: "text-pastel-green-dark",
    btnBg: "bg-pastel-green",
    btnBorder: "border-pastel-green-border",
    btnText: "text-pastel-green-dark",
    btnHover: "hover:bg-emerald-100/50",
    progressBg: "bg-pastel-green-dark"
  },
  english: {
    bg: "bg-pastel-purple",
    border: "border-pastel-purple-border",
    text: "text-pastel-purple-dark",
    darkText: "text-pastel-purple-dark",
    btnBg: "bg-pastel-purple",
    btnBorder: "border-pastel-purple-border",
    btnText: "text-pastel-purple-dark",
    btnHover: "hover:bg-indigo-100/50",
    progressBg: "bg-indigo-500"
  },
  science: {
    bg: "bg-pastel-blue",
    border: "border-pastel-blue-border",
    text: "text-pastel-blue-dark",
    darkText: "text-pastel-blue-dark",
    btnBg: "bg-pastel-blue",
    btnBorder: "border-pastel-blue-border",
    btnText: "text-pastel-blue-dark",
    btnHover: "hover:bg-sky-100/50",
    progressBg: "bg-sky-400"
  },
  social: {
    bg: "bg-pastel-orange",
    border: "border-pastel-orange-border",
    text: "text-pastel-orange-dark",
    darkText: "text-pastel-orange-dark",
    btnBg: "bg-pastel-orange",
    btnBorder: "border-pastel-orange-border",
    btnText: "text-pastel-orange-dark",
    btnHover: "hover:bg-amber-100/50",
    progressBg: "bg-amber-500"
  },
  japanese: {
    bg: "bg-pastel-pink",
    border: "border-pastel-pink-border",
    text: "text-pastel-pink-dark",
    darkText: "text-pastel-pink-dark",
    btnBg: "bg-pastel-pink",
    btnBorder: "border-pastel-pink-border",
    btnText: "text-pastel-pink-dark",
    btnHover: "hover:bg-pink-100/50",
    progressBg: "bg-pink-400"
  }
};

function ExerciseScreenContent() {
  const router = useRouter();
  const { id } = useParams();
  const searchParams = useSearchParams();
  const isReview = searchParams?.get("review") === "true";
  const lessonIdStr = Array.isArray(id) ? id[0] : id;
  const lessonIdVal = parseInt(lessonIdStr || "1");

  // Determine subject and lesson index within the subject based on 1-15 scale
  let subject = mathGrade1Curriculum;
  let subjectCode = "math";
  let unitIndex = 0;

  if (lessonIdVal >= 1 && lessonIdVal <= 3) {
    subject = mathGrade1Curriculum;
    subjectCode = "math";
    unitIndex = lessonIdVal - 1;
  } else if (lessonIdVal >= 4 && lessonIdVal <= 6) {
    subject = englishGrade1Curriculum;
    subjectCode = "english";
    unitIndex = lessonIdVal - 4;
  } else if (lessonIdVal >= 7 && lessonIdVal <= 9) {
    subject = scienceGrade1Curriculum;
    subjectCode = "science";
    unitIndex = lessonIdVal - 7;
  } else if (lessonIdVal >= 10 && lessonIdVal <= 12) {
    subject = socialGrade1Curriculum;
    subjectCode = "social";
    unitIndex = lessonIdVal - 10;
  } else if (lessonIdVal >= 13 && lessonIdVal <= 15) {
    subject = japaneseGrade1Curriculum;
    subjectCode = "japanese";
    unitIndex = lessonIdVal - 13;
  }

  const unit = subject.units[unitIndex];
  const lesson = unit?.lessons[0];
  const questions = lesson?.questions || [];

  const theme = subjectThemes[subjectCode] || subjectThemes.math;

  const { speak, stop } = useRakkyoVoice();
  const [activeQuestions, setActiveQuestions] = useState<any[]>([]);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  // D-5: Track offline-cache staleness so OfflineHintBadge can show honest
  // freshness signals next to cached AI hints / diagnosis content.
  const [diagnosisStaleLabel, setDiagnosisStaleLabel] = useState<string | null>(null);
  const [hintStaleLabels, setHintStaleLabels] = useState<{ [stage: number]: string }>({});
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);

  useEffect(() => {
    if (questions && questions.length > 0) {
      setActiveQuestions(questions);
    }
  }, [questions]);

  // User details
  const [user, setUser] = useState<UserProfile | null>(null);

  // Gamification & Dress-up states (Phase 10)
  const [mascotEmotion, setMascotEmotion] = useState<'normal' | 'correct' | 'incorrect' | 'happy'>('normal');
  const [currentOutfit, setCurrentOutfit] = useState("none");
  const [isCongratsOpen, setIsCongratsOpen] = useState(false);
  const [congratsData, setCongratsData] = useState<{
    type: 'levelUp' | 'streak' | 'quest' | 'badge';
    title?: string;
    subtitle?: string;
    bonusXp?: number;
    badgeName?: string;
    streakCount?: number;
    level?: number;
  } | null>(null);

  // Exercise states
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpTo, setLevelUpTo] = useState(0);

  // Phase 12 states
  const [latestAttemptId, setLatestAttemptId] = useState<string | null>(null);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [showCelebrationShareModal, setShowCelebrationShareModal] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isGeneratingShareLink, setIsGeneratingShareLink] = useState(false);

  // Timer state
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Progressive Hint states (S-007)
  const [showHintPanel, setShowHintPanel] = useState(false);
  const [hintStage, setHintStage] = useState<1 | 2 | 3>(1);
  const [showFinalAnswer, setShowFinalAnswer] = useState(false);
  const [aiHints, setAiHints] = useState<{ [key: number]: string }>({});
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [isSocraticPreferred, setIsSocraticPreferred] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  // Text-to-Speech (TTS) Voice Synthesis
  const [isPlayingTts, setIsPlayingTts] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load and cache SpeechSynthesis voices early to avoid asynchronous initialization bugs (especially on first button click)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    let attempts = 0;
    const maxAttempts = 10;
    let timerId: any = null;

    const updateVoices = () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const voiceList = window.speechSynthesis.getVoices();
        if (voiceList && voiceList.length > 0) {
          setVoices(voiceList);
          if (timerId) {
            clearInterval(timerId);
            timerId = null;
          }
        }
      }
    };

    updateVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    // Polling fallback to ensure robust catalog population in all browsers (e.g. Safari, mobile webviews)
    timerId = setInterval(() => {
      attempts++;
      updateVoices();
      if (attempts >= maxAttempts) {
        if (timerId) {
          clearInterval(timerId);
          timerId = null;
        }
      }
    }, 250);

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      }
    };
  }, []);

  // Speech-to-Text (STT) Voice Inquiries
  const [isListening, setIsListening] = useState(false);
  const [speechText, setSpeechText] = useState("");
  const [chatHistory, setChatHistory] = useState<{ sender: "user" | "ai"; text: string }[]>([]);
  const [isSubmittingSpeech, setIsSubmittingSpeech] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = "ja-JP"; // Speak in Japanese across all subjects to allow easy dialogue with tutor

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const resultText = event.results[0][0].transcript;
          setSpeechText(resultText);
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognitionInstance(rec);
      }
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [subjectCode]);

  // Refactored speakText for Hybrid Cloud TTS + Local Web Speech Fallback
  const speakText = async (text: string, id: string, emotion: string = "neutral") => {
    if (typeof window === "undefined") return;

    // Stop currently playing audio or speech
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (isPlayingTts === id) {
      setIsPlayingTts(null);
      return;
    }

    setIsPlayingTts(id);

    // Clean text from LaTeX segments to make TTS flow nicely
    let cleanText = text;
    if (subjectCode === "english") {
      cleanText = text
        .replace(/\$/g, "")
        .replace(/“/g, "「")
        .replace(/”/g, "」")
        .replace(/"/g, "「")
        .replace(/’/g, "'")
        .replace(/\[\s*\]/g, " ほにゃらら ")
        .replace(/\[/g, " ")
        .replace(/\]/g, " ");
    } else {
      cleanText = text
        .replace(/\$/g, "")
        .replace(/\\times/g, "かける")
        .replace(/\\div/g, "わる")
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$2分の$1")
        .replace(/x/g, "エックス")
        .replace(/y/g, "ワイ")
        .replace(/-/g, "マイナス");
    }

    // Language misdetection guard for local Web Speech fallbacks
    const localText = "　" + cleanText;

    // Helper to play local SpeechSynthesis
    const playLocalSpeech = () => {
      if (!window.speechSynthesis) {
        setIsPlayingTts(null);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(localText);
      utterance.lang = "ja-JP";
      utterance.rate = 0.92;

      let availableVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
      if (!availableVoices || availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices() || [];
      }

      if (availableVoices.length > 0) {
        const jaVoices = availableVoices.filter(v => {
          const langLower = v.lang.toLowerCase().replace("_", "-");
          return langLower === "ja-jp" || langLower.startsWith("ja");
        });

        if (jaVoices.length > 0) {
          const jaVoice = jaVoices.find(v => v.name.toLowerCase().includes("siri"))
            || jaVoices.find(v => v.name.toLowerCase().includes("google"))
            || jaVoices.find(v => v.name.toLowerCase().includes("enhanced"))
            || jaVoices.find(v => v.name.toLowerCase().includes("premium"))
            || jaVoices[0];

          if (jaVoice) {
            utterance.voice = jaVoice;
            utterance.lang = jaVoice.lang;
          }
        }
      }

      utterance.onend = () => {
        setIsPlayingTts(null);
      };
      utterance.onerror = () => {
        setIsPlayingTts(null);
      };

      window.speechSynthesis.speak(utterance);
    };

    // 1. Try Hybrid Cloud TTS REST endpoint
    try {
      const response = await fetch("http://localhost:4000/api/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: cleanText, emotion })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.url) {
          const audioUrl = `http://localhost:4000${data.url}`;
          const audio = new Audio(audioUrl);
          setCurrentAudio(audio);
          
          audio.onended = () => {
            setIsPlayingTts(null);
            setCurrentAudio(null);
          };
          audio.onerror = () => {
            console.warn("Cloud TTS playback error, falling back to Web Speech Synthesis.");
            playLocalSpeech();
          };
          audio.play();
        } else {
          // FallbackToWebSpeech indicates server-side fallback instructions
          playLocalSpeech();
        }
      } else {
        playLocalSpeech();
      }
    } catch (e) {
      console.warn("Cloud TTS API unreachable, falling back to Web Speech Synthesis.", e);
      playLocalSpeech();
    }
  };

  const startListening = () => {
    if (recognitionInstance) {
      try {
        setSpeechText("");
        recognitionInstance.start();
      } catch (e) {
        console.error("Recognition start failed", e);
      }
    } else {
      alert("お使いのブラウザは音声認識に対応していません。Google Chromeなどをお試しください。");
    }
  };

  const stopListening = () => {
    if (recognitionInstance) {
      recognitionInstance.stop();
    }
  };

  const submitVoiceQuestion = async () => {
    if (!speechText.trim() || isSubmittingSpeech) return;

    const token = localStorage.getItem("rakkyo_token");
    if (!token || !questions[currentQIdx]) return;

    setIsSubmittingSpeech(true);
    const userMsg = speechText;
    setSpeechText("");
    
    setChatHistory(prev => [...prev, { sender: "user", text: userMsg }]);

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
          hintsUsed: showHintPanel ? hintStage : 0,
          userQuestion: userMsg,
          isSocraticPreferred
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChatHistory(prev => [...prev, { sender: "ai", text: data.hintText }]);
      } else {
        setChatHistory(prev => [...prev, { sender: "ai", text: "ごめんね、うまくお返事できなかったみたい。もう一度質問してみてね。" }]);
      }
    } catch (e) {
      console.warn("⚠️ Voice question dispatch error", e);
      setChatHistory(prev => [...prev, { sender: "ai", text: "ネットワークエラーが発生したよ。もう一度試してみてね。" }]);
    } finally {
      setIsSubmittingSpeech(false);
    }
  };

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
          hintsUsed: stageNum - 1,
          isSocraticPreferred
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiHints(prev => ({ ...prev, [stageNum]: data.hintText }));
        // Fresh server hint — drop any prior offline-cache staleness label.
        setHintStaleLabels(prev => {
          if (!(stageNum in prev)) return prev;
          const next = { ...prev };
          delete next[stageNum];
          return next;
        });

        if (data.metaDescription) {
          speakText(`${data.metaDescription}。${data.hintText}`, `hint${stageNum}`, "calm");
        } else {
          speakText(data.hintText, `hint${stageNum}`, "neutral");
        }
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch AI hint. Falling back to offline local cache or static hints.", e);
      
      const userStr = localStorage.getItem("rakkyo_user");
      if (userStr && currentQuestion) {
        try {
          const u = JSON.parse(userStr);
          const { openUserDb } = await import('@/lib/offline/db');
          const { getCachedHints } = await import('@/lib/offline/hint-prefetch');
          const db = await openUserDb(u.id);
          // P2: scope the cache lookup by lesson so cross-lesson
          // questionId collisions (prompt-fallback IDs) can't surface
          // hints from a different lesson.
          const cached = getCachedHints(
            db,
            lesson.name,
            currentQuestion.id || currentQuestion.prompt
          );
          
          if (cached && cached.hints && cached.hints.length > 0) {
            const index = Math.min(stageNum - 1, cached.hints.length - 1);
            const cachedHintText = cached.hints[index];
            if (cachedHintText) {
              setAiHints(prev => ({ ...prev, [stageNum]: cachedHintText }));
              // D-5: Surface staleness alongside the offline-cached hint so
              // children see when hints are not fresh from the server.
              if (cached.isStale && cached.staleLabel) {
                setHintStaleLabels(prev => ({ ...prev, [stageNum]: cached.staleLabel! }));
              } else {
                setHintStaleLabels(prev => {
                  if (!(stageNum in prev)) return prev;
                  const next = { ...prev };
                  delete next[stageNum];
                  return next;
                });
              }
              speakText(cachedHintText, `hint${stageNum}`, "neutral");
              setIsLoadingHint(false);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to read cached hints:", err);
        }
      }

      // Hard fallback: use question structure hints
      const q = currentQuestion;
      const staticHints = q?.hints || [];
      const fallbackHint = staticHints[stageNum - 1] || staticHints[staticHints.length - 1] || "もう一度ゆっくり考えてみてね。";
      setAiHints(prev => ({ ...prev, [stageNum]: fallbackHint }));
      speakText(fallbackHint, `hint${stageNum}`, "neutral");
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
      router.push(`/${subjectCode}`);
      return;
    }

    try {
      const parsedUser = JSON.parse(userStr);
      setUser(parsedUser);
      const outfit = localStorage.getItem("rakkyo_outfit") || "none";
      setCurrentOutfit(outfit);

      // Prefetch hints and AI cache in the background for offline readiness (P2-4)
      if (parsedUser && parsedUser.id) {
        import('@/lib/offline/db').then(async ({ openUserDb }) => {
          try {
            const db = await openUserDb(parsedUser.id);
            const { prefetchHints, prefetchAiCache } = await import('@/lib/offline/hint-prefetch');
            prefetchHints(db, lesson.name, token);
            prefetchAiCache(db, token);
          } catch (err) {
            console.warn('Failed to background prefetch offline cache:', err);
          }
        });
      }
    } catch (e) {
      router.push("/");
    }
  }, [router, subjectCode, unit, lesson]);

  if (!user || activeQuestions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-pastel-blue-border border-t-pastel-blue-dark" />
      </div>
    );
  }

  const currentQuestion = activeQuestions[currentQIdx];

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
    setTotalSeconds(prev => prev + durationSeconds);

    // Check locally first for instant evaluation/fallback
    const isAnsCorrect = currentQuestion.answers.some(
      (ans: string) => ans.toLowerCase().trim() === submitted.toLowerCase().trim()
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
          if (data.attemptId) {
            setLatestAttemptId(data.attemptId);
          }

          if (data.isCorrect) {
            setMascotEmotion('correct');
            speak("正解！すごすぎるよ！ラッキョくんも大喜びだよ！", "correct");
          } else {
            setMascotEmotion('incorrect');
            if (data.aiDiagnosis) {
              setAiDiagnosis(data.aiDiagnosis);
              // Fresh server diagnosis — clear any prior offline-cache staleness label.
              setDiagnosisStaleLabel(null);
              speak(data.aiDiagnosis, "incorrect");
            } else {
              speak("おしい！ちがうみたいだね。となりのラッキョくんにヒントを聞いてみよう！", "incorrect");
            }
          }

          if (data.leveledUp) {
            setLevelUpTo(data.user.level);
            setCongratsData({
              type: 'levelUp',
              level: data.user.level,
              bonusXp: data.xpAwarded,
            });
            setIsCongratsOpen(true);
          } else if (data.newBadges && data.newBadges.length > 0) {
            setCongratsData({
              type: 'badge',
              badgeName: data.newBadges[0],
              bonusXp: data.xpAwarded,
            });
            setIsCongratsOpen(true);
          } else if (data.questUnlocked && data.questUnlocked.length > 0) {
            setCongratsData({
              type: 'quest',
              title: `${data.questUnlocked[0].name} 達成！`,
              subtitle: '本日のクエストをクリアしたよ！すごすぎる！🧅',
              bonusXp: data.questUnlocked[0].bonusXp,
            });
            setIsCongratsOpen(true);
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
    const fallbackAttemptId = "attempt_fallback_" + Date.now();
    setLatestAttemptId(fallbackAttemptId);

    // Enqueue the pending attempt to SQLite for later sync (P1-7).
    // P2: Await the durable insert BEFORE awarding XP / advancing the UI.
    // Previously this ran as a detached promise, so if the learner closed
    // the PWA or navigated during the sqlite-wasm load / OPFS open /
    // encryption window, the UI had already accepted and awarded the answer
    // but the row was never written to offline_attempts and could never be
    // synced. Awaiting guarantees durability before we acknowledge.
    try {
      const { openUserDb } = await import('@/lib/offline/db');
      const { enqueuePendingAttempt } = await import('@/lib/offline/sync-engine');
      const db = await openUserDb(user.id);
      const localId = await enqueuePendingAttempt(db, {
        userId: user.id,
        questionId: currentQuestion.id || currentQuestion.prompt,
        isCorrect: isAnsCorrect,
        hintsUsed,
        answerSubmitted: submitted,
        durationSeconds,
        errorType: isAnsCorrect ? null : "incorrect",
        isReview: isReview,
        createdAt: new Date().toISOString(),
      });
      console.log("Successfully enqueued pending offline attempt:", localId);
      window.dispatchEvent(new CustomEvent('rakkyo-offline-attempt-enqueued'));
    } catch (e) {
      console.error("Failed to enqueue offline attempt:", e);
      // P1: The attempt was NOT durably written (sqlite-wasm load / OPFS /
      // crypto-key failure). Do NOT award optimistic XP for work that can
      // never be synced. Roll the answer-check UI back so the learner can
      // retry, surface a friendly message, and stop here.
      setIsChecked(false);
      setIsCorrect(false);
      setMascotEmotion('incorrect');
      speak("ごめんね、答えをうまく保存できなかったみたい。もう一度ためしてね。", "neutral");
      return;
    }

    if (isAnsCorrect) {
      setMascotEmotion('correct');
      speak("正解！すごすぎるよ！ラッキョくんも大喜びだよ！", "correct");
      // Award XP (+25 XP for review, +10 XP normally)
      const xpAwarded = isReview ? 25 : 10;
      const updatedUser = { ...user };
      updatedUser.currentXp += xpAwarded;

      // Check level up: Level * 100 XP threshold
      let xpNeeded = updatedUser.level * 100;
      let levelUpTriggered = false;
      while (updatedUser.currentXp >= xpNeeded) {
        updatedUser.currentXp -= xpNeeded;
        updatedUser.level += 1;
        setLevelUpTo(updatedUser.level);
        levelUpTriggered = true;
        xpNeeded = updatedUser.level * 100;
      }

      if (levelUpTriggered) {
        setCongratsData({
          type: 'levelUp',
          level: updatedUser.level,
          bonusXp: xpAwarded,
        });
        setIsCongratsOpen(true);
      }

      setUser(updatedUser);
      localStorage.setItem("rakkyo_user", JSON.stringify(updatedUser));
    } else {
      setMascotEmotion('incorrect');

      // Fallback: Check local SQLite AI diagnosis cache (P2-4)
      import('@/lib/offline/db').then(async ({ openUserDb }) => {
        let customDiagnosis: string | null = null;
        let staleLabelText: string | null = null;
        try {
          const db = await openUserDb(user.id);
          const { getCachedAiDiagnosis } = await import('@/lib/offline/hint-prefetch');
          const cachedDiag = getCachedAiDiagnosis(db, currentQuestion.id || currentQuestion.prompt);
          if (cachedDiag) {
            customDiagnosis = cachedDiag.diagnosis;
            staleLabelText = cachedDiag.staleLabel;
          }
        } catch (err) {
          console.error("Failed to read cached AI diagnosis:", err);
        }

        if (customDiagnosis) {
          setAiDiagnosis(customDiagnosis);
          // D-5: Record stale-label so OfflineHintBadge renders next to the
          // diagnosis. Clear when the cached diagnosis is fresh.
          setDiagnosisStaleLabel(staleLabelText);
          speak(staleLabelText ? `${staleLabelText}。${customDiagnosis}` : customDiagnosis, "incorrect");
        } else {
          speak("おしい！ちがうみたいだね。となりのラッキョくんにヒントを聞いてみよう！", "incorrect");
        }
      });
    }
  };

  const handleRecommendSimilar = async () => {
    const token = localStorage.getItem("rakkyo_token");
    if (!token) return;
    setIsLoadingSimilar(true);
    try {
      const response = await fetch("http://localhost:4000/api/lessons/recommend-similar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          questionId: currentQuestion.id || currentQuestion.prompt
        })
      });
      if (response.ok) {
        const newQ = await response.json();
        const updated = [...activeQuestions];
        updated[currentQIdx] = newQ;
        setActiveQuestions(updated);
        
        // Reset states
        setSelectedOption(null);
        setTextAnswer("");
        setIsChecked(false);
        setIsCorrect(false);
        setShowHintPanel(false);
        setHintStage(1);
        setShowFinalAnswer(false);
        setAiHints({});
        setHintStaleLabels({});
        setAiDiagnosis(null);
        setDiagnosisStaleLabel(null);
        setMascotEmotion('normal');
        setStartTime(Date.now());
        
        speak("新しく似た問題を用意したよ！もう一度一緒にがんばろう！", "neutral");
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch similar question:", e);
    } finally {
      setIsLoadingSimilar(false);
    }
  };

  const contributeToClassMission = async () => {
    const token = localStorage.getItem("rakkyo_token");
    if (!token) return;

    // Convert seconds to minutes (minimum 1 minute)
    const minutes = Math.max(1, Math.round(totalSeconds / 60));

    try {
      await fetch("http://localhost:4000/api/collaborative/missions/contribute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ minutes })
      });
      console.log(`Successfully contributed ${minutes} minutes to class mission!`);
    } catch (e) {
      console.warn("⚠️ Failed to contribute study time to class mission dynamically.", e);
    }
  };

  const handleGenerateParentCelebrationLink = async () => {
    const token = localStorage.getItem("rakkyo_token");
    if (!token || !latestAttemptId) return;

    setIsGeneratingShareLink(true);
    try {
      const response = await fetch("http://localhost:4000/api/collaborative/celebration/trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ attemptId: latestAttemptId })
      });

      if (response.ok) {
        const data = await response.json();
        const generatedToken = data.token;
        const link = `${window.location.origin}/parent/celebrate/${generatedToken}`;
        setShareLink(link);
        setShowCelebrationShareModal(true);
      } else {
        throw new Error("Trigger celebration failed");
      }
    } catch (e) {
      console.warn("⚠️ Trigger parent celebration error. Generating fallback link...", e);
      // Fallback parent celebration token
      const fallbackToken = `celeb_mock_${Math.random().toString(36).substr(2, 9)}`;
      const link = `${window.location.origin}/parent/celebrate/${fallbackToken}`;
      setShareLink(link);
      setShowCelebrationShareModal(true);
    } finally {
      setIsGeneratingShareLink(false);
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
    setHintStaleLabels({});
    setAiDiagnosis(null);
    setDiagnosisStaleLabel(null);
    setMascotEmotion('normal'); // Reset mascot emotion

    // Clear speech states
    stop();
    setIsPlayingTts(null);
    setSpeechText("");
    setChatHistory([]);
    setIsListening(false);

    if (currentQIdx + 1 < activeQuestions.length) {
      setCurrentQIdx(currentQIdx + 1);
    } else {
      // Cleared entire unit lesson!
      setShowClearModal(true);
      contributeToClassMission();
    }
  };

  const handleCloseClearModal = () => {
    setShowClearModal(false);
    router.push(`/${subjectCode}`);
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6 select-none relative">
      
      {/* Background blobs */}
      <div className={`absolute top-[20%] left-[-5%] w-[30%] h-[30%] rounded-full ${theme.bg} opacity-30 blur-3xl -z-10`} />
      <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-pastel-blue opacity-30 blur-3xl -z-10" />

      {/* 1. Header (Navigation & Progress tracker) */}
      <header className="bg-white border-3 border-slate-100 rounded-3xl p-4 flex items-center justify-between gap-4 bubbly-shadow">
        <button
          onClick={() => router.push(`/${subjectCode}`)}
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
              className={`h-full ${theme.progressBg} rounded-full transition-all duration-300`}
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
            <div className="pt-2 flex items-start justify-between gap-4">
              <div className="text-base sm:text-lg font-bold text-slate-700 tracking-wide leading-relaxed flex-1">
                <MathText text={currentQuestion.prompt} />
              </div>
              <button
                onClick={() => speakText(currentQuestion.prompt, "prompt")}
                className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all active:translate-y-[1px] flex-shrink-0 ${
                  isPlayingTts === "prompt"
                    ? "bg-pastel-pink border-pastel-pink-border text-pastel-pink-dark"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {isPlayingTts === "prompt" ? "⏹️ とめる" : "🔊 よみあげる"}
              </button>
            </div>

            {/* Answer Input Cards */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              
              {/* MULTIPLE CHOICE GRID */}
              {(currentQuestion.type === "MULTIPLE_CHOICE" || currentQuestion.type === "SINGLE_CHOICE") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentQuestion.options.map((opt: string, idx: number) => (
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
              <div className="space-y-4">
                <div className={`border-3 p-5 rounded-3xl flex items-center gap-4 ${
                  isCorrect
                    ? "bg-pastel-green border-pastel-green-border text-pastel-green-dark"
                    : "bg-pastel-pink border-pastel-pink-border text-pastel-pink-dark"
                }`}>
                  <span className="text-3xl select-none">{isCorrect ? "🎉" : "😭"}</span>
                  <div className="flex-1">
                    <h4 className="font-extrabold text-sm">
                      {isCorrect ? "正解！すごすぎる！" : "おしい！ちがうみたい..."}
                    </h4>
                    {/* D-5: Honest authenticity — surface offline-cache staleness next to the AI diagnosis. */}
                    {!isCorrect && aiDiagnosis && diagnosisStaleLabel && (
                      <div className="mt-1">
                        <OfflineHintBadge isStale={true} staleLabel={diagnosisStaleLabel} />
                      </div>
                    )}
                    <p className="text-xs font-semibold mt-1 opacity-90 leading-relaxed">
                      {isCorrect
                        ? "この調子で次の問題もクリアして、XPをたくさん集めよう！"
                        : aiDiagnosis
                          ? aiDiagnosis
                          : "大丈夫だよ！となりのラッキョくんにヒントを聞いてみよう！"}
                    </p>
                  </div>
                  {!isCorrect && aiDiagnosis && (
                    <button
                      onClick={() => speak(aiDiagnosis, "incorrect")}
                      className="px-2.5 py-1 rounded-lg border border-pastel-pink-border bg-white text-3xs font-extrabold text-pastel-pink-dark flex-shrink-0 cursor-pointer"
                    >
                      🔊 もう一度きく
                    </button>
                  )}
                </div>

                {/* Recommend Similar Question Button (Phase 11) */}
                {!isCorrect && (
                  <div className="flex justify-end">
                    <button
                      disabled={isLoadingSimilar}
                      onClick={handleRecommendSimilar}
                      className="px-5 py-3 bg-pastel-yellow border-2 border-pastel-yellow-border text-pastel-yellow-dark font-extrabold rounded-2xl text-xs hover:bg-yellow-100/50 active:translate-y-[2px] disabled:opacity-50 transition-all bubbly-shadow cursor-pointer flex items-center gap-1.5"
                    >
                      {isLoadingSimilar ? (
                        <>
                          <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-pastel-yellow-border border-t-pastel-yellow-dark" />
                          <span>類題を作成中... 🧅</span>
                        </>
                      ) : (
                        <span>もう一回！似た問題に挑戦する 🧅</span>
                      )}
                    </button>
                  </div>
                )}
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
          <ProgressiveHintPanel
            showHintPanel={showHintPanel}
            setShowHintPanel={setShowHintPanel}
            hintStage={hintStage}
            setHintStage={setHintStage}
            showFinalAnswer={showFinalAnswer}
            setShowFinalAnswer={setShowFinalAnswer}
            aiHints={aiHints}
            hintStaleLabels={hintStaleLabels}
            currentQuestion={currentQuestion}
            isPlayingTts={isPlayingTts}
            speakText={speakText}
            isLoadingHint={isLoadingHint}
            subjectCode={subjectCode}
            mascotEmotion={mascotEmotion}
            currentOutfit={currentOutfit}
            chatHistory={chatHistory}
            isSubmittingSpeech={isSubmittingSpeech}
            isListening={isListening}
            speechText={speechText}
            setSpeechText={setSpeechText}
            startListening={startListening}
            stopListening={stopListening}
            submitVoiceQuestion={submitVoiceQuestion}
            isSocraticPreferred={isSocraticPreferred}
            setIsSocraticPreferred={setIsSocraticPreferred}
          />
        </div>

      </main>

      {/* 3. Level Up Congratulatory Modal Animation Overlay */}
      <LevelUpOverlay
        isOpen={showLevelUpModal}
        levelUpTo={levelUpTo}
        onClose={() => setShowLevelUpModal(false)}
      />

      {/* 4. Lesson Complete Congratulatory Modal */}
      <ClearOverlay
        isOpen={showClearModal}
        isReview={isReview}
        questionsCount={questions.length}
        latestAttemptId={latestAttemptId}
        isGeneratingShareLink={isGeneratingShareLink}
        handleGenerateParentCelebrationLink={handleGenerateParentCelebrationLink}
        handleCloseClearModal={handleCloseClearModal}
      />

      {/* 5. Phase 10 congrats dynamic 60fps overlay */}
      {congratsData && (
        <CongratsOverlay
          isOpen={isCongratsOpen}
          onClose={() => setIsCongratsOpen(false)}
          type={congratsData.type}
          title={congratsData.title}
          subtitle={congratsData.subtitle}
          bonusXp={congratsData.bonusXp}
          badgeName={congratsData.badgeName}
          streakCount={congratsData.streakCount}
          level={congratsData.level}
        />
      )}

      {/* 6. Parent Celebration Link Share Modal */}
      <ParentShareModal
        isOpen={showCelebrationShareModal}
        onClose={() => setShowCelebrationShareModal(false)}
        shareLink={shareLink}
      />

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
