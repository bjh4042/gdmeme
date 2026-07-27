/**
 * Response Quality Checker v1.0 — Teaching Engine Part 3-1
 *
 * 역할: Response Generator가 만든 문장을 검사하고 필요 시 수정한다.
 *   ❌ 새 문장을 창작하지 않는다.
 *   ❌ Goal/Strategy/Stage/HintLevel을 바꾸지 않는다.
 *   ✅ 최종 학생에게 보여줄 문장만 결정한다.
 *
 * 검사 순서(고정):
 *   Safety → 금지 표현 → 교육 원칙 → 문장 길이 → Hint 규칙
 *   → 공감 → 질문 수 → 칭찬 방식 → Stage 규칙 → 반복 → 쉬운 단어
 *   → 존댓말 → 비난/책임 추궁 → 선택지 → 모범답안 → 학습목표 → 최종
 *
 * 출력: 학생에게 보여줄 최종 문장만. JSON/체크리스트/설명/내부 상태 금지.
 */
import type { Emotion, LearningStage } from "./eklu-engine";
import type {
  HintLevel,
  StrategyDecision,
  TeachingStrategy,
} from "./teaching-strategy";
import type {
  ConversationMemory,
  LearningMemory,
  PedagogicalGoal,
  SafetySignal,
} from "./teaching-planner";
import type { StudentModel } from "./eklu-engine";
import type { ResponseOutput } from "./response-generator";

// ─────────────────────────────────────────────────────────────
// 입력
// ─────────────────────────────────────────────────────────────

export type QualityCheckInput = {
  generated: ResponseOutput;
  decision: StrategyDecision;
  studentEmotion?: Emotion;
  studentModel?: StudentModel;
  learningMemory?: LearningMemory;
  conversationMemory?: ConversationMemory & { lastAiSentence?: string };
  safetySignal?: SafetySignal;
  currentStage?: LearningStage;
};

export type QualityCheckOutput = {
  text: string;
  choices?: string[];
};

// ─────────────────────────────────────────────────────────────
// 상수: 금지/치환/쉬운말/안전 응답
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_TERMS = [
  "AI",
  "모델",
  "분석",
  "엔진",
  "프롬프트",
  "시스템",
  "Planner",
  "Stage",
  "confidence",
  "rule",
  "strategy",
  "engine",
  "prompt",
  "system",
  "internal",
];

/** 금지 표현 → 부드러운 표현 자동 치환. */
const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/틀렸어요?\.?/g, "같이 다시 생각해 봐요."],
  [/틀렸어\.?/g, "같이 다시 생각해 봐요."],
  [/오답이에요\.?/g, "같이 다시 생각해 봐요."],
  [/오답이야\.?/g, "같이 다시 생각해 봐요."],
  [/왜 그렇게 했어요\??/g, "그때는 어떤 마음이었을까요?"],
  [/왜 그렇게 했어\??/g, "그때는 어떤 마음이었을까요?"],
  [/왜 그랬어요\??/g, "그때는 어떤 마음이었을까요?"],
  [/왜 그랬어\??/g, "그때는 어떤 마음이었을까요?"],
  [/왜 그렇게 했니\??/g, "그때는 어떤 마음이었을까요?"],
  [/실망이에요\.?/g, "괜찮아요."],
  [/실망이야\.?/g, "괜찮아요."],
  [/너는 나쁜 아이야\.?/g, ""],
  [/너는 나쁜 아이에요\.?/g, ""],
  [/그건 아니야\.?/g, "다르게 볼 수도 있어요."],
  [/그건 아니에요\.?/g, "다르게 볼 수도 있어요."],
  [/잘못했어\.?/g, "다음에 함께 다시 해 봐요."],
  // 자체 칭찬(사람 칭찬) 삭제 — 행동 칭찬은 유지
  [/너는 착해요?\.?/g, ""],
  [/너는 착한 아이야\.?/g, ""],
  [/너는 훌륭해요?\.?/g, ""],
  [/천재네요?\.?/g, ""],
  [/최고에요\.?/g, ""],
  [/최고다\.?/g, ""],
];

/** 쉬운 말 치환 (초등 3~4 수준). */
const EASY_WORDS: Array<[RegExp, string]> = [
  [/배려심/g, "친구를 생각하는 마음"],
  [/공감능력/g, "친구 마음을 느끼는 힘"],
  [/자기중심적/g, "내 생각만 하는"],
  [/타인/g, "다른 사람"],
  [/감정조절/g, "마음을 다스리기"],
  [/의사소통/g, "이야기 나누기"],
  [/책임감/g, "책임지는 마음"],
];

