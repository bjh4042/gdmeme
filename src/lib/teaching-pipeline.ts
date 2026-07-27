/**
 * Teaching Pipeline Orchestrator v1.0 — Teaching Engine Part 3-2
 *
 * 역할: 전체 AI 교사의 실행 흐름을 순서대로 제어한다.
 *   ❌ 각 모듈의 판단을 대신하지 않는다 (순서 제어만).
 *   ❌ StudentModel을 직접 수정하지 않는다 (EKLU 결과만 사용).
 *   ❌ 학생에게 내부 상태/로그/체크리스트를 노출하지 않는다.
 *   ✅ 실패 시 각 단계별 안전 폴백을 사용해 절대 전체 실패하지 않는다.
 *
 * 실행 순서:
 *   ① EKLU → ② Planner → ③ Strategy → ④ StageDecision
 *   → ⑤ Generator → ⑥ QualityChecker → ⑦ 최종 응답
 */
import {
  understand,
  createStudentModel,
  type EkluResult,
  type EkluTurn,
  type LearningStage,
  type StudentModel,
} from "./eklu-engine";
import {
  planTeaching,
  type ConversationMemory,
  type LearningMemory,
  type PedagogicalGoal,
  type PedagogicalState,
  type SafetySignal,
  type TeachingDecision,
} from "./teaching-planner";
import {
  planStrategy,
  type StrategyDecision,
  type TeachingStrategy as StrategyName,
  type HintLevel,
  type ResponseMode,
  type ChoiceType,
} from "./teaching-strategy";
import { decideStage, type StageDecisionResult } from "./stage-decision";
import {
  generateResponse,
  type ResponseOutput,
} from "./response-generator";
import { checkResponseQuality } from "./response-quality-checker";

// ─────────────────────────────────────────────────────────────
// 입력 / 출력
// ─────────────────────────────────────────────────────────────

export type PipelineInput = {
  studentInput: string;
  conversationMemory?: ConversationMemory & {
    lastAiSentence?: string;
    lastGeneratedResponse?: string;
    history?: EkluTurn[];
  };
  learningMemory?: LearningMemory & {
    mastered?: boolean;
    recurring?: boolean;
    practiceHistory?: string[];
    goalHistory?: PedagogicalGoal[];
    successCount?: number;
    attemptCount?: number;
    practiceSuccessCount?: number;
  };
  studentModel?: StudentModel;
  currentStage?: LearningStage;
  pedagogicalState?: PedagogicalState;
  safetySignal?: SafetySignal;
  topicHint?: string;
  now?: number;
};

export type QualitySummary = {
  passedSafety: boolean;
  finalSentenceCount: number;
  wasModified: boolean;
  hintLevel: HintLevel;
};

export type PipelineLog = {
  timestamp: number;
  stage: LearningStage;
  goal: PedagogicalGoal;
  strategy: StrategyName | string;
  hint: HintLevel;
  quality: QualitySummary;
  plannerDecisionInternal: string;
  responseLength: number;
  processingTimeMs: number;
};

export type PipelineResult = {
  // 학생에게 보여줄 것
  response: string;
  choices?: string[];

  // 내부 유지용 — 학생 노출 금지
  updatedLearningMemory: NonNullable<PipelineInput["learningMemory"]>;
  updatedConversationMemory: NonNullable<PipelineInput["conversationMemory"]>;
  updatedPedagogicalState: PedagogicalState;
  stageResult: StageDecisionResult;
  plannerDecision: TeachingDecision;
  strategyDecision: StrategyDecision;
  qualitySummary: QualitySummary;
  log: PipelineLog;
};

// ─────────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────────

