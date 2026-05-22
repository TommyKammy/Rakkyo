import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { allCurriculums } from '@rakkyo/curriculum';
import { COLORS, SHADOWS } from '../theme';

export default function SubjectRoadmapScreen({ route, navigation }: any) {
  const { subjectCode, user } = route.params;

  // Find correct curriculum from curriculum data
  const curriculum = allCurriculums.find((c) => c.code === subjectCode);

  if (!curriculum) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>教科のデータが見つからなかったよ 😢</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>ホームにもどる</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Set colors based on subject code
  const subjectTheme = (COLORS as any)[subjectCode] || COLORS.math;

  const handleStartLesson = (lesson: any, unitName: string) => {
    // Navigate to dynamic lesson runner
    navigation.navigate('Lesson', {
      lessonId: lesson.order.toString(),
      subjectCode,
      unitName,
      lessonName: lesson.name,
      questions: lesson.questions,
      user,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Dynamic Header */}
      <View style={[styles.header, { backgroundColor: subjectTheme.bg, borderColor: subjectTheme.border }]}>
        <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
          <Text style={[styles.headerBackText, { color: subjectTheme.text }]}>◀ ホーム</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: subjectTheme.dark }]}>
          {curriculum.name}のぼうけん
        </Text>
        <Text style={styles.headerEmoji}>{subjectTheme.emoji}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Course Intro */}
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>🗺️ ぼうけんの書</Text>
          <Text style={styles.introDesc}>
            {curriculum.name}の全 {curriculum.units.length} つの島（ユニット）を大冒険しよう！パズルを解くと宝箱（XP）がもらえるよ！
          </Text>
        </View>

        {/* Units / Island Map list */}
        {curriculum.units.map((unit: any, uIdx: number) => (
          <View key={uIdx} style={styles.unitContainer}>
            
            {/* Unit Title Header */}
            <View style={[styles.unitHeader, { backgroundColor: COLORS.slate.bg, borderColor: COLORS.slate.border }]}>
              <View style={[styles.unitNumberBg, { backgroundColor: subjectTheme.dark }]}>
                <Text style={styles.unitNumberText}>島 {unit.order}</Text>
              </View>
              <View style={styles.unitHeaderDetails}>
                <Text style={styles.unitName}>{unit.name}</Text>
                <Text style={styles.unitDesc}>{unit.description}</Text>
              </View>
            </View>

            {/* Path Steps (Sugoroku Layout) */}
            <View style={styles.lessonsPath}>
              {unit.lessons.map((lesson: any, lIdx: number) => {
                // Alternating bubble layout to make it look like a map path
                const isLeft = lIdx % 2 === 0;
                
                return (
                  <View
                    key={lIdx}
                    style={[
                      styles.pathRow,
                      { justifyContent: isLeft ? 'flex-start' : 'flex-end' },
                    ]}
                  >
                    <TouchableOpacity
                      style={[
                        styles.lessonButton,
                        { borderColor: subjectTheme.border, backgroundColor: subjectTheme.bg },
                        SHADOWS.bubbly,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleStartLesson(lesson, unit.name)}
                    >
                      <View style={[styles.lessonBubble, { backgroundColor: subjectTheme.text }]}>
                        <Text style={styles.lessonBubbleText}>★</Text>
                      </View>
                      <View style={styles.lessonTextWrapper}>
                        <Text style={styles.lessonOrder}>第 {lesson.order} 関門</Text>
                        <Text style={styles.lessonNameText} numberOfLines={1}>
                          {lesson.name}
                        </Text>
                        <Text style={styles.questionCountTag}>
                          📝 {lesson.questions.length}問
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
            
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.slate.text,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.math.dark,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 3,
  },
  headerBack: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerBackText: {
    fontSize: 14,
    fontWeight: '900',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  headerEmoji: {
    fontSize: 22,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  introCard: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.slate.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    ...SHADOWS.bubbly,
  },
  introTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.slate.dark,
    marginBottom: 4,
  },
  introDesc: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate.text,
    lineHeight: 18,
  },
  unitContainer: {
    marginBottom: 28,
  },
  unitHeader: {
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    ...SHADOWS.bubbly,
  },
  unitNumberBg: {
    width: 50,
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  unitNumberText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
  },
  unitHeaderDetails: {
    flex: 1,
  },
  unitName: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.slate.dark,
  },
  unitDesc: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate.muted,
    marginTop: 2,
  },
  lessonsPath: {
    paddingHorizontal: 20,
  },
  pathRow: {
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
  },
  lessonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2.5,
    borderRadius: 20,
    padding: 12,
    width: '80%',
  },
  lessonBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  lessonBubbleText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },
  lessonTextWrapper: {
    flex: 1,
  },
  lessonOrder: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slate.muted,
  },
  lessonNameText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.slate.dark,
    marginVertical: 1,
  },
  questionCountTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.slate.muted,
  },
});
