/**
 * Teaching Strategy Engine v1.0
 *
 * Teaching Planner Part 1-2. Planner Core(teaching-planner.ts)와 함께 사용한다.
 *   ❌ 학생에게 보여줄 문장을 생성하지 않는다 (Response Generator 담당).
 *   ❌ 학생 입력을 재해석하지 않는다 (EKLU 담당).
 *   ✅ 사양에 정의된 15개 Strategy 중 하나만 선택한다.
 *
 * 결정 순서 (고정):
 *   Safety → Clarification → LearningGoal → StudentState → PreviousStrategy
 *   → HintState → LearningMemory → ConversationMemory → ResponseQuality → Strategy
 *
 * 개입 우선순위:
 *   question > choice > hint > example > model_answer
 */
import type { EkluResult, LearningStage, StudentModel } from "./eklu-engine";
import type {
  ChoiceType,
  ConversationMemory,
  LearningMemory,
  PedagogicalGoal,
  PedagogicalState,
  ResponseMode,
  SafetySignal,
} from "./teaching-planner";

// ─────────────────────────────────────────────────────────────
// 사양이 정의한 전략 어휘
// ─────────────────────────────────────────────────────────────

export type TeachingStrategy =
  | "acknowledge_emotion"
  | "reflect_student_words"
  | "open_question"
  | "easy_open_question"
  | "forced_choice"
  | "perspective_shift"
  | "counterexample"
  | "hint_level_1"
  | "hint_level_2"
  | "show_example"
  | "show_model_answer"
  | "encourage_retry"
  | "summarize_learning"
  | "advance_stage"
  | "safety_intervention";

export type HintLevel = 0 | 1 | 2 | 3 | 4;

export type PraiseReason =
  | "recognized_emotion"
  | "considered_other_perspective"
  | "accepted_responsibility"
  | "improved_expression"
  | "gave_specific_plan"
  | "persisted_after_difficulty";

export type SafetyAction = "none" | "pause_and_ground" | "refer_adult" | "stop_activity";

export type ResponseQuality = {
  score: number; // 0..1
  reason?: "too_short" | "off_topic" | "avoidant" | "unclear" | "ok";
};

export type StrategyInput = {
  understanding: EkluResult;
  studentModel?: StudentModel;
  learningMemory?: LearningMemory;
  conversationMemory?: ConversationMemory & {
    lastStrategy?: TeachingStrategy;
    sameGoalFailures?: number;
    selfDrivenAnswer?: boolean;
  };
  pedagogicalState: PedagogicalState;
  safetySignal?: SafetySignal;
  responseQuality?: ResponseQuality;
  stageCompleted?: boolean;
};

export type StrategyDecision = {
  goal: PedagogicalGoal;
  strategy: TeachingStrategy;
  responseMode: ResponseMode;
  hintLevel: HintLevel;
  praiseReason?: PraiseReason;
  shouldAdvanceStage: boolean;
  nextStage?: LearningStage;
  choiceType: ChoiceType;
  safetyAction: SafetyAction;
  internalReason: string; // 학생 노출 금지
};

// ─────────────────────────────────────────────────────────────
// Stage
// ─────────────────────────────────────────────────────────────

const STAGE_ORDER: LearningStage[] = [
  "discovery",
  "investigation",
  "empathy",
  "change",
  "practice",
];