export function runTeachingPipeline(input: PipelineInput): PipelineResult {
  const startedAt = Date.now();

  const conv = input.conversationMemory ?? {};
  const mem = input.learningMemory ?? {};
  const ps: PedagogicalState =
    input.pedagogicalState ??
    ({
      currentGoal: "empathy",
      stage: input.currentStage ?? "discovery",
      turnsInGoal: 0,
    } as PedagogicalState);
  const safety: SafetySignal = input.safetySignal ?? { level: "none" };

  // ① EKLU
  let understanding: EkluResult;
  try {
    understanding = understand({
      input: input.studentInput,
      history: conv.history,
      model: input.studentModel,
      now: input.now,
    });
  } catch {
    understanding = fallbackUnderstanding(input.studentInput, input.studentModel);
  }

  // ② Teaching Planner
  let plannerDecision: TeachingDecision;
  try {
    plannerDecision = planTeaching({
      understanding,
      studentModel: understanding.studentModel,
      learningMemory: mem,
      conversationMemory: conv,
      pedagogicalState: ps,
      safetySignal: safety,
    });
  } catch {
    plannerDecision = fallbackPlanner(ps, safety);
  }

  // ③ Teaching Strategy Engine — Planner를 존중, 검증/확정만
  let strategyDecision: StrategyDecision;
  try {
    strategyDecision = planStrategy({
      understanding,
      studentModel: understanding.studentModel,
      learningMemory: mem,
      conversationMemory: {
        ...conv,
        lastStrategy: conv.lastTeacherStrategy as unknown as StrategyName | undefined,
      },
      pedagogicalState: ps,
      safetySignal: safety,
    });
  } catch {
    strategyDecision = fallbackStrategy(ps);
  }

  // Planner의 HintLevel/ResponseMode/Praise는 최종 결정으로 반영 (Strategy는 확정만)
  strategyDecision = {
    ...strategyDecision,
    hintLevel: clampHint(plannerDecision.hintLevel),
    responseMode: plannerDecision.responseMode ?? strategyDecision.responseMode,
    shouldAdvanceStage: plannerDecision.shouldAdvanceStage,
    nextStage: plannerDecision.nextStage,
    safetyAction: safety.level !== "none" ? "pause_and_ground" : "none",
  };

  // ④ Stage Decision — Planner를 수정하지 않고 이동 여부만 별도 판단
  let stageResult: StageDecisionResult;
  try {
    stageResult = decideStage({
      understanding,
      studentModel: understanding.studentModel,
      learningMemory: mem,
      conversationMemory: conv,
      pedagogicalState: ps,
      safetySignal: safety,
    });
  } catch {
    stageResult = fallbackStage(ps);
  }

  // ⑤ Response Generator
  let generated: ResponseOutput;
  try {
    generated = generateResponse({
      decision: strategyDecision,
      studentEmotion: understanding.emotionAnalysis?.primary ?? understanding.emotion,
      topicHint: input.topicHint,
      conversationMemory: conv,
      currentStage: ps.stage,
    });
  } catch {
    generated = {
      text: "그런 마음이 들 수 있어요. 조금 더 이야기해 볼까요?",
    };
  }

  // ⑥ Quality Checker
  let finalOut: ResponseOutput;
  try {
    finalOut = checkResponseQuality({
      generated,
      decision: strategyDecision,
      studentEmotion: understanding.emotionAnalysis?.primary ?? understanding.emotion,
      studentModel: understanding.studentModel,
      learningMemory: mem,
      conversationMemory: conv,
      safetySignal: safety,
      currentStage: ps.stage,
    });
  } catch {
    finalOut = generated;
  }

  // Safety는 최종 응답에서만 Safety 문장 유지 (Pipeline 계속 실행 후 강제 적용)
  if (safety.level === "high" || safety.level === "medium") {
    finalOut = {
      text: "지금은 마음이 많이 힘들 수 있어요. 선생님이나 부모님께 꼭 이야기해 주세요.",
    };
  }

  // ⑦ Memory 업데이트 — StudentModel은 EKLU 결과만 사용, Pipeline은 수정 안 함
  const updatedConversationMemory = updateConversationMemory({
    prev: conv,
    strategy: strategyDecision.strategy,
    hintLevel: strategyDecision.hintLevel,
    responseMode: strategyDecision.responseMode,
    generated: finalOut.text,
    understanding,
    topicHint: input.topicHint,
  });

  const updatedLearningMemory = updateLearningMemory({
    prev: mem,
    goal: plannerDecision.goal,
    strategy: strategyDecision.strategy,
    stageAdvanced: stageResult.shouldAdvanceStage,
    goalCompleted: stageResult.goalCompleted,
    understanding,
  });

  const updatedPedagogicalState: PedagogicalState = {
    currentGoal: plannerDecision.goal,
    stage: stageResult.shouldAdvanceStage
      ? stageResult.nextStage ?? ps.stage
      : ps.stage,
    turnsInGoal:
      plannerDecision.goal === ps.currentGoal
        ? (ps.turnsInGoal ?? 0) + 1
        : 1,
  };

  const qualitySummary: QualitySummary = {
    passedSafety: safety.level === "none" || finalOut.text.includes("선생님"),
    finalSentenceCount: countSentences(finalOut.text),
    wasModified: finalOut.text.trim() !== generated.text.trim(),
    hintLevel: strategyDecision.hintLevel,
  };

  const log: PipelineLog = {
    timestamp: startedAt,
    stage: ps.stage,
    goal: plannerDecision.goal,
    strategy: strategyDecision.strategy,
    hint: strategyDecision.hintLevel,
    quality: qualitySummary,
    plannerDecisionInternal: plannerDecision.internalReason,
    responseLength: finalOut.text.length,
    processingTimeMs: Date.now() - startedAt,
  };

  return {
    response: finalOut.text,
    choices: finalOut.choices,
    updatedLearningMemory,
    updatedConversationMemory,
    updatedPedagogicalState,
    stageResult,
    plannerDecision,
    strategyDecision,
    qualitySummary,
    log,
  };
}

