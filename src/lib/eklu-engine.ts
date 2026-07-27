/**
 * EKLU Engine v1.1 — Elementary Korean Language Understanding Engine
 *
 * 초등학교 3~4학년 학생 입력을 "교육적으로 올바르게 이해"만 하는 내부 엔진.
 * ❌ 답변 생성 금지
 * ❌ 확인 질문 문장 생성 금지 (Teaching Engine이 담당)
 * ❌ 학생 화면 노출 금지
 * ✅ Teaching Engine 으로 전달할 구조화된 이해 결과만 반환
 *
 * v1.1 변경점
 *  - 정규화와 의미 해석 분리 (NormalizationResult)
 *  - 다중 의도 / 복합 감정 (primary + secondary)
 *  - 분석 근거(evidence)와 규칙 id 노출 (내부 검증용)
 *  - StudentModel 누적 완화(EWMA), observationCount / stability / insufficient_data
 *  - 언어 형식 vs 교육적 역량 분리 (languageFormLevel / empathyLevel / expressionCompleteness / meaningClarity)
 *  - 오개념 vs 방어 반응(defensiveResponse) 분리
 *  - clarificationNeed 구조 (질문 문장은 만들지 않음)
 *  - 하위 호환: understand({input, history, model}), serializeForTeachingEngine 유지, 기존 필드 유지
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
  | "discovery"
  | "investigation"
  | "empathy"
  | "change"
  | "practice";

export type Confidence = "high" | "mid" | "low";

export type NormalizationResult = {
  original: string;
  normalizedText: string;
  possibleMeanings: string[];
  selectedMeaning?: string;
  selectedByContext: boolean;
};

export type IntentAnalysis = {
  primary: Intent;
  secondary: Intent[];
  confidence: number; // 0..1
};

export type EmotionAnalysis = {
  primary: Emotion;
  secondary: Emotion[];
  intensity: number; // 0..1
  confidence: number; // 0..1
};

export type Evidence = {
  matchedTokens: string[];
  contextSignals: string[];
  ruleIds: string[];
};

export type StudentModel = {
  // 교육적 역량 (0..5)
  empathyLevel: number;
  expressionLevel: number; // 하위 호환용 alias for expressionCompleteness
  expressionCompleteness: number; // 의미 완결성
  meaningClarity: number; // 의미 명확도
  languageFormLevel: number; // 맞춤법·문장 형식(낮은 가중치)
  engagement: number;
  confidence: number;
  helpNeed: number;
  choicePreference: number;

  avgReplyLength: number;
  typoRate: number; // 0..1
  repeatedErrors: Record<string, number>;
  recentEmotions: Emotion[];
  stage: LearningStage;

  // 안정화 메타
  turns: number;
  observationCount: number;
  evidenceCount: number;
  stability: number; // 0..1
  lastUpdatedAt: number; // epoch ms
};

export type EkluTurn = {
  role: "student" | "teacher" | "ai";
  text: string;
};

export type ClarificationNeed = {
  required: boolean;
  target?: "intent" | "emotion" | "event" | "meaning";
  strategy?: "forced_choice" | "easy_open_question" | "context_check";
  candidates?: string[];
};

export type DefensiveResponse = {
  detected: boolean;
  type?: "blame_shift" | "self_justification" | "avoidance" | "denial";
  confidence: number; // 0..1
};

export type Misconception = {
  detected: boolean;
  kind?: "friend_teasing_ok" | "close_swearing_ok" | "joke_excuses_all";
  evidence?: string;
  confidence: number; // 0..1
};

export type EkluResult = {
  // 하위 호환 (v1.0)
  normalized: string;
  intent: Intent;
  emotion: Emotion;
  emotionTrajectory: Emotion[];
  studentModel: StudentModel;
  repeatedError: {
    detected: boolean;
    kind?: "blame_shift" | "give_up" | "joke_avoid" | "denial";
    count?: number;
  };
  misconception: Misconception;
  stage: LearningStage;
  confidence: Confidence;
  clarifierHints: string[];

  // v1.1 상세 구조
  normalization: NormalizationResult;
  intentAnalysis: IntentAnalysis;
  emotionAnalysis: EmotionAnalysis;
  defensiveResponse: DefensiveResponse;
  clarificationNeed: ClarificationNeed;
  evidence: Evidence;
  status: "ok" | "insufficient_data";
};

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function clamp01(n: number) {
  return clamp(n, 0, 1);
}

function shortReply(s: string): boolean {
  return s.replace(/\s+/g, "").length <= 3;
}

// ─────────────────────────────────────────────────────────────
// 학생 모델 초기값
// ─────────────────────────────────────────────────────────────

export function createStudentModel(partial?: Partial<StudentModel>): StudentModel {
  return {
    empathyLevel: 2,
    expressionLevel: 2,
    expressionCompleteness: 2,
    meaningClarity: 2,
    languageFormLevel: 2,
    engagement: 3,
    confidence: 2,
    helpNeed: 2,
    choicePreference: 2,
    avgReplyLength: 0,
    typoRate: 0,
    repeatedErrors: {},
    recentEmotions: [],
    stage: "discovery",
    turns: 0,
    observationCount: 0,
    evidenceCount: 0,
    stability: 0,
    lastUpdatedAt: 0,
    ...partial,
  };
}

// ─────────────────────────────────────────────────────────────
// 1) 정규화 (원문 보존 + 표기 정리 + 가능한 의미 후보)
// ─────────────────────────────────────────────────────────────

/** 형태 정리용 — 표기만 다듬는다. 의미를 확정하지 않는다. */
const FORM_FIX: Array<[RegExp, string]> = [
  [/알겟/g, "알겠"],
  [/그랫/g, "그랬"],
  [/햇는대/g, "했는데"],
  [/햇/g, "했"],
  [/인대(?![가-힣])/g, "인데"],
  [/자나(?![가-힣])/g, "잖아"],
  [/했자나/g, "했잖아"],
];

