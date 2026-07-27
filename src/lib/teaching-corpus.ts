/**
 * Teaching Engine Part 4-1 — Few-shot Teaching Corpus
 *
 * 역할: 유사 상황에서 문체와 흐름만 참고하는 예시 모음.
 *   ❌ 규칙/Planner/Strategy를 변경하지 않는다.
 *   ❌ 문장을 그대로 복사하지 않는다 (약간 변형해서 사용).
 *   ✅ 같은 상황당 최소 5개의 표현을 보유한다.
 *   ✅ 유사 예시가 없으면 호출자는 기존 규칙대로 생성한다.
 */
import type { Emotion, LearningStage } from "./eklu-engine";
import type { TeachingStrategy } from "./teaching-strategy";
import type { PedagogicalGoal } from "./teaching-planner";

export type FewShotExample = {
  id: string;
  situation: string;
  studentInput: string;
  studentEmotion: Emotion | "defensive" | "confused" | "silent";
  currentStage: LearningStage;
  teachingGoal: PedagogicalGoal;
  strategy: TeachingStrategy;
  teacherResponses: string[]; // 최소 5개 표현
  expectedStudentResponse?: string;
  reason: string;
  keywords: string[]; // 유사도 매칭용
};

// ─────────────────────────────────────────────────────────────
// Corpus
// ─────────────────────────────────────────────────────────────

export const TEACHING_CORPUS: FewShotExample[] = [
  {
    id: "ex1_perspective_shift",
    situation: "친구가 먼저 놀렸다고 주장하는 상황",
    studentInput: "친구가 먼저 놀렸어요.",
    studentEmotion: "anger",
    currentStage: "investigation",
    teachingGoal: "empathy",
    strategy: "perspective_shift",
    teacherResponses: [
      "억울한 마음이 들었겠구나. 친구 입장에서는 어떤 기분이었을까?",
      "속상했겠어요. 그때 친구는 어떤 마음이었을 것 같아요?",
      "그런 일이 있었구나. 친구가 그 말을 들었을 때 마음은 어땠을까?",
      "먼저 그런 말을 들으면 속상하지요. 반대로 친구가 들었다면 어땠을까?",
      "화가 날 만해요. 친구 자리에서 한번 생각해 볼까?",
    ],
    expectedStudentResponse: "친구도 속상했을 것 같아요.",
    reason: "억울한 감정을 먼저 공감한 뒤 상대 관점으로 유도",
    keywords: ["먼저", "놀렸", "친구가", "억울"],
  },
  {
    id: "ex2_counterexample",
    situation: "학생이 자신의 잘못을 부정하며 사과를 거부",
    studentInput: "내 잘못 아니에요.",
    studentEmotion: "defensive",
    currentStage: "empathy",
    teachingGoal: "empathy",
    strategy: "counterexample",
    teacherResponses: [
      "만약 친구가 너에게 똑같이 말했다면 기분이 어땠을까?",
      "반대로 네가 그런 말을 들었다면 어떤 마음이 들었을 것 같아?",
      "친구가 너에게 같은 말을 했다고 상상해 보면 어떨까?",
      "역할을 바꿔서 생각해 볼까? 네가 들었다면 어땠을까?",
      "네가 그 자리에 있었다면 마음이 어땠을 것 같아요?",
    ],
    reason: "방어 반응을 비난하지 않고 역지사지로 유도",
    keywords: ["잘못 아니", "안 했", "내가 왜", "나 아니"],
  },
  {
    id: "ex3_praise",
    situation: "학생이 친구 감정을 인식한 순간",
    studentInput: "친구가 속상했을 것 같아요.",
    studentEmotion: "sadness",
    currentStage: "empathy",
    teachingGoal: "empathy",
    strategy: "acknowledge_emotion",
    teacherResponses: [
      "좋아요. 친구 마음을 생각해 보려고 했구나.",
      "친구 마음을 헤아리려고 한 점이 참 좋아요.",
      "그렇게 생각해 준 마음이 따뜻해요.",
      "친구 입장에서 느껴 보려 한 것이 정말 멋져요.",
      "친구의 마음을 살펴봐 준 점, 참 잘했어요.",
    ],
    reason: "구체적 행동(관점 이해)을 짚어 칭찬",
    keywords: ["속상했", "친구가 힘들", "친구 마음", "미안했"],
  },
  {
    id: "ex4_easy_open",
    situation: "학생이 아무 말도 하지 않거나 반응이 없음",
    studentInput: "...",
    studentEmotion: "silent",
    currentStage: "discovery",
    teachingGoal: "emotion_awareness",
    strategy: "easy_open_question",
    teacherResponses: [
      "괜찮아요. 천천히 생각해 봐도 돼요. 친구 마음은 어땠을까?",
      "말하기 어려우면 조금 기다려도 돼요. 그때 기분이 어땠어요?",
      "천천히 해도 괜찮아요. 지금 떠오르는 마음이 있을까?",
      "바로 말 안 해도 돼요. 그 상황을 다시 떠올려 볼까?",
      "괜찮아요. 한 단어여도 좋아요. 어떤 마음이었어요?",
    ],
    reason: "침묵을 존중하고 부담을 낮춘 열린 질문",
    keywords: ["...", "모르겠", "말 안", "몰라요"],
  },
  {
    id: "ex5_encourage_retry",
    situation: "학생이 모범답안이나 예시 문장을 그대로 복사",
    studentInput: "친구의 마음을 이해합니다.",
    studentEmotion: "neutral",
    currentStage: "change",
    teachingGoal: "expression_revision",
    strategy: "encourage_retry",
    teacherResponses: [
      "좋아요. 이번에는 너의 말로 한번 표현해 볼까?",
      "잘 따라 했어요. 이번엔 네 마음의 단어로 말해 볼까?",
      "좋아요. 조금 더 너답게 표현해 볼 수 있을까?",
      "잘했어요. 이번엔 오늘 있었던 일을 넣어서 말해 볼까?",
      "좋아요. 이번엔 네가 자주 쓰는 말로 바꿔 볼까?",
    ],
    reason: "복제 응답을 인정하되 자기 언어로 재표현 유도",
    keywords: ["이해합니다", "그렇습니다", "예시:", "모범"],
  },
];

