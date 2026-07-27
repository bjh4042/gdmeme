/**
 * Stage Decision Engine v1.0 — Teaching Engine Part 1-3
 *
 * 역할: 현재 학습 목표(Goal)의 완료 여부와 다음 Stage 이동만 판단한다.
 *   ❌ 학생 문장 생성 금지 (Response Generator 담당)
 *   ❌ 교수 전략 선택 금지 (Teaching Strategy Engine 담당)
 *   ❌ 학생 내부 판단 노출 금지
 *   ✅ Stage 완료는 항상 체크리스트 기반. 단일 점수로 결정하지 않는다.
 *
 * 판단 우선순위:
 *   Safety → CurrentGoal → LearningMemory → StudentModel
 *   → ResponseQuality → ConversationHistory → PedagogicalState → StageDecision
 */
import type { EkluResult, LearningStage, StudentModel } from "./eklu-engine";
import type {
  ConversationMemory,
  LearningMemory,
  PedagogicalGoal,
  PedagogicalState,
  SafetySignal,
} from "./teaching-planner";

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export type ChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
  evidence?: string;
};

export type ChecklistResult = {
  goal: PedagogicalGoal;
  items: ChecklistItem[];
  passedCount: number;
  requiredCount: number;
};

export type QualityScores = {
  empathy: number; // 0..1
  perspectiveTaking: number;
  responsibility: number;
  expressionSafety: number;
  specificity: number;
  effort: number;
  // languageFormLevel은 Stage 판단에서 사용하지 않는다.
};

export type StageDecisionInput = {
  understanding: EkluResult;
  studentModel?: StudentModel;
  learningMemory?: LearningMemory & {
    mastered?: boolean;
    recurring?: boolean;
    practiceSuccessCount?: number;
  };
  conversationMemory?: ConversationMemory;
  pedagogicalState: PedagogicalState;
  safetySignal?: SafetySignal;
  quality?: Partial<QualityScores>;
  // Response Generator/Coach 쪽에서 관측한 부가 신호
  studentRephrasedInOwnWords?: boolean;
  copiedModelAnswer?: boolean;
  topicChanged?: boolean;
};

export type PlannerDecisionSummary = {
  shouldAdvanceStage: boolean;
  nextStage?: LearningStage;
};

export type StageDecisionResult = {
  shouldAdvanceStage: boolean;
  nextStage?: LearningStage;
  goalCompleted: boolean;
  blockingReason?: string;
  checklistResult: ChecklistResult;
  plannerDecision: PlannerDecisionSummary;
  status: "ok" | "insufficient_data" | "blocked";
  // 내부 로그 — 학생 노출 금지
  internalRecord: {
    stageBefore: LearningStage;
    stageAfter: LearningStage;
    usedEvidence: string[];
  };
};

// ─────────────────────────────────────────────────────────────
// Stage 순서
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

export function decideStage(input: StageDecisionInput): StageDecisionResult {
  const u = input.understanding;
  const model = input.studentModel ?? u.studentModel;
  const mem = input.learningMemory ?? {};
  const ps = input.pedagogicalState;
  const safety: SafetySignal = input.safetySignal ?? { level: "none" };
  const q: QualityScores = withDefaults(input.quality);
  const evidence: string[] = [];

  // ① Safety — 이동/후퇴 모두 판단 중지
  if (safety.level === "high" || safety.level === "medium") {
    return blocked({
      input,
      reason: `safety:${safety.level}${safety.kind ? `:${safety.kind}` : ""}`,
      evidence,
      checklist: emptyChecklist(ps.currentGoal),
    });
  }

  // 초기 관찰 부족 — 완료 판단 자체를 하지 않는다
  if (model.observationCount < 3 || u.status === "insufficient_data") {
    return insufficient({ input, evidence, checklist: emptyChecklist(ps.currentGoal) });
  }

  // Clarification 필요 → Stage 유지
  if (u.clarificationNeed?.required) {
    return blocked({
      input,
      reason: "clarification_required",
      evidence,
      checklist: emptyChecklist(ps.currentGoal),
    });
  }

  // 오개념 지속 → 특히 empathy 이후 이동 금지
  if (u.misconception.detected) {
    return blocked({
      input,
      reason: `misconception:${u.misconception.kind ?? "?"}`,
      evidence,
      checklist: emptyChecklist(ps.currentGoal),
    });
  }

  // 학생 모델 불안정 → 이동 금지
  if (model.stability < 0.3) {
    return blocked({
      input,
      reason: `unstable_model:stability=${model.stability.toFixed(2)}`,
      evidence,
      checklist: emptyChecklist(ps.currentGoal),
    });
  }

  // Learning Memory — 반복 오류가 계속되면 현재 Stage 유지
  if (mem.recurring) {
    return blocked({
      input,
      reason: "learning_memory:recurring_errors",
      evidence,
      checklist: emptyChecklist(ps.currentGoal),
    });
  }

  // Learning Memory — 이미 mastered면 다음 Goal로 넘긴다
  if (mem.mastered) {
    evidence.push("learning_memory:mastered");
    return advance({
      input,
      checklist: fullyPassedChecklist(ps.currentGoal),
      evidence,
      reason: "already_mastered",
    });
  }

  // ② Goal별 체크리스트 평가
  const checklist = evaluateChecklist(ps.currentGoal, {
    u,
    model,
    quality: q,
    mem,
    studentRephrasedInOwnWords: !!input.studentRephrasedInOwnWords,
    copiedModelAnswer: !!input.copiedModelAnswer,
  });

  // 사용된 근거 요약
  for (const item of checklist.items) {
    if (item.evidence) evidence.push(`${item.id}:${item.evidence}`);
  }

  const allPassed = checklist.passedCount >= checklist.requiredCount;
  if (!allPassed) {
    const missing = checklist.items.find((i) => !i.passed);
    return blocked({
      input,
      reason: `checklist_incomplete:${missing?.id ?? "?"}`,
      evidence,
      checklist,
    });
  }

  // Practice 특례 — LearningMemory 실천 성공 기록이 필요
  if (ps.currentGoal === "practice_reinforce" && (mem.practiceSuccessCount ?? 0) < 1) {
    return blocked({
      input,
      reason: "practice_success_not_recorded",
      evidence,
      checklist,
    });
  }

  // 주제 변경은 Stage 후퇴가 아니라 이동 보류로 처리
  if (input.topicChanged) {
    return blocked({ input, reason: "topic_changed", evidence, checklist });
  }

  return advance({ input, checklist, evidence, reason: "checklist_complete" });
}

