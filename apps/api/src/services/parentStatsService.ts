import { mathGrade1Curriculum } from '@rakkyo/curriculum';

// Helper to format Date into JST YYYY-MM-DD
export function getJstDateString(date: Date): string {
  const jstTime = date.getTime() + (9 * 60 * 60 * 1000);
  const jstDate = new Date(jstTime);
  return jstDate.toISOString().split('T')[0];
}

export interface ParentStats {
  summary: {
    totalActiveDays: number;
    totalAttempts: number;
    correctAttempts: number;
    accuracyRate: number;
    totalHintsUsed: number;
    gritScore: number;
    totalStudyTimeMinutes: number;
  };
  dailyActivity: {
    date: string;
    attemptsCount: number;
    correctCount: number;
    hintsCount: number;
  }[];
  topicProgress: {
    unitName: string;
    totalQuestions: number;
    attemptsCount: number;
    correctCount: number;
    accuracyRate: number;
    isCompleted: boolean;
  }[];
  hintStageUsage: {
    stage1Count: number;
    stage2Count: number;
    stage3Count: number;
  };
  weakestUnits: {
    unitName: string;
    weakestScore: number;
    accuracyRate: number;
    avgHintsUsed: number;
    retryCount: number;
    reason: string;
  }[];
  weeklyHistory: {
    label: string;
    period: string;
    totalAttempts: number;
    accuracyRate: number;
    studyTimeMinutes: number;
    gritScore: number;
  }[];
}

