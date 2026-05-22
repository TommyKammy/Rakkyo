import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, SHADOWS } from '../theme';

interface Question {
  id?: string;
  type: 'MULTIPLE_CHOICE' | 'NUMBER_INPUT' | 'FILL_IN_BLANK' | 'SINGLE_CHOICE' | 'NUMERIC' | 'TEXT_SHORT' | 'FILL_BLANK';
  prompt: string;
  answers: string[];
  options: string[];
  explanation: string;
  hints: string[];
}

export default function LessonScreen({ route, navigation }: any) {
  const { lessonId, subjectCode, unitName, lessonName, questions = [], user } = route.params;

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  
  // Hint drawers
  const [activeHintIndex, setActiveHintIndex] = useState<number | null>(null);
  
  // Voice synthesis states
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Chat window (Tutor Drawer)
  const [showTutor, setShowTutor] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'tutor'; text: string }>>([
    { sender: 'tutor', text: 'やあ！わからないことがあったら、なんでも聞いてね！いっしょに考えよう！' }
  ]);
  const [isTutorLoading, setIsTutorLoading] = useState(false);

  const activeQuestion: Question = questions[currentQIndex] || {
    prompt: '問題データがありません。',
    type: 'MULTIPLE_CHOICE',
    answers: [],
    options: [],
    explanation: 'データエラー',
    hints: [],
  };

  const subjectTheme = (COLORS as any)[subjectCode] || COLORS.math;

  useEffect(() => {
    // Reset state for new question
    setSelectedOption(null);
    setTextAnswer('');
    setIsAnswered(false);
    setIsCorrect(false);
    setActiveHintIndex(null);
    
    // Stop speaking when moving to a new question
    Speech.stop();
    setIsSpeaking(false);
  }, [currentQIndex]);

  // Clean TTS speaking on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleSpeak = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    
    // Normalize prompt to strip KaTeX math markup for speech synthesis
    let cleanText = activeQuestion.prompt
      .replace(/\$/g, '')
      .replace(/x/gi, 'エックス')
      .replace(/y/gi, 'ワイ')
      .replace(/-/g, 'マイナス')
      .replace(/\+/g, 'プラス')
      .replace(/=/g, 'イコール')
      .replace(/\//g, 'スラッシュ');

    if (isAnswered) {
      cleanText += `。解説。${activeQuestion.explanation}`;
    }

    try {
      await Speech.speak(cleanText, {
        language: 'ja-JP',
        rate: 0.92,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (e) {
      console.warn('Speech error:', e);
      setIsSpeaking(false);
    }
  };

  const handleCheckAnswer = () => {
    let finalAnswer = '';
    if (activeQuestion.type === 'MULTIPLE_CHOICE' || activeQuestion.type === 'SINGLE_CHOICE') {
      if (!selectedOption) {
        Alert.alert('えらんでね！', 'どれか1つ答えをえらんでタップしてね！');
        return;
      }
      finalAnswer = selectedOption;
    } else {
      if (!textAnswer.trim()) {
        Alert.alert('にゅうりょくしてね！', '答えをにゅうりょくしてね！');
        return;
      }
      finalAnswer = textAnswer.trim();
    }

    // Check against potential valid answers
    const match = activeQuestion.answers.some(
      (ans) => ans.toLowerCase().trim() === finalAnswer.toLowerCase().trim()
    );

    setIsCorrect(match);
    setIsAnswered(true);

    if (match) {
      // Add a tiny bit of speech to congratulate
      Speech.speak('せいかい！すごいよ！', { language: 'ja-JP', rate: 0.95 });
    } else {
      Speech.speak('おしい！もういちど考えてみよう！', { language: 'ja-JP', rate: 0.95 });
    }
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      // Finished all questions!
      Alert.alert('ステージクリア！ 🎉', 'すべての問題をクリアしたよ！ +20 XP ゲット！', [
        {
          text: 'ロードマップにもどる',
          onPress: () => {
            if (user) {
              user.currentXp += 20; // Simulated level up reward
              if (user.currentXp >= user.level * 100) {
                user.currentXp -= user.level * 100;
                user.level += 1;
              }
            }
            navigation.navigate('Home', { user });
          },
        },
      ]);
    }
  };

  const handleToggleHint = (idx: number) => {
    if (activeHintIndex === idx) {
      setActiveHintIndex(null);
    } else {
      setActiveHintIndex(idx);
    }
  };

  const handleSendToTutor = async () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setChatInput('');
    setIsTutorLoading(true);

    // Call API (fallback if offline or localhost cannot resolve on simulators)
    try {
      const response = await fetch('http://localhost:4000/api/ai-tutor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMsg,
          subjectCode,
          questionPrompt: activeQuestion.prompt,
          questionExplanation: activeQuestion.explanation,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages((prev) => [...prev, { sender: 'tutor', text: data.reply }]);
        setIsTutorLoading(false);
        return;
      }
    } catch (e) {
      console.warn('API connection failed. Simulating local mascot tutor logic.');
    }

    // Local simulated smart tutor responses based on questions
    setTimeout(() => {
      let reply = 'うーん、ヒントをもういちどよく読んでみてね。いっしょに式をみてみよう！';
      if (userMsg.includes('答え') || userMsg.includes('おしえて')) {
        reply = '答えをすぐに知っちゃうのはもったいないよ！ヒントをみて、もう一度計算してみよう！きみなら絶対に解けるよ！';
      } else if (userMsg.includes('わからない') || userMsg.includes('たすけて')) {
        reply = `この問題はね、「${activeQuestion.hints[0] || 'ヒント１'}」が大切だよ。ゆっくりでいいから、あてはまる数を見つけてみてね！`;
      } else {
        reply = `なるほど！${userMsg}だね。それじゃあ、問題のヒント２の「${activeQuestion.hints[1] || 'ゆっくり解こう'}」に注目してみよう！`;
      }
      setChatMessages((prev) => [...prev, { sender: 'tutor', text: reply }]);
      setIsTutorLoading(false);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: subjectTheme.bg, borderColor: subjectTheme.border }]}>
          <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
            <Text style={[styles.headerBackText, { color: subjectTheme.text }]}>◀ やめる</Text>
          </TouchableOpacity>
          <View style={styles.progressTextContainer}>
            <Text style={styles.lessonNameTitle} numberOfLines={1}>{lessonName}</Text>
            <Text style={styles.questionIndexText}>
              問題 {currentQIndex + 1} / {questions.length}
            </Text>
          </View>
          <TouchableOpacity style={styles.tutorToggleBtn} onPress={() => setShowTutor(!showTutor)}>
            <Text style={styles.tutorToggleEmoji}>🧅</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic progress bar */}
        <View style={styles.progressBarWrapper}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${((currentQIndex + 1) / questions.length) * 100}%`,
                backgroundColor: subjectTheme.text,
              },
            ]}
          />
        </View>

        <View style={styles.layoutContainer}>
          {/* Main Question Panel */}
          <ScrollView
            style={styles.mainContent}
            contentContainerStyle={styles.mainContentScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Question Text Box */}
            <View style={styles.questionCard}>
              <View style={styles.questionCardHeader}>
                <TouchableOpacity
                  style={[
                    styles.speakBtn,
                    { backgroundColor: isSpeaking ? COLORS.yellow.bg : subjectTheme.bg, borderColor: isSpeaking ? COLORS.yellow.border : subjectTheme.border }
                  ]}
                  onPress={handleSpeak}
                >
                  <Text style={styles.speakEmoji}>{isSpeaking ? '⏹️ 停止' : '🔊 よみあげる'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.questionPrompt}>
                {activeQuestion.prompt}
              </Text>
            </View>

            {/* Answer Interface */}
            {!isAnswered ? (
              <View style={styles.answerSection}>
                {activeQuestion.type === 'MULTIPLE_CHOICE' || activeQuestion.type === 'SINGLE_CHOICE' ? (
                  // Multiple choice buttons
                  <View style={styles.optionsContainer}>
                    {activeQuestion.options.map((option, oIdx) => {
                      const isSelected = selectedOption === option;
                      return (
                        <TouchableOpacity
                          key={oIdx}
                          style={[
                            styles.optionButton,
                            isSelected
                              ? { backgroundColor: subjectTheme.bg, borderColor: subjectTheme.text }
                              : { backgroundColor: COLORS.white, borderColor: COLORS.slate.border },
                            SHADOWS.bubbly,
                          ]}
                          onPress={() => setSelectedOption(option)}
                        >
                          <View
                            style={[
                              styles.optionBullet,
                              { backgroundColor: isSelected ? subjectTheme.text : COLORS.white, borderColor: subjectTheme.border }
                            ]}
                          />
                          <Text style={styles.optionText}>{option}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  // Text input
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>答えをにゅうりょく：</Text>
                    <TextInput
                      style={styles.textInput}
                      value={textAnswer}
                      onChangeText={setTextAnswer}
                      placeholder="ここに入力してね"
                      placeholderTextColor={COLORS.slate.muted}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.checkBtn, { backgroundColor: subjectTheme.dark }]}
                  onPress={handleCheckAnswer}
                >
                  <Text style={styles.checkBtnText}>答え合わせをする！ 🚀</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Answer Feedback & Explanation Card
              <View
                style={[
                  styles.feedbackCard,
                  {
                    backgroundColor: isCorrect ? COLORS.math.bg : COLORS.pink.bg,
                    borderColor: isCorrect ? COLORS.math.border : COLORS.pink.border,
                  },
                ]}
              >
                <View style={styles.feedbackHeader}>
                  <Text style={styles.feedbackEmoji}>{isCorrect ? '🎉' : '🧅'}</Text>
                  <Text
                    style={[
                      styles.feedbackTitle,
                      { color: isCorrect ? COLORS.math.text : COLORS.pink.text },
                    ]}
                  >
                    {isCorrect ? 'せいかい！すごいよ！' : 'おしい！もういちど考えてみよう！'}
                  </Text>
                </View>

                <View style={styles.explanationBox}>
                  <Text style={styles.explanationLabel}>💡 解説（かいせつ）：</Text>
                  <Text style={styles.explanationText}>
                    {activeQuestion.explanation}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.nextBtn,
                    { backgroundColor: isCorrect ? '#10B981' : COLORS.slate.dark },
                  ]}
                  onPress={handleNext}
                >
                  <Text style={styles.nextBtnText}>
                    {currentQIndex === questions.length - 1 ? '冒険をクリアする！ 🏆' : 'つぎの問題へ！ ➡️'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Accordion Hints */}
            <View style={styles.hintsSection}>
              <Text style={styles.hintsSectionTitle}>💡 ひんとの引き出し</Text>
              {activeQuestion.hints.map((hint, hIdx) => {
                const isOpen = activeHintIndex === hIdx;
                return (
                  <View key={hIdx} style={styles.hintAccordion}>
                    <TouchableOpacity
                      style={[styles.hintHeaderBtn, { borderColor: COLORS.slate.border }]}
                      onPress={() => handleToggleHint(hIdx)}
                    >
                      <Text style={styles.hintHeaderText}>ヒント {hIdx + 1}</Text>
                      <Text style={styles.hintHeaderChevron}>{isOpen ? '▼' : '▶'}</Text>
                    </TouchableOpacity>
                    {isOpen && (
                      <View style={styles.hintContent}>
                        <Text style={styles.hintText}>{hint}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

          </ScrollView>

          {/* Tutor Chat Side Drawer (Toggled by Button) */}
          {showTutor && (
            <View style={[styles.tutorDrawer, SHADOWS.bubbly]}>
              <View style={styles.tutorDrawerHeader}>
                <Text style={styles.tutorDrawerTitle}>🧅 ラッキョくんのアドバイス</Text>
                <TouchableOpacity style={styles.closeTutorBtn} onPress={() => setShowTutor(false)}>
                  <Text style={styles.closeTutorText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.chatScroll}
                contentContainerStyle={styles.chatScrollContent}
                ref={(ref) => ref?.scrollToEnd({ animated: true })}
              >
                {chatMessages.map((msg, mIdx) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <View
                      key={mIdx}
                      style={[
                        styles.chatBubbleContainer,
                        { justifyContent: isUser ? 'flex-end' : 'flex-start' },
                      ]}
                    >
                      {!isUser && <Text style={styles.tutorMiniEmoji}>🧅</Text>}
                      <View
                        style={[
                          styles.chatBubble,
                          isUser
                            ? { backgroundColor: subjectTheme.bg, borderColor: subjectTheme.border, borderBottomRightRadius: 4 }
                            : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', borderBottomLeftRadius: 4 },
                        ]}
                      >
                        <Text style={styles.chatBubbleText}>{msg.text}</Text>
                      </View>
                    </View>
                  );
                })}
                {isTutorLoading && (
                  <View style={styles.loadingBubbleContainer}>
                    <ActivityIndicator size="small" color={subjectTheme.text} />
                    <Text style={styles.loadingBubbleText}>ラッキョくんが考えているよ...</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.chatInputWrapper}>
                <TextInput
                  style={styles.chatInput}
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="わからないことをラッキョくんに質問しよう！"
                  placeholderTextColor={COLORS.slate.muted}
                />
                <TouchableOpacity
                  style={[styles.chatSendBtn, { backgroundColor: subjectTheme.dark }]}
                  onPress={handleSendToTutor}
                >
                  <Text style={styles.chatSendBtnText}>送信</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
  },
  headerBack: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerBackText: {
    fontSize: 13,
    fontWeight: '900',
  },
  progressTextContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 12,
  },
  lessonNameTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.slate.dark,
  },
  questionIndexText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate.muted,
    marginTop: 1,
  },
  tutorToggleBtn: {
    width: 38,
    height: 38,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.slate.border,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.bubbly,
  },
  tutorToggleEmoji: {
    fontSize: 18,
  },
  progressBarWrapper: {
    height: 6,
    backgroundColor: '#E2E8F0',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
  },
  layoutContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  mainContent: {
    flex: 1,
  },
  mainContentScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  questionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 2.5,
    borderColor: COLORS.slate.border,
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    ...SHADOWS.bubbly,
  },
  questionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  speakBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  speakEmoji: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.slate.dark,
  },
  questionPrompt: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.slate.dark,
    lineHeight: 24,
  },
  answerSection: {
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2.5,
    borderRadius: 18,
    padding: 16,
  },
  optionBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate.dark,
    flex: 1,
  },
  inputContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.slate.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.slate.dark,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.slate.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate.dark,
  },
  checkBtn: {
    borderWidth: 2,
    borderColor: COLORS.slate.dark,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOWS.bubbly,
  },
  checkBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
  feedbackCard: {
    borderWidth: 2.5,
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
    ...SHADOWS.bubbly,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedbackEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  explanationBox: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.slate.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  explanationLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.slate.dark,
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 18,
  },
  nextBtn: {
    borderWidth: 2,
    borderColor: COLORS.slate.dark,
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    ...SHADOWS.bubbly,
  },
  nextBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
  },
  hintsSection: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.slate.border,
    borderRadius: 20,
    padding: 16,
  },
  hintsSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.slate.dark,
    marginBottom: 12,
  },
  hintAccordion: {
    marginBottom: 8,
  },
  hintHeaderBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
  },
  hintHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate.dark,
  },
  hintHeaderChevron: {
    fontSize: 11,
    color: COLORS.slate.muted,
  },
  hintContent: {
    padding: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: COLORS.slate.border,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 16,
  },
  tutorDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    backgroundColor: COLORS.white,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.slate.border,
    zIndex: 100,
  },
  tutorDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 2,
    borderColor: COLORS.slate.border,
    backgroundColor: '#F8FAFC',
  },
  tutorDrawerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.slate.dark,
  },
  closeTutorBtn: {
    padding: 4,
  },
  closeTutorText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.slate.muted,
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    padding: 14,
    gap: 12,
  },
  chatBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  tutorMiniEmoji: {
    fontSize: 18,
    marginRight: 6,
    marginTop: 4,
  },
  chatBubble: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 10,
    maxWidth: '80%',
  },
  chatBubbleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 18,
  },
  loadingBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 24,
  },
  loadingBubbleText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.slate.muted,
  },
  chatInputWrapper: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 2,
    borderColor: COLORS.slate.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.slate.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate.dark,
    marginRight: 8,
  },
  chatSendBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chatSendBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },
});
