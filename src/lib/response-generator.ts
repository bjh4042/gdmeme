/**
 * Response Generator Core v1.0 — Teaching Engine Part 2-1
 *
 * 역할: Teaching Planner의 결정을 초등학교 3~4학년이 이해할 수 있는
 * 자연스러운 담임선생님 말투 문장으로 변환한다.
 *
 *   ❌ 새 전략/새 목표/Stage 변경/학생 분석 금지
 *   ❌ 내부 상태·용어(AI, model, stage, planner, strategy 등) 노출 금지
 *   ❌ Hint 상승·하강 금지 (Planner가 정한 HintLevel 그대로 사용)
 *   ✅ 최종 학생 문장만 반환한다. JSON/분석/체크리스트 출력 금지.
 *
 * 문장 구조 원칙: 공감 → 질문 → 힌트(필요 시) → 격려
 * 기본 2~4문장, 한 문장 30자 내외, 한 번에 한 가지 질문.
 */
import type { Emotion, LearningStage } from "./eklu-engine";
import type {
  HintLevel,
  PraiseReason,
  SafetyAction,
  StrategyDecision,
  TeachingStrategy,
} from "./teaching-strategy";
import type { ConversationMemory } from "./teaching-planner";

// ─────────────────────────────────────────────────────────────
// 입력
// ─────────────────────────────────────────────────────────────

export type ResponseInput = {
  decision: StrategyDecision;
  studentEmotion?: Emotion;
  studentWordsSummary?: string; // reflect_student_words 용 (있으면 활용)
  topicHint?: string; // 예: "친구에게 사과하는 상황"
  choices?: string[]; // Planner가 준 선택지 후보 (없으면 기본 생성)
  conversationMemory?: ConversationMemory & { lastAiSentence?: string };
  currentStage?: LearningStage;
};

export type ResponseOutput = {
  text: string; // 학생에게 보여줄 최종 문장 (여러 줄 가능)
  choices?: string[]; // forced_choice 일 때만
};

// ─────────────────────────────────────────────────────────────
// 절대 금지 용어 검증(내부 안전망)
// ─────────────────────────────────────────────────────────────

const FORBIDDEN = [
  "AI",
  "모델",
  "분석",
  "점수",
  "confidence",
  "rule",
  "stage",
  "planner",
  "engine",
  "strategy",
  "internal",
  "system",
  "prompt",
];

