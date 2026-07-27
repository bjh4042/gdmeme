/**
 * Teaching Engine Part 4-4 — Feedback Style Engine
 *
 * 역할: Response Generator가 최종 문장을 만들 때 사용할
 *   말투/피드백 구조/칭찬 방식/질문 방식/격려 표현을 조정한다.
 *   ❌ TeachingDecision, Planner, Strategy, HintLevel, Stage 를 변경하지 않는다.
 *   ❌ 학생에게 스타일 라벨을 노출하지 않는다.
 *   ✅ 같은 시작/칭찬/마무리를 3회 이상 반복하지 않는다.
 *   ✅ Persona / Progress 신호를 반영해 표현의 다양성만 조정한다.
 */
import type { ConversationMemory, TeachingDecision } from "./teaching-planner";
import type { PersonaResult } from "./student-persona";
import type { ProgressResult } from "./learning-progress";
import { findSimilarExample } from "./teaching-corpus";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type OpeningStyle =
  | "empathy"
  | "positive"
  | "reflection"
  | "neutral"
  | "celebration";

export type QuestionStyle =
  | "open"
  | "easy_open"
  | "reflective"
  | "perspective"
  | "choice"
  | "challenge";

export type PraiseStyle =
  | "behavior"
  | "effort"
  | "growth"
  | "reflection"
  | "cooperation"
  | "recovery";

export type ClosingStyle =
  | "encourage"
  | "retry"
  | "challenge"
  | "celebrate"
  | "calm";

/** 최근 스타일 사용 이력. ConversationMemory 에 optional 로 실려온다. */
export type StyleHistory = {
  opening?: OpeningStyle[];
  praise?: PraiseStyle[];
  closing?: ClosingStyle[];
};

export type FeedbackStyleInput = {
  decision: TeachingDecision;
  persona?: PersonaResult;
  progress?: ProgressResult;
  conversationMemory?: ConversationMemory & { styleHistory?: StyleHistory };
  studentInput?: string;
};

export type FeedbackStyleResult = {
  openingStyle: OpeningStyle;
  questionStyle: QuestionStyle;
  praiseStyle: PraiseStyle;
  closingStyle: ClosingStyle;
  /** Generator 가 표현 변주를 뽑을 때 쓰는 결정적 시드 (0..999). */
  variationSeed: number;
  /** 참고용 스타일 힌트 (예: 참조 예시 id). 학생 노출 금지. */
  referenceStyleHint?: string;
  /** 이번 턴 이후 저장해야 할 갱신된 스타일 이력. */
  updatedStyleHistory: Required<StyleHistory>;
  /** 디버그용 reason 리스트. */
  reasons: string[];
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const MAX_HISTORY = 6;
const CONSECUTIVE_LIMIT = 2; // 3회 이상 연속 사용 금지 → 이미 2회 연속이면 교체

function pushHistory<T>(arr: T[] | undefined, v: T): T[] {
  const next = [...(arr ?? []), v];
  return next.slice(-MAX_HISTORY);
}

function isBlocked<T extends string>(hist: T[] | undefined, cand: T): boolean {
  if (!hist || hist.length < CONSECUTIVE_LIMIT) return false;
  const tail = hist.slice(-CONSECUTIVE_LIMIT);
  return tail.every((v) => v === cand);
}

function pickFirstAllowed<T extends string>(
  candidates: T[],
  hist: T[] | undefined,
  fallback: T,
): T {
  for (const c of candidates) {
    if (!isBlocked(hist, c)) return c;
  }
  return fallback;
}

function dedupe<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1000;
}

// ─────────────────────────────────────────────────────────────
// Style pickers
// ─────────────────────────────────────────────────────────────

function pickOpening(
  input: FeedbackStyleInput,
  hist: OpeningStyle[] | undefined,
  reasons: string[],
): OpeningStyle {
  const p = input.persona?.persona;
  const trend = input.progress?.trend;
  const goal = input.decision.goal;

  const prefs: OpeningStyle[] = [];

  if (trend === "improving" || trend === "recovering") {
    prefs.push("celebration", "positive");
    reasons.push(`opening:trend=${trend}`);
  }
  if (
    p === "defensive_learner" ||
    p === "emotional_learner" ||
    p === "anxious_learner"
  ) {
    prefs.push("empathy");
    reasons.push(`opening:persona=${p}`);
  }
  if (p === "shy_learner" || p === "quiet_observer") {
    prefs.push("empathy", "neutral");
  }
  if (p === "curious_learner" || p === "confident_learner") {
    prefs.push("positive", "reflection");
  }
  if (goal === "reflect" || goal === "consolidate") {
    prefs.push("reflection");
  }
  prefs.push("neutral", "positive", "empathy", "reflection", "celebration");

  return pickFirstAllowed(dedupe(prefs), hist, "neutral");
}

