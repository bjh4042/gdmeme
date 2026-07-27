/**
 * Teaching Planner Core v1.0
 *
 * 역할: EKLU Engine이 만든 이해 결과를 바탕으로 "무엇을 가르칠지"만 결정한다.
 *   ❌ 학생에게 보여줄 문장을 만들지 않는다 (Response Generator 담당).
 *   ❌ 학생 입력을 다시 해석하지 않는다 (EKLU 담당).
 *   ✅ 오직 TeachingDecision 만 생성한다. 결정론적으로 동작한다.
 *
 * 판단 순서(고정):
 *   ① Safety → ② 현재 목표 → ③ 이전 전략 → ④ 학생 상태
 *   → ⑤ 전략 선택 → ⑥ 응답 형태 → ⑦ 힌트 단계 → ⑧ 칭찬 → ⑨ 단계 이동
 *
 * 우선순위:
 *   Safety > LearningGoal > StudentUnderstanding > TeachingStrategy
 *   > Hint > Praise > StageTransition > ResponseStyle
 */
import type { EkluResult, LearningStage, StudentModel } from "./eklu-engine";

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export type PedagogicalGoal =
  | "emotion_awareness" // 감정 인식
  | "empathy" // 공감
  | "expression_revision" // 표현 수정
  | "practice_plan" // 실천 계획
  | "practice_reinforce"; // 실천 강화

export type TeachingStrategy =
  | "safety_intervention" // 안전 개입 (최우선)
  | "clarify_meaning" // 의미/의도 확인
  | "reflect_emotion" // 학생 감정 되짚기
  | "perspective_taking" // 상대 입장 생각해 보기
  | "reframe_defense" // 방어 반응을 부드럽게 되돌아보기
  | "correct_misconception" // 오개념을 스스로 점검하도록 유도
  | "guide_expression" // 더 나은 표현을 스스로 만들도록 유도
  | "plan_practice" // 실천 계획 세우기
  | "reinforce_practice" // 실천 강화/칭찬
  | "wait_and_listen" // 질문만 던지고 기다림
  | "re_engage"; // 회피/저참여 재참여

export type ResponseMode =
  | "open_question"
  | "forced_choice"
  | "reflective_mirror"
  | "gentle_hint"
  | "affirm_and_wait"
  | "praise_and_advance";

export type HintLevel = 0 | 1 | 2 | 3; // 0 힌트없음 → 3 예시 제공

export type ChoiceType = "none" | "yesno" | "two_options" | "three_options";

export type ConversationMemory = {
  lastTopic?: string;
  lastScenario?: string;
  lastTeacherStrategy?: TeachingStrategy;
  lastStudentReaction?: "engaged" | "avoidant" | "defensive" | "reflective" | "confused";
  lastHintLevel?: HintLevel;
  lastResponseMode?: ResponseMode;
};

export type LearningMemory = {
  empathySuccessCount?: number;
  blameShiftCount?: number;
  giveUpCount?: number;
  misconceptionSeen?: string[];
  masteredGoals?: PedagogicalGoal[];
};

export type PedagogicalState = {
  currentGoal: PedagogicalGoal;
  stage: LearningStage;
  turnsInGoal?: number;
};

export type SafetySignal = {
  level: "none" | "low" | "medium" | "high";
  kind?: "self_harm" | "peer_harm" | "abuse_disclosure" | "severe_distress";
};

export type TeachingDecision = {
  goal: PedagogicalGoal;
  strategy: TeachingStrategy;
  responseMode: ResponseMode;
  hintLevel: HintLevel;
  choiceType: ChoiceType;
  shouldPraise: boolean;
  praiseReason?: string;
  shouldAdvanceStage: boolean;
  nextStage?: LearningStage;
  waitForStudent: boolean;
  internalReason: string; // 학생 노출 금지
  safety: SafetySignal;
};

export type PlannerInput = {
  understanding: EkluResult;
  studentModel?: StudentModel; // 없으면 understanding.studentModel 사용
  learningMemory?: LearningMemory;
  conversationMemory?: ConversationMemory;
  pedagogicalState: PedagogicalState;
  safetySignal?: SafetySignal;
};

// ─────────────────────────────────────────────────────────────
// 단계 순서
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
  if (i < 0 || i >= STAGE_ORDER.length - 1) return undefined;
  return STAGE_ORDER[i + 1];
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