function sanitize(text: string): string {
  let out = text;
  for (const w of FORBIDDEN) {
    const re = new RegExp(w, "gi");
    out = out.replace(re, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

// ─────────────────────────────────────────────────────────────
// 공감 표현
// ─────────────────────────────────────────────────────────────

function empathyLine(e?: Emotion): string | null {
  switch (e) {
    case "sadness":
      return "속상했겠구나.";
    case "anger":
      return "많이 화가 났겠구나.";
    case "unfair":
      return "억울했겠구나.";
    case "sorry":
      return "마음이 무거웠겠구나.";
    case "shy":
      return "조금 부끄러웠겠구나.";
    case "nervous":
      return "조마조마했겠구나.";
    case "confused":
      return "많이 헷갈렸겠구나.";
    case "joy":
      return "기뻤겠구나.";
    case "playful":
      return "재미있게 이야기하고 싶었구나.";
    default:
      return null;
  }
}

function praiseLine(r?: PraiseReason): string | null {
  switch (r) {
    case "recognized_emotion":
      return "네 마음을 잘 살펴봤구나.";
    case "considered_other_perspective":
      return "친구 마음도 생각해 봤구나.";
    case "accepted_responsibility":
      return "네 행동을 돌아본 게 참 멋져.";
    case "improved_expression":
      return "더 좋은 말을 찾아보려고 했구나.";
    case "gave_specific_plan":
      return "실천할 방법을 구체적으로 말해 줬구나.";
    case "persisted_after_difficulty":
      return "어려운데도 끝까지 생각해 줬구나.";
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 힌트 표현 — Planner가 정한 레벨만 사용, 스스로 올리거나 낮추지 않는다.
// ─────────────────────────────────────────────────────────────

function hintLine(level: HintLevel, topic?: string): string | null {
  const t = topic ?? "이 상황";
  switch (level) {
    case 0:
      return null;
    case 1:
      return "예를 들면 ‘친구의 마음’, ‘속상함’ 같은 말을 떠올려 봐도 좋아요.";
    case 2:
      return "‘나는 ______ 라고 생각해.’ 이렇게 시작해 봐도 좋아요.";
    case 3:
      return `${t}과 비슷한 이야기가 있어요. 친구가 놀이에서 빠졌을 때 “같이 하자.”라고 말해 준 친구가 있었대요.`;
    case 4:
      return "이렇게 말해 볼 수 있어요. “아까 그 말 미안해. 다음엔 조심할게.” 이 말을 네 방식으로 다시 표현해 볼래요?";
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 전략별 질문/문장
// ─────────────────────────────────────────────────────────────

function coreLine(strategy: TeachingStrategy, topic?: string): string {
  switch (strategy) {
    case "acknowledge_emotion":
      return "그 마음, 선생님도 이해해요.";
    case "reflect_student_words":
      return "네 이야기를 잠깐 정리해 봐도 될까요?";
    case "open_question":
      return "그때 어떤 마음이 들었어요?";
    case "easy_open_question":
      return "지금 떠오르는 한 마디만 말해 볼래요?";
    case "forced_choice":
      return "이 중에서 골라 볼래요?";
    case "perspective_shift":
      return "그때 친구는 어떤 기분이었을까요?";
    case "counterexample":
      return "친한 친구라면 놀려도 괜찮을까요? 한번 생각해 봐요.";
    case "hint_level_1":
    case "hint_level_2":
      return "생각을 조금 도와줄게요.";
    case "show_example":
      return "비슷한 이야기를 하나 들려줄게요.";
    case "show_model_answer":
      return "예시를 하나 보여줄게요. 이걸 네 말로 다시 표현해 볼래요?";
    case "encourage_retry":
      return "괜찮아요. 한 번 더 천천히 생각해 볼래요?";
    case "summarize_learning":
      return topic
        ? `오늘 우리는 ${topic}에 대해 함께 이야기해 봤어요.`
        : "오늘 함께 이야기한 걸 짧게 정리해 볼게요.";
    case "advance_stage":
      return "여기까지 참 잘 해냈어요. 다음 이야기로 함께 가 볼까요?";
    case "safety_intervention":
      return "지금 마음이 많이 힘들어 보여요. 잠깐 숨을 고르고, 옆에 있는 선생님이나 부모님께 꼭 이야기해 줘요.";
  }
}

// ─────────────────────────────────────────────────────────────
// 선택지 — 항상 "잘 모르겠어요." 포함, 최대 3개
// ─────────────────────────────────────────────────────────────

function buildChoices(input: ResponseInput): string[] {
  const base = input.choices && input.choices.length ? input.choices.slice(0, 2) : [];
  const defaults = ["친구의 마음이 궁금해요.", "내 마음을 먼저 말하고 싶어요."];
  const picked = base.length ? base : defaults;
  const withUnknown = [...picked.slice(0, 2), "잘 모르겠어요."];
  // 중복 제거
  return Array.from(new Set(withUnknown)).slice(0, 3);
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

export function generateResponse(input: ResponseInput): ResponseOutput {
  const d = input.decision;

  // Safety 최우선: Safety 문장만 반환
  if (d.strategy === "safety_intervention" || d.safetyAction !== "none") {
    return { text: sanitize(coreLine("safety_intervention")) };
  }

  const lines: string[] = [];

  // 1) 공감 (감정이 있을 때 첫 문장)
  const empathy = empathyLine(input.studentEmotion);
  if (empathy && d.strategy !== "advance_stage" && d.strategy !== "summarize_learning") {
    lines.push(empathy);
  }

  // 2) 학생 말 되짚기 (reflect_student_words 전용)
  if (d.strategy === "reflect_student_words" && input.studentWordsSummary) {
    lines.push(`네 이야기는 “${input.studentWordsSummary}” 이런 마음이었구나.`);
  }

  // 3) 핵심 문장 (질문 또는 안내)
  lines.push(coreLine(d.strategy, input.topicHint));

  // 4) 힌트 (Planner가 준 레벨 그대로)
  if (d.hintLevel > 0 && !isHintPrimary(d.strategy)) {
    const h = hintLine(d.hintLevel, input.topicHint);
    if (h) lines.push(h);
  } else if (isHintPrimary(d.strategy)) {
    const h = hintLine(d.hintLevel, input.topicHint);
    if (h) lines.push(h);
  }

  // 5) 칭찬 (Planner가 PraiseReason 준 경우에만, 행동에 대해서만)
  const praise = praiseLine(d.praiseReason);
  if (praise) lines.unshift(praise); // 공감보다 조금 앞에 두어도 자연스럽게 이어짐

  // 6) 격려 마무리 (한 번에 한 질문 유지 — 질문형이면 격려 생략)
  if (!endsWithQuestion(lines[lines.length - 1] ?? "") && d.strategy !== "advance_stage") {
    lines.push("천천히 생각해도 괜찮아요.");
  }

  // Stage 완료 축하
  if (d.shouldAdvanceStage) {
    lines.push("여기까지 참 잘 해냈어요.");
  }

  // 반복 방지: 직전 문장과 정확히 동일하면 대체
  const last = input.conversationMemory?.lastAiSentence?.trim();
  const combined = lines.join(" ");
  const text = last && last === combined ? combined + " 조금 다르게 물어볼게요." : combined;

  const output: ResponseOutput = { text: sanitize(text) };
  if (d.responseMode === "forced_choice" || d.strategy === "forced_choice") {
    output.choices = buildChoices(input);
  }
  return output;
}

function isHintPrimary(s: TeachingStrategy): boolean {
  return (
    s === "hint_level_1" ||
    s === "hint_level_2" ||
    s === "show_example" ||
    s === "show_model_answer"
  );
}

function endsWithQuestion(s: string): boolean {
  return /[?？]\s*$/.test(s.trim());
}