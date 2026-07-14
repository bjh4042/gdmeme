import {
  AI_KNOWLEDGE,
  type AssistantEntry,
  type AssistantPatternTag,
} from "./ai-assistant-dataset";
import { CYBER_ETHICS_DATASET, type CyberEthicsEntry } from "./cyber-ethics-dataset";

export type UnifiedHit =
  | { kind: "cyber"; entry: CyberEthicsEntry; score: number; matched: string[]; category: string }
  | {
      kind: "meme";
      entry: AssistantEntry;
      score: number;
      matched: string[];
      category: string;
      pattern: AssistantPatternTag;
    };

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
    .replace(/[?？!！.。,·:;()[\]{}<>"'`~@#$%^&*+=\\/|_-]+/g, " ")
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

/** 카테고리 텍스트로부터 대표 이모지 추출 (없으면 기본 아이콘) */
function iconForCategory(category: string): string {
  if (/따돌림|왕따|은따/.test(category)) return "🚪";
  if (/명예|저격|험담/.test(category)) return "🤫";
  if (/개인정보|계정|비밀번호|프라이버시/.test(category)) return "🔑";
  if (/초상|딥페이크|사진|합성/.test(category)) return "📸";
  if (/스토킹|디엠|DM/.test(category)) return "🛑";
  if (/게임|트롤/.test(category)) return "🎮";
  if (/AI|인공지능|챗봇|사물/.test(category)) return "🤖";
  if (/과의존|알림|새벽|중독/.test(category)) return "⏰";
  if (/조작|허위|주작|가짜/.test(category)) return "⚖️";
  if (/좌표|셔틀|패드립|욕설|비속어|어원|매체/.test(category)) return "🔥";
  return "💬";
}

export type GuideChip = { icon: string; label: string; prompt: string };

/**
 * 방금 매칭된 항목과 카테고리 또는 키워드가 겹치는 다른 데이터를 추려
 * 최대 4개의 컴팩트 가이드 칩을 생성한다.
 */
export function getRelatedGuides(hit: UnifiedHit, max = 4): GuideChip[] {
  const chips: GuideChip[] = [];
  const seenPrompts = new Set<string>();

  if (hit.kind === "cyber") {
    const anchor = hit.entry;
    const anchorKw = new Set(anchor.keywords.map((k) => k.toLowerCase()));
    const scored = CYBER_ETHICS_DATASET.filter((e) => e !== anchor).map((e) => {
      const overlap = e.keywords.filter((k) => anchorKw.has(k.toLowerCase())).length;
      const sameCat = e.category === anchor.category ? 1 : 0;
      return { e, score: sameCat * 3 + overlap };
    });
    scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max * 2)
      .forEach(({ e }) => {
        if (chips.length >= max) return;
        const label = shortenCategory(e.category, e.keywords);
        if (seenPrompts.has(e.student_question)) return;
        seenPrompts.add(e.student_question);
        chips.push({
          icon: iconForCategory(e.category),
          label,
          prompt: e.student_question,
        });
      });
  } else {
    const anchor = hit.entry;
    const anchorKw = new Set(anchor.keywords.map((k) => k.toLowerCase()));
    const scored = AI_KNOWLEDGE.filter((e) => e !== anchor).map((e) => {
      const overlap = e.keywords.filter((k) => anchorKw.has(k.toLowerCase())).length;
      const sameCat = e.category === anchor.category ? 1 : 0;
      return { e, score: sameCat * 3 + overlap };
    });
    scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max * 2)
      .forEach(({ e }) => {
        if (chips.length >= max) return;
        const kw = e.keywords[0] ?? "";
        const prompt = `'${kw}'의 뜻과 어원이 궁금해요.`;
        if (seenPrompts.has(prompt)) return;
        seenPrompts.add(prompt);
        chips.push({
          icon: "🔍",
          label: `'${kw}' 어원 분석`,
          prompt,
        });
      });
  }

  return chips.slice(0, max);
}

function shortenCategory(category: string, keywords: string[]): string {
  // "사이버 따돌림 (떼카/카톡 감옥)" → "떼카/카톡 감옥" 부분 우선
  const paren = category.match(/\(([^)]+)\)/);
  if (paren) return paren[1].length <= 14 ? paren[1] : paren[1].slice(0, 13) + "…";
  const base = category.replace(/\(.*\)/, "").trim();
  if (base.length <= 14) return base;
  return (keywords[0] ?? base).slice(0, 14);
}