// ─────────────────────────────────────────────────────────────
// Memory updaters
// ─────────────────────────────────────────────────────────────

function updateConversationMemory(params: {
  prev: NonNullable<PipelineInput["conversationMemory"]>;
  strategy: StrategyName;
  hintLevel: HintLevel;
  responseMode: ResponseMode;
  generated: string;
  understanding: EkluResult;
  topicHint?: string;
}): NonNullable<PipelineInput["conversationMemory"]> {
  const { prev, strategy, hintLevel, responseMode, generated, understanding, topicHint } =
    params;

  const reaction = inferStudentReaction(understanding);

  return {
    ...prev,
    lastTopic: topicHint ?? prev.lastTopic,
    lastScenario: prev.lastScenario,
    lastTeacherStrategy: strategy as unknown as ConversationMemory["lastTeacherStrategy"],
    lastHintLevel: hintLevel as unknown as ConversationMemory["lastHintLevel"],
    lastResponseMode: responseMode,
    lastStudentReaction: reaction,
    lastAiSentence: generated,
    lastGeneratedResponse: generated,
  };
}

function updateLearningMemory(params: {
  prev: NonNullable<PipelineInput["learningMemory"]>;
  goal: PedagogicalGoal;
  strategy: StrategyName;
  stageAdvanced: boolean;
  goalCompleted: boolean;
  understanding: EkluResult;
}): NonNullable<PipelineInput["learningMemory"]> {
  const { prev, goal, strategy, stageAdvanced, goalCompleted, understanding } = params;

  const attemptCount = (prev.attemptCount ?? 0) + 1;
  const successCount =
    (prev.successCount ?? 0) + (goalCompleted || stageAdvanced ? 1 : 0);

  const goalHistory = prev.goalHistory ? [...prev.goalHistory] : [];
  if (goalHistory[goalHistory.length - 1] !== goal) goalHistory.push(goal);

  const practiceHistory = prev.practiceHistory ? [...prev.practiceHistory] : [];
  if (strategy === "reinforce_practice" || strategy === "advance_stage") {
    practiceHistory.push(`${Date.now()}:${strategy}`);
  }

  const misconceptionSeen = prev.misconceptionSeen
    ? [...prev.misconceptionSeen]
    : [];
  const misKind = understanding.misconception?.kind;
  if (understanding.misconception?.detected && misKind && !misconceptionSeen.includes(misKind)) {
    misconceptionSeen.push(misKind);
  }

  const empathySuccessCount =
    (prev.empathySuccessCount ?? 0) +
    (goal === "empathy" && (goalCompleted || stageAdvanced) ? 1 : 0);

  const blameShiftCount =
    (prev.blameShiftCount ?? 0) +
    (understanding.defensiveResponse?.detected ? 1 : 0);

  return {
    ...prev,
    attemptCount,
    successCount,
    goalHistory,
    practiceHistory,
    misconceptionSeen,
    empathySuccessCount,
    blameShiftCount,
    mastered: goalCompleted || prev.mastered,
    recurring:
      (understanding.repeatedError?.detected ?? false) || prev.recurring,
  };
}

