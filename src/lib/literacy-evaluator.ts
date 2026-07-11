// 3중 시맨틱 예절 평가 매트릭스 엔진
import { MEME_TRIGGERS } from "./literacy-seed";

export type EvalReason =
  | "evasive-question"
  | "low-effort"
  | "sarcastic-mockery"
  | "slang"
  | "missing-concept"
  | "too-short"
  | "no-honorific"
  | "ok";

export type EvalResult = {
  pass: boolean;
  reason: EvalReason;
  detail?: string;
  hintWords?: string[];
};

const CONCEPTS: Record<string, string[][]> = {
  "teacher-late": [
    ["죄송", "미안", "잘못"],
    ["앞으로", "일찍", "일찌", "알람", "알럼", "노력", "다짐", "계획", "습관"],
    ["지키", "감사", "약속"],
  ],
  "parent-phone": [
    ["죄송", "미안", "지금", "바로"],
    ["스마트폰", "핸드폰", "폰", "약속", "시간", "끄겠", "끌", "알람", "숙제"],
    ["감사", "고마", "고맙", "응원"],
  ],
  "new-friend": [
    ["안녕", "반가", "같이", "알려", "저쪽", "이쪽"],
    ["이야", "반가", "친구", "좋아"],
    ["좋아", "만나", "내일", "약속", "보자"],
  ],
  librarian: [
    ["죄송", "미안", "조용"],
    ["정리", "제자리", "꽂", "책"],
    ["감사", "고마", "지키", "규칙", "약속"],
  ],
  "slang-master": [
    ["고운", "바른", "우리말", "표준어", "존중", "유행어", "비속어", "대화"],
    ["배려", "속상", "무시", "미안", "친구", "존중"],
    ["같이", "앞으로", "응원", "도와", "고운", "바른"],
  ],
};

const CASUAL_SCENARIOS = new Set(["new-friend", "slang-master"]);

const EVASIVE_STANDALONE = [
  "몰라", "몰라요", "글쎄", "글쎄요", "그러게", "그러게요",
  "대박", "음", "어", "왜요", "왜", "어떻게요", "어떻게",
  "네", "넹", "ㅇㅇ", "ㄴㄴ", "ㅋ", "ㅎ",
];

const HONORIFIC_ENDINGS = [
  "습니다", "입니다", "ㅂ니다",
  "겠습니다", "겠어요",
  "해요", "예요", "이에요", "에요",
  "할게요", "할래요", "볼게요", "볼래요", "드릴게요", "드려요",
  "주세요", "주십시오", "바랍니다",
  "감사합니다", "고맙습니다", "죄송합니다", "미안합니다",
  "요",
];

const CASUAL_ENDINGS = [
  "하자", "가자", "보자", "만나자", "놀자",
  "할게", "볼게", "줄게",
  "이야", "야",
  "반가워", "고마워", "미안해", "미안",
  "좋아", "그래", "응",
  "해", "해봐", "해줘",
];

function stripTail(s: string) {
  return s.replace(/[\s\.\!\?~]+$/g, "");
}

function endsWithAny(text: string, arr: string[]) {
  const t = stripTail(text);
  return arr.some((e) => t.endsWith(e));
}

function includesFuzzy(text: string, token: string) {
  return text.replace(/\s+/g, "").includes(token);
}

function containsAnyConcept(text: string, tokens: string[]) {
  return tokens.some((t) => includesFuzzy(text, t));
}

function findSlang(text: string): string | null {
  return MEME_TRIGGERS.find((m) => text.includes(m)) ?? null;
}

function isSarcasticMockery(text: string) {
  const mocking = /(ㅋㅋ+|ㅎㅎ+|ㅡㅡ+|~{2,}|;;+)/;
  if (!mocking.test(text)) return false;
  const polite = /(요|니다|겠|드릴|감사|죄송|미안|주세요)/;
  return polite.test(text);
}

function isEvasiveQuestion(text: string) {
  const t = text.trim();
  if (/[?？]\s*$/.test(t)) return true;
  const bare = t.replace(/[\s\.\!\?~]+/g, "");
  return EVASIVE_STANDALONE.includes(bare);
}

function isLowEffort(text: string) {
  const bare = text.replace(/\s+/g, "");
  if (bare.length < 3) return true;
  return EVASIVE_STANDALONE.includes(bare);
}