/** 다의 표현 사전 — 의미는 후보로만 남긴다. */
const MEANING_HINTS: Array<{ re: RegExp; meanings: string[] }> = [
  { re: /(^|\s)ㅇㅇ($|\s)/, meanings: ["동의", "인정", "형식적 대답"] },
  { re: /(^|\s)ㄴㄴ($|\s)/, meanings: ["거절", "부정"] },
  { re: /(^|\s)ㄱㅊ($|\s)/, meanings: ["괜찮음", "무관심"] },
  { re: /(^|\s)ㄹㅇ($|\s)/, meanings: ["강한 동의", "강조"] },
  { re: /(^|\s)ㅇㅋ($|\s)/, meanings: ["수락", "이해"] },
  { re: /ㅋㅋ+/, meanings: ["웃음", "장난", "당황 회피", "친근함"] },
  { re: /ㅎㅎ+/, meanings: ["쑥스러움", "부드러운 웃음", "회피"] },
  { re: /ㅠㅠ+|ㅜㅜ+/, meanings: ["슬픔", "억울함", "과장 표현"] },
  { re: /ㅡㅡ+|;;+/, meanings: ["불만", "억울함", "회피"] },
  { re: /몰루|모름/, meanings: ["회피", "실제 모름", "말하기 싫음"] },
  { re: /^응$|^어$|^넹$/, meanings: ["동의", "형식적 대답"] },
  { re: /^몰라$/, meanings: ["회피", "실제 모름", "생각 중"] },
  { re: /^아니$/, meanings: ["거절", "정정"] },
];

function collapseRepeats(s: string): string {
  return s.replace(/(.)\1{3,}/g, "$1$1");
}

