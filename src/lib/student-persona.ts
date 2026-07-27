/**
 * Teaching Engine Part 4-2 — Student Persona Engine
 *
 * 역할: 최근 대화 흐름을 바탕으로 학생의 학습 페르소나를 추정한다.
 *   ❌ TeachingDecision/Planner/Strategy를 변경하지 않는다.
 *   ❌ 학생에게 페르소나 라벨을 노출하지 않는다 (낙인 금지).
 *   ✅ Response Generator가 문체/질문 방식을 조정하는 데만 사용한다.
 *   ✅ 한 번의 발화로 갑자기 바뀌지 않는다 (EWMA 스무딩).
 */
import type { EkluResult, EkluTurn, StudentModel } from "./eklu-engine";
import type {
  ConversationMemory,
  LearningMemory,
} from "./teaching-planner";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Persona =
  | "shy_learner"
  | "confident_learner"
  | "defensive_learner"
  | "emotional_learner"
  | "quiet_observer"
  | "talkative_learner"
  | "anxious_learner"
  | "curious_learner";

export type PersonaConfidence = "high" | "mid" | "low";

export type PersonaTrait =
  | "talkative"
  | "hesitant"
  | "empathetic"
  | "impulsive"
  | "reflective"
  | "curious"
  | "confident"
  | "anxious"
  | "quiet"
  | "defensive";

export type TeachingAdjustments = {
  questionLength: "short" | "medium" | "long";
  sentenceLength: "short" | "medium" | "long";
  praiseFrequency: "low" | "normal" | "high";
  waitEncouragement: "off" | "on" | "strong";
  empathyStrength: "low" | "normal" | "high";
  hintPreference: "delayed" | "normal" | "eager";
  exampleFrequency: "low" | "normal" | "high";
  focusReminder: "disabled" | "enabled";
  reassurance: "off" | "on" | "strong";
  counterExample: "avoid" | "neutral" | "preferred";
  openQuestion: "avoid" | "neutral" | "preferred";
};

export type PersonaScores = Partial<Record<Persona, number>>;

export type PersonaResult = {
  persona: Persona;
  confidence: PersonaConfidence;
  traits: PersonaTrait[];
  adjustments: TeachingAdjustments;
  reason: string;
  /** 내부 유지용: 다음 턴에서 EWMA 스무딩 입력으로 사용 */
  scores: PersonaScores;
  observationCount: number;
};

export type PersonaInput = {
  understanding: EkluResult;
  studentModel?: StudentModel;
  conversationMemory?: ConversationMemory & {
    history?: EkluTurn[];
    lastPersona?: PersonaResult;
  };
  learningMemory?: LearningMemory & {
    successCount?: number;
    attemptCount?: number;
    blameShiftCount?: number;
  };
};

// ─────────────────────────────────────────────────────────────
// 신호 추출
// ─────────────────────────────────────────────────────────────

const SHORT_INPUT_LEN = 6;
const LONG_INPUT_LEN = 40;

const DONT_KNOW_RE = /(몰라요|모르겠|잘 모르|음\.\.\.|글쎄|아마도)/;
const HEDGE_RE = /(맞나요|맞아요\?|그런가요|괜찮을까요|혹시)/;
const QUESTION_RE = /(왜|어떻게|무엇|뭐|어째서|어떡)/;
const APOLOGY_RE = /(미안|죄송|사과)/;
const EMOTIONAL_RE = /(속상|억울|화나|짜증|기뻐|슬퍼|무서|외로)/;

function signalsFromInput(text: string) {
  const t = (text ?? "").trim();
  const len = t.length;
  const silent = len === 0 || /^\.+$/.test(t);
  const questionMarks = (t.match(/[?？]/g) ?? []).length;
  return {
    silent,
    short: !silent && len <= SHORT_INPUT_LEN,
    long: len >= LONG_INPUT_LEN,
    dontKnow: DONT_KNOW_RE.test(t),
    hedge: HEDGE_RE.test(t),
    questioning: QUESTION_RE.test(t) || questionMarks > 0,
    apology: APOLOGY_RE.test(t),
    emotionalWord: EMOTIONAL_RE.test(t),
    topicShift: (t.match(/(그리고|근데|아 참|아무튼)/g) ?? []).length >= 2,
  };
}