// ─────────────────────────────────────────────────────────────
// 체크리스트 정의
// ─────────────────────────────────────────────────────────────

type EvalCtx = {
  u: EkluResult;
  model: StudentModel;
  quality: QualityScores;
  mem: NonNullable<StageDecisionInput["learningMemory"]>;
  studentRephrasedInOwnWords: boolean;
  copiedModelAnswer: boolean;
};

function evaluateChecklist(goal: PedagogicalGoal, ctx: EvalCtx): ChecklistResult {
  switch (goal) {
    case "emotion_awareness":
      return check(goal, discoveryItems(ctx));
    case "empathy":
      return check(goal, empathyItems(ctx));
    case "expression_revision":
      return check(goal, changeItems(ctx));
    case "practice_plan":
      return check(goal, practicePlanItems(ctx));
    case "practice_reinforce":
      return check(goal, practiceReinforceItems(ctx));
  }
}

function discoveryItems(ctx: EvalCtx): ChecklistItem[] {
  const { u, model, quality } = ctx;
  const intents = [u.intentAnalysis.primary, ...u.intentAnalysis.secondary];
  const notAvoiding = u.intentAnalysis.primary !== "avoid" && model.engagement >= 2;
  const canExplain = intents.includes("explain") || quality.specificity >= 0.5;
  const understandsSituation = quality.effort >= 0.4 || u.emotionAnalysis.confidence >= 0.5;
  return [
    p("d1", "문제 상황 이해", understandsSituation, `effort=${quality.effort.toFixed(2)}`),
    p("d2", "자신의 행동 설명", canExplain, `intents=${intents.join(",")}`),
    p("d3", "회피 없음", notAvoiding, `engagement=${model.engagement.toFixed(2)}`),
    p("d4", "대화 참여 유지", model.engagement >= 2, undefined),
  ];
}

function empathyItems(ctx: EvalCtx): ChecklistItem[] {
  const { u, quality } = ctx;
  const emotionRecognized =
    quality.empathy >= 0.4 || u.emotionAnalysis.primary !== "neutral";
  const responsibility = quality.responsibility >= 0.5 && !u.defensiveResponse.detected;
  const blameShiftReduced = !u.defensiveResponse.detected;
  const empathyExpressed = quality.empathy >= 0.5;
  return [
    p("e1", "상대 감정 1개 이상 인식", emotionRecognized),
    p("e2", "영향 인식", responsibility, `resp=${quality.responsibility.toFixed(2)}`),
    p("e3", "책임 전가 감소", blameShiftReduced),
    p("e4", "공감 표현 포함", empathyExpressed),
  ];
}

function changeItems(ctx: EvalCtx): ChecklistItem[] {
  const { quality, studentRephrasedInOwnWords, copiedModelAnswer } = ctx;
  return [
    p("c1", "더 좋은 표현 생성", quality.expressionSafety >= 0.6),
    p("c2", "새로운 행동 제안", quality.specificity >= 0.5),
    p("c3", "자기 말로 재표현", studentRephrasedInOwnWords),
    p("c4", "모범답안 복사 아님", !copiedModelAnswer),
  ];
}