function normalizeTextOnly(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  s = collapseRepeats(s);
  s = s.replace(
    /([가-힣])(는|은|이|가|을|를|에|에서|으로|로|와|과|도|만)([가-힣])/g,
    "$1$2 $3",
  );
  for (const [re, rep] of FORM_FIX) s = s.replace(re, rep);
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** @deprecated 하위 호환: 표기 정리만 반환. 의미 확정은 하지 않음. */
export function normalizeInput(raw: string): string {
  return normalizeTextOnly(raw);
}

function analyzeNormalization(raw: string, aiPrev?: string): NormalizationResult {
  const original = raw ?? "";
  const normalizedText = normalizeTextOnly(original);
  const possibleMeanings: string[] = [];
  for (const { re, meanings } of MEANING_HINTS) {
    if (re.test(original) || re.test(normalizedText)) {
      for (const m of meanings) if (!possibleMeanings.includes(m)) possibleMeanings.push(m);
    }
  }
  let selectedMeaning: string | undefined;
  let selectedByContext = false;
  if (possibleMeanings.length > 0 && aiPrev && /[\?？]/.test(aiPrev)) {
    // 직전이 질문이면 "동의/거절/회피" 중 하나로 문맥상 좁힘
    const preferred = possibleMeanings.find((m) =>
      ["동의", "수락", "거절", "부정", "회피"].includes(m),
    );
    if (preferred) {
      selectedMeaning = preferred;
      selectedByContext = true;
    }
  }
  return { original, normalizedText, possibleMeanings, selectedMeaning, selectedByContext };
}

function looksTypoHeavy(raw: string, normalized: string): boolean {
  if (raw.length < 4) return false;
  const diff = Math.abs(raw.length - normalized.length);
  return diff / raw.length > 0.25;
}

// ─────────────────────────────────────────────────────────────
// 2) 의도 분석 (다중)
// ─────────────────────────────────────────────────────────────

type IntentRule = { id: string; intent: Intent; re: RegExp; weight: number };

const INTENT_RULES: IntentRule[] = [
  { id: "i.apology", intent: "apology", re: /(미안|죄송|잘못했)/, weight: 3 },
  { id: "i.excuse.first", intent: "excuse", re: /(먼저 했|먼저했|먼저햇)/, weight: 3 },
  { id: "i.excuse.blame", intent: "excuse", re: /(쟤가|얘가|너도 그랬|너도그랬|너도그랫)/, weight: 3 },
  { id: "i.excuse.helpless", intent: "excuse", re: /(어쩔 수 없|어쩔수없|나만)/, weight: 2 },
  { id: "i.help", intent: "help_request", re: /(도와|알려줘|어떻게 해|어떡해|모르겠어)/, weight: 3 },
  { id: "i.question", intent: "question", re: /(왜|뭐|어떻게|언제|누구|어디)[\?？]?$|[\?？]\s*$/, weight: 2 },
  { id: "i.refuse", intent: "refuse", re: /^(아니|싫|안 ?해|안 ?할래|하기 싫)/, weight: 3 },
  { id: "i.agree", intent: "agree", re: /^(응|어|맞아|그래|알겠|좋아|넹)$/, weight: 2 },
  { id: "i.disagree", intent: "disagree", re: /(아닌데|그건 아니|틀렸|그렇지 않)/, weight: 3 },
  { id: "i.avoid", intent: "avoid", re: /^(몰라|글쎄|그러게|나중에|패스)$/, weight: 3 },
  { id: "i.joke", intent: "joke", re: /(장난|ㅋㅋ|헤헤|ㅎㅎ)/, weight: 1 },
  { id: "i.empathy", intent: "empathy", re: /(속상했겠|힘들었겠|그랬구나|이해해|속상했을|힘들었을)/, weight: 3 },
  { id: "i.explain", intent: "explain", re: /(왜냐하면|그래서|그러니까|사실은)/, weight: 2 },
];

function analyzeIntent(
  normalized: string,
  aiPrev: string | undefined,
  evidence: Evidence,
): IntentAnalysis {
  const scores = new Map<Intent, number>();
  if (!normalized) {
    return { primary: "unknown", secondary: [], confidence: 0 };
  }
  for (const rule of INTENT_RULES) {
    if (rule.re.test(normalized)) {
      scores.set(rule.intent, (scores.get(rule.intent) ?? 0) + rule.weight);
      evidence.ruleIds.push(rule.id);
      const m = normalized.match(rule.re);
      if (m) evidence.matchedTokens.push(m[0]);
    }
  }
  // 문맥 기반 짧은 답 보정
  if (scores.size === 0 && shortReply(normalized) && aiPrev && /[\?？]/.test(aiPrev)) {
    if (/^(응|어|네|넹|ㅇㅇ)$/.test(normalized)) {
      scores.set("agree", 2);
      evidence.contextSignals.push("short_reply_after_question:agree");
    } else if (/^(아니|노|no|ㄴㄴ)$/i.test(normalized)) {
      scores.set("refuse", 2);
      evidence.contextSignals.push("short_reply_after_question:refuse");
    } else {
      scores.set("avoid", 1);
      evidence.contextSignals.push("short_reply_after_question:avoid");
    }
  }
  if (scores.size === 0) {
    return { primary: "explain", secondary: [], confidence: 0.2 };
  }
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, primaryScore] = sorted[0];
  const secondary = sorted.slice(1).map(([i]) => i);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const confidence = clamp01(primaryScore / Math.max(1, total));
  return { primary, secondary, confidence };
}