export function planTeaching(input: PlannerInput): TeachingDecision {
  const u = input.understanding;
  const model = input.studentModel ?? u.studentModel;
  const mem: LearningMemory = input.learningMemory ?? {};
  const conv: ConversationMemory = input.conversationMemory ?? {};
  const ps = input.pedagogicalState;
  const safety: SafetySignal = input.safetySignal ?? { level: "none" };

  const reasons: string[] = [];

  // ① Safety 최우선
  if (safety.level === "high" || safety.level === "medium") {
    reasons.push(`safety:${safety.level}${safety.kind ? `:${safety.kind}` : ""}`);
    return {
      goal: ps.currentGoal,
      strategy: "safety_intervention",
      responseMode: "affirm_and_wait",
      hintLevel: 0,
      choiceType: "none",
      shouldPraise: false,
      shouldAdvanceStage: false,
      waitForStudent: true,
      internalReason: reasons.join(" | "),
      safety,
    };
  }

  // ② 현재 학습 목표
  const goal = ps.currentGoal;
  reasons.push(`goal:${goal}`);

  // ③ 이전 전략(반복 회피 정보만 기록)
  if (conv.lastTeacherStrategy) reasons.push(`prev:${conv.lastTeacherStrategy}`);

  // ④ 학생 상태
  const insufficient = u.status === "insufficient_data";
  const clarification = u.clarificationNeed;
  const defensive = u.defensiveResponse;
  const misconception = u.misconception;
  const primaryIntent = u.intentAnalysis.primary;
  const engagement = model.engagement;
  const giveUp = model.repeatedErrors["give_up"] ?? 0;
  const blame = model.repeatedErrors["blame_shift"] ?? 0;

  // ⑤ 전략 선택
  let strategy: TeachingStrategy;

  if (clarification?.required) {
    strategy = "clarify_meaning";
    reasons.push(`clarify:${clarification.target ?? "?"}:${clarification.strategy ?? "?"}`);
  } else if (misconception.detected && !alreadyHandled(mem, misconception.kind)) {
    strategy = "correct_misconception";
    reasons.push(`misconception:${misconception.kind ?? "?"}`);
  } else if (defensive.detected) {
    strategy = "reframe_defense";
    reasons.push(`defense:${defensive.type ?? "?"}`);
  } else if (giveUp >= 2 || engagement < 1.5 || primaryIntent === "avoid") {
    strategy = "re_engage";
    reasons.push(`disengaged:giveUp=${giveUp},eng=${engagement.toFixed(2)}`);
  } else {
    strategy = strategyForGoal(goal, u, mem);
    reasons.push(`byGoal:${strategy}`);
  }

  // 같은 전략 연속 방지 (안전/명확화 제외)
  if (
    conv.lastTeacherStrategy === strategy &&
    strategy !== "clarify_meaning" &&
    strategy !== "safety_intervention"
  ) {
    const alt = alternativeStrategy(strategy, goal);
    if (alt) {
      reasons.push(`avoidRepeat:${strategy}->${alt}`);
      strategy = alt;
    }
  }

  // ⑥ 응답 형태
  const responseMode = pickResponseMode(strategy, model, conv);

  // ⑦ 힌트 단계 — 이전 힌트 대비 1단계씩만 상승
  const hintLevel = pickHintLevel(strategy, u, conv);

  // ⑧ 칭찬 여부
  const praise = pickPraise(u, model, goal, strategy);

  // ⑨ 단계 이동 — 매우 보수적으로만
  const advance = shouldAdvance(goal, strategy, u, mem, insufficient);
  const nextStage = advance ? nextStageOf(ps.stage) : undefined;

  // 선택지 형태
  const choiceType: ChoiceType =
    responseMode === "forced_choice"
      ? clarification?.candidates && clarification.candidates.length >= 3
        ? "three_options"
        : "two_options"
      : strategy === "re_engage"
        ? "yesno"
        : "none";

  const waitForStudent =
    responseMode === "affirm_and_wait" ||
    strategy === "wait_and_listen" ||
    (strategy === "re_engage" && engagement < 1.5);

  return {
    goal,
    strategy,
    responseMode,
    hintLevel,
    choiceType,
    shouldPraise: praise.should,
    praiseReason: praise.reason,
    shouldAdvanceStage: advance,
    nextStage,
    waitForStudent,
    internalReason: reasons.join(" | "),
    safety,
  };
}

// ─────────────────────────────────────────────────────────────
// 보조 규칙
// ─────────────────────────────────────────────────────────────

function alreadyHandled(mem: LearningMemory, kind?: string): boolean {
  if (!kind) return false;
  return !!mem.misconceptionSeen && mem.misconceptionSeen.includes(kind);
}

function strategyForGoal(
  goal: PedagogicalGoal,
  u: EkluResult,
  mem: LearningMemory,
): TeachingStrategy {
  switch (goal) {
    case "emotion_awareness":
      return "reflect_emotion";
    case "empathy": {
      const empathyOk = (mem.empathySuccessCount ?? 0) >= 10;
      // 이미 공감을 충분히 익혔다면 표현 수정으로 자연스럽게 넘긴다
      if (empathyOk) return "guide_expression";
      return "perspective_taking";
    }
    case "expression_revision":
      return u.intentAnalysis.primary === "apology" ? "reinforce_practice" : "guide_expression";
    case "practice_plan":
      return "plan_practice";
    case "practice_reinforce":
      return "reinforce_practice";
    default:
      return "wait_and_listen";
  }
}

