import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, SHADOWS } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const [nickname, setNickname] = useState('');

  const handleStart = () => {
    if (!nickname.trim()) {
      alert('ニックネームをいれてね！');
      return;
    }

    const mockUser = {
      id: 'mobile_user_' + Date.now(),
      nickname: nickname.trim(),
      schoolYear: 1,
      currentXp: 40,
      level: 1,
      streakCount: 3,
      badges: ['🎉 冒険のはじまり', '🐣 ラッキョメイト'],
      isMock: true,
    };

    navigation.replace('Home', { user: mockUser });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} bounces={false}>
        <View style={styles.card}>
          {/* Cute Mascot Header */}
          <View style={styles.mascotContainer}>
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
              {/* Cute mini adventurer hat */}
              <Path
                d="M32,32 Q50,22 68,32 L64,28 Q50,18 36,28 Z"
                fill="#F43F5E"
                stroke="#BE123C"
                strokeWidth="2"
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
          </View>

          <Text style={styles.title}>Rakkyo</Text>
          <Text style={styles.subtitle}>〜 中学1年生 5教科ファンタジー 〜</Text>

          <View style={styles.bubbleMessage}>
            <Text style={styles.bubbleText}>
              やあ！ぼく「ラッキョくん」だよ！きみのニックネームをおしえてね！いっしょに大冒険にでかけよう！
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>ニックネーム</Text>
            <TextInput
              style={styles.input}
              placeholder="例: たろう、はなこ"
              placeholderTextColor={COLORS.slate.muted}
              value={nickname}
              onChangeText={setNickname}
              maxLength={15}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleStart} activeOpacity={0.8}>
            <Text style={styles.buttonText}>ぼうけんをはじめる！ 🗺️</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: COLORS.slate.border,
    padding: 24,
    alignItems: 'center',
    ...SHADOWS.bubbly,
  },
  mascotContainer: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  mascot: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.slate.dark,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate.muted,
    marginTop: 4,
    marginBottom: 20,
  },
  bubbleMessage: {
    backgroundColor: COLORS.math.bg,
    borderWidth: 2,
    borderColor: COLORS.math.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  bubbleText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 22,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.slate.dark,
    marginBottom: 8,
    paddingLeft: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: COLORS.slate.border,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slate.dark,
  },
  button: {
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#047857',
    borderRadius: 20,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.bubbly,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
});
