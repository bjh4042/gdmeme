/**
 * Teaching Engine Part 4-3 — Learning Progress Engine
 *
 * 역할: 학생의 학습 변화·성장 정도를 분석한다.
 *   ❌ TeachingDecision/Planner를 변경하지 않는다.
 *   ❌ 학생에게 점수/Mastery/Risk/Trend 수치를 노출하지 않는다.
 *   ✅ Response Generator가 칭찬/힌트/격려를 조정할 근거만 제공한다.
 *   ✅ 단발 성공/실패로 Mastery가 급변하지 않도록 스무딩.
 */
import type {
  EkluResult,
  EkluTurn,
  LearningStage,
  StudentModel,
} from "./eklu-engine";
import type {
  ConversationMemory,
  LearningMemory,
  PedagogicalGoal,
} from "./teaching-planner";
import type { Persona } from "./student-persona";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Trend = "improving" | "stable" | "declining" | "recovering" | "new";
export type Level3 = "low" | "medium" | "high";
export type RiskLevel = "none" | "low" | "medium" | "high";

export type Recommendation =
  | "maintain"
  | "more_encouragement"
  | "reduce_hint"
  | "increase_hint"
  | "more_reflection"
  | "celebrate_progress";

export type ProgressHistoryEntry = {
  t: number;
  goal: PedagogicalGoal;
  stage: LearningStage;
  mastery: number; // 0..100
  engagement: number; // 0..100
  risk: RiskLevel;
  trend: Trend;
};

export type ExtendedLearningMemory = LearningMemory & {
  successCount?: number;
  attemptCount?: number;
  practiceHistory?: string[];
  goalHistory?: PedagogicalGoal[];
  progressHistory?: ProgressHistoryEntry[];
  masteryHistory?: number[];
  engagementHistory?: number[];
  riskHistory?: RiskLevel[];
  trendHistory?: Trend[];
  recurring?: boolean;
  mastered?: boolean;
};

export type ProgressInput = {
  understanding?: EkluResult;
  studentModel?: StudentModel;
  learningMemory?: ExtendedLearningMemory;
  conversationMemory?: ConversationMemory & { history?: EkluTurn[] };
  currentGoal: PedagogicalGoal;
  currentStage: LearningStage;
  persona?: Persona;
  now?: number;
};

