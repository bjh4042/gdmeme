/**
 * EKLU Engine v1.0 — Elementary Korean Language Understanding Engine
 *
 * 초등학교 3~4학년 학생 입력을 "교육적으로 올바르게 이해"만 하는 내부 엔진.
 * ❌ 답변 생성 금지
 * ❌ 학생에게 내부 판단 노출 금지
 * ✅ Teaching Engine 으로 전달할 구조화된 이해 결과만 반환
 *
 * 파이프라인:
 *   입력 → 정리(Normalize) → 의도 → 감정 → 감정 변화 → 학생 모델 갱신
 *        → 반복 오류 → 오개념 → 학습 단계 → 신뢰도 → 최종 출력
 *
 * 원칙:
 *   - 맞춤법보다 의미 우선. 오타/줄임말/초성/이모티콘/반말 모두 정상 입력.
 *   - 짧은 입력은 최근 5턴 문맥으로 복원.
 *   - 이해 실패 시 학생에게 되묻지 않고 "쉬운 확인 질문"을 힌트로 넘긴다.
 */

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export type Intent =
  | "explain"
  | "excuse"
  | "apology"
  | "empathy"
  | "question"
  | "refuse"
  | "agree"
  | "disagree"
  | "avoid"
  | "joke"
  | "help_request"
  | "unknown";

export type Emotion =
  | "joy"
  | "sadness"
  | "anger"
  | "unfair"
  | "sorry"
  | "shy"
  | "playful"
  | "avoidant"
  | "indifferent"
  | "nervous"
  | "confident"
  | "confused"
  | "neutral";

export type LearningStage =
  | "discovery" // 발견 · 관찰
  | "investigation" // 탐구 · 원인
  | "empathy" // 공감
  | "change" // 표현 변화
  | "practice"; // 실천

export type Confidence = "high" | "mid" | "low";

export type StudentModel = {
  empathyLevel: number; // 0..5
  expressionLevel: number; // 0..5
  engagement: number; // 0..5
  avgReplyLength: number;
  typoRate: number; // 0..1
  choicePreference: number; // 0..5 (선택지 답변 선호)
  confidence: number; // 0..5
  helpNeed: number; // 0..5
  repeatedErrors: Record<string, number>;
  recentEmotions: Emotion[]; // 최근 순서대로
  stage: LearningStage;
  turns: number;
};

export type EkluTurn = {
  role: "student" | "teacher" | "ai";
  text: string;
};

export type EkluResult = {
  /** ① 정리된 입력 (맞춤법·조사·줄임말 완화) */
  normalized: string;
  /** ② 학생의 진짜 목적 */
  intent: Intent;
  /** ③ 현재 감정 */
  emotion: Emotion;
  /** ④ 감정 변화 흐름 (오래된 → 최신) */
  emotionTrajectory: Emotion[];
  /** ⑤ 갱신된 학생 모델 */
  studentModel: StudentModel;
  /** ⑥ 반복 사고 오류 감지 */
  repeatedError: {
    detected: boolean;
    kind?: "blame_shift" | "give_up" | "joke_avoid" | "denial";
    count?: number;
  };
  /** ⑦ 오개념 감지 */
  misconception: {
    detected: boolean;
    kind?: "friend_teasing_ok" | "close_swearing_ok" | "joke_excuses_all";
    evidence?: string;
  };
  /** ⑧ 현재 학습 단계 (다음에 어떤 교수 전략이 필요한지) */
  stage: LearningStage;
  /** ⑨ 입력 이해 신뢰도 */
  confidence: Confidence;
  /** 이해가 어려울 때 Teaching Engine 이 사용할 "쉬운 확인 질문" 후보 */
  clarifierHints: string[];
};

// ─────────────────────────────────────────────────────────────
// 기본 학생 모델
// ─────────────────────────────────────────────────────────────

export function createStudentModel(partial?: Partial<StudentModel>): StudentModel {
  return {
    empathyLevel: 2,
    expressionLevel: 2,
    engagement: 3,
    avgReplyLength: 0,
    typoRate: 0,
    choicePreference: 2,
    confidence: 2,
    helpNeed: 2,
    repeatedErrors: {},
    recentEmotions: [],
    stage: "discovery",
    turns: 0,
    ...partial,
  };
}

// ─────────────────────────────────────────────────────────────
// 입력 정리 (Normalization)
// ─────────────────────────────────────────────────────────────

