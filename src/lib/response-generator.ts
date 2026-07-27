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

/** 금지 표현 — 학생에게 보이면 안 되는 부정/책임 추궁 문구. */
const FORBIDDEN_PHRASES: Array<[RegExp, string]> = [
  [/틀렸어\.?/g, "조금 더 생각해 볼까?"],
  [/오답이야\.?/g, "조금 더 생각해 볼까?"],
  [/왜 그렇게 했어\??/g, "그때 어떤 마음이었어요?"],
  [/왜 그랬어\??/g, "그때 어떤 마음이었어요?"],
  [/그건 아니야\.?/g, "다르게 볼 수도 있어요."],
  [/실망이야\.?/g, "괜찮아요."],
  [/잘못했어\.?/g, "다음에 함께 다시 해 봐요."],
  [/너는 나쁜 아이야\.?/g, ""],
  [/천재네\.?/g, ""],
  [/최고다\.?/g, ""],
  [/넌 정말 훌륭해\.?/g, ""],
  [/너는 착한 아이야\.?/g, ""],
];

function sanitize(text: string): string {
  let out = text;
  for (const [re, replace] of FORBIDDEN_PHRASES) out = out.replace(re, replace);
  for (const w of FORBIDDEN) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    out = out.replace(re, "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
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

function hintLine(level: HintLevel, seed: number): string | null {
  switch (level) {
    case 0:
      return null;
    case 1:
      return pick(
        [
          "핵심 낱말: 친구 마음, 배려.",
          "핵심 낱말: 속상함, 미안함.",
          "핵심 낱말: 존중, 이해.",
        ],
        seed,
      );
    case 2:
      return pick(
        [
          "이렇게 시작해 봐도 좋아요. ‘나는 ______라고 생각해.’",
          "이렇게 시작해 봐도 좋아요. ‘친구는 ______했을 것 같아.’",
          "이렇게 시작해 봐도 좋아요. ‘다음에는 ______할 거야.’",
        ],
        seed,
      );
    case 3:
      return "민수는 친구를 놀린 뒤, 친구가 속상한 표정을 짓는 걸 보고 “미안해.”라고 말했어요.";
    case 4:
      return "예시로 이렇게 말할 수도 있어요. “친구가 속상했을 것 같아. 다음에는 더 조심해서 말할게.”";
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
// 전략별 질문/문장
// ─────────────────────────────────────────────────────────────

function coreLine(strategy: TeachingStrategy, topic: string | undefined, seed: number): string {
  switch (strategy) {
    case "acknowledge_emotion":
      return pick(
        ["그 마음, 선생님도 이해해요.", "그럴 수도 있겠구나.", "그런 마음이 들 수 있어요."],
        seed,
      );
    case "reflect_student_words":
      return "그러니까 이런 마음이었구나.";
    case "open_question":
      return pick(
        [
          "친구는 어떤 기분이었을까?",
          "다른 방법도 있었을까?",
          "다음에는 어떻게 하면 좋을까?",
          "어떤 말이 더 어울릴까?",
        ],
        seed,
      );
    case "easy_open_question":
      return pick(["친구 마음은 어땠을까?", "다른 방법이 있을까?"], seed);
    case "forced_choice":
      return "이 중에서 골라 볼래요?";
    case "perspective_shift":
      return pick(
        [
          "친구 입장에서 생각해 볼까?",
          "친구는 어떤 기분이었을까?",
          "친구라면 어떻게 느꼈을까?",
        ],
        seed,
      );
    case "counterexample":
      return "만약 친구가 너에게 같은 말을 했다면, 기분이 어땠을까?";
    case "hint_level_1":
    case "hint_level_2":
      return "생각을 조금 도와줄게요.";
    case "show_example":
      return "비슷한 이야기를 하나 들려줄게요.";
    case "show_model_answer":
      return "예시를 하나 보여줄게요.";
    case "encourage_retry":
      return pick(
        [
          "좋아. 조금만 더 생각해 볼까?",
          "한 번 더 해 보면 좋겠어.",
          "다른 방법도 떠오를까?",
        ],
        seed,
      );
    case "summarize_learning":
      return topic
        ? `오늘은 ${topic}에 대해 함께 이야기해 봤어요.`
        : "오늘은 친구 마음을 생각하는 연습을 했어요.";
    case "advance_stage":
      return "좋아! 이번 내용을 잘 이해했구나.";
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

  // Safety: 다른 전략 무시하고 Safety 문장만 반환
  if (d.strategy === "safety_intervention" || d.safetyAction !== "none") {
    return { text: sanitize(coreLine("safety_intervention", input.topicHint, 0)) };
  }

  const seed = seedOf(input);
  const parts: string[] = [];

  // Stage 이동 축하 — 축하 → 다음 안내 (감정/힌트/격려 붙이지 않는다)
  if (d.strategy === "advance_stage" || d.shouldAdvanceStage) {
    parts.push("좋아!");
    parts.push("이번 내용을 잘 이해했구나.");
    parts.push("이제 다음 활동으로 가 보자.");
    return finalize(parts, undefined, input, 4);
  }

  // summarize_learning: 새로운 내용 금지, 짧게
  if (d.strategy === "summarize_learning") {
    parts.push(coreLine("summarize_learning", input.topicHint, seed));
    parts.push("다음에도 한번 실천해 보자.");
    return finalize(parts, undefined, input, 3);
  }

  // reflect_student_words: 학생 표현을 최대한 유지
  if (d.strategy === "reflect_student_words") {
    if (input.studentWordsSummary) {
      parts.push(`그러니까 “${input.studentWordsSummary}” 이런 마음이었구나.`);
    } else {
      parts.push(coreLine("reflect_student_words", input.topicHint, seed));
    }
    return finalize(parts, undefined, input, 3);
  }

  // 1) 공감 — 학생 감정이 있으면 반드시 첫 문장
  const empathy = empathyLine(input.studentEmotion);
  if (empathy) parts.push(empathy);
  else if (d.strategy === "acknowledge_emotion") parts.push(coreLine("acknowledge_emotion", input.topicHint, seed));

  // 2) 힌트 전용 전략인 경우 — 힌트 본문만 사용
  if (isHintPrimary(d.strategy)) {
    const h = hintLine(d.hintLevel, seed);
    if (h) parts.push(h);
    if (d.strategy === "show_model_answer") {
      // Hint4 마지막 문장은 반드시 자기 말로 재표현 유도
      parts.push("이제 너의 말로 다시 표현해 볼까?");
      return finalize(parts, praiseLine(d.praiseReason), input, 5);
    }
  } else {
    // 3) 핵심 질문/문장
    if (d.strategy !== "acknowledge_emotion") {
      parts.push(coreLine(d.strategy, input.topicHint, seed));
    }

    // 4) 필요 시 힌트 (Planner가 준 레벨 그대로)
    if (d.hintLevel > 0) {
      const h = hintLine(d.hintLevel, seed);
      if (h) parts.push(h);
    }
  }

  return finalize(parts, praiseLine(d.praiseReason), input, 4);
}

function finalize(
  parts: string[],
  praise: string | null | undefined,
  input: ResponseInput,
  maxSentences: number,
): ResponseOutput {
  // 칭찬은 격려로 마지막에 붙인다 (행동 칭찬만)
  if (praise) parts.push(praise);

  // 한 번에 질문 하나 — 질문 문장은 첫 번째 것만 유지
  let seenQuestion = false;
  const trimmed = parts.filter((s) => {
    if (!s) return false;
    if (endsWithQuestion(s)) {
      if (seenQuestion) return false;
      seenQuestion = true;
    }
    return true;
  });

  // 문장 수 제한
  const capped = trimmed.slice(0, Math.max(2, maxSentences));
  const combined = capped.join(" ");
  const last = input.conversationMemory?.lastAiSentence?.trim();
  const text =
    last && last === combined ? combined + " 조금 다르게 물어볼게요." : combined;

  const out: ResponseOutput = { text: sanitize(text) };
  const d = input.decision;
  if (d.responseMode === "forced_choice" || d.strategy === "forced_choice") {
    out.choices = buildChoices(input);
  }
  return out;
}

function seedOf(input: ResponseInput): number {
  const key = `${input.decision.strategy}|${input.decision.hintLevel}|${input.currentStage ?? ""}|${input.conversationMemory?.lastAiSentence ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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