/** 반말 → 존댓말 최소 치환. */
const POLITE_MAP: Array<[RegExp, string]> = [
  [/했구나\./g, "했군요."],
  [/했어\./g, "했어요."],
  [/이야\./g, "이에요."],
  [/했지\?/g, "했지요?"],
  [/그래\./g, "그래요."],
  [/좋아\./g, "좋아요."],
  [/맞아\./g, "맞아요."],
  [/보자\./g, "봐요."],
  [/해 보자\./g, "해 봐요."],
];

const SAFETY_RESPONSE =
  "지금은 마음이 많이 힘들 수 있어요. 선생님이나 부모님께 꼭 이야기해 주세요.";

const DEFAULT_EMPATHY = "그런 마음이 들 수 있어요.";

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?？！])\s+|\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinSentences(list: string[]): string {
  return list.map((s) => s.trim()).filter(Boolean).join(" ");
}

function isQuestion(s: string): boolean {
  return /[?？]\s*$/.test(s.trim());
}

function isEmpathySentence(s: string): boolean {
  return /(그런 마음|속상|화가|억울|무거웠|부끄|조마조마|헷갈|기뻤|재미있|이해해요|그럴 수도)/.test(
    s,
  );
}

function looksLikePraisePerson(s: string): boolean {
  return /(너는 착|너는 훌륭|천재|최고|넌 정말)/.test(s);
}

function containsForbiddenTerm(s: string): boolean {
  return FORBIDDEN_TERMS.some((t) =>
    new RegExp(`\\b${t}\\b`, "i").test(s),
  );
}