export function evaluateReply(params: {
  text: string;
  scenarioId: string;
  stageIdx: number;
  correctionMode: boolean;
}): EvalResult {
  const { text, scenarioId, stageIdx } = params;
  const trimmed = text.trim();
  const casual = CASUAL_SCENARIOS.has(scenarioId);
  const stageConcepts = CONCEPTS[scenarioId]?.[stageIdx] ?? [];
  const hintWords = stageConcepts.slice(0, 6);

  // 1단계: Strict & Sentiment
  if (isEvasiveQuestion(trimmed)) return { pass: false, reason: "evasive-question", hintWords };
  if (isLowEffort(trimmed)) return { pass: false, reason: "low-effort", hintWords };
  if (isSarcasticMockery(trimmed)) return { pass: false, reason: "sarcastic-mockery", hintWords };

  const slang = findSlang(trimmed);
  if (slang) return { pass: false, reason: "slang", detail: slang, hintWords };

  // 3단계: 길이·어미
  const bareLen = trimmed.replace(/\s+/g, "").length;
  if (bareLen < 8) return { pass: false, reason: "too-short", hintWords };
  const endingOk = casual
    ? endsWithAny(trimmed, [...CASUAL_ENDINGS, ...HONORIFIC_ENDINGS])
    : endsWithAny(trimmed, HONORIFIC_ENDINGS);
  if (!endingOk) return { pass: false, reason: "no-honorific", hintWords };

  // 2단계: 개념 토큰(퍼지)
  if (stageConcepts.length > 0 && !containsAnyConcept(trimmed, stageConcepts)) {
    return { pass: false, reason: "missing-concept", hintWords };
  }

  return { pass: true, reason: "ok" };
}

// NPC별 반려 대사 (index = 실패 횟수-1, clamp). 3회+ 실패 시 마지막 대사 유지 + 힌트 노출.
export const NPC_REJECTIONS: Record<string, string[]> = {
  "teacher-late": [
    "선생님이 ○○이의 구체적인 다짐을 묻고 있단다. 어떻게 행동할지 진지하게 대답해 주겠니?",
    "선생님과 대화할 때는 예의를 갖추어 온전한 문장으로 말해야지. 다시 한번 바르게 말해볼까?",
  ],
  "parent-phone": [
    "엄마 질문을 피하거나 장난치면 엄마 마음이 속상해. 진짜 네 생각을 듣고 싶어.",
    "가족 사이에도 지켜야 할 예절이 있어. 성의 있게 다시 말해줄래?",
  ],
  librarian: [
    "공공장소에서는 규칙을 지켜야 해요. 변명 대신 올바른 대답을 기대할게요.",
    "도서관 예절에 맞는 바른 우리말로 사과하고 행동을 약속해 볼까요?",
  ],
  "new-friend": [
    "응? 잘 못 들었어. 처음 만난 사이니까 조금 더 친절하고 다정한 문장으로 말해줄래?",
    "응? 잘 못 들었어. 처음 만난 사이니까 조금 더 친절하고 다정한 문장으로 말해줄래?",
  ],
  "slang-master": [
    "에이, 너도 나랑 똑같이 말하면서 뭘 고치라는 거야? 바른 표준어로 정확하게 이유를 설명해 줘!",
    "에이, 너도 나랑 똑같이 말하면서 뭘 고치라는 거야? 바른 표준어로 정확하게 이유를 설명해 줘!",
  ],
};

export function rejectionLine(scenarioId: string, wrongCount: number) {
  const arr = NPC_REJECTIONS[scenarioId] ?? [
    "다시 한번 바른 말로 표현해 볼까요?",
    "가이드의 예시를 참고해 다시 말해보세요.",
  ];
  const idx = Math.min(Math.max(wrongCount - 1, 0), arr.length - 1);
  return arr[idx];
}

export function xpForStageClear(wrongCount: number) {
  if (wrongCount === 0) return 15;
  if (wrongCount === 1) return 10;
  return 5;
}

export function reasonLabel(r: EvalReason) {
  switch (r) {
    case "evasive-question": return "역질문/회피";
    case "low-effort": return "단답/성의 부족";
    case "sarcastic-mockery": return "감정 모순(조롱성 결합)";
    case "slang": return "유행어/비속어";
    case "missing-concept": return "핵심 개념 누락";
    case "too-short": return "문장 길이 부족";
    case "no-honorific": return "존댓말 어미 미충족";
    default: return "통과";
  }
}