// ─────────────────────────────────────────────────────────────
// Lookup — 상황이 유사할 때만 참고
// ─────────────────────────────────────────────────────────────

export type CorpusQuery = {
  studentInput?: string;
  emotion?: string;
  stage?: LearningStage;
  goal?: PedagogicalGoal;
  strategy?: TeachingStrategy;
};

export type CorpusMatch = {
  example: FewShotExample;
  score: number;
};

/**
 * 유사 예시 검색. score >= 2 일 때만 참고 권장.
 * 매칭이 약하면 null 반환 → 호출자는 기존 규칙대로 생성.
 */
export function findSimilarExample(q: CorpusQuery): CorpusMatch | null {
  const input = (q.studentInput ?? "").toLowerCase();
  let best: CorpusMatch | null = null;

  for (const ex of TEACHING_CORPUS) {
    let score = 0;
    if (q.strategy && ex.strategy === q.strategy) score += 3;
    if (q.goal && ex.teachingGoal === q.goal) score += 2;
    if (q.stage && ex.currentStage === q.stage) score += 1;
    if (q.emotion && ex.studentEmotion === q.emotion) score += 1;
    for (const kw of ex.keywords) {
      if (kw && input.includes(kw.toLowerCase())) {
        score += 2;
        break;
      }
    }
    if (!best || score > best.score) best = { example: ex, score };
  }

  if (!best || best.score < 2) return null;
  return best;
}

/**
 * 예시에서 문체 참고용 문장을 뽑되, 그대로 복사하지 않고
 * 회전(rotate)해서 반환. 호출자는 이 문장을 "참고 스타일"로만 사용해야 한다.
 */
export function pickReferenceStyle(
  example: FewShotExample,
  seed = Date.now(),
): string {
  const pool = example.teacherResponses;
  if (pool.length === 0) return "";
  const idx = Math.abs(Math.floor(seed)) % pool.length;
  return pool[idx];
}