function stripForbiddenTerms(s: string): string {
  let out = s;
  for (const t of FORBIDDEN_TERMS) {
    out = out.replace(new RegExp(`\\b${t}\\b`, "gi"), "");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function applyReplacements(
  text: string,
  table: Array<[RegExp, string]>,
): string {
  let out = text;
  for (const [re, rep] of table) out = out.replace(re, rep);
  return out.replace(/\s{2,}/g, " ").trim();
}

function splitLongSentence(s: string, maxLen = 40): string[] {
  if (s.length <= maxLen) return [s];
  // 쉼표 우선 분할
  const parts = s.split(/,\s*/);
  if (parts.length >= 2) {
    return parts
      .map((p, i) => (i < parts.length - 1 ? p + "." : p))
      .filter(Boolean);
  }
  const mid = Math.floor(s.length / 2);
  return [s.slice(0, mid).trim() + ".", s.slice(mid).trim()];
}

// ─────────────────────────────────────────────────────────────
// 개별 검사기
// ─────────────────────────────────────────────────────────────

/** ① Safety: 안전 신호가 있으면 다른 문장을 모두 지우고 안전 응답만 유지. */
function checkSafety(
  sentences: string[],
  safety?: SafetySignal,
): string[] {
  if (safety && safety.level !== "none") {
    return [SAFETY_RESPONSE];
  }
  return sentences;
}

/** ② 금지 표현 자동 치환 + 금지 용어 제거. */
function checkForbidden(sentences: string[]): string[] {
  return sentences
    .map((s) => applyReplacements(s, PHRASE_REPLACEMENTS))
    .map((s) => (containsForbiddenTerm(s) ? stripForbiddenTerms(s) : s))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ③ 답 알려주기 검사: Hint4가 아니면 모범답안/예시 인용문 제거. */
function checkAnswerLeak(
  sentences: string[],
  hint: HintLevel,
): string[] {
  if (hint >= 4) return sentences;
  return sentences.filter((s) => {
    // 큰따옴표로 된 예시 문장은 모범답안으로 간주
    if (/[""].+[""]/.test(s) && /(이렇게 말|예시로|답은|정답은)/.test(s)) {
      return false;
    }
    if (/^정답은/.test(s.trim())) return false;
    return true;
  });
}

/** ④ Hint 규칙: 결정된 HintLevel보다 강한 힌트 제거. */
function checkHintLevel(
  sentences: string[],
  hint: HintLevel,
): string[] {
  return sentences.filter((s) => {
    const t = s.trim();
    // Level 3 이상만 허용되는 표현
    if (/(예시로 이렇게|모범답안|이렇게 말할 수도 있어요)/.test(t) && hint < 3) {
      return false;
    }
    // Level 2 이상만 허용되는 문장 시작 템플릿
    if (/이렇게 시작해/.test(t) && hint < 2) return false;
    // Level 1 이상만 허용되는 핵심 낱말
    if (/핵심 낱말/.test(t) && hint < 1) return false;
    return true;
  });
}

/** ⑤ 공감 검사: 감정이 있으면 첫 문장이 공감이어야 함. */
function checkEmpathy(
  sentences: string[],
  emotion?: Emotion,
): string[] {
  if (!emotion || emotion === "neutral") return sentences;
  if (sentences.length === 0) return [DEFAULT_EMPATHY];
  if (isEmpathySentence(sentences[0])) return sentences;
  return [DEFAULT_EMPATHY, ...sentences];
}

/** ⑥ 질문 개수: 항상 1개. 2개 이상이면 첫 질문만 남긴다. */
function checkQuestionCount(sentences: string[]): string[] {
  let seen = false;
  const out: string[] = [];
  for (const s of sentences) {
    if (isQuestion(s)) {
      if (seen) {
        // 두 번째 질문은 평서형으로 축약: "?" 제거
        const flat = s.replace(/[?？]\s*$/g, ".").trim();
        // 이미 다른 내용이 없으면 그냥 버림
        if (flat.length > 4) out.push(flat);
      } else {
        out.push(s);
        seen = true;
      }
    } else {
      out.push(s);
    }
  }
  return out;
}

/** ⑦ 칭찬 검사: 사람 자체 칭찬 제거(행동 칭찬은 유지). */
function checkPraise(sentences: string[]): string[] {
  return sentences.filter((s) => !looksLikePraisePerson(s));
}

/** ⑧ Stage 검사: advanceStage=false인데 축하 문구가 있으면 제거. */
function checkStage(
  sentences: string[],
  advance: boolean,
): string[] {
  if (advance) return sentences;
  return sentences.filter(
    (s) => !/(축하해요|다음 단계|잘 마쳤어요|해냈어요)/.test(s),
  );
}

/** ⑨ 반복 검사: 이전 AI 문장과 완전히 같으면 부드럽게 변형. */
function checkRepetition(
  sentences: string[],
  memory?: ConversationMemory & { lastAiSentence?: string },
): string[] {
  const last = memory?.lastAiSentence?.trim();
  if (!last) return sentences;
  return sentences.map((s) => {
    if (s.trim() === last) {
      return s
        .replace(/^그러니까/, "그 말은")
        .replace(/구나\./, "군요.")
        .replace(/이에요\.$/, "이지요.");
    }
    return s;
  });
}

/** ⑩ 쉬운 단어 치환. */
function checkEasyWords(sentences: string[]): string[] {
  return sentences.map((s) => applyReplacements(s, EASY_WORDS));
}

/** ⑪ 존댓말 검사. */
function checkPolite(sentences: string[]): string[] {
  return sentences.map((s) => applyReplacements(s, POLITE_MAP));
}

/** ⑫ 비난/책임 추궁 검사. */
function checkBlame(sentences: string[]): string[] {
  return sentences.filter(
    (s) => !/(너 때문|네 잘못|네가 문제|넌 왜)/.test(s),
  );
}

/** ⑬ 문장 길이: 기본 2~4문장 (Hint4는 최대 5). 한 문장 30자 내외. */
function checkLength(
  sentences: string[],
  hint: HintLevel,
): string[] {
  // 긴 문장 분할
  const split: string[] = [];
  for (const s of sentences) split.push(...splitLongSentence(s, 40));
  const max = hint >= 4 ? 5 : 4;
  return split.slice(0, max);
}

/** ⑭ 선택지 검사: forced_choice일 때 최대 3개, "잘 모르겠어요." 포함. */
function checkChoices(
  choices: string[] | undefined,
  strategy: TeachingStrategy,
): string[] | undefined {
  if (strategy !== "forced_choice") return undefined;
  const base = (choices ?? []).map((c) => c.trim()).filter(Boolean);
  const trimmed = base.slice(0, 3);
  const hasIDK = trimmed.some((c) => /잘 모르겠어요/.test(c));
  if (!hasIDK) {
    if (trimmed.length >= 3) trimmed[2] = "잘 모르겠어요.";
    else trimmed.push("잘 모르겠어요.");
  }
  return trimmed.slice(0, 3);
}

/** ⑮ 학습 목표 검사: 현재 Goal과 무관해 보이는 문장 최소 필터. */
function checkGoalRelevance(
  sentences: string[],
  _goal: PedagogicalGoal,
): string[] {
  // 새로운 개념 추가 방지: 목표 외 개념이 들어와도 문장 자체는 유지하되
  // 명백한 오프토픽(광고/기술 안내 등)만 걸러낸다.
  return sentences.filter(
    (s) => !/(구독|다운로드|앱 설치|링크를 눌러)/.test(s),
  );
}

// ─────────────────────────────────────────────────────────────
// 파이프라인
// ─────────────────────────────────────────────────────────────

export function checkResponseQuality(
  input: QualityCheckInput,
): QualityCheckOutput {
  const { generated, decision, studentEmotion, safetySignal, conversationMemory } =
    input;

  const hint = decision.hintLevel;
  const strategy = decision.strategy;
  const advance = Boolean(decision.advanceStage);
  const goal = decision.goalAfter ?? decision.goalBefore ?? "empathy";

  let sentences = splitSentences(generated.text);

  // ① Safety
  sentences = checkSafety(sentences, safetySignal);
  if (safetySignal && safetySignal.level !== "none") {
    return { text: sentences[0] };
  }

  // ② 금지 표현
  sentences = checkForbidden(sentences);
  // ③ 답 알려주기
  sentences = checkAnswerLeak(sentences, hint);
  // ④ Hint 규칙
  sentences = checkHintLevel(sentences, hint);
  // ⑤ 공감
  sentences = checkEmpathy(sentences, studentEmotion);
  // ⑥ 질문 개수
  sentences = checkQuestionCount(sentences);
  // ⑦ 칭찬
  sentences = checkPraise(sentences);
  // ⑧ Stage
  sentences = checkStage(sentences, advance);
  // ⑨ 반복
  sentences = checkRepetition(sentences, conversationMemory);
  // ⑩ 쉬운 단어
  sentences = checkEasyWords(sentences);
  // ⑪ 존댓말
  sentences = checkPolite(sentences);
  // ⑫ 비난
  sentences = checkBlame(sentences);
  // ⑬ 문장 길이
  sentences = checkLength(sentences, hint);
  // ⑮ 학습 목표
  sentences = checkGoalRelevance(sentences, goal);

  // 최종 안전망: 공백 정리 + 빈 결과 방지
  sentences = sentences.map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) {
    sentences = [DEFAULT_EMPATHY, "천천히 한 번 더 이야기해 볼까요?"];
  }

  const text = joinSentences(sentences);
  const choices = checkChoices(generated.choices, strategy);

  return choices ? { text, choices } : { text };
}

// ─────────────────────────────────────────────────────────────
// 개발 편의: 최종 체크리스트 (내부 전용, 학생에게 노출 금지)
// ─────────────────────────────────────────────────────────────

export type FinalChecklist = {
  hasEmpathy: boolean;
  questionCount: number;
  withinHintLevel: boolean;
  noAnswerLeak: boolean;
  respectsStage: boolean;
  safetyRespected: boolean;
  noForbidden: boolean;
  polite: boolean;
  sentenceCount: number;
};

export function buildFinalChecklist(
  output: QualityCheckOutput,
  input: QualityCheckInput,
): FinalChecklist {
  const sentences = splitSentences(output.text);
  const qCount = sentences.filter(isQuestion).length;
  const hint = input.decision.hintLevel;
  return {
    hasEmpathy:
      !input.studentEmotion ||
      input.studentEmotion === "neutral" ||
      (sentences.length > 0 && isEmpathySentence(sentences[0])),
    questionCount: qCount,
    withinHintLevel: !(
      (hint < 3 && /(예시로 이렇게|모범답안)/.test(output.text)) ||
      (hint < 2 && /이렇게 시작해/.test(output.text)) ||
      (hint < 1 && /핵심 낱말/.test(output.text))
    ),
    noAnswerLeak:
      hint >= 4 ||
      !/(정답은|모범답안)/.test(output.text),
    respectsStage:
      input.decision.advanceStage ||
      !/(축하해요|다음 단계|잘 마쳤어요|해냈어요)/.test(output.text),
    safetyRespected:
      !input.safetySignal ||
      input.safetySignal.level === "none" ||
      output.text.includes("선생님이나 부모님"),
    noForbidden: !containsForbiddenTerm(output.text),
    polite: !/(했구나\.|했어\.|좋아\.|맞아\.|해 보자\.)/.test(output.text),
    sentenceCount: sentences.length,
  };
}