export function calculateParentStats(attempts: any[]): ParentStats {
  // Sort attempts by createdAt asc
  attempts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // 1. Overall Summary
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter(a => a.isCorrect).length;
  const accuracyRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  
  const uniqueDays = new Set(attempts.map(a => getJstDateString(new Date(a.createdAt))));
  const totalActiveDays = uniqueDays.size;
  
  // Calculate total study time in minutes
  const totalDurationSeconds = attempts.reduce((acc, a) => acc + (a.durationSeconds || 0), 0);
  const totalStudyTimeMinutes = Math.round(totalDurationSeconds / 60);
  
  let totalHintsUsed = 0;
  let gritAttempts = 0; // Attempts where hints were used
  let gritSuccess = 0;   // Attempts where hints were used AND answer was correct
  
  attempts.forEach(a => {
    totalHintsUsed += a.hintsUsed;
    if (a.hintsUsed > 0) {
      gritAttempts++;
      if (a.isCorrect) {
        gritSuccess++;
      }
    }
  });
  
  const gritScore = gritAttempts > 0 ? Math.round((gritSuccess / gritAttempts) * 100) : 0;
  
  // 2. Daily Activity (Last 7 Days)
  const dailyActivity = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = getJstDateString(d);
    
    const dayAttempts = attempts.filter(a => getJstDateString(new Date(a.createdAt)) === dateStr);
    const dayCorrect = dayAttempts.filter(a => a.isCorrect).length;
    const dayHints = dayAttempts.reduce((acc, a) => acc + a.hintsUsed, 0);
    
    dailyActivity.push({
      date: dateStr,
      attemptsCount: dayAttempts.length,
      correctCount: dayCorrect,
      hintsCount: dayHints
    });
  }
  
  // 3. Topic Progress & Automated Weak Unit Estimation
  const topicProgress = [];
  const unitScores = [];
  
  for (const unit of mathGrade1Curriculum.units) {
    // Collect all question IDs / prompts in this unit
    const questionIdsInUnit = new Set<string>();
    let totalQuestionsInUnit = 0;
    
    for (const lesson of unit.lessons) {
      for (const question of lesson.questions) {
        totalQuestionsInUnit++;
        if (question.id) questionIdsInUnit.add(question.id);
        questionIdsInUnit.add(question.prompt);
      }
    }
    
    const unitAttempts = attempts.filter(a => questionIdsInUnit.has(a.questionId));
    const unitCorrect = unitAttempts.filter(a => a.isCorrect).length;
    const unitAccuracy = unitAttempts.length > 0 ? Math.round((unitCorrect / unitAttempts.length) * 100) : 0;
    
    topicProgress.push({
      unitName: unit.name,
      totalQuestions: totalQuestionsInUnit,
      attemptsCount: unitAttempts.length,
      correctCount: unitCorrect,
      accuracyRate: unitAccuracy,
      isCompleted: unitCorrect >= Math.min(totalQuestionsInUnit, 5)
    });
    
    // Calculate weak unit analytics if there are attempts
    if (unitAttempts.length > 0) {
      const totalHints = unitAttempts.reduce((acc, a) => acc + a.hintsUsed, 0);
      const avgHints = totalHints / unitAttempts.length;
      
      const uniqueQuestions = new Set(unitAttempts.map(a => a.questionId));
      const uniqueCount = uniqueQuestions.size;
      const retryRate = uniqueCount > 0 ? (unitAttempts.length - uniqueCount) / uniqueCount : 0;
      
      // Weakest Score = (100 - accuracy) * 0.4 + (avgHints / 3 * 100) * 0.4 + (retryRate * 100) * 0.2
      const accuracyComp = (100 - unitAccuracy) * 0.4;
      const hintComp = Math.min(100, (avgHints / 3) * 100) * 0.4;
      const retryComp = Math.min(100, retryRate * 100) * 0.2;
      const weakestScore = Math.round(accuracyComp + hintComp + retryComp);
      
      let reasoning = "全体的にバランス良く取り組めています。";
      if (unitAccuracy < 60) {
        reasoning = `正答率が ${unitAccuracy}% と少し苦戦している様子が見られます。つまずきポイントを整理しましょう。`;
      } else if (avgHints > 1.2) {
        reasoning = "最終的な正答率は高いですが、3段階ヒントをたくさん活用してじっくり粘り強く解いています。";
      } else if (retryRate > 0.3) {
        reasoning = "間違えた問題を何度も解き直し、納得するまであきらめずに挑戦している姿勢が素晴らしいです。";
      }
      
      unitScores.push({
        unitName: unit.name,
        weakestScore,
        accuracyRate: unitAccuracy,
        avgHintsUsed: Math.round(avgHints * 10) / 10,
        retryCount: unitAttempts.length - uniqueCount,
        reason: reasoning
      });
    }
  }
  
  // Sort weak units by score descending
  unitScores.sort((a, b) => b.weakestScore - a.weakestScore);
  const weakestUnits = unitScores.slice(0, 2);
  
  // 4. Hint Stage Usage
  let stage1Count = 0;
  let stage2Count = 0;
  let stage3Count = 0;
  
  attempts.forEach(a => {
    if (a.hintsUsed >= 1) stage1Count++;
    if (a.hintsUsed >= 2) stage2Count++;
    if (a.hintsUsed >= 3) stage3Count++;
  });
  
  // 5. Weekly History (Last 4 Weeks Comparative Report)
  const weeklyHistory = [];
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  for (let w = 3; w >= 0; w--) {
    const startDaysAgo = (w + 1) * 7 - 1;
    const endDaysAgo = w * 7;
    
    const startDate = new Date(now.getTime() - startDaysAgo * oneDayMs);
    const endDate = new Date(now.getTime() - endDaysAgo * oneDayMs);
    
    const startStr = getJstDateString(startDate);
    const endStr = getJstDateString(endDate);
    
    const weekAttempts = attempts.filter(a => {
      const aDateStr = getJstDateString(new Date(a.createdAt));
      return aDateStr >= startStr && aDateStr <= endStr;
    });
    
    const weekTotal = weekAttempts.length;
    const weekCorrect = weekAttempts.filter(a => a.isCorrect).length;
    const weekAccuracy = weekTotal > 0 ? Math.round((weekCorrect / weekTotal) * 100) : 0;
    
    const weekDuration = weekAttempts.reduce((acc, a) => acc + (a.durationSeconds || 0), 0);
    const weekMinutes = Math.round(weekDuration / 60);
    
    let weekGritAttempts = 0;
    let weekGritSuccess = 0;
    weekAttempts.forEach(a => {
      if (a.hintsUsed > 0) {
        weekGritAttempts++;
        if (a.isCorrect) weekGritSuccess++;
      }
    });
    const weekGritScore = weekGritAttempts > 0 ? Math.round((weekGritSuccess / weekGritAttempts) * 100) : 0;
    
    weeklyHistory.push({
      label: w === 0 ? "今週" : `${w}週間前`,
      period: `${startStr.slice(5)} 〜 ${endStr.slice(5)}`,
      totalAttempts: weekTotal,
      accuracyRate: weekAccuracy,
      studyTimeMinutes: weekMinutes,
      gritScore: weekGritScore
    });
  }
  
  return {
    summary: {
      totalActiveDays,
      totalAttempts,
      correctAttempts,
      accuracyRate,
      totalHintsUsed,
      gritScore,
      totalStudyTimeMinutes
    },
    dailyActivity,
    topicProgress,
    hintStageUsage: {
      stage1Count,
      stage2Count,
      stage3Count
    },
    weakestUnits,
    weeklyHistory
  };
}