// ─────────────────────────────────────────────────────────────
// 점수 산출 (당해 턴)
// ─────────────────────────────────────────────────────────────

function scoreTurn(input: PersonaInput): PersonaScores {
  const u = input.understanding;
  const text = u.normalization?.normalizedText ?? u.normalized ?? "";
  const s = signalsFromInput(text);
  const emo = u.emotionAnalysis;
  const emotionIntensity = emo?.intensity ?? 0;
  const defensive = u.defensiveResponse?.detected ?? false;
  const confused = u.status === "insufficient_data";
  const model = input.studentModel ?? u.studentModel;
  const conf = model?.competencies?.expressionCompleteness ?? 0.3;
  const successRate =
    (input.learningMemory?.successCount ?? 0) /
    Math.max(1, input.learningMemory?.attemptCount ?? 0);

  const sc: Record<Persona, number> = {
    shy_learner: 0,
    confident_learner: 0,
    defensive_learner: 0,
    emotional_learner: 0,
    quiet_observer: 0,
    talkative_learner: 0,
    anxious_learner: 0,
    curious_learner: 0,
  };

  if (s.silent) sc.shy_learner += 2;
  if (s.short) sc.shy_learner += 1;
  if (s.dontKnow) sc.shy_learner += 2;
  if (s.short && !s.dontKnow) sc.quiet_observer += 2;

  if (defensive) sc.defensive_learner += 3;
  if (emotionIntensity >= 0.6) sc.emotional_learner += 2;
  if (s.emotionalWord) sc.emotional_learner += 1;

  if (s.long) sc.talkative_learner += 2;
  if (s.topicShift) sc.talkative_learner += 1;

  if (s.hedge) sc.anxious_learner += 2;
  if (s.dontKnow && emotionIntensity >= 0.4) sc.anxious_learner += 1;

  if (s.questioning) sc.curious_learner += 2;

  if (conf >= 0.6 && !s.hedge && !s.dontKnow) sc.confident_learner += 2;
  if (successRate >= 0.6 && !defensive) sc.confident_learner += 1;

  if (confused) sc.shy_learner += 1;

  return sc;
}

// ─────────────────────────────────────────────────────────────
// EWMA 스무딩 — 이전 페르소나 점수와 병합
// ─────────────────────────────────────────────────────────────

const ALPHA = 0.3; // 새 관찰 가중치. 급격한 전환 방지.