function pickQuestionStyle(
  input: FeedbackStyleInput,
  reasons: string[],
): QuestionStyle {
  // Planner 결정 존중: choice 모드면 choice 만 사용.
  const mode = input.decision.mode;
  if (mode === "forced_choice") {
    reasons.push("q:forced_choice");
    return "choice";
  }
  const strat = input.decision.strategy;
  if (strat === "perspective_shift") return "perspective";
  if (strat === "counterexample") return "challenge";
  if (strat === "reflect_student_words" || strat === "acknowledge_emotion") {
    return "reflective";
  }

  const p = input.persona?.persona;
  if (
    p === "shy_learner" ||
    p === "anxious_learner" ||
    p === "quiet_observer" ||
    p === "talkative_learner"
  ) {
    reasons.push(`q:easy_open(${p})`);
    return "easy_open";
  }
  if (p === "curious_learner" || p === "confident_learner") {
    return "open";
  }
  return "open";
}

function pickPraise(
  input: FeedbackStyleInput,
  hist: PraiseStyle[] | undefined,
  reasons: string[],
): PraiseStyle {
  const trend = input.progress?.trend;
  const rec = input.progress?.recommendation;
  const strat = input.decision.strategy;

  const prefs: PraiseStyle[] = [];
  if (trend === "improving") {
    prefs.push("growth");
    reasons.push("praise:growth");
  }
  if (trend === "recovering") {
    prefs.push("recovery", "effort");
    reasons.push("praise:recovery");
  }
  if (trend === "declining" || rec === "more_encouragement") {
    prefs.push("effort");
  }
  if (strat === "reflect_student_words" || strat === "acknowledge_emotion") {
    prefs.push("reflection");
  }
  if (input.decision.goal === "cooperate" || strat === "perspective_shift") {
    prefs.push("cooperation");
  }
  // 기본: 능력/성격이 아닌 행동/노력 칭찬
  prefs.push("behavior", "effort", "reflection", "cooperation", "growth");

  return pickFirstAllowed(dedupe(prefs), hist, "behavior");
}

function pickClosing(
  input: FeedbackStyleInput,
  hist: ClosingStyle[] | undefined,
  reasons: string[],
): ClosingStyle {
  const trend = input.progress?.trend;
  const risk = input.progress?.risk;
  const p = input.persona?.persona;
  const hint = input.decision.hintLevel ?? 0;

  const prefs: ClosingStyle[] = [];
  if (trend === "improving") prefs.push("celebrate", "encourage");
  if (trend === "recovering") prefs.push("encourage", "challenge");
  if (trend === "declining" || risk === "medium" || risk === "high") {
    prefs.push("calm", "encourage");
    reasons.push("closing:calm_for_risk");
  }
  if (p === "anxious_learner" || p === "emotional_learner") {
    prefs.push("calm");
  }
  if (p === "confident_learner" || p === "curious_learner") {
    prefs.push("challenge");
  }
  if (hint >= 3) prefs.push("retry");
  prefs.push("encourage", "calm", "celebrate", "challenge", "retry");

  return pickFirstAllowed(dedupe(prefs), hist, "encourage");
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

export function decideFeedbackStyle(
  input: FeedbackStyleInput,
): FeedbackStyleResult {
  const reasons: string[] = [];
  const history: StyleHistory = input.conversationMemory?.styleHistory ?? {};

  const openingStyle = pickOpening(input, history.opening, reasons);
  const questionStyle = pickQuestionStyle(input, reasons);
  const praiseStyle = pickPraise(input, history.praise, reasons);
  const closingStyle = pickClosing(input, history.closing, reasons);

  // Reference style from few-shot corpus (tone reference only; not copied).
  let referenceStyleHint: string | undefined;
  try {
    const ex = findSimilarExample({
      strategy: input.decision.strategy,
      goal: input.decision.goal,
      studentInput: input.studentInput,
    } as Parameters<typeof findSimilarExample>[0]);
    if (ex && typeof (ex as { id?: string }).id === "string") {
      referenceStyleHint = (ex as { id: string }).id;
    }
  } catch {
    // corpus lookup is best-effort
  }

  const seedKey = [
    input.decision.strategy,
    input.decision.hintLevel,
    openingStyle,
    praiseStyle,
    closingStyle,
    (history.opening ?? []).length,
  ].join("|");
  const variationSeed = hash(seedKey);

  const updatedStyleHistory: Required<StyleHistory> = {
    opening: pushHistory(history.opening, openingStyle),
    praise: pushHistory(history.praise, praiseStyle),
    closing: pushHistory(history.closing, closingStyle),
  };

  return {
    openingStyle,
    questionStyle,
    praiseStyle,
    closingStyle,
    variationSeed,
    referenceStyleHint,
    updatedStyleHistory,
    reasons,
  };
}

/** ConversationMemory 에 스타일 이력을 병합하는 헬퍼. */
export function mergeStyleHistory(
  memory: (ConversationMemory & { styleHistory?: StyleHistory }) | undefined,
  updated: Required<StyleHistory>,
): ConversationMemory & { styleHistory: StyleHistory } {
  return {
    ...(memory ?? {}),
    styleHistory: updated,
  };
}