function alternativeStrategy(
  s: TeachingStrategy,
  goal: PedagogicalGoal,
): TeachingStrategy | undefined {
  const map: Partial<Record<TeachingStrategy, TeachingStrategy>> = {
    reflect_emotion: "perspective_taking",
    perspective_taking: "guide_expression",
    guide_expression: "wait_and_listen",
    reframe_defense: "reflect_emotion",
    correct_misconception: "perspective_taking",
    re_engage: "wait_and_listen",
    plan_practice: "reinforce_practice",
    reinforce_practice: "plan_practice",
  };
  const alt = map[s];
  if (!alt) return undefined;
  // 목표에 맞지 않는 대체는 피한다
  if (goal === "practice_plan" && alt === "reinforce_practice") return alt;
  return alt;
}

function pickResponseMode(
  strategy: TeachingStrategy,
  model: StudentModel,
  conv: ConversationMemory,
): ResponseMode {
  const lowEngage = model.engagement < 1.5;
  const prefersChoice = model.choicePreference >= 3;

  switch (strategy) {
    case "safety_intervention":
      return "affirm_and_wait";
    case "clarify_meaning":
      return conv.lastResponseMode === "forced_choice" ? "open_question" : "forced_choice";
    case "reflect_emotion":
      return "reflective_mirror";
    case "perspective_taking":
      return prefersChoice ? "forced_choice" : "open_question";
    case "reframe_defense":
      return "reflective_mirror";
    case "correct_misconception":
      return "gentle_hint";
    case "guide_expression":
      return prefersChoice ? "forced_choice" : "open_question";
    case "plan_practice":
      return "open_question";
    case "reinforce_practice":
      return "praise_and_advance";
    case "wait_and_listen":
      return "affirm_and_wait";
    case "re_engage":
      return lowEngage ? "forced_choice" : "affirm_and_wait";
    default:
      return "open_question";
  }
}

function pickHintLevel(
  strategy: TeachingStrategy,
  u: EkluResult,
  conv: ConversationMemory,
): HintLevel {
  // 정답을 먼저 주지 않는 원칙: 기본은 0 또는 1, 이전 대비 +1만 허용.
  const prev = conv.lastHintLevel ?? 0;
  let target: HintLevel = 0;
  if (strategy === "guide_expression" || strategy === "correct_misconception") target = 1;
  if (strategy === "plan_practice") target = 1;
  if (u.confidence === "low" && strategy !== "wait_and_listen") target = Math.max(target, 1) as HintLevel;

  const capped = Math.min(target, prev + 1) as HintLevel;
  return Math.max(0, capped) as HintLevel;
}

function pickPraise(
  u: EkluResult,
  model: StudentModel,
  goal: PedagogicalGoal,
  strategy: TeachingStrategy,
): { should: boolean; reason?: string } {
  if (strategy === "safety_intervention" || strategy === "re_engage")
    return { should: false };

  const intents = [u.intentAnalysis.primary, ...u.intentAnalysis.secondary];
  if (intents.includes("empathy") && goal !== "practice_reinforce")
    return { should: true, reason: "empathy_expressed" };
  if (intents.includes("apology") && goal === "expression_revision")
    return { should: true, reason: "apology_attempted" };
  if (goal === "practice_reinforce" && model.engagement >= 3)
    return { should: true, reason: "practice_effort" };
  return { should: false };
}

function shouldAdvance(
  goal: PedagogicalGoal,
  strategy: TeachingStrategy,
  u: EkluResult,
  mem: LearningMemory,
  insufficient: boolean,
): boolean {
  if (insufficient) return false;
  if (u.status !== "ok") return false;
  if (u.confidence === "low") return false;
  if (strategy === "safety_intervention") return false;
  if (strategy === "clarify_meaning") return false;
  if (strategy === "re_engage") return false;

  switch (goal) {
    case "emotion_awareness":
      // 감정을 스스로 언급했고 방어 반응이 없을 때만
      return (
        !u.defensiveResponse.detected &&
        u.emotionAnalysis.confidence >= 0.6 &&
        u.emotionAnalysis.primary !== "neutral"
      );
    case "empathy":
      return (mem.empathySuccessCount ?? 0) >= 10;
    case "expression_revision":
      return strategy === "reinforce_practice";
    case "practice_plan":
      return u.intentAnalysis.primary !== "avoid" && u.confidence !== "low";
    case "practice_reinforce":
      return false; // 실천 강화는 스스로 멈추지 않는다
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────
// 로그(내부용) — 학생 노출 금지
// ─────────────────────────────────────────────────────────────

export function serializePlannerLog(d: TeachingDecision): string {
  return [
    `goal=${d.goal}`,
    `strategy=${d.strategy}`,
    `mode=${d.responseMode}`,
    `hint=${d.hintLevel}`,
    `praise=${d.shouldPraise}${d.praiseReason ? `(${d.praiseReason})` : ""}`,
    `advance=${d.shouldAdvanceStage}${d.nextStage ? `->${d.nextStage}` : ""}`,
    `safety=${d.safety.level}`,
    `reason=${d.internalReason}`,
  ].join(" | ");
}