// ─────────────────────────────────────────────────────────────
// 3) 감정 분석 (복합)
// ─────────────────────────────────────────────────────────────

type EmotionRule = { id: string; emo: Emotion; re: RegExp; weight: number };

const EMOTION_RULES: EmotionRule[] = [
  { id: "e.unfair", emo: "unfair", re: /(억울|나만|왜 나|먼저 했|먼저했|먼저햇)/, weight: 3 },
  { id: "e.anger", emo: "anger", re: /(짜증|화나|열받|미워)/, weight: 3 },
  { id: "e.sad", emo: "sadness", re: /(속상|슬프|눈물|서운|외로|속상햇|속상했)/, weight: 3 },
  { id: "e.sorry", emo: "sorry", re: /(미안|죄송|잘못했)/, weight: 3 },
  { id: "e.shy", emo: "shy", re: /(부끄|민망|쑥스|ㅎㅎ)/, weight: 1 },
  { id: "e.joy", emo: "joy", re: /(좋아|신나|재밌|기뻐|행복)/, weight: 2 },
  { id: "e.play", emo: "playful", re: /(장난|ㅋㅋ|헤헤)/, weight: 1 },
  { id: "e.avoid", emo: "avoidant", re: /^(몰라|글쎄|그러게|패스)$/, weight: 2 },
  { id: "e.confused", emo: "confused", re: /(어렵|헷갈|모르겠)/, weight: 2 },
  { id: "e.confident", emo: "confident", re: /(할 수 있|자신|당연히|해볼래)/, weight: 2 },
  { id: "e.nervous", emo: "nervous", re: /(떨려|긴장|무서)/, weight: 2 },
  { id: "e.sad.emo", emo: "sadness", re: /ㅠㅠ+|ㅜㅜ+/, weight: 2 },
  { id: "e.unfair.emo", emo: "unfair", re: /ㅡㅡ+|;;+/, weight: 1 },
];

function analyzeEmotion(raw: string, normalized: string, evidence: Evidence): EmotionAnalysis {
  const scores = new Map<Emotion, number>();
  let totalWeight = 0;
  for (const rule of EMOTION_RULES) {
    if (rule.re.test(raw) || rule.re.test(normalized)) {
      scores.set(rule.emo, (scores.get(rule.emo) ?? 0) + rule.weight);
      totalWeight += rule.weight;
      evidence.ruleIds.push(rule.id);
    }
  }
  if (scores.size === 0) {
    return { primary: "neutral", secondary: [], intensity: 0, confidence: 0.2 };
  }
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, primaryScore] = sorted[0];
  const secondary = sorted.slice(1).map(([e]) => e);
  const intensity = clamp01(totalWeight / 6);
  const confidence = clamp01(primaryScore / Math.max(1, totalWeight));
  return { primary, secondary, intensity, confidence };
}

