import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Vibration,
  Animated,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, SHADOWS } from '../theme';

interface UserProfile {
  id: string;
  nickname: string;
  schoolYear: number;
  currentXp: number;
  level: number;
  streakCount: number;
  badges: string[];
  isMock: boolean;
}

interface ParentMessage {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function HomeScreen({ navigation, route }: any) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [mascotMessage, setMascotMessage] = useState('');
  const [parentMessages, setParentMessages] = useState<ParentMessage[]>([]);
  const [latestUnreadMessage, setLatestUnreadMessage] = useState<ParentMessage | null>(null);
  const [showReactionEffect, setShowReactionEffect] = useState(false);
  const [bounceValue] = useState(new Animated.Value(1));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [translateYAnim] = useState(new Animated.Value(0));

  const fetchParentMessages = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/parent/message', {
        headers: {
          'Authorization': 'Bearer mobile_mock_token'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const msgs = data.messages || [];
        setParentMessages(msgs);
        const unread = msgs.find((m: any) => !m.isRead);
        setLatestUnreadMessage(unread || null);
      } else {
        throw new Error("API error");
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch parent messages for mobile. Using offline fallback.");
      const fallbackMsgs = [
        { id: "demo_mobile_1", message: "ヒントを読んで自分で解けて凄いね！その調子だよ🧅", isRead: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        { id: "demo_mobile_2", message: "今日の問題もよくがんばりました！", isRead: false, createdAt: new Date().toISOString() }
      ];
      setParentMessages(fallbackMsgs);
      const unread = fallbackMsgs.find(m => !m.isRead);
      setLatestUnreadMessage(unread || null);
    }
  };