function mergeScores(
  prev: PersonaScores | undefined,
  next: PersonaScores,
): PersonaScores {
  const keys = new Set<Persona>([
    ...(Object.keys(prev ?? {}) as Persona[]),
    ...(Object.keys(next) as Persona[]),
  ]);
  const out: PersonaScores = {};
  for (const k of keys) {
    const p = prev?.[k] ?? 0;
    const n = next[k] ?? 0;
    out[k] = p * (1 - ALPHA) + n * ALPHA;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Adjustments 매핑
// ─────────────────────────────────────────────────────────────

const DEFAULT_ADJUST: TeachingAdjustments = {
  questionLength: "medium",
  sentenceLength: "medium",
  praiseFrequency: "normal",
  waitEncouragement: "on",
  empathyStrength: "normal",
  hintPreference: "normal",
  exampleFrequency: "normal",
  focusReminder: "disabled",
  reassurance: "off",
  counterExample: "neutral",
  openQuestion: "neutral",
};

const ADJUST_MAP: Record<Persona, Partial<TeachingAdjustments>> = {
  shy_learner: {
    questionLength: "short",
    sentenceLength: "short",
    praiseFrequency: "high",
    waitEncouragement: "strong",
    empathyStrength: "high",
    exampleFrequency: "high",
    reassurance: "strong",
  },
  confident_learner: {
    hintPreference: "delayed",
    openQuestion: "preferred",
    praiseFrequency: "low",
  },
  defensive_learner: {
    empathyStrength: "high",
    counterExample: "preferred",
    praiseFrequency: "normal",
  },
  emotional_learner: {
    empathyStrength: "high",
    waitEncouragement: "strong",
    questionLength: "short",
  },
  quiet_observer: {
    waitEncouragement: "strong",
    praiseFrequency: "high",
    questionLength: "short",
  },
  talkative_learner: {
    questionLength: "short",
    sentenceLength: "medium",
    focusReminder: "enabled",
  },
  anxious_learner: {
    reassurance: "strong",
    empathyStrength: "high",
    praiseFrequency: "high",
    hintPreference: "eager",
  },
  curious_learner: {
    openQuestion: "preferred",
    hintPreference: "delayed",
    praiseFrequency: "normal",
  },
};

function adjustmentsFor(persona: Persona): TeachingAdjustments {
  return { ...DEFAULT_ADJUST, ...ADJUST_MAP[persona] };
}

// ─────────────────────────────────────────────────────────────
// Traits 추출
// ─────────────────────────────────────────────────────────────

function extractTraits(
  input: PersonaInput,
  turnScores: PersonaScores,
): PersonaTrait[] {
  const traits = new Set<PersonaTrait>();
  const u = input.understanding;
  const text = u.normalization?.normalizedText ?? u.normalized ?? "";
  const s = signalsFromInput(text);

  if (s.long) traits.add("talkative");
  if (s.silent || s.dontKnow) traits.add("hesitant");
  if (s.hedge) traits.add("anxious");
  if (s.questioning) traits.add("curious");
  if (s.short && !s.silent) traits.add("quiet");
  if (u.defensiveResponse?.detected) traits.add("defensive");
  if ((u.emotionAnalysis?.intensity ?? 0) >= 0.6) traits.add("empathetic");
  if ((turnScores.confident_learner ?? 0) >= 2) traits.add("confident");
  if (u.intentAnalysis?.primary === "apology" || u.intentAnalysis?.primary === "empathy")
    traits.add("reflective");
  if (u.intentAnalysis?.primary === "attack") traits.add("impulsive");

  return Array.from(traits);
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function inferPersona(input: PersonaInput): PersonaResult {
  const prev = input.conversationMemory?.lastPersona;
  const turn = scoreTurn(input);
  const merged = mergeScores(prev?.scores, turn);
  const observationCount = (prev?.observationCount ?? 0) + 1;

  // 최고 점수 페르소나
  let top: Persona = "quiet_observer";
  let topScore = -Infinity;
  for (const [k, v] of Object.entries(merged) as [Persona, number][]) {
    if (v > topScore) {
      topScore = v;
      top = k;
    }
  }

  // 이전 페르소나와 급전환 방지: 새 후보가 이전보다 크게 앞서지 않으면 유지
  if (prev && prev.persona !== top) {
    const prevScore = merged[prev.persona] ?? 0;
    if (topScore - prevScore < 1.0) top = prev.persona;
  }

  // Confidence
  const sorted = Object.values(merged).sort((a, b) => b - a);
  const gap = (sorted[0] ?? 0) - (sorted[1] ?? 0);
  let confidence: PersonaConfidence = "low";
  if (observationCount >= 5 && gap >= 1.5) confidence = "high";
  else if (observationCount >= 3 && gap >= 0.8) confidence = "mid";

  const traits = extractTraits(input, turn);
  const adjustments = adjustmentsFor(top);

  const reason = buildReason(top, turn, observationCount, confidence);

  return {
    persona: top,
    confidence,
    traits,
    adjustments,
    reason,
    scores: merged,
    observationCount,
  };
}

/**
 * Confidence가 낮으면 Persona를 약하게 적용해야 한다.
 * 이 헬퍼는 Response Generator가 참고하기 쉬운 형태로
 * "약화된 adjustments"를 반환한다. persona 자체는 유지.
 */
export function effectiveAdjustments(result: PersonaResult): TeachingAdjustments {
  if (result.confidence === "high") return result.adjustments;
  if (result.confidence === "mid") {
    // 극단값을 중립으로 살짝 완화
    const a = result.adjustments;
    return {
      ...a,
      praiseFrequency: a.praiseFrequency === "low" ? "normal" : a.praiseFrequency,
      waitEncouragement: a.waitEncouragement === "strong" ? "on" : a.waitEncouragement,
      reassurance: a.reassurance === "strong" ? "on" : a.reassurance,
    };
  }
  // low → 기본값만 반환
  return DEFAULT_ADJUST;
}

function buildReason(
  p: Persona,
  turn: PersonaScores,
  obs: number,
  conf: PersonaConfidence,
): string {
  const s = turn[p] ?? 0;
  return `persona=${p} turnScore=${s.toFixed(2)} obs=${obs} confidence=${conf}`;
}