/** 초성/줄임말 → 의미 확장 사전. 학생에게 노출되지 않고 내부 해석용. */
const SHORTCUT_MAP: Array<[RegExp, string]> = [
  [/\bㅇㅇ\b/g, "응"],
  [/\bㄴㄴ\b/g, "아니"],
  [/\bㄱㅊ\b/g, "괜찮아"],
  [/\bㄹㅇ\b/g, "정말"],
  [/\bㅇㅋ\b/g, "알겠어"],
  [/\bㄱㄱ\b/g, "가자"],
  [/\bㅅㄱ\b/g, "수고"],
  [/몰루/g, "잘 모르겠다"],
  [/알겟/g, "알겠"],
  [/그랫/g, "그랬"],
  [/햇는대/g, "했는데"],
  [/인대\b/g, "인데"],
  [/자나\b/g, "잖아"],
];

/** 이모티콘 감정 태그 (내부용, 원문은 유지) */
const EMOTICON_HINTS: Array<[RegExp, Emotion]> = [
  [/ㅠㅠ+|ㅜㅜ+/g, "sadness"],
  [/ㅋㅋ+/g, "playful"],
  [/ㅎㅎ+/g, "shy"],
  [/ㅡㅡ+|;;+/g, "unfair"],
];

function collapseRepeats(s: string): string {
  // 같은 문자 4개 이상 반복 → 2개로 축약 (의미는 보존, 잡음만 감소)
  return s.replace(/(.)\1{3,}/g, "$1$1");
}

export function normalizeInput(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  s = collapseRepeats(s);
  // 조사 앞 붙어있는 흔한 오탈자 보정
  s = s.replace(/([가-힣])(는|은|이|가|을|를|에|에서|으로|로|와|과|도|만)([가-힣])/g, "$1$2 $3");
  for (const [re, rep] of SHORTCUT_MAP) s = s.replace(re, rep);
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

function looksTypoHeavy(raw: string, normalized: string): boolean {
  if (raw.length < 4) return false;
  const diff = Math.abs(raw.length - normalized.length);
  return diff / raw.length > 0.25;
}

// ─────────────────────────────────────────────────────────────
// 문맥 복원
// ─────────────────────────────────────────────────────────────

function shortReply(s: string): boolean {
  return s.replace(/\s+/g, "").length <= 3;
}

function lastStudentAndAiPair(history: EkluTurn[]): { aiPrev?: string } {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t.role !== "student") return { aiPrev: t.text };
  }
  return {};
}

// ─────────────────────────────────────────────────────────────
// 의도 분석
// ─────────────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ intent: Intent; re: RegExp }> = [
  { intent: "apology", re: /(미안|죄송|잘못했)/ },
  { intent: "excuse", re: /(먼저 했|먼저했|쟤가|얘가|나만|너도 그랬|너도그랬|어쩔 수 없|어쩔수없)/ },
  { intent: "help_request", re: /(도와|알려줘|어떻게 해|어떡해|모르겠어)/ },
  { intent: "question", re: /(왜|뭐|어떻게|언제|누구|어디)[\?？]?$|[\?？]\s*$/ },
  { intent: "refuse", re: /^(아니|싫|안 ?해|안 ?할래|하기 싫)/ },
  { intent: "agree", re: /^(응|어|맞아|그래|알겠|좋아)$/ },
  { intent: "disagree", re: /(아닌데|그건 아니|틀렸|그렇지 않)/ },
  { intent: "avoid", re: /^(몰라|글쎄|그러게|나중에|패스)$/ },
  { intent: "joke", re: /(장난|ㅋㅋ|헤헤|ㅎㅎ)/ },
  { intent: "empathy", re: /(속상했겠|힘들었겠|그랬구나|이해해)/ },
  { intent: "explain", re: /(왜냐하면|because|그래서|그러니까|사실은)/ },
];

function detectIntent(normalized: string, aiPrev?: string): Intent {
  const s = normalized;
  if (!s) return "unknown";
  for (const { intent, re } of INTENT_PATTERNS) if (re.test(s)) return intent;
  // 매우 짧고 직전이 질문이면 → agree/refuse/avoid 로 문맥 해석
  if (shortReply(s) && aiPrev && /[\?？]/.test(aiPrev)) {
    if (/^(응|어|네|넹)$/.test(s)) return "agree";
    if (/^(아니|노|no)$/i.test(s)) return "refuse";
    return "avoid";
  }
  return "explain";
}

// ─────────────────────────────────────────────────────────────
// 감정 분석
// ─────────────────────────────────────────────────────────────

const EMOTION_PATTERNS: Array<{ emo: Emotion; re: RegExp; weight: number }> = [
  { emo: "unfair", re: /(억울|나만|왜 나|먼저 했|먼저했)/, weight: 3 },
  { emo: "anger", re: /(짜증|화나|열받|싫어|미워)/, weight: 3 },
  { emo: "sadness", re: /(속상|슬프|눈물|서운|외로)/, weight: 3 },
  { emo: "sorry", re: /(미안|죄송|잘못했)/, weight: 3 },
  { emo: "shy", re: /(부끄|민망|쑥스)/, weight: 2 },
  { emo: "joy", re: /(좋아|신나|재밌|기뻐|행복)/, weight: 2 },
  { emo: "playful", re: /(장난|ㅋㅋ|헤헤)/, weight: 1 },
  { emo: "avoidant", re: /^(몰라|글쎄|그러게|패스)$/, weight: 2 },
  { emo: "confused", re: /(어렵|헷갈|모르겠)/, weight: 2 },
  { emo: "confident", re: /(할 수 있|자신|당연히|해볼래)/, weight: 2 },
  { emo: "nervous", re: /(떨려|긴장|무서)/, weight: 2 },
];