function nextStageOf(stage: LearningStage): LearningStage | undefined {
  const i = STAGE_ORDER.indexOf(stage);
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : undefined;
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

export function planStrategy(input: StrategyInput): StrategyDecision {
  const u = input.understanding;
  const model = input.studentModel ?? u.studentModel;
  const mem: LearningMemory = input.learningMemory ?? {};
  const conv = input.conversationMemory ?? {};
  const ps = input.pedagogicalState;
  const safety: SafetySignal = input.safetySignal ?? { level: "none" };
  const rq: ResponseQuality = input.responseQuality ?? { score: 0.6, reason: "ok" };
  const reasons: string[] = [];

  // ① Safety
  if (safety.level === "high" || safety.level === "medium") {
    reasons.push(`safety:${safety.level}${safety.kind ? `:${safety.kind}` : ""}`);
    return finalize({
      goal: ps.currentGoal,
      strategy: "safety_intervention",
      responseMode: "affirm_and_wait",
      hintLevel: 0,
      choiceType: "none",
      safetyAction: safety.level === "high" ? "refer_adult" : "pause_and_ground",
      shouldAdvanceStage: false,
      internalReason: joinReasons(reasons),
    });
  }

  // ② Clarification
  if (u.clarificationNeed?.required) {
    reasons.push(
      `clarify:${u.clarificationNeed.target ?? "?"}:${u.clarificationNeed.strategy ?? "?"}`,
    );
    const cands = u.clarificationNeed.candidates ?? [];
    const strategy: TeachingStrategy =
      u.clarificationNeed.strategy === "forced_choice" || cands.length >= 2
        ? "forced_choice"
        : "easy_open_question";
    return finalize({
      goal: ps.currentGoal,
      strategy,
      responseMode: strategy === "forced_choice" ? "forced_choice" : "open_question",
      hintLevel: 0,
      choiceType: pickChoiceTypeFromCandidates(cands, strategy),
      safetyAction: "none",
      shouldAdvanceStage: false,
      internalReason: joinReasons(reasons),
    });
  }

  // ③ Learning Goal + ④ Student State
  const goal = ps.currentGoal;
  reasons.push(`goal:${goal}`);
  const intents = [u.intentAnalysis.primary, ...u.intentAnalysis.secondary];
  const defensive = u.defensiveResponse;
  const misconception = u.misconception;
  const sameGoalFailures = conv.sameGoalFailures ?? 0;

  // ⑤ Previous Strategy — 반복 회피 정보
  if (conv.lastStrategy) reasons.push(`prev:${conv.lastStrategy}`);

  // ⑥ Hint State — 이전 힌트에 대해 ±1만 이동
  const prevHint = (conv.lastHintLevel ?? 0) as HintLevel;

  // ⑦ Learning Memory
  const empathyOk = (mem.empathySuccessCount ?? 0) >= 10;

  // ⑧ Conversation Memory: 이미 감정 인정한 직후엔 반복하지 않는다
  const emotionAlreadyAcknowledged = conv.lastStrategy === "acknowledge_emotion";

  // ⑨ Response Quality
  const lowQuality = rq.score < 0.4 || rq.reason === "too_short" || rq.reason === "unclear";

  // ⑩ Strategy 선택
  let strategy: TeachingStrategy;

  // 감정 표현 우선 인정
  if (
    !emotionAlreadyAcknowledged &&
    (intents.includes("empathy") ||
      ["sadness", "anger", "unfair", "sorry", "nervous"].includes(u.emotionAnalysis.primary))
  ) {
    strategy = "acknowledge_emotion";
    reasons.push("emotion_expressed");
  } else if (misconception.detected) {
    strategy = "counterexample";
    reasons.push(`misconception:${misconception.kind ?? "?"}`);
  } else if (defensive.detected || (goal === "empathy" && missingOtherPerspective(u))) {
    strategy = "perspective_shift";
    reasons.push(`perspective_needed:${defensive.type ?? "no_other_side"}`);
  } else if (isLongStudentReply(u)) {
    strategy = "reflect_student_words";
    reasons.push("long_reply_reflect_first");
  } else if (sameGoalFailures >= 2) {
    strategy = "forced_choice";
    reasons.push(`repeated_failure:${sameGoalFailures}`);
  } else if (lowQuality || model.helpNeed >= 3) {
    strategy = "easy_open_question";
    reasons.push(`support_needed:helpNeed=${model.helpNeed}`);
  } else if (input.stageCompleted && goal === "practice_reinforce") {
    strategy = "summarize_learning";
    reasons.push("stage_wrap_up");
  } else if (input.stageCompleted) {
    strategy = "advance_stage";
    reasons.push("stage_completed");
  } else if (goal === "expression_revision" && intents.includes("apology")) {
    // 학생이 스스로 시도했으면 힌트/예시로 지지
    strategy = pickHintOrExample(prevHint, sameGoalFailures);
    reasons.push(`support_expression:prevHint=${prevHint}`);
  } else {
    strategy = "open_question";
    reasons.push("default_open_question");
  }

  // 같은 전략 2회 연속 금지 (학생이 같은 도움을 요청한 경우는 예외 → intents help_request)
  if (
    conv.lastStrategy === strategy &&
    !intents.includes("help_request") &&
    strategy !== "safety_intervention"
  ) {
    const alt = alternativeStrategy(strategy);
    if (alt) {
      reasons.push(`avoid_repeat:${strategy}->${alt}`);
      strategy = alt;
    }
  }

  // Hint 계산 (±1 규칙)
  const hintLevel = adjustHint(strategy, prevHint, {
    sameGoalFailures,
    selfDriven: !!conv.selfDrivenAnswer,
  });

  // 응답 형태 / 선택지
  const responseMode = responseModeFor(strategy, model);
  const choiceType: ChoiceType =
    responseMode === "forced_choice"
      ? "three_options" // "잘 모르겠어" 포함 규칙은 Response Generator에서 반영
      : strategy === "encourage_retry"
        ? "yesno"
        : "none";

  // Praise — 이유만 결정. 학생 자체가 아니라 행동을 향한다.
  const praiseReason = pickPraiseReason(u, model, goal, strategy, conv);

  // Stage 이동은 명시적으로 완료된 경우 또는 strategy === advance_stage 일 때만
  const shouldAdvance = strategy === "advance_stage" || (!!input.stageCompleted && goal !== "practice_reinforce");
  const nextStage = shouldAdvance ? nextStageOf(ps.stage) : undefined;

  return finalize({
    goal,
    strategy,
    responseMode,
    hintLevel,
    praiseReason,
    choiceType,
    safetyAction: "none",
    shouldAdvanceStage: shouldAdvance,
    nextStage,
    internalReason: joinReasons(reasons),
  });
}

// ─────────────────────────────────────────────────────────────
// 규칙 헬퍼
// ─────────────────────────────────────────────────────────────

function missingOtherPerspective(u: EkluResult): boolean {
  const text = u.normalization.normalizedText;
  const mentionsOther = /(친구|상대|그애|걔|엄마|아빠|동생|형|누나|언니|오빠|선생님)/.test(text);
  const feelingsWords = /(마음|기분|감정|속상|미안|서운|화|무서|억울)/.test(text);
  return !(mentionsOther && feelingsWords);
}

function isLongStudentReply(u: EkluResult): boolean {
  return u.normalization.normalizedText.replace(/\s+/g, "").length >= 40;
}

function pickHintOrExample(prev: HintLevel, failures: number): TeachingStrategy {
  const target = Math.min(4, Math.max(1, prev + 1) + (failures >= 2 ? 1 : 0));
  if (target <= 1) return "hint_level_1";
  if (target === 2) return "hint_level_2";
  if (target === 3) return "show_example";
  return "show_model_answer";
}

function adjustHint(
  strategy: TeachingStrategy,
  prev: HintLevel,
  ctx: { sameGoalFailures: number; selfDriven: boolean },
): HintLevel {
  // 학생이 스스로 답을 찾기 시작하면 한 단계 낮춘다
  if (ctx.selfDriven) return clampHint(prev - 1);

  switch (strategy) {
    case "open_question":
    case "easy_open_question":
    case "acknowledge_emotion":
    case "reflect_student_words":
    case "perspective_shift":
    case "forced_choice":
    case "counterexample":
    case "encourage_retry":
    case "summarize_learning":
    case "advance_stage":
    case "safety_intervention":
      return 0;
    case "hint_level_1":
      return clampHint(Math.min(1, prev + 1));
    case "hint_level_2":
      return clampHint(Math.min(2, prev + 1));
    case "show_example":
      return clampHint(Math.min(3, prev + 1));
    case "show_model_answer":
      return clampHint(Math.min(4, prev + 1));
    default:
      return 0;
  }
}

function clampHint(n: number): HintLevel {
  return Math.max(0, Math.min(4, n)) as HintLevel;
}

function responseModeFor(strategy: TeachingStrategy, model: StudentModel): ResponseMode {
  switch (strategy) {
    case "safety_intervention":
      return "affirm_and_wait";
    case "acknowledge_emotion":
    case "reflect_student_words":
      return "reflective_mirror";
    case "open_question":
    case "easy_open_question":
    case "perspective_shift":
    case "counterexample":
      return model.choicePreference >= 3 && strategy !== "counterexample"
        ? "forced_choice"
        : "open_question";
    case "forced_choice":
      return "forced_choice";
    case "hint_level_1":
    case "hint_level_2":
    case "show_example":
    case "show_model_answer":
      return "gentle_hint";
    case "encourage_retry":
      return "affirm_and_wait";
    case "summarize_learning":
    case "advance_stage":
      return "praise_and_advance";
    default:
      return "open_question";
  }
}

function pickChoiceTypeFromCandidates(cands: string[], strategy: TeachingStrategy): ChoiceType {
  if (strategy !== "forced_choice") return "none";
  if (cands.length >= 3) return "three_options";
  if (cands.length === 2) return "two_options";
  return "two_options";
}

function alternativeStrategy(s: TeachingStrategy): TeachingStrategy | undefined {
  const map: Partial<Record<TeachingStrategy, TeachingStrategy>> = {
    open_question: "perspective_shift",
    easy_open_question: "forced_choice",
    perspective_shift: "reflect_student_words",
    counterexample: "perspective_shift",
    acknowledge_emotion: "reflect_student_words",
    reflect_student_words: "open_question",
    forced_choice: "easy_open_question",
    hint_level_1: "hint_level_2",
    hint_level_2: "show_example",
    show_example: "encourage_retry",
    show_model_answer: "encourage_retry",
    encourage_retry: "easy_open_question",
    summarize_learning: "advance_stage",
    advance_stage: "summarize_learning",
  };
  return map[s];
}

function pickPraiseReason(
  u: EkluResult,
  model: StudentModel,
  goal: PedagogicalGoal,
  strategy: TeachingStrategy,
  conv: NonNullable<StrategyInput["conversationMemory"]>,
): PraiseReason | undefined {
  if (strategy === "safety_intervention") return undefined;
  const intents = [u.intentAnalysis.primary, ...u.intentAnalysis.secondary];
  if (intents.includes("empathy")) return "considered_other_perspective";
  if (
    ["sadness", "anger", "unfair", "sorry"].includes(u.emotionAnalysis.primary) &&
    goal === "emotion_awareness"
  )
    return "recognized_emotion";
  if (intents.includes("apology") && goal === "expression_revision")
    return "accepted_responsibility";
  if (goal === "expression_revision" && conv.selfDrivenAnswer) return "improved_expression";
  if (goal === "practice_plan" && intents.includes("explain")) return "gave_specific_plan";
  if ((conv.sameGoalFailures ?? 0) >= 2 && model.engagement >= 2)
    return "persisted_after_difficulty";
  return undefined;
}

function joinReasons(rs: string[]): string {
  return rs.join(" | ");
}

function finalize(d: Omit<StrategyDecision, "nextStage" | "praiseReason"> & Partial<Pick<StrategyDecision, "nextStage" | "praiseReason">>): StrategyDecision {
  return {
    nextStage: undefined,
    praiseReason: undefined,
    ...d,
  };
}

// ─────────────────────────────────────────────────────────────
// 내부 로그 — 학생 노출 금지
// ─────────────────────────────────────────────────────────────

export function serializeStrategyLog(d: StrategyDecision): string {
  return [
    `goal=${d.goal}`,
    `strategy=${d.strategy}`,
    `mode=${d.responseMode}`,
    `hint=${d.hintLevel}`,
    `praise=${d.praiseReason ?? "-"}`,
    `advance=${d.shouldAdvanceStage}${d.nextStage ? `->${d.nextStage}` : ""}`,
    `choice=${d.choiceType}`,
    `safety=${d.safetyAction}`,
    `reason=${d.internalReason}`,
  ].join(" | ");
}