export type ProgressResult = {
  trend: Trend;
  mastery: number; // 0..100
  stability: Level3;
  engagement: Level3;
  risk: RiskLevel;
  recommendation: Recommendation;
  reason: string; // 내부 로그용
  updatedMemory: ExtendedLearningMemory;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function successRate(mem: ExtendedLearningMemory): number {
  const a = mem.attemptCount ?? 0;
  const s = mem.successCount ?? 0;
  if (a <= 0) return 0;
  return s / a;
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

function slope(nums: number[]): number {
  // 선형 회귀 기울기 (간단 버전)
  const n = nums.length;
  if (n < 2) return 0;
  const xs = nums.map((_, i) => i);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = nums.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (nums[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ─────────────────────────────────────────────────────────────
// Mastery — 정답만이 아니라 여러 요소 종합 (0..100)
// ─────────────────────────────────────────────────────────────

function computeMastery(input: ProgressInput): number {
  const mem = input.learningMemory ?? {};
  const model = input.studentModel ?? input.understanding?.studentModel;

  // 기본 성공률(0..1) → 40점
  const base = successRate(mem) * 40;

  // 성찰/공감/표현 역량 (StudentModel은 0..5) → 30점
  const empathy = ((model?.empathyLevel ?? 1.5) / 5) * 15;
  const expression = ((model?.expressionCompleteness ?? 1.5) / 5) * 15;

  // 힌트 의존도 감산 — 최근 힌트 레벨이 높을수록 감산 → -15
  const lastHint = (input.conversationMemory?.lastHintLevel as number) ?? 0;
  const hintPenalty = Math.min(15, lastHint * 3);

  // 오개념/재시도 감산 → -15
  const misCount = mem.misconceptionSeen?.length ?? 0;
  const recurringPenalty = (mem.recurring ? 8 : 0) + Math.min(7, misCount * 2);

  // 반성적 인정/사과 가산 → +10
  const intent = input.understanding?.intentAnalysis?.primary;
  const reflectiveBonus =
    intent === "apology" || intent === "empathy" ? 10 : 0;

  // 관찰 안정성(0..1) → 최대 10
  const stability = (model?.stability ?? 0.3) * 10;

  const raw =
    base + empathy + expression - hintPenalty - recurringPenalty + reflectiveBonus + stability;

  // 이전 mastery와 스무딩(급변 방지, α=0.35)
  const prev = mem.masteryHistory?.[mem.masteryHistory.length - 1];
  const smoothed = prev != null ? prev * 0.65 + raw * 0.35 : raw;
  return Math.round(clamp(smoothed));
}

// ─────────────────────────────────────────────────────────────
// Engagement — 응답 길이/빈도/질문/자발성 (0..100)
// ─────────────────────────────────────────────────────────────

function computeEngagement(input: ProgressInput): number {
  const u = input.understanding;
  const text = u?.normalization?.normalizedText ?? u?.normalized ?? "";
  const len = text.trim().length;
  const questions = (text.match(/[?？]/g) ?? []).length;
  const model = input.studentModel ?? u?.studentModel;
  const avgLen = model?.avgReplyLength ?? 0;
  const engModel = ((model?.engagement ?? 1.5) / 5) * 40;

  const lengthScore = Math.min(30, len * 0.6);
  const avgLenScore = Math.min(15, avgLen * 0.4);
  const questionBonus = Math.min(15, questions * 5);

  const raw = engModel + lengthScore + avgLenScore + questionBonus;

  const prev =
    input.learningMemory?.engagementHistory?.[
      input.learningMemory.engagementHistory.length - 1
    ];
  const smoothed = prev != null ? prev * 0.6 + raw * 0.4 : raw;
  return Math.round(clamp(smoothed));
}

// ─────────────────────────────────────────────────────────────
// Trend — 최근 mastery 변화
// ─────────────────────────────────────────────────────────────

function computeTrend(masteryHist: number[], newMastery: number): Trend {
  const series = [...masteryHist, newMastery].slice(-10);
  if (series.length < 3) return "new";
  const recent = series.slice(-5);
  const older = series.slice(0, Math.max(1, series.length - 5));
  const s = slope(recent);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const dip = Math.min(...series.slice(0, -3));
  const rebound = newMastery - dip;

  if (s > 1.5 && recentAvg >= olderAvg) return "improving";
  if (s < -1.5 && recentAvg < olderAvg) return "declining";
  if (rebound >= 8 && recentAvg > olderAvg - 5) return "recovering";
  return "stable";
}

// ─────────────────────────────────────────────────────────────
// Stability — 최근 10회 mastery 변동성
// ─────────────────────────────────────────────────────────────

function computeStability(masteryHist: number[]): Level3 {
  const series = masteryHist.slice(-10);
  if (series.length < 3) return "low";
  const sd = stdev(series);
  if (sd < 6) return "high";
  if (sd < 14) return "medium";
  return "low";
}

// ─────────────────────────────────────────────────────────────
// Risk — 반복 오개념, 방어, 포기, 참여 감소
// ─────────────────────────────────────────────────────────────

const GIVEUP_RE = /(그만할래|안 할래|하기 싫|귀찮|모르겠어요\.?$)/;

function computeRisk(
  input: ProgressInput,
  engagement: number,
  masteryHist: number[],
): RiskLevel {
  const mem = input.learningMemory ?? {};
  const u = input.understanding;
  const text = u?.normalization?.normalizedText ?? u?.normalized ?? "";

  let score = 0;
  if (mem.recurring) score += 2;
  if ((mem.misconceptionSeen?.length ?? 0) >= 3) score += 1;
  if (u?.defensiveResponse?.detected) score += 2;
  if ((mem.blameShiftCount ?? 0) >= 3) score += 1;
  if ((mem.giveUpCount ?? 0) >= 2) score += 2;
  if (GIVEUP_RE.test(text)) score += 2;
  if (engagement < 25) score += 2;

  // 최근 마스터리 급락
  if (masteryHist.length >= 3) {
    const last = masteryHist[masteryHist.length - 1];
    const prev = masteryHist[masteryHist.length - 3];
    if (last < prev - 15) score += 2;
  }

  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  if (score >= 1) return "low";
  return "none";
}

// ─────────────────────────────────────────────────────────────
// Recommendation
// ─────────────────────────────────────────────────────────────

function recommend(
  trend: Trend,
  mastery: number,
  risk: RiskLevel,
  persona?: Persona,
): Recommendation {
  if (risk === "high") return "more_encouragement";
  if (trend === "improving") return "celebrate_progress";
  if (trend === "recovering") return "celebrate_progress";
  if (trend === "declining") return "more_encouragement";

  if (mastery >= 75) {
    if (persona === "confident_learner") return "reduce_hint";
    return "more_reflection";
  }
  if (mastery <= 35) return "increase_hint";

  if (persona === "anxious_learner" || persona === "shy_learner")
    return "more_encouragement";

  return "maintain";
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function analyzeLearningProgress(input: ProgressInput): ProgressResult {
  const mem = input.learningMemory ?? {};
  const masteryHist = mem.masteryHistory ?? [];
  const engagementHist = mem.engagementHistory ?? [];
  const trendHist = mem.trendHistory ?? [];
  const riskHist = mem.riskHistory ?? [];
  const progressHist = mem.progressHistory ?? [];

  const mastery = computeMastery(input);
  const engagementScore = computeEngagement(input);
  const engagement: Level3 =
    engagementScore >= 65 ? "high" : engagementScore >= 35 ? "medium" : "low";
  const trend = computeTrend(masteryHist, mastery);
  const stability = computeStability([...masteryHist, mastery]);
  const risk = computeRisk(input, engagementScore, [...masteryHist, mastery]);
  const recommendation = recommend(trend, mastery, risk, input.persona);

  const now = input.now ?? Date.now();
  const nextEntry: ProgressHistoryEntry = {
    t: now,
    goal: input.currentGoal,
    stage: input.currentStage,
    mastery,
    engagement: engagementScore,
    risk,
    trend,
  };

  const updatedMemory: ExtendedLearningMemory = {
    ...mem,
    masteryHistory: [...masteryHist, mastery].slice(-30),
    engagementHistory: [...engagementHist, engagementScore].slice(-30),
    trendHistory: [...trendHist, trend].slice(-30),
    riskHistory: [...riskHist, risk].slice(-30),
    progressHistory: [...progressHist, nextEntry].slice(-50),
  };

  const reason =
    `trend=${trend} mastery=${mastery} eng=${engagementScore}(${engagement}) ` +
    `stab=${stability} risk=${risk} rec=${recommendation}`;

  return {
    trend,
    mastery,
    stability,
    engagement,
    risk,
    recommendation,
    reason,
    updatedMemory,
  };
}

/**
 * Generator 문구 조정용 헬퍼.
 * 이 함수는 문장 자체를 만들지 않는다 (성장 칭찬/회복/하락 톤만 제안).
 */
export function toneForProgress(
  result: ProgressResult,
): "growth_praise" | "gentle_retry" | "recovery_praise" | "neutral" {
  if (result.trend === "improving") return "growth_praise";
  if (result.trend === "recovering") return "recovery_praise";
  if (result.trend === "declining") return "gentle_retry";
  return "neutral";
}