  const handleReadMessage = async (msgId: string) => {
    Vibration.vibrate(100);
    setShowReactionEffect(true);
    
    // Scale bounce + Floating Reaction Animated Sequence
    fadeAnim.setValue(0);
    translateYAnim.setValue(0);
    
    Animated.parallel([
      Animated.sequence([
        Animated.timing(bounceValue, { toValue: 1.3, duration: 150, useNativeDriver: true }),
        Animated.spring(bounceValue, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true })
      ]),
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 1000, delay: 500, useNativeDriver: true }),
          Animated.timing(translateYAnim, { toValue: -150, duration: 1500, useNativeDriver: true })
        ])
      ])
    ]).start();

    try {
      const response = await fetch(`http://localhost:4000/api/parent/message/${msgId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer mobile_mock_token'
        }
      });
      if (response.ok) {
        setLatestUnreadMessage(null);
        setParentMessages(prev => prev.map(m => m.id === msgId ? { ...m, isRead: true } : m));
      } else {
        throw new Error("API error");
      }
    } catch (e) {
      console.warn("⚠️ Failed to mark message read on server. Updating offline state.");
      setLatestUnreadMessage(null);
      setParentMessages(prev => prev.map(m => m.id === msgId ? { ...m, isRead: true } : m));
    }
    
    setTimeout(() => {
      setShowReactionEffect(false);
    }, 2000);
  };

  useEffect(() => {
    // Check for user parameter from route, or fallback
    const routeUser = route.params?.user;
    if (routeUser) {
      setUser(routeUser);
      setMascotMessage(`ようこそ、${routeUser.nickname}ちゃん！今日もいっしょに大冒険しよう！`);
    } else {
      // Direct access fallback
      const defaultUser: UserProfile = {
        id: 'mobile_default',
        nickname: '冒険者',
        schoolYear: 1,
        currentXp: 40,
        level: 1,
        streakCount: 3,
        badges: ['🎉 冒険のはじまり', '🐣 ラッキョメイト'],
        isMock: true,
      };
      setUser(defaultUser);
      setMascotMessage(`ようこそ！今日もいっしょに大冒険しよう！`);
    }
    fetchParentMessages();
  }, [route.params?.user]);

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>ぼうけんの準備中...</Text>
      </View>
    );
  }

  const xpNeeded = user.level * 100;
  const xpPercentage = Math.min(100, Math.floor((user.currentXp / xpNeeded) * 100));

  const subjects = [
    { code: 'math', name: '数と方程式の冒険', label: '中1数学', qCount: '30問', desc: '正負の数、文字式、方程式のパズルを解いて魔王をたおそう！', theme: COLORS.math },
    { code: 'english', name: 'アルファベットと言葉', label: '中1英語', qCount: '30問', desc: '英単語のスペルや挨拶、be動詞と一般動詞の会話パズル！', theme: COLORS.english },
    { code: 'science', name: '身のまわりの不思議', label: '中1理科', qCount: '30問', desc: '身のまわりの植物、光や音、物質のなぞを解き明かそう！', theme: COLORS.science },
    { code: 'social', name: '世界の地理と歴史', label: '中1社会', qCount: '30問', desc: '世界の国々や歴史の流れ、くらしの工夫を発見する旅へ！', theme: COLORS.social },
    { code: 'japanese', name: 'ことばと言葉の冒険', label: '中1国語', qCount: '30問', desc: '漢字や語彙、言葉のきまり、文章の正しい読み解き方をマスター！', theme: COLORS.japanese },
  ];

  const handleSelectSubject = (subjectCode: string) => {
    navigation.navigate('SubjectRoadmap', { subjectCode, user });
  };

  const handleStartReview = () => {
    // Direct lesson navigation for review
    navigation.navigate('Lesson', { lessonId: '1', review: true, subjectCode: 'math', user });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* 1. Header Row */}
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <View style={[styles.headerEmojiBg, SHADOWS.bubbly]}>
              <Text style={styles.headerEmoji}>📐</Text>
            </View>
            <View>
              <Text style={styles.headerTitle}>Rakkyo</Text>
              <Text style={styles.headerSubtitle}>中学1年生 5教科ファンタジー</Text>
            </View>
          </View>
          <View style={styles.headerStats}>
            <View style={[styles.statBadge, { backgroundColor: COLORS.purple.bg, borderColor: COLORS.purple.border }]}>
              <Text style={[styles.statBadgeText, { color: COLORS.purple.text }]}>Lv.{user.level}</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: COLORS.social.bg, borderColor: COLORS.social.border }]}>
              <Text style={[styles.statBadgeText, { color: COLORS.social.text }]}>🔥 {user.streakCount}日</Text>
            </View>
          </View>
        </View>

        {/* 2. Welcome Mascot Bubble Section */}
        <View style={[
          styles.mascotSection,
          latestUnreadMessage && { borderColor: COLORS.pink.border, borderWidth: 3 }
        ]}>
          <Animated.View style={[
            styles.mascotWrapper,
            { transform: [{ scale: bounceValue }] }
          ]}>
            {latestUnreadMessage && (
              <Text style={{ position: 'absolute', top: -10, right: -10, fontSize: 18, zIndex: 10 }}>✉️</Text>
            )}
            <Svg viewBox="0 0 100 100" style={styles.mascot}>
              {/* Scallion Body */}
              <Path
                d="M50,15 C28,30 25,65 30,80 C34,92 66,92 70,80 C75,65 72,30 50,15 Z"
                fill="#F7FEE7"
                stroke="#A3E635"
                strokeWidth="4"
              />
              {/* Top Sprouts */}
              <Path
                d="M50,15 Q40,2 43,0 Q47,5 50,15 Z"
                fill="#4ADE80"
                stroke="#22C55E"
                strokeWidth="2.5"
              />
              <Path
                d="M50,15 Q60,2 57,0 Q53,5 50,15 Z"
                fill="#4ADE80"
                stroke="#22C55E"
                strokeWidth="2.5"
              />
              {/* Rosy Cheeks */}
              <Circle cx="38" cy="66" r="6" fill="#FBCFE8" />
              <Circle cx="62" cy="66" r="6" fill="#FBCFE8" />
              {/* Happy Eyes */}
              <Path d="M35,58 Q40,54 45,58" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
              <Path d="M55,58 Q60,54 65,58" fill="none" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
              {/* Smiling Mouth */}
              <Path
                d="M47,68 Q50,73 53,68"
                fill="none"
                stroke="#1E293B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>

          <View style={styles.mascotBubble}>
            {latestUnreadMessage ? (
              <View style={[styles.bubbleContent, { backgroundColor: COLORS.pink.bg, borderColor: COLORS.pink.border, borderWidth: 1.5 }]}>
                <Text style={[styles.unreadBadge, { color: COLORS.pink.text }]}>🧅 おうちのひとから おてがみだよ！</Text>
                <Text style={styles.bubbleTextUnread}>「 {latestUnreadMessage.message} 」</Text>
                <TouchableOpacity
                  style={[styles.readButton, { backgroundColor: COLORS.pink.dark }]}
                  onPress={() => handleReadMessage(latestUnreadMessage.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.readButtonText}>よんだよ！ 👍</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.bubbleContent, { backgroundColor: COLORS.science.bg, borderColor: COLORS.science.border }]}>
                <Text style={styles.bubbleText}>{mascotMessage}</Text>
              </View>
            )}
            <View style={styles.xpProgressContainer}>
              <View style={styles.xpLabelContainer}>
                <Text style={styles.xpLabel}>レベルアップまで</Text>
                <Text style={styles.xpValue}>{user.currentXp} / {xpNeeded} XP ({xpPercentage}%)</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${xpPercentage}%` }]} />
              </View>
            </View>
          </View>
        </View>

        {/* 3. Review Mission Card */}
        <View style={[styles.reviewCard, { backgroundColor: COLORS.pink.bg, borderColor: COLORS.pink.border }]}>
          <Text style={[styles.reviewHeader, { color: COLORS.pink.text }]}>🔥 にがて克服ミッション！</Text>
          <View style={styles.reviewContent}>
            <Text style={styles.reviewEmoji}>🧅</Text>
            <View style={styles.reviewTextContainer}>
              <Text style={styles.reviewTitle}>数と方程式</Text>
              <Text style={styles.reviewDesc}>まちがえた問題や、ヒントをたくさん使った問題だよ！完璧にマスターしよう！</Text>
              <View style={[styles.bonusTag, { backgroundColor: COLORS.yellow.bg, borderColor: COLORS.yellow.border }]}>
                <Text style={[styles.bonusTagText, { color: COLORS.yellow.text }]}>💎 報酬: クリア時に +15 XP ボーナス！</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={[styles.reviewButton, { backgroundColor: COLORS.pink.dark, borderColor: '#7F1D1D' }]} onPress={handleStartReview}>
            <Text style={styles.reviewButtonText}>にがてを克服する！ 💪</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Subject Cards List */}
        <Text style={styles.sectionTitle}>🧭 ぼうけんする教科をえらぼう！</Text>
        
        {subjects.map((subject, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.subjectCard,
              { backgroundColor: subject.theme.bg, borderColor: subject.theme.border },
              SHADOWS.bubbly,
            ]}
            onPress={() => handleSelectSubject(subject.code)}
            activeOpacity={0.9}
          >
            <View style={styles.subjectCardHeader}>
              <View style={[styles.subjectLabelBg, { backgroundColor: `${subject.theme.text}1A`, borderColor: subject.theme.border }]}>
                <Text style={[styles.subjectLabelText, { color: subject.theme.text }]}>{subject.label}</Text>
              </View>
              <Text style={styles.subjectCount}>{subject.qCount}</Text>
            </View>
            
            <Text style={styles.subjectName}>{subject.name}</Text>
            <Text style={styles.subjectDesc}>{subject.desc}</Text>
            
            <View style={[styles.startBadge, { backgroundColor: subject.theme.dark, borderColor: `${subject.theme.text}80` }]}>
              <Text style={styles.startBadgeText}>冒険をはじめる！ 🗺️</Text>
            </View>

            <Text style={styles.subjectBgEmoji}>{subject.theme.emoji}</Text>
          </TouchableOpacity>
        ))}

      </ScrollView>

      {/* Floating Reaction Overlay */}
      {showReactionEffect && (
        <Animated.View 
          style={[
            styles.reactionOverlay, 
            { 
              opacity: fadeAnim, 
              transform: [{ translateY: translateYAnim }] 
            }
          ]} 
          pointerEvents="none"
        >
          <Text style={styles.reactionEmoji}>👍</Text>
          <Text style={[styles.reactionEmoji, { fontSize: 48 }]}>❤️</Text>
          <Text style={[styles.reactionEmoji, { fontSize: 32 }]}>🧅</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slate.muted,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.slate.border,
    borderRadius: 24,
    padding: 12,
    marginBottom: 20,
    ...SHADOWS.bubbly,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerEmojiBg: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.science.bg,
    borderWidth: 2,
    borderColor: COLORS.science.border,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerEmoji: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.slate.dark,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate.muted,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 6,
  },
  statBadge: {
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  mascotSection: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.slate.border,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    ...SHADOWS.bubbly,
  },
  mascotWrapper: {
    width: 70,
    height: 70,
    marginRight: 12,
  },
  mascot: {
    width: '100%',
    height: '100%',
  },
  mascotBubble: {
    flex: 1,
  },
  bubbleContent: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 10,
    marginBottom: 8,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 18,
  },
  unreadBadge: {
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 4,
  },
  bubbleTextUnread: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.slate.dark,
    lineHeight: 18,
    backgroundColor: '#FFFFFF90',
    padding: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  readButton: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  readButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
  },
  reactionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    zIndex: 9999,
  },
  reactionEmoji: {
    fontSize: 40,
  },
  xpProgressContainer: {
    width: '100%',
  },
  xpLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  xpLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.slate.muted,
  },
  xpValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.slate.muted,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.purple.text,
    borderRadius: 6,
  },
  reviewCard: {
    borderWidth: 2,
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
    ...SHADOWS.bubbly,
  },
  reviewHeader: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  reviewContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  reviewEmoji: {
    fontSize: 32,
    marginRight: 10,
  },
  reviewTextContainer: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate.dark,
    marginBottom: 2,
  },
  reviewDesc: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 16,
    marginBottom: 6,
  },
  bonusTag: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  bonusTagText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  reviewButton: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: 'center',
    ...SHADOWS.bubbly,
  },
  reviewButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.slate.dark,
    marginBottom: 12,
    paddingLeft: 4,
  },
  subjectCard: {
    borderWidth: 2.5,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  subjectCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectLabelBg: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  subjectLabelText: {
    fontSize: 11,
    fontWeight: '900',
  },
  subjectCount: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate.muted,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.slate.dark,
    marginBottom: 4,
  },
  subjectDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 18,
    marginBottom: 16,
    paddingRight: 60, // Avoid overlapping with huge emoji
  },
  startBadge: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    ...SHADOWS.bubbly,
  },
  startBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },
  subjectBgEmoji: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    fontSize: 80,
    opacity: 0.15,
  },
});
