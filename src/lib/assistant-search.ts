import { AI_KNOWLEDGE, type AssistantEntry, type AssistantPatternTag } from "./ai-assistant-dataset";
import { CYBER_ETHICS_DATASET, type CyberEthicsEntry } from "./cyber-ethics-dataset";

export type UnifiedHit =
  | { kind: "cyber"; entry: CyberEthicsEntry; score: number; matched: string[]; category: string }
  | { kind: "meme"; entry: AssistantEntry; score: number; matched: string[]; category: string; pattern: AssistantPatternTag };

type LookupItem = {
  kind: "cyber" | "meme";
  keywords: string[];
  category: string;
  ref: CyberEthicsEntry | AssistantEntry;
};

/**
 * 전역 룩업 테이블: 사이버 행동 윤리 + 밈/유행어/어원 데이터셋을 하나로 통합.
 * 모듈 로드 시 한 번만 구축된다. (프리컴퓨트)
 */
const LOOKUP: LookupItem[] = [
  ...CYBER_ETHICS_DATASET.map<LookupItem>((e) => ({
    kind: "cyber",
    keywords: e.keywords,
    category: e.category,
    ref: e,
  })),
  ...AI_KNOWLEDGE.map<LookupItem>((e) => ({
    kind: "meme",
    keywords: e.keywords,
    category: e.category,
    ref: e,
  })),
];

function detectPattern(category: string): AssistantPatternTag {
  if (category.includes("패턴C")) return "패턴C";
  if (category.includes("패턴A")) return "패턴A";
  if (category.includes("패턴B")) return "패턴B";
  return "일반";
}

/** 1) 전처리: 기호 제거 → 어절 분절 → 소문자 토큰 배열 */
export function tokenize(query: string): { raw: string; tokens: string[] } {
  const cleaned = query
    .toLowerCase()
    .replace(/[?？!！.。,·:;()\[\]{}<>"'`~@#$%^&*+=\\/|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.length === 0 ? [] : cleaned.split(" ").filter((t) => t.length > 0);
  return { raw: cleaned, tokens };
}

/**
 * 2) 다중 스코어링:
 *    - 어절 완전 일치: +2
 *    - 문장 부분 문자열 포함: +1
 */
export function searchAssistant(userQuery: string, minScore = 1): UnifiedHit | null {
  const { raw, tokens } = tokenize(userQuery);
  if (raw.length === 0) return null;
  const tokenSet = new Set(tokens);

  let bestIdx = -1;
  let bestScore = 0;
  let bestMatched: string[] = [];

  for (let i = 0; i < LOOKUP.length; i++) {
    const item = LOOKUP[i];
    let score = 0;
    const matched: string[] = [];
    for (const kwOriginal of item.keywords) {
      const kw = kwOriginal.toLowerCase();
      let hit = 0;
      if (tokenSet.has(kw)) hit += 2;
      if (raw.includes(kw)) hit += 1;
      if (hit > 0) {
        score += hit;
        matched.push(kwOriginal);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestMatched = matched;
    }
  }

  if (bestIdx < 0 || bestScore < minScore) return null;
  const item = LOOKUP[bestIdx];
  if (item.kind === "cyber") {
    return {
      kind: "cyber",
      entry: item.ref as CyberEthicsEntry,
      score: bestScore,
      matched: bestMatched,
      category: item.category,
    };
  }
  return {
    kind: "meme",
    entry: item.ref as AssistantEntry,
    score: bestScore,
    matched: bestMatched,
    category: item.category,
    pattern: detectPattern(item.category),
  };
}