// ─────────────────────────────────────────────────────────────
// Fallbacks
// ─────────────────────────────────────────────────────────────

function fallbackUnderstanding(
  raw: string,
  model?: StudentModel,
): EkluResult {
  const m = model ?? createStudentModel();
  return {
    normalized: raw ?? "",
    intent: "share_feeling",
    emotion: "neutral",
    emotionTrajectory: [],
    studentModel: m,
    repeatedError: { detected: false },
    misconception: { detected: false },
    stage: m.stage,
    confidence: "low",
    clarifierHints: [],
    normalization: {
      normalizedText: raw ?? "",
      meaningCandidates: [],
      selectedMeaning: "unknown",
      selectedByContext: false,
    },
    intentAnalysis: { primary: "share_feeling", confidence: 0.3 },
    emotionAnalysis: { primary: "neutral", intensity: 0, confidence: 0.3 },
    defensiveResponse: { detected: false },
    clarificationNeed: { required: true, target: "meaning", strategy: "open_question" },
    evidence: { matchedTokens: [], contextSignals: ["fallback"], ruleIds: [] },
    status: "insufficient_data",
  };
}

function fallbackPlanner(
  ps: PedagogicalState,
  safety: SafetySignal,
): TeachingDecision {
  return {
    goal: ps.currentGoal,
    strategy: "wait_and_listen",
    responseMode: "open_question",
    hintLevel: 0,
    choiceType: "none",
    shouldPraise: false,
    shouldAdvanceStage: false,
    waitForStudent: true,
    internalReason: "fallback:planner",
    safety,
  };
}

function fallbackStrategy(ps: PedagogicalState): StrategyDecision {
  return {
    goal: ps.currentGoal,
    strategy: "open_question",
    responseMode: "open_question",
    hintLevel: 0,
    shouldAdvanceStage: false,
    choiceType: "none",
    safetyAction: "none",
    internalReason: "fallback:strategy",
  };
}

function fallbackStage(ps: PedagogicalState): StageDecisionResult {
  return {
    shouldAdvanceStage: false,
    goalCompleted: false,
    blockingReason: "fallback",
    checklistResult: {
      goal: ps.currentGoal,
      items: [],
      passed: 0,
      required: 0,
      allPassed: false,
    },
    plannerDecision: { shouldAdvanceStage: false },
    status: "insufficient_data",
    internalRecord: {
      stageBefore: ps.stage,
      stageAfter: ps.stage,
      usedEvidence: ["fallback"],
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function clampHint(level: number): HintLevel {
  const n = Math.max(0, Math.min(4, Math.floor(level ?? 0)));
  return n as HintLevel;
}

function countSentences(text: string): number {
  return text
    .split(/(?<=[.!?？！])\s+|\n+/g)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function inferStudentReaction(
  u: EkluResult,
): ConversationMemory["lastStudentReaction"] {
  if (u.defensiveResponse?.detected) return "defensive";
  const p = u.intentAnalysis?.primary;
  if (p === "avoid") return "avoidant";
  if (p === "share_feeling" || p === "apology") return "reflective";
  if (u.status === "insufficient_data") return "confused";
  return "engaged";
}

// 학생에게 노출용 최소 뷰
export function toStudentView(result: PipelineResult): {
  response: string;
  choices?: string[];
} {
  return result.choices
    ? { response: result.response, choices: result.choices }
    : { response: result.response };
}