function practicePlanItems(ctx: EvalCtx): ChecklistItem[] {
  const { quality, u } = ctx;
  const hasPlan = quality.specificity >= 0.5;
  const concrete = quality.specificity >= 0.6 && quality.effort >= 0.4;
  const noRepeatedMisconception = !u.misconception.detected;
  return [
    p("pp1", "실제 실천 계획", hasPlan),
    p("pp2", "구체적 행동 포함", concrete),
    p("pp3", "오개념 반복 없음", noRepeatedMisconception),
    p("pp4", "회피 없음", u.intentAnalysis.primary !== "avoid"),
  ];
}

function practiceReinforceItems(ctx: EvalCtx): ChecklistItem[] {
  const { mem, u, quality } = ctx;
  return [
    p("pr1", "실제 실천 계획", quality.specificity >= 0.5),
    p("pr2", "구체적 행동 포함", quality.specificity >= 0.6),
    p("pr3", "오개념 반복 없음", !u.misconception.detected),
    p(
      "pr4",
      "실천 성공 기록",
      (mem.practiceSuccessCount ?? 0) >= 1,
      `count=${mem.practiceSuccessCount ?? 0}`,
    ),
  ];
}

function p(id: string, label: string, passed: boolean, evidence?: string): ChecklistItem {
  return { id, label, passed, evidence };
}

function check(goal: PedagogicalGoal, items: ChecklistItem[]): ChecklistResult {
  return {
    goal,
    items,
    passedCount: items.filter((i) => i.passed).length,
    requiredCount: items.length,
  };
}

function emptyChecklist(goal: PedagogicalGoal): ChecklistResult {
  return { goal, items: [], passedCount: 0, requiredCount: 0 };
}

function fullyPassedChecklist(goal: PedagogicalGoal): ChecklistResult {
  return { goal, items: [], passedCount: 1, requiredCount: 1 };
}

function withDefaults(q?: Partial<QualityScores>): QualityScores {
  return {
    empathy: q?.empathy ?? 0,
    perspectiveTaking: q?.perspectiveTaking ?? 0,
    responsibility: q?.responsibility ?? 0,
    expressionSafety: q?.expressionSafety ?? 0,
    specificity: q?.specificity ?? 0,
    effort: q?.effort ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// 결과 헬퍼
// ─────────────────────────────────────────────────────────────

function advance(args: {
  input: StageDecisionInput;
  checklist: ChecklistResult;
  evidence: string[];
  reason: string;
}): StageDecisionResult {
  const stage = args.input.pedagogicalState.stage;
  const next = nextStageOf(stage);
  const canAdvance = !!next;
  return {
    shouldAdvanceStage: canAdvance,
    nextStage: next,
    goalCompleted: true,
    blockingReason: canAdvance ? undefined : "final_stage",
    checklistResult: args.checklist,
    plannerDecision: { shouldAdvanceStage: canAdvance, nextStage: next },
    status: "ok",
    internalRecord: {
      stageBefore: stage,
      stageAfter: next ?? stage,
      usedEvidence: [...args.evidence, `advance:${args.reason}`],
    },
  };
}

function blocked(args: {
  input: StageDecisionInput;
  reason: string;
  evidence: string[];
  checklist: ChecklistResult;
}): StageDecisionResult {
  const stage = args.input.pedagogicalState.stage;
  return {
    shouldAdvanceStage: false,
    nextStage: undefined,
    goalCompleted: false,
    blockingReason: args.reason,
    checklistResult: args.checklist,
    plannerDecision: { shouldAdvanceStage: false },
    status: "blocked",
    internalRecord: {
      stageBefore: stage,
      stageAfter: stage,
      usedEvidence: [...args.evidence, `blocked:${args.reason}`],
    },
  };
}

function insufficient(args: {
  input: StageDecisionInput;
  evidence: string[];
  checklist: ChecklistResult;
}): StageDecisionResult {
  const stage = args.input.pedagogicalState.stage;
  return {
    shouldAdvanceStage: false,
    nextStage: undefined,
    goalCompleted: false,
    blockingReason: "insufficient_data",
    checklistResult: args.checklist,
    plannerDecision: { shouldAdvanceStage: false },
    status: "insufficient_data",
    internalRecord: {
      stageBefore: stage,
      stageAfter: stage,
      usedEvidence: [...args.evidence, "insufficient_data"],
    },
  };
}

// ─────────────────────────────────────────────────────────────
// 내부 로그 — 학생 노출 금지
// ─────────────────────────────────────────────────────────────

export function serializeStageDecisionLog(r: StageDecisionResult): string {
  return [
    `status=${r.status}`,
    `goalCompleted=${r.goalCompleted}`,
    `advance=${r.shouldAdvanceStage}${r.nextStage ? `->${r.nextStage}` : ""}`,
    `blocking=${r.blockingReason ?? "-"}`,
    `checklist=${r.checklistResult.passedCount}/${r.checklistResult.requiredCount}`,
    `evidence=${r.internalRecord.usedEvidence.join(",")}`,
  ].join(" | ");
}