function detectEmotion(raw: string, normalized: string): Emotion {
  const scores: Partial<Record<Emotion, number>> = {};
  for (const [re, emo] of EMOTICON_HINTS) {
    if (re.test(raw)) scores[emo] = (scores[emo] ?? 0) + 1;
  }
  for (const { emo, re, weight } of EMOTION_PATTERNS) {
    if (re.test(normalized)) scores[emo] = (scores[emo] ?? 0) + weight;
  }
  let best: Emotion = "neutral";
  let bestScore = 0;
  for (const [emo, sc] of Object.entries(scores)) {
    if ((sc ?? 0) > bestScore) {
      best = emo as Emotion;
      bestScore = sc ?? 0;
    }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────
// 반복 오류 & 오개념
// ─────────────────────────────────────────────────────────────

type RepeatKind = "blame_shift" | "give_up" | "joke_avoid" | "denial";

function classifyRepeatKind(intent: Intent, normalized: string): RepeatKind | null {
  if (intent === "excuse" || /먼저 했|먼저했|쟤가|너도/.test(normalized)) return "blame_shift";
  if (intent === "avoid" || /^몰라$|^글쎄$/.test(normalized)) return "give_up";
  if (intent === "joke" || /^ㅋㅋ+$|^ㅎㅎ+$/.test(normalized)) return "joke_avoid";
  if (intent === "disagree" || /아닌데|그건 아니/.test(normalized)) return "denial";
  return null;
}

const MISCONCEPTIONS: Array<{
  kind: NonNullable<EkluResult["misconception"]["kind"]>;
  re: RegExp;
}> = [
  { kind: "friend_teasing_ok", re: /(친구니까|친구인데) ?(놀려도|장난쳐도|괴롭혀도)/ },
  { kind: "close_swearing_ok", re: /(친하니까|친하면) ?(욕|비속어|나쁜 ?말)/ },
  { kind: "joke_excuses_all", re: /(장난이면|장난인데) ?(괜찮|되잖)/ },
];

function detectMisconception(normalized: string): EkluResult["misconception"] {
  for (const { kind, re } of MISCONCEPTIONS) {
    if (re.test(normalized)) return { detected: true, kind, evidence: normalized };
  }
  return { detected: false };
}

// ─────────────────────────────────────────────────────────────
// 학습 단계 추정
// ─────────────────────────────────────────────────────────────

function inferStage(model: StudentModel, intent: Intent, emotion: Emotion): LearningStage {
  // 5단계 로드맵 기준으로 "다음에 필요한" 단계를 안내
  if (intent === "avoid" || emotion === "confused") return "discovery";
  if (intent === "excuse" || emotion === "unfair" || emotion === "anger") return "investigation";
  if (emotion === "sorry" || intent === "apology") return "empathy";
  if (intent === "explain" && model.empathyLevel >= 3) return "change";
  if (intent === "help_request") return "change";
  if (model.empathyLevel >= 4 && model.expressionLevel >= 3) return "practice";
  return model.stage;
}

// ─────────────────────────────────────────────────────────────
// 신뢰도
// ─────────────────────────────────────────────────────────────

function computeConfidence(normalized: string, intent: Intent, typoHeavy: boolean): Confidence {
  if (!normalized) return "low";
  if (intent === "unknown") return "low";
  if (shortReply(normalized) || typoHeavy) return "mid";
  return "high";
}

// ─────────────────────────────────────────────────────────────
// 모델 갱신
// ─────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function updateModel(
  prev: StudentModel,
  normalized: string,
  intent: Intent,
  emotion: Emotion,
  typoHeavy: boolean,
  repeatKind: RepeatKind | null,
): StudentModel {
  const turns = prev.turns + 1;
  const len = normalized.length;
  const avgReplyLength = (prev.avgReplyLength * prev.turns + len) / turns;
  const typoRate = (prev.typoRate * prev.turns + (typoHeavy ? 1 : 0)) / turns;
  const recentEmotions = [...prev.recentEmotions, emotion].slice(-8);

  let empathyLevel = prev.empathyLevel;
  if (intent === "empathy" || emotion === "sorry") empathyLevel = clamp(empathyLevel + 1, 0, 5);
  if (intent === "excuse" || repeatKind === "blame_shift") empathyLevel = clamp(empathyLevel - 1, 0, 5);

  let expressionLevel = prev.expressionLevel;
  if (len >= 20 && intent !== "avoid") expressionLevel = clamp(expressionLevel + 1, 0, 5);
  if (shortReply(normalized)) expressionLevel = clamp(expressionLevel - 1, 0, 5);

  let engagement = prev.engagement;
  if (intent === "avoid" || intent === "joke") engagement = clamp(engagement - 1, 0, 5);
  else engagement = clamp(engagement + 1, 0, 5);

  let helpNeed = prev.helpNeed;
  if (intent === "help_request" || emotion === "confused") helpNeed = clamp(helpNeed + 1, 0, 5);
  else helpNeed = clamp(helpNeed - 1, 0, 5);

  let confidence = prev.confidence;
  if (emotion === "confident") confidence = clamp(confidence + 1, 0, 5);
  if (emotion === "nervous" || emotion === "confused") confidence = clamp(confidence - 1, 0, 5);

  const repeatedErrors = { ...prev.repeatedErrors };
  if (repeatKind) repeatedErrors[repeatKind] = (repeatedErrors[repeatKind] ?? 0) + 1;

  return {
    ...prev,
    turns,
    avgReplyLength,
    typoRate,
    recentEmotions,
    empathyLevel,
    expressionLevel,
    engagement,
    helpNeed,
    confidence,
    repeatedErrors,
  };
}

// ─────────────────────────────────────────────────────────────
// 이해 실패 시 쉬운 확인 질문 후보
// ─────────────────────────────────────────────────────────────

const CLARIFIER_POOL = [
  "조금만 더 이야기해 줄래?",
  "그때 무슨 일이 있었어?",
  "어떤 마음이 제일 컸어?",
  "누구랑 있었던 일이야?",
  "지금 기분을 한 단어로 말해줄 수 있어?",
];

// ─────────────────────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────────────────────

/**
 * 학생 입력을 이해한다. **답변을 만들지 않는다.**
 * 반환값은 Teaching Engine 이 사용할 순수 이해 결과.
 */
export function understand(params: {
  input: string;
  history?: EkluTurn[];
  model?: StudentModel;
}): EkluResult {
  const raw = params.input ?? "";
  const history = params.history ?? [];
  const prevModel = params.model ?? createStudentModel();

  const normalized = normalizeInput(raw);
  const typoHeavy = looksTypoHeavy(raw, normalized);
  const { aiPrev } = lastStudentAndAiPair(history);

  const intent = detectIntent(normalized, aiPrev);
  const emotion = detectEmotion(raw, normalized);
  const repeatKind = classifyRepeatKind(intent, normalized);
  const misconception = detectMisconception(normalized);

  const nextModel = updateModel(prevModel, normalized, intent, emotion, typoHeavy, repeatKind);
  const stage = inferStage(nextModel, intent, emotion);
  nextModel.stage = stage;

  const repeatCount = repeatKind ? nextModel.repeatedErrors[repeatKind] ?? 0 : 0;
  const repeatedError = {
    detected: repeatKind !== null && repeatCount >= 2,
    kind: repeatKind ?? undefined,
    count: repeatCount || undefined,
  };

  const confidence = computeConfidence(normalized, intent, typoHeavy);

  return {
    normalized,
    intent,
    emotion,
    emotionTrajectory: nextModel.recentEmotions,
    studentModel: nextModel,
    repeatedError,
    misconception,
    stage,
    confidence,
    clarifierHints: confidence === "low" ? CLARIFIER_POOL.slice(0, 3) : [],
  };
}

/**
 * 편의 함수: 이해 결과를 Teaching Engine 프롬프트에 그대로 붙일 수 있는
 * 간결한 한국어 요약으로 직렬화. **학생에게 노출 금지.**
 */
export function serializeForTeachingEngine(r: EkluResult): string {
  const lines = [
    `[EKLU]`,
    `정리입력: ${r.normalized || "(빈 입력)"}`,
    `의도: ${r.intent}`,
    `감정: ${r.emotion}`,
    `감정흐름: ${r.emotionTrajectory.join(" → ") || "-"}`,
    `학습단계: ${r.stage}`,
    `신뢰도: ${r.confidence}`,
    `반복오류: ${r.repeatedError.detected ? `${r.repeatedError.kind}(${r.repeatedError.count})` : "없음"}`,
    `오개념: ${r.misconception.detected ? r.misconception.kind : "없음"}`,
    `모델(공감/표현/참여/자신감/도움): ${r.studentModel.empathyLevel}/${r.studentModel.expressionLevel}/${r.studentModel.engagement}/${r.studentModel.confidence}/${r.studentModel.helpNeed}`,
  ];
  if (r.clarifierHints.length) lines.push(`확인질문후보: ${r.clarifierHints.join(" | ")}`);
  return lines.join("\n");
}