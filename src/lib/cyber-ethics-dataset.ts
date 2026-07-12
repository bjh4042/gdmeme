import raw from "./cyber-ethics-dataset.json";

export type CyberEthicsSolution = {
  title: string;
  context: string;
  action_guide: string;
};

export type CyberEthicsEntry = {
  category: string;
  keywords: string[];
  student_question: string;
  bot_response: CyberEthicsSolution;
};

export const CYBER_ETHICS_DATASET: CyberEthicsEntry[] = raw as CyberEthicsEntry[];

/**
 * 사용자가 입력한 문장에서 사이버 행동 윤리 데이터셋의 keywords 중
 * 하나라도 매칭되면 가장 많이 겹친 엔트리를 돌려준다.
 * (동률이면 데이터셋 등장 순서 우선)
 */
export function matchCyberEthics(userText: string): {
  entry: CyberEthicsEntry;
  matched: string[];
} | null {
  const haystack = userText.toLowerCase().replace(/\s+/g, "");
  let best: { entry: CyberEthicsEntry; matched: string[]; order: number } | null = null;

  CYBER_ETHICS_DATASET.forEach((entry, order) => {
    const matched = entry.keywords.filter((k) =>
      haystack.includes(k.toLowerCase().replace(/\s+/g, "")),
    );
    if (matched.length === 0) return;
    if (!best || matched.length > best.matched.length) {
      best = { entry, matched, order };
    }
  });

  return best ? { entry: best.entry, matched: best.matched } : null;
}