// ─────────────────────────────────────────────────────────────
// 4) 방어 반응 / 오개념
// ─────────────────────────────────────────────────────────────

type DefensiveRule = { id: string; type: NonNullable<DefensiveResponse["type"]>; re: RegExp };
const DEFENSIVE_RULES: DefensiveRule[] = [
  { id: "d.blame", type: "blame_shift", re: /(쟤가|얘가|너도 그랬|너도그랬|너도그랫|먼저 했|먼저했|먼저햇)/ },
  { id: "d.selfjust", type: "self_justification", re: /(장난이었|그럴 수도|나만 그런|그럴 뻔)/ },
  { id: "d.avoid", type: "avoidance", re: /^(몰라|글쎄|그러게|패스)$/ },
  { id: "d.denial", type: "denial", re: /(아닌데|그런 적 없|안 그랬)/ },
];

function analyzeDefensive(normalized: string, evidence: Evidence): DefensiveResponse {
  for (const rule of DEFENSIVE_RULES) {
    if (rule.re.test(normalized)) {
      evidence.ruleIds.push(rule.id);
      return { detected: true, type: rule.type, confidence: 0.6 };
    }
  }
  return { detected: false, confidence: 0 };
}

const MISCONCEPTION_RULES: Array<{
  id: string;
  kind: NonNullable<Misconception["kind"]>;
  re: RegExp;
}> = [
  { id: "m.friend_tease", kind: "friend_teasing_ok", re: /(친구니까|친구인데) ?(놀려도|장난쳐도|괴롭혀도)/ },
  { id: "m.close_swear", kind: "close_swearing_ok", re: /(친하니까|친하면) ?(욕|비속어|나쁜 ?말)/ },
  { id: "m.joke_all", kind: "joke_excuses_all", re: /(장난이면|장난인데) ?(괜찮|되잖)/ },
];

function analyzeMisconception(
  normalized: string,
  prevCounts: Record<string, number>,
  evidence: Evidence,
): Misconception {
  for (const rule of MISCONCEPTION_RULES) {
    if (rule.re.test(normalized)) {
      evidence.ruleIds.push(rule.id);
      const prior = prevCounts[`misc:${rule.kind}`] ?? 0;
      const confidence = clamp01(0.5 + prior * 0.2);
      // 반복 근거가 있거나 표현이 매우 명시적일 때만 확정
      const detected = prior >= 1 || /친구니까|친하니까|장난이면/.test(normalized);
      return { detected, kind: rule.kind, evidence: normalized, confidence };
    }
  }
  return { detected: false, confidence: 0 };
}

// ─────────────────────────────────────────────────────────────
// 5) 반복 오류 분류
// ─────────────────────────────────────────────────────────────

type RepeatKind = "blame_shift" | "give_up" | "joke_avoid" | "denial";
function classifyRepeatKind(intent: Intent, normalized: string): RepeatKind | null {
  if (intent === "excuse" || /먼저 했|먼저했|먼저햇|쟤가|너도/.test(normalized)) return "blame_shift";
  if (intent === "avoid" || /^몰라$|^글쎄$/.test(normalized)) return "give_up";
  if (intent === "joke" || /^ㅋㅋ+$|^ㅎㅎ+$/.test(normalized)) return "joke_avoid";
  if (intent === "disagree" || /아닌데|그건 아니/.test(normalized)) return "denial";
  return null;
}

// ─────────────────────────────────────────────────────────────
// 6) 학습 단계 / 신뢰도
// ─────────────────────────────────────────────────────────────

function inferStage(model: StudentModel, intent: Intent, emotion: Emotion): LearningStage {
  if (intent === "avoid" || emotion === "confused") return "discovery";
  if (intent === "excuse" || emotion === "unfair" || emotion === "anger") return "investigation";
  if (emotion === "sorry" || intent === "apology") return "empathy";
  if (intent === "explain" && model.empathyLevel >= 3) return "change";
  if (intent === "help_request") return "change";
  if (model.empathyLevel >= 4 && model.expressionCompleteness >= 3) return "practice";
  return model.stage;
}

function computeConfidence(
  normalized: string,
  intentConf: number,
  typoHeavy: boolean,
): Confidence {
  if (!normalized) return "low";
  if (intentConf < 0.34) return "low";
  if (shortReply(normalized) || typoHeavy || intentConf < 0.6) return "mid";
  return "high";
}

// ─────────────────────────────────────────────────────────────
// 7) 학생 모델 갱신 (EWMA 완화)
// ─────────────────────────────────────────────────────────────

const ALPHA = 0.2;
function ewma(prev: number, obs: number): number {
  return prev * (1 - ALPHA) + obs * ALPHA;
}

function updateModel(
  prev: StudentModel,
  normalized: string,
  intentA: IntentAnalysis,
  emotionA: EmotionAnalysis,
  typoHeavy: boolean,
  repeatKind: RepeatKind | null,
  misc: Misconception,
  now: number,
): StudentModel {
  const turns = prev.turns + 1;
  const observationCount = prev.observationCount + 1;
  const len = normalized.length;
  const avgReplyLength = (prev.avgReplyLength * prev.turns + len) / turns;
  const typoRate = (prev.typoRate * prev.turns + (typoHeavy ? 1 : 0)) / turns;
  const recentEmotions = [...prev.recentEmotions, emotionA.primary].slice(-8);

  // 관찰값(0..5 스케일)
  const obsEmpathy =
    intentA.primary === "empathy" || emotionA.primary === "sorry"
      ? 4
      : intentA.primary === "excuse" || repeatKind === "blame_shift"
        ? 1
        : prev.empathyLevel;

  const obsExpression =
    len >= 20 && intentA.primary !== "avoid" ? 4 : shortReply(normalized) ? 1 : prev.expressionCompleteness;

  const obsClarity = intentA.confidence >= 0.6 ? 4 : intentA.confidence >= 0.3 ? 3 : 1;

  const obsForm = typoHeavy ? 1 : len >= 10 ? 3 : prev.languageFormLevel;

  const obsEngagement =
    intentA.primary === "avoid" || intentA.primary === "joke" ? 1 : 4;

  const obsHelp =
    intentA.primary === "help_request" || emotionA.primary === "confused" ? 4 : 1;

  const obsConfidence =
    emotionA.primary === "confident" ? 4 : emotionA.primary === "nervous" || emotionA.primary === "confused" ? 1 : prev.confidence;

  const empathyLevel = clamp(ewma(prev.empathyLevel, obsEmpathy), 0, 5);
  const expressionCompleteness = clamp(ewma(prev.expressionCompleteness, obsExpression), 0, 5);
  const meaningClarity = clamp(ewma(prev.meaningClarity, obsClarity), 0, 5);
  const languageFormLevel = clamp(ewma(prev.languageFormLevel, obsForm), 0, 5);
  const engagement = clamp(ewma(prev.engagement, obsEngagement), 0, 5);
  const helpNeed = clamp(ewma(prev.helpNeed, obsHelp), 0, 5);
  const confidenceLvl = clamp(ewma(prev.confidence, obsConfidence), 0, 5);

  const repeatedErrors = { ...prev.repeatedErrors };
  if (repeatKind) repeatedErrors[repeatKind] = (repeatedErrors[repeatKind] ?? 0) + 1;
  if (misc.kind) {
    const key = `misc:${misc.kind}`;
    repeatedErrors[key] = (repeatedErrors[key] ?? 0) + 1;
  }

  const evidenceCount =
    prev.evidenceCount +
    (intentA.confidence >= 0.5 ? 1 : 0) +
    (emotionA.confidence >= 0.5 ? 1 : 0);

  const stability = clamp01(observationCount / 5);

  return {
    ...prev,
    turns,
    observationCount,
    evidenceCount,
    stability,
    lastUpdatedAt: now,
    avgReplyLength,
    typoRate,
    recentEmotions,
    empathyLevel,
    expressionCompleteness,
    expressionLevel: expressionCompleteness, // 하위 호환 alias
    meaningClarity,
    languageFormLevel,
    engagement,
    helpNeed,
    confidence: confidenceLvl,
    repeatedErrors,
    stage: prev.stage,
  };
}

// ─────────────────────────────────────────────────────────────
// 8) 저신뢰 → clarificationNeed (문장은 만들지 않음)
// ─────────────────────────────────────────────────────────────

function planClarification(
  normalized: string,
  intentA: IntentAnalysis,
  emotionA: EmotionAnalysis,
  norm: NormalizationResult,
): ClarificationNeed {
  if (!normalized) {
    return { required: true, target: "meaning", strategy: "easy_open_question" };
  }
  if (intentA.confidence < 0.4) {
    return {
      required: true,
      target: "intent",
      strategy: "forced_choice",
      candidates: [intentA.primary, ...intentA.secondary].slice(0, 3),
    };
  }
  if (emotionA.confidence < 0.3 && emotionA.primary === "neutral") {
    return { required: true, target: "emotion", strategy: "forced_choice" };
  }
  if (norm.possibleMeanings.length >= 2 && !norm.selectedMeaning) {
    return {
      required: true,
      target: "meaning",
      strategy: "context_check",
      candidates: norm.possibleMeanings.slice(0, 3),
    };
  }
  if (shortReply(normalized) && !norm.selectedByContext) {
    return { required: true, target: "event", strategy: "easy_open_question" };
  }
  return { required: false };
}

// ─────────────────────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────────────────────

function lastAiUtterance(history: EkluTurn[]): string | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role !== "student") return history[i].text;
  }
  return undefined;
}

/**
 * 학생 입력을 이해한다. **답변/질문 문장은 만들지 않는다.**
 */
export function understand(params: {
  input: string;
  history?: EkluTurn[];
  model?: StudentModel;
  now?: number;
}): EkluResult {
  const raw = params.input ?? "";
  const history = params.history ?? [];
  const prevModel = params.model ?? createStudentModel();
  const now = params.now ?? Date.now();

  const aiPrev = lastAiUtterance(history);
  const normalization = analyzeNormalization(raw, aiPrev);
  const normalized = normalization.normalizedText;
  const typoHeavy = looksTypoHeavy(raw, normalized);

  const evidence: Evidence = { matchedTokens: [], contextSignals: [], ruleIds: [] };
  if (normalization.selectedByContext) {
    evidence.contextSignals.push(`selected_meaning:${normalization.selectedMeaning}`);
  }

  const intentAnalysis = analyzeIntent(normalized, aiPrev, evidence);
  if (aiPrev && /[\?？]/.test(aiPrev) && shortReply(normalized)) {
    evidence.contextSignals.push(`short_reply_after_question:${intentAnalysis.primary}`);
  }
  const emotionAnalysis = analyzeEmotion(raw, normalized, evidence);
  const defensiveResponse = analyzeDefensive(normalized, evidence);
  const misconception = analyzeMisconception(normalized, prevModel.repeatedErrors, evidence);
  const repeatKind = classifyRepeatKind(intentAnalysis.primary, normalized);

  const nextModel = updateModel(
    prevModel,
    normalized,
    intentAnalysis,
    emotionAnalysis,
    typoHeavy,
    repeatKind,
    misconception,
    now,
  );
  const stage = inferStage(nextModel, intentAnalysis.primary, emotionAnalysis.primary);
  nextModel.stage = stage;

  const repeatCount = repeatKind ? nextModel.repeatedErrors[repeatKind] ?? 0 : 0;
  const repeatedError = {
    detected: repeatKind !== null && repeatCount >= 2,
    kind: repeatKind ?? undefined,
    count: repeatCount || undefined,
  };

  const overallConfidence = computeConfidence(normalized, intentAnalysis.confidence, typoHeavy);
  const clarificationNeed = planClarification(
    normalized,
    intentAnalysis,
    emotionAnalysis,
    normalization,
  );

  const status: EkluResult["status"] =
    nextModel.observationCount < 3 ? "insufficient_data" : "ok";

  return {
    // v1.0 호환
    normalized,
    intent: intentAnalysis.primary,
    emotion: emotionAnalysis.primary,
    emotionTrajectory: nextModel.recentEmotions,
    studentModel: nextModel,
    repeatedError,
    misconception,
    stage,
    confidence: overallConfidence,
    clarifierHints: [], // v1.1: 문장은 생성하지 않는다. clarificationNeed 참조.

    // v1.1 상세
    normalization,
    intentAnalysis,
    emotionAnalysis,
    defensiveResponse,
    clarificationNeed,
    evidence,
    status,
  };
}

/**
 * Teaching Engine 용 요약 (내부/서버 로그 용도). 학생 노출 금지.
 */
export function serializeForTeachingEngine(r: EkluResult): string {
  const m = r.studentModel;
  const lines = [
    `[EKLU v1.1]`,
    `상태: ${r.status}`,
    `원문: ${r.normalization.original || "(빈 입력)"}`,
    `정리: ${r.normalization.normalizedText || "-"}`,
    `의미후보: ${r.normalization.possibleMeanings.join(", ") || "-"}${r.normalization.selectedMeaning ? ` / 문맥선택: ${r.normalization.selectedMeaning}` : ""}`,
    `의도: ${r.intentAnalysis.primary}${r.intentAnalysis.secondary.length ? ` (+${r.intentAnalysis.secondary.join(",")})` : ""} conf=${r.intentAnalysis.confidence.toFixed(2)}`,
    `감정: ${r.emotionAnalysis.primary}${r.emotionAnalysis.secondary.length ? ` (+${r.emotionAnalysis.secondary.join(",")})` : ""} int=${r.emotionAnalysis.intensity.toFixed(2)} conf=${r.emotionAnalysis.confidence.toFixed(2)}`,
    `감정흐름: ${r.emotionTrajectory.join(" → ") || "-"}`,
    `학습단계: ${r.stage}  종합신뢰도: ${r.confidence}`,
    `방어반응: ${r.defensiveResponse.detected ? `${r.defensiveResponse.type}(${r.defensiveResponse.confidence.toFixed(2)})` : "없음"}`,
    `오개념: ${r.misconception.detected ? `${r.misconception.kind}(${r.misconception.confidence.toFixed(2)})` : "없음"}`,
    `반복오류: ${r.repeatedError.detected ? `${r.repeatedError.kind}(${r.repeatedError.count})` : "없음"}`,
    `모델 공감/표현/명확/형식/참여/자신감/도움: ${m.empathyLevel.toFixed(1)}/${m.expressionCompleteness.toFixed(1)}/${m.meaningClarity.toFixed(1)}/${m.languageFormLevel.toFixed(1)}/${m.engagement.toFixed(1)}/${m.confidence.toFixed(1)}/${m.helpNeed.toFixed(1)}`,
    `안정성: obs=${m.observationCount} stab=${m.stability.toFixed(2)}`,
  ];
  if (r.clarificationNeed.required) {
    lines.push(
      `확인필요: target=${r.clarificationNeed.target} strategy=${r.clarificationNeed.strategy}${
        r.clarificationNeed.candidates?.length ? ` cand=[${r.clarificationNeed.candidates.join("|")}]` : ""
      }`,
    );
  }
  // evidence는 축약 요약만
  if (r.evidence.ruleIds.length) {
    lines.push(`규칙: ${r.evidence.ruleIds.slice(0, 8).join(",")}`);
  }
  return lines